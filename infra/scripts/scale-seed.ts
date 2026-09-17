/**
 * A workshop the size of a real one, several years in. Phase 51.
 *
 *   npx tsx infra/scripts/scale-seed.ts            the full size
 *   npx tsx infra/scripts/scale-seed.ts --small    a tenth of it, for a laptop
 *   npx tsx infra/scripts/scale-seed.ts --clear    take it all away again
 *
 * A screen that is quick against six customers is a screen nobody has tested.
 * Every failure this phase is looking for — the query that runs once per row,
 * the list with no bound, the report that loads a year into memory — is
 * invisible on a seeded database and fatal on a real one, and the only honest
 * way to find them is to put the rows in and look.
 *
 * Written as SQL rather than through the client, and not as an optimisation.
 * Half a million jobs through an ORM is an afternoon and several gigabytes of
 * Node heap; the same rows from `generate_series` are a couple of minutes and
 * no memory at all, because they never leave the database.
 *
 * Everything it makes carries the tag, so `--clear` can take exactly this away
 * and leave the seeded workshop somebody demonstrates from untouched.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

const TAG = 'scale';

/** The sizes the roadmap asked for. */
const FULL = {
  customers: 100_000,
  vehicles: 150_000,
  jobs: 500_000,
  invoices: 200_000,
  audits: 2_000_000,
};

const SMALL = {
  customers: 10_000,
  vehicles: 15_000,
  jobs: 50_000,
  invoices: 20_000,
  audits: 200_000,
};

function human(n: number): string {
  return n.toLocaleString('en-GB');
}

