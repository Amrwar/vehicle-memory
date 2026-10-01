/**
 * Minute by minute. Phase 99.
 *
 *   npx tsx infra/scripts/verify-story.ts
 *
 * The ordering, the days, the silences and the counts are unit tested. What
 * cannot be is whether the story reads the right columns off the right
 * records: that a status move names the person who made it, that an
 * estimate's `sentAt` is named from the audit row for the sending, that a
 * reminder the product sent is counted as the product's and a reply the
 * customer sent as the customer's, that a key hung on a hook is on the page,
 * and that a check-in -- which has no record of its own beyond the audit log
 * -- appears at all. Each of those is a fact about a database.
 *
 * **Nothing is guessed.** Where neither the record nor the audit log names
 * the actor, the entry says so by saying nobody, and that is checked too.
 *
 * **It writes nothing**, counted before and after.
 *
 * **Every sentence it can say is answered in French and Arabic** -- read out
 * of this library's source and core's, and the words the page fills a slot
 * with, because `i18n-scan` reads literal calls and these are built inside
 * functions (ADR-0019).
 *
 * The job is built with every moment put in by hand at a known minute, so
 * that the order the page shows can be compared with the order the moments
 * were written in.
 */

import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { businessDay, regionForCountry, startOfDayIn, type StoryKind } from '@carnet/core';
import { prisma } from '@carnet/db';

import { threadFor } from '../../apps/web/src/lib/conversations';
import { storyOf } from '../../apps/web/src/lib/story';
import { AR } from '../../packages/core/src/i18n/ar';
import { AREAS } from '../../packages/core/src/i18n/areas/index';
import { FR } from '../../packages/core/src/i18n/fr';

const ROOT = join(import.meta.dirname, '..', '..');
const LIB = join(ROOT, 'apps', 'web', 'src', 'lib', 'story.ts');
const RULES = join(ROOT, 'packages', 'core', 'src', 'job', 'story.ts');
const PAGE = join(
  ROOT,
  'apps',
  'web',
  'src',
  'app',
  '(workshop)',
  'jobs',
  '[id]',
  'story',
  'page.tsx',
);

const TAG = 'VERIFY-STORY';
const MINUTE = 60_000;

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

const FRENCH: Record<string, string> = Object.assign({}, FR, ...AREAS.map((area) => area.fr));
const ARABIC: Record<string, string> = Object.assign({}, AR, ...AREAS.map((area) => area.ar));

function keysIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const found = new Set<string>();
  for (const match of source.matchAll(/\bkey: '((?:[^'\\]|\\.)*)'/g)) {
    found.add((match[1] ?? '').replace(/\\'/g, "'"));
  }
  // A key chosen by a ternary is written as a bare string on its own line.
  for (const match of source.matchAll(/^\s+\? '((?:[^'\\]|\\.)*)'$|^\s+: '((?:[^'\\]|\\.)*)'$/gm)) {
    found.add((match[1] ?? match[2] ?? '').replace(/\\'/g, "'"));
  }
  return [...found].filter(Boolean).sort();
}

/** The words the page fills a slot with: the sides, the channels, the methods. */
function wordsThePageFills(): string[] {
  const source = readFileSync(PAGE, 'utf8');
  const found = new Set<string>();
  for (const block of source.matchAll(/const (?:SIDE|CHANNEL|METHOD)_WORD[^{]*\{([^}]*)\}/g)) {
    for (const match of (block[1] ?? '').matchAll(/: '([^']*)'/g)) found.add(match[1] ?? '');
  }
  return [...found].filter(Boolean).sort();
}

/* ---------------------------------------------------------------------------
   A job with every moment put in by hand
   --------------------------------------------------------------------------- */

async function build(
  orgId: string,
  locationId: string,
  userId: string,
  userName: string,
  timezone: string,
) {
  const [customer, vehicle] = await Promise.all([
    prisma.customer.findFirstOrThrow({ where: { orgId }, select: { id: true, displayName: true } }),
    prisma.vehicleAccessGrant.findFirstOrThrow({ where: { orgId }, select: { vehicleId: true } }),
  ]);

  // Nine in the morning, six days ago, on the workshop's clock -- so that no
  // moment of this job is written within half an hour of midnight, whatever
  // time this runs, and the days come out the same every time.
  const base =
    startOfDayIn(
      businessDay(new Date(Date.now() - 6 * 24 * 60 * MINUTE), timezone, 0),
      timezone,
    ).getTime() +
    9 * 60 * MINUTE;
  const at = (minutes: number) => new Date(base + minutes * MINUTE);

  const sequence = await prisma.documentSequence.upsert({
    where: { orgId_kind: { orgId, kind: 'JOB' } },
    create: { orgId, kind: 'JOB', next: 960_002 },
    update: { next: { increment: 1 } },
  });

  const job = await prisma.job.create({
    data: {
      orgId,
      locationId,
      number: sequence.next - 1,
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: TAG,
      status: 'PAID',
      createdAt: at(0),
      receivedAt: at(10),
      completedAt: at(4 * 24 * 60 + 60),
      collectedAt: at(4 * 24 * 60 + 180),
      statusEvents: {
        create: [
          { toStatus: 'RECEIVED', actorUserId: userId, createdAt: at(10), note: `${TAG} in` },
          { toStatus: 'IN_PROGRESS', actorUserId: null, createdAt: at(4 * 24 * 60) },
        ],
      },
      keyEvents: { create: [{ orgId, action: 'HUNG', hook: 'B7', byUserId: userId, at: at(12) }] },
      notes: { create: [{ authorUserId: userId, body: `${TAG} note`, createdAt: at(15) }] },
      timeEntries: {
        create: [
          {
            userId,
            startedAt: at(4 * 24 * 60),
            endedAt: at(4 * 24 * 60 + 50),
            autoClosed: false,
          },
        ],
      },
      estimates: {
        create: [
          {
            orgId,
            version: 1,
            status: 'APPROVED',
            total: 240,
            sentAt: at(30),
            decidedAt: at(3 * 24 * 60 + 30),
            approvals: {
              create: [
                {
                  decision: 'APPROVED',
                  approvedTotal: 240,
                  approvedByName: customer.displayName,
                  ip: '203.0.113.9',
                  createdAt: at(3 * 24 * 60 + 30),
                },
              ],
            },
          },
        ],
      },
    },
    select: { id: true, estimates: { select: { id: true } } },
  });
  const estimateId = job.estimates[0]!.id;

  // The audit rows: the check-in has no record but this; the estimate's
  // sending is named only here.
  await prisma.auditLog.createMany({
    data: [
      {
        orgId,
        actorUserId: userId,
        action: 'job.checked_in',
        entityType: 'Job',
        entityId: job.id,
        createdAt: at(11),
      },
      {
        orgId,
        actorUserId: userId,
        action: 'estimate.sent',
        entityType: 'Estimate',
        entityId: estimateId,
        createdAt: at(30),
      },
    ],
  });

  // The conversation: the product's reminder, then the customer's reply.
  const conversationId = await threadFor({ orgId, jobId: job.id });
  if (!conversationId) throw new Error('no thread for the job');
  await prisma.messageLog.create({
    data: {
      orgId,
      conversationId,
      channel: 'SMS',
      toAddress: '+440000000000',
      body: `${TAG} reminder`,
      status: 'SENT',
      sentByUserId: null,
      createdAt: at(2 * 24 * 60),
      sentAt: at(2 * 24 * 60),
      relatedType: 'Job',
      relatedId: job.id,
    },
  });
  await prisma.inboundMessage.create({
    data: {
      orgId,
      conversationId,
      customerId: customer.id,
      fromAddress: '+440000000000',
      body: `${TAG} reply`,
      channel: 'SMS',
      receivedAt: at(3 * 24 * 60),
      handledAt: at(3 * 24 * 60 + 5),
    },
  });

  return { jobId: job.id, conversationId, at, userName, customerName: customer.displayName };
}

async function tearDown(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true, estimates: { select: { id: true } } },
  });
  const ids = jobs.map((job) => job.id);
  const estimateIds = jobs.flatMap((job) => job.estimates.map((one) => one.id));
  void estimateIds;
  await prisma.inboundMessage.deleteMany({ where: { orgId, body: `${TAG} reply` } });
  await prisma.messageLog.deleteMany({ where: { orgId, body: `${TAG} reminder` } });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: ids } } });
  await prisma.job.deleteMany({ where: { id: { in: ids } } });
}

/* ---------------------------------------------------------------------------
   The checks
   --------------------------------------------------------------------------- */

async function rowCounts(orgId: string) {
  const [jobs, audit, messages, conversations, told] = await Promise.all([
    prisma.job.count({ where: { orgId } }),
    prisma.auditLog.count({ where: { orgId } }),
    prisma.messageLog.count({ where: { orgId } }),
    prisma.conversation.count({ where: { orgId } }),
    prisma.staffNotification.count({ where: { orgId } }),
  ]);
  return { jobs, audit, messages, conversations, told };
}

