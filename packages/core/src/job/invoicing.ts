import { add, compare, fromDecimal, isZero, type Money, subtract, sum } from '../shared/money';

import { type JobStatus } from './lifecycle';

/**
 * Money, from the completed job to the settled invoice.
 *
 * The ledger has posted invoices, payments and credit notes since Phase 3, and
 * the seed has written them. Nothing in the running product ever did: no
 * screen issued an invoice from a job, took a payment against it, or raised a
 * credit note when something was wrong. A workshop could do everything up to
 * the point of being paid.
 *
 * The rules below are the ones whose absence produces a wrong number rather
 * than an ugly one: invoicing a job twice, taking more than is owed, refunding
 * money that was never received, and crediting an invoice for more than it was
 * ever for.
 */

export class MoneyCycleError extends Error {
  constructor(
    readonly code:
      | 'NOT_COMPLETED'
      | 'ALREADY_INVOICED'
      | 'NOTHING_TO_INVOICE'
      | 'NOT_ISSUED'
      | 'NOT_POSITIVE'
      | 'OVERPAYMENT'
      | 'NO_REASON'
      | 'OVER_CREDIT'
      | 'NO_CREDIT'
      | 'OVER_REFUND'
      | 'VOID',
    message: string,
  ) {
    super(message);
    this.name = 'MoneyCycleError';
  }
}

export type InvoiceState = 'DRAFT' | 'ISSUED' | 'PART_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

/** Days a customer has to pay, when the workshop has not said otherwise. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 14;

/** When an invoice issued today falls due. Whole days, end of the day. */
export function dueDateFor(issuedAt: Date, termsDays = DEFAULT_PAYMENT_TERMS_DAYS): Date {
  const due = new Date(issuedAt);
  due.setDate(due.getDate() + termsDays);
  due.setHours(23, 59, 59, 999);
  return due;
}

/* ---------------------------------------------------------------------------
   Issuing
   --------------------------------------------------------------------------- */

export interface InvoiceableJob {
  status: JobStatus;
  /** Whether an invoice already exists for the job, in any state but VOID. */
  alreadyInvoiced: boolean;
  chargeableLines: number;
}

/**
 * Whether a job can be invoiced.
 *
 * Completed, not before: an invoice for work still on the ramp is a promise
 * dressed as a bill. Once, not twice: the lifecycle forbids the transition and
 * this refuses the document, because the transition guard alone would leave a
 * second invoice behind when the guard fired after the insert.
 */
export function assertInvoiceable(job: InvoiceableJob): void {
  if (job.alreadyInvoiced) {
    throw new MoneyCycleError(
      'ALREADY_INVOICED',
      'This job has an invoice already. If something on it is wrong, raise a credit note against that invoice rather than issuing a second one.',
    );
  }

  if (job.status !== 'COMPLETED') {
    throw new MoneyCycleError(
      'NOT_COMPLETED',
      `The job is ${job.status.toLowerCase().replace('_', ' ')}. It has to be completed before it is invoiced, or the customer is billed for work still on the ramp.`,
    );
  }

  if (job.chargeableLines === 0) {
    throw new MoneyCycleError(
      'NOTHING_TO_INVOICE',
      'There is nothing priced on this job. Add the labour and parts before invoicing it.',
    );
  }
}

/* ---------------------------------------------------------------------------
   Taking payment
   --------------------------------------------------------------------------- */

export interface PayableInvoice {
  status: InvoiceState;
  total: Money;
  amountPaid: Money;
}

export function outstandingOn(invoice: Pick<PayableInvoice, 'total' | 'amountPaid'>): Money {
  return subtract(invoice.total, invoice.amountPaid);
}

/**
 * Whether a payment may be taken against an invoice.
 *
 * Never more than is owed. An overpayment is not a tip; it is money the
 * workshop now holds for somebody else, and the honest way to record it is a
 * payment for the balance and a separate deposit for the rest, which is a
 * decision a person should make rather than one a form should hide.
 */
export function assertPaymentRecordable(invoice: PayableInvoice, amount: Money): void {
  if (invoice.status === 'VOID') {
    throw new MoneyCycleError('VOID', 'This invoice was voided. Nothing can be paid against it.');
  }

  if (invoice.status === 'DRAFT') {
    throw new MoneyCycleError('NOT_ISSUED', 'This invoice has not been issued yet.');
  }

  if (amount.minor <= 0) {
    throw new MoneyCycleError('NOT_POSITIVE', 'A payment has to be more than nothing.');
  }

  const owed = outstandingOn(invoice);

  if (compare(amount, owed) > 0) {
    throw new MoneyCycleError(
      'OVERPAYMENT',
      `Only ${format(owed)} is outstanding. Record ${format(owed)} against the invoice and take the rest as a deposit if the customer meant to pay ahead.`,
    );
  }
}

/** The state an invoice is in once a payment of this size lands. */
export function stateAfterPayment(invoice: PayableInvoice, amount: Money): InvoiceState {
  const paid = add(invoice.amountPaid, amount);
  return compare(paid, invoice.total) >= 0 ? 'PAID' : 'PART_PAID';
}