async function timed<T>(what: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const out = await run();
  console.info(`  ${what} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return out;
}

async function clear() {
  console.info('\n  Taking it away again\n');

  // Not the audit rows. `audit_logs` refuses DELETE and that is the point of
  // it — a log somebody can quietly tidy is not a log. A script that wants
  // them gone should not be given a way round the rule; the way to a clean
  // database is `npm run db:seed`, which drops and rebuilds it.
  const audits = await prisma.auditLog.count({ where: { action: TAG } });

  if (audits > 0) {
    console.info(
      `  ${human(audits)} audit rows stay: the audit log is append-only, by design.
` + '  Run npm run db:seed for a clean database.',
    );
  }

  await timed('invoices', () =>
    prisma.$executeRawUnsafe(`DELETE FROM "invoices" WHERE "number" LIKE '${TAG}-%'`),
  );
  await timed('jobs', () =>
    prisma.$executeRawUnsafe(`DELETE FROM "jobs" WHERE "shortDescription" LIKE '${TAG}:%'`),
  );
  await timed('vehicle access', () =>
    prisma.$executeRawUnsafe(
      `DELETE FROM "vehicle_access_grants" WHERE "vehicleId" IN (SELECT "id" FROM "vehicles" WHERE "vin" LIKE '${TAG.toUpperCase()}%')`,
    ),
  );
  await timed('vehicles', () =>
    prisma.$executeRawUnsafe(`DELETE FROM "vehicles" WHERE "vin" LIKE '${TAG.toUpperCase()}%'`),
  );
  await timed('customers', () =>
    prisma.$executeRawUnsafe(`DELETE FROM "customers" WHERE "notes" = '${TAG}'`),
  );

  console.info('');
}

async function main() {
  if (process.argv.includes('--clear')) {
    await clear();
    return;
  }

  const size = process.argv.includes('--small') ? SMALL : FULL;

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, locations: { take: 1, select: { id: true } } },
  });

  const orgId = org.id;
  const locationId = org.locations[0]?.id;

  if (!locationId) {
    console.info('  The seeded workshop has no site to hang jobs on. Run npm run db:seed.');
    process.exitCode = 1;
    return;
  }

  console.info(`\n  Filling up ${orgId}\n`);
  console.info(
    `  ${human(size.customers)} customers, ${human(size.vehicles)} vehicles, ` +
      `${human(size.jobs)} jobs, ${human(size.invoices)} invoices, ${human(size.audits)} audit rows\n`,
  );

  /* --- customers ----------------------------------------------------------- */

  // `notes` carries the tag rather than a column of its own: adding a column to
  // production so a test script can find its own rows is the wrong trade.
  await timed('customers', () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "customers" ("id", "orgId", "displayName", "kind", "email", "phone", "notes", "createdAt", "updatedAt")
      SELECT
        'sc' || lpad(i::text, 22, '0'),
        '${orgId}',
        (ARRAY['Abbott','Barnes','Clarke','Dawson','Ellis','Fletcher','Gibson','Harper','Ingram','Jarvis'])[1 + (i % 10)]
          || ' ' || (ARRAY['Motors','Haulage','Plumbing','Joinery','Electrical','Catering','Couriers','Tiling'])[1 + (i % 8)]
          || ' ' || i,
        CASE WHEN i % 5 = 0 THEN 'COMPANY'::"CustomerKind" ELSE 'INDIVIDUAL'::"CustomerKind" END,
        'scale-' || i || '@example.test',
        '07' || lpad((700000000 + i)::text, 9, '0'),
        '${TAG}',
        now() - (i % 1200) * interval '1 day',
        now()
      FROM generate_series(1, ${size.customers}) AS i
      ON CONFLICT DO NOTHING`),
  );

  /* --- vehicles ------------------------------------------------------------ */

  await timed('vehicles', () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "vehicles" ("id", "vin", "registration", "make", "model", "year", "createdAt", "updatedAt")
      SELECT
        'sv' || lpad(i::text, 22, '0'),
        '${TAG.toUpperCase()}' || lpad(i::text, 12, '0'),
        'S' || lpad(i::text, 2, '0') || ' ' || chr(65 + (i % 26)) || chr(65 + ((i / 26) % 26)) || chr(65 + ((i / 676) % 26)),
        (ARRAY['Ford','Vauxhall','Volkswagen','Toyota','BMW','Nissan','Renault','Kia'])[1 + (i % 8)],
        (ARRAY['Focus','Astra','Golf','Yaris','1 Series','Qashqai','Clio','Ceed'])[1 + (i % 8)],
        2010 + (i % 15),
        now() - (i % 1200) * interval '1 day',
        now()
      FROM generate_series(1, ${size.vehicles}) AS i
      ON CONFLICT DO NOTHING`),
  );

  await timed('vehicle access', () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "vehicle_access_grants" ("id", "orgId", "vehicleId", "scope", "grantedAt")
      SELECT
        'sg' || lpad(i::text, 22, '0'),
        '${orgId}',
        'sv' || lpad(i::text, 22, '0'),
        'READ'::"AccessScope",
        now() - (i % 1200) * interval '1 day'
      FROM generate_series(1, ${size.vehicles}) AS i
      ON CONFLICT DO NOTHING`),
  );

  /* --- jobs ---------------------------------------------------------------- */

  // Numbers start well above anything the seed uses, so the sequence the
  // application allocates from is never walked into.
  await timed('jobs', () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "jobs" ("id", "orgId", "locationId", "number", "customerId", "vehicleId", "shortDescription", "status", "createdAt", "updatedAt")
      SELECT
        'sj' || lpad(i::text, 22, '0'),
        '${orgId}',
        '${locationId}',
        900000 + i,
        'sc' || lpad((1 + (i % ${size.customers}))::text, 22, '0'),
        'sv' || lpad((1 + (i % ${size.vehicles}))::text, 22, '0'),
        '${TAG}: ' || (ARRAY['Service','Brakes','Clutch','Diagnostics','MOT preparation','Tyres','Cambelt','Air conditioning'])[1 + (i % 8)],
        (ARRAY['COMPLETED','INVOICED','PAID','CANCELLED'])[1 + (i % 4)]::"JobStatus",
        now() - (i % 1200) * interval '1 day',
        now()
      FROM generate_series(1, ${size.jobs}) AS i
      ON CONFLICT DO NOTHING`),
  );

  /* --- invoices ------------------------------------------------------------ */

  await timed('invoices', () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "invoices" ("id", "orgId", "number", "customerId", "jobId", "status", "subtotal", "taxTotal", "total", "amountPaid", "issuedAt", "createdAt", "updatedAt")
      SELECT
        'si' || lpad(i::text, 22, '0'),
        '${orgId}',
        '${TAG}-' || lpad(i::text, 8, '0'),
        'sc' || lpad((1 + (i % ${size.customers}))::text, 22, '0'),
        'sj' || lpad(i::text, 22, '0'),
        (ARRAY['PAID','ISSUED','OVERDUE'])[1 + (i % 3)]::"InvoiceStatus",
        round((60 + (i % 900))::numeric, 2),
        round(((60 + (i % 900)) * 0.2)::numeric, 2),
        round(((60 + (i % 900)) * 1.2)::numeric, 2),
        CASE WHEN i % 3 = 0 THEN round(((60 + (i % 900)) * 1.2)::numeric, 2) ELSE 0 END,
        now() - (i % 1200) * interval '1 day',
        now() - (i % 1200) * interval '1 day',
        now()
      FROM generate_series(1, ${size.invoices}) AS i
      ON CONFLICT DO NOTHING`),
  );

  /* --- the audit log, which is always the biggest table -------------------- */

  // In batches. One statement writing two million rows holds a transaction open
  // long enough to matter, and a machine that runs out of disk half way through
  // should have finished nineteen batches rather than none.
  const batch = 250_000;

  for (let from = 1; from <= size.audits; from += batch) {
    const to = Math.min(from + batch - 1, size.audits);

    await timed(`audit rows ${human(from)}–${human(to)}`, () =>
      prisma.$executeRawUnsafe(`
        INSERT INTO "audit_logs" ("id", "orgId", "action", "entityType", "entityId", "createdAt")
        SELECT
          'sa' || lpad(i::text, 22, '0'),
          '${orgId}',
          '${TAG}',
          (ARRAY['Job','Invoice','Customer','Vehicle','Payment'])[1 + (i % 5)],
          'sj' || lpad((1 + (i % ${size.jobs}))::text, 22, '0'),
          now() - (i % 1200) * interval '1 day'
        FROM generate_series(${from}, ${to}) AS i
        ON CONFLICT DO NOTHING`),
    );
  }

  /* --- and then tell the planner about it ---------------------------------- */

  // Without this the first measurements are nonsense: Postgres plans from
  // statistics, and the statistics still describe the six-customer workshop
  // that was here a minute ago.
  await timed('analyse', () => prisma.$executeRawUnsafe('ANALYZE'));

  const counts = await prisma.$queryRaw<{ table: string; n: bigint }[]>`
    SELECT 'customers' AS "table", count(*)::bigint AS n FROM "customers"
    UNION ALL SELECT 'vehicles', count(*)::bigint FROM "vehicles"
    UNION ALL SELECT 'jobs', count(*)::bigint FROM "jobs"
    UNION ALL SELECT 'invoices', count(*)::bigint FROM "invoices"
    UNION ALL SELECT 'audit_logs', count(*)::bigint FROM "audit_logs"`;

  console.info('');
  for (const row of counts) {
    console.info(`  ${row.table.padEnd(12)}${human(Number(row.n)).padStart(12)}`);
  }
  console.info('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
