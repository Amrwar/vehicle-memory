/**
 * Where to buy a part, and why not the cheap one.
 *
 * A workshop buying a brake disc has four questions and a parts screen that
 * answers one of them. What does it cost, have they got it, when does it get
 * here, and how long do they stand behind it. Price alone is the answer that
 * looks like thrift and is not: a disc four pounds cheaper that arrives the
 * day after the car was promised costs a courtesy car, an apology and an
 * afternoon, and the four pounds were never the number.
 *
 * So the comparison is on all four, and the ranking is not a score. Scores
 * hide their reasoning and cannot be argued with, and the person buying the
 * part has to be able to say "no, they let us down last month" and overrule
 * it. What this produces instead is a recommendation and a sentence: this
 * one, and here is the cheaper one we passed over, and why.
 *
 * The dates are the load-bearing part. `neededBy` is the day the car is
 * promised, and an offer that cannot make it is not ranked below the others,
 * it is in a different group with the reason on it. Nothing here silently
 * drops an offer -- the buyer sees every supplier who sells the part, in
 * order, with the arithmetic shown.
 *
 * Phase 87.
 */

/** One supplier's answer for one part, as somebody here recorded it. */
export interface SupplierOffer {
  supplierId: string;
  supplierName: string;
  /** Their part number for it, where it differs from ours. */
  supplierPartNumber?: string | null;
  brand?: string | null;
  /** Trade price, ex tax, in the workshop's currency. */
  price: number;
  /** Calendar days from ordering to the counter. Null: nobody has said. */
  leadTimeDays: number | null;
  /** On their shelf now. Null: nobody has said. */
  inStock: boolean | null;
  /** How long they stand behind it. Null: nobody has said. */
  warrantyMonths: number | null;
  /** When somebody here last confirmed all of the above. */
  confirmedAt: Date;
}

/**
 * How old a price may be before it is a memory rather than a quote.
 *
 * Ninety days is a quarter, which is roughly how often trade prices move, and
 * a number small enough that most of a workshop's list will be stale most of
 * the time. That is the point. A screen that showed a two-year-old price with
 * the confidence of today's is how somebody quotes a customer a figure they
 * cannot buy at, and the argument happens at the counter.
 */
export const PRICE_STALE_AFTER_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

/** Whether nobody has confirmed this offer recently enough to quote from it. */
export function isStale(offer: SupplierOffer, now: Date): boolean {
  return now.getTime() - offer.confirmedAt.getTime() > PRICE_STALE_AFTER_DAYS * DAY;
}

/** The day it would arrive if ordered now, where the lead time is known. */
export function arrivesOn(offer: SupplierOffer, now: Date): Date | null {
  if (offer.leadTimeDays === null) return null;
  // On the shelf means today, whatever the delivery lead time says: the lead
  // time is how long it takes them to get one in, not how long to hand it over.
  const days = offer.inStock === true ? 0 : offer.leadTimeDays;
  return new Date(now.getTime() + days * DAY);
}

/**
 * Three states and never two, the same as fitment: it arrives in time, it does
 * not, or nobody has said. An unknown lead time is not "in time" -- silence
 * read as approval is how the wrong thing gets ordered.
 */
export type Arrival = 'IN_TIME' | 'TOO_LATE' | 'UNKNOWN';

export function arrival(offer: SupplierOffer, now: Date, neededBy?: Date | null): Arrival {
  const when = arrivesOn(offer, now);
  if (when === null) return 'UNKNOWN';
  if (!neededBy) return 'IN_TIME';
  return when.getTime() <= neededBy.getTime() ? 'IN_TIME' : 'TOO_LATE';
}

export interface RankedOffer extends SupplierOffer {
  arrival: Arrival;
  arrivesOn: Date | null;
  stale: boolean;
}

/**
 * Every offer, best first.
 *
 * In time before unknown before too late, then cheapest, then the longer
 * warranty, then the shorter wait. Warranty breaks a price tie on purpose:
 * two suppliers at the same money and one stands behind it twice as long is
 * not a coin toss.
 */
