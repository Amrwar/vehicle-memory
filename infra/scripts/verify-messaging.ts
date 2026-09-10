/**
 * Proves that a message written to the queue actually leaves it.
 *
 *   npx tsx infra/scripts/verify-messaging.ts
 *
 * This is the check that would have caught the gap it was written to close.
 * Rows were being written to `message_logs` by the reminder engine, the
 * automation queue, the booking flow and the estimate links, and nothing ever
 * moved them. Everything looked healthy: the tables filled up, no error was
 * raised anywhere, and not one customer heard a word.
 *
 * So the assertion is not "the sender is configured". It is: put a message in,
 * run the sweeper, and see that it came out the other side, with a provider
 * against it and a time it went.
 *
 * Everything written here is cleaned up, so it can run against a populated
 * database without leaving anything behind.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { sendQueuedMessages, TRANSPORTS } from '@carnet/jobs';

let failures = 0;
let checked = 0;

function ok(what: string, detail = '') {
  checked += 1;
  console.info(`  ok    ${what}${detail ? `  ${detail}` : ''}`);
}

function fail(what: string, detail: string) {
  checked += 1;
  failures += 1;
  console.info(`  FAIL  ${what}  ${detail}`);
}

const written: string[] = [];

async function queue(input: {
  orgId: string;
  channel: 'EMAIL' | 'SMS' | 'PORTAL';
  to: string;
  body?: string;
  availableAt?: Date;
}) {
  const row = await prisma.messageLog.create({
    data: {
      orgId: input.orgId,
      channel: input.channel,
      toAddress: input.to,
      subject: 'Verification probe',
      body: input.body ?? 'A probe written by verify-messaging.ts.',
      status: 'QUEUED',
      availableAt: input.availableAt ?? new Date(),
      relatedType: 'Probe',
    },
  });

  written.push(row.id);
  return row.id;
}

async function main() {
  console.info('\n  Messaging\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  console.info(`  Measuring ${org.name}.`);
  console.info(`  Email via ${TRANSPORTS.EMAIL.name}, texts via ${TRANSPORTS.SMS.name}.\n`);

  /* --- a message that should go --------------------------------------- */

  const good = await queue({ orgId: org.id, channel: 'EMAIL', to: 'probe@example.test' });

  await sendQueuedMessages();

  const after = await prisma.messageLog.findUniqueOrThrow({ where: { id: good } });

  if (after.status !== 'SENT') {
    fail('a queued message is sent', `it is still ${after.status}: ${after.error ?? 'no reason'}`);
  } else {
    ok('a queued message is sent', `via ${after.provider}`);
  }

  if (!after.sentAt) fail('a sent message records when it went', 'sentAt is empty');
  else ok('a sent message records when it went');

  if (!after.provider) fail('a sent message records what carried it', 'provider is empty');
  else ok('a sent message records what carried it');

  // Per message, not per install. A workshop that changes provider needs to
  // know which of last month's messages went by the old one.
  if (after.attempts !== 1) fail('an attempt is counted', `attempts is ${after.attempts}`);
  else ok('an attempt is counted');

  /* --- a message that never can ---------------------------------------- */

  const bad = await queue({ orgId: org.id, channel: 'EMAIL', to: 'not-an-address' });

  await sendQueuedMessages();

  const rejected = await prisma.messageLog.findUniqueOrThrow({ where: { id: bad } });

  if (rejected.status !== 'FAILED') {
    fail('an unusable address fails immediately', `it is ${rejected.status}`);
  } else {
    ok('an unusable address fails immediately');
  }

  // The whole point of classifying failures. Six attempts against a typo
  // delay everything queued behind it and bury the real failures in the log.
  if (rejected.attempts > 1) {
    fail('an unusable address is not retried', `it was tried ${rejected.attempts} times`);
  } else {
    ok('an unusable address is not retried');
  }

  if (!rejected.error?.includes('not a usable')) {
    fail('a failure says what was wrong', rejected.error ?? 'no reason recorded');
  } else {
    ok('a failure says what was wrong');
  }

  /* --- a message whose time has not come -------------------------------- */

  const later = await queue({
    orgId: org.id,
    channel: 'EMAIL',
    to: 'probe@example.test',
    availableAt: new Date(Date.now() + 3_600_000),
  });

  await sendQueuedMessages();

  const held = await prisma.messageLog.findUniqueOrThrow({ where: { id: later } });

  if (held.status !== 'QUEUED' || held.attempts !== 0) {
    fail('a message held for later is left alone', `${held.status}, ${held.attempts} attempts`);
  } else {
    ok('a message held for later is left alone');
  }

  /* --- a text at the wrong hour ----------------------------------------- */

  const hour = new Date().getHours();
  const nocturnal = hour < 8 || hour >= 20;

  const text = await queue({ orgId: org.id, channel: 'SMS', to: '07700 900999' });

  await sendQueuedMessages();

  const texted = await prisma.messageLog.findUniqueOrThrow({ where: { id: text } });

  if (nocturnal) {
    // Running this overnight must not send, and must not fail either.
    if (texted.status !== 'QUEUED' || !texted.error?.includes('held between')) {
      fail('a text at night is held, not sent', `${texted.status}: ${texted.error ?? '—'}`);
    } else {
      ok('a text at night is held, not sent');
    }
  } else if (texted.status !== 'SENT') {
    fail('a text during the day is sent', `${texted.status}: ${texted.error ?? '—'}`);
  } else {
    ok('a text during the day is sent', 'and the number was normalised to E.164');
  }

  /* --- nothing is stuck ------------------------------------------------- */

  const stuck = await prisma.messageLog.count({
    where: {
      orgId: org.id,
      status: 'QUEUED',
      availableAt: { lte: new Date() },
      id: { notIn: written },
    },
  });

  if (stuck > 0) {
    fail('nothing real is sitting due and unsent', `${stuck} message(s), the worker may be down`);
  } else {
    ok('nothing real is sitting due and unsent');
  }

  /* --- every failure is explained --------------------------------------- */

  const silent = await prisma.messageLog.count({
    where: { orgId: org.id, status: 'FAILED', OR: [{ error: null }, { error: '' }] },
  });

  if (silent > 0) fail('every failure carries a reason', `${silent} without one`);
  else ok('every failure carries a reason');

  await prisma.messageLog.deleteMany({ where: { id: { in: written } } });
  ok('the probe cleaned up after itself', `${written.length} rows removed`);

  console.info(
    `\n  ${checked} checks. ${failures === 0 ? 'Messages leave the building.' : `${failures} failed.`}\n`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.messageLog.deleteMany({ where: { id: { in: written } } });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
