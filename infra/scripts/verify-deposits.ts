/**
 * Money held for a customer, against a real database. Phase 30.
 *
 *   npx tsx infra/scripts/verify-deposits.ts
 *
 * A deposit is taken before the work and the books show it as owed, not
 * earned. The invoice takes it as a payment of its own kind that releases
 * the liability without touching the bank. Part of a bill is credited and
 * the refund is kept on account, which becomes credit the next bill takes.
 * Money held goes back with a reason, the way money goes. Every payment
 * produces a receipt the customer can hold. Every refusal is tried.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design and stay as evidence.
 */

import 'dotenv/config';

import { ACCOUNT, DepositError, money, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { postedLines } from '../../apps/web/src/lib/accounting';
import {
  applyHeld,
  heldFor,
  heldInAll,
  receiptFor,
  returnHeld,
  takeDeposit,
} from '../../apps/web/src/lib/deposits';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob, raiseCreditNote, recordRefund } from '../../apps/web/src/lib/money';

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

const TAG = 'Verify deposits probe';

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

  const opening = trialBalance(await postedLines(org.id));
  check('the ledger balances before anything happens', opening.balanced, true);
  const before = await heldInAll(org.id);

  console.info('\nA deposit before the work');

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId,
    vehicleId: previous.vehicleId,
    shortDescription: TAG,
  });

  await refuses('nothing', DepositError, 'NOT_POSITIVE', () =>
    takeDeposit({ orgId: org.id, userId: staff.id, customerId, amountMinor: 0, method: 'CARD' }),
  );
  await refuses('paid with points', DepositError, 'BAD_METHOD', () =>
    takeDeposit({
      orgId: org.id,
      userId: staff.id,
      customerId,
      amountMinor: 5_000,
      method: 'LOYALTY',
    }),
  );
  await refuses('for somebody else’s job', DepositError, 'NOT_FOUND', () =>
    takeDeposit({
      orgId: org.id,
      userId: staff.id,
      customerId,
      jobId: 'not-a-job',
      amountMinor: 5_000,
      method: 'CARD',
    }),
  );

  const deposit = await takeDeposit({
    orgId: org.id,
    userId: staff.id,
    customerId,
    jobId: job.id,
    amountMinor: 10_000,
    method: 'CARD',
    reference: TAG,
  });

  const held = await heldFor(org.id, customerId);
  check('a hundred pounds held', held.heldMinor, 10_000);
  check('as a deposit, for the job', held.live[0]?.job?.id, job.id);
  check('reading as held', held.live[0]?.status, 'HELD');

  const taken = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Deposit', sourceId: deposit.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check('the deposit was posted', Boolean(taken), true);
  check(
    'money into the bank',
    taken?.lines.find((l) => Number(l.debit) > 0)?.account.code,
    ACCOUNT.BANK,
  );
  check(
    'owed as work, not booked as revenue',
    taken?.lines.find((l) => Number(l.credit) > 0)?.account.code,
    ACCOUNT.DEPOSITS,
  );

  console.info('\nThe invoice takes it');

  await prisma.jobLabourLine.create({
    data: {
      jobId: job.id,
      description: 'Probe labour',
      hours: 3,
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
  check('the bill is more than the deposit', totalMinor > 10_000, true);

  await refuses('more than is held', DepositError, 'MORE_THAN_HELD', () =>
    applyHeld({ orgId: org.id, userId: staff.id, invoiceId, amountMinor: 10_001 }),
  );
  const untouched = await heldFor(org.id, customerId);
  check('a refusal moves nothing', untouched.heldMinor, 10_000);

  const applied = await applyHeld({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amountMinor: null,
  });
  check('the whole deposit went against the bill', applied.amountMinor, 10_000);
  check('as one payment', applied.paymentIds.length, 1);

  const partPaid = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, amountPaid: true, payments: { select: { method: true } } },
  });
  check('the bill is part paid', partPaid.status, 'PART_PAID');
  check('by exactly that', Math.round(Number(partPaid.amountPaid) * 100), 10_000);
  check('by a payment of its own kind', partPaid.payments[0]?.method, 'DEPOSIT');

  const release = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Payment', sourceId: applied.paymentIds[0] },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'the payment released the liability',
    release?.lines.find((l) => Number(l.debit) > 0)?.account.code,
    ACCOUNT.DEPOSITS,
  );
  check(
    'against what the customer owed',
    release?.lines.find((l) => Number(l.credit) > 0)?.account.code,
    ACCOUNT.RECEIVABLE,
  );
  check(
    'without touching the bank twice',
    release?.lines.some((l) => l.account.code === ACCOUNT.BANK) ?? true,
    false,
  );

  const spent = await heldFor(org.id, customerId);
  check('nothing is held now', spent.heldMinor, 0);
  check('the deposit reads as used', spent.rows.find((r) => r.id === deposit.id)?.status, 'USED');

  await refuses('using money held when none is', DepositError, 'NOTHING_HELD', () =>
    applyHeld({ orgId: org.id, userId: staff.id, invoiceId, amountMinor: null }),
  );

  console.info('\nA receipt for the payment');

  const receipt = await receiptFor(org.id, applied.paymentIds[0]!);
  check('the receipt names the customer', Boolean(receipt?.customer.displayName), true);
  check('and the invoice', receipt?.invoice?.number, issued.number);
  check('for the amount', receipt?.amountMinor, 10_000);
  check('and what is still owed', receipt?.outstandingMinor, totalMinor - 10_000);

  const told = await prisma.messageLog.findFirst({
    where: { orgId: org.id, relatedType: 'Payment', relatedId: applied.paymentIds[0] },
    select: { subject: true, body: true },
  });
  check('the customer was sent a receipt', told?.subject.startsWith('Receipt R-') ?? false, true);
  check('naming the invoice', told?.body.includes(issued.number) ?? false, true);

  console.info('\nA refund kept as credit, and spent on the next bill');

  const noteId = await raiseCreditNote({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: money(2_000, 'GBP'),
    reason: `${TAG}: part not fitted`,
  });
  await recordRefund({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    creditNoteId: noteId,
    amount: money(2_000, 'GBP'),
    method: 'DEPOSIT',
  });
  const credited = await heldFor(org.id, customerId);
  check('twenty pounds are held as credit', credited.heldMinor, 2_000);
  check('of kind credit', credited.live[0]?.kind, 'CREDIT');

  const refundRow = await prisma.refund.findFirst({
    where: { invoiceId },
    select: { id: true },
  });
  const refundPosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Refund', sourceId: refundRow?.id ?? '' },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'the refund raised the deposits liability, not the bank',
    refundPosting?.lines.find((l) => Number(l.credit) > 0)?.account.code,
    ACCOUNT.DEPOSITS,
  );

  const second = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId,
    vehicleId: previous.vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobLabourLine.create({
    data: {
      jobId: second.id,
      description: 'Probe labour',
      hours: 1,
      rate: 60,
      taxRateId: vat?.id ?? null,
    },
  });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: second.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: second.id, to: 'COMPLETED' });
  const secondInvoice = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: second.id });
  const usedCredit = await applyHeld({
    orgId: org.id,
    userId: staff.id,
    invoiceId: secondInvoice,
    amountMinor: null,
  });
  check('the credit went against the next bill', usedCredit.amountMinor, 2_000);

  console.info('\nMoney held going back');

  const late = await takeDeposit({
    orgId: org.id,
    userId: staff.id,
    customerId,
    amountMinor: 3_000,
    method: 'CASH',
    reference: TAG,
  });
  await refuses('more than is held', DepositError, 'MORE_THAN_HELD', () =>
    returnHeld({
      orgId: org.id,
      userId: staff.id,
      depositId: late.id,
      amountMinor: 3_001,
      method: 'CASH',
      reason: 'x',
    }),
  );
  await refuses('without a reason', DepositError, 'NO_REASON', () =>
    returnHeld({
      orgId: org.id,
      userId: staff.id,
      depositId: late.id,
      amountMinor: 1_000,
      method: 'CASH',
      reason: ' ',
    }),
  );
  await returnHeld({
    orgId: org.id,
    userId: staff.id,
    depositId: late.id,
    amountMinor: 3_000,
    method: 'CASH',
    reason: 'Order cancelled',
  });
  const afterReturn = await heldFor(org.id, customerId);
  check('nothing held after it went back', afterReturn.heldMinor, 0);
  check('reading as returned', afterReturn.rows.find((r) => r.id === late.id)?.status, 'RETURNED');

  const closing = trialBalance(await postedLines(org.id));
  check('the ledger still balances', closing.balanced, true);

  await forget(org.id, customerId);
  const after = await heldInAll(org.id);
  check('the probe left the workshop holding what it did', after.heldMinor, before.heldMinor);

  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string, customerId: string) {
  const deposits = await prisma.deposit.findMany({
    where: { orgId, customerId, OR: [{ reference: TAG }, { note: { contains: TAG } }] },
    select: { id: true, movements: { select: { id: true } } },
  });
  for (const d of deposits) {
    await prisma.journalEntry.deleteMany({
      where: { orgId, sourceType: 'Deposit', sourceId: d.id },
    });
    await prisma.journalEntry.deleteMany({
      where: {
        orgId,
        sourceType: 'DepositMovement',
        sourceId: { in: d.movements.map((m) => m.id) },
      },
    });
  }
  await prisma.deposit.deleteMany({ where: { id: { in: deposits.map((d) => d.id) } } });

  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true, number: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const notes = await prisma.creditNote.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const refunds = await prisma.refund.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  // credits born of those refunds
  const credits = await prisma.deposit.findMany({
    where: { sourceRefundId: { in: refunds.map((r) => r.id) } },
    select: { id: true, movements: { select: { id: true } } },
  });
  for (const c of credits) {
    await prisma.journalEntry.deleteMany({
      where: {
        orgId,
        sourceType: 'DepositMovement',
        sourceId: { in: c.movements.map((m) => m.id) },
      },
    });
  }
  await prisma.deposit.deleteMany({ where: { id: { in: credits.map((c) => c.id) } } });
  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
    ...notes.map((n) => ({ sourceType: 'CreditNote', sourceId: n.id })),
    ...refunds.map((r) => ({ sourceType: 'Refund', sourceId: r.id })),
  ];
  for (const source of sources) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }
  await prisma.loyaltyEntry.deleteMany({
    where: { orgId, reason: { in: invoices.map((i) => `Invoice ${i.number} paid`) } },
  });
  await prisma.messageLog.deleteMany({
    where: {
      orgId,
      relatedId: {
        in: [
          ...invoiceIds,
          ...notes.map((n) => n.id),
          ...refunds.map((r) => r.id),
          ...payments.map((p) => p.id),
        ],
      },
    },
  });
  await prisma.refund.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
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
