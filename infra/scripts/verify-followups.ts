/**
 * Chasing something later. Phase 66. FR-617.
 *
 *   npx tsx infra/scripts/verify-followups.ts
 *
 * The last requirement the traceability matrix admitted nothing implements.
 * The table has been in the schema since the first migration with no code
 * reading from it or writing to it — an honest gap, named in the matrix and
 * the roadmap, and sitting there for a year.
 *
 * What is checked is not "a row can be written". It is the set of things that
 * decide whether a follow-up is worth having at all:
 *
 *   It is somewhere somebody will see it. A flag on a job nobody opens again
 *     is a note in a drawer, so what is late or due today appears where the
 *     day starts, and what was given to one person appears on that person's
 *     own screen.
 *
 *   Late is different from due today, and says how late. A list that shows a
 *     three-week-old one exactly like this morning's is a list that gets
 *     ignored, which is where the paper diary it replaces already is.
 *
 *   Who did it is recorded, because that is the question asked afterwards
 *     when a customer says nobody rang them.
 *
 *   And it stays inside the workshop. `JobFollowUp` carries no `orgId` of its
 *     own, so the tenant filter has nothing to narrow it by (Phase 64) and
 *     every query has to name the job itself.
 */

import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { describeFollowUp, mostOverdueFirst, needingAttention, standingOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  completeFollowUp,
  couldFollowUp,
  FollowUpError,
  followUpsDue,
  followUpsForJob,
  followUpsNeedingAttention,
  setFollowUp,
} from '../../apps/web/src/lib/followups';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

const tag = randomBytes(5).toString('hex').toUpperCase();

function daysFromNow(days: number): Date {
  const at = new Date();
  at.setDate(at.getDate() + days);
  at.setHours(12, 0, 0, 0);
  return at;
}

