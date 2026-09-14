/**
 * Gift cards. Phases 26 and 28.
 *
 * A gift card is money taken in advance for work not yet chosen. Two things
 * go wrong with them and both are accounting. The sale is booked as revenue,
 * which flatters December and starves the month the work is done. Or the
 * redemption is booked as money in, and the bank shows the same fifty pounds
 * twice.
 *
 * So the card is a liability from the day it is sold until the day it is
 * spent, and a redemption is a payment of its own kind that releases the
 * liability rather than touching the bank. The balance is never stored: it
 * is the sum of the entries, each typed and each saying what it was for, so
 * a balance can always be explained: what was loaded, what was spent, what
 * came back, and what a person changed by hand.
 *
 * Cards do not expire unless the workshop says so when selling one. A card
 * that lapses is money a customer paid for nothing, and the goodwill lost
 * is worth more than the breakage gained.
 */

export class GiftCardError extends Error {
  constructor(
    readonly code:
      | 'NOT_A_CODE'
      | 'NOT_FOUND'
      | 'DISABLED'
      | 'EXPIRED'
      | 'EMPTY'
      | 'NOT_ENOUGH'
      | 'TOO_SMALL'
      | 'TOO_LARGE'
      | 'BAD_METHOD'
      | 'NOTHING_OWED'
      | 'WRONG_SITE'
      | 'NO_REASON'
      | 'BELOW_ZERO',
    message: string,
  ) {
    super(message);
    this.name = 'GiftCardError';
  }
}

export type GiftCardEntryKind = 'ISSUE' | 'REDEEM' | 'REFUND' | 'ADJUSTMENT';

export interface GiftCardEntryLike {
  /** Minor units. Positive when loaded or returned, negative when spent. */
  amountMinor: number;
}

/** The least and the most a card can be sold for, in minor units. */
export const GIFT_CARD_MIN_MINOR = 500;
export const GIFT_CARD_MAX_MINOR = 100_000;

/** Ways a card can be paid for. Not with points, and not with another card. */
export const GIFT_CARD_TENDERS = ['CARD', 'CASH', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE'] as const;
export type GiftCardTender = (typeof GIFT_CARD_TENDERS)[number];

/** How long a card lasts when the workshop wants it to lapse at all. */
export const GIFT_CARD_TERMS_MONTHS = [12, 24] as const;

/** The balance, from the entries rather than from a stored figure. */
export function giftCardBalance(entries: readonly GiftCardEntryLike[]): number {
  return entries.reduce((total, entry) => total + entry.amountMinor, 0);
}

/**
 * What a card is, read from its facts rather than stored.
 *
 * Disabled wins over everything, because a cancelled card with money on it
 * is still cancelled. Expired beats depleted, because an empty expired card
 * cannot be topped up back to life. Active is the rest.
 */
export type GiftCardStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'DISABLED';

export function giftCardStatus(
  card: { balanceMinor: number; expiresAt: Date | null; disabledAt: Date | null },
  now = new Date(),
): GiftCardStatus {
  if (card.disabledAt) return 'DISABLED';
  if (card.expiresAt && card.expiresAt <= now) return 'EXPIRED';
  if (card.balanceMinor <= 0) return 'DEPLETED';
  return 'ACTIVE';
}

/**
 * A code somebody can read off a card or say over a counter. Twelve
 * characters from the alphabet the referral codes use, for the same reason:
 * nothing that gets misheard, nothing that spells a word by accident.
 */
const ALPHABET = 'BCDFGHJKLMNPQRTVWXYZ2346789';

export function giftCardCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < 12; index += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

/** As it is printed and read: three groups of four. */
export function formatGiftCode(code: string): string {
  return normaliseGiftCode(code).replace(/(.{4})(?=.)/g, '$1-');
}

/** As it is stored: upper case, no spaces or dashes. */
export function normaliseGiftCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

/** Whether something typed at a counter could be one of ours. */
export function looksLikeGiftCode(value: string): boolean {
  const cleaned = normaliseGiftCode(value);
  return cleaned.length === 12 && [...cleaned].every((character) => ALPHABET.includes(character));
}

/**
 * Whether a card can be sold for this amount, paid this way, lasting this
 * long.
 *
 * Whole pounds only, between the two limits. A card for £3.47 is a mistake,
 * and a card for £5,000 is a conversation before it is a sale. A term is one
 * of the ones offered or none at all.
 */
export function assertCardSellable(input: {
  amountMinor: number;
  method: string;
  termMonths?: number | null;
}): void {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor % 100 !== 0) {
    throw new GiftCardError('TOO_SMALL', 'Sell a card for whole pounds.');
  }
  if (input.amountMinor < GIFT_CARD_MIN_MINOR) {
    throw new GiftCardError(
      'TOO_SMALL',
      `The smallest card is ${(GIFT_CARD_MIN_MINOR / 100).toFixed(0)} pounds.`,
    );
  }
  if (input.amountMinor > GIFT_CARD_MAX_MINOR) {
    throw new GiftCardError(
      'TOO_LARGE',
      `The largest card is ${(GIFT_CARD_MAX_MINOR / 100).toFixed(0)} pounds. Sell two.`,
    );
  }
  if (!(GIFT_CARD_TENDERS as readonly string[]).includes(input.method)) {
    throw new GiftCardError(
      'BAD_METHOD',
      'A card is paid for with money. Not with points, and not with another card.',
    );
  }
  if (
    input.termMonths !== null &&
    input.termMonths !== undefined &&
    !(GIFT_CARD_TERMS_MONTHS as readonly number[]).includes(input.termMonths)
  ) {
    throw new GiftCardError('TOO_SMALL', 'A card lasts a year, two years, or for good.');
  }
}

