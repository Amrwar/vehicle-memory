/**
 * Why it came back. Phase 86.
 *
 *   npx tsx infra/scripts/verify-comeback.ts
 *
 * The product has counted comebacks since Phase 26 and linked each to the job
 * it came back from. That answers "how often", which is the number an owner
 * quotes and the least useful thing about it: twelve comebacks tells nobody
 * what to do, and four of them being the same part tells them everything.
 *
 * Phase 86 adds the cause and the case file. What this checks is the handful
 * of properties that decide whether either is worth reading:
 *
 *   - the case file is assembled from records that already exist, so it cannot
 *     disagree with the job it describes;
 *   - a cause cannot be recorded on a job that is not a comeback, and the
 *     database says so as well as the code;
 *   - the four causes that are the workshop's own are counted apart from the
 *     three that are not, because a rate that blames a workshop for a customer
 *     driving through a flood is a rate nobody believes;
 *   - a pattern is several *cars* back after the same repair, not one car back
 *     several times -- which is one unhappy customer, not a procedure fault.
 *
 * Runs against the seeded hillside-motors and puts back what it links.
 */

import 'dotenv/config';

import { isOurs, patternsIn } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  caseFileFor,
  CaseFileError,
  comebacksByCause,
  recordCause,
} from '../../apps/web/src/lib/casefile';
import { markComeback } from '../../apps/web/src/lib/owner';

let failures = 0;

const TAG = 'Verify comeback probe';

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
    check(label, error instanceof CaseFileError ? error.code : String(error).slice(0, 60), code);
  }
}

async function main() {
  console.info('\n  Why it came back\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  // Anything a run that threw before its clean-up left behind.
  await prisma.job.deleteMany({ where: { orgId: org.id, shortDescription: TAG } });

  /* --- a cause needs a comeback ------------------------------------------- */

  const plain = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, comebackOfJobId: null },
    select: { id: true },
  });

  await refuses('a job that is not a comeback cannot have a cause', 'NOT_A_COMEBACK', () =>
    recordCause({ orgId: org.id, userId: owner.id, jobId: plain.id, cause: 'INSTALLATION' }),
  );

  // And the database says it too, not only the code.
  let forced = false;
  try {
    await prisma.$executeRaw`
      UPDATE jobs SET "comebackCause" = 'INSTALLATION'
      WHERE id = ${plain.id} AND "comebackOfJobId" IS NULL`;
    forced = true;
  } catch {
    // The check constraint refuses it.
  }
  check('and the database refuses it by hand as well', forced, false);

  /* --- the case file ------------------------------------------------------ */

  console.info('\n  The case file');

  const finished = await prisma.job.findFirst({
    where: {
      orgId: org.id,
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      completedAt: { not: null },
    },
    // The most recently finished, because markComeback rightly refuses a link
    // to work finished more than ninety days before -- that is a new repair,
    // not a comeback, and the oldest seeded job is well past it.
    orderBy: { completedAt: 'desc' },
    select: { id: true, number: true, vehicleId: true, shortDescription: true },
  });

  if (!finished) {
    failures += 1;
    console.error('  FAIL   no finished job in the seed to come back from. Reseed.');
  } else {
    // The returning visit, made here.
    //
    // A comeback is a new job on the same car, and whether the seed happens to
    // contain one is not a fact about this product. An earlier draft looked
    // for a pair and told somebody to reseed a database that was perfectly
    // fine, which Phase 77 settled: build what is missing rather than blame
    // the data.
    const customer = await prisma.customer.findFirstOrThrow({
      where: { orgId: org.id },
      select: { id: true },
    });
    const where = await prisma.location.findFirstOrThrow({
      where: { orgId: org.id },
      select: { id: true },
    });

    const later = await prisma.job.create({
      data: {
        org: { connect: { id: org.id } },
        number: 999_101,
        customer: { connect: { id: customer.id } },
        vehicle: { connect: { id: finished.vehicleId } },
        location: { connect: { id: where.id } },
        shortDescription: TAG,
        status: 'RECEIVED',
      },
      select: { id: true, comebackOfJobId: true, comebackReason: true, comebackCause: true },
    });

    {
      const wasLink = later.comebackOfJobId;

      await markComeback({
        orgId: org.id,
        userId: owner.id,
        jobId: later.id,
        originalJobId: finished.id,
        reason: 'Verify comeback probe: the same noise came back',
      });

      const before = await caseFileFor(org.id, later.id);

      check('the file names the job it came back from', before?.original.number, finished.number);
      check(
        'and what they came in with then',
        before?.original.complaint,
        finished.shortDescription,
      );
      check('with no cause yet', before?.cause, null);
      check('and says so', before?.missing.includes('what caused it'), true);

      // Nothing on it is new data: every line came off the original job.
      const original = await prisma.job.findUniqueOrThrow({
        where: { id: finished.id },
        select: {
          diagnosis: true,
          _count: { select: { partLines: true, technicians: true } },
        },
      });
      check(
        'the parts on the file are the parts on that job',
        before?.original.parts.length,
        original._count.partLines,
      );
      check(
        'and the people are the people on that job',
        before?.original.technicians.length,
        original._count.technicians,
      );
      check('and the note is that job’s note', before?.original.diagnosisNote, original.diagnosis);

      await recordCause({
        orgId: org.id,
        userId: owner.id,
        jobId: later.id,
        cause: 'INSTALLATION',
      });

      const after = await caseFileFor(org.id, later.id);
      check('once the cause is recorded it is on the file', after?.cause, 'INSTALLATION');
      check('and nothing is left to fill in', after?.missing, []);
      check('and it is one of ours', isOurs('INSTALLATION'), true);

      /* --- the tally ------------------------------------------------------ */

      console.info('\n  The tally');

      const picture = await comebacksByCause(org.id, { days: 3650 });
      check('the comeback is counted', picture.total >= 1, true);
      check(
        'under the cause it was given',
        picture.tally.some((row) => row.cause === 'INSTALLATION' && row.count >= 1),
        true,
      );
      check('and counted as ours', picture.ours.ours >= 1, true);

      /* --- take it away again --------------------------------------------- */

      check('the job the probe made was not a comeback before it', wasLink, null);

      await prisma.job.delete({ where: { id: later.id } });

      check(
        'and the probe leaves nothing behind',
        await prisma.job.count({ where: { orgId: org.id, shortDescription: TAG } }),
        0,
      );
    }
  }

  /* --- a pattern is cars, not visits -------------------------------------- */

  console.info('\n  A pattern, not a count');

  const oneCarFourTimes = Array.from({ length: 4 }, (_, index) => ({
    jobId: `j${index}`,
    cause: 'INSTALLATION' as const,
    originalWork: 'Front brakes',
    vehicleId: 'the-same-car',
    at: new Date(),
  }));

  check('one car back four times is not a pattern', patternsIn(oneCarFourTimes).length, 0);

  const threeCarsOnce = ['a', 'b', 'c'].map((car, index) => ({
    jobId: `k${index}`,
    cause: 'DEFECTIVE_PART' as const,
    originalWork: 'Front brakes',
    vehicleId: car,
    at: new Date(),
  }));

  check(
    'three different cars after the same repair is',
    patternsIn(threeCarsOnce).map((one) => one.vehicles),
    [3],
  );

  console.info(
    failures === 0
      ? '\n  A comeback says why, and a pattern says what to do about it.'
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
