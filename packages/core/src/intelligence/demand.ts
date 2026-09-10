/**
 * What to reorder, and how much, from what was actually used.
 *
 * Not a forecast in the impressive sense. There is no model here, because a
 * workshop has months of history rather than years and a part that moved four
 * times cannot support anything cleverer than an average. What it does have is
 * an honest one: the average, how much that average moves about, and a plain
 * refusal to answer when there is not enough to go on.
 *
 * The refusal is the feature. A reorder quantity produced from two movements
 * looks exactly like one produced from two hundred, and the person reading it
 * has no way to tell. So every answer carries how many periods it rests on,
 * and below a floor there is no answer at all.
 *
 * Variability is what actually decides the number, not the average. Two parts
 * both selling ten a month need completely different stock levels if one sells
 * ten every month and the other sells sixty once a year. That is the whole
 * reason safety stock exists, and it is why this measures spread rather than
 * just the mean.
 */

/** Below this many periods, say nothing rather than something shaped like an answer. */
export const MIN_PERIODS = 4;

/** Cover for the demand that exceeds the average, at roughly 95%. */
const SAFETY_FACTOR = 1.65;

export interface Usage {
  /** When the stock left. */
  at: Date;
  /** Positive: quantity consumed. */
  quantity: number;
}

export interface DemandProfile {
  /** Whole periods measured, oldest first. */
  periods: number[];
  /** Average consumption in a period. */
  mean: number;
  /** How much a period typically differs from that average. */
  deviation: number;
  /** How many periods this rests on. */
  basis: number;
  /** True when the last third is meaningfully above the first third. */
  rising: boolean;
}

/**
 * Buckets usage into whole periods.
 *
 * Empty periods are kept as zeros, and that matters more than it looks. Drop
 * them and a part used once a quarter reads as a part used every period, which
 * triples the stock the workshop is told to hold.
 */
export function demandProfile(
  usage: readonly Usage[],
  options: { periodDays?: number; now?: Date; periods?: number } = {},
): DemandProfile {
  const periodDays = options.periodDays ?? 30;
  const now = options.now ?? new Date();
  const wanted = options.periods ?? 12;

  const buckets = new Array<number>(wanted).fill(0);

  for (const entry of usage) {
    const age = (now.getTime() - entry.at.getTime()) / 86_400_000;
    const index = wanted - 1 - Math.floor(age / periodDays);

    if (index >= 0 && index < wanted) buckets[index] = (buckets[index] ?? 0) + entry.quantity;
  }

  const mean = buckets.reduce((total, value) => total + value, 0) / buckets.length;

  const variance =
    buckets.reduce((total, value) => total + (value - mean) ** 2, 0) / buckets.length;

  const third = Math.max(1, Math.floor(buckets.length / 3));
  const early = buckets.slice(0, third);
  const late = buckets.slice(-third);

  const averageOf = (values: number[]) =>
    values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

  return {
    periods: buckets,
    mean,
    deviation: Math.sqrt(variance),
    basis: buckets.length,
    // Deliberately a coarse test. A trend line fitted to nine noisy months
    // produces a slope with more confidence in it than the data deserves.
    rising: averageOf(late) > averageOf(early) * 1.25 && averageOf(late) - averageOf(early) >= 1,
  };
}

export type Recommendation =
  | { known: false; reason: string }
  | {
      known: true;
      /** Order when free stock reaches this. */
      reorderAt: number;
      /** Held to absorb the demand that beats the average. */
      safetyStock: number;
      /** How many to order, expressed as weeks of cover. */
      orderQuantity: number;
      basis: number;
      reason: string;
    };

/**
 * When to reorder and how many, or why neither can be said.
 *
 * The reorder point is what will be used while waiting for delivery, plus
 * enough to absorb a busier than average wait. The order quantity is expressed
 * as weeks of cover rather than derived from an economic order formula,
 * because that formula needs the cost of placing an order and the cost of
 * holding stock, and no workshop knows either figure. Inventing them produces
 * a precise number resting on two guesses.
 */
export function recommendReorder(input: {
  profile: DemandProfile;
  /** Days between placing an order and it arriving. */
  leadTimeDays: number;
  /** How long an order should last. */
  coverWeeks?: number;
  periodDays?: number;
}): Recommendation {
  const { profile, leadTimeDays } = input;
  const periodDays = input.periodDays ?? 30;
  const coverWeeks = input.coverWeeks ?? 6;

  const used = profile.periods.filter((value) => value > 0).length;

  if (profile.basis < MIN_PERIODS) {
    return {
      known: false,
      reason: `Only ${profile.basis} months of history. Not enough to tell a pattern from a coincidence.`,
    };
  }

  if (used < 2) {
    return {
      known: false,
      reason:
        used === 0
          ? 'This part has not moved at all in the period measured.'
          : 'This part has moved in only one month, so there is no pattern to measure.',
    };
  }

  const perDay = profile.mean / periodDays;
  const duringLeadTime = perDay * leadTimeDays;

  // Spread scaled to the lead time rather than the period, because the risk
  // being covered is a busy fortnight while waiting, not a busy month.
  const deviationOverLeadTime = profile.deviation * Math.sqrt(leadTimeDays / periodDays);
  const safetyStock = Math.ceil(SAFETY_FACTOR * deviationOverLeadTime);

  const orderQuantity = Math.max(1, Math.ceil(perDay * coverWeeks * 7));

  const volatility = profile.mean > 0 ? profile.deviation / profile.mean : 0;

  const reason =
    volatility > 1
      ? `Usage is uneven: it averages ${profile.mean.toFixed(1)} a month but swings widely, so most of this figure is cover for a busy spell rather than expected use.`
      : profile.rising
        ? `Usage has been rising, so this is based on a recent average that is above the whole period.`
        : `Steady usage of about ${profile.mean.toFixed(1)} a month across ${used} of the last ${profile.basis} months.`;

  return {
    known: true,
    reorderAt: Math.ceil(duringLeadTime + safetyStock),
    safetyStock,
    orderQuantity,
    basis: profile.basis,
    reason,
  };
}

/**
 * Parts whose current setting disagrees with what actually happened.
 *
 * The useful output is not a list of recommendations, which nobody reads, but
 * the handful where the existing reorder point is badly wrong in a direction
 * that costs money: too low and the job stops, too high and the cash sits on
 * a shelf.
 */
export interface Divergence {
  productId: string;
  name: string;
  current: number;
  suggested: number;
  /** Positive means the shelf is holding more than the usage justifies. */
  difference: number;
  direction: 'TOO_LOW' | 'TOO_HIGH';
  reason: string;
}

export function divergences(
  parts: readonly {
    productId: string;
    name: string;
    reorderPoint: number;
    recommendation: Recommendation;
  }[],
  tolerance = 0.5,
): Divergence[] {
  const found: Divergence[] = [];

  for (const part of parts) {
    if (!part.recommendation.known) continue;

    const suggested = part.recommendation.reorderAt;
    const current = part.reorderPoint;

    // A part set to 4 that should be 5 is noise. The threshold is proportional
    // so it means the same thing for a part used twice a year and one used
    // twice a week.
    const floor = Math.max(2, current * tolerance);
    if (Math.abs(suggested - current) < floor) continue;

    found.push({
      productId: part.productId,
      name: part.name,
      current,
      suggested,
      difference: current - suggested,
      direction: suggested > current ? 'TOO_LOW' : 'TOO_HIGH',
      reason: part.recommendation.reason,
    });
  }

  return found.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}
