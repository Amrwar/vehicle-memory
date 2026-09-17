/**
 * Why did this customer not get their message? Phase 50.
 *
 *   npx tsx infra/scripts/verify-health.ts [baseUrl]
 *
 * The phase is judged on one sentence: that question has to be answerable on a
 * screen rather than in a log. So this script asks it, in each of the ways it
 * actually arrives — a bounce, a queue that is held, a queue that is stuck, a
 * provider that gave up — and checks the answer names the reason and the next
 * move rather than repeating the status back.
 *
 * Then the rest of an operator's page: that it says how the system is, that it
 * is as bad as its worst part rather than an average, and that a workshop
 * owner — the most powerful role there is, in their own workshop — cannot find
 * it at all. Every figure on that page spans every workshop at once, which is
 * the one view the rest of this product spends its time making impossible.
 *
 * Everything it makes, it removes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import {
  describeHealth,
  needsAttention,
  signal,
  whyMessage,
  worstSignalsFirst,
  worstStanding,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { systemHealth, traceMessagesTo } from '../../apps/web/src/lib/health';
import { isOperator } from '../../apps/web/src/lib/operator';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Health probe';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
  }
}

async function mint(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      orgId,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return token;
}

async function ask(path: string, token?: string) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: token ? { cookie: `carnet_session=${token}` } : {},
  });
  const body = response.status === 200 ? await response.text() : '';
  return { status: response.status, body };
}

async function main() {
  console.info('\n  How Carnet itself is\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  /* --- the board ---------------------------------------------------------- */

  console.info('  What an operator sees');

  const signals = await systemHealth();

  check(signals.length > 12, `${signals.length} things are looked at`, signals.length);

  const areas = new Set(signals.map((one) => one.area));
  check(
    areas.size >= 6,
    'across system, workers, integrations, records, access and coming back',
    [...areas].join(', '),
  );

  check(
    signals.every((one) => one.sentence.length > 0 && !one.sentence.includes('{')),
    'every one of them says something, with its figures filled in',
    signals.find((one) => one.sentence.includes('{'))?.name,
  );

  // The property that makes a status page worth reading. Nine healthy things
  // and one failed one is a failure; a page reporting ninety per cent is a
  // page that gets ignored on the day it matters.
  const board = [
    signal({ area: 'A', name: 'a', standing: 'healthy', template: 'x' }),
    signal({ area: 'A', name: 'b', standing: 'healthy', template: 'x' }),
    signal({ area: 'A', name: 'c', standing: 'failed', template: 'x' }),
  ];

  check(worstStanding(board) === 'failed', 'the whole is as bad as its worst part');
  check(needsAttention(board).length === 1, 'and only what is wrong asks to be acted on');
  check(
    worstSignalsFirst(board)[0]?.standing === 'failed',
    'with the worst read first',
    describeHealth(board),
  );

  /* --- the question ------------------------------------------------------- */

  console.info('\n  Why did they not get their message?');

  const address = `${TAG.replace(/\s+/g, '-').toLowerCase()}-${randomBytes(3).toString('hex')}@example.test`;

  // Four messages, one for each way the question actually arrives.
  const [bounced, heldForMorning, stuck, gaveUp] = await Promise.all([
    prisma.messageLog.create({
      data: {
        orgId: org.id,
        channel: 'EMAIL',
        toAddress: address,
        subject: `${TAG}: after a bounce`,
        body: TAG,
        status: 'QUEUED',
      },
      select: { id: true },
    }),
    prisma.messageLog.create({
      data: {
        orgId: org.id,
        channel: 'SMS',
        toAddress: address,
        subject: `${TAG}: held until morning`,
        body: TAG,
        status: 'QUEUED',
        availableAt: new Date(Date.now() + 8 * 3_600_000),
      },
      select: { id: true },
    }),
    prisma.messageLog.create({
      data: {
        orgId: org.id,
        channel: 'EMAIL',
        toAddress: address,
        subject: `${TAG}: due and not gone`,
        body: TAG,
        status: 'QUEUED',
        availableAt: new Date(Date.now() - 600_000),
      },
      select: { id: true },
    }),
    prisma.messageLog.create({
      data: {
        orgId: org.id,
        channel: 'EMAIL',
        toAddress: address,
        subject: `${TAG}: given up on`,
        body: TAG,
        status: 'FAILED',
        attempts: 8,
        error: 'mailbox unavailable',
      },
      select: { id: true },
    }),
  ]);

  const traced = await traceMessagesTo(address);
  const find = (id: string) => traced.find((one) => one.id === id);

  check(traced.length === 4, 'every message to an address is found at once', traced.length);

  const held = find(heldForMorning.id);
  check(
    held?.verdict.outcome === 'waiting' && held.verdict.sentence.includes('outside the hours'),
    'a message held until the morning says so, rather than looking stuck',
    held?.verdict.sentence,
  );

  const waiting = find(stuck.id);
  check(
    waiting?.verdict.sentence.includes('due to go now') === true &&
      waiting.verdict.next?.includes('worker') === true,
    'a message that is due and has not gone points at the worker',
    waiting?.verdict.sentence,
  );

  const abandoned = find(gaveUp.id);
  check(
    abandoned?.verdict.outcome === 'stopped' &&
      abandoned.verdict.sentence.includes('mailbox unavailable'),
    'a message given up on repeats what the provider actually said',
    abandoned?.verdict.sentence,
  );

  check(
    abandoned?.verdict.next !== undefined,
    'and every answer that has a next move names it',
    abandoned?.verdict.next,
  );

  // Now block the address, and ask again. The suppression must beat the
  // status: the message still says QUEUED and that is not why it did not go.
  await prisma.suppressedAddress.create({
    data: { orgId: org.id, address, reason: 'HARD_BOUNCE', detail: `${TAG}: no such mailbox` },
  });

  const afterBlock = (await traceMessagesTo(address)).find((one) => one.id === bounced.id);

  check(
    afterBlock?.verdict.outcome === 'stopped' && afterBlock.verdict.sentence.includes('stopped on'),
    'a blocked address beats the status, which still says queued',
    afterBlock?.verdict.sentence,
  );

  check(
    afterBlock?.verdict.next?.includes('different address') === true,
    'and says what to do about it',
    afterBlock?.verdict.next,
  );

  // Consent beats everything, because it is not a delivery problem at all.
  const asked = whyMessage({
    status: 'FAILED',
    attempts: 8,
    error: 'bounced',
    availableAt: new Date(),
    maxAttempts: 8,
    consentWithdrawn: true,
  });

  check(
    asked.sentence.includes('asked not to be written to') &&
      asked.next?.includes('Nothing to fix') === true,
    'somebody who asked not to be written to is not reported as a failure',
    asked.sentence,
  );

  /* --- who may look at any of it ------------------------------------------ */

  console.info('\n  Who the page is for');

  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true, email: true },
  });

  const asOwner = await mint(owner.id, org.id);
  const answer = await ask('/admin/health', asOwner);

  check(
    answer.status === 404 || answer.body.includes('The road stops here'),
    'a workshop owner cannot find it at all',
    answer.status === 200 ? 'answered with the page' : answer.status,
  );

  const cold = await ask('/admin/health');
  check(
    cold.status !== 200 || cold.body.includes('The road stops here'),
    'and neither can somebody with no account',
    cold.status,
  );

  check(
    (await isOperator(owner.email)) === false,
    'being the most powerful role in a workshop does not make somebody the operator',
  );

  check(
    (await isOperator(process.env.OPERATOR_EMAIL ?? null)) === Boolean(process.env.OPERATOR_EMAIL),
    'and the operator is whoever the operator address says',
    process.env.OPERATOR_EMAIL ? 'set' : 'unset, so nobody is',
  );

  // The control, and it is not optional. Every refusal above would read as a
  // pass if the page were simply broken, or the route missing, or the build
  // stale — which is exactly how the tenancy probe two phases ago spent a
  // morning being green and proving nothing. So the same address that is
  // refused for everybody else has to work for the one person it is for.
  const operatorAddress = process.env.OPERATOR_EMAIL?.trim();
  let made: string | null = null;

  if (!operatorAddress) {
    check(false, 'there is an operator to check against', 'OPERATOR_EMAIL is not set');
  } else {
    const existing = await prisma.user.findUnique({
      where: { email: operatorAddress.toLowerCase() },
      select: { id: true },
    });

    const operator =
      existing ??
      (await prisma.user.create({
        data: {
          email: operatorAddress.toLowerCase(),
          name: TAG,
          passwordHash: randomBytes(32).toString('hex'),
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      }));

    if (!existing) made = operator.id;

    const asOperator = await mint(operator.id, null);
    const theirs = await ask('/admin/health', asOperator);

    check(
      theirs.status === 200 && theirs.body.includes('System health'),
      'the operator can read the page everybody else is refused',
      theirs.status === 200 ? 'answered, but not with the page' : theirs.status,
    );

    check(
      theirs.body.includes('Why did they not get their message?'),
      'and the question this phase exists for is on it',
    );
  }

  await forget(org.id, address, made);
  finish();
}

async function forget(orgId: string, address: string, madeUserId: string | null = null) {
  await prisma.deliveryEvent.deleteMany({ where: { messageLog: { toAddress: address } } });
  await prisma.messageLog.deleteMany({ where: { orgId, toAddress: address } });
  await prisma.suppressedAddress.deleteMany({ where: { orgId, address } });
  await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date(Date.now() + 3_600_001) }, orgId },
  });

  // Only the operator account this run invented, never one that was there
  // before it: an operator with a real account is somebody's way in.
  if (madeUserId) {
    await prisma.session.deleteMany({ where: { userId: madeUserId } });
    await prisma.user.delete({ where: { id: madeUserId } });
  }
}

function finish() {
  console.info('');
  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. The question is answered on a screen.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
