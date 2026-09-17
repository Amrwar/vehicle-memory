/**
 * Carnet was restored. Phase 49.
 *
 *   npx tsx infra/scripts/verify-recovery.ts
 *
 * `verify-backup.ts` proves a dump restores with its rows and its chains. This
 * asks the harder question, which is the only one that matters at three in the
 * morning: if the database were lost right now, what would the workshop have
 * lost, how long would it be shut, and what would come back wrong?
 *
 * So it does the whole thing rather than the first step of it. It writes a row
 * and notes the time. It dumps. It writes a second row, which is the work that
 * happens between a backup and a disaster and which nobody gets back. It
 * restores into a fresh database, runs the migrations against the copy, and
 * then holds the copy against the original: every table, every file the rows
 * point at, every file the store holds, every vehicle's chain, the books, the
 * queues, and the tenant boundary. It reports two numbers and a list.
 *
 * The two numbers are measured, not asserted. The list separates a hole from a
 * leftover, because a photograph that did not come back is a customer seeing a
 * gap in their report, and a file nothing points at is a bill and a picture of
 * somebody's car that nothing will ever delete. They are repaired in opposite
 * directions.
 *
 * What this cannot measure is said plainly at the end rather than quietly
 * assumed. Postgres client tools are needed; without them the drill says it
 * could not run and exits 0, the same as verify-backup, so a machine without
 * them is not a red build.
 */

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  broken,
  describeDuration,
  describeRecovery,
  fileMissing,
  fileOrphaned,
  type Gap,
  missedTargets,
  recoveryOf,
  rowsMissing,
  timeTaken,
  unaccountedFor,
  verifyChain,
  workLost,
  worstGapsFirst,
} from '@carnet/core';
import { prisma, PrismaClient } from '@carnet/db';

import { auditBooks } from '../../apps/web/src/lib/books';

const SALT = process.env.LEDGER_CHAIN_SALT ?? '';
const DRILL_DB = 'carnet_recovery_drill';
const STORE = process.env.STORAGE_LOCAL_PATH ?? '.storage';
const TAG = 'Recovery drill';

let failures = 0;
let checked = 0;
const gaps: (Gap | null)[] = [];

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
  }
}

/* ---------------------------------------------------------------------------
   Talking to Postgres
   --------------------------------------------------------------------------- */

function command(name: 'PG_DUMP' | 'PG_RESTORE' | 'PSQL', fallback: string): string[] {
  return (process.env[name] ?? fallback).split(' ').filter(Boolean);
}

function run(argv: string[], input?: Buffer, env?: NodeJS.ProcessEnv, cwd?: string): Buffer {
  const [file, ...args] = argv;
  return execFileSync(file!, args, {
    input,
    cwd,
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

/** Every table, counted exactly. */
async function counts(client: PrismaClient): Promise<Record<string, number>> {
  const tables = await client.$queryRaw<{ table: string }[]>`
    SELECT c.relname AS "table"
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`;

  const exact: Record<string, number> = {};

  for (const { table } of tables) {
    const [row] = await client.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${table}"`,
    );
    exact[table] = Number(row?.n ?? 0);
  }

  return exact;
}

/* ---------------------------------------------------------------------------
   What the rows say the store should hold
   --------------------------------------------------------------------------- */

/** Every file reference in the database, with the row that made it. */
async function referencedFiles(
  client: PrismaClient,
): Promise<{ what: string; name: string; key: string }[]> {
  const [events, jobs, photos, documents, messages] = await Promise.all([
    client.vehicleEventAttachment.findMany({ select: { id: true, url: true } }),
    client.jobAttachment.findMany({ select: { id: true, url: true } }),
    client.inspectionPhoto.findMany({ select: { id: true, url: true } }),
    client.vehicleDocument.findMany({ select: { id: true, fileKey: true, title: true } }),
    client.messageAttachment.findMany({ select: { id: true, url: true } }),
  ]);

  return [
    ...events.map((row) => ({ what: 'Passport attachment', name: row.id, key: row.url })),
    ...jobs.map((row) => ({ what: 'Job attachment', name: row.id, key: row.url })),
    ...photos.map((row) => ({ what: 'Photograph', name: row.id, key: row.url })),
    ...documents.map((row) => ({ what: 'Document', name: row.title, key: row.fileKey })),
    ...messages.map((row) => ({ what: 'Message attachment', name: row.id, key: row.url })),
  ];
}

/** Every object the local store actually holds, as keys. */
function storedFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(root, full).split(sep).join('/'));
    }
  };

  walk(root);
  return found;
}

