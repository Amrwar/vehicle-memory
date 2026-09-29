/**
 * The machine the job needs. Phase 89.
 *
 *   npx tsx infra/scripts/verify-equipment.ts
 *
 * Two things can go wrong here and they are opposites.
 *
 * The product can be too permissive: a lift whose statutory inspection lapsed
 * at midnight is physically fine, looks fine, and a screen that says so lets a
 * workshop keep using it. So the central check is that **nobody had to press
 * anything** -- the machine becomes unusable by arithmetic against the clock.
 *
 * Or it can be too strict, and this is the failure the product has already
 * made once. FR-612 gated completion on a quality check for eighty-four
 * phases while nothing could record one: a gate with no key. So this checks
 * that a job whose kinds of work require no machine is never touched by the
 * gate, that a machine merely busy on another job never blocks, and that a car
 * already in pieces on a lift is not stranded when that lift goes out.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { blocks, CERTIFICATE_WARNING_DAYS, EQUIPMENT_STATES, stateOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  EquipmentError,
  machinesFor,
  oneMachine,
  recordCertificate,
  setJobTypeNeeds,
  setOutOfService,
  theMachines,
} from '../../apps/web/src/lib/equipment';

let failures = 0;

const TAG = 'VERIFY-EQUIP-PROBE';

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

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    check(label, error instanceof EquipmentError ? error.code : String(error).slice(0, 70), code);
  }
}

async function main() {
  console.info('\n  The machine the job needs\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  await prisma.equipment.deleteMany({ where: { orgId: org.id, code: TAG } });

  /* --- the states, derived from the clock ---------------------------------- */

  const machines = await theMachines(org.id);
  const by = (code: string) => machines.find((one) => one.code === code);

  check('every machine gets one of the five states', EQUIPMENT_STATES.length, 5);
  check('the lift with a live certificate is available', by('LIFT-1')?.state, 'AVAILABLE');
  check(
    'the wrench whose certificate lapsed is out of calibration',
    by('TW-200')?.state,
    'OUT_OF_CALIBRATION',
  );
  check('the rig somebody took out is out of service', by('ALIGN-1')?.state, 'OUT_OF_SERVICE');

  // The whole argument of the phase, proved on one record.
  const wrench = await prisma.equipment.findFirstOrThrow({
    where: { orgId: org.id, code: 'TW-200' },
    select: { id: true, certificateExpiresAt: true, certificateRef: true, certifiedAt: true },
  });

  const facts = {
    retired: false,
    outOfServiceSince: null,
    certificateExpiresAt: wrench.certificateExpiresAt,
    inUseOnJobs: 0,
  };

  const dayBefore = new Date(wrench.certificateExpiresAt!.getTime() - 86_400_000);
  const dayAfter = new Date(wrench.certificateExpiresAt!.getTime() + 86_400_000);

  check('the same record was usable the day before', stateOf(facts, dayBefore), 'AVAILABLE');
  check(
    'and unusable the day after, with nobody pressing anything',
    stateOf(facts, dayAfter),
    'OUT_OF_CALIBRATION',
  );

  /* --- warning before it stops anything ------------------------------------ */

  console.info('\n  The warning that arrives in time');

  const aircon = by('AC-1');
  check('the station expiring this month warns', aircon?.dueSoon, true);
  check('and is still perfectly usable', aircon?.state, 'AVAILABLE');
  check(
    'with the warning inside the month',
    (aircon?.daysLeft ?? 999) <= CERTIFICATE_WARNING_DAYS,
    true,
  );

  /* --- late for a service warns, and blocks nothing ------------------------ */

  console.info('\n  Late for a service is not the same thing');

  check('the station is overdue its own service', aircon?.serviceOverdue, true);
  check('and that does not change its state', aircon?.state, 'AVAILABLE');
  check('nor does it block', blocks(aircon!.state), false);

  /* --- worst first --------------------------------------------------------- */

  const order = machines.map((one) => one.code);
  check(
    'what has already stopped work is listed above what has not',
    order.indexOf('TW-200') < order.indexOf('AC-1'),
    true,
  );
  check('and the fine lift is below both', order.indexOf('AC-1') < order.indexOf('LIFT-1'), true);

  /* --- the gate ------------------------------------------------------------ */

  console.info('\n  Whether the work can start');

  const needing = await prisma.jobTypeEquipment.findFirstOrThrow({
    where: { equipment: { orgId: org.id, code: 'TW-200' } },
    select: { jobTypeId: true, jobType: { select: { name: true } } },
  });

  const blocked = await prisma.job.findFirst({
    where: { orgId: org.id, jobTypes: { some: { jobTypeId: needing.jobTypeId } } },
    select: { id: true, number: true },
  });

  if (!blocked) {
    failures += 1;
    console.error(`  FAIL   no seeded job of ${needing.jobType.name} to test the gate. Reseed.`);
  } else {
    const verdict = await machinesFor(org.id, blocked.id);
    check('a job needing the lapsed wrench cannot start', verdict.ok, false);
    check(
      'and the refusal names the machine',
      verdict.blocking.map((one) => one.name),
      ['Torque wrench, 40-200 Nm'],
    );
  }

  // And the other half, which is the one this product has got wrong before.
  const noMachine = await prisma.job.findFirst({
    where: { orgId: org.id, jobTypes: { none: { jobTypeId: needing.jobTypeId } } },
    select: { id: true },
  });

  if (!noMachine) {
    failures += 1;
    console.error(
      '  FAIL   no seeded job without that kind of work, so the other half is untested.',
    );
  } else {
    const verdict = await machinesFor(org.id, noMachine.id);
    check('a job whose work needs no machine is never touched by the gate', verdict.ok, true);
    check('and has nothing standing in its way', verdict.blocking, []);
  }

  /* --- busy is not blocked ------------------------------------------------- */

  console.info('\n  Busy is not blocked');

  // A machine that is fine, required by work that is on the bench right now.
  const lift = await prisma.equipment.findFirstOrThrow({
    where: { orgId: org.id, code: 'LIFT-1' },
    select: { id: true },
  });

  const onTheBench = await prisma.job.findFirst({
    where: { orgId: org.id, status: 'IN_PROGRESS' },
    select: { id: true, jobTypes: { select: { jobTypeId: true } } },
  });

  if (!onTheBench?.jobTypes[0]) {
    // Loudly, because a check that quietly skips itself is a check nobody
    // runs -- and on the first run this whole section printed nothing at all
    // and the script still said it had passed.
    failures += 1;
    console.error('  FAIL   no job on the bench with a kind of work to attach a machine to.');
  } else {
    const jobTypeId = onTheBench.jobTypes[0].jobTypeId;
    await setJobTypeNeeds({
      orgId: org.id,
      userId: owner.id,
      jobTypeId,
      equipmentId: lift.id,
      needs: true,
    });

    const busy = await oneMachine(org.id, lift.id);
    check('a machine a job on the bench needs reads as in use', busy.state, 'IN_USE');
    check('which does not block', blocks(busy.state), false);

    // The claim is about the lift, not about the whole job: this job also
    // needs the lapsed wrench, so it is blocked -- correctly -- by something
    // else. An earlier draft asserted the job could run and failed, which was
    // the assertion being wrong rather than the product.
    const verdict = await machinesFor(org.id, onTheBench.id);
    check(
      'the busy lift is not among the machines standing in the way',
      verdict.blocking.some((one) => one.equipmentId === lift.id),
      false,
    );
    check(
      'it is named as busy instead',
      verdict.busy.some((one) => one.equipmentId === lift.id),
      true,
    );

    await setJobTypeNeeds({
      orgId: org.id,
      userId: owner.id,
      jobTypeId,
      equipmentId: lift.id,
      needs: false,
    });

    check(
      'the probe left the requirement as it found it',
      await prisma.jobTypeEquipment.count({ where: { jobTypeId, equipmentId: lift.id } }),
      0,
    );
  }

  /* --- the one press that puts it back ------------------------------------- */

  console.info('\n  Putting it right');

  const now = new Date();
  await recordCertificate({
    orgId: org.id,
    userId: owner.id,
    equipmentId: wrench.id,
    reference: `${TAG}/1`,
    certifiedAt: now,
    expiresAt: new Date(now.getTime() + 365 * 86_400_000),
  });

  // Usable, not idle. With the requirement attached to work on the bench the
  // wrench reads IN_USE, which is a usable state -- asserting AVAILABLE here
  // was asserting the wrong thing.
  check(
    'a fresh certificate makes it usable again',
    blocks((await oneMachine(org.id, wrench.id)).state),
    false,
  );

  if (blocked) {
    check(
      'and the job that could not start now can',
      (await machinesFor(org.id, blocked.id)).ok,
      true,
    );
  }

  // Put the seed back, so the demonstration keeps its grounded wrench.
  await prisma.equipment.update({
    where: { id: wrench.id },
    data: {
      certificateRef: wrench.certificateRef,
      certifiedAt: wrench.certifiedAt,
      certificateExpiresAt: wrench.certificateExpiresAt,
    },
  });
  check(
    'the probe leaves the wrench as it found it',
    (await oneMachine(org.id, wrench.id)).state,
    'OUT_OF_CALIBRATION',
  );

  /* --- the refusals -------------------------------------------------------- */

  console.info('\n  What is refused');

  const rig = await prisma.equipment.findFirstOrThrow({
    where: { orgId: org.id, code: 'ALIGN-1' },
    select: { id: true },
  });

  await refuses('taking a machine out with no reason is refused', 'NEEDS_A_REASON', () =>
    setOutOfService({
      orgId: org.id,
      userId: owner.id,
      equipmentId: rig.id,
      out: true,
      reason: '',
    }),
  );

  await refuses('a certificate expiring before it was issued is refused', 'BAD_DATES', () =>
    recordCertificate({
      orgId: org.id,
      userId: owner.id,
      equipmentId: rig.id,
      reference: `${TAG}/2`,
      certifiedAt: new Date('2026-06-01'),
      expiresAt: new Date('2026-01-01'),
    }),
  );

  // And the database says both too, not only the code.
  let noReason = false;
  try {
    await prisma.$executeRaw`
      UPDATE equipment SET "outOfServiceSince" = NOW(), "outOfServiceReason" = NULL
      WHERE id = ${rig.id}`;
    noReason = true;
  } catch (error) {
    check(
      'the database refuses it too, by the constraint that names it',
      String(error).includes('equipment_out_of_service_says_why'),
      true,
    );
  }
  check('a machine out of service with no reason is refused', noReason, false);

  let backwards = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO equipment ("id", "orgId", "name", "code", "certifiedAt", "certificateExpiresAt", "updatedAt")
      VALUES (${`${TAG}-dates`}, ${org.id}, 'Probe', ${TAG}, '2026-06-01', '2026-01-01', NOW())`;
    backwards = true;
  } catch {
    // equipment_certificate_runs_forwards refuses it.
  }
  check('and a certificate that runs backwards', backwards, false);

  // A machine a kind of work depends on cannot be deleted out from under it.
  let deleted = false;
  try {
    await prisma.equipment.delete({ where: { id: wrench.id } });
    deleted = true;
  } catch {
    // ON DELETE RESTRICT. Retire it instead.
  }
  check('a machine some work depends on cannot be deleted', deleted, false);

  await prisma.equipment.deleteMany({ where: { orgId: org.id, code: TAG } });
  check(
    'the probe leaves no machines of its own behind',
    await prisma.equipment.count({ where: { orgId: org.id, code: TAG } }),
    0,
  );

  console.info(
    failures === 0
      ? '\n  An expired certificate stops the work, and nobody had to notice.'
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
