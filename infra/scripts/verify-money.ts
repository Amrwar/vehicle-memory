/**
 * The money cycle, end to end, against a real database.
 *
 *   npx tsx infra/scripts/verify-money.ts
 *
 * A job is created, worked, completed, invoiced, part paid, paid, credited and
 * refunded, and after every step the thing that must be true is checked: the
 * ledger balanced and posted once, the statuses moved together, the customer
 * was told, and every refusal that protects a figure actually refused.
 *
 * Until this phase none of those steps could be taken from the product. The
 * seed wrote invoices and payments; no screen ever did. So this probe is not
 * a regression check on something that worked, it is the first proof that the
 * workshop can be paid.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design and stay as evidence.
 */

import 'dotenv/config';

import { JobTransitionError, money, MoneyCycleError, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import { createJob } from '../../apps/web/src/lib/jobs';
import {
  invoiceDetail,
  issueInvoice,
  moveJob,
  raiseCreditNote,
  recordPayment,
  recordRefund,
} from '../../apps/web/src/lib/money';

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

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');
const TAG = 'Verify money probe';

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  // A customer with an email, so the invoice message has somewhere to go, and
  // a vehicle they have had here before.
  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customer: { email: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true, customer: { select: { email: true } } },
  });

  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  // A stocked part with something on the shelf, so completion has stock to
  // consume and a cost to post.
  const stocked = await prisma.stockLevel.findFirstOrThrow({
    where: { product: { orgId: org.id, isActive: true }, onHand: { gte: 1 } },
    orderBy: { onHand: 'desc' },
    select: {
      productId: true,
      avgCost: true,
      onHand: true,
      warehouseId: true,
      product: { select: { partNumber: true, name: true, sellPrice: true } },
    },
  });

  // Leftovers from an interrupted run.
  await forget(org.id);

  const balanceBefore = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances before anything happens', balanceBefore.balanced, true);

  console.info('\nA job is opened and worked');

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: previous.customerId,
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

  await prisma.jobPartLine.create({
    data: {
      jobId: job.id,
      productId: stocked.productId,
      partNumber: stocked.product.partNumber,
      description: stocked.product.name,
      quantity: 1,
      unitPrice: Number(stocked.product.sellPrice) || 30,
      unitCost: 0,
      taxRateId: vat?.id ?? null,
      status: 'REQUESTED',
    },
  });

  await refuses('invoicing before the work is done', MoneyCycleError, 'NOT_COMPLETED', () =>
    issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id }),
  );

  await refuses(
    'completing a job that has not started',
    JobTransitionError,
    'ILLEGAL_TRANSITION',
    () => moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' }),
  );

  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });

  const started = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { status: true, startedAt: true, statusEvents: { select: { toStatus: true } } },
  });
  check('the work has started', started.status, 'IN_PROGRESS');
  check('at a recorded time', started.startedAt !== null, true);
  check(
    'with the move written to its history',
    started.statusEvents.some((e) => e.toStatus === 'IN_PROGRESS'),
    true,
  );

  const eventsBefore = await prisma.vehicleEvent.count({
    where: { vehicleId: previous.vehicleId },
  });

  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });

  const done = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: {
      status: true,
      completedAt: true,
      partLines: { select: { status: true, unitCost: true } },
    },
  });
  check('the job is completed', done.status, 'COMPLETED');
  check('the part was fitted', done.partLines[0]?.status, 'FITTED');

  // The margin is real only if the cost on the line is what the stock was
  // actually worth, not the zero the line started with.
  check('and carries the real cost', Number(done.partLines[0]?.unitCost) > 0, true);

  const level = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: stocked.productId, warehouseId: stocked.warehouseId },
    },
    select: { onHand: true },
  });
  check('one left the shelf', Number(stocked.onHand) - Number(level.onHand), 1);

  const eventsAfter = await prisma.vehicleEvent.count({ where: { vehicleId: previous.vehicleId } });
  check('the passport gained the job', eventsAfter > eventsBefore, true);

  const partsPosting = await prisma.journalEntry.count({
    where: { orgId: org.id, sourceType: 'Job', sourceId: job.id },
  });
  check('parts consumed were posted to the ledger', partsPosting, 1);

  console.info('\nThe invoice');

  const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });

  const issued = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      number: true,
      status: true,
      total: true,
      taxTotal: true,
      dueAt: true,
      lines: true,
      job: { select: { status: true } },
    },
  });

  check('it has a number from the sequence', /^INV-\d+$/.test(issued.number), true);
  check('it is issued', issued.status, 'ISSUED');
  check('with a due date', issued.dueAt !== null, true);
  check('and one line per job line', issued.lines.length, 2);
  check('the job moved with it', issued.job?.status, 'INVOICED');

  // Labour 2h at 60 is 120 net, the part at its price; 20% on both.
  const expectedNet = 120 + (Number(stocked.product.sellPrice) || 30);
  const expectedTax = vat ? Math.round(expectedNet * Number(vat.rate)) / 100 : 0;
  check(
    'the total is the lines plus tax',
    Number(issued.total),
    Math.round((expectedNet + expectedTax) * 100) / 100,
  );

  await refuses('invoicing the same job twice', MoneyCycleError, 'ALREADY_INVOICED', () =>
    issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id }),
  );

  const invoicePosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Invoice', sourceId: invoiceId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check('the invoice was posted', Boolean(invoicePosting), true);
  check(
    'receivable was debited for the full amount',
    Number(invoicePosting?.lines.find((l) => l.account.code === '1100')?.debit),
    Number(issued.total),
  );
  check(
    'and revenue split by kind',
    invoicePosting?.lines.filter(
      (l) => ['4000', '4010'].includes(l.account.code) && Number(l.credit) > 0,
    ).length,
    2,
  );

  const told = await prisma.messageLog.findFirst({
    where: { orgId: org.id, relatedType: 'Invoice', relatedId: invoiceId },
    select: { toAddress: true, status: true, body: true },
  });
  check('the customer was told, at their address', told?.toAddress, previous.customer.email);
  check('and it did not wait for the sweep', told?.status !== 'QUEUED', true);
  check('the message names the invoice', told?.body.includes(issued.number), true);

  console.info('\nBeing paid');

  const total = Number(issued.total);

  await refuses('more than is owed', MoneyCycleError, 'OVERPAYMENT', () =>
    recordPayment({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      amount: gbp(total + 0.01),
      method: 'CARD',
    }),
  );

  await refuses('nothing at all', MoneyCycleError, 'NOT_POSITIVE', () =>
    recordPayment({ orgId: org.id, userId: staff.id, invoiceId, amount: gbp(0), method: 'CASH' }),
  );

  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: gbp(50),
    method: 'CASH',
  });

  const partPaid = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, amountPaid: true, job: { select: { status: true } } },
  });
  check('a part payment leaves the invoice part paid', partPaid.status, 'PART_PAID');
  check('and records what came in', Number(partPaid.amountPaid), 50);
  check('the job is still invoiced, not paid', partPaid.job?.status, 'INVOICED');

  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: gbp(Math.round((total - 50) * 100) / 100),
    method: 'CARD',
    reference: 'TERMINAL-0001',
  });

  const paid = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, amountPaid: true, job: { select: { status: true } } },
  });
  check('the balance settles it', paid.status, 'PAID');
  check('to the penny', Number(paid.amountPaid), total);
  check('and the job is paid', paid.job?.status, 'PAID');

  const paymentPostings = await prisma.journalEntry.findMany({
    where: { orgId: org.id, sourceType: 'Payment' },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  const cashPosting = paymentPostings.find((e) =>
    e.lines.some((l) => l.account.code === '1010' && Number(l.debit) === 50),
  );
  check('cash went to the cash account', Boolean(cashPosting), true);

  await refuses('paying a settled invoice', MoneyCycleError, 'OVERPAYMENT', () =>
    recordPayment({ orgId: org.id, userId: staff.id, invoiceId, amount: gbp(1), method: 'CASH' }),
  );

  console.info('\nPutting something right');

  await refuses('a credit note with no reason', MoneyCycleError, 'NO_REASON', () =>
    raiseCreditNote({ orgId: org.id, userId: staff.id, invoiceId, amount: gbp(20), reason: '  ' }),
  );

  await refuses('a credit note for more than the invoice', MoneyCycleError, 'OVER_CREDIT', () =>
    raiseCreditNote({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      amount: gbp(total + 1),
      reason: 'Too much',
    }),
  );

  await refuses('a refund before any credit exists', MoneyCycleError, 'NO_CREDIT', () =>
    recordRefund({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      creditNoteId: 'none',
      amount: gbp(10),
      method: 'CASH',
    }),
  );

  const creditNoteId = await raiseCreditNote({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: gbp(24),
    reason: `${TAG}: part was under warranty`,
  });

  const note = await prisma.creditNote.findUniqueOrThrow({
    where: { id: creditNoteId },
    select: { number: true },
  });
  check('the credit note has a number', /^CN-\d+$/.test(note.number), true);

  const creditPosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'CreditNote', sourceId: creditNoteId },
    include: { lines: true },
  });
  const debits = creditPosting?.lines.reduce((t, l) => t + Number(l.debit), 0) ?? 0;
  const credits = creditPosting?.lines.reduce((t, l) => t + Number(l.credit), 0) ?? 0;
  check(
    'the credit note posted and balances to the penny',
    Math.round(debits * 100),
    Math.round(credits * 100),
  );
  check('for exactly the credit', Math.round(credits * 100), 2400);

  const afterCredit = await invoiceDetail(org.id, invoiceId);
  check('the invoice stays settled', afterCredit?.invoice.status, 'PAID');
  check('and the customer is owed the credit back', afterCredit?.money.owedBack.minor, 2400);

  await refuses('a refund for more than the credit', MoneyCycleError, 'OVER_REFUND', () =>
    recordRefund({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      creditNoteId,
      amount: gbp(24.01),
      method: 'BANK_TRANSFER',
    }),
  );

  const refundId = await recordRefund({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    creditNoteId,
    amount: gbp(24),
    method: 'BANK_TRANSFER',
    reference: 'FP-PROBE',
  });

  await refuses('refunding the same credit twice', MoneyCycleError, 'OVER_REFUND', () =>
    recordRefund({
      orgId: org.id,
      userId: staff.id,
      invoiceId,
      creditNoteId,
      amount: gbp(1),
      method: 'CASH',
    }),
  );

  const afterRefund = await invoiceDetail(org.id, invoiceId);
  check('nothing is owed back any more', afterRefund?.money.owedBack.minor, 0);

  // This run's refund, by id. `findFirst` on sourceType returned whichever
  // refund the database happened to hand back, which on a database this probe
  // had already run against was a previous run's — and passed, because every
  // run refunds the same 24. A check that would pass without the code under
  // it having run is not checking anything.
  const refundPosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'Refund', sourceId: refundId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'the refund left the bank',
    Number(refundPosting?.lines.find((l) => l.account.code === '1000')?.credit),
    24,
  );

  // About *this* credit and *this* refund. Counting every message ever sent to
  // that address meant the answer grew by two on every run: two on the first,
  // four on the second, and a red probe that said nothing about the code.
  const toldTwice = await prisma.messageLog.count({
    where: {
      orgId: org.id,
      toAddress: previous.customer.email!,
      OR: [
        { relatedType: 'CreditNote', relatedId: creditNoteId },
        { relatedType: 'Refund', relatedId: refundId },
      ],
    },
  });
  check('the customer was told about the credit and the refund', toldTwice, 2);

  console.info('\nThe ledger, afterwards');

  const balanceAfter = trialBalance(await postedLines(org.id, ALL_TIME));
  check('still balances', balanceAfter.balanced, true);

  console.info('\nThe database, underneath it');

  const refundRow = await prisma.refund.findFirstOrThrow({
    where: { invoiceId },
    select: { id: true },
  });

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "refunds" SET "amount" = 0 WHERE "id" = '${refundRow.id}'`,
    );
    failures += 1;
    console.error('  FAIL   a refund of nothing was accepted');
  } catch (error) {
    check('a refund of nothing', String(error).includes('refunds_amount_is_positive'), true);
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "refunds" SET "reason" = '  ' WHERE "id" = '${refundRow.id}'`,
    );
    failures += 1;
    console.error('  FAIL   a refund with no reason was accepted');
  } catch (error) {
    check('a refund with no reason', String(error).includes('refunds_reason_is_given'), true);
  }

  console.info('\nClearing up');

  await forget(org.id);

  // The stock that left the shelf goes back, so the next run and the stock
  // probe see what the seed put there.
  await prisma.stockLevel.update({
    where: {
      productId_warehouseId: { productId: stocked.productId, warehouseId: stocked.warehouseId },
    },
    data: { onHand: stocked.onHand },
  });

  const left = await prisma.job.count({ where: { orgId: org.id, shortDescription: TAG } });
  check('the probe left nothing behind', left, 0);

  console.info(failures === 0 ? '\nThe workshop can be paid.' : `\n${failures} check(s) FAILED.`);

  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length === 0) return;

  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const notes = await prisma.creditNote.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const refunds = await prisma.refund.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });

  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...notes.map((n) => ({ sourceType: 'CreditNote', sourceId: n.id })),
    ...refunds.map((r) => ({ sourceType: 'Refund', sourceId: r.id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
  ];

  for (const source of sources) {
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  }

  await prisma.messageLog.deleteMany({
    where: {
      orgId,
      relatedId: { in: [...invoiceIds, ...notes.map((n) => n.id), ...refunds.map((r) => r.id)] },
    },
  });
  await prisma.refund.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.creditNote.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.stockMovement.deleteMany({
    where: { orgId, referenceType: 'Job', referenceId: { in: jobIds } },
  });
  await prisma.stockReservation.deleteMany({ where: { jobPartLine: { jobId: { in: jobIds } } } });
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
