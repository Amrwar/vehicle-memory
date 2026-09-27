/**
 * The corpus, not the guess. Phase 81.
 *
 *   npx tsx infra/scripts/verify-knowledge.ts
 *
 * ADR-0013 point 4 refused to build fault suggestion, and was right to: "a
 * service adviser that proposes where to look needs a corpus of symptoms
 * against confirmed causes. That corpus does not exist yet, and a confident
 * wrong suggestion on a braking fault is not a small error."
 *
 * Phase 81 builds the corpus instead of the guess. Everything the product says
 * about a symptom is a count of verdicts technicians recorded about cars they
 * had in front of them, in the workshop reading it. This file checks the four
 * properties that keep that true, because every one of them is a way the
 * feature could quietly become the thing ADR-0013 refused:
 *
 *   1. **Nothing is shown on thin evidence.** Under three confirmations a
 *      cause is an anecdote, and an anecdote beside a brake fault reads as
 *      advice.
 *   2. **A cause never confirmed is never listed.** Listing it under "what
 *      this has turned out to be" says the opposite of what the record holds.
 *   3. **Confirmations never appear without their refusals.** Confirmed three
 *      times out of twelve and confirmed three times out of three are
 *      different facts, and a screen showing one number makes them identical.
 *   4. **A workshop is never its own evidence.** The verdict entered on this
 *      job must not come back as the reason to believe it.
 *
 * And one more, which is about tenancy rather than honesty: a workshop's
 * corpus is its own. What the garage down the road found is not evidence here.
 *
 * Runs against the seeded hillside-motors and clears up after itself.
 */

import 'dotenv/config';

import { ENOUGH_TO_SHOW, rankCauses } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  DiagnosisError,
  evidenceFor,
  openDiagnosis,
  recordVerdict,
  whatItHasBeen,
} from '../../apps/web/src/lib/diagnosis';

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

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    check(label, error instanceof DiagnosisError ? error.code : String(error), code);
  }
}

const TAG = 'Verify knowledge probe';

