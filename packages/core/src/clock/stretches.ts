/**
 * How long the workshop takes, rather than how long the software takes.
 * Phase 52.
 *
 * Phase 51 measured the product: a screen answers in a fifth of a second. This
 * measures the thing the product is for, which is a different question and a
 * harder one to be honest about. A garage does not care that the invoice page
 * renders in 130ms. It cares that a car arrived at ten past eight and nobody
 * wrote a job until twenty past nine.
 *
 * Every number here comes from timestamps the product already keeps because it
 * needed them for something else. Nothing is instrumented specially, which
 * matters: a measurement that exists only to be measured is a measurement
 * somebody eventually games, and one taken from the records of the work itself
 * cannot be.
 *
 * Three things make the difference between a figure worth acting on and a
 * figure worth ignoring.
 *
 * **The median, not the mean.** One car left over a bank holiday weekend adds
 * three days to an average and tells nobody anything. The median says what
 * usually happens, which is the thing a workshop can actually change.
 *
 * **Coverage, stated.** Most of these can only be measured where both moments
 * were recorded, and for a lot of jobs one of them never was. A median over
 * three jobs out of five hundred is not a number; it is an anecdote with a
 * decimal point. Every stretch carries how many it could measure out of how
 * many it looked at, and a stretch that could not see enough says so instead
 * of reporting.
 *
 * **A target that is a judgement, and says so.** None of these come from a
 * requirement. They are what a good workshop would recognise as reasonable,
 * written down so that a slow one is a conversation rather than a shrug.
 */

export interface Stretch {
  /** What the gap is, in the words somebody would use for it. */
  name: string;
  /**
   * The two moments, as one sentence.
   *
   * One phrase rather than a start and an end to be joined, because joining
   * them is a trap: "De" + "le début du contrôle" is not French, and a page
   * that builds a sentence out of fragments will produce something nobody
   * would say in at least one of the languages it is offered in.
   */
  span: string;
  /** What a good workshop would call reasonable, in seconds. A judgement. */
  target: number;
  /** Why that figure, so a disagreement is about the reason. */
  because: string;
}

export interface Measured {
  stretch: Stretch;
  /** Every gap that could be measured, in seconds. */
  samples: number[];
  /** How many candidates there were, measurable or not. */
  candidates: number;
}

/** Below this, a median is an anecdote with a decimal point. */
export const ENOUGH = 5;

export function medianSeconds(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

/**
 * The slow tail, which is where the complaints come from.
 *
 * A workshop whose median is twenty minutes and whose ninetieth percentile is
 * two days has a process that works and something that regularly escapes it.
 * The median alone hides that completely.
 */
export function slowestTenth(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.9 * sorted.length) - 1;

  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]!;
}

/** What share of the candidates could be measured at all. */
export function coverage(measured: Measured): number {
  if (measured.candidates === 0) return 0;
  return Math.round((measured.samples.length / measured.candidates) * 1000) / 10;
}

export type ClockVerdict =
  /** Inside the target. */
  | 'good'
  /** Over the target, and measured on enough to mean it. */
  | 'slow'
  /** Too few to say anything, whatever the figures look like. */
  | 'unknown';

export function verdictOf(measured: Measured): ClockVerdict {
  if (measured.samples.length < ENOUGH) return 'unknown';

  const median = medianSeconds(measured.samples);
  if (median === null) return 'unknown';

  return median <= measured.stretch.target ? 'good' : 'slow';
}

/**
 * A duration as somebody would say it, not as a computer would print it.
 *
 * Rounded to the unit that matters: nobody says a job took 7,412 seconds, and
 * nobody cares whether it was two hours and three minutes or two hours and
 * four.
 */
export function describeSeconds(total: number): string {
  const { template, values } = secondsAs(total);
  return template.replace('{count}', String(values.count));
}

/**
 * The same, with the number left as a slot.
 *
 * A page has to translate this and a script does not, and "9" plus "minutes"
 * does not join the same way in every language — so the whole phrase is the
 * key and the figure is filled into it, rather than the two being stuck
 * together and hoped over.
 */
