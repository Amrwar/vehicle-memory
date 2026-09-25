/**
 * Parts back, and work sent out. Phase 38.
 *
 * A part goes back to the supplier for one of four reasons: it is faulty,
 * it is the wrong part, it was not needed, or it is the old unit a
 * remanufactured part was sold against (a core). The first three take the
 * part off the shelf the moment it leaves, at what it cost, and hold that
 * value as a credit the supplier owes until their credit note arrives. A
 * core was never stock: it is the old unit off the car, and its credit is
 * the core charge coming back.
 *
 * Sublet work is work the workshop buys from somebody else and sells on:
 * an alignment, a regas, a machining job. It is a line on the job with a
 * cost and a charge, a vendor, and a vendor's bill.
 *
 * Every rule here is pure: what may be returned, what a credit does to the
 * bills a supplier is owed, what a sublet has to have.
 */

export type ReturnReason = 'DEFECTIVE' | 'WRONG_PART' | 'SURPLUS' | 'CORE';

export const RETURN_REASONS: readonly ReturnReason[] = [
  'DEFECTIVE',
  'WRONG_PART',
  'SURPLUS',
  'CORE',
];

export function reasonLabel(reason: ReturnReason | string): string {
  switch (reason) {
    case 'DEFECTIVE':
      return 'Faulty';
    case 'WRONG_PART':
      return 'Wrong part';
    case 'SURPLUS':
      return 'Not needed';
    case 'CORE':
      return 'Old unit (core)';
    default:
      return String(reason);
  }
}

export type ReturnErrorCode =
  | 'NOTHING'
  | 'TOO_MANY'
  | 'NOT_ON_SHELF'
  | 'NOT_OPEN'
  | 'NO_REFERENCE'
  | 'BAD_AMOUNT'
  | 'NO_VENDOR'
  | 'NO_DESCRIPTION'
  | 'ALREADY_BILLED'
  | 'JOB_CLOSED';

export class ReturnError extends Error {
  readonly code: ReturnErrorCode;

  constructor(code: ReturnErrorCode, message: string) {
    super(message);
    this.name = 'ReturnError';
    this.code = code;
  }
}

/** Whether a quantity of one delivered line can go back. */
export function assertReturnable(input: {
  reason: ReturnReason;
  description: string;
  quantity: number;
  received: number;
  alreadyReturned: number;
  onHand: number | null;
}): void {
  if (!(input.quantity > 0) || !Number.isFinite(input.quantity)) {
    throw new ReturnError('NOTHING', `Say how many of "${input.description}" are going back.`);
  }
  const left = round3(input.received - input.alreadyReturned);
  if (input.quantity > left) {
    throw new ReturnError(
      'TOO_MANY',
      left <= 0
        ? `Everything received of "${input.description}" has already gone back.`
        : `Only ${left} of "${input.description}" were received and not already returned.`,
    );
  }
  // A core is the old unit off the car and was never on the shelf.
  if (input.reason !== 'CORE' && input.onHand !== null && input.quantity > input.onHand) {
    throw new ReturnError(
      'NOT_ON_SHELF',
      `There ${input.onHand === 1 ? 'is' : 'are'} ${Math.max(0, input.onHand)} of "${input.description}" on the shelf; a part that has been fitted cannot go back as stock.`,
    );
  }
}

/**
 * What the supplier's credit note should say: what was paid for what went
 * back.
 *
 * Not the same figure as `heldValue`, and the difference is the point.
 *
 * A part comes off the shelf at the shelf's weighted average, because that is
 * what leaving costs the books -- five bought last month at PS8.10 and five
 * today at PS10 are ten parts worth PS9.05 each, and nobody can say which two
 * are in the box going back. That is right for the ledger and has nothing to
 * do with the supplier, who will credit what they charged: PS10 each, because
 * that is what their invoice said.
 *
 * The returns screen proposed the held value as the amount to enter, so on a
 * shelf averaging PS39 it offered PS77.82 for two parts that cost PS20 -- and
 * for a core, where the charge is known exactly, it offered nothing at all,
 * because a core holds no stock value. Both wrong, in opposite directions.
 * Phase 79.
 *
 * A core is credited at the core charge, which is what was agreed for it.
 * Everything else at the price on the order it came in on.
 */
