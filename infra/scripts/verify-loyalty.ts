/**
 * Points, in the product, against a real database. Phase 24.
 *
 *   npx tsx infra/scripts/verify-loyalty.ts
 *
 * The arithmetic has had unit tests since Phase 5. What they cannot prove is
 * the part that costs a workshop money: points earned twice on one bill,
 * points earned on the points themselves, a redemption that lands in the
 * bank as though a customer had paid cash, or a customer's points spent
 * against a bill that then refused the payment.
 *
 * A job is opened, worked, completed and invoiced. Points are given by hand,
 * spent against the bill, the rest is paid by card, and after each step the
 * thing that must be true is checked: the balance is the sum of the entries,
 * the ledger booked the redemption as the programme's cost, the bill earned
 * once and only on the money actually paid, and every refusal refused.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design and stay as evidence.
 */

import 'dotenv/config';

import { ACCOUNT, LoyaltyError, money, MoneyCycleError, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import { createJob } from '../../apps/web/src/lib/jobs';
import {
  awardByHand,
  awardForInvoice,
  loyaltyCardFor,
  redeemAgainstInvoice,
  spendableAgainst,
} from '../../apps/web/src/lib/loyalty';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';

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

const TAG = 'Verify loyalty probe';

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
  const customerId = previous.customerId;

  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id, customerId);

  const opening = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances before anything happens', opening.balanced, true);

  console.info('\nPoints given by hand');

  const before = await loyaltyCardFor(org.id, customerId);

  await refuses('nothing, or a fraction of a point', LoyaltyError, 'NOTHING_TO_AWARD', () =>
    awardByHand({ orgId: org.id, userId: staff.id, customerId, points: 2.5, reason: TAG }),
  );
  await refuses('points without a reason', LoyaltyError, 'NOTHING_TO_AWARD', () =>
    awardByHand({ orgId: org.id, userId: staff.id, customerId, points: 50, reason: '   ' }),
  );
  await refuses('points to a customer of another workshop', LoyaltyError, 'NOTHING_TO_AWARD', () =>
    awardByHand({
      orgId: org.id,
      userId: staff.id,
      customerId: 'not-a-customer-here',
      points: 50,
      reason: TAG,
    }),
  );

  await awardByHand({
    orgId: org.id,
    userId: staff.id,
    customerId,
    points: 500,
    reason: `${TAG}: goodwill`,
  });

  const given = await loyaltyCardFor(org.id, customerId);
  check('five hundred points by hand', given.balance - before.balance, 500);
  check('worth five pounds', given.valueMinor - before.valueMinor, 500);
  check('with the reason on the entry', given.recent[0]?.reason, `${TAG}: goodwill`);

  console.info('\nA bill to put them against');

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId,
    vehicleId: previous.vehicleId,
    shortDescription: TAG,
  });

  await prisma.jobLabourLine.create({
    data: {
      jobId: job.id,
      description: 'Probe labour',
      hours: 2,
      rate: 60,
      taxRateId: vat?.id ?? null,
    },
  });

  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });

  const issued = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { number: true, total: true },
  });
  const totalMinor = Math.round(Number(issued.total) * 100);
  check('the invoice is for more than the points are worth', totalMinor > given.valueMinor, true);

  check(
    'what they can put towards it is what they hold',
    spendableAgainst(given.balance, totalMinor),
    given.balance,
  );
  check('and never more than the bill', spendableAgainst(given.balance, 120), 120);

  console.info('\nSpending them');

  await refuses('more points than they have', LoyaltyError, 'NOT_ENOUGH', () =>
    redeemAgainstInvoice({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      points: given.balance + 1_000,
    }),
  );
  await refuses('no points at all', LoyaltyError, 'NOTHING_TO_AWARD', () =>
    redeemAgainstInvoice({ orgId: org.id, userId: staff.id, invoiceId, points: 0 }),
  );

  const untouched = await loyaltyCardFor(org.id, customerId);
  check('a refusal spends nothing', untouched.balance, given.balance);

  const { valueMinor, paymentId } = await redeemAgainstInvoice({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    points: 300,
  });
  check('three hundred points are three pounds', valueMinor, 300);

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { method: true, amount: true, reference: true },
  });
  check('recorded as a payment of its own kind', payment.method, 'LOYALTY');
  check('for the value of the points', Number(payment.amount), 3);
  check('saying how many', payment.reference, '300 points');

  const partPaid = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, amountPaid: true },
  });
  check('the bill came down', Number(partPaid.amountPaid), 3);
  check('and is part paid', partPaid.status, 'PART_PAID');

  const spent = await loyaltyCardFor(org.id, customerId);
  check('the points came off the balance', given.balance - spent.balance, 300);

  // The ledger. Redeemed points are not cash: the debit is the cost of the
  // programme, and the customer's debt still comes down.
  const posting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Payment', sourceId: paymentId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check('the redemption was posted', Boolean(posting), true);
  check(
    'debiting loyalty rewards, not the bank',
    posting?.lines.find((line) => Number(line.debit) > 0)?.account.code,
    ACCOUNT.LOYALTY_REWARDS,
  );
  check(
    'and crediting what the customer owed',
    posting?.lines.find((line) => Number(line.credit) > 0)?.account.code,
    ACCOUNT.RECEIVABLE,
  );
  check(
    'nothing went to the bank',
    posting?.lines.some((line) => line.account.code === ACCOUNT.BANK) ?? true,
    false,
  );

  console.info('\nThe rest paid, and points earned on it');

  const owedMinor = totalMinor - 300;
  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: money(owedMinor, 'GBP'),
    method: 'CARD',
  });

  const paid = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true },
  });
  check('the invoice is paid', paid.status, 'PAID');

  const earned = await loyaltyCardFor(org.id, customerId);
  // A point a pound on what they actually paid, floored: the total less the
  // three pounds the programme itself paid.
  const expected = Math.floor(owedMinor / 100);
  check('a point a pound on the money actually paid', earned.balance - spent.balance, expected);
  check(
    'with the invoice named as the reason',
    earned.recent[0]?.reason,
    `Invoice ${issued.number} paid`,
  );

  const again = await awardForInvoice({ orgId: org.id, userId: staff.id, invoiceId });
  check('a second look at the same bill earns nothing', again, 0);
  const still = await loyaltyCardFor(org.id, customerId);
  check('and writes no row', still.balance, earned.balance);

  await refuses('points against a bill with nothing owed', LoyaltyError, 'NOT_ENOUGH', () =>
    redeemAgainstInvoice({ orgId: org.id, userId: staff.id, invoiceId, points: 10 }),
  );

  console.info('\nA bill that cannot be paid cannot take points');

  const draft = await prisma.invoice.create({
    data: {
      orgId: org.id,
      customerId,
      jobId: job.id,
      number: `${TAG} draft`,
      status: 'DRAFT',
      currency: 'GBP',
      subtotal: 10,
      taxTotal: 0,
      total: 10,
      amountPaid: 0,
    },
    select: { id: true },
  });
  await refuses('a draft refuses before a point is spent', MoneyCycleError, 'NOT_ISSUED', () =>
    redeemAgainstInvoice({ orgId: org.id, userId: staff.id, invoiceId: draft.id, points: 10 }),
  );
  const unspent = await loyaltyCardFor(org.id, customerId);
  check('and nothing was spent', unspent.balance, still.balance);

  const closing = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger still balances', closing.balanced, true);

  await forget(org.id, customerId);
  const after = await loyaltyCardFor(org.id, customerId);
  check('the probe left the balance as it found it', after.balance, before.balance);

  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string, customerId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);

  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, customerId, reason: { startsWith: TAG } },
  });
  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, customerId, reason: { startsWith: 'Redeemed against' } },
  });

  if (jobIds.length === 0) return;

  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true, number: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, reason: { in: invoices.map((i) => `Invoice ${i.number} paid`) } },
  });

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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
