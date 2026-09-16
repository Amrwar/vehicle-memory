import {
  assertDepositApplicable,
  assertDepositReturnable,
  assertDepositTakeable,
  assertPaymentRecordable,
  DepositError,
  type DepositStatus,
  depositStatus,
  fromDecimal,
  heldOn,
  type InvoiceState,
  money,
  postDepositReturned,
  postDepositTaken,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts, postEntry } from './accounting';
import { audit } from './guard';
import { recordPayment } from './money';
import { regionFor } from './region';

export { keepAsCredit } from './deposit-credits';
export { DepositError };

/**
 * Money held for a customer. Phase 30.
 *
 * A deposit taken before the work, or a credit kept on account after a
 * refund. Both are a liability until they go against an invoice or back to
 * the customer, and both are put against a bill as a payment of their own
 * kind, DEPOSIT, which releases the liability rather than touching the bank
 * a second time. What is held is never stored: it is what came in less what
 * went out, and every movement says what it was for.
 */

const minor = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);

const ROW = {
  id: true,
  kind: true,
  amount: true,
  appliedAmount: true,
  refundedAmount: true,
  currency: true,
  method: true,
  reference: true,
  note: true,
  receivedAt: true,
  jobId: true,
  customerId: true,
  job: { select: { id: true, number: true } },
  takenBy: { select: { name: true } },
} as const;

function shape<
  T extends {
    amount: { toString(): string };
    appliedAmount: { toString(): string };
    refundedAmount: { toString(): string };
  },
>(row: T) {
  const figures = {
    amountMinor: minor(row.amount),
    appliedMinor: minor(row.appliedAmount),
    refundedMinor: minor(row.refundedAmount),
  };
  return {
    ...row,
    ...figures,
    heldMinor: heldOn(figures),
    status: depositStatus(figures) as DepositStatus,
  };
}

/** Takes a deposit: a row, a ledger posting, an audit line, and a word to the customer. *
 * @repeat GUARDED(KEY: the form key its callers hand to once) Two deposits
 * of the same amount from one customer are legitimate, so the form the press
 * came from is the only thing that can tell a repeat from a second deposit.
 */
export async function takeDeposit(input: {
  orgId: string;
  userId: string;
  customerId: string;
  jobId?: string | null;
  amountMinor: number;
  method: string;
  reference?: string | null;
  note?: string | null;
}): Promise<{ id: string }> {
  assertDepositTakeable({ amountMinor: input.amountMinor, method: input.method });

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true, displayName: true },
  });
  if (!customer) throw new DepositError('NOT_FOUND', 'That customer is not in this workshop.');

  if (input.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId, customerId: customer.id },
      select: { id: true },
    });
    if (!job) throw new DepositError('NOT_FOUND', 'That job is not this customer’s.');
  }

  const region = await regionFor(input.orgId);
  await ensureChartOfAccounts(input.orgId);
  const receivedAt = new Date();

  const deposit = await prisma.deposit.create({
    data: {
      orgId: input.orgId,
      customerId: customer.id,
      jobId: input.jobId ?? null,
      kind: 'DEPOSIT',
      amount: input.amountMinor / 100,
      currency: region.currency,
      method: input.method as 'CARD',
      reference: input.reference?.trim() || null,
      note: input.note?.trim() || null,
      receivedAt,
      takenByUserId: input.userId,
    },
    select: { id: true },
  });

  await postEntry(
    input.orgId,
    postDepositTaken({
      depositId: deposit.id,
      reference: `DEP/${deposit.id.slice(-6).toUpperCase()}`,
      amount: money(input.amountMinor, region.currency),
      method: input.method as 'CARD',
      at: receivedAt,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'deposit.taken',
    entityType: 'Customer',
    entityId: customer.id,
    after: { depositId: deposit.id, amountMinor: input.amountMinor, method: input.method },
  });

  return deposit;
}

/** Everything held for a customer, and the total. */
export async function heldFor(orgId: string, customerId: string) {
  const rows = await prisma.deposit.findMany({
    where: { orgId, customerId },
    orderBy: { receivedAt: 'desc' },
    take: 50,
    select: ROW,
  });
  const shaped = rows.map(shape);
  return {
    rows: shaped,
    heldMinor: shaped.reduce((total, row) => total + Math.max(0, row.heldMinor), 0),
    live: shaped.filter((row) => row.heldMinor > 0),
  };
}

/**
 * Money held goes against a bill. Oldest held first unless a particular
 * deposit is named, and never more than is held or owed. Each slice is a
 * payment of kind DEPOSIT and a movement on the deposit it came from, so
 * both the bill and the deposit can explain themselves.
 *
 * @repeat GUARDED(KEY: the form key its callers hand to once) Applied
 * twice, the same held money would come off the bill twice; the key stops
 * the press, and the bill refuses anything beyond what is owed.
 */