async function workshop(name: string) {
  return prisma.organization.create({
    data: {
      slug: `followups-${name}-${tag.toLowerCase()}`,
      name: `${name} ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
      // A job has to be somewhere, so a workshop needs a site before it can
      // have one.
      locations: { create: [{ name: `${name} site ${tag}`, code: `S${tag.slice(0, 4)}` }] },
    },
    select: { id: true, locations: { select: { id: true } } },
  });
}

async function main() {
  console.info('\n  Chasing something later\n');

  const [mine, theirs] = await Promise.all([workshop('mine'), workshop('theirs')]);

  const advisor = await prisma.user.create({
    data: {
      email: `advisor-${tag.toLowerCase()}@example.com`,
      name: `Priya Ashworth ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true, name: true },
  });

  const technician = await prisma.user.create({
    data: {
      email: `tech-${tag.toLowerCase()}@example.com`,
      name: `Ade Fennimore ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true, name: true },
  });

  const stranger = await prisma.user.create({
    data: {
      email: `stranger-${tag.toLowerCase()}@example.com`,
      name: `Not On This Team ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });

  await prisma.membership.createMany({
    data: [
      { userId: advisor.id, orgId: mine.id, role: 'SERVICE_ADVISOR' },
      { userId: technician.id, orgId: mine.id, role: 'TECHNICIAN' },
      { userId: stranger.id, orgId: theirs.id, role: 'OWNER' },
    ],
  });

  const customer = await prisma.customer.create({
    data: { orgId: mine.id, kind: 'INDIVIDUAL', displayName: `A customer ${tag}` },
    select: { id: true },
  });

  const theirCustomer = await prisma.customer.create({
    data: { orgId: theirs.id, kind: 'INDIVIDUAL', displayName: `Their customer ${tag}` },
    select: { id: true },
  });

  const vehicle = await prisma.vehicle.create({
    data: { vin: `FUP${tag}00000000`.slice(0, 17), registration: `FU${tag.slice(0, 5)}` },
    select: { id: true },
  });

  const job = await prisma.job.create({
    data: {
      orgId: mine.id,
      locationId: mine.locations[0]!.id,
      number: 90_000 + Math.floor(Math.random() * 9_000),
      customerId: customer.id,
      vehicleId: vehicle.id,
      shortDescription: 'Service and brakes',
      status: 'COMPLETED',
    },
    select: { id: true },
  });

  const elsewhere = await prisma.job.create({
    data: {
      orgId: theirs.id,
      locationId: theirs.locations[0]!.id,
      number: 91_000 + Math.floor(Math.random() * 9_000),
      customerId: theirCustomer.id,
      vehicleId: vehicle.id,
      shortDescription: 'Somebody else’s work',
      status: 'COMPLETED',
    },
    select: { id: true },
  });

  /* --- setting one ---------------------------------------------------------- */

  const late = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'Ring about the rear discs they turned down',
    dueAt: daysFromNow(-9),
    assignedToUserId: technician.id,
  });

  await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'Chase the turbo hose with the supplier',
    dueAt: daysFromNow(0),
  });

  await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'Check the noise has not come back',
    dueAt: daysFromNow(60),
  });

  const onTheJob = await followUpsForJob(mine.id, job.id);

  check(onTheJob.length === 3, 'a job can carry more than one thing to chase', onTheJob.length);

  check(
    onTheJob[0]!.note.includes('rear discs'),
    'and the most overdue is first, because that is what the ten minutes should go to',
    onTheJob.map((one) => standingOf(one)).join(', '),
  );

  check(
    describeFollowUp(onTheJob[0]!) === '9 days late',
    'which says how late it is rather than showing a colour',
    describeFollowUp(onTheJob[0]!),
  );

  check(
    standingOf(onTheJob[1]!) === 'TODAY' && standingOf(onTheJob[2]!) === 'LATER',
    'and today is told apart from something two months out',
  );

  /* --- what a note is allowed to be ----------------------------------------- */

  const empty = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: '  ',
    dueAt: daysFromNow(3),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(empty === 'NO_NOTE', 'a follow-up that says nothing is refused', empty);

  const mistyped = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'Ring them',
    dueAt: daysFromNow(-800),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(
    mistyped === 'LONG_PAST',
    'and a date two years ago is a typed year, not an intention',
    mistyped,
  );

  // But last week is allowed, because that is how most of them arrive.
  const alreadyLate = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'We should have rung them last week',
    dueAt: daysFromNow(-6),
  }).then(
    () => 'allowed',
    (error: unknown) => String(error),
  );

  check(
    alreadyLate === 'allowed',
    'work that arrives already late can be written down as late',
    alreadyLate,
  );

  /* --- where somebody will actually see it ---------------------------------- */

  const due = await followUpsDue(mine.id);

  check(
    due.length === 3 && due.every((one) => ['OVERDUE', 'TODAY'].includes(standingOf(one))),
    'what is late or due today is on the list; what is two months out is not',
    due.map((one) => standingOf(one)).join(', '),
  );

  check(
    (await followUpsNeedingAttention(mine.id)) === 3,
    'and the figure on the screen counts the same things the list holds',
  );

  const theirs0 = await followUpsDue(theirs.id);

  check(theirs0.length === 0, 'another workshop’s list is empty, not full of ours');

  const mineOnly = await followUpsDue(mine.id, { userId: technician.id });

  check(
    mineOnly.length === 1 && mineOnly[0]!.note.includes('rear discs'),
    'the person it was given to sees theirs, and only theirs',
    mineOnly.length,
  );

  /* --- and they were told --------------------------------------------------- */

  const told = await prisma.staffNotification.findMany({
    where: { orgId: mine.id, kind: 'FOLLOW_UP_ASSIGNED' },
    select: { userId: true, href: true },
  });

  check(
    told.length === 1 && told[0]!.userId === technician.id,
    'the person it was given to was told, and nobody else was',
    told.length,
  );

  check(
    told[0]!.href === `/jobs/${job.id}#followup`,
    'and the notification goes to the thing rather than to a list',
  );

  /* --- the boundary --------------------------------------------------------- */

  const notMine = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: elsewhere.id,
    note: 'On somebody else’s job',
    dueAt: daysFromNow(1),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(notMine === 'NOT_YOURS', 'a follow-up cannot be put on another workshop’s job', notMine);

  const notTheirs = await setFollowUp({
    orgId: mine.id,
    userId: advisor.id,
    jobId: job.id,
    note: 'Given to somebody at another workshop',
    dueAt: daysFromNow(1),
    assignedToUserId: stranger.id,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(
    notTheirs === 'NOT_YOURS',
    'and cannot be given to somebody who is not on this team',
    notTheirs,
  );

  const team = await couldFollowUp(mine.id);

  check(
    team.length === 2 && !team.some((person) => person.id === stranger.id),
    'the people it can be given to are this workshop’s, and all of them',
    team.map((person) => person.name).join(', '),
  );

  /* --- ticking it off ------------------------------------------------------- */

  await completeFollowUp({ orgId: mine.id, userId: technician.id, followUpId: late.id });

  const afterwards = await followUpsForJob(mine.id, job.id);
  const done = afterwards.find((one) => one.id === late.id)!;

  check(standingOf(done) === 'DONE', 'a follow-up can be ticked off');

  check(
    done.completedBy?.name === technician.name,
    'and who did it is on the record, which is the question asked afterwards',
    done.completedBy?.name,
  );

  const twice = await completeFollowUp({
    orgId: mine.id,
    userId: technician.id,
    followUpId: late.id,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(
    twice === 'ALREADY_DONE',
    'and doing it twice is refused, rather than recorded twice',
    twice,
  );

  const theirFollowUp = await prisma.jobFollowUp.findFirst({
    where: { jobId: job.id },
    select: { id: true },
  });

  const reachedFromElsewhere = await completeFollowUp({
    orgId: theirs.id,
    userId: stranger.id,
    followUpId: theirFollowUp!.id,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FollowUpError ? error.code : `wrong error: ${error}`),
  );

  check(
    reachedFromElsewhere === 'NOT_YOURS',
    'and another workshop cannot tick off one of ours, by id',
    reachedFromElsewhere,
  );

  /* --- the arithmetic the screens do ---------------------------------------- */

  const remaining = await followUpsForJob(mine.id, job.id);

  check(
    needingAttention(remaining) === 2,
    'the count drops when something is done, because it counts what is left',
    needingAttention(remaining),
  );

  check(
    mostOverdueFirst(remaining)[0]!.note.includes('last week'),
    'and the next worst rises to the top',
    mostOverdueFirst(remaining)[0]!.note,
  );

  /* --- and readable in three languages -------------------------------------- */

  // Every standing a follow-up can have is built in core and handed to `t()`
  // as a variable, so no scanner collecting literals can see one. The fifth
  // time this gap has been closed a list at a time — Phases 57, 59, 62, 63 and
  // here — and the first where a sentence carries a number through it, which
  // is the case a dictionary key with a slot exists for.

  const { hasTranslation, translate } = await import('@carnet/core');

  const everyStanding = [
    describeFollowUp({ dueAt: daysFromNow(0), completedAt: null }),
    describeFollowUp({ dueAt: daysFromNow(30), completedAt: null }),
    describeFollowUp({ dueAt: daysFromNow(-1), completedAt: null }),
    describeFollowUp({ dueAt: daysFromNow(-12), completedAt: null }),
    describeFollowUp({ dueAt: daysFromNow(-3), completedAt: new Date() }),
  ];

  const unanswered: string[] = [];

  for (const sentence of everyStanding) {
    for (const language of ['fr', 'ar'] as const) {
      if (!hasTranslation(language, sentence) && translate(language, sentence) === sentence) {
        unanswered.push(`${language}: ${sentence}`);
      }
    }
  }

  check(
    unanswered.length === 0,
    `each of the ${everyStanding.length} things a follow-up can say about itself is answered in French and Arabic`,
    unanswered.join(' | '),
  );

  check(
    translate('fr', describeFollowUp({ dueAt: daysFromNow(-12), completedAt: null })).includes(
      '12',
    ),
    'and how many days late it is comes through the translation',
    translate('fr', describeFollowUp({ dueAt: daysFromNow(-12), completedAt: null })),
  );

  /* --- clearing up ---------------------------------------------------------- */

  const everybody = [advisor.id, technician.id, stranger.id];

  await prisma.jobFollowUp.deleteMany({ where: { jobId: { in: [job.id, elsewhere.id] } } });
  await prisma.staffNotification.deleteMany({ where: { orgId: { in: [mine.id, theirs.id] } } });
  await prisma.auditLog.updateMany({
    where: { actorUserId: { in: everybody } },
    data: { actorUserId: null },
  });
  await prisma.job.deleteMany({ where: { id: { in: [job.id, elsewhere.id] } } });
  await prisma.customer.deleteMany({ where: { orgId: { in: [mine.id, theirs.id] } } });
  await prisma.location.deleteMany({ where: { orgId: { in: [mine.id, theirs.id] } } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  await prisma.membership.deleteMany({ where: { userId: { in: everybody } } });
  await prisma.user.deleteMany({ where: { id: { in: everybody } } });
  await prisma.organization.deleteMany({ where: { id: { in: [mine.id, theirs.id] } } });

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(
      `\n  ${checked} checks. What was put off is written down, and somebody sees it.\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
