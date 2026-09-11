/**
 * Asking, points, referrals and the inbox, against a real database.
 *
 *   npx tsx infra/scripts/verify-retention.ts
 *
 * The unit tests prove the rules. What they cannot prove is the part that
 * actually embarrasses a workshop: asking the same customer twice, asking
 * somebody who is waiting on a complaint, paying a referral to the same person
 * on both sides, or filing a reply against the wrong car.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  askable,
  askAbout,
  awardPoints,
  creditReferral,
  handleInbound,
  inbox,
  loyaltyFor,
  LoyaltyError,
  receiveInbound,
  recordRating,
  redeemPoints,
  referralFor,
  reputation,
  useReferral,
} from '../../apps/web/src/lib/retention';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    console.info(`  ok     ${label}: ${name}`);
  }
}

const PROBE = 'Verify retention probe';

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  await prisma.inboundMessage.deleteMany({ where: { body: { startsWith: PROBE } } });
  await prisma.loyaltyEntry.deleteMany({ where: { reason: { startsWith: PROBE } } });
  await prisma.referral.deleteMany({ where: { code: { startsWith: 'VFY' } } });
  await prisma.reviewRequest.deleteMany({ where: { comment: { startsWith: PROBE } } });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: { in: ['COMPLETED', 'INVOICED', 'PAID'] } },
    orderBy: { completedAt: 'desc' },
    select: { id: true, number: true, customerId: true },
  });

  console.info('\nWho to ask, and who not to');

  const candidates = await askable(org.id);

  check('it looked at recent finished work', candidates.length > 0, true);
  check(
    'every refusal carries a reason',
    candidates
      .filter((entry) => !entry.decision.ask)
      .every((entry) => (entry.decision.why ?? '').length > 10),
    true,
  );

  console.info('\nAsking, and answering');

  await prisma.reviewRequest.deleteMany({ where: { jobId: job.id } });

  const asked = await askAbout({ orgId: org.id, userId: user.id, jobId: job.id });
  check('a request was made', Boolean(asked.token), true);

  const queued = await prisma.messageLog.count({
    where: { orgId: org.id, relatedType: 'ReviewRequest', relatedId: asked.id },
  });
  check('and a message was queued rather than sent here', queued, 1);

  // Asking again about the same job is refused by the database, which is where
  // that rule belongs: asking twice teaches somebody to ignore it.
  await refuses('asking twice about one job', () =>
    askAbout({ orgId: org.id, userId: user.id, jobId: job.id }),
  );

  const poor = await recordRating({ token: asked.token, rating: 2, comment: `${PROBE}: slow` });

  check('a poor rating opens a conversation', poor?.routing?.routing, 'PRIVATE_CONVERSATION');
  check('and somebody has to act on it', poor?.routing?.needsAttention, true);

  // A link forwarded to somebody else must not overwrite what the customer
  // actually said.
  const again = await recordRating({ token: asked.token, rating: 5 });
  check('answering twice keeps the first answer', again?.alreadyAnswered, true);

  const stored = await prisma.reviewRequest.findUniqueOrThrow({
    where: { id: asked.id },
    select: { rating: true, routing: true },
  });
  check('the rating on record is still the first one', stored.rating, 2);

  const picture = await reputation(org.id);
  check('it shows as waiting to be put right', picture.openConversations >= 1, true);

  console.info('\nWhat the database refuses');

  await refuses('a rating of seven', () =>
    prisma.$executeRawUnsafe(
      `UPDATE "review_requests" SET "rating" = 7 WHERE "id" = '${asked.id}'`,
    ),
  );

  await refuses('resolving with nothing written', () =>
    prisma.$executeRawUnsafe(
      `UPDATE "review_requests" SET "resolvedAt" = NOW() WHERE "id" = '${asked.id}'`,
    ),
  );

  console.info('\nPoints');

  const customerId = job.customerId;
  const before = await loyaltyFor(org.id, customerId);

  const earned = await awardPoints({
    orgId: org.id,
    userId: user.id,
    customerId,
    amountMinor: 24_999,
    reason: `${PROBE}: work done`,
  });

  // Floored, not rounded. Rounding up hands out points nobody spent.
  check('earned one point a pound, floored', earned, 249);

  const after = await loyaltyFor(org.id, customerId);
  check('the balance is the sum of the entries', after.balance - before.balance, 249);

  const nothing = await awardPoints({
    orgId: org.id,
    userId: user.id,
    customerId,
    amountMinor: 40,
    reason: `${PROBE}: too small`,
  });
  check('a spend too small to earn writes no row', nothing, 0);

  await refuses('spending more than they have', () =>
    redeemPoints({
      orgId: org.id,
      userId: user.id,
      customerId,
      points: after.balance + 1_000,
      owedMinor: 100_000,
    }),
  );

  await refuses('redeeming more than the bill', () =>
    redeemPoints({ orgId: org.id, userId: user.id, customerId, points: 200, owedMinor: 50 }),
  );

  const value = await redeemPoints({
    orgId: org.id,
    userId: user.id,
    customerId,
    points: 100,
    owedMinor: 10_000,
  });
  check('a redemption is worth a penny a point', value, 100);

  const settled = await loyaltyFor(org.id, customerId);
  check('and comes off the balance', settled.balance, after.balance - 100);

  console.info('\nReferrals');

  const other = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, id: { not: customerId } },
    select: { id: true },
  });

  const referral = await referralFor(org.id, customerId, user.id);
  check('a code was issued', referral.code.length, 6);

  const twice = await referralFor(org.id, customerId, user.id);
  check('and the same one comes back rather than a second', twice.code, referral.code);

  await refuses('a customer using their own code', () =>
    useReferral({ orgId: org.id, userId: user.id, code: referral.code, customerId }),
  );

  await useReferral({ orgId: org.id, userId: user.id, code: referral.code, customerId: other.id });

  await refuses('the same code used twice', () =>
    useReferral({ orgId: org.id, userId: user.id, code: referral.code, customerId: other.id }),
  );

  try {
    await creditReferral({ orgId: org.id, userId: user.id, referralId: referral.id });
    console.info('  ok     it paid, because that customer has invoices on record');

    await refuses('paying the same referral twice', () =>
      creditReferral({ orgId: org.id, userId: user.id, referralId: referral.id }),
    );
  } catch (error) {
    // A scheme that pays on sign-up pays for addresses. Refusing here is the
    // correct behaviour when the referred customer has not spent anything.
    check(
      'it refused to pay before they had work done',
      error instanceof LoyaltyError && error.code === 'NOT_SPENT',
      true,
    );
  }

  console.info('\nReplies coming in');

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { mobile: true, email: true },
  });

  const address = customer.mobile ?? customer.email ?? '';

  const quoted = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: address,
    body: `${PROBE}: yes go ahead with job ${job.number}`,
    providerRef: `vfy-${Date.now()}`,
  });

  const quotedRow = await prisma.inboundMessage.findUniqueOrThrow({
    where: { id: quoted!.id },
    select: { confidence: true, jobId: true, customerId: true },
  });

  check('a quoted job number is certain', quotedRow.confidence, 'CERTAIN');
  check('and it was filed against that job', quotedRow.jobId, job.id);

  const stranger = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: '+15550000000',
    body: `${PROBE}: hello?`,
    providerRef: `vfy-stranger-${Date.now()}`,
  });

  const strangerRow = await prisma.inboundMessage.findUniqueOrThrow({
    where: { id: stranger!.id },
    select: { confidence: true, customerId: true, jobId: true },
  });

  check('an address nobody uses is matched to nothing', strangerRow.confidence, 'NONE');
  check('and filed against nobody rather than guessed', strangerRow.customerId, null);

  const ref = `vfy-dupe-${Date.now()}`;

  const first = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: address,
    body: `${PROBE}: delivered twice`,
    providerRef: ref,
  });

  const second = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: address,
    body: `${PROBE}: delivered twice`,
    providerRef: ref,
  });

  // Every webhook retries. A duplicate reply reads as a customer repeating
  // themselves, which changes how somebody answers it.
  check('a message delivered twice is one row', first!.id, second!.id);

  const waiting = await inbox(org.id);
  const optOut = await receiveInbound({
    orgId: org.id,
    channel: 'SMS',
    fromAddress: address,
    body: 'STOP',
    providerRef: `vfy-stop-${Date.now()}`,
  });

  const ordered = await inbox(org.id);
  check('somebody asking to be left alone goes to the top', ordered[0]?.id, optOut!.id);
  check('and the inbox grew by one', ordered.length, waiting.length + 1);

  await handleInbound({
    orgId: org.id,
    userId: user.id,
    messageId: strangerRow ? stranger!.id : '',
    jobId: job.id,
  });

  const filed = await prisma.inboundMessage.findUniqueOrThrow({
    where: { id: stranger!.id },
    select: { jobId: true, customerId: true, confidence: true },
  });

  check('filing by hand attaches the customer too', filed.customerId, job.customerId);
  check('and marks it certain', filed.confidence, 'CERTAIN');

  console.info('\nCleaning up');

  await prisma.inboundMessage.deleteMany({ where: { body: { startsWith: PROBE } } });
  await prisma.inboundMessage.deleteMany({ where: { body: 'STOP' } });
  await prisma.loyaltyEntry.deleteMany({ where: { reason: { startsWith: PROBE } } });
  await prisma.loyaltyEntry.deleteMany({ where: { reason: { startsWith: 'Redeemed against' } } });
  await prisma.loyaltyEntry.deleteMany({ where: { reason: { startsWith: 'Referral,' } } });
  await prisma.referral.deleteMany({ where: { id: referral.id } });
  await prisma.messageLog.deleteMany({
    where: { relatedType: 'ReviewRequest', relatedId: asked.id },
  });
  await prisma.reviewRequest.deleteMany({ where: { id: asked.id } });

  const left = await prisma.inboundMessage.count({ where: { body: { startsWith: PROBE } } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0 ? '\nRetention behaved correctly.' : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
