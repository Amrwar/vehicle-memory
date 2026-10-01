/**
 * What was true when the doors shut.
 *
 * The morning list (`do-not-miss.ts`) asks what to do about today. This asks
 * the opposite question at the other end of it: what is being left, and did
 * anybody look.
 *
 * Ten readings, every one of them derived from records the product already
 * keeps for other reasons -- the till session, the attendance clock, the key
 * events, the checks in and out, the job statuses, the invoices, the estimate
 * shares, the purchase orders, the follow-ups. Nothing is instrumented for
 * this screen and nothing new is asked of anybody.
 *
 * ## The close changes nothing
 *
 * It does not invoice a job, write off an invoice, clock anybody out or move a
 * penny. A close that could tidy would be used to tidy, and then the record of
 * what was outstanding would become a record of what somebody made disappear
 * -- which is worse than no record, because it reads like one.
 *
 * ## A close with things outstanding is still a close
 *
 * Six at night with three cars on the forecourt, the workshop locks up anyway.
 * A system that refused would be worked around by not opening it. So every
 * reading is recorded whatever it says, and the record carries what was left.
 *
 * But three of the ten are different in kind, and the screen says so. A car on
 * site overnight is ordinary. **Keys nobody can place, a till that disagrees
 * with what it took, and somebody the product still thinks is in the building**
 * are not ordinary, and a close that listed them in the same voice as "four
 * jobs open" would have taught people to read the whole list in that voice.
 *
 * ## Why the figures are stored
 *
 * Everything else in this product is derived and nothing is stored twice
 * (ADR-0011). A close is the exception and ADR-0020 is the argument: it is
 * testimony about a moment, not a running total. If it recomputed itself, an
 * invoice paid at twenty to seven would silently rewrite what was true at four
 * minutes past, and a record that rewrites itself is not a record of anything.
 *
 * Phase 96.
 */

import type { Say } from './do-not-miss';

/**
 * The ten, in the order the screen reads them.
 *
 * Money first because the till can only be counted while somebody is standing
 * at it; then the people, then the cars and their keys, then the paperwork,
 * which keeps until morning. The order is the order somebody walks the
 * building in, not the order a database would return.
 */
export const CLOSE_READINGS = [
  'till',
  'clocked-on',
  'keys',
  'cars-on-site',
  'open-jobs',
  'unpaid-invoices',
  'estimates-waiting',
  'parts-late',
  'bank-unmatched',
  'follow-ups-due',
] as const;

export type CloseReadingKind = (typeof CLOSE_READINGS)[number];

/**
 * The three that should not be left overnight.
 *
 * Not a severity ranking -- a kind. Keys nobody can place means a car that can
 * be driven away by somebody who should not have it. A till that disagrees
 * means the difference is already unexplainable and gets less explainable by
 * morning, when nobody remembers the afternoon. And somebody still clocked on
 * at eleven is either being paid for sleeping or is actually still in the
 * building, and the product cannot tell which, which is the whole problem.
 *
 * Everything else on the list is ordinary business that a workshop leaves out
 * overnight every night of its life.
 */
export const SHOULD_NOT_BE_LEFT: readonly CloseReadingKind[] = ['keys', 'till', 'clocked-on'];

export function shouldNotBeLeft(kind: CloseReadingKind): boolean {
  return SHOULD_NOT_BE_LEFT.includes(kind);
}

/**
 * One of the ten, as it stood.
 *
 * `CloseReading` and not `Reading`: `vehicle/mileage.ts` has owned that word
 * for an odometer reading since Phase 5, and core's barrel is flat, so a
 * second `Reading` does not collide loudly -- it simply loses, silently, and
 * every literal written against it is checked against odometers instead. The
 * name also matches the database enum, so the type and the column say the same
 * word about the same thing.
 */
export interface CloseReading {
  kind: CloseReadingKind;
  /** How many, or how much. Nought means there is nothing to say. */
  count: number;
  /** What is true, as a key and its values. Never a built sentence. */
  what: Say;
  /** Where somebody would go to deal with it. */
  href: string;
}

/** A reading with nothing to report. */
export function settled(reading: CloseReading): boolean {
  return reading.count === 0;
}

/**
 * What the close says, as a whole.
 *
 * `clear` is a real answer and a good one: everything counted, everybody out,
 * every key on its hook. It is also rare, and a screen that only ever showed
 * problems would never show a workshop that it had had a tidy day.
 */
