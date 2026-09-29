/**
 * The gate gets a key. Phase 85.
 *
 *   npx tsx infra/scripts/verify-signoff.ts
 *
 * `assertTransition` has refused to complete a job since Phase 1 when its job
 * type asks for a quality check and no passed check exists — FR-612, and a
 * good rule. Nothing in the product has ever written one. The default job
 * types a new workshop is given all ask for a check, so a workshop that signed
 * up and booked in a service was told, correctly, that it needed a passed
 * check, and given no way to record one.
 *
 * Eighty-four phases, behind a rule that reads as careful.
 *
 * So this file checks the thing that was missing, end to end, against a real
 * database:
 *
 *   - a job whose type asks for a check cannot be completed without one, which
 *     is the old rule and still holds;
 *   - a sheet with a required line unanswered does not pass, and the job goes
 *     back to the bench rather than sitting in the checking state;
 *   - a sheet answered in full passes, and the job completes;
 *   - and the outcome is never taken from the caller. It is computed from the
 *     answers, so a request that says PASS with nothing filled in does not
 *     pass.
 *
 * Runs against the seeded hillside-motors and puts the job back as it found it.
 */

import 'dotenv/config';

import { outcomeOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import { moveJob } from '../../apps/web/src/lib/money';
import { checksFor, recordQualityCheck, sheetFor } from '../../apps/web/src/lib/quality';

let failures = 0;

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
  console.info('\n  The last look before the car goes back\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  const sheet = await sheetFor(org.id);
  check('the workshop has a sign-off sheet', sheet.length > 0, true);
  check(
    'and it asks for figures as well as ticks',
    sheet.some((item) => item.kind === 'VALUE'),
    true,
  );

  const required = sheet.filter((item) => item.required);
  check('with lines that must be answered', required.length > 0, true);

  /* --- the job, and the type that asks for a check ------------------------ */

  const demanding = await prisma.jobType.findFirstOrThrow({
    where: { orgId: org.id, requiresQualityCheck: true },
    select: { id: true, name: true },
  });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: 'IN_PROGRESS' },
    select: { id: true, number: true, status: true },
  });

  // Anything an earlier run left behind. The first draft of this file threw
  // before its clean-up and the next run counted four checks where it wanted
  // three -- a check measuring the run before it, which Phase 70 settled is
  // worse than no check.
  await prisma.qualityCheckAnswer.deleteMany({ where: { check: { jobId: job.id } } });
  await prisma.qualityCheck.deleteMany({ where: { jobId: job.id } });

  const hadTypes = await prisma.jobJobType.findMany({
    where: { jobId: job.id },
    select: { jobTypeId: true },
  });

  await prisma.jobJobType.deleteMany({ where: { jobId: job.id } });
  await prisma.jobJobType.create({ data: { jobId: job.id, jobTypeId: demanding.id } });

  /* --- one. the old rule still holds -------------------------------------- */

  console.info('\n  Without a check');

  let completed = false;
  try {
    await moveJob({ orgId: org.id, userId: owner.id, jobId: job.id, to: 'COMPLETED' });
    completed = true;
  } catch {
    // Refused, which is FR-612 doing its job.
  }
  check('a job that needs a check cannot be completed without one', completed, false);

  /* --- two. a sheet with a gap does not pass ------------------------------ */

  console.info('\n  A sheet with a line left blank');

  // Everything but the last required line.
  const nearly = required
    .slice(0, -1)
    .map((item) =>
      item.kind === 'CONFIRM'
        ? { itemId: item.id, confirmed: true }
        : { itemId: item.id, value: 'checked' },
    );

  const short = await recordQualityCheck({
    orgId: org.id,
    userId: owner.id,
    jobId: job.id,
    answers: nearly,
    notes: 'Verify signoff probe',
  });

  check('does not pass', short.outcome, 'FAIL');
  check('and names the line', short.gaps.length >= 1, true);
  check('and says it was not answered', short.gaps[0]?.why, 'unanswered');

  const afterFail = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true },
  });
  check('the job goes back to the bench, not into limbo', afterFail.status, 'IN_PROGRESS');

  /* --- three. a required line answered no is a different gap -------------- */

  console.info('\n  A line answered no');

  const firstTick = required.find((item) => item.kind === 'CONFIRM')!;
  const refusedOne = required.map((item) =>
    item.id === firstTick.id
      ? { itemId: item.id, confirmed: false }
      : item.kind === 'CONFIRM'
        ? { itemId: item.id, confirmed: true }
        : { itemId: item.id, value: 'checked' },
  );

  const refused = await recordQualityCheck({
    orgId: org.id,
    userId: owner.id,
    jobId: job.id,
    answers: refusedOne,
  });

  check('does not pass either', refused.outcome, 'FAIL');
  check('but for the other reason', refused.gaps[0]?.why, 'refused');

  /* --- four. answered in full, it passes and the job completes ------------ */

  console.info('\n  A sheet answered in full');

  const full = required.map((item) =>
    item.kind === 'CONFIRM'
      ? { itemId: item.id, confirmed: true }
      : { itemId: item.id, value: 'checked' },
  );

  const passed = await recordQualityCheck({
    orgId: org.id,
    userId: owner.id,
    jobId: job.id,
    answers: full,
    notes: 'Verify signoff probe',
  });

  check('passes', passed.outcome, 'PASS');
  check('with nothing outstanding', passed.gaps.length, 0);

  const afterPass = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true },
  });
  check('and the job is finished', afterPass.status, 'COMPLETED');

  const recorded = await checksFor(org.id, job.id);
  check('three checks are on the record', recorded.length, 3);
  check('the newest passed', recorded[0]?.passed, true);
  check(
    'and every answer is a tick or a figure, never neither',
    recorded[0]?.answers.every((answer) => (answer.confirmed === null) !== (answer.value === null)),
    true,
  );

  /* --- five. the outcome is never the caller's to state -------------------- */

  console.info('\n  The outcome is computed, not claimed');

  check('an empty sheet cannot be made to pass', outcomeOf(sheet, []), 'FAIL');

  /* --- put it back -------------------------------------------------------- */

  await prisma.qualityCheckAnswer.deleteMany({
    where: { check: { jobId: job.id } },
  });
  await prisma.qualityCheck.deleteMany({ where: { jobId: job.id } });
  await prisma.jobStatusEvent.deleteMany({
    where: { jobId: job.id, note: { contains: 'Verify signoff probe' } },
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { status: job.status, completedAt: null },
  });
  await prisma.jobJobType.deleteMany({ where: { jobId: job.id } });
  for (const was of hadTypes) {
    await prisma.jobJobType.create({ data: { jobId: job.id, jobTypeId: was.jobTypeId } });
  }

  const back = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true },
  });
  check('the probe left the job as it found it', back.status, job.status);

  console.info(
    failures === 0
      ? '\n  A car does not go back until somebody has said each line is true.'
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
