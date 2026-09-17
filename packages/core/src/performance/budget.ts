/**
 * How long a screen is allowed to take, and how long it took. Phase 51.
 *
 * A budget per screen rather than one number for the product, because "the app
 * is slow" is not a thing anybody can fix. A list of fifty rows and a passport
 * with five hundred events have no business being held to the same figure, and
 * holding them to one means either the list is allowed to be sluggish or the
 * passport is permanently failing. Both end the same way: the number gets
 * ignored.
 *
 * The measure is p95 rather than the mean. A mean hides the shape: fifty fast
 * requests and five terrible ones average out to something acceptable, and the
 * five are the ones somebody is sitting in front of. p99 would be better still
 * and needs more samples than a check like this can take in a reasonable time,
 * so p95 it is, said plainly rather than dressed up.
 *
 * Nothing here measures anything. It is the vocabulary: what a budget is, how
 * a set of timings is read, and what counts as over. The measuring is done by
 * `verify-performance.ts`, against a database with a hundred thousand
 * customers in it, because a screen that is quick against six is a screen
 * nobody has tested.
 */

export interface Budget {
  /** The screen, as somebody would name it. */
  screen: string;
  /** Where it lives, for a report somebody can act on. */
  path: string;
  /** p95 must come in under this, in milliseconds. */
  p95: number;
  /** Which non-functional requirement this figure comes from. */
  because: string;
}

export interface Timing {
  screen: string;
  path: string;
  /** Every sample, in milliseconds, in the order they were taken. */
  samples: number[];
  budget: number;
  because: string;
}

/**
 * The p95 of a set of samples.
 *
 * Nearest-rank rather than interpolated: with twenty samples the interpolated
 * figure is a number that no request actually took, and the point of this is to
 * report something that happened.
 */
export function p95Of(samples: readonly number[]): number {
  if (samples.length === 0) return 0;

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;

  return sorted[Math.min(rank, sorted.length - 1)]!;
}

export function medianOf(samples: readonly number[]): number {
  if (samples.length === 0) return 0;

  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

export function worstOf(samples: readonly number[]): number {
  return samples.length === 0 ? 0 : Math.max(...samples);
}

/** Over budget, and by how much. */
export interface Overrun {
  screen: string;
  path: string;
  p95: number;
  budget: number;
  /** How many times over. 1.5 means half again as long as allowed. */
  times: number;
  sentence: string;
}

export function overBudget(timing: Timing): Overrun | null {
  const p95 = p95Of(timing.samples);
  if (p95 <= timing.budget) return null;

  const times = Math.round((p95 / timing.budget) * 10) / 10;

  return {
    screen: timing.screen,
    path: timing.path,
    p95,
    budget: timing.budget,
    times,
    sentence:
      `${timing.screen} (${timing.path}) took ${p95} ms at p95 against a budget of ` +
      `${timing.budget} ms: ${times} times over. ${timing.because}`,
  };
}

/** Slowest against its own budget first, which is not the same as slowest. */
export function worstOverrunsFirst(overruns: readonly Overrun[]): Overrun[] {
  return [...overruns].sort((a, b) => b.times - a.times);
}

/**
 * The ones close enough to the line to be worth knowing about.
 *
 * A screen at ninety per cent of its budget is not a failure and is not fine
 * either: it is the screen that will fail on the first workshop with twice the
 * data. Naming it now is cheaper than finding it later.
 */
export function nearTheLine(timings: readonly Timing[], from = 0.8): Timing[] {
  return timings.filter((timing) => {
    const p95 = p95Of(timing.samples);
    return p95 <= timing.budget && p95 >= timing.budget * from;
  });
}

export function describeTiming(timing: Timing): string {
  const p95 = p95Of(timing.samples);
  const median = medianOf(timing.samples);

  return (
    `${timing.screen}: ${median} ms typical, ${p95} ms at p95, ` +
    `${worstOf(timing.samples)} ms worst, of ${timing.budget} ms allowed`
  );
}

/** The whole run in one line. */
export function describeRun(timings: readonly Timing[]): string {
  const over = timings.map(overBudget).filter((one): one is Overrun => one !== null);

  if (over.length === 0) {
    return `${timings.length} screens measured, all inside budget.`;
  }

  return (
    `${timings.length} screens measured, ${over.length} over budget. ` +
    `Worst: ${worstOverrunsFirst(over)[0]!.screen}.`
  );
}

/* ---------------------------------------------------------------------------
   The shapes that make a screen slow
   --------------------------------------------------------------------------- */

/**
 * A query count against the rows it was asked about.
 *
 * The one failure that does not show up at six rows and ends the product at
 * sixty thousand: a query per row. It is invisible in development, where the
 * loop runs twice, and it is the first thing to look for when a screen is over
 * budget on a large database and fine on a small one.
 */
export function queriesPerRow(input: { queries: number; rows: number }): number {
  if (input.rows === 0) return 0;
  return Math.round((input.queries / input.rows) * 100) / 100;
}

/** Whether a screen asks the database once per row rather than once. */
export function isOncePerRow(input: { queries: number; rows: number }): boolean {
  return input.rows > 2 && queriesPerRow(input) >= 1;
}

/**
 * A list with no bound.
 *
 * Every list has to stop somewhere. A page that renders whatever the database
 * returns is a page that works until a workshop has been open for three years,
 * and then stops working on the worst possible morning — the one where
 * somebody needs to find something.
 */
export function isUnbounded(input: { rows: number; limit: number | null }): boolean {
  return input.limit === null && input.rows > 200;
}
