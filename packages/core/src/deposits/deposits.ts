/**
 * Money held for a customer. Phase 30.
 *
 * Two things come in ahead of a bill. A deposit: money taken before the work,
 * usually for parts ordered on a customer's say-so. A credit: money the
 * workshop owes back and the customer would rather keep on account than
 * have refunded. Both are the same fact in the books, a liability until it
 * is put against an invoice, and both live in one row type with a kind.
 *
 * Neither is revenue on the day it is taken. Booking a deposit as income is
 * the classic error, and it overstates a good month while understating the
 * one where the work is actually done.
 */

export class DepositError extends Error {
  constructor(
    readonly code:
      | 'NOT_POSITIVE'
      | 'BAD_METHOD'
      | 'NOTHING_HELD'
      | 'MORE_THAN_HELD'
      | 'MORE_THAN_OWED'
      | 'NOTHING_OWED'
      | 'NOT_FOUND'
      | 'NO_REASON',
    message: string,
  ) {
    super(message);
    this.name = 'DepositError';
  }
}

export type DepositKind = 'DEPOSIT' | 'CREDIT';

/** Ways a deposit is paid. With money: not points, not a card, not another deposit. */
export const DEPOSIT_TENDERS = ['CARD', 'CASH', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE'] as const;

/** What a deposit can be taken for. */
export function assertDepositTakeable(input: { amountMinor: number; method: string }): void {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DepositError('NOT_POSITIVE', 'A deposit has to be for more than nothing.');
  }
  if (!(DEPOSIT_TENDERS as readonly string[]).includes(input.method)) {
    throw new DepositError(
      'BAD_METHOD',
      'A deposit is money the customer hands over. Not points, not a gift card, not money already held.',
    );
  }
}

/** What is still held on a row: what came in less what has gone against bills or back. */
export function heldOn(row: { amountMinor: number; appliedMinor: number; refundedMinor: number }) {
  return row.amountMinor - row.appliedMinor - row.refundedMinor;
}

export type DepositStatus = 'HELD' | 'PART_USED' | 'USED' | 'RETURNED';

export function depositStatus(row: {
  amountMinor: number;
  appliedMinor: number;
  refundedMinor: number;
}): DepositStatus {
  const held = heldOn(row);
  if (held <= 0) return row.refundedMinor > 0 && row.appliedMinor === 0 ? 'RETURNED' : 'USED';
  if (row.appliedMinor > 0 || row.refundedMinor > 0) return 'PART_USED';
  return 'HELD';
}

/**
 * How much of what is held can go against a bill, and a refusal when what
 * was asked for is not that. Refuses rather than clamps: quietly using
 * less than somebody asked for produces a bill they did not expect.
 */
export function assertDepositApplicable(input: {
  heldMinor: number;
  /** Null means as much as the bill needs. */
  amountMinor: number | null;
  owedMinor: number;
}): number {
  if (input.heldMinor <= 0) {
    throw new DepositError('NOTHING_HELD', 'Nothing is held for this customer.');
  }
  if (input.owedMinor <= 0) {
    throw new DepositError('NOTHING_OWED', 'Nothing is owed on that invoice.');
  }
  const asked = input.amountMinor ?? Math.min(input.heldMinor, input.owedMinor);
  if (!Number.isInteger(asked) || asked <= 0) {
    throw new DepositError('NOT_POSITIVE', 'Say how much of the money held to use.');
  }
  if (asked > input.heldMinor) {
    throw new DepositError(
      'MORE_THAN_HELD',
      `Only ${(input.heldMinor / 100).toFixed(2)} is held for this customer.`,
    );
  }
  if (asked > input.owedMinor) {
    throw new DepositError(
      'MORE_THAN_OWED',
      'That is more than the bill. Money held stays held; use only what is owed.',
    );
  }
  return asked;
}

/** How much of what is held can go back to the customer. */
export function assertDepositReturnable(input: {
  heldMinor: number;
  amountMinor: number;
  method: string;
  reason: string;
}): void {
  if (input.heldMinor <= 0) {
    throw new DepositError('NOTHING_HELD', 'Nothing is held to return.');
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DepositError('NOT_POSITIVE', 'Say how much to return.');
  }
  if (input.amountMinor > input.heldMinor) {
    throw new DepositError(
      'MORE_THAN_HELD',
      `Only ${(input.heldMinor / 100).toFixed(2)} is held. Return that or less.`,
    );
  }
  if (!(DEPOSIT_TENDERS as readonly string[]).includes(input.method)) {
    throw new DepositError(
      'BAD_METHOD',
      'Money goes back the way money goes: cash, card or transfer.',
    );
  }
  if (!input.reason.trim()) {
    throw new DepositError(
      'NO_REASON',
      'Say why it is going back. The reason stays on the record.',
    );
  }
}
