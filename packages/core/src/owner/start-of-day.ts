/**
 * What happened while we were shut.
 *
 * The plan gives this six words -- "Start-of-day, the mirror of it" -- and the
 * lazy reading of them would be ten more readings and a second record table.
 * That would give the product two morning screens and a ritual nobody needs,
 * because `/morning` already says what to do today and says it better.
 *
 * The question this screen owns, and no other screen can answer, is:
 *
 *   **what arrived while nobody was here, and is what we left last night
 *   still true?**
 *
 * The second half of that is only askable because Phase 96 stored its figures.
 * A close that recomputed itself could never be compared with anything; one
 * that wrote down "three sets of keys were not on a hook" can be asked, at
 * eight the next morning, whether they are now. That is the whole reason this
 * is item 38 and the close is item 37.
 *
 * ## It records nothing
 *
 * The mirror is in the ritual, not in the mechanism. The close stores because
 * its subject is a moment that passes and is otherwise unrecoverable; this
 * screen's subject is **now**, and now is derivable. A second table added for
 * the symmetry of it would be a shape that looks finished, which is the thing
 * this product keeps finding and removing.
 *
 * Phase 97.
 */

import type { Say } from './do-not-miss';
import type { CloseReadingKind } from './close-of-day';

/**
 * Where the night starts.
 *
 * Last night's close, when there was one. A workshop that did not close has no
 * anchor, and that is worth saying rather than papering over with "since this
 * time yesterday" -- partly because it is true, and partly because a screen
 * that quietly works without the close would teach people the close is
 * optional.
 */
export type SinceWhen =
  { kind: 'close'; at: Date; by: string } | { kind: 'nobody-closed'; at: Date };

/**
 * What became of something the close left.
 *
 * `NEW` is not about the night's arrivals -- it is a reading that was nought
 * at the close and is not now, which means it happened while nobody was here.
 * A workshop that locked up with every key on its hook and finds two missing
 * in the morning has learned something that no other screen would ever tell
 * it.
 */
export type OvernightMove = 'SETTLED' | 'STILL_THERE' | 'WORSE' | 'BETTER' | 'NEW';

/**
 * The readings that mean the same thing at six in the evening and eight in the
 * morning, and can therefore be compared across a night.
 *
 * Eight of the close's ten. The two left out are left out for a reason, not an
 * oversight.
 *
 * **`clocked-on` inverts.** At the close it means somebody is still here who
 * should have gone home. In the morning it means people have arrived. Diffing
 * them reports every ordinary morning as something that happened in the dark,
 * and a screen that cries wolf daily is not read by Friday. Who is on the
 * clock is answered properly further down this screen, against the rota.
 *
 * **A till belongs to one day.** Last night's count and this morning's absence
 * of an open session are not two readings of one thing. Comparing them
 * produced the right word -- settled -- for entirely the wrong reason, which
 * is worse than producing the wrong word.
 */
export const COMPARABLE_OVERNIGHT: readonly CloseReadingKind[] = [
  'keys',
  'cars-on-site',
  'open-jobs',
  'unpaid-invoices',
  'estimates-waiting',
  'parts-late',
  'bank-unmatched',
  'follow-ups-due',
];

export function survivesTheNight(kind: CloseReadingKind): boolean {
  return COMPARABLE_OVERNIGHT.includes(kind);
}

export function howItMoved(was: number, is: number): OvernightMove {
  if (was === 0 && is === 0) return 'SETTLED';
  if (was === 0) return 'NEW';
  if (is === 0) return 'SETTLED';
  if (is > was) return 'WORSE';
  if (is < was) return 'BETTER';
  return 'STILL_THERE';
}

/**
 * The order the night's lines are read in.
 *
 * Worse and new first, because both mean something happened in the dark and
 * nobody chose it. Then what is still there, which somebody did choose to
 * leave. Settled last and still shown, because "the keys are back" is the one
 * piece of good news a morning screen ever gets to give, and a screen that
 * dropped it would only ever be a list of complaints.
 */
