/**
 * Warranty and claims check.
 *
 *   npx tsx infra/scripts/verify-warranty.ts
 *
 * A warranty is a promise the workshop will be held to a year after everybody
 * has forgotten making it. That makes it the wrong thing to protect in the
 * application layer alone: the rows outlive the code that wrote them.
 *
 * So this proves two separate things. The service layer works out who owes
 * what and refuses claims it should refuse; and underneath it, the database
 * itself rejects the six shapes of row that would make the warranty book lie,
 * no matter which process tries to write them.
 *
 * It cleans up after itself, so it is safe against a shared database.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { raiseClaim, recordCover, settleClaim } from '../../apps/web/src/lib/warranty';

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

/**
 * Asserts the database refuses a row, and names the constraint that did it.
 *
 * Naming matters. A statement can fail for a dozen reasons, and a probe that
 * only asked "did it throw" would pass happily on a typo in the column list
 * while the constraint it was meant to prove had been dropped months earlier.
 */
async function refuses(label: string, constraint: string, sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
    failures += 1;
    console.error(`  FAIL   ${label}: the database accepted it`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(constraint)) {
      console.info(`  ok     ${label}: refused by ${constraint}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: refused, but not by ${constraint}. Got: ${message}`);
    }
  }
}

/** A row id that will not collide with anything the seed wrote. */
function id(suffix: string): string {
  return `vfy-warranty-${suffix}`;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  // A named supplier, because supplier cover with nobody attached to it is
  // not cover: there is no one to claim the part back from.
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, vehicleId: true },
  });

  // Anything this script wrote on a previous run, gone before we start.
  await prisma.warranty.deleteMany({ where: { description: { startsWith: 'Verify probe' } } });

  console.info('\nThe service layer');

  const live = await recordCover({
    orgId: org.id,
    userId: user.id,
    jobId: job.id,
    vehicleId: job.vehicleId,
    kind: 'PART',
    description: 'Verify probe: water pump',
    months: 24,
    partsValue: 210,
    labourValue: 140,
    supplierId: supplier.id,
    supplierMonths: 12,
    startedOn: new Date(Date.now() - 30 * 86_400_000),
  });

  // Thirty days into a two-year warranty whose supplier cover still has
  // eleven months on it. The part is recoverable; the labour never is,
  // because no supplier pays a workshop to fit a replacement.
  const claim = await raiseClaim({
    orgId: org.id,
    userId: user.id,
    warrantyId: live,
    complaint: 'Verify probe: leaking again',
  });

  check('cover is live', claim.status.active, true);
  check('claim is not goodwill', claim.position.recoverable > 0, true);
  check('the labour falls on the workshop', claim.position.exposure >= 140, true);

  let secondClaim = 'accepted';
  try {
    await raiseClaim({
      orgId: org.id,
      userId: user.id,
      warrantyId: live,
      complaint: 'Verify probe: a second opinion',
    });
  } catch (error) {
    secondClaim = error instanceof Error ? error.message.slice(0, 24) : 'refused';
  }
  check('a second open claim is refused', secondClaim !== 'accepted', true);

  let blankOutcome = 'accepted';
  try {
    await settleClaim({
      orgId: org.id,
      userId: user.id,
      claimId: claim.id,
      status: 'SETTLED',
      outcome: '   ',
    });
  } catch (error) {
    blankOutcome = error instanceof Error ? error.message.slice(0, 24) : 'refused';
  }
  check('settling with no outcome is refused', blankOutcome !== 'accepted', true);

  await settleClaim({
    orgId: org.id,
    userId: user.id,
    claimId: claim.id,
    status: 'SETTLED',
    outcome: 'Verify probe: supplier credited the part.',
    supplierRef: 'CR-0001',
  });

  const settled = await prisma.warrantyClaim.findUniqueOrThrow({
    where: { id: claim.id },
    select: { status: true, settledAt: true },
  });
  check('the claim closed', settled.status, 'SETTLED');
  check('with a time on it', settled.settledAt !== null, true);

  // Cover that ran out last year. A claim on it is goodwill, and goodwill
  // without a stated reason is how a month's profit disappears quietly.
  const expired = await recordCover({
    orgId: org.id,
    userId: user.id,
    jobId: job.id,
    vehicleId: job.vehicleId,
    kind: 'LABOUR',
    description: 'Verify probe: clutch labour',
    months: 6,
    labourValue: 400,
    startedOn: new Date(Date.now() - 900 * 86_400_000),
  });

  let unexplained = 'accepted';
  try {
    await raiseClaim({
      orgId: org.id,
      userId: user.id,
      warrantyId: expired,
      complaint: 'Verify probe: slipping again',
    });
  } catch (error) {
    unexplained = error instanceof Error ? error.message.slice(0, 24) : 'refused';
  }
  check('goodwill with no reason is refused', unexplained !== 'accepted', true);

  const goodwill = await raiseClaim({
    orgId: org.id,
    userId: user.id,
    warrantyId: expired,
    complaint: 'Verify probe: slipping again',
    goodwillReason: 'Long-standing customer, eight weeks outside.',
  });

  check('goodwill is recoverable from nobody', goodwill.position.recoverable, 0);
  check('and all of it falls on the workshop', goodwill.position.exposure >= 400, true);

  console.info('\nThe database, underneath it');

  const columns =
    '("id","orgId","jobId","vehicleId","kind","description","startedOn","months","km","startedAtKm","updatedAt")';
  const values = (months: number, km: string, startedAtKm: string) =>
    `('${id('probe')}','${org.id}','${job.id}','${job.vehicleId}','PART','Verify probe: raw',NOW(),${months},${km},${startedAtKm},NOW())`;

  await refuses(
    'a zero-month term',
    'warranties_positive_term',
    `INSERT INTO "warranties" ${columns} VALUES ${values(0, 'NULL', 'NULL')}`,
  );

  await refuses(
    'a mileage allowance with no starting reading',
    'warranties_distance_needs_a_start',
    `INSERT INTO "warranties" ${columns} VALUES ${values(12, '20000', 'NULL')}`,
  );

  await refuses(
    'an unexplained void',
    'warranties_void_is_explained',
    `UPDATE "warranties" SET "voidedAt" = NOW() WHERE "id" = '${live}'`,
  );

  await refuses(
    'an unexplained goodwill claim',
    'warranty_claims_goodwill_is_explained',
    `INSERT INTO "warranty_claims" ("id","warrantyId","complaint","outsideCover","status")
     VALUES ('${id('goodwill')}','${live}','Verify probe: raw',true,'OPEN')`,
  );

  await refuses(
    'a settled claim with no outcome',
    'warranty_claims_settled_is_recorded',
    `INSERT INTO "warranty_claims" ("id","warrantyId","complaint","status","settledAt")
     VALUES ('${id('settled')}','${live}','Verify probe: raw','SETTLED',NOW())`,
  );

  // The expired cover still carries the goodwill claim raised above, open.
  await refuses(
    'a second open claim on one warranty',
    'warranty_claims_one_open_per_warranty',
    `INSERT INTO "warranty_claims" ("id","warrantyId","complaint","status")
     VALUES ('${id('second')}','${expired}','Verify probe: raw','OPEN')`,
  );

  await prisma.warranty.deleteMany({ where: { description: { startsWith: 'Verify probe' } } });

  const left = await prisma.warranty.count({
    where: { description: { startsWith: 'Verify probe' } },
  });
  check('the probe left nothing behind', left, 0);

  console.info(failures === 0 ? '\nWarranty behaved correctly.' : `\n${failures} check(s) FAILED.`);

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
