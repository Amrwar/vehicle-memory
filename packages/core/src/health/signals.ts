/**
 * How a system says how it is. Phase 50.
 *
 * An operator's vocabulary, which is not a workshop's. A workshop asks whether
 * its own work is in order; an operator asks whether the thing everyone's work
 * runs on is in order, and those are different questions with different
 * answers and different readers.
 *
 * Four standings rather than two, because "up or down" is the distinction that
 * makes a status page useless. Almost nothing is down. Things are slow, or
 * retrying, or configured but never yet exercised, and each of those wants a
 * different response at two in the morning: one is an incident, one is a thing
 * to watch, and one is a thing nobody should be woken for.
 *
 * `unknown` is the one people leave out and the one that lies least. A
 * transport nobody has configured is not healthy and is not failed; saying
 * either is a lie, and a green tick beside something that has never sent a
 * message is exactly how a product ends up confidently broken.
 */

export type Standing = 'healthy' | 'degraded' | 'failed' | 'unknown';

/** One thing an operator would look at. */
export interface Signal {
  /** Which panel it belongs under. */
  area: string;
  /** What it is, translatable on its own. */
  name: string;
  standing: Standing;
  /** The figure or sentence behind the standing, filled into `template`. */
  template: string;
  values: Record<string, string | number>;
  /** Plain English, for a script and a log. */
  sentence: string;
}

const RANK: Record<Standing, number> = { failed: 0, degraded: 1, unknown: 2, healthy: 3 };

export function signal(input: {
  area: string;
  name: string;
  standing: Standing;
  template: string;
  values?: Record<string, string | number>;
}): Signal {
  const values = input.values ?? {};

  return {
    area: input.area,
    name: input.name,
    standing: input.standing,
    template: input.template,
    values,
    sentence: fill(input.template, values),
  };
}

/** Fills {slots} the way the translator does, so both read the same. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * How the system is, overall: as bad as its worst part.
 *
 * Averaging would be worse than saying nothing. Nine healthy things and one
 * failed one is a failure, and a page that reports ninety per cent is a page
 * that gets ignored on the day it matters.
 */
export function worstStanding(signals: readonly Signal[]): Standing {
  if (signals.length === 0) return 'unknown';
  return signals.reduce<Standing>(
    (worst, one) => (RANK[one.standing] < RANK[worst] ? one.standing : worst),
    'healthy',
  );
}

/** Worst first, then by area, because that is the order somebody reads in. */
export function worstSignalsFirst(signals: readonly Signal[]): Signal[] {
  return [...signals].sort(
    (a, b) => RANK[a.standing] - RANK[b.standing] || a.area.localeCompare(b.area),
  );
}

/** Only the ones somebody has to do something about. */
export function needsAttention(signals: readonly Signal[]): Signal[] {
  return worstSignalsFirst(signals).filter(
    (one) => one.standing === 'failed' || one.standing === 'degraded',
  );
}

export function describeStanding(standing: Standing): string {
  switch (standing) {
    case 'healthy':
      return 'Working';
    case 'degraded':
      return 'Struggling';
    case 'failed':
      return 'Not working';
    default:
      return 'Never used';
  }
}

/**
 * How many of each, for a page to say in its own words.
 *
 * `describeHealth` composes an English sentence, which is right for a script
 * and useless to a translator: nobody can translate a sentence that was built
 * by joining fragments. A page takes these and fills its own template.
 */
export function standingCounts(signals: readonly Signal[]): Record<Standing, number> {
  return {
    healthy: signals.filter((one) => one.standing === 'healthy').length,
    degraded: signals.filter((one) => one.standing === 'degraded').length,
    failed: signals.filter((one) => one.standing === 'failed').length,
    unknown: signals.filter((one) => one.standing === 'unknown').length,
  };
}

/** The whole board in one line, in English, for a script and a log. */
export function describeHealth(signals: readonly Signal[]): string {
  const counted = (standing: Standing) => signals.filter((one) => one.standing === standing).length;

  const worst = worstStanding(signals);

  if (worst === 'healthy') return `${signals.length} checked, everything working.`;

  const parts = (['failed', 'degraded', 'unknown'] as const)
    .map((standing) =>
      counted(standing) > 0
        ? `${counted(standing)} ${describeStanding(standing).toLowerCase()}`
        : null,
    )
    .filter((part): part is string => part !== null);

  return `${signals.length} checked: ${parts.join(', ')}.`;
}

/* ---------------------------------------------------------------------------
   Reading a number as a standing
   --------------------------------------------------------------------------- */

/**
 * A count against two thresholds.
 *
 * Wrapped rather than written out at each call site because the mistake is
 * always the same one: comparing the wrong way round, so a queue of nought
 * reports as failed on the day somebody is relying on it.
 */
export function fromCount(input: {
  count: number;
  degradedAbove: number;
  failedAbove: number;
}): Standing {
  if (input.count > input.failedAbove) return 'failed';
  if (input.count > input.degradedAbove) return 'degraded';
  return 'healthy';
}

/** An age in seconds against two thresholds: the oldest thing still waiting. */
export function fromAge(input: {
  seconds: number | null;
  degradedAbove: number;
  failedAbove: number;
}): Standing {
  if (input.seconds === null) return 'healthy';
  if (input.seconds > input.failedAbove) return 'failed';
  if (input.seconds > input.degradedAbove) return 'degraded';
  return 'healthy';
}
