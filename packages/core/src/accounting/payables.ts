import { add, compare, type Money, subtract, zero } from '../shared/money';

import { ACCOUNT } from './accounts';
import { type JournalEntryDraft, type PaymentMethod } from './posting';

/**
 * Paying suppliers.
 *
 * Goods have been received and posted to payables since Phase 2, and a bill
 * could be matched against an order. Nothing paid one. The payable balance in
 * the ledger only ever went up, which is a balance sheet describing a
 * workshop that never settles with anybody.
 *
 * A payment usually covers several bills, and a remittance advice is the list
 * of which ones. So the allocation is explicit and stored, and the rules here
 * are about it adding up: never more than the bill, never more than the
 * payment, and every penny of the payment landing somewhere.
 */

export class PayablesError extends Error {
  constructor(
    readonly code:
      | 'NOT_POSITIVE'
      | 'NOTHING_OWED'
      | 'OVER_ALLOCATED'
      | 'UNALLOCATED'
      | 'WRONG_SUPPLIER'
      | 'DISPUTED',
    message: string,
  ) {
    super(message);
    this.name = 'PayablesError';
  }
}

export interface PayableBill {
  id: string;
  reference: string;
  supplierId: string;
  status: 'AWAITING' | 'APPROVED' | 'PART_PAID' | 'PAID' | 'DISPUTED';
  total: Money;
  amountPaid: Money;
  dueAt: Date | null;
}

export interface Allocation {
  billId: string;
  amount: Money;
}

export function outstandingOnBill(bill: Pick<PayableBill, 'total' | 'amountPaid'>): Money {
  return subtract(bill.total, bill.amountPaid);
}

/**
 * Spreads a payment across bills, oldest due first.
 *
 * Oldest first because that is what a supplier's statement does, and a
 * remittance that pays the newest bill while the oldest sits overdue is the
 * one that gets a telephone call. A disputed bill is skipped: paying it is a
 * decision, not an allocation.
 */
export function allocateAcrossBills(
  bills: readonly PayableBill[],
  amount: Money,
): { allocations: Allocation[]; unallocated: Money } {
  if (amount.minor <= 0) {
    throw new PayablesError('NOT_POSITIVE', 'A payment has to be for more than nothing.');
  }

  const payable = bills
    .filter((bill) => bill.status !== 'PAID' && bill.status !== 'DISPUTED')
    .filter((bill) => outstandingOnBill(bill).minor > 0)
    .sort((a, b) => {
      const dueA = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dueA - dueB || a.reference.localeCompare(b.reference);
    });

  if (payable.length === 0) {
    throw new PayablesError('NOTHING_OWED', 'Nothing is owed to this supplier that can be paid.');
  }

  let remaining = amount;
  const allocations: Allocation[] = [];

  for (const bill of payable) {
    if (remaining.minor <= 0) break;

    const owed = outstandingOnBill(bill);
    const portion = compare(remaining, owed) < 0 ? remaining : owed;

    allocations.push({ billId: bill.id, amount: portion });
    remaining = subtract(remaining, portion);
  }

  return { allocations, unallocated: remaining };
}

/**
 * Whether a set of allocations against a payment can be recorded.
 *
 * Every allocation is to a bill from the same supplier, for no more than that
 * bill still owes, and together they equal the payment. Money paid to a
 * supplier that lands on no bill is a credit the product has no way to show,
 * so it is refused rather than quietly held.
 */
