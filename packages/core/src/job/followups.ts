/**
 * Chasing something later. Phase 66. FR-617.
 *
 * The last requirement this product admitted nothing implements. The table has
 * been in the schema since the first migration, with no code reading or writing
 * it, which made it the honest kind of gap: named in the matrix, admitted in
 * the roadmap, and sitting there for a year.
 *
 * What a follow-up is, and what it is not:
 *
 *   A `JobTask` is work on the car, now, on this job. A technician ticks it
 *   off with the bonnet up.
 *
 *   A follow-up is something to do **after** the car has gone. Maria declined
 *   the rear discs; ring her in three months. The turbo part is on back order;
 *   chase the supplier Tuesday. The noise might come back; call in a week.
 *
 * They are not the same list and must not be shown as one. Almost all the
 * money a workshop leaves on the table is in the second kind — declined work
 * nobody went back to — and almost all the goodwill it loses is in the third.
 *
 * The design problem is not the table. It is that a follow-up nobody does is
 * **worse than no follow-up at all**, because the workshop believes it has been
 * handled and the customer knows it has not. So the standing of one matters
 * more than its existence: something due today and something three weeks late
 * are different situations and a list that shows them the same way is a list
 * that gets ignored, which is where a paper diary already is.
 */

export type FollowUpStanding = 'DONE' | 'OVERDUE' | 'TODAY' | 'SOON' | 'LATER';

export interface FollowUp {
  dueAt: Date;
  completedAt: Date | null;
}

export class FollowUpError extends Error {
  constructor(
    message: string,
    readonly code: 'NO_NOTE' | 'LONG_PAST' | 'ALREADY_DONE' | 'NOT_YOURS',
  ) {
    super(message);
    this.name = 'FollowUpError';
  }
}

/** A week is "soon". Beyond that it is something to plan, not something to do. */
export const FOLLOW_UP_SOON_DAYS = 7;

const DAY = 86_400_000;

function startOfDay(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

/**
 * Where a follow-up stands, today.
 *
 * Whole days rather than hours, because "due today" means today and a thing
 * set for nine this morning is not late at ten past. The workshop's day is the
 * unit everything else here is measured in.
 */
export function standingOf(followUp: FollowUp, now = new Date()): FollowUpStanding {
  if (followUp.completedAt) return 'DONE';

  const days = Math.round((startOfDay(followUp.dueAt) - startOfDay(now)) / DAY);

  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  if (days <= FOLLOW_UP_SOON_DAYS) return 'SOON';
  return 'LATER';
}

/** How late, in whole days. Zero for anything not overdue. */
export function daysLate(followUp: FollowUp, now = new Date()): number {
  if (standingOf(followUp, now) !== 'OVERDUE') return 0;
  return Math.round((startOfDay(now) - startOfDay(followUp.dueAt)) / DAY);
}

/**
 * What to do about one, in words rather than a colour.
 *
 * A badge that is only a colour says nothing to somebody who cannot tell the
 * two reds apart, and nothing at all when the page is read aloud.
 */
export function describeFollowUp(followUp: FollowUp, now = new Date()): string {
  const standing = standingOf(followUp, now);

  if (standing === 'DONE') return 'Done';
  if (standing === 'TODAY') return 'Due today';
  if (standing === 'OVERDUE') {
    const late = daysLate(followUp, now);
    return late === 1 ? '1 day late' : `${late} days late`;
  }
  return 'Due later';
}

/**
 * Worst first: late, then today, then the rest by when they are due.
 *
 * The order is the whole product here. Somebody opening this at half past
 * seven has ten minutes, and the ten minutes should go to the three-week-old
 * one rather than to whichever was typed first.
 */
export function mostOverdueFirst<T extends FollowUp>(all: readonly T[], now = new Date()): T[] {
  const rank: Record<FollowUpStanding, number> = {
    OVERDUE: 0,
    TODAY: 1,
    SOON: 2,
    LATER: 3,
    DONE: 4,
  };

  return [...all].sort((a, b) => {
    const byStanding = rank[standingOf(a, now)] - rank[standingOf(b, now)];
    if (byStanding !== 0) return byStanding;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

/** How many need doing now. What the dashboard puts a number on. */
export function needingAttention(all: readonly FollowUp[], now = new Date()): number {
  return all.filter((one) => ['OVERDUE', 'TODAY'].includes(standingOf(one, now))).length;
}

/* ---------------------------------------------------------------------------
   Setting one
   --------------------------------------------------------------------------- */

/** A year. Beyond it, somebody has typed the wrong year rather than meant it. */
export const LONG_PAST_DAYS = 365;

/**
 * Whether this is a follow-up somebody meant to set.
 *
 * A date in the past is allowed, deliberately. Work arrives already late —
 * "we should have rung them last week" is the most common follow-up there is,
 * and refusing it would mean back-dating by a day or lying about the date. It
 * appears as overdue, which is what it is.
 *
 * What is refused is a year in the past, which is a typed year rather than an
 * intention, and a note that says nothing: "follow up" on a follow-up is the
 * sort of entry that makes a list worth ignoring.
 */
export function assertFollowUp(input: { note: string; dueAt: Date }, now = new Date()): void {
  if (input.note.trim().length < 3) {
    throw new FollowUpError('Say what needs doing, so somebody else could do it.', 'NO_NOTE');
  }

  const daysBefore = Math.round((startOfDay(now) - startOfDay(input.dueAt)) / DAY);

  if (daysBefore > LONG_PAST_DAYS) {
    throw new FollowUpError('That date is over a year ago. Check the year.', 'LONG_PAST');
  }
}

/** Ticking one off that is already ticked off. */
export function assertNotDone(followUp: FollowUp): void {
  if (followUp.completedAt) {
    throw new FollowUpError('That has already been done.', 'ALREADY_DONE');
  }
}
