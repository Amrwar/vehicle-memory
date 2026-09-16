import { type Money, money, multiply, percentOf, subtract, zero } from '../shared/money';

/**
 * A code a customer hands over. Phase 45.5.
 *
 * The last thing on the feature map, and the one most likely to be built
 * carelessly, because a coupon looks like a number and is actually a set of
 * promises: it starts, it ends, it is worth something only above a certain
 * bill, it can be used a certain number of times in total and a certain
 * number of times by one person, and every one of those has to be checked in
 * front of somebody standing at a counter.
 *
 * The refusals are the feature. "Invalid code" teaches a customer that the
 * workshop is broken; "That code ran out on 30 June" teaches them what
 * happened, and lets the person at the counter decide what to do about it.
 *
 * A coupon never rewrites an invoice. It is settled against the bill the way
 * loyalty points are, so an issued invoice keeps the total it was issued at
 * and the discount lands where it belongs: in what the workshop spent to get
 * the work.
 */

export type CouponKind = 'PERCENT' | 'AMOUNT';

export type CouponState = 'ACTIVE' | 'NOT_YET' | 'ENDED' | 'USED_UP' | 'RETIRED';

export class CouponError extends Error {
  constructor(
    readonly code:
      | 'NO_CODE'
      | 'BAD_CODE'
      | 'BAD_VALUE'
      | 'BAD_DATES'
      | 'BAD_LIMIT'
      | 'NOT_FOUND'
      | 'NOT_YET'
      | 'ENDED'
      | 'RETIRED'
      | 'USED_UP'
      | 'ALREADY_USED'
      | 'TOO_SMALL'
      | 'NOTHING_OWED',
    message: string,
  ) {
    super(message);
    this.name = 'CouponError';
  }
}

export interface Coupon {
  id: string;
  code: string;
  kind: CouponKind;
  /** A percentage for PERCENT, an amount for AMOUNT. */
  percent: number;
  amount: Money;
  /** The bill has to reach this before the code is worth anything. */
  minSpend: Money | null;
  startsOn: Date | null;
  endsOn: Date | null;
  /** How many times it may be used at all. Null is no limit. */
  maxRedemptions: number | null;
  /** How many times one customer may use it. */
  perCustomer: number;
  redeemed: number;
  isActive: boolean;
}

/**
 * A code as it is written down and as it is typed.
 *
 * Letters and digits only, in capitals, with spaces and dashes thrown away,
 * so SPRING-20, spring 20 and Spring20 are the same code. Somebody reading a
 * code off a postcard should not have to be careful.
 */
export function normaliseCouponCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

export function assertCouponSaveable(input: {
  code: string;
  kind: CouponKind;
  percent: number;
  amount: Money;
  minSpend: Money | null;
  startsOn: Date | null;
  endsOn: Date | null;
  maxRedemptions: number | null;
  perCustomer: number;
}): void {
  const code = normaliseCouponCode(input.code);

  if (code.length < 3) {
    throw new CouponError(
      'BAD_CODE',
      'A code is at least three letters or digits. Anything shorter is typed by accident.',
    );
  }

  if (input.kind === 'PERCENT') {
    if (!(input.percent > 0) || input.percent > 100) {
      throw new CouponError(
        'BAD_VALUE',
        'A percentage is more than nothing and not more than a hundred. A hundred per cent is free work, which is a decision rather than a discount.',
      );
    }
  } else if (input.amount.minor <= 0 || input.amount.minor > 1_000_000_00) {
    throw new CouponError(
      'BAD_VALUE',
      'An amount off is more than nothing and less than a million.',
    );
  }

  if (input.minSpend && input.minSpend.minor < 0) {
    throw new CouponError('BAD_VALUE', 'A minimum spend cannot be less than nothing.');
  }

  if (input.startsOn && input.endsOn && input.startsOn > input.endsOn) {
    throw new CouponError(
      'BAD_DATES',
      'It ends before it starts. One of the two dates is the wrong way round.',
    );
  }

  if (
    input.maxRedemptions !== null &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)
  ) {
    throw new CouponError(
      'BAD_LIMIT',
      'A limit is a whole number of uses, or nothing at all for no limit.',
    );
  }

  if (!Number.isInteger(input.perCustomer) || input.perCustomer < 1) {
    throw new CouponError('BAD_LIMIT', 'One customer can use a code at least once.');
  }
}

/** Where a coupon stands, read against the clock rather than stored. */
export function couponState(coupon: Coupon, now = new Date()): CouponState {
  if (!coupon.isActive) return 'RETIRED';
  if (coupon.startsOn && coupon.startsOn > now) return 'NOT_YET';
  if (coupon.endsOn && coupon.endsOn < now) return 'ENDED';
  if (coupon.maxRedemptions !== null && coupon.redeemed >= coupon.maxRedemptions) return 'USED_UP';
  return 'ACTIVE';
}

export interface CouponUse {
  coupon: Coupon;
  /** What the bill comes to before the code is applied. */
  bill: Money;
  /** How much of the bill is still owed, where that is less than the bill. */
  owed?: Money;
  /** How many times this customer has used this code already. */
  usedByCustomer?: number;
  now?: Date;
}