export function creditDue(
  lines: readonly {
    reason: ReturnReason;
    quantity: number;
    /** What one cost when it went back: the shelf's average, or the core charge. */
    unitCost: number;
    /** What one cost when it was bought, from the order line it came in on. */
    paidUnitCost?: number | null;
  }[],
): number {
  return round2(
    lines.reduce(
      (total, line) =>
        total +
        line.quantity *
          (line.reason === 'CORE' ? line.unitCost : (line.paidUnitCost ?? line.unitCost)),
      0,
    ),
  );
}

/** The value a return takes off the shelf and holds as a credit due. Cores hold nothing. */
export function heldValue(
  lines: readonly { reason: ReturnReason; quantity: number; unitCost: number }[],
): number {
  return round2(
    lines.reduce(
      (total, line) => (line.reason === 'CORE' ? total : total + line.quantity * line.unitCost),
      0,
    ),
  );
}

export function assertReturnCreditable(input: {
  status: string;
  reference: string | null | undefined;
  net: number;
  tax: number;
}): void {
  if (input.status !== 'SENT') {
    throw new ReturnError(
      'NOT_OPEN',
      input.status === 'CREDITED'
        ? 'This return has already been credited.'
        : 'This return was refused by the supplier and is closed.',
    );
  }
  if (!input.reference?.trim()) {
    throw new ReturnError(
      'NO_REFERENCE',
      'The credit needs the supplier’s own credit note number.',
    );
  }
  if (
    !(input.net > 0) ||
    !Number.isFinite(input.net) ||
    input.tax < 0 ||
    !Number.isFinite(input.tax)
  ) {
    throw new ReturnError(
      'BAD_AMOUNT',
      'A credit note is for more than nothing, with tax of zero or more. If they credit nothing, record it as refused.',
    );
  }
}

export interface OpenBill {
  id: string;
  /** What is still owed on it, in minor units. */
  outstandingMinor: number;
}

/**
 * A credit applied to what the supplier is owed, oldest bill first, until
 * the credit or the bills run out. What is left is held on the supplier's
 * account against the next bill.
 */
export function applyCredit(
  bills: readonly OpenBill[],
  creditMinor: number,
): { applications: { billId: string; minor: number }[]; unappliedMinor: number } {
  let left = Math.max(0, Math.round(creditMinor));
  const applications: { billId: string; minor: number }[] = [];
  for (const bill of bills) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, bill.outstandingMinor));
    if (take <= 0) continue;
    applications.push({ billId: bill.id, minor: take });
    left -= take;
  }
  return { applications, unappliedMinor: left };
}

/* ---------------------------------------------------------------------------
   Sublet
   --------------------------------------------------------------------------- */

export function assertSubletSound(input: {
  supplierId: string | null | undefined;
  description: string;
  cost: number;
  price: number;
}): void {
  if (!input.supplierId) throw new ReturnError('NO_VENDOR', 'Say who is doing the work.');
  if (!input.description.trim()) {
    throw new ReturnError('NO_DESCRIPTION', 'Say what the work is, as the customer will read it.');
  }
  if (
    !(input.cost >= 0) ||
    !(input.price >= 0) ||
    !Number.isFinite(input.cost) ||
    !Number.isFinite(input.price)
  ) {
    throw new ReturnError('BAD_AMOUNT', 'The cost and the charge are amounts of zero or more.');
  }
}

export function subletMargin(input: { cost: number; price: number }): {
  margin: number;
  percent: number | null;
  belowCost: boolean;
} {
  const margin = round2(input.price - input.cost);
  return {
    margin,
    percent: input.price > 0 ? Math.round((margin / input.price) * 1000) / 10 : null,
    belowCost: margin < 0,
  };
}

export function assertSubletBillable(input: {
  status: string;
  reference: string | null | undefined;
  net: number;
  tax: number;
}): void {
  if (input.status === 'BILLED') {
    throw new ReturnError('ALREADY_BILLED', 'The vendor’s bill for this work is already booked.');
  }
  if (!input.reference?.trim()) {
    throw new ReturnError('NO_REFERENCE', 'The bill needs the vendor’s own invoice number.');
  }
  if (
    !(input.net > 0) ||
    !Number.isFinite(input.net) ||
    input.tax < 0 ||
    !Number.isFinite(input.tax)
  ) {
    throw new ReturnError(
      'BAD_AMOUNT',
      'A bill is for more than nothing, with tax of zero or more.',
    );
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