/** When a card sold today with this term lapses. Null for good. */
export function giftCardExpiry(termMonths: number | null, soldAt = new Date()): Date | null {
  if (!termMonths) return null;
  const at = new Date(soldAt);
  at.setMonth(at.getMonth() + termMonths);
  return at;
}

/**
 * What a card can put towards a bill, and a refusal when what was asked for
 * is not that.
 *
 * Refuses rather than clamps, for the reason points do: quietly using less
 * than somebody asked for produces a bill they did not expect. The card's
 * own state is checked first, in the order a person would want to hear it:
 * cancelled, lapsed, wrong site, empty, then the arithmetic.
 */
export function assertCardRedeemable(input: {
  balanceMinor: number;
  /** What was asked for. Null means as much as the bill needs. */
  amountMinor: number | null;
  owedMinor: number;
  disabledAt: Date | null;
  expiresAt: Date | null;
  /** The site the card is good at, or null for everywhere. */
  cardLocationId?: string | null;
  /** Where it is being spent, or null when the sale has no site. */
  atLocationId?: string | null;
  now?: Date;
}): number {
  const now = input.now ?? new Date();

  if (input.disabledAt) {
    throw new GiftCardError('DISABLED', 'That card was cancelled.');
  }
  if (input.expiresAt && input.expiresAt <= now) {
    throw new GiftCardError(
      'EXPIRED',
      `That card lapsed on ${input.expiresAt.toLocaleDateString('en-GB')}.`,
    );
  }
  if (input.cardLocationId && input.atLocationId && input.cardLocationId !== input.atLocationId) {
    throw new GiftCardError('WRONG_SITE', 'That card is good at another site.');
  }
  if (input.balanceMinor <= 0) {
    throw new GiftCardError('EMPTY', 'There is nothing left on that card.');
  }
  if (input.owedMinor <= 0) {
    throw new GiftCardError('NOTHING_OWED', 'Nothing is owed on that invoice.');
  }

  const asked = input.amountMinor ?? Math.min(input.balanceMinor, input.owedMinor);

  if (!Number.isInteger(asked) || asked <= 0) {
    throw new GiftCardError('NOT_ENOUGH', 'Say how much of the card to use.');
  }
  if (asked > input.balanceMinor) {
    throw new GiftCardError(
      'NOT_ENOUGH',
      `Only ${(input.balanceMinor / 100).toFixed(2)} is left on that card.`,
    );
  }
  if (asked > input.owedMinor) {
    throw new GiftCardError(
      'NOT_ENOUGH',
      'That is more than the bill. A card does not pay out as money, so use only what is owed.',
    );
  }

  return asked;
}

/**
 * Whether a person may change a card's balance by hand, and by how much.
 *
 * Whole pence, not nothing, with a reason, and never below zero: a card
 * that owes the workshop money is not a gift card. A cancelled card is not
 * adjusted; it is cancelled.
 */
export function assertCardAdjustable(input: {
  amountMinor: number;
  balanceMinor: number;
  reason: string;
  disabledAt: Date | null;
}): void {
  if (input.disabledAt) {
    throw new GiftCardError('DISABLED', 'That card was cancelled.');
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor === 0) {
    throw new GiftCardError('NOT_ENOUGH', 'Say how much to add or take off, in pounds and pence.');
  }
  if (!input.reason.trim()) {
    throw new GiftCardError('NO_REASON', 'Say why. The reason stays on the card.');
  }
  if (input.balanceMinor + input.amountMinor < 0) {
    throw new GiftCardError(
      'BELOW_ZERO',
      `That would take the card below nothing. Only ${(input.balanceMinor / 100).toFixed(2)} is on it.`,
    );
  }
}
