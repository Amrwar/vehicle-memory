/**
 * Points, and a referral that credits both sides.
 *
 * Loyalty schemes go wrong in two ways and both are arithmetic. Points are
 * kept as a balance somebody edits, and the balance drifts from the history
 * that produced it. Or they are stored as money in a floating-point number,
 * and a customer ends up owed £4.999999.
 *
 * So the balance here is never stored as the truth: it is the sum of entries,
 * each of which says what it was for, and the running total is a cache of that
 * sum rather than a separate fact. Points are whole numbers throughout; only
 * the conversion to money divides, and it divides once, at the end.
 *
 * The referral half has one rule worth stating. Both sides are credited, and
 * neither is credited twice, and the credit happens when the referred customer
 * actually spends something rather than when they sign up. A scheme that pays
 * on sign-up pays for addresses.
 */

export class LoyaltyError extends Error {
  constructor(
    readonly code:
      'NOT_ENOUGH' | 'NOTHING_TO_AWARD' | 'SELF_REFERRAL' | 'ALREADY_CREDITED' | 'NOT_SPENT',
    message: string,
  ) {
    super(message);
    this.name = 'LoyaltyError';
  }
}

export interface Entry {
  /** Positive to award, negative to spend. Always whole points. */
  points: number;
  reason: string;
  createdAt: Date;
  /** Points expire; money does not. Null never expires. */
  expiresAt: Date | null;
}

/**
 * The balance, from the entries rather than from a stored figure.
 *
 * Expired entries are excluded here rather than deleted, so the history still
 * explains where a balance went. A customer asking why they have fewer points
 * than last year deserves an answer better than a smaller number.
 */
export function balanceOf(entries: readonly Entry[], now = new Date()): number {
  return entries.reduce((total, entry) => {
    if (entry.points > 0 && entry.expiresAt && entry.expiresAt <= now) return total;
    return total + entry.points;
  }, 0);
}

/** Points about to lapse, which is the only reason to mention them. */
export function pointsExpiringWithin(
  entries: readonly Entry[],
  days: number,
  now = new Date(),
): { points: number; on: Date | null } {
  const horizon = new Date(now.getTime() + days * 86_400_000);

  const lapsing = entries.filter(
    (entry) =>
      entry.points > 0 &&
      entry.expiresAt !== null &&
      entry.expiresAt > now &&
      entry.expiresAt <= horizon,
  );

  if (lapsing.length === 0) return { points: 0, on: null };

  const soonest = lapsing.reduce(
    (earliest, entry) => (entry.expiresAt! < earliest ? entry.expiresAt! : earliest),
    lapsing[0]!.expiresAt!,
  );

  return {
    points: lapsing.reduce((total, entry) => total + entry.points, 0),
    on: soonest,
  };
}

/**
 * Points earned on a spend.
 *
 * One point per whole pound, floored. Not rounded: rounding up hands out
 * points nobody spent and makes the scheme cost more than the rate says it
 * does, which is the kind of error that only shows up in a year-end figure.
 */
export function pointsFor(amountMinor: number, perPound = 1): number {
  if (amountMinor <= 0) return 0;
  return Math.floor((amountMinor / 100) * perPound);
}

/**
 * What points are worth, in minor units.
 *
 * A hundred points to the pound by default. Floored again, and for the same
 * reason: a redemption that rounds up is money the workshop did not agree to.
 */
export function valueOf(points: number, pencePerPoint = 1): number {
  return Math.max(0, Math.floor(points * pencePerPoint));
}

/**
 * Whether a customer can spend this many points, and what it comes to.
 *
 * Refuses rather than clamping. Quietly redeeming fewer points than somebody
 * asked for produces a bill they did not expect, and they find out at the
 * counter.
 */
export function assertRedeemable(input: {
  balance: number;
  points: number;
  /** What is owed, so a redemption cannot exceed the bill. */
  owedMinor: number;
  pencePerPoint?: number;
}): number {
  if (input.points <= 0) {
    throw new LoyaltyError('NOTHING_TO_AWARD', 'Say how many points to use.');
  }

  if (input.points > input.balance) {
    throw new LoyaltyError(
      'NOT_ENOUGH',
      `That is ${input.points - input.balance} points more than they have.`,
    );
  }

  const value = valueOf(input.points, input.pencePerPoint);

  if (value > input.owedMinor) {
    throw new LoyaltyError(
      'NOT_ENOUGH',
      'That is worth more than the bill. Points do not pay out as money, so use only what is owed.',
    );
  }

  return value;
}

export interface ReferralState {
  referrerCustomerId: string;
  referredCustomerId: string | null;
  creditedAt: Date | null;
  /** What the referred customer has actually spent, in minor units. */
  referredSpendMinor: number;
}

/** What a referral has to be worth before either side is paid. */
export const REFERRAL_MINIMUM_MINOR = 5_000;

/**
 * Whether a referral is ready to pay, and why not when it is not.
 *
 * Paid on a real visit rather than on sign-up. A scheme that pays on sign-up
 * pays for email addresses, and the workshop finds that out one quarter later.
 */
export function assertCreditable(state: ReferralState): void {
  if (!state.referredCustomerId) {
    throw new LoyaltyError('NOT_SPENT', 'Nobody has used this code yet.');
  }

  if (state.referredCustomerId === state.referrerCustomerId) {
    throw new LoyaltyError(
      'SELF_REFERRAL',
      'That is the same customer on both sides. A referral pays for bringing somebody new.',
    );
  }

  if (state.creditedAt) {
    throw new LoyaltyError(
      'ALREADY_CREDITED',
      'This referral has already been paid, on both sides.',
    );
  }

  if (state.referredSpendMinor < REFERRAL_MINIMUM_MINOR) {
    throw new LoyaltyError(
      'NOT_SPENT',
      `They have spent ${(state.referredSpendMinor / 100).toFixed(2)} so far. A referral pays once they have actually had work done.`,
    );
  }
}

/**
 * A code somebody can say out loud over a counter.
 *
 * No vowels, so nothing spells a word by accident, and none of the characters
 * that get misheard or misread: no I against 1, no O against 0, no S against
 * 5. A code read wrongly credits the wrong customer.
 */
const ALPHABET = 'BCDFGHJKLMNPQRTVWXYZ2346789';

export function referralCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

/** Whether something typed at a counter could be one of ours. */
export function looksLikeCode(value: string): boolean {
  const cleaned = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return cleaned.length === 6 && [...cleaned].every((character) => ALPHABET.includes(character));
}
