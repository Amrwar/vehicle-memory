/**
 * Referrals, in the product, against a real database. Phase 25.
 *
 *   npx tsx infra/scripts/verify-referrals.ts
 *
 * The rules had unit tests since Phase 5. What they could not prove is the
 * part that costs money or trust: a referral paid on a sign-up, paid twice,
 * paid to the same person on both sides, or never paid because nobody
 * remembered to press anything.
 *
 * A customer is brought in with another customer's code. Their first bill is
 * too small to count and pays nobody; their second crosses the line, and the
 * moment it is paid both sides are credited without a button. Then every
 * refusal is tried, and the probe puts everything back.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design and stay as evidence.
 */

import 'dotenv/config';

import { LoyaltyError, money, REFERRAL_MINIMUM_MINOR } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import { loyaltyCardFor } from '../../apps/web/src/lib/loyalty';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';
import {
  checkCode,
  redeemCode,
  referralCardFor,
  REFERRAL_POINTS,
  settleReferralsFor,
} from '../../apps/web/src/lib/referrals';

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

async function refuses(
  label: string,
  kind: new (...args: never[]) => Error,
  code: string,
  run: () => Promise<unknown>,
) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof kind && actual === code) {
      console.info(`  ok     ${label}: ${code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const TAG = 'Verify referrals probe';

/** A job worth this many pounds of labour, completed, invoiced and paid by card. */
async function billAndPay(input: {
  orgId: string;
  userId: string;
  customerId: string;
  vehicleId: string;
  hours: number;
  taxRateId: string | null;
}): Promise<number> {
  const job = await createJob({
    orgId: input.orgId,
    userId: input.userId,
    locationId: null,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobLabourLine.create({
    data: {
      jobId: job.id,
      description: 'Probe labour',
      hours: input.hours,
      rate: 40,
      taxRateId: input.taxRateId,
    },
  });
  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: input.orgId, userId: input.userId, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({
    orgId: input.orgId,
    userId: input.userId,
    jobId: job.id,
  });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true },
  });
  const totalMinor = Math.round(Number(invoice.total) * 100);
  await recordPayment({
    orgId: input.orgId,
    userId: input.userId,
    invoiceId,
    amount: money(totalMinor, 'GBP'),
    method: 'CARD',
  });
  return totalMinor;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true },
  });
  const referrerId = previous.customerId;
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id, referrerId);

  // Codes the referrer already had, so the probe can leave only those behind.
  const codesBefore = new Set(
    (
      await prisma.referral.findMany({
        where: { orgId: org.id, referrerCustomerId: referrerId },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  console.info('\nA code to hand out');

  const referrer = await referralCardFor(org.id, referrerId, staff.id);
  check('the customer has a six-character code', referrer.code.length, 6);
  const again = await referralCardFor(org.id, referrerId, staff.id);
  check('and the same one every time it is looked at', again.code, referrer.code);
  check('the rule is stated in points', referrer.pointsEachSide, REFERRAL_POINTS);
  check('and in pounds', referrer.minimumMinor, REFERRAL_MINIMUM_MINOR);

  console.info('\nCodes that are refused');

  await refuses('something that is not a code', LoyaltyError, 'NOT_SPENT', () =>
    checkCode(org.id, 'hello!'),
  );
  await refuses('a code nobody has', LoyaltyError, 'NOT_SPENT', () => checkCode(org.id, 'BCDFGH'));
  await refuses('a customer using their own code', LoyaltyError, 'SELF_REFERRAL', () =>
    redeemCode({ orgId: org.id, userId: staff.id, customerId: referrerId, code: referrer.code }),
  );

  console.info('\nSomebody arrives with it');

  const newcomer = await prisma.customer.create({
    data: {
      orgId: org.id,
      kind: 'INDIVIDUAL',
      displayName: TAG,
      firstName: 'Verify',
      lastName: 'Referrals',
    },
    select: { id: true },
  });

  const referrerBefore = await loyaltyCardFor(org.id, referrerId);
  const newcomerBefore = await loyaltyCardFor(org.id, newcomer.id);

  const used = await redeemCode({
    orgId: org.id,
    userId: staff.id,
    customerId: newcomer.id,
    code: ` ${referrer.code.toLowerCase()} `,
  });
  check('the code took, however it was typed', typeof used.referralId, 'string');
  check('and paid nobody on a sign-up', used.credited, false);

  await refuses('the same code a second time', LoyaltyError, 'ALREADY_CREDITED', () =>
    checkCode(org.id, referrer.code),
  );
  await refuses('a second introduction for the same person', LoyaltyError, 'ALREADY_CREDITED', () =>
    redeemCode({ orgId: org.id, userId: staff.id, customerId: newcomer.id, code: referrer.code }),
  );

  const newcomerCard = await referralCardFor(org.id, newcomer.id, staff.id);
  check(
    'the newcomer knows who introduced them',
    newcomerCard.introducedBy?.referrer.id,
    referrerId,
  );
  check('and that it is not paid yet', newcomerCard.introducedBy?.creditedAt ?? null, null);

  const referrerCard = await referralCardFor(org.id, referrerId, staff.id);
  check('the referrer lists them', referrerCard.made[0]?.referred?.id, newcomer.id);
  check('waiting', referrerCard.made[0]?.creditedAt ?? null, null);
  check('and has a fresh code to hand out', referrerCard.code !== referrer.code, true);

  console.info('\nA first bill too small to count');

  // Half an hour at forty pounds: under the line even with tax on it.
  const small = await billAndPay({
    orgId: org.id,
    userId: staff.id,
    customerId: newcomer.id,
    vehicleId: previous.vehicleId,
    hours: 0.5,
    taxRateId: vat?.id ?? null,
  });
  check('the bill is under the line', small < REFERRAL_MINIMUM_MINOR, true);

  const referrerAfterSmall = await loyaltyCardFor(org.id, referrerId);
  check('the referrer was not paid', referrerAfterSmall.balance, referrerBefore.balance);
  const newcomerAfterSmall = await loyaltyCardFor(org.id, newcomer.id);
  check(
    'the newcomer earned only the points on the bill',
    newcomerAfterSmall.balance - newcomerBefore.balance,
    Math.floor(small / 100),
  );

  console.info('\nA second bill that crosses it');

  const big = await billAndPay({
    orgId: org.id,
    userId: staff.id,
    customerId: newcomer.id,
    vehicleId: previous.vehicleId,
    hours: 2,
    taxRateId: vat?.id ?? null,
  });
  check('together they are over the line', small + big >= REFERRAL_MINIMUM_MINOR, true);

  const referrerPaid = await loyaltyCardFor(org.id, referrerId);
  check(
    'the referrer was paid the moment it was',
    referrerPaid.balance - referrerBefore.balance,
    REFERRAL_POINTS,
  );
  check(
    'with the reason on the entry',
    referrerPaid.recent[0]?.reason,
    'Referral, for introducing somebody',
  );

  const newcomerPaid = await loyaltyCardFor(org.id, newcomer.id);
  check(
    'and so was the newcomer, on top of the bill',
    newcomerPaid.balance - newcomerAfterSmall.balance,
    REFERRAL_POINTS + Math.floor(big / 100),
  );

  const settled = await referralCardFor(org.id, referrerId, staff.id);
  check('the referrer sees it paid', settled.made[0]?.creditedAt !== null, true);
  check('with the points on the referral', settled.made[0]?.points, REFERRAL_POINTS);

  const twice = await settleReferralsFor({
    orgId: org.id,
    userId: staff.id,
    customerId: newcomer.id,
  });
  check('a second look pays nothing', twice, 0);
  const referrerStill = await loyaltyCardFor(org.id, referrerId);
  check('and the balance stays put', referrerStill.balance, referrerPaid.balance);

  await forget(org.id, referrerId, codesBefore);
  const referrerAfter = await loyaltyCardFor(org.id, referrerId);
  check(
    'the probe left the referrer as it found them',
    referrerAfter.balance,
    referrerBefore.balance,
  );

  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string, referrerId: string, keepCodes?: Set<string>) {
  const probes = await prisma.customer.findMany({
    where: { orgId, displayName: TAG },
    select: { id: true },
  });
  const probeIds = probes.map((c) => c.id);

  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);

  if (jobIds.length > 0) {
    const invoices = await prisma.invoice.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);
    const payments = await prisma.payment.findMany({
      where: { invoiceId: { in: invoiceIds } },
      select: { id: true },
    });
    const sources = [
      ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
      ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
      ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
    ];
    for (const source of sources) {
      await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
    }
    await prisma.messageLog.deleteMany({ where: { orgId, relatedId: { in: invoiceIds } } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.outboxEvent.deleteMany({
      where: {
        orgId,
        type: { in: ['job.completed', 'invoice.issued', 'payment.received'] },
        processedAt: null,
      },
    });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  }

  // The referral's credit, on both sides, and the referral itself.
  const referrals = await prisma.referral.findMany({
    where: { orgId, referredCustomerId: { in: probeIds } },
    select: { id: true, creditedAt: true },
  });
  for (const referral of referrals) {
    if (referral.creditedAt) {
      await prisma.loyaltyEntry.deleteMany({
        where: {
          orgId,
          customerId: referrerId,
          reason: 'Referral, for introducing somebody',
          createdAt: { gte: new Date(referral.creditedAt.getTime() - 60_000) },
        },
      });
    }
  }
  await prisma.referral.deleteMany({ where: { id: { in: referrals.map((r) => r.id) } } });

  if (keepCodes) {
    await prisma.referral.deleteMany({
      where: {
        orgId,
        referrerCustomerId: referrerId,
        referredCustomerId: null,
        id: { notIn: [...keepCodes] },
      },
    });
  }

  if (probeIds.length > 0) {
    await prisma.loyaltyEntry.deleteMany({ where: { customerId: { in: probeIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: probeIds } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