export interface TheClose {
  readings: CloseReading[];
  /** The ones that should not be left, and were not nought. */
  leftOvernight: CloseReading[];
  /** Outstanding, but ordinary. */
  outstanding: CloseReading[];
  clear: boolean;
}

export function howTheDayEnds(readings: readonly CloseReading[]): TheClose {
  const unsettled = readings.filter((one) => !settled(one));

  return {
    readings: [...readings],
    leftOvernight: unsettled.filter((one) => shouldNotBeLeft(one.kind)),
    outstanding: unsettled.filter((one) => !shouldNotBeLeft(one.kind)),
    clear: unsettled.length === 0,
  };
}

/** The line at the top. */
export function howTheCloseLooks(close: TheClose): Say {
  if (close.clear) return { key: 'Everything is counted, and nobody is still here.' };
  if (close.leftOvernight.length > 0) {
    return close.leftOvernight.length === 1
      ? { key: '1 thing should not be left overnight.' }
      : {
          key: '{count} things should not be left overnight.',
          vars: { count: close.leftOvernight.length },
        };
  }
  return close.outstanding.length === 1
    ? { key: '1 thing is outstanding, and none of it has to wait up.' }
    : {
        key: '{count} things are outstanding, and none of it has to wait up.',
        vars: { count: close.outstanding.length },
      };
}

/* ---------------------------------------------------------------------------
   Recording it
   --------------------------------------------------------------------------- */

/** Why a close was refused. */
export type CloseRefusal = 'ALREADY_CLOSED' | 'NOT_YET_TODAY' | 'INCOMPLETE' | 'NOT_THIS_WORKSHOP';

export class CloseOfDayError extends Error {
  readonly code: CloseRefusal;

  constructor(code: CloseRefusal, message: string) {
    super(message);
    this.name = 'CloseOfDayError';
    this.code = code;
  }
}

/**
 * Whether a set of readings is fit to be recorded as a close.
 *
 * All ten or none. A close missing a reading is worse than no close: it says
 * somebody looked, and leaves whoever reads it later to guess whether the
 * silence about the till means the till was fine or that the question was
 * never asked. Phase 90 learned that about inspection sheets and it is the
 * same lesson.
 *
 * Nothing here is about whether the day *should* be closed. A workshop may
 * close with everything outstanding; that is the point of recording it.
 */
export function assertRecordable(readings: readonly CloseReading[]): void {
  const seen = new Set(readings.map((one) => one.kind));

  const missing = CLOSE_READINGS.filter((kind) => !seen.has(kind));
  if (missing.length > 0) {
    throw new CloseOfDayError(
      'INCOMPLETE',
      `A close must answer all ten readings. Missing: ${missing.join(', ')}.`,
    );
  }

  if (seen.size !== readings.length) {
    throw new CloseOfDayError('INCOMPLETE', 'A close answers each reading once.');
  }

  const negative = readings.find((one) => one.count < 0 || !Number.isInteger(one.count));
  if (negative) {
    throw new CloseOfDayError(
      'INCOMPLETE',
      `A reading is a whole count of things, and ${negative.kind} was ${negative.count}.`,
    );
  }
}

/**
 * The business date a close belongs to, in the workshop's own day.
 *
 * Two things have to be right here and both are easy to get wrong.
 *
 * **It is the workshop's day, not the server's.** A garage in Sydney closing
 * at six in the evening is closing a date that in UTC is already tomorrow. The
 * date is read off a clock in the workshop's own zone, which is why this takes
 * one rather than defaulting to wherever the process happens to run.
 *
 * **A workshop that locks up at one in the morning is closing the day that is
 * ending**, not the one that started an hour ago. Anything before the cut
 * belongs to yesterday -- which is what the person pressing the button means,
 * and the only reading that makes the record match the night.
 */
export const DAY_ENDS_AT_HOUR = 4;

export function businessDay(at: Date, timezone: string, endsAtHour = DAY_ENDS_AT_HOUR): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const of = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  // 'en-CA' gives 2026-10-01; hour comes back as 00-24 under hour12: false,
  // and 24 is midnight, which is hour nought of the day that has just begun.
  const hour = Number(of('hour')) % 24;
  const date = `${of('year')}-${of('month')}-${of('day')}`;

  if (hour >= endsAtHour) return date;

  // Before the cut: the day that is ending. Stepping back through UTC is safe
  // because only the calendar date is wanted and it is already settled.
  const back = new Date(`${date}T12:00:00Z`);
  back.setUTCDate(back.getUTCDate() - 1);
  return back.toISOString().slice(0, 10);
}
