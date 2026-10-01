import type { Say } from '../owner/do-not-miss';
import type { JobStatus } from './lifecycle';

/**
 * The story of a job: everything that happened to it, minute by minute, in
 * one order. Phase 99, and the first of the customer items of the
 * thirty-nine: "a unified communication timeline per job, so every job is
 * reconstructable minute by minute."
 *
 * Nothing here reads a database. The web library gathers every record the
 * job already carries — status moves, messages both ways, the estimate and
 * what the customer decided, clocks, parts, checks, notes, photos, the bill
 * and the money, keys, follow-ups — and hands them here as entries. These
 * rules put them in order, break them into days, find the silences, and
 * count what a reader of a dispute wants counted first.
 *
 * Every sentence travels as a key and its values (ADR-0019), and the page
 * translates. The one exception is a status move, which carries the status
 * itself, because the status's own name is already in the dictionary and a
 * sentence with an English status inside its values would be half
 * translated.
 */

export type { Say };

/** Who acted: the workshop, the customer, or the product on nobody's behalf. */
export type StorySide = 'us' | 'customer' | 'system';

export type StoryKind =
  | 'opened'
  | 'status'
  | 'key'
  | 'checked-in'
  | 'checked-out'
  | 'inspection-started'
  | 'inspection-completed'
  | 'estimate-sent'
  | 'estimate-decided'
  | 'estimate-withdrawn'
  | 'extra-work'
  | 'message-out'
  | 'message-in'
  | 'clock-on'
  | 'clock-off'
  | 'part-requested'
  | 'part-substituted'
  | 'sublet-ordered'
  | 'sublet-done'
  | 'quality'
  | 'note'
  | 'photo'
  | 'invoice-issued'
  | 'payment'
  | 'followup-set'
  | 'followup-done'
  | 'summary-sent'
  | 'comeback'
  | 'completed'
  | 'collected';

export interface StoryEntry {
  id: string;
  at: Date;
  kind: StoryKind;
  side: StorySide;
  /** Who, by name, when the record says. */
  who: string | null;
  /** The sentence, or null for a status move, which carries `status`. */
  what: Say | null;
  /** The status moved to, for `kind: 'status'`. */
  status?: JobStatus | null;
  /** The message, the note, the reason: whatever was said, as said. */
  detail?: string | null;
  amount?: number | null;
  href?: string | null;
}

/**
 * When two things happened in the same instant — a status move and the
 * note somebody wrote with it, a clock stopped and the quality check that
 * followed — the order a reader expects is the order they would have happened
 * in: the act, then what was said about it.
 */
const KIND_ORDER: Record<StoryKind, number> = {
  opened: 0,
  'checked-in': 1,
  key: 2,
  status: 3,
  'inspection-started': 4,
  'inspection-completed': 5,
  'clock-on': 6,
  'part-requested': 7,
  'sublet-ordered': 8,
  'extra-work': 9,
  'estimate-sent': 10,
  'message-out': 11,
  'message-in': 12,
  'estimate-decided': 13,
  'estimate-withdrawn': 14,
  'part-substituted': 15,
  'sublet-done': 16,
  'clock-off': 17,
  quality: 18,
  completed: 19,
  'invoice-issued': 20,
  'summary-sent': 21,
  payment: 22,
  'checked-out': 23,
  collected: 24,
  'followup-set': 25,
  'followup-done': 26,
  comeback: 27,
  note: 28,
  photo: 29,
};

export function inTheOrderItHappened<T extends { at: Date; kind: StoryKind; id: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      a.at.getTime() - b.at.getTime() ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.id.localeCompare(b.id),
  );
}

export interface StoryDay {
  /** The calendar date, in the workshop's zone: 2026-10-01. */
  day: string;
  entries: StoryEntry[];
}

/** A stretch with nothing recorded, long enough to be worth a line. */
export interface Silence {
  from: Date;
  to: Date;
  minutes: number;
  /** The last thing that happened before it went quiet. */
  after: StoryEntry;
}

export interface StorySummary {
  first: Date | null;
  last: Date | null;
  /** Whole minutes from the first entry to the last. */
  minutes: number;
  moments: number;
  byUs: number;
  byCustomer: number;
  bySystem: number;
  messagesOut: number;
  messagesIn: number;
  /** The longest stretch with nothing recorded, if it was long enough. */
  longestSilence: Silence | null;
}

export interface TheStory {
  days: StoryDay[];
  silences: Silence[];
  summary: StorySummary;
}

/** A gap shorter than this is a working day, not a silence. */
export const A_SILENCE_MINUTES = 24 * 60;

/** The calendar date of an instant in a zone, as 2026-10-01. */
export function dayOf(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * The story, told.
 *
 * Silences are measured between consecutive entries and kept only when they
 * are a day or more: a job that sat untouched from Friday to Tuesday is the
 * thing a reader of a complaint is looking for, and a three-hour gap at lunch
 * is not. The silence is attributed to the entry before it, because that is
 * the last thing anybody did before nobody did anything.
 */
export function tellTheStory(
  entries: readonly StoryEntry[],
  timezone: string,
  silenceMinutes = A_SILENCE_MINUTES,
): TheStory {
  const ordered = inTheOrderItHappened(entries);

  const days: StoryDay[] = [];
  for (const entry of ordered) {
    const day = dayOf(entry.at, timezone);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }

  const silences: Silence[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const before = ordered[index - 1]!;
    const after = ordered[index]!;
    const minutes = Math.round((after.at.getTime() - before.at.getTime()) / 60_000);
    if (minutes >= silenceMinutes) {
      silences.push({ from: before.at, to: after.at, minutes, after: before });
    }
  }

  const first = ordered[0]?.at ?? null;
  const last = ordered[ordered.length - 1]?.at ?? null;
  const count = (test: (entry: StoryEntry) => boolean) => ordered.filter(test).length;

  return {
    days,
    silences,
    summary: {
      first,
      last,
      minutes: first && last ? Math.round((last.getTime() - first.getTime()) / 60_000) : 0,
      moments: ordered.length,
      byUs: count((entry) => entry.side === 'us'),
      byCustomer: count((entry) => entry.side === 'customer'),
      bySystem: count((entry) => entry.side === 'system'),
      messagesOut: count((entry) => entry.kind === 'message-out'),
      messagesIn: count((entry) => entry.kind === 'message-in'),
      longestSilence:
        silences.length === 0
          ? null
          : silences.reduce((longest, one) => (one.minutes > longest.minutes ? one : longest)),
    },
  };
}

/** The sentence at the top. */
export function howTheStoryReads(summary: StorySummary): Say {
  if (summary.moments === 0) return { key: 'Nothing has happened on this job yet.' };
  if (summary.moments === 1) return { key: 'One moment so far.' };
  return {
    key: '{moments} moments over {span}: {us} by the workshop, {customer} by the customer, {system} by the product on its own.',
    vars: {
      moments: summary.moments,
      span: spanOf(summary.minutes),
      us: summary.byUs,
      customer: summary.byCustomer,
      system: summary.bySystem,
    },
  };
}

/**
 * A span the way somebody says it: "3 days", "6 hours", "40 minutes". Kept
 * as a plain value so the dictionary does not need a sentence per unit; the
 * page translates the unit word.
 */
export function spanOf(minutes: number): string {
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `${days}d`;
  }
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}