export function secondsAs(total: number): { template: string; values: { count: number } } {
  if (total < 90) return { template: '{count} seconds', values: { count: Math.round(total) } };

  const minutes = Math.round(total / 60);
  if (minutes < 90) return { template: '{count} minutes', values: { count: minutes } };

  const hours = Math.round((total / 3600) * 10) / 10;
  if (hours < 36) return { template: '{count} hours', values: { count: hours } };

  return { template: '{count} days', values: { count: Math.round((total / 86_400) * 10) / 10 } };
}

export function describeMeasured(measured: Measured): string {
  const seen = measured.samples.length;

  if (seen < ENOUGH) {
    return (
      `${measured.stretch.name}: only ${seen} of ${measured.candidates} could be measured, ` +
      'which is not enough to say anything.'
    );
  }

  const median = medianSeconds(measured.samples)!;
  const tail = slowestTenth(measured.samples)!;

  return (
    `${measured.stretch.name}: usually ${describeSeconds(median)}, ` +
    `slowest tenth ${describeSeconds(tail)}, ` +
    `target ${describeSeconds(measured.stretch.target)}, ` +
    `from ${seen} of ${measured.candidates}.`
  );
}

/* ---------------------------------------------------------------------------
   Before and after
   --------------------------------------------------------------------------- */

/** One stretch, as it was on a day somebody wrote it down. */
export interface Recorded {
  name: string;
  median: number | null;
  slowestTenth: number | null;
  seen: number;
  candidates: number;
}

export function record(measured: Measured): Recorded {
  return {
    name: measured.stretch.name,
    median: medianSeconds(measured.samples),
    slowestTenth: slowestTenth(measured.samples),
    seen: measured.samples.length,
    candidates: measured.candidates,
  };
}

export interface Change {
  name: string;
  before: number | null;
  after: number | null;
  /** Negative is faster. Seconds. */
  by: number | null;
  /** Whether the two runs saw enough to be compared at all. */
  comparable: boolean;
  sentence: string;
}

/**
 * What changed between two days somebody measured.
 *
 * The exit for this phase is "measured before a pilot and again after", and
 * the thing that makes that a real sentence rather than a hopeful one is
 * refusing to compare two figures that were not measured on enough work. A
 * pilot that moves a median from twelve minutes to four, on three jobs each
 * side, has moved nothing that anybody can rely on.
 */
export function changed(before: Recorded, after: Recorded): Change {
  const comparable =
    before.seen >= ENOUGH &&
    after.seen >= ENOUGH &&
    before.median !== null &&
    after.median !== null;

  if (!comparable) {
    return {
      name: after.name,
      before: before.median,
      after: after.median,
      by: null,
      comparable: false,
      sentence:
        `${after.name}: not enough work measured on one side or the other ` +
        `(${before.seen} then, ${after.seen} now) to compare them.`,
    };
  }

  const by = after.median! - before.median!;
  const direction = by < 0 ? 'faster' : by > 0 ? 'slower' : 'the same';

  return {
    name: after.name,
    before: before.median,
    after: after.median,
    by,
    comparable: true,
    sentence:
      by === 0
        ? `${after.name}: the same, at ${describeSeconds(after.median!)}.`
        : `${after.name}: ${describeSeconds(Math.abs(by))} ${direction}, ` +
          `${describeSeconds(before.median!)} to ${describeSeconds(after.median!)}.`,
  };
}

/** Worst first: the stretch furthest past its target is where to start. */
export function worstStretchesFirst(all: readonly Measured[]): Measured[] {
  const over = (one: Measured) => {
    const median = medianSeconds(one.samples);
    if (median === null || one.samples.length < ENOUGH) return -1;
    return median / one.stretch.target;
  };

  return [...all].sort((a, b) => over(b) - over(a));
}

/** The whole day's measurement in one line. */
export function describeClock(all: readonly Measured[]): string {
  const slow = all.filter((one) => verdictOf(one) === 'slow').length;
  const unknown = all.filter((one) => verdictOf(one) === 'unknown').length;

  if (slow === 0 && unknown === 0) {
    return `${all.length} stretches measured, all inside what a good workshop would take.`;
  }

  const parts: string[] = [];
  if (slow > 0) parts.push(`${slow} slower than they should be`);
  if (unknown > 0) parts.push(`${unknown} with too little to go on`);

  return `${all.length} stretches measured: ${parts.join(', ')}.`;
}
