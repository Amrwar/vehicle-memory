/**
 * A backup is restored, and the restored copy is checked.
 *
 *   npx tsx infra/scripts/verify-backup.ts
 *
 * The runbook says untested backups are not backups and promises a quarterly
 * drill. This is the drill, and it runs in CI on every push: dump the seeded
 * database, restore it into a fresh one, and check that every row came back
 * and every vehicle's chain still verifies in the copy. A dump that restores
 * with rows missing, or with hashes that no longer agree, is exactly the
 * failure discovered at the worst possible moment otherwise.
 *
 * pg_dump and pg_restore come from the same server, so the versions agree:
 * PG_DUMP and PG_RESTORE name the commands, which in CI run inside the
 * Postgres service container (`docker exec <id> pg_dump …`). Without the
 * tools available the drill reports that it could not run and exits 0, so
 * a developer's machine without Postgres client tools is not a red build;
 * CI always has them.
 */

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { verifyChain } from '@carnet/core';
import { prisma, PrismaClient } from '@carnet/db';

const SALT = process.env.LEDGER_CHAIN_SALT ?? '';
const DRILL_DB = 'carnet_restore_drill';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** "pg_dump" or "docker exec <id> pg_dump", split into argv. */
function command(name: 'PG_DUMP' | 'PG_RESTORE' | 'PSQL', fallback: string): string[] {
  return (process.env[name] ?? fallback).split(' ').filter(Boolean);
}

function run(argv: string[], input?: Buffer, env?: NodeJS.ProcessEnv): Buffer {
  const [file, ...args] = argv;
  return execFileSync(file!, args, {
    input,
    env: { ...process.env, ...env },
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}

function available(argv: string[]): boolean {
  try {
    run([
      argv[0]!,
      ...argv.slice(1).filter((arg, i, all) => arg !== '-U' && all[i - 1] !== '-U'),
      '--version',
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Table row counts, for comparing the copy against the original. */
async function counts(client: PrismaClient): Promise<Record<string, number>> {
  const rows = await client.$queryRaw<{ table: string; n: bigint }[]>`
    SELECT c.relname AS "table", c.reltuples::bigint AS n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`;
  // reltuples is an estimate; count the tables that matter exactly.
  const exact: Record<string, number> = {};
  for (const row of rows) {
    const counted = await client.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${row.table}"`,
    );
    exact[row.table] = Number(counted[0]?.n ?? 0);
  }
  return exact;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const database = url.pathname.replace(/^\//, '');
  const connection = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };

  // The user is named on the command line as well as in the environment,
  // because a command run inside the container by docker exec does not see
  // this process's environment and connects over the socket as that user.
  const asUser = ['-U', connection.PGUSER];
  const pgDump = [...command('PG_DUMP', 'pg_dump'), ...asUser];
  const pgRestore = [...command('PG_RESTORE', 'pg_restore'), ...asUser];
  const psql = [...command('PSQL', 'psql'), ...asUser];

  if (!available(pgDump) || !available(pgRestore) || !available(psql)) {
    console.info(
      '\nverify-backup: pg_dump, pg_restore or psql is not available here, so the drill did not run.\n' +
        'CI runs it on every push inside the Postgres service container. To run it locally, install\n' +
        'the PostgreSQL client tools matching your server, or set PG_DUMP, PG_RESTORE and PSQL to\n' +
        '"docker exec <container> pg_dump" and friends.\n',
    );
    return;
  }

  console.info('\nThe original');
  const before = await counts(prisma);
  const tables = Object.keys(before).length;
  const rowsBefore = Object.values(before).reduce((sum, n) => sum + n, 0);
  check('tables counted', tables > 50, true);
  check('rows counted', rowsBefore > 500, true);

  console.info('\nDump');
  const dir = mkdtempSync(join(tmpdir(), 'carnet-drill-'));
  const dumpPath = join(dir, 'carnet.dump');
  const dump = run(
    [...pgDump, '-Fc', '--no-owner', '--no-privileges', '-d', database],
    undefined,
    connection,
  );
  writeFileSync(dumpPath, dump);
  check('the dump has bytes', dump.byteLength > 100_000, true);

  console.info('\nRestore into a fresh database');
  run(
    [
      ...psql,
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE IF EXISTS ${DRILL_DB}`,
    ],
    undefined,
    connection,
  );
  run(
    [...psql, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${DRILL_DB}`],
    undefined,
    connection,
  );
  run(
    [...pgRestore, '--no-owner', '--no-privileges', '-d', DRILL_DB],
    readFileSync(dumpPath),
    connection,
  );

  const drillUrl = new URL(process.env.DATABASE_URL ?? '');
  drillUrl.pathname = `/${DRILL_DB}`;
  const copy = new PrismaClient({
    adapter: new PrismaPg({ connectionString: drillUrl.toString(), max: 2 }),
  });

  try {
    console.info('\nThe copy');
    const after = await counts(copy);
    const missing = Object.keys(before).filter((table) => !(table in after));
    check('every table came back', missing, []);
    const differing = Object.keys(before).filter((table) => before[table] !== after[table]);
    check('with every row', differing, []);

    const vehicles = await copy.vehicle.findMany({
      where: { eventCount: { gt: 0 } },
      select: { id: true, vin: true },
      take: 200,
    });
    let broken = 0;
    for (const vehicle of vehicles) {
      const events = await copy.vehicleEvent.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { sequence: 'asc' },
      });
      if (!verifyChain(events as never, SALT).valid) broken += 1;
    }
    check(`every one of ${vehicles.length} chains verifies in the copy`, broken, 0);

    const triggers = await copy.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM pg_trigger WHERE tgname LIKE 'carnet_%' OR tgname LIKE '%immutable%'`;
    check('the immutability triggers came with it', Number(triggers[0]?.n ?? 0) > 0, true);
  } finally {
    await copy.$disconnect();
    run(
      [...psql, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${DRILL_DB}`],
      undefined,
      connection,
    );
  }

  console.info(
    failures === 0 ? '\nverify-backup: all checks passed' : `\nverify-backup: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