const MOVE_ORDER: readonly OvernightMove[] = ['NEW', 'WORSE', 'STILL_THERE', 'BETTER', 'SETTLED'];

export interface HandoverLine {
  kind: CloseReadingKind;
  /** As the close recorded it. */
  was: number;
  /** As it stands now. */
  is: number;
  move: OvernightMove;
  what: Say;
  href: string;
}

export function worstMoveFirst(lines: readonly HandoverLine[]): HandoverLine[] {
  return [...lines].sort(
    (a, b) =>
      MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move) ||
      b.is - a.is ||
      a.kind.localeCompare(b.kind),
  );
}

export interface TheHandover {
  since: SinceWhen;
  lines: HandoverLine[];
  /** Worse or new: nobody chose these. */
  happenedInTheDark: HandoverLine[];
  /** Nothing moved and nothing was left. */
  quiet: boolean;
}

export function theHandover(since: SinceWhen, lines: readonly HandoverLine[]): TheHandover {
  // Filtered here rather than left to the caller: a rule about which readings
  // may be compared belongs with the comparison, and a caller that forgot
  // would produce a plausible screen that is wrong every morning.
  const ordered = worstMoveFirst(lines.filter((one) => survivesTheNight(one.kind)));
  return {
    since,
    lines: ordered,
    happenedInTheDark: ordered.filter((one) => one.move === 'NEW' || one.move === 'WORSE'),
    quiet: ordered.every((one) => one.move === 'SETTLED'),
  };
}

/* ---------------------------------------------------------------------------
   Who is expected, and who is here
   --------------------------------------------------------------------------- */

/**
 * The rota against the clock.
 *
 * The product has known who is expected since Phase 48 -- a working pattern
 * per weekday, less an approved absence -- and it has known who has clocked on
 * since Phase 23. Nothing has ever put the two side by side, which is the
 * question somebody actually asks at ten past eight.
 *
 * Nobody is accused of anything. Half past eight is not late for a workshop
 * that opens at nine, and this says who is not here yet rather than who is
 * late, because the product does not know the difference and the person
 * reading it does.
 */
export interface WhoIsIn {
  expected: { employeeId: string; name: string }[];
  here: { employeeId: string; name: string }[];
  /** Expected, not yet clocked on. */
  notYet: { employeeId: string; name: string }[];
  /** Clocked on and not expected today: a swap nobody recorded, or an error. */
  unexpected: { employeeId: string; name: string }[];
}

export function whoIsIn(
  expected: readonly { employeeId: string; name: string }[],
  here: readonly { employeeId: string; name: string }[],
): WhoIsIn {
  const hereIds = new Set(here.map((one) => one.employeeId));
  const expectedIds = new Set(expected.map((one) => one.employeeId));

  return {
    expected: [...expected],
    here: [...here],
    notYet: expected.filter((one) => !hereIds.has(one.employeeId)),
    unexpected: here.filter((one) => !expectedIds.has(one.employeeId)),
  };
}

/* ---------------------------------------------------------------------------
   The line at the top
   --------------------------------------------------------------------------- */

/**
 * What the night looked like, in one sentence.
 *
 * A quiet night is the common case and deserves to be said plainly. A screen
 * whose best answer was an empty area would have people opening the other
 * seven to check.
 */
export function howTheNightWent(handover: TheHandover): Say {
  if (handover.since.kind === 'nobody-closed') {
    return { key: 'Nobody closed the day yesterday, so there is nothing to compare this against.' };
  }
  if (handover.quiet) return { key: 'A quiet night. Everything the close left is settled.' };

  const dark = handover.happenedInTheDark.length;
  if (dark === 0) return { key: 'Nothing happened overnight that nobody chose.' };
  return dark === 1
    ? { key: '1 thing changed overnight that nobody chose.' }
    : { key: '{count} things changed overnight that nobody chose.', vars: { count: dark } };
}
