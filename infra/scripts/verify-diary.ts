/**
 * Promises the workshop cannot keep. Phase 91.
 *
 *   npx tsx infra/scripts/verify-diary.ts
 *
 * Phase 89 refused to store whether a machine may be used, and worked it out
 * from its certificate against the clock every time. The payoff is this: asking
 * "will the rig be usable next Tuesday?" is the same function with a different
 * date. A stored flag could only ever have answered *now*.
 *
 * So the central check here is the one a stored flag could not pass — a
 * booking three weeks out, judged against a certificate that lapses before it,
 * reported today. And its opposites, because a diary that cries wolf is a
 * diary nobody reads: a booking before the lapse is fine, two bookings that
 * merely follow each other are fine, and a booking whose work names no machine
 * is never reported at all.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { bookedOn, couldBook, diaryTrouble } from '../../apps/web/src/lib/equipment-diary';

let failures = 0;

const TAG = 'VERIFY-DIARY-PROBE';

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main() {
  console.info('\n  Promises the workshop cannot keep\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  await prisma.booking.deleteMany({ where: { orgId: org.id, notes: TAG } });

  const wrench = await prisma.equipment.findFirstOrThrow({
    where: { orgId: org.id, code: 'TW-200' },
    select: { id: true, name: true, certificateExpiresAt: true },
  });

  // The link the rest of this rests on: without a kind of work that needs the
  // wrench, every check below would pass by finding nothing.
  const needing = await prisma.jobTypeEquipment.findMany({
    where: { equipmentId: wrench.id },
    select: { jobType: { select: { name: true } } },
  });
  check(
    'some kind of work needs the wrench, or nothing below means anything',
    needing.map((one) => one.jobType.name),
    ['Brake repair'],
  );

  const now = new Date();
  const fortnight = new Date(now.getTime() + 14 * 86_400_000);

  /* --- what the diary finds ------------------------------------------------ */

  const trouble = await diaryTrouble(org.id, { from: now, to: fortnight });

  check('bookings in the fortnight name a machine', trouble.bookingsNeedingAMachine >= 2, true);
  check('and the diary finds promises it cannot keep', trouble.clashes.length > 0, true);
  check(
    'the wrench whose certificate lapsed is named',
    trouble.clashes.some((one) => one.kind === 'NOT_USABLE' && one.equipmentId === wrench.id),
    true,
  );
  check(
    'and so is one machine promised to two cars at once',
    trouble.clashes.some((one) => one.kind === 'DOUBLE_BOOKED'),
    true,
  );
  check(
    'a double booking names the other one, so somebody knows what to move',
    trouble.clashes.find((one) => one.kind === 'DOUBLE_BOOKED')?.againstLabel !== undefined,
    true,
  );

  /* --- the check a stored flag could not pass ------------------------------ */

  console.info('\n  Judged then, not now');

  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({
    where: { jobs: { some: { orgId: org.id } } },
    select: { id: true },
  });
  const location = await prisma.location.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });

  // A machine that is perfectly usable today and will not be in three weeks.
  const lapsesSoon = await prisma.equipment.create({
    data: {
      orgId: org.id,
      locationId: location.id,
      name: 'Probe rig',
      code: TAG,
      certificateRef: `${TAG}/1`,
      certifiedAt: new Date(now.getTime() - 300 * 86_400_000),
      certificateExpiresAt: new Date(now.getTime() + 10 * 86_400_000),
    },
    select: { id: true },
  });

  const probeType = await prisma.jobType.create({
    data: { orgId: org.id, name: TAG, colour: '#333333', defaultHours: 1 },
    select: { id: true },
  });

  await prisma.jobTypeEquipment.create({
    data: { jobTypeId: probeType.id, equipmentId: lapsesSoon.id },
  });

  const soon = new Date(now.getTime() + 3 * 86_400_000);
  const later = new Date(now.getTime() + 21 * 86_400_000);

  const early = await couldBook({
    orgId: org.id,
    startAt: soon,
    endAt: new Date(soon.getTime() + 2 * 3_600_000),
    jobTypeIds: [probeType.id],
  });
  check('a booking before the certificate lapses can be promised', early.ok, true);

  const late = await couldBook({
    orgId: org.id,
    startAt: later,
    endAt: new Date(later.getTime() + 2 * 3_600_000),
    jobTypeIds: [probeType.id],
  });
  check('one after it cannot, and it is known today', late.ok, false);
  check('with the reason named', late.clashes[0]?.why, 'OUT_OF_CALIBRATION');
  check('and the machine named', late.clashes[0]?.machineName, 'Probe rig');

  /* --- and the diary does not cry wolf ------------------------------------- */

  console.info('\n  And it does not cry wolf');

  const noMachine = await couldBook({
    orgId: org.id,
    startAt: later,
    endAt: new Date(later.getTime() + 3_600_000),
    jobTypeIds: [],
  });
  check('work that needs no machine is never refused', noMachine.ok, true);
  check('and reports nothing', noMachine.clashes, []);

  // Two bookings that merely follow each other are not a clash.
  const first = new Date(soon.getTime());
  const second = new Date(soon.getTime() + 2 * 3_600_000);

  const made = await prisma.booking.create({
    data: {
      orgId: org.id,
      locationId: location.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      status: 'SCHEDULED',
      startAt: first,
      endAt: second,
      estimatedHours: 2,
      description: TAG,
      notes: TAG,
    },
    select: { id: true },
  });

  const after = await couldBook({
    orgId: org.id,
    startAt: second,
    endAt: new Date(second.getTime() + 3_600_000),
    jobTypeIds: [probeType.id],
  });
  check('a booking that starts as another ends is not a clash', after.ok, true);

  await prisma.booking.delete({ where: { id: made.id } });

  /* --- certificates running out inside the window -------------------------- */

  console.info('\n  What runs out inside the fortnight');

  const ahead = await diaryTrouble(org.id, { from: now, to: fortnight });
  check(
    'the probe rig lapsing in ten days is listed',
    ahead.lapsing.some((one) => one.equipmentId === lapsesSoon.id),
    true,
  );
  check(
    'and it is not reported as a clash, because nothing is booked on it',
    ahead.clashes.some((one) => one.equipmentId === lapsesSoon.id),
    false,
  );

  /* --- what one machine is promised to ------------------------------------- */

  const promised = await bookedOn(org.id, wrench.id);
  check('the wrench’s own page can list the work it is promised to', promised.length >= 2, true);

  /* --- clean up ------------------------------------------------------------ */

  await prisma.booking.deleteMany({ where: { orgId: org.id, notes: TAG } });
  await prisma.jobTypeEquipment.deleteMany({ where: { equipmentId: lapsesSoon.id } });
  await prisma.equipment.delete({ where: { id: lapsesSoon.id } });
  await prisma.jobType.delete({ where: { id: probeType.id } });

  check(
    'the probe leaves nothing behind',
    (await prisma.equipment.count({ where: { orgId: org.id, code: TAG } })) +
      (await prisma.booking.count({ where: { orgId: org.id, notes: TAG } })) +
      (await prisma.jobType.count({ where: { orgId: org.id, name: TAG } })),
    0,
  );

  console.info(
    failures === 0
      ? '\n  A promise that cannot be kept is known weeks early, not on the morning.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
