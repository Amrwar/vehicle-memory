/**
 * Gift cards. Phase 26.
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
 * is the sum of the entries, each of which says what it was for.
 *
 * Cards do not expire. A card that lapses is money a customer paid for
 * nothing, and the goodwill lost is worth more than the breakage gained.
 */

export class GiftCardError extends Error {
  constructor(
    readonly code:
      | 'NOT_A_CODE'
      | 'NOT_FOUND'
      | 'VOIDED'
      | 'EMPTY'
      | 'NOT_ENOUGH'
      | 'TOO_SMALL'
      | 'TOO_LARGE'
      | 'BAD_METHOD'
      | 'NOTHING_OWED',
    message: string,
  ) {
    super(message);
    this.name = 'GiftCardError';
  }
}

export interface GiftCardEntryLike {
  /** Minor units. Positive when loaded, negative when spent. */
  amountMinor: number;
}

/** The least and the most a card can be sold for, in minor units. */
export const GIFT_CARD_MIN_MINOR = 500;
export const GIFT_CARD_MAX_MINOR = 100_000;

/** Ways a card can be paid for. Not with points, and not with another card. */
export const GIFT_CARD_TENDERS = ['CARD', 'CASH', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE'] as const;
export type GiftCardTender = (typeof GIFT_CARD_TENDERS)[number];

/** The balance, from the entries rather than from a stored figure. */
export function giftCardBalance(entries: readonly GiftCardEntryLike[]): number {
  return entries.reduce((total, entry) => total + entry.amountMinor, 0);
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
 * Whether a card can be sold for this amount, paid this way.
 *
 * Whole pounds only, between the two limits. A card for £3.47 is a mistake,
 * and a card for £5,000 is a conversation before it is a sale.
 */
export function assertCardSellable(input: { amountMinor: number; method: string }): void {
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
}

/**
 * What a card can put towards a bill, and a refusal when what was asked for
 * is not that.
 *
 * Refuses rather than clamps, for the reason points do: quietly using less
 * than somebody asked for produces a bill they did not expect.
 */
export function assertCardRedeemable(input: {
  balanceMinor: number;
  /** What was asked for. Null means as much as the bill needs. */
  amountMinor: number | null;
  owedMinor: number;
  voided: boolean;
}): number {
  if (input.voided) {
    throw new GiftCardError('VOIDED', 'That card was cancelled.');
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