/**
 * What a code takes off this bill, or a refusal that says why.
 *
 * Never more than is owed: a coupon is a discount, not a credit, and a
 * workshop that hands back the difference in cash has been robbed with its
 * own marketing.
 */
export function couponDiscount(use: CouponUse): Money {
  const now = use.now ?? new Date();
  const currency = use.bill.currency;
  const state = couponState(use.coupon, now);

  // A coupon's dates are days rather than moments, kept at midnight UTC, so
  // they are read back in UTC. Formatted in the reader's own zone, a code
  // that runs to 30 June tells somebody west of London it ran out on the 29th.
  const dated = (date: Date) =>
    date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

  if (state === 'RETIRED') {
    throw new CouponError('RETIRED', 'That code is no longer being honoured.');
  }

  if (state === 'NOT_YET') {
    throw new CouponError(
      'NOT_YET',
      `That code starts on ${dated(use.coupon.startsOn!)}. It is worth nothing before then.`,
    );
  }

  if (state === 'ENDED') {
    throw new CouponError('ENDED', `That code ran out on ${dated(use.coupon.endsOn!)}.`);
  }

  if (state === 'USED_UP') {
    throw new CouponError(
      'USED_UP',
      `That code has been used its ${use.coupon.maxRedemptions} times and is finished.`,
    );
  }

  if ((use.usedByCustomer ?? 0) >= use.coupon.perCustomer) {
    throw new CouponError(
      'ALREADY_USED',
      use.coupon.perCustomer === 1
        ? 'This customer has used that code already. It is one to a customer.'
        : `This customer has used that code its ${use.coupon.perCustomer} times.`,
    );
  }

  if (use.coupon.minSpend && use.bill.minor < use.coupon.minSpend.minor) {
    throw new CouponError(
      'TOO_SMALL',
      `That code needs a bill of ${format(use.coupon.minSpend)} or more. This one is ${format(use.bill)}.`,
    );
  }

  const owed = use.owed ?? use.bill;

  if (owed.minor <= 0) {
    throw new CouponError(
      'NOTHING_OWED',
      'Nothing is owed on this bill, so there is nothing to take off.',
    );
  }

  const off =
    use.coupon.kind === 'PERCENT'
      ? percentOf(use.bill, use.coupon.percent)
      : money(use.coupon.amount.minor, currency);

  return off.minor > owed.minor ? money(owed.minor, currency) : money(off.minor, currency);
}

/** What the coupon leaves to pay, for the line that says so on screen. */
export function couponLeaves(bill: Money, discount: Money): Money {
  return subtract(bill, discount);
}

/** One line describing a coupon, as a poster would put it. */
export function describeCoupon(coupon: Coupon, now = new Date()): string {
  const off =
    coupon.kind === 'PERCENT' ? `${trim(coupon.percent)}% off` : `${format(coupon.amount)} off`;

  const conditions: string[] = [];
  if (coupon.minSpend && coupon.minSpend.minor > 0) {
    conditions.push(`bills over ${format(coupon.minSpend)}`);
  }
  if (coupon.endsOn) {
    conditions.push(
      `until ${coupon.endsOn.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })}`,
    );
  }
  if (coupon.maxRedemptions !== null) {
    const left = Math.max(0, coupon.maxRedemptions - coupon.redeemed);
    conditions.push(left === 1 ? '1 use left' : `${left} uses left`);
  }

  const state = couponState(coupon, now);
  const standing =
    state === 'ACTIVE'
      ? ''
      : state === 'NOT_YET'
        ? ' Not started yet.'
        : state === 'ENDED'
          ? ' Finished.'
          : state === 'USED_UP'
            ? ' All used.'
            : ' Retired.';

  return `${off}${conditions.length > 0 ? `, ${conditions.join(', ')}` : ''}.${standing}`;
}

/** The workshop's own view: what the codes cost and what they brought in. */
export interface CouponResult {
  code: string;
  redemptions: number;
  given: Money;
  /** What was billed on the visits the code was used on. */
  billed: Money;
}

export function couponResults(
  rows: readonly { code: string; given: Money; billed: Money }[],
  currency = 'GBP',
): CouponResult[] {
  const byCode = new Map<string, CouponResult>();

  for (const row of rows) {
    const held = byCode.get(row.code) ?? {
      code: row.code,
      redemptions: 0,
      given: zero(currency),
      billed: zero(currency),
    };

    byCode.set(row.code, {
      code: row.code,
      redemptions: held.redemptions + 1,
      given: money(held.given.minor + row.given.minor, currency),
      billed: money(held.billed.minor + row.billed.minor, currency),
    });
  }

  return [...byCode.values()].sort((a, b) => b.given.minor - a.given.minor);
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Percentage of a bill, for the preview a counter shows before it commits. */
export function couponPreview(coupon: Coupon, bill: Money): Money {
  return coupon.kind === 'PERCENT' ? percentOf(bill, coupon.percent) : multiply(coupon.amount, 1);
}