/** One attachment, with a file actually behind it. */
async function furnishFile(orgId: string): Promise<{ id: string; key: string } | null> {
  const job = await prisma.job.findFirst({ where: { orgId }, select: { id: true } });
  if (!job) return null;

  const key = `${orgId}/jobs/${job.id}/${TAG.replace(/\s+/g, '-').toLowerCase()}.txt`;
  const path = join(STORE, key);

  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${TAG}: something a customer would expect to still be there.`);

  const row = await prisma.jobAttachment.create({
    data: {
      jobId: job.id,
      kind: 'DOCUMENT',
      url: key,
      filename: `${TAG}.txt`,
      mimeType: 'text/plain',
      sizeBytes: statSync(path).size,
      caption: TAG,
    },
    select: { id: true },
  });

  return { id: row.id, key };
}

/* ---------------------------------------------------------------------------
   The drill
   --------------------------------------------------------------------------- */

async function main() {
  console.info('\n  Carnet was restored\n');

  const url = new URL(process.env.DATABASE_URL ?? '');
  const database = url.pathname.replace(/^\//, '');
  const connection = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };

  const asUser = ['-U', connection.PGUSER];
  const pgDump = [...command('PG_DUMP', 'pg_dump'), ...asUser];
  const pgRestore = [...command('PG_RESTORE', 'pg_restore'), ...asUser];
  const psql = [...command('PSQL', 'psql'), ...asUser];

  if (!available(pgDump) || !available(pgRestore) || !available(psql)) {
    console.info(
      '  The Postgres client tools are not available here, so the drill did not run.\n' +
        '  CI runs it inside the Postgres service container. To run it locally, set PG_DUMP,\n' +
        '  PG_RESTORE and PSQL to "docker exec <container> pg_dump" and friends.\n',
    );
    return;
  }

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  /* --- work that happened before the backup -------------------------------- */

  // A row of the workshop's own work, on a table that is written and swept in
  // the ordinary course of things. The audit log would read better and cannot
  // be used: it refuses DELETE, which is exactly right of an audit log and
  // exactly wrong for a marker a drill has to clean up after itself.
  const beforeBackup = await prisma.onceRequest.create({
    data: {
      orgId: org.id,
      key: `${TAG}: before the backup`,
      doneAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    select: { id: true, createdAt: true },
  });

  // A seeded workshop has no attachments, and a store check that runs over
  // nothing passes without proving anything — the same trap the tenancy probe
  // fell into. So the drill puts one real file in the store with a real row
  // pointing at it, and takes both away at the end.
  const paperwork = await furnishFile(org.id);

  const before = await counts(prisma);
  const filesBefore = await referencedFiles(prisma);

  /* --- the backup ---------------------------------------------------------- */

  console.info('  Taking the backup');

  const dir = mkdtempSync(join(tmpdir(), 'carnet-recovery-'));
  const dumpPath = join(dir, 'carnet.dump');

  const dumpStarted = new Date();
  const dump = run(
    [...pgDump, '-Fc', '--no-owner', '--no-privileges', '-d', database],
    undefined,
    connection,
  );
  writeFileSync(dumpPath, dump);
  const dumpFinished = new Date();

  check(dump.byteLength > 100_000, 'the backup has something in it', dump.byteLength);
  console.info(
    `        ${(dump.byteLength / 1024 / 1024).toFixed(1)} MB in ` +
      `${describeDuration(timeTaken({ lost: dumpStarted, back: dumpFinished }))}`,
  );

  /* --- work that happened after it, and is therefore lost ------------------ */

  // The whole point. A backup is a moment, and a workshop carries on booking
  // cars in after that moment; the question is how much of that carrying on
  // disappears. Here it is one row and a known interval, so the number the
  // drill reports is a number it can prove rather than one it hopes for.
  const afterBackup = await prisma.onceRequest.create({
    data: {
      orgId: org.id,
      key: `${TAG}: after the backup, and expected to be lost`,
      doneAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    select: { id: true, createdAt: true },
  });

  /* --- losing it and bringing it back -------------------------------------- */

  console.info('\n  Bringing it back');

  const lostAt = new Date();

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
    /* --- the migrations, against the copy ---------------------------------- */

    // A restore that needs a migration afterwards is the normal case: the
    // backup is from the version that was running, and the version coming back
    // up is whatever is deployed. So the drill runs them, and a clean restore
    // means there is nothing left to do.
    let pending = '';
    try {
      // Three things this has to get right, each of which cost a run to find.
      // The CLI goes through node against its own entry point rather than
      // through npx, which is a shell script on one platform and a .cmd on
      // another and resolves to neither from execFileSync. It runs from
      // packages/db, because Prisma 7 takes the connection URL from the config
      // file beside the schema rather than from the schema. And both URLs are
      // overridden, because that config prefers DIRECT_DATABASE_URL — which on
      // a pooled provider points at the live database, and would have had this
      // check quietly reporting on production instead of on the copy.
      pending = run(
        [
          process.execPath,
          join('..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
          'migrate',
          'status',
        ],
        undefined,
        { DATABASE_URL: drillUrl.toString(), DIRECT_DATABASE_URL: drillUrl.toString() },
        join(process.cwd(), 'packages', 'db'),
      ).toString();
    } catch (error) {
      // `migrate status` exits non-zero when there is something to say, and
      // what it says is on stdout, which execFileSync throws away with the
      // rest of the result. The whole point of running it is to read that.
      pending = String((error as { stdout?: Buffer }).stdout ?? error);
    }

    check(
      pending.includes('up to date') || pending.includes('No pending'),
      'the restored copy needs no migration to be usable',
      pending.split('\n').filter(Boolean).slice(-1)[0],
    );

    /* --- every row ---------------------------------------------------------- */

    console.info('\n  Holding the copy against the original');

    const after = await counts(copy);

    const absent = Object.keys(before).filter((table) => !(table in after));
    check(absent.length === 0, 'every table came back', absent.join(', '));

    for (const table of Object.keys(before)) {
      if (!(table in after)) {
        gaps.push(broken({ what: 'Table', name: table, because: 'it is not in the copy at all' }));
        continue;
      }

      // The counts were taken before the second marker was written, so the
      // copy has to match them exactly — including the table the markers are
      // on. Excusing that table would have hidden the one row this drill
      // deliberately loses if it ever went missing for a different reason.
      gaps.push(rowsMissing({ table, before: before[table]!, after: after[table]! }));
    }

    const rowGaps = gaps.filter((gap) => gap?.what === 'Table').length;
    check(rowGaps === 0, 'with every row that was in it at the moment of the backup', rowGaps);

    /* --- what was lost, measured ------------------------------------------- */

    const survived = await copy.onceRequest.findUnique({
      where: { id: beforeBackup.id },
      select: { createdAt: true },
    });

    const shouldBeGone = await copy.onceRequest.findUnique({
      where: { id: afterBackup.id },
      select: { id: true },
    });

    check(survived !== null, 'work done before the backup came back');
    check(shouldBeGone === null, 'work done after it did not, which is what "lost" means');

    /* --- the files the rows point at ---------------------------------------- */

    console.info('\n  The store, and the rows that point at it');

    const filesAfter = await referencedFiles(copy);
    const held = new Set(storedFiles(STORE));

    const holes = filesAfter.filter((file) => file.key && !held.has(file.key));
    for (const hole of holes) gaps.push(fileMissing(hole));

    check(
      holes.length === 0 && filesAfter.length > 0,
      `every one of ${filesAfter.length} file references has a file behind it`,
      filesAfter.length === 0
        ? 'nothing to check, which proves nothing'
        : holes
            .slice(0, 3)
            .map((hole) => hole.key)
            .join(', '),
    );

    // And that the check above could have said otherwise. A store check is a
    // loop over a list, and a loop over a list that is empty or a comparison
    // that cannot fail reads exactly like a pass.
    if (paperwork) {
      const stashed = join(STORE, paperwork.key);
      const kept = readFileSync(stashed);
      rmSync(stashed);

      const withHole = (await referencedFiles(copy)).filter(
        (file) => file.key && !new Set(storedFiles(STORE)).has(file.key),
      );

      check(
        withHole.some((file) => file.key === paperwork.key),
        'and a file that did not come back would have been noticed',
        `${withHole.length} found`,
      );

      mkdirSync(join(stashed, '..'), { recursive: true });
      writeFileSync(stashed, kept);
    }

    // Recorded rather than failed, and the distinction is not a softening. A
    // file nothing points at was already there before the drill ran and is
    // still there afterwards: the restore did not cause it and a restore
    // cannot fix it, so failing the drill here would be blaming the recovery
    // for the state of the store. It belongs in the written record, which is
    // what the phase asked for, and it is cleared with storage-orphans.ts.
    const pointedAt = new Set(filesAfter.map((file) => file.key));
    const leftovers = [...held].filter((key) => !pointedAt.has(key));
    for (const key of leftovers) gaps.push(fileOrphaned({ key }));

    if (leftovers.length > 0) {
      console.info(
        `        ${leftovers.length} file(s) in the store point at nothing. ` +
          'Listed below; clear them with npm run storage:orphans.',
      );
    }

    check(
      filesBefore.length === filesAfter.length,
      'the same number of references came back',
      `${filesBefore.length} before, ${filesAfter.length} after`,
    );

    /* --- the passports ------------------------------------------------------ */

    console.info('\n  The records that have to hold together');

    const vehicles = await copy.vehicle.findMany({
      where: { eventCount: { gt: 0 } },
      select: { id: true, vin: true },
    });

    let brokenChains = 0;

    for (const vehicle of vehicles) {
      const events = await copy.vehicleEvent.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { sequence: 'asc' },
      });

      if (!verifyChain(events as never, SALT).valid) {
        brokenChains += 1;
        gaps.push(
          broken({
            what: 'Passport',
            name: vehicle.vin,
            because: 'the chain no longer verifies in the copy',
          }),
        );
      }
    }

    check(brokenChains === 0, `every one of ${vehicles.length} passports still verifies`);

    const triggers = await copy.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM pg_trigger
      WHERE tgname LIKE 'carnet_%' OR tgname LIKE '%immutable%'`;

    check(
      Number(triggers[0]?.n ?? 0) > 0,
      'the rules the database enforces came back with it',
      Number(triggers[0]?.n ?? 0),
    );

    /* --- the books ---------------------------------------------------------- */

    // Restoring a ledger that no longer balances is worse than not restoring
    // it, because it is believed. The same audit that runs against the live
    // workshop runs against the copy.
    const audit = await auditBooks(org.id, copy);
    const wrong = audit.breaches.length + audit.violations.length;

    for (const breach of audit.breaches) {
      gaps.push(broken({ what: 'Figure', name: breach.document, because: breach.sentence }));
    }

    check(
      wrong === 0,
      `the books still agree with themselves in the copy (${audit.checked} checked)`,
      wrong > 0
        ? `${wrong} wrong, ${unaccountedFor(audit).minor / 100} unaccounted for`
        : undefined,
    );

    /* --- the boundary ------------------------------------------------------- */

    const orgs = await copy.organization.findMany({ select: { id: true, name: true } });
    let leaked = 0;

    for (const each of orgs) {
      const [customers, invoices] = await Promise.all([
        copy.customer.count({ where: { orgId: each.id } }),
        copy.invoice.count({ where: { orgId: each.id } }),
      ]);

      const [originalCustomers, originalInvoices] = await Promise.all([
        prisma.customer.count({ where: { orgId: each.id } }),
        prisma.invoice.count({ where: { orgId: each.id } }),
      ]);

      if (customers !== originalCustomers || invoices !== originalInvoices) {
        leaked += 1;
        gaps.push(
          broken({
            what: 'Workshop',
            name: each.name,
            because: 'it has a different number of records in the copy',
          }),
        );
      }
    }

    check(
      leaked === 0,
      `each of ${orgs.length} workshops came back with its own records and no others`,
    );

    /* --- the queues --------------------------------------------------------- */

    console.info('\n  The work that was in flight');

    // A restore that loses the queue loses messages a customer was promised.
    // A restore that brings the queue back still holding leases nobody owns is
    // worse: the work looks claimed and never runs.
    const [outbox, messages] = await Promise.all([
      copy.outboxEvent.count({ where: { processedAt: null } }),
      copy.messageLog.count({ where: { status: 'QUEUED' } }),
    ]);

    const [outboxBefore, messagesBefore] = await Promise.all([
      prisma.outboxEvent.count({ where: { processedAt: null } }),
      prisma.messageLog.count({ where: { status: 'QUEUED' } }),
    ]);

    check(
      outbox === outboxBefore && messages === messagesBefore,
      `everything still waiting to be sent came back (${outbox} events, ${messages} messages)`,
      `${outboxBefore}/${messagesBefore} before`,
    );

    // Not "is anything held until later", because holding until later is what
    // the column is for: `availableAt` carries the retry backoff and the
    // quiet-hours hold in one value, deliberately, since from the sender's
    // side they are the same instruction. A message waiting until nine in the
    // morning is correct. What cannot be correct after a restore is a message
    // held past any hold the product knows how to write, or one that has run
    // out of attempts and is still sitting in the queue.
    const [heldTooLong, exhausted] = await Promise.all([
      copy.messageLog.count({
        where: { status: 'QUEUED', availableAt: { gt: new Date(Date.now() + 48 * 3_600_000) } },
      }),
      copy.messageLog.count({ where: { status: 'QUEUED', attempts: { gte: 8 } } }),
    ]);

    check(
      heldTooLong === 0 && exhausted === 0,
      'and none of it will sit in the queue for ever',
      heldTooLong > 0
        ? `${heldTooLong} held past any hold we write`
        : `${exhausted} out of attempts`,
    );

    /* --- the two numbers ---------------------------------------------------- */

    const backAt = new Date();

    const recovery = recoveryOf(
      {
        lost: workLost({
          lastSurvived: survived?.createdAt ?? beforeBackup.createdAt,
          lastHappened: afterBackup.createdAt,
        }),
        took: timeTaken({ lost: lostAt, back: backAt }),
        checked,
      },
      gaps,
    );

    report(recovery);
  } finally {
    await copy.$disconnect();

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

    await prisma.onceRequest.deleteMany({ where: { key: { startsWith: TAG } } });
    await prisma.jobAttachment.deleteMany({ where: { caption: TAG } });

    if (paperwork) rmSync(join(STORE, paperwork.key), { force: true });
  }
}