async function main() {
  console.info('\n  What this workshop has found before\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const tech = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  await forget(org.id);

  const judder = await prisma.symptomCode.findFirstOrThrow({
    where: { orgId: org.id, code: 'BRAKE_JUDDER' },
    select: { id: true, label: true },
  });
  const aircon = await prisma.symptomCode.findFirstOrThrow({
    where: { orgId: org.id, code: 'AIRCON_WEAK' },
    select: { id: true },
  });

  /* --- what the seeded year says ------------------------------------------ */

  const evidence = await evidenceFor(org.id, judder.id);
  const byCode = new Map(evidence.map((one) => [one.causeCode, one]));

  check(
    'the rotor has been confirmed more often than ruled out',
    (byCode.get('ROTOR_RUNOUT')?.confirmed ?? 0) > (byCode.get('ROTOR_RUNOUT')?.rejected ?? 0),
    true,
  );

  const ranked = rankCauses(evidence);
  check('the rotor is at the top of the list', ranked[0]?.causeCode, 'ROTOR_RUNOUT');

  /* --- one. nothing on thin evidence -------------------------------------- */

  console.info('\n  Thin evidence says nothing');

  const thin = await whatItHasBeen(org.id, aircon.id);
  check('air conditioning has been seen', (await evidenceFor(org.id, aircon.id)).length > 0, true);
  check('but nothing about it is shown', thin.ranked.length, 0);
  check(
    'because nothing has reached the line',
    (await evidenceFor(org.id, aircon.id)).every((one) => one.confirmed < ENOUGH_TO_SHOW),
    true,
  );

  /* --- two. never confirmed, never listed --------------------------------- */

  console.info('\n  A cause only ever ruled out');

  const bearing = byCode.get('WHEEL_BEARING');
  check('the wheel bearing has been ruled out', (bearing?.rejected ?? 0) > 0, true);
  check('and never confirmed', bearing?.confirmed, 0);
  check(
    'so it is not on the list at all',
    ranked.some((one) => one.causeCode === 'WHEEL_BEARING'),
    false,
  );

  /* --- three. confirmations carry their refusals -------------------------- */

  console.info('\n  Every count carries the other one');

  check(
    'every cause shown says how often it was ruled out',
    ranked.every((one) => typeof one.rejected === 'number' && one.decided >= one.confirmed),
    true,
  );

  /* --- four. a job is never its own evidence ------------------------------ */

  console.info('\n  This job is not evidence for itself');

  const vehicle = await prisma.vehicle.findFirstOrThrow({ select: { id: true } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });
  const location = await prisma.location.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });
  const job = await prisma.job.create({
    data: {
      org: { connect: { id: org.id } },
      number: 999_001,
      customer: { connect: { id: customer.id } },
      vehicle: { connect: { id: vehicle.id } },
      location: { connect: { id: location.id } },
      shortDescription: TAG,
      status: 'IN_PROGRESS',
    },
    select: { id: true },
  });

  const before = (await evidenceFor(org.id, judder.id)).find(
    (one) => one.causeCode === 'ROTOR_RUNOUT',
  )!.confirmed;

  const { diagnosisId } = await openDiagnosis({
    orgId: org.id,
    userId: tech.id,
    jobId: job.id,
    symptomId: judder.id,
  });

  const causes = await prisma.diagnosisCause.findMany({
    where: { diagnosisId },
    select: { causeId: true, cause: { select: { code: true } } },
  });

  check('opening one lists every cause to rule on', causes.length, 4);
  check(
    'and none of them is decided',
    await prisma.diagnosisCause.count({ where: { diagnosisId, outcome: { not: null } } }),
    0,
  );

  await refuses('a second diagnosis of the same complaint is refused', 'ALREADY_OPEN', () =>
    openDiagnosis({ orgId: org.id, userId: tech.id, jobId: job.id, symptomId: judder.id }),
  );

  await refuses(
    'and a cause from another complaint cannot be ruled on',
    'NOT_A_CAUSE',
    async () => {
      const elsewhere = await prisma.causeCode.findFirstOrThrow({
        where: { orgId: org.id, symptom: { code: 'MISFIRE' } },
        select: { id: true },
      });
      return recordVerdict({
        orgId: org.id,
        userId: tech.id,
        diagnosisId,
        causeId: elsewhere.id,
        outcome: 'CONFIRMED',
      });
    },
  );

  // Rule on one, and nothing changes: the diagnosis has not settled.
  const rotor = causes.find((one) => one.cause.code === 'ROTOR_RUNOUT')!;
  const partway = await recordVerdict({
    orgId: org.id,
    userId: tech.id,
    diagnosisId,
    causeId: rotor.causeId,
    outcome: 'CONFIRMED',
  });

  check('one verdict does not settle a diagnosis', partway.settled, false);
  check(
    'and an unsettled diagnosis teaches the corpus nothing',
    (await evidenceFor(org.id, judder.id)).find((one) => one.causeCode === 'ROTOR_RUNOUT')!
      .confirmed,
    before,
  );

  // Rule on the rest, and it settles.
  for (const one of causes.filter((each) => each.causeId !== rotor.causeId)) {
    await recordVerdict({
      orgId: org.id,
      userId: tech.id,
      diagnosisId,
      causeId: one.causeId,
      outcome: 'REJECTED',
    });
  }

  const settled = await prisma.jobDiagnosis.findUniqueOrThrow({
    where: { id: diagnosisId },
    select: { settledAt: true },
  });
  check('ruling on the last one settles it', settled.settledAt !== null, true);

  check(
    'now it counts',
    (await evidenceFor(org.id, judder.id)).find((one) => one.causeCode === 'ROTOR_RUNOUT')!
      .confirmed,
    before + 1,
  );

  check(
    'but not for the job that recorded it',
    (await evidenceFor(org.id, judder.id, { exceptJobId: job.id })).find(
      (one) => one.causeCode === 'ROTOR_RUNOUT',
    )!.confirmed,
    before,
  );

  /* --- and a verdict is witnessed ----------------------------------------- */

  console.info('\n  A finding somebody made');

  let unwitnessed = false;
  try {
    await prisma.$executeRaw`
      UPDATE diagnosis_causes SET "decidedByUserId" = NULL, "decidedAt" = NULL
      WHERE "diagnosisId" = ${diagnosisId}`;
    unwitnessed = true;
  } catch {
    // The check constraint refuses: an outcome without a time is a finding
    // nobody made.
  }
  check('a verdict cannot lose its timestamp', unwitnessed, false);

  /* --- and the corpus stops at the workshop boundary ---------------------- */

  console.info('\n  Another workshop is not evidence here');

  const elsewhere = await prisma.organization.findFirst({
    where: { id: { not: org.id }, isActive: true },
    select: { id: true },
  });

  if (elsewhere) {
    check(
      'a symptom code belongs to one workshop',
      await prisma.symptomCode.count({ where: { orgId: elsewhere.id, code: 'BRAKE_JUDDER' } }),
      0,
    );
    check(
      'and asking there finds nothing of ours',
      (await evidenceFor(elsewhere.id, judder.id)).length,
      0,
    );
  }

  await forget(org.id);

  console.info(
    failures === 0
      ? '\n  Every number it shows is a job somebody finished.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });

  for (const job of jobs) {
    await prisma.diagnosisCause.deleteMany({ where: { diagnosis: { jobId: job.id } } });
    await prisma.jobDiagnosis.deleteMany({ where: { jobId: job.id } });
    await prisma.job.delete({ where: { id: job.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