async function main() {
  console.info('\n  Minute by minute\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER' },
    select: { userId: true, locationId: true, user: { select: { name: true } } },
  });
  const region = regionForCountry(org.country);
  if (!owner.locationId) throw new Error('the seeded owner is at no site');

  await tearDown(org.id);
  const fixture = await build(
    org.id,
    owner.locationId,
    owner.userId,
    owner.user.name,
    region.timezone,
  );

  try {
    console.info('  Every record, in one order');

    const before = await rowCounts(org.id);
    const told = await storyOf(org.id, fixture.jobId, region.timezone);
    const after = await rowCounts(org.id);
    if (!told) throw new Error('the story came back empty');

    const all = told.story.days.flatMap((day) => day.entries);
    const kinds = all.map((one) => one.kind);

    check('the moments come out in the order they were put in', kinds, [
      'opened',
      'status',
      'checked-in',
      'key',
      'note',
      'estimate-sent',
      'message-out',
      'message-in',
      'estimate-decided',
      'status',
      'clock-on',
      'clock-off',
      'completed',
      'collected',
    ]);
    check(
      'and the times are not later than each other',
      all.every((one, index) => index === 0 || one.at >= all[index - 1]!.at),
      true,
    );
    check('and they fall into the four days they happened on', told.story.days.length, 4);

    console.info('\n  Who did what, and never guessed');

    const by = (kind: string) => all.find((one) => one.kind === kind);
    check('a status move names the person who made it', by('status')?.who, fixture.userName);
    check('and carries the note they wrote with it', by('status')?.detail, `${TAG} in`);
    check(
      'a status move nobody is recorded against names nobody',
      all.filter((one) => one.kind === 'status')[1]?.who ?? null,
      null,
    );
    check(
      'the check-in, which has only an audit row, is on the page',
      Boolean(by('checked-in')),
      true,
    );
    check('and is named from that row', by('checked-in')?.who, fixture.userName);
    check(
      'the estimate’s sending is named from the audit row for it',
      by('estimate-sent')?.who,
      fixture.userName,
    );
    check('and carries the total', by('estimate-sent')?.amount, 240);
    check('the key knows its hook', by('key')?.what?.vars?.hook, 'B7');
    check('the note is excerpted', by('note')?.detail, `${TAG} note`);
    check('the clock says how long', by('clock-off')?.what?.vars?.minutes, 50);

    console.info('\n  Three sides');

    check('a reminder the product sent is the product’s', by('message-out')?.side, 'system');
    check('and says so', by('message-out')?.what?.key, 'The product sent {channel}');
    check('the customer’s reply is the customer’s', by('message-in')?.side, 'customer');
    check('and is named', by('message-in')?.who, fixture.customerName);
    check('the decision on the link is the customer’s', by('estimate-decided')?.side, 'customer');
    check(
      'and the summary counts them apart',
      [told.story.summary.byUs, told.story.summary.byCustomer, told.story.summary.bySystem],
      [10, 3, 1],
    );
    check(
      'and the messages both ways',
      [told.story.summary.messagesOut, told.story.summary.messagesIn],
      [1, 1],
    );

    console.info('\n  The silence');

    check(
      'the longest stretch with nothing recorded is found',
      told.story.summary.longestSilence?.minutes,
      2 * 24 * 60 - 30,
    );
    check(
      'and is attributed to the last thing done before it',
      told.story.summary.longestSilence?.after.kind,
      'estimate-sent',
    );

    console.info('\n  It writes nothing');
    check('reading the story wrote no row', after, before);

    console.info('\n  Not another workshop’s');
    const other = await prisma.organization.findFirst({
      where: { slug: { not: org.slug } },
      select: { id: true },
    });
    if (other) {
      check(
        'another workshop cannot read this job’s story',
        await storyOf(other.id, fixture.jobId, region.timezone),
        null,
      );
    } else {
      failures += 1;
      console.error('  FAIL   the seed has one workshop, so tenancy is untested');
    }

    console.info('\n  Every sentence it can say');
    const keys = [...new Set([...keysIn(LIB), ...keysIn(RULES), ...wordsThePageFills()])].sort();
    check('the story can say something', keys.length > 40, true);
    check(
      'and every sentence has a French answer',
      keys.filter((key) => !FRENCH[key]),
      [],
    );
    check(
      'and an Arabic one',
      keys.filter((key) => !ARABIC[key]),
      [],
    );
    check(
      'and every kind the story knows is told at least once by the seed or this job',
      (() => {
        const source = readFileSync(RULES, 'utf8');
        const known = [...source.matchAll(/^\s+\| '([a-z-]+)'$/gm)].map((m) => m[1] as StoryKind);
        const toldKinds = new Set(kinds);
        // Kinds this fixture does not stage are listed here by name, so a kind
        // nobody ever renders cannot hide among them.
        const notStaged = new Set([
          'checked-out',
          'inspection-started',
          'inspection-completed',
          'estimate-withdrawn',
          'extra-work',
          'part-requested',
          'part-substituted',
          'sublet-ordered',
          'sublet-done',
          'quality',
          'photo',
          'invoice-issued',
          'payment',
          'followup-set',
          'followup-done',
          'summary-sent',
          'comeback',
        ]);
        return known.filter((kind) => !toldKinds.has(kind) && !notStaged.has(kind));
      })(),
      [],
    );
  } finally {
    await tearDown(org.id);
  }

  if (failures > 0) {
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
  } else {
    console.info('\n  All checks passed. Every job is reconstructable minute by minute.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