export function rankOffers(
  offers: readonly SupplierOffer[],
  options: { now: Date; neededBy?: Date | null },
): RankedOffer[] {
  const order: Record<Arrival, number> = { IN_TIME: 0, UNKNOWN: 1, TOO_LATE: 2 };

  return offers
    .map((offer) => ({
      ...offer,
      arrival: arrival(offer, options.now, options.neededBy),
      arrivesOn: arrivesOn(offer, options.now),
      stale: isStale(offer, options.now),
    }))
    .sort(
      (a, b) =>
        order[a.arrival] - order[b.arrival] ||
        a.price - b.price ||
        (b.warrantyMonths ?? 0) - (a.warrantyMonths ?? 0) ||
        (a.leadTimeDays ?? 9999) - (b.leadTimeDays ?? 9999) ||
        a.supplierName.localeCompare(b.supplierName),
    );
}

/** Why the cheapest was not the choice. Null when it was. */
export type PassedOver = 'TOO_LATE' | 'NO_DELIVERY_DATE';

export interface TheChoice {
  pick: RankedOffer;
  /** Every offer, ranked, including the pick. */
  all: RankedOffer[];
  /** A cheaper offer that was not taken, where there is one. */
  cheaper: RankedOffer | null;
  /** What was wrong with it. */
  passedOver: PassedOver | null;
  /** What it would have saved, to the penny. */
  saving: number;
}

/**
 * The recommendation, and the argument against it in the same breath.
 *
 * A screen that shows a pick and hides the cheaper option it rejected gets
 * overruled the first time somebody notices, and then it is never trusted
 * again. Naming the saving is the honest version: seven pounds, two days
 * late -- now you decide.
 */
export function theChoice(
  offers: readonly SupplierOffer[],
  options: { now: Date; neededBy?: Date | null },
): TheChoice | null {
  const all = rankOffers(offers, options);
  const pick = all[0];
  if (!pick) return null;

  const cheaper = all.find((offer) => offer.price < pick.price) ?? null;

  return {
    pick,
    all,
    cheaper,
    passedOver: cheaper ? (cheaper.arrival === 'TOO_LATE' ? 'TOO_LATE' : 'NO_DELIVERY_DATE') : null,
    saving: cheaper ? Math.round((pick.price - cheaper.price) * 100) / 100 : 0,
  };
}

/**
 * What a list of offers does not answer yet, so the screen can ask for it.
 *
 * Derived rather than stored: the moment somebody fills a lead time in, the
 * gap closes on its own. A "complete your supplier data" flag would need
 * clearing by hand and would be wrong the day after it was set.
 */
export function gapsInOffers(offers: readonly SupplierOffer[], now: Date): string[] {
  const gaps: string[] = [];
  if (offers.length === 0) return ['no supplier priced'];
  if (offers.every((offer) => offer.leadTimeDays === null)) gaps.push('no delivery time');
  if (offers.every((offer) => offer.inStock === null)) gaps.push('no stock answer');
  if (offers.every((offer) => offer.warrantyMonths === null)) gaps.push('no warranty');
  if (offers.every((offer) => isStale(offer, now))) gaps.push('every price is old');
  return gaps;
}

/**
 * What they say against what they have done.
 *
 * A quoted lead time is a promise, and Phase 52 has measured how often each
 * supplier keeps theirs ever since — a median wait, a share of deliveries
 * that arrived by the day promised, taken from real purchase orders. The two
 * numbers were never put beside each other, so a supplier could quote next-day
 * on a screen while their own record said they make it two thirds of the time,
 * and nothing ever said so.
 *
 * Seventy per cent is the line. It is low on purpose: a supplier who is late
 * one time in four is a supplier a workshop can plan around, and one who is
 * late one time in three is a supplier whose promise should be read aloud with
 * the record attached. Below the minimum number of orders there is no verdict
 * at all — three late deliveries out of four is not a pattern, it is a bad
 * month, and `measureSupplier` already refuses to state a figure without
 * enough orders behind it, which is why `onTimePct` arrives null.
 */
export const KEEPS_ITS_WORD_PCT = 70;

export type PromiseRecord = 'KEEPS' | 'SLIPS' | 'UNMEASURED';

export function promiseVersusRecord(onTimePct: number | null): PromiseRecord {
  if (onTimePct === null) return 'UNMEASURED';
  return onTimePct >= KEEPS_ITS_WORD_PCT ? 'KEEPS' : 'SLIPS';
}