/* ---------------------------------------------------------------------------
   Credit notes and refunds
   --------------------------------------------------------------------------- */

export interface CreditableInvoice {
  status: InvoiceState;
  total: Money;
  amountPaid: Money;
  /** Everything already credited against it. */
  credited: Money;
}

/**
 * Whether a credit note may be raised.
 *
 * Up to the invoice total and not a penny past it: an invoice credited for
 * more than it was ever for is a negative sale, and there is no such thing.
 * With a reason, always, because the reason is what the accountant asks for
 * and what the customer is told.
 */
export function assertInvoiceCreditable(
  invoice: CreditableInvoice,
  amount: Money,
  reason: string,
): void {
  if (invoice.status === 'DRAFT') {
    throw new MoneyCycleError(
      'NOT_ISSUED',
      'Nothing has been issued yet, so there is nothing to credit. Edit the draft instead.',
    );
  }

  if (invoice.status === 'VOID') {
    throw new MoneyCycleError('VOID', 'This invoice was voided already.');
  }

  if (amount.minor <= 0) {
    throw new MoneyCycleError('NOT_POSITIVE', 'A credit note has to be for more than nothing.');
  }

  if (!reason.trim()) {
    throw new MoneyCycleError(
      'NO_REASON',
      'Say why. The reason goes on the credit note the customer receives and is the first thing an accountant asks about.',
    );
  }

  const room = subtract(invoice.total, invoice.credited);

  if (compare(amount, room) > 0) {
    throw new MoneyCycleError(
      'OVER_CREDIT',
      `This invoice was for ${format(invoice.total)} and ${format(invoice.credited)} has already been credited. At most ${format(room)} more can be.`,
    );
  }
}

/**
 * Whether money may go back to the customer.
 *
 * Only what they actually paid, and only what a credit note says they are
 * owed. A refund larger than the payments is the workshop giving money away;
 * one larger than the credit is a refund with no document behind it.
 */
export function assertInvoiceRefundable(input: {
  amountPaid: Money;
  /** Refunds already made on this invoice. */
  refunded: Money;
  /** Credit notes raised on this invoice. */
  credited: Money;
  amount: Money;
}): void {
  if (input.amount.minor <= 0) {
    throw new MoneyCycleError('NOT_POSITIVE', 'A refund has to be for more than nothing.');
  }

  if (isZero(input.credited)) {
    throw new MoneyCycleError(
      'NO_CREDIT',
      'Raise a credit note first. A refund is money going back for a reason, and the credit note is the reason.',
    );
  }

  const refundable = [
    subtract(input.amountPaid, input.refunded),
    subtract(input.credited, input.refunded),
  ].reduce((least, candidate) => (compare(candidate, least) < 0 ? candidate : least));

  if (compare(input.amount, refundable) > 0) {
    throw new MoneyCycleError(
      'OVER_REFUND',
      refundable.minor <= 0
        ? 'Nothing is refundable on this invoice: either nothing was paid, or it has all gone back already.'
        : `At most ${format(refundable)} can go back: the lesser of what was paid and what has been credited, less what has already been refunded.`,
    );
  }
}

/**
 * Where a credit note leaves the invoice.
 *
 * Credit reduces what is owed. If the customer had already paid in full, a
 * credit note leaves them owed money, which is what the refund is for; the
 * invoice itself is then settled rather than negative.
 */
export function stateAfterCredit(invoice: CreditableInvoice, amount: Money): InvoiceState {
  const owed = subtract(subtract(invoice.total, invoice.amountPaid), add(invoice.credited, amount));
  if (owed.minor <= 0) return 'PAID';
  return invoice.amountPaid.minor > 0
    ? 'PART_PAID'
    : invoice.status === 'OVERDUE'
      ? 'OVERDUE'
      : 'ISSUED';
}

/* ---------------------------------------------------------------------------
   Words
   --------------------------------------------------------------------------- */

/** One line about where an invoice stands, for the top of the page. */
export function describeSettlement(invoice: {
  status: InvoiceState;
  total: Money;
  amountPaid: Money;
  dueAt: Date | null;
  now?: Date;
}): string {
  const now = invoice.now ?? new Date();
  const owed = outstandingOn(invoice);

  if (invoice.status === 'VOID') return 'Voided. It counts for nothing.';
  if (invoice.status === 'DRAFT') return 'A draft. The customer has not been sent anything.';
  if (owed.minor <= 0) return 'Paid in full.';

  if (invoice.dueAt && invoice.dueAt < now) {
    const days = Math.floor((now.getTime() - invoice.dueAt.getTime()) / 86_400_000);
    return `${format(owed)} overdue by ${days} day${days === 1 ? '' : 's'}.`;
  }

  if (invoice.amountPaid.minor > 0) {
    return `${format(invoice.amountPaid)} paid, ${format(owed)} still to come.`;
  }

  return invoice.dueAt
    ? `${format(owed)} due by ${invoice.dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`
    : `${format(owed)} outstanding.`;
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

/** Adds up decimals from the database into money, safely. */
export function moneyFromRows(values: readonly (string | number)[], currency = 'GBP'): Money {
  return sum(
    values.map((value) => fromDecimal(value, currency)),
    currency,
  );
}