export function assertSupplierPayable(input: {
  supplierId: string;
  amount: Money;
  allocations: readonly Allocation[];
  bills: readonly PayableBill[];
}): void {
  if (input.amount.minor <= 0) {
    throw new PayablesError('NOT_POSITIVE', 'A payment has to be for more than nothing.');
  }

  const byId = new Map(input.bills.map((bill) => [bill.id, bill]));

  for (const allocation of input.allocations) {
    const bill = byId.get(allocation.billId);

    if (!bill || bill.supplierId !== input.supplierId) {
      throw new PayablesError(
        'WRONG_SUPPLIER',
        'One of these bills belongs to a different supplier. A payment settles one supplier at a time.',
      );
    }

    if (bill.status === 'DISPUTED') {
      throw new PayablesError(
        'DISPUTED',
        `${bill.reference} is disputed. Settle the dispute, or take it out of the dispute, before paying it.`,
      );
    }

    if (allocation.amount.minor <= 0) {
      throw new PayablesError(
        'NOT_POSITIVE',
        `The allocation to ${bill.reference} has to be more than nothing.`,
      );
    }

    if (compare(allocation.amount, outstandingOnBill(bill)) > 0) {
      throw new PayablesError(
        'OVER_ALLOCATED',
        `${bill.reference} only has ${format(outstandingOnBill(bill))} outstanding.`,
      );
    }
  }

  const allocated = input.allocations.reduce(
    (total, allocation) => add(total, allocation.amount),
    zero(input.amount.currency),
  );

  if (allocated.minor !== input.amount.minor) {
    throw new PayablesError(
      'UNALLOCATED',
      allocated.minor < input.amount.minor
        ? `${format(subtract(input.amount, allocated))} of the payment lands on no bill. Allocate all of it, or pay less.`
        : 'The allocations add up to more than the payment.',
    );
  }
}

/** Where a bill stands once this much more has been paid on it. */
export function billStateAfter(bill: PayableBill, paid: Money): PayableBill['status'] {
  const total = add(bill.amountPaid, paid);
  return compare(total, bill.total) >= 0 ? 'PAID' : 'PART_PAID';
}

/** The ledger entry. Payable comes down, the bank or the till goes down. */
export function postSupplierPayment(input: {
  paymentId: string;
  reference: string;
  supplierName: string;
  amount: Money;
  method: PaymentMethod;
  paidAt: Date;
}): JournalEntryDraft {
  const currency = input.amount.currency;

  return {
    reference: input.reference,
    description: `Paid ${input.supplierName}`,
    sourceType: 'SupplierPayment',
    sourceId: input.paymentId,
    postedAt: input.paidAt,
    lines: [
      {
        accountCode: ACCOUNT.PAYABLE,
        debit: input.amount,
        credit: zero(currency),
        memo: 'No longer owed',
      },
      {
        accountCode: input.method === 'CASH' ? ACCOUNT.CASH : ACCOUNT.BANK,
        debit: zero(currency),
        credit: input.amount,
        memo: input.method.toLowerCase(),
      },
    ],
  };
}

/**
 * What the supplier is sent.
 *
 * A remittance advice is the one document a supplier's accounts department
 * actually wants: which invoices, how much against each, what reference to
 * look for on the statement. Without it a payment arrives as an unexplained
 * sum and somebody rings to ask.
 */
export function remittanceAdvice(input: {
  workshopName: string;
  supplierName: string;
  paidAt: Date;
  method: PaymentMethod;
  reference: string | null;
  total: Money;
  lines: readonly { reference: string; amount: Money; settles: boolean }[];
}): { subject: string; body: string } {
  const when = input.paidAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    subject: `Remittance advice from ${input.workshopName}: ${format(input.total)}`,
    body: [
      `${input.supplierName},`,
      '',
      `${input.workshopName} has paid ${format(input.total)} by ${describeMethod(input.method)} on ${when}${input.reference ? `, reference ${input.reference}` : ''}. It covers:`,
      '',
      ...input.lines.map(
        (line) =>
          `  ${line.reference.padEnd(16)} ${format(line.amount).padStart(12)}${line.settles ? '' : '  (part payment)'}`,
      ),
      '',
      `Total ${format(input.total)}.`,
      '',
      'If your records differ, reply to this email and we will go through them together.',
    ].join('\n'),
  };
}

function describeMethod(method: PaymentMethod): string {
  switch (method) {
    case 'CASH':
      return 'cash';
    case 'CHEQUE':
      return 'cheque';
    case 'CARD':
      return 'card';
    default:
      return 'bank transfer';
  }
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}
