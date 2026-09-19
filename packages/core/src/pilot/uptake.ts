/**
 * What nobody used. Phase 54.
 *
 * The pilot's exit asks for four lists: what broke, what was slow, what was
 * missing and what nobody used. Three of those the product could already
 * answer. Errors show on the operator's page, slowness has a budget per screen
 * and a clock for the work itself, and what is missing is what the workshop
 * says out loud.
 *
 * The fourth had no answer at all, and it is the one that matters most for a
 * product with this much in it. At the end of four weeks somebody has to say
 * which capabilities the workshop never touched — and "I don't think they used
 * the gift cards" is not an answer, it is a recollection. So uptake is counted
 * from the audit log, which has recorded every write since the first phase and
 * was never read for this.
 *
 * The honest limit, stated here rather than discovered later: this counts
 * writing, not looking. A workshop that opens a vehicle's passport forty times
 * a week and never adds to it will show as never having used it, and that is
 * wrong in a way worth knowing about before anybody reads the figure. Reading
 * is not audited, deliberately — an audit log that records who looked at what
 * is a surveillance log — so this reports what it can and says what it cannot.
 */

export interface Capability {
  /** What a person would call it. */
  name: string;
  /** Which part of the product it belongs to. */
  area: string;
  /** The audited actions that mean somebody used it. */
  actions: readonly string[];
  /**
   * Whether a workshop that never touches this is fine.
   *
   * Most of the product is optional: a garage with no fleet customers should
   * not be marked down for never opening the fleet pages. A handful is not —
   * a workshop that never issued an invoice in four weeks was not using the
   * product, and that is a finding rather than a preference.
   */
  expected: boolean;
}

export interface Uptake {
  surface: Capability;
  /** How many times anybody did it. */
  times: number;
  /** How many different people did it. */
  people: number;
  /** The last time, if ever. */
  last: Date | null;
}

export type UptakeVerdict =
  /** Used, and by more than one person. */
  | 'taken up'
  /** Used, by one person, or barely. */
  | 'one pair of hands'
  /** Never touched, and that is worth asking about. */
  | 'untouched'
  /** Never touched, and nobody said it would be. */
  | 'not for them';

/** Below this, one person doing something twice is not uptake. */
export const BARELY = 3;

export function uptakeVerdictOf(uptake: Uptake): UptakeVerdict {
  if (uptake.times === 0) return uptake.surface.expected ? 'untouched' : 'not for them';
  if (uptake.people === 1 || uptake.times < BARELY) return 'one pair of hands';
  return 'taken up';
}

/**
 * The ones to ask about, worst first.
 *
 * A capability the pilot expected and nobody touched is the first question of
 * the debrief. One that only ever had a single person on it is the second:
 * either it is one person's job, or everybody else could not find it.
 *
 * Nothing else belongs here. What plainly worked needs no conversation, and
 * neither does something nobody expected this workshop to use — a garage with
 * no fleet customers not opening the fleet pages is the register agreeing with
 * itself. This was first written to keep those at the end as context, which
 * read well in a unit test and badly on the page: forty-one capabilities went
 * in and forty came out, so the shortlist was the whole list with one row
 * missing. The full picture is a few centimetres below it, laid out by area.
 */
export function worthAsking(all: readonly Uptake[]): Uptake[] {
  const rank: Record<UptakeVerdict, number> = {
    untouched: 0,
    'one pair of hands': 1,
    'not for them': 2,
    'taken up': 3,
  };

  return [...all]
    .filter((one) => rank[uptakeVerdictOf(one)] < rank['not for them'])
    .sort((a, b) => rank[uptakeVerdictOf(a)] - rank[uptakeVerdictOf(b)] || a.times - b.times);
}

export function describeUptake(uptake: Uptake): string {
  const verdict = uptakeVerdictOf(uptake);

  if (uptake.times === 0) {
    return verdict === 'untouched'
      ? `${uptake.surface.name}: nobody used it, and the pilot expected somebody would.`
      : `${uptake.surface.name}: nobody used it, which nobody said they would.`;
  }

  return (
    `${uptake.surface.name}: ${uptake.times} time${uptake.times === 1 ? '' : 's'} ` +
    `by ${uptake.people} ${uptake.people === 1 ? 'person' : 'people'}.`
  );
}

/** The whole picture in one line. */
export function describeTakeUp(all: readonly Uptake[]): string {
  const counted = (verdict: UptakeVerdict) =>
    all.filter((one) => uptakeVerdictOf(one) === verdict).length;

  return (
    `${all.length} capabilities: ${counted('taken up')} taken up, ` +
    `${counted('one pair of hands')} on one pair of hands, ` +
    `${counted('untouched')} untouched, ` +
    `${counted('not for them')} not for this workshop.`
  );
}

/* ---------------------------------------------------------------------------
   The four lists the pilot has to produce
   --------------------------------------------------------------------------- */

export type FindingKind = 'broke' | 'slow' | 'missing' | 'unused';

export interface PilotFinding {
  kind: FindingKind;
  what: string;
  /** Where it came from, so nobody has to take it on trust. */
  from: string;
}

/**
 * Whether the pilot can produce its own exit.
 *
 * Asked before the pilot rather than after it. Four weeks is a long time to
 * find out that nobody wrote down what broke, and the answer to "how will we
 * know?" is not a promise to pay attention.
 */
export function canReport(sources: Record<FindingKind, boolean>): {
  ready: boolean;
  missing: FindingKind[];
} {
  const missing = (Object.keys(sources) as FindingKind[]).filter((kind) => !sources[kind]);

  return { ready: missing.length === 0, missing };
}
