/**
 * What the screen does while somebody waits. Phase 60. NFR-105, NFR-107.
 *
 * Phase 51 measured the server: how long the application took to produce the
 * bytes, at the size of a real workshop. That is half of what a person
 * experiences and the half that was going wrong, so it was the right half to
 * do first. It says nothing at all about the other half — how long after those
 * bytes arrive the screen actually shows the thing somebody came for, and
 * whether it stays still once it does.
 *
 * Two numbers, both from the requirements rather than invented here:
 *
 *   Largest Contentful Paint, under two seconds on a 4G connection (NFR-105).
 *     When the biggest thing on the screen finishes drawing. A fair proxy for
 *     "I can see what I came for", and the reason it is the biggest thing is
 *     that on a job page that is the job, on an invoice it is the invoice.
 *
 *   Cumulative Layout Shift, under 0.1 (NFR-107). How much the page moves
 *     under the reader after it has started reading. The failure this catches
 *     is the one everybody has met: reaching for a button and pressing
 *     something else because the page jumped.
 *
 * What this cannot do is measure a person. NFR-106 asks for Interaction to
 * Next Paint across the application, and that is a field measurement — it
 * needs real fingers on real devices, which means the pilot. It stays written
 * down as enforced by nothing rather than quietly folded in here, because a
 * number taken from an emulator and labelled with a field metric's name is
 * worse than no number.
 */

export type Metric = 'lcp' | 'cls';

export interface PaintBudget {
  metric: Metric;
  /** Milliseconds for lcp; an unitless score for cls. */
  limit: number;
  /** Where the figure comes from, so a disagreement is about the requirement. */
  because: string;
  /** How to say it, since one of these is a time and the other is not. */
  unit: 'ms' | 'score';
}

export const PAINT: Record<Metric, PaintBudget> = {
  lcp: {
    metric: 'lcp',
    limit: 2_000,
    because: 'NFR-105: Largest Contentful Paint under 2.0 s on a 4G connection.',
    unit: 'ms',
  },
  cls: {
    metric: 'cls',
    limit: 0.1,
    because: 'NFR-107: Cumulative Layout Shift under 0.1.',
    unit: 'score',
  },
};

/**
 * The connection, named rather than implied.
 *
 * These are the figures a throttled run is given, and they are stated here so
 * that "on a 4G connection" is a claim somebody can disagree with. They are
 * the profile Lighthouse calls Slow 4G, which is deliberately pessimistic: a
 * workshop's own wifi is better than this, and the customer standing in a car
 * park opening a shared passport very often is not.
 *
 * The processor is slowed as well. A telephone is not a laptop, and a page
 * measured only over a slow network on a fast machine flatters itself.
 */
export const FOUR_G = {
  name: 'Slow 4G, on a telephone-speed processor',
  downloadKbps: 1_600,
  uploadKbps: 750,
  latencyMs: 150,
  processorSlowdown: 4,
} as const;

export interface Painted {
  /** The screen, as somebody would name it. */
  screen: string;
  path: string;
  metric: Metric;
  /** Every reading, in the order taken. */
  samples: number[];
}

export type PaintVerdict = 'within' | 'near' | 'over' | 'nothing to say';

/**
 * The middle reading, not the best and not the worst.
 *
 * Three runs of the same page over an emulated connection differ by more than
 * anybody would like, and the median of three is the cheapest honest answer:
 * the best of three is a number chosen for being flattering, and the worst is
 * one bad garbage collection.
 */
export function middle(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Within four fifths of the budget is worth saying before it is worth failing. */
export const NEAR = 0.8;

export function paintVerdict(painted: Painted): PaintVerdict {
  if (painted.samples.length === 0) return 'nothing to say';

  const budget = PAINT[painted.metric];
  const reading = middle(painted.samples);

  if (reading > budget.limit) return 'over';
  if (reading >= budget.limit * NEAR) return 'near';
  return 'within';
}

/** How a reading is written down, because one of these is a time and one is not. */
export function say(metric: Metric, value: number): string {
  return PAINT[metric].unit === 'ms' ? `${Math.round(value)} ms` : value.toFixed(3);
}

export function describePaint(painted: Painted): string {
  const budget = PAINT[painted.metric];

  if (painted.samples.length === 0) {
    return `${painted.screen}: nothing was measured, so nothing is claimed.`;
  }

  const reading = middle(painted.samples);
  const verdict = paintVerdict(painted);

  const how =
    verdict === 'over' ? 'over' : verdict === 'near' ? 'near the line at' : 'within budget at';

  return (
    `${painted.screen} — ${painted.metric.toUpperCase()} ${how} ${say(painted.metric, reading)} ` +
    `of ${say(painted.metric, budget.limit)}.`
  );
}

/** Worst first, because that is where to start. */
export function worstPaintFirst(all: readonly Painted[]): Painted[] {
  const over = (one: Painted) => {
    const budget = PAINT[one.metric];
    return one.samples.length === 0 ? -1 : middle(one.samples) / budget.limit;
  };

  return [...all].sort((a, b) => over(b) - over(a));
}

/** The whole run in one line. */
export function describePaintRun(all: readonly Painted[]): string {
  const count = (verdict: PaintVerdict) =>
    all.filter((one) => paintVerdict(one) === verdict).length;

  return (
    `${all.length} readings: ${count('within')} within budget, ` +
    `${count('near')} near the line, ${count('over')} over, ` +
    `${count('nothing to say')} not measured.`
  );
}
