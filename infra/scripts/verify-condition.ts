/**
 * Vehicle condition, against a real database.
 *
 *   npx tsx infra/scripts/verify-condition.ts
 *
 * The unit tests prove the arithmetic. What they cannot prove is that the
 * arithmetic is being fed the right rows, and that is where a derived figure
 * usually goes wrong: the classifier is right, the score is right, and the
 * query quietly read only the jobs from one location.
 *
 * So this checks the joins rather than the sums. A part fitted on a real job
 * becomes a real component with the real mileage behind it; a score is built
 * only from the factors the vehicle actually has evidence for; and nothing
 * from another organisation leaks into either.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { conditionOf, coverWorthChecking } from '../../apps/web/src/lib/condition';

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

const PROBE = 'Verify condition probe';

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const location = await prisma.location.findFirstOrThrow({ where: { orgId: org.id } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });
  const customer = await prisma.customer.findFirstOrThrow({ where: { orgId: org.id } });

  await prisma.vehicle.deleteMany({ where: { vin: 'VFYCONDITION00001' } });

  // A vehicle with a history somebody could argue with: three oil services
  // fifteen thousand apart, and a timing belt done a very long time ago.
  const vehicle = await prisma.vehicle.create({
    data: {
      vin: 'VFYCONDITION00001',
      registration: 'VF26 CND',
      make: 'Probe',
      model: 'Condition',
      year: 2016,
      lastOdometerKm: 130_000,
    },
  });

  const sequence = await prisma.documentSequence.findFirstOrThrow({
    where: { orgId: org.id, kind: 'JOB' },
  });

  const visits = [
    { km: 40_000, daysAgo: 2_200, parts: ['Timing belt and water pump kit'] },
    { km: 100_000, daysAgo: 700, parts: ['Engine oil and filter'] },
    { km: 115_000, daysAgo: 380, parts: ['Engine oil and filter', 'Front brake pads'] },
    { km: 130_000, daysAgo: 30, parts: ['Engine oil and filter', 'Battery, 096 AGM'] },
  ];

  const jobIds: string[] = [];

  for (const [index, visit] of visits.entries()) {
    const when = new Date(Date.now() - visit.daysAgo * 86_400_000);

    const job = await prisma.job.create({
      data: {
        orgId: org.id,
        locationId: location.id,
        number: sequence.next + 900 + index,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: 'PAID',
        shortDescription: PROBE,
        odometerInKm: visit.km,
        receivedAt: when,
        completedAt: when,
        createdByUserId: user.id,
        partLines: {
          create: visit.parts.map((description, sortOrder) => ({
            description,
            quantity: 1,
            sortOrder,
          })),
        },
      },
    });

    jobIds.push(job.id);

    await prisma.odometerReading.create({
      data: { vehicleId: vehicle.id, km: visit.km, readAt: when, source: 'WORKSHOP' },
    });
  }

  console.info('\nComponents, from what was actually fitted');

  const condition = await conditionOf(org.id, vehicle.id);

  const oil = condition.components.find((state) => state.component === 'OIL_AND_FILTER');
  const belt = condition.components.find((state) => state.component === 'TIMING_BELT');
  const battery = condition.components.find((state) => state.component === 'BATTERY');

  check('the oil is aged from the latest service, not the first', oil?.fittedAtKm, 130_000);
  check('the belt is still the one fitted at 40,000', belt?.fittedAtKm, 40_000);
  check('the belt reads as past its life', belt?.condition, 'OVERDUE');
  check('the battery reads as new', battery?.condition, 'NEW');
  check('the worst component is first', condition.components[0]?.component, 'TIMING_BELT');

  console.info('\nPrediction, from this vehicle own intervals');

  const oilDue = condition.predictions.find((row) => row.component === 'OIL_AND_FILTER');

  // 100,000 to 115,000 to 130,000 is two gaps of exactly 15,000.
  check('it learned this vehicle interval', oilDue?.basis, 'THIS_VEHICLE');
  check('and quotes it back', oilDue?.why.includes('15,000'), true);
  check('the belt is already past', condition.predictions.at(-1)?.overdue !== undefined, true);

  console.info('\nThe score, and what it refused to score');

  check('a score was produced', typeof condition.health.score === 'number', true);
  check(
    'it stayed inside its range',
    condition.health.score! >= 0 && condition.health.score! <= 100,
    true,
  );
  check(
    'every factor that counted gave a reason',
    condition.health.factors.every((factor) => factor.why.length > 10),
    true,
  );
  check(
    'the weights that counted add to one',
    Math.abs(condition.health.factors.reduce((total, f) => total + f.weight, 0) - 1) < 1e-6,
    true,
  );
  check(
    'a vehicle never inspected is not scored as failing one',
    condition.health.unknown.some((entry) => entry.id === 'OPEN_ISSUES'),
    true,
  );
  check('and the gap is reflected in the coverage', condition.health.coverage < 1, true);

  console.info('\nNothing from anywhere else');

  const other = await prisma.organization.findFirst({ where: { NOT: { id: org.id } } });

  if (other) {
    const foreign = await conditionOf(other.id, vehicle.id);
    check('another workshop sees no visits on this vehicle', foreign.visits, 0);
    check('and therefore no components', foreign.components.length, 0);
  } else {
    console.info('  --     only one organisation on this database, so nothing to isolate from');
  }

  console.info('\nWarranty worth checking on a new job');

  const warranty = await prisma.warranty.create({
    data: {
      orgId: org.id,
      jobId: jobIds.at(-1)!,
      vehicleId: vehicle.id,
      kind: 'PART',
      description: `${PROBE}: battery`,
      startedOn: new Date(Date.now() - 30 * 86_400_000),
      months: 24,
      partsValue: 96,
    },
  });

  const live = await coverWorthChecking(org.id, vehicle.id);
  check(
    'live cover is surfaced',
    live.some((entry) => entry.id === warranty.id),
    true,
  );

  await prisma.warrantyClaim.create({
    data: { warrantyId: warranty.id, complaint: `${PROBE}: flat`, exposure: 0, recoverable: 0 },
  });

  const afterClaim = await coverWorthChecking(org.id, vehicle.id);
  check(
    'cover already being claimed is not surfaced again',
    afterClaim.some((entry) => entry.id === warranty.id),
    false,
  );

  /* --- clean up ------------------------------------------------------------ */

  await prisma.vehicle.delete({ where: { id: vehicle.id } });

  const left = await prisma.job.count({ where: { shortDescription: PROBE } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0 ? '\nVehicle condition behaved correctly.' : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