export async function applyHeld(input: {
  orgId: string;
  userId: string;
  invoiceId: string;
  depositId?: string | null;
  /** Null means as much as the bill needs. */
  amountMinor: number | null;
}): Promise<{ amountMinor: number; paymentIds: string[] }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      amountPaid: true,
      currency: true,
      customerId: true,
    },
  });
  if (!invoice) throw new DepositError('NOT_FOUND', 'That invoice is not in this workshop.');

  const held = await heldFor(input.orgId, invoice.customerId);
  const sources = input.depositId
    ? held.live.filter((row) => row.id === input.depositId)
    : [...held.live].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  if (input.depositId && sources.length === 0) {
    throw new DepositError(
      'NOT_FOUND',
      'That deposit is not this customer’s, or nothing is left on it.',
    );
  }

  const owedMinor = minor(invoice.total) - minor(invoice.amountPaid);
  const available = sources.reduce((total, row) => total + row.heldMinor, 0);
  const amountMinor = assertDepositApplicable({
    heldMinor: available,
    amountMinor: input.amountMinor,
    owedMinor,
  });

  assertPaymentRecordable(
    {
      status: invoice.status as InvoiceState,
      total: fromDecimal(invoice.total.toString(), invoice.currency),
      amountPaid: fromDecimal(invoice.amountPaid.toString(), invoice.currency),
    },
    money(amountMinor, invoice.currency),
  );

  await ensureChartOfAccounts(input.orgId);

  let left = amountMinor;
  const paymentIds: string[] = [];
  for (const source of sources) {
    if (left <= 0) break;
    const slice = Math.min(left, source.heldMinor);

    const movement = await prisma.depositMovement.create({
      data: {
        orgId: input.orgId,
        depositId: source.id,
        amount: -slice / 100,
        reason: `Against invoice ${invoice.number}`,
        invoiceId: invoice.id,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    await prisma.deposit.update({
      where: { id: source.id },
      data: { appliedAmount: { increment: slice / 100 } },
    });

    const paymentId = await recordPayment({
      orgId: input.orgId,
      userId: input.userId,
      invoiceId: invoice.id,
      amount: money(slice, invoice.currency),
      method: 'DEPOSIT',
      reference: source.kind === 'CREDIT' ? 'Credit on account' : 'Deposit',
      notes: source.job ? `Deposit taken for job #${source.job.number}` : null,
    });
    await prisma.depositMovement.update({ where: { id: movement.id }, data: { paymentId } });
    paymentIds.push(paymentId);
    left -= slice;
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'deposit.applied',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: { amountMinor, paymentIds },
  });

  return { amountMinor, paymentIds };
}

/** Money held going back to the customer, the way money goes, with a reason. *
 * @repeat GUARDED(KEY: the form key its callers hand to once) Returning
 * money twice is the workshop paying it back twice, and a part-return is
 * legitimate on its own, so the key is what separates the two.
 */
export async function returnHeld(input: {
  orgId: string;
  userId: string;
  depositId: string;
  amountMinor: number;
  method: string;
  reason: string;
}): Promise<void> {
  const row = await prisma.deposit.findFirst({
    where: { id: input.depositId, orgId: input.orgId },
    select: ROW,
  });
  if (!row) throw new DepositError('NOT_FOUND', 'That deposit is not in this workshop.');
  const held = shape(row);
  const reason = input.reason.trim();

  assertDepositReturnable({
    heldMinor: held.heldMinor,
    amountMinor: input.amountMinor,
    method: input.method,
    reason,
  });

  await ensureChartOfAccounts(input.orgId);
  const at = new Date();

  const movement = await prisma.depositMovement.create({
    data: {
      orgId: input.orgId,
      depositId: row.id,
      amount: -input.amountMinor / 100,
      reason: `Returned: ${reason}`,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
  await prisma.deposit.update({
    where: { id: row.id },
    data: { refundedAmount: { increment: input.amountMinor / 100 } },
  });

  await postEntry(
    input.orgId,
    postDepositReturned({
      movementId: movement.id,
      reference: `DEP/${row.id.slice(-6).toUpperCase()}/R`,
      amount: money(input.amountMinor, row.currency),
      method: input.method as 'CARD',
      reason,
      at,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'deposit.returned',
    entityType: 'Customer',
    entityId: row.customerId,
    after: { depositId: row.id, amountMinor: input.amountMinor, method: input.method, reason },
  });
}

/** What the workshop holds in all: the figure the money pages lead with. */
export async function heldInAll(orgId: string) {
  const rows = await prisma.deposit.findMany({
    where: { orgId },
    select: { amount: true, appliedAmount: true, refundedAmount: true, kind: true },
  });
  const shaped = rows.map(shape);
  return {
    heldMinor: shaped.reduce((total, row) => total + Math.max(0, row.heldMinor), 0),
    customers: rows.length,
    deposits: shaped.filter((r) => r.kind === 'DEPOSIT' && r.heldMinor > 0).length,
    credits: shaped.filter((r) => r.kind === 'CREDIT' && r.heldMinor > 0).length,
  };
}

/** A receipt: one payment, with everything a customer would want on paper. */
export async function receiptFor(orgId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orgId },
    select: {
      id: true,
      amount: true,
      method: true,
      reference: true,
      receivedAt: true,
      notes: true,
      customer: {
        select: {
          displayName: true,
          email: true,
          addressLine1: true,
          addressLine2: true,
          locality: true,
          postcode: true,
        },
      },
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          amountPaid: true,
          currency: true,
          job: {
            select: {
              number: true,
              shortDescription: true,
              vehicle: { select: { make: true, model: true, registration: true } },
            },
          },
        },
      },
      recordedBy: { select: { name: true } },
      org: {
        select: {
          name: true,
          legalName: true,
          taxNumber: true,
          email: true,
          phone: true,
          locations: {
            where: { isDefault: true },
            take: 1,
            select: {
              addressLine1: true,
              addressLine2: true,
              locality: true,
              region: true,
              postcode: true,
            },
          },
        },
      },
    },
  });
  if (!payment) return null;
  const region = await regionFor(orgId);
  return {
    ...payment,
    amountMinor: minor(payment.amount),
    outstandingMinor: payment.invoice
      ? minor(payment.invoice.total) - minor(payment.invoice.amountPaid)
      : 0,
    region,
  };
}