/** The written record the runbook asks for. */
function report(recovery: ReturnType<typeof recoveryOf>) {
  console.info('\n  What it came to\n');
  console.info(`  ${describeRecovery(recovery)}`);

  const missed = missedTargets(recovery);

  for (const line of missed) console.info(`  MISSED  ${line}`);

  check(missed.length === 0, 'the recovery was inside what was promised', missed.join(' '));

  for (const gap of worstGapsFirst(recovery.gaps).slice(0, 20)) {
    console.info(`  ${gap.kind.toUpperCase().padEnd(9)}${gap.sentence}`);
  }

  // Said rather than assumed. A dump-and-restore drill measures the recovery
  // point of a dump-and-restore strategy, which is the age of the last dump.
  // Production promises five minutes, and what buys that is continuous
  // archiving of the write-ahead log — a thing this drill cannot exercise
  // against a local database, and therefore a thing this drill must not be
  // read as having proved.
  console.info(
    '\n  What this drill did not measure:\n' +
      '    The five-minute recovery point in NFR-304 is bought by continuous archiving of\n' +
      '    the write-ahead log, not by the nightly dump this drill takes. What is measured\n' +
      '    here is that a dump restores completely and correctly, and how long that takes.\n' +
      '    Archiving is a property of the managed database and is verified in its console.\n',
  );

  console.info('');

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. Carnet came back.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
