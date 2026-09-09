import type { Interval, ScheduledItem } from '../scheduling/capacity';

/**
 * The slots a customer can actually be offered.
 *
 * The distinction that matters: a slot is offerable when the workshop can
 * genuinely do the work, not when the calendar happens to be blank. A diary
 * with a free hour at half past four and a three-hour job is not an
 * opportunity, it is a promise that gets broken on the day.
 *
 * So availability is computed from opening hours, existing bookings, remaining
 * capacity for the day, and the length of the work being asked for. Offering
 * anything else is how a workshop ends up ringing people back to move them.
 */

export interface OpeningHours {
  /** 0 is Sunday, to match Date.getDay(). */
  weekday: number;
  /** Minutes from midnight. */
  opensAt: number;
  closesAt: number;
}

export interface SlotRequest {
  /** Local midnight of the first day to consider. */
  from: Date;
  daysAhead: number;
  /** How long the work takes. */
  hours: number;
  hours0?: never;
  /** Total technician hours the site can absorb per day. */
  dailyCapacityHours: number;
  opening: readonly OpeningHours[];
  booked: readonly ScheduledItem[];
  /** Nothing is offered before this. Defaults to now. */
  notBefore?: Date;
  /** Slots start on this boundary, in minutes. */
  granularityMinutes?: number;
  /** Bays available at once. A slot needs one free. */
  bays: number;
}

export interface Slot extends Interval {
  /** Hours already committed that day, before this slot. */
  committedHours: number;
  /** Hours the day still has after this slot would be taken. */
  remainingHours: number;
  /** True when taking this slot fills the day past this threshold. */
  tight: boolean;
}

const MINUTE = 60_000;
const TIGHT_AT = 0.9;

/** Default: a workshop open eight to half five, closed Sunday. */
export const DEFAULT_OPENING: OpeningHours[] = [
  { weekday: 1, opensAt: 8 * 60, closesAt: 17 * 60 + 30 },
  { weekday: 2, opensAt: 8 * 60, closesAt: 17 * 60 + 30 },
  { weekday: 3, opensAt: 8 * 60, closesAt: 17 * 60 + 30 },
  { weekday: 4, opensAt: 8 * 60, closesAt: 17 * 60 + 30 },
  { weekday: 5, opensAt: 8 * 60, closesAt: 17 * 60 + 30 },
  { weekday: 6, opensAt: 8 * 60 + 30, closesAt: 13 * 60 },
];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function overlapping(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * Every slot a customer could be offered, in order.
 *
 * Returns whole slots only. A day with two hours left and a three-hour job
 * contributes nothing, which is the point: half an answer is what produces the
 * phone call moving them.
 */
export function availableSlots(request: SlotRequest): Slot[] {
  const granularity = request.granularityMinutes ?? 30;
  const notBefore = request.notBefore ?? new Date();
  const durationMs = request.hours * 60 * MINUTE;
  const slots: Slot[] = [];

  if (request.hours <= 0 || request.bays < 1) return slots;

  for (let dayOffset = 0; dayOffset < request.daysAhead; dayOffset += 1) {
    const day = startOfDay(request.from);
    day.setDate(day.getDate() + dayOffset);

    const hours = request.opening.find((entry) => entry.weekday === day.getDay());
    if (!hours) continue;

    const onThisDay = request.booked.filter((item) => sameDay(item.startAt, day));

    const committedHours = onThisDay.reduce(
      (total, item) => total + (item.endAt.getTime() - item.startAt.getTime()) / (60 * MINUTE),
      0,
    );

    // The day is full whatever the calendar looks like.
    if (committedHours + request.hours > request.dailyCapacityHours) continue;

    for (
      let minute = hours.opensAt;
      minute + request.hours * 60 <= hours.closesAt;
      minute += granularity
    ) {
      const startAt = new Date(day);
      startAt.setMinutes(minute, 0, 0);

      if (startAt < notBefore) continue;

      const endAt = new Date(startAt.getTime() + durationMs);
      const candidate = { startAt, endAt };

      // A slot needs one bay free for its whole length.
      const concurrent = onThisDay.filter((item) => overlapping(candidate, item)).length;
      if (concurrent >= request.bays) continue;

      const remainingHours = request.dailyCapacityHours - committedHours - request.hours;

      slots.push({
        startAt,
        endAt,
        committedHours: round1(committedHours),
        remainingHours: round1(remainingHours),
        tight: committedHours + request.hours >= request.dailyCapacityHours * TIGHT_AT,
      });
    }
  }

  return slots;
}

/**
 * A handful of slots spread across days rather than a wall of times.
 *
 * Twenty options on the same morning is not more choice than three across
 * three days; it is the same choice, harder to make.
 */
export function offerSlots(request: SlotRequest, perDay = 3, days = 5): Slot[] {
  const all = availableSlots(request);
  const byDay = new Map<string, Slot[]>();

  for (const slot of all) {
    const key = slot.startAt.toDateString();
    const existing = byDay.get(key) ?? [];
    if (existing.length < perDay) {
      existing.push(slot);
      byDay.set(key, existing);
    }
  }

  return [...byDay.values()].slice(0, days).flat();
}

/** Whether a specific requested time is still genuinely free. */
export function isSlotStillFree(request: SlotRequest, startAt: Date): boolean {
  return availableSlots({ ...request, notBefore: new Date(0) }).some(
    (slot) => slot.startAt.getTime() === startAt.getTime(),
  );
}

/* ---------------------------------------------------------------------------
   What the customer is told
   --------------------------------------------------------------------------- */

export type BookingStage =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'READY'
  | 'COLLECTED';

/**
 * The updates worth sending, and the ones that are noise.
 *
 * A customer wants to know when something changes for them: it is booked, it
 * is being worked on, it needs a decision, it is ready. They do not want to
 * know that a job moved from awaiting-parts to in-progress twice in an
 * afternoon. Sending everything trains people to ignore all of it, which
 * costs the one message that mattered.
 */
const NOTIFIES: Record<BookingStage, boolean> = {
  REQUESTED: true,
  CONFIRMED: true,
  ARRIVED: false,
  IN_PROGRESS: true,
  AWAITING_APPROVAL: true,
  READY: true,
  COLLECTED: false,
};

export function shouldNotify(stage: BookingStage): boolean {
  return NOTIFIES[stage];
}

export function customerMessageFor(stage: BookingStage, vehicle: string): string | null {
  switch (stage) {
    case 'REQUESTED':
      return `We have your request for the ${vehicle} and will confirm shortly.`;
    case 'CONFIRMED':
      return `Your booking for the ${vehicle} is confirmed.`;
    case 'IN_PROGRESS':
      return `We have started work on the ${vehicle}.`;
    case 'AWAITING_APPROVAL':
      return `The ${vehicle} needs a decision from you before we can carry on.`;
    case 'READY':
      return `The ${vehicle} is ready to collect.`;
    default:
      return null;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
