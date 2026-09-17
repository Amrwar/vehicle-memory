/**
 * What has to be true of a system that has just come back. Phase 49.
 *
 * A backup is not a file. A backup is the answer to "how much did we lose and
 * how long were we down", and neither of those is knowable from a file
 * existing. The only way to know is to lose the database on purpose, bring it
 * back, and measure — which is what `verify-recovery.ts` does, using the
 * vocabulary here.
 *
 * Two numbers and a list. The numbers are the two a workshop would ask for if
 * it knew to ask: how much work vanished, and how long before the doors opened
 * again. The list is everything that came back wrong, which is the part
 * nobody writes down and everybody needs at three in the morning.
 *
 * The distinction that earns its keep here is between something MISSING and
 * something ORPHANED. A photograph whose file did not come back is a customer
 * opening a report and seeing a hole. A file in the store that no row points
 * at is a bill for storage and, worse, a photograph of somebody's car that
 * nothing will ever delete. Both are failures of the same restore and they are
 * repaired in opposite directions, so a report that lumps them together is a
 * report somebody has to redo by hand.
 */

/** Something that did not come back the way it went in. */
export interface Gap {
  /** What sort of wrongness: repaired in a different direction for each. */
  kind: 'missing' | 'orphaned' | 'broken';
  /** The kind of thing, translatable on its own. */
  what: string;
  /** Which one, as a reference somebody can go and look at. */
  name: string;
  /** One sentence, for a script's output and a runbook's record. */
  sentence: string;
}

/** A restore, measured. */
export interface Recovery {
  /** How much work was lost, in seconds. The recovery point. */
  lost: number;
  /** How long it took to come back, in seconds. The recovery time. */
  took: number;
  /** How many things were held against the original. */
  checked: number;
  gaps: Gap[];
}

/** The promise, from the non-functional requirements. */
export interface Targets {
  /** NFR-304. Seconds of work that may be lost. */
  lost: number;
  /** NFR-303. Seconds the recovery may take. */
  took: number;
}

export const PROMISED: Targets = {
  // Five minutes, which is what continuous archiving buys.
  lost: 5 * 60,
  // One hour.
  took: 60 * 60,
};

function seconds(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

/**
 * How much work a restore lost.
 *
 * The window between the last write that survived and the last write that
 * happened. Not the age of the backup file: a backup taken at midnight from a
 * system nobody touched until morning has lost nothing, and reporting eight
 * hours there would send somebody chasing a problem that does not exist.
 */
export function workLost(input: { lastSurvived: Date; lastHappened: Date }): number {
  return seconds(input.lastSurvived, input.lastHappened);
}

/** How long the doors were shut: from losing it to having it back and checked. */
export function timeTaken(input: { lost: Date; back: Date }): number {
  return seconds(input.lost, input.back);
}

/* ---------------------------------------------------------------------------
   The things that can come back wrong
   --------------------------------------------------------------------------- */

/** A table that came back with fewer rows than it went in with. */
export function rowsMissing(input: { table: string; before: number; after: number }): Gap | null {
  if (input.after === input.before) return null;

  const short = input.before - input.after;

  return {
    kind: short > 0 ? 'missing' : 'orphaned',
    what: 'Table',
    name: input.table,
    sentence:
      short > 0
        ? `${input.table} went in with ${input.before} rows and came back with ${input.after}: ${short} missing.`
        : `${input.table} came back with ${-short} rows more than it went in with.`,
  };
}

/**
 * A row that points at a file the store does not have.
 *
 * The failure a customer sees rather than the one an operator sees: a report
 * with a hole where a photograph was, months after anybody could find the
 * original.
 */
export function fileMissing(input: { what: string; name: string; key: string }): Gap {
  return {
    kind: 'missing',
    what: input.what,
    name: input.name,
    sentence: `${input.what} ${input.name} points at ${input.key}, which is not in the store.`,
  };
}

/**
 * A file in the store that no row points at.
 *
 * Not free and not harmless. It is a photograph of somebody's car that nothing
 * will ever delete, which makes it a data-protection problem as well as a
 * bill.
 */
export function fileOrphaned(input: { key: string }): Gap {
  return {
    kind: 'orphaned',
    what: 'File',
    name: input.key,
    sentence: `${input.key} is in the store and nothing points at it.`,
  };
}

/** Something that came back but no longer holds together. */
export function broken(input: { what: string; name: string; because: string }): Gap {
  return {
    kind: 'broken',
    what: input.what,
    name: input.name,
    sentence: `${input.what} ${input.name} came back broken: ${input.because}.`,
  };
}

/* ---------------------------------------------------------------------------
   Reading the result
   --------------------------------------------------------------------------- */

export function recoveryOf(
  input: { lost: number; took: number; checked: number },
  gaps: readonly (Gap | null)[],
): Recovery {
  return {
    lost: input.lost,
    took: input.took,
    checked: input.checked,
    gaps: gaps.filter((gap): gap is Gap => gap !== null),
  };
}

/** Missing first: a hole is worse than a leftover, and broken is worse still. */
export function worstGapsFirst(gaps: readonly Gap[]): Gap[] {
  const rank = { broken: 0, missing: 1, orphaned: 2 } as const;
  return [...gaps].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Where the measured recovery fell short of what was promised. */
export function missedTargets(recovery: Recovery, targets: Targets = PROMISED): string[] {
  const missed: string[] = [];

  if (recovery.lost > targets.lost) {
    missed.push(
      `Lost ${describeDuration(recovery.lost)} of work against a promise of ${describeDuration(targets.lost)}.`,
    );
  }

  if (recovery.took > targets.took) {
    missed.push(
      `Took ${describeDuration(recovery.took)} to come back against a promise of ${describeDuration(targets.took)}.`,
    );
  }

  return missed;
}

/** A duration the way somebody would say it out loud. */
export function describeDuration(total: number): string {
  if (total < 60) return `${total} second${total === 1 ? '' : 's'}`;

  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.round((total / 3600) * 10) / 10;
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/** The whole drill in one line. */
export function describeRecovery(recovery: Recovery): string {
  const head =
    `Lost ${describeDuration(recovery.lost)} of work, ` +
    `back in ${describeDuration(recovery.took)}, ${recovery.checked} checked`;

  if (recovery.gaps.length === 0) return `${head}, everything came back.`;

  const counted = (kind: Gap['kind']) => recovery.gaps.filter((gap) => gap.kind === kind).length;

  const parts = (['broken', 'missing', 'orphaned'] as const)
    .map((kind) => (counted(kind) > 0 ? `${counted(kind)} ${kind}` : null))
    .filter((part): part is string => part !== null);

  return `${head}, ${parts.join(', ')}.`;
}
