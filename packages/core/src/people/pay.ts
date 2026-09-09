import { type Money, money, multiply, zero } from '../shared/money';

/**
 * Pay rates, and why they carry dates.
 *
 * Until now a technician's cost rate lived as a single number on their
 * membership. That number is today's rate, and applying it to time clocked
 * last March silently rewrites what last March cost. A pay rise is not
 * supposed to change a job you invoiced six months ago, but with one mutable
 * field it does, and nothing in the system notices.
 *
 * So a rate is a record with a start date, never an edit. Asking what an hour
 * cost means asking what it cost *on that day*. This is the same reasoning as
 * the passport's append-only ledger, applied to money.
 */

export type EmploymentType = 'EMPLOYEE' | 'CONTRACTOR' | 'APPRENTICE';

export interface PayRate {
  /** Inclusive. */
  effectiveFrom: Date;
  /** Exclusive, and null while this is the current rate. */
  effectiveTo: Date | null;
  /** What the hour costs the business, including employer contributions. */
  costPerHour: Money;
  /** What the hour is sold for. Used to price labour, not to cost it. */
  chargePerHour: Money;
}

export class PayRateError extends Error {
  readonly code: 'OVERLAP' | 'BACKWARDS' | 'NO_RATE';
  constructor(code: PayRateError['code'], message: string) {
    super(message);
    this.name = 'PayRateError';
    this.code = code;
  }
}

/** The rate in force on a given day, or undefined if the person had none. */
export function rateOn(rates: readonly PayRate[], at: Date): PayRate | undefined {
  return rates.find(
    (rate) => rate.effectiveFrom <= at && (rate.effectiveTo === null || at < rate.effectiveTo),
  );
}

/**
 * Rejects a history that cannot be true.
 *
 * Two rates covering the same day means an hour has two costs, and whichever
 * the code happens to pick first becomes the answer. That is worse than an
 * error, because it produces a number rather than a complaint.
 */
export function assertCoherent(rates: readonly PayRate[]): void {
  const sorted = [...rates].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

  for (const [index, rate] of sorted.entries()) {
    if (rate.effectiveTo !== null && rate.effectiveTo <= rate.effectiveFrom) {
      throw new PayRateError(
        'BACKWARDS',
        `A rate starting ${rate.effectiveFrom.toISOString().slice(0, 10)} ends before it begins.`,
      );
    }

    const next = sorted[index + 1];
    if (!next) continue;

    if (rate.effectiveTo === null || rate.effectiveTo > next.effectiveFrom) {
      throw new PayRateError(
        'OVERLAP',
        `Two pay rates cover ${next.effectiveFrom.toISOString().slice(0, 10)}. Close the earlier one first.`,
      );
    }
  }
}

/**
 * Closes the open rate and opens a new one from a date.
 *
 * Returns the whole history rather than mutating, so the caller writes one
 * consistent set or none.
 */
export function applyRise(
  rates: readonly PayRate[],
  from: Date,
  costPerHour: Money,
  chargePerHour: Money,
): PayRate[] {
  const next = [...rates]
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
    .map((rate) =>
      rate.effectiveTo === null && rate.effectiveFrom < from
        ? { ...rate, effectiveTo: from }
        : rate,
    );

  next.push({ effectiveFrom: from, effectiveTo: null, costPerHour, chargePerHour });
  assertCoherent(next);
  return next;
}

/**
 * What a stretch of clocked time cost.
 *
 * Splits across a rate change rather than picking one side. A shift that
 * straddles the day a rise took effect is rare, but the alternative is a
 * figure that is quietly wrong once a year per person and impossible to find
 * afterwards.
 */
export function costOfHours(
  rates: readonly PayRate[],
  segments: readonly { at: Date; minutes: number }[],
): Money {
  let total = zero('GBP');

  for (const segment of segments) {
    const rate = rateOn(rates, segment.at);
    if (!rate) continue;
    total = money(
      total.minor + multiply(rate.costPerHour, segment.minutes / 60).minor,
      rate.costPerHour.currency,
    );
  }

  return total;
}
