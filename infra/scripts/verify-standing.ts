/**
 * Where everything stands. Phase 84.
 *
 *   npx tsx infra/scripts/verify-standing.ts
 *
 * A job's position -- whose move it is, how long it has been theirs, and the
 * one thing to do -- is derived from the job's own records every time it is
 * asked for. Nothing is stored. That is the decision this file protects,
 * because the alternative is a column saying "waiting for parts" that stops
 * being true the first time somebody books a part in without opening the job,
 * and nothing would ever say so.
 *
 * So it checks the derivation against the records, on real data, through the
 * same function the screen calls:
 *
 *   - a job with a part on order is the supplier's, whatever else is true;
 *   - the moment that part arrives, it is ours again, with no other edit;
 *   - a job waiting for approval of an estimate nobody sent is **ours**, which
 *     is the one this exists to catch: it reads as the customer's fault on
 *     every board a workshop has ever had;
 *   - the board and the job's own page give the same answer, because they call
 *     the same function.
 *
 * Runs against the seeded hillside-motors and puts back what it moves.
 */

import 'dotenv/config';

import { needsSomebody } from '@carnet/core';
import { prisma } from '@carnet/db';

import { whereJobsStand, whereOneJobStands } from '../../apps/web/src/lib/standing';

let failures = 0;

const TAG = 'Verify standing probe';

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
  console.info('\n  Where everything stands\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  const board = await whereJobsStand(org.id);
  check('the board has the open jobs on it', board.length > 0, true);

  /* --- worst first, and what that means ----------------------------------- */

  const moves = board.map((job) => job.standing.move);
  const firstTheirs = moves.findIndex((move) => move !== 'us');
  const lastOurs = moves.lastIndexOf('us');

  check(
    'ours come before theirs, unless something is late',
    firstTheirs === -1 || lastOurs < firstTheirs || board.some((job) => job.standing.late),
    true,
  );

  check(
    'and nothing settled is above something waiting',
    board.findIndex((job) => !needsSomebody(job.standing)) === -1 ||
      board.findIndex((job) => !needsSomebody(job.standing)) >
        board.filter((job) => needsSomebody(job.standing)).length - 1,
    true,
  );

  /* --- every line says what to do, or says nobody needs to -------------- */

  const mute = board.filter((job) => needsSomebody(job.standing) && !job.standing.next);
  check(
    'every job somebody is waiting on has one thing to do',
    // BOOKED is the exception the derivation states: the car has not arrived
    // and there is nothing to do but expect it.
    mute.every((job) => job.status === 'BOOKED'),
    true,
  );

  const empty = board.filter((job) => !job.standing.reason.key);
  check('and every one of them says why', empty.length, 0);

  /* --- a part on order moves the job to the supplier ---------------------- */

  console.info('\n  A part on order');

  // The part is put on, and taken off again, by this probe.
  //
  // The seed's started job has no parts on it, and an earlier draft of this
  // check reported that as a failure -- which would have been a check telling
  // somebody to reseed a database that was perfectly fine. Phase 77 settled
  // the rule: build what is missing rather than skip, and rather than blame
  // the data.
  const started = await prisma.job.findFirst({
    where: { orgId: org.id, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
    select: { id: true },
  });

  if (!started) {
    failures += 1;
    console.error('  FAIL   no job is approved or started. Reseed: npm run db:seed');
  } else {
    const before = await whereOneJobStands(org.id, started.id);

    const line = await prisma.jobPartLine.create({
      data: {
        jobId: started.id,
        description: TAG,
        quantity: 1,
        unitCost: 10,
        unitPrice: 20,
        status: 'ON_ORDER',
      },
      select: { id: true },
    });

    const onOrder = await whereOneJobStands(org.id, started.id);

    check("with a part on order it is the supplier's", onOrder?.standing.move, 'supplier');
    check('and the thing to do is chase them', onOrder?.standing.next?.key, 'Chase the supplier');
    check('and it says how many', onOrder?.standing.reason.vars.count, 1);

    // The part arrives. One field on one line, and nothing about the job.
    await prisma.jobPartLine.update({ where: { id: line.id }, data: { status: 'FITTED' } });
    const fitted = await whereOneJobStands(org.id, started.id);

    check('when it arrives the job is ours again', fitted?.standing.move, 'us');
    check(
      'and the position is the one it had before, with no edit to the job',
      fitted?.standing.reason.key,
      before?.standing.reason.key,
    );

    await prisma.jobPartLine.delete({ where: { id: line.id } });
  }

  /* --- the one this exists to catch --------------------------------------- */

  console.info('\n  An estimate nobody sent');

  const awaiting = await prisma.job.findFirst({
    where: { orgId: org.id, status: 'AWAITING_APPROVAL' },
    select: { id: true, estimates: { select: { id: true, sentAt: true } } },
  });

  if (awaiting?.estimates[0]) {
    const estimate = awaiting.estimates[0];
    const sent = estimate.sentAt;

    await prisma.estimate.update({ where: { id: estimate.id }, data: { sentAt: null } });
    const unsent = await whereOneJobStands(org.id, awaiting.id);

    check('a job awaiting approval of an unsent estimate is ours', unsent?.standing.move, 'us');
    check('and says to send it', unsent?.standing.next?.key, 'Send the estimate');

    await prisma.estimate.update({ where: { id: estimate.id }, data: { sentAt: sent } });
    const restored = await whereOneJobStands(org.id, awaiting.id);
    check('and once it is sent it is theirs', restored?.standing.move, 'customer');
  } else {
    console.info('  --     no job is awaiting approval in the seed; that pair was not exercised');
  }

  /* --- one derivation, two renderings ------------------------------------- */

  console.info('\n  The board and the job agree');

  const sample = board[0]!;
  const alone = await whereOneJobStands(org.id, sample.id);

  check('the same job reads the same on its own page', alone?.standing.move, sample.standing.move);
  check('with the same reason', alone?.standing.reason.key, sample.standing.reason.key);
  check('and the same next thing', alone?.standing.next?.key, sample.standing.next?.key);

  console.info(
    failures === 0
      ? '\n  Every job says whose move it is, and nothing about it is stored.'
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
