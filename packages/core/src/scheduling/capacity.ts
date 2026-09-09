/**
 * Diary capacity.
 *
 * A workshop that overbooks does not discover it at 9am; it discovers it at
 * 4pm when three customers are waiting and one car is still on the lift. The
 * diary's job is to make that visible while the booking is being made.
 *
 * The rule is a warning, never a refusal (story D2). Workshops genuinely do
 * squeeze a job in, and software that forbids it gets worked around by
 * booking everything into a fake slot, which destroys the data.
 */

export interface Interval {
  startAt: Date;
  endAt: Date;
}

export interface ScheduledItem extends Interval {
  id: string;
  bayId?: string | null;
  technicianId?: string | null;
  estimatedHours: number;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function durationHours(interval: Interval): number {
  return (interval.endAt.getTime() - interval.startAt.getTime()) / 3_600_000;
}

export type ConflictKind = 'BAY_DOUBLE_BOOKED' | 'TECHNICIAN_DOUBLE_BOOKED' | 'OVER_CAPACITY';

export interface Conflict {
  kind: ConflictKind;
  message: string;
  conflictingIds: string[];
  /** Hard conflicts should be confirmed; soft ones are advisory. */
  severity: 'warning' | 'blocking';
}

export interface CapacityCheckInput {
  candidate: ScheduledItem;
  existing: readonly ScheduledItem[];
  /** Total technician hours the site can absorb that day. FR-509. */
  dailyCapacityHours?: number;
  /** Technicians unavailable on the day, by id. */
  unavailableTechnicianIds?: readonly string[];
}

export function checkCapacity(input: CapacityCheckInput): Conflict[] {
  const { candidate, existing } = input;
  const conflicts: Conflict[] = [];

  const others = existing.filter((item) => item.id !== candidate.id);

  if (candidate.bayId) {
    const clashes = others.filter(
      (item) => item.bayId === candidate.bayId && overlaps(item, candidate),
    );
    if (clashes.length > 0) {
      conflicts.push({
        kind: 'BAY_DOUBLE_BOOKED',
        severity: 'warning',
        message: `This bay already has ${clashes.length === 1 ? 'a booking' : `${clashes.length} bookings`} at that time.`,
        conflictingIds: clashes.map((c) => c.id),
      });
    }
  }

  if (candidate.technicianId) {
    // A technician physically cannot be on two cars at once, so this one is
    // blocking rather than advisory.
    const clashes = others.filter(
      (item) => item.technicianId === candidate.technicianId && overlaps(item, candidate),
    );
    if (clashes.length > 0) {
      conflicts.push({
        kind: 'TECHNICIAN_DOUBLE_BOOKED',
        severity: 'blocking',
        message: 'That technician is already assigned to another job at that time.',
        conflictingIds: clashes.map((c) => c.id),
      });
    }

    if (input.unavailableTechnicianIds?.includes(candidate.technicianId)) {
      conflicts.push({
        kind: 'TECHNICIAN_DOUBLE_BOOKED',
        severity: 'blocking',
        message: 'That technician is not available on this day.',
        conflictingIds: [],
      });
    }
  }

  if (input.dailyCapacityHours && input.dailyCapacityHours > 0) {
    const day = startOfDay(candidate.startAt);
    const sameDay = others.filter((item) => sameCalendarDay(item.startAt, day));
    const booked = sameDay.reduce((total, item) => total + item.estimatedHours, 0);
    const projected = booked + candidate.estimatedHours;

    if (projected > input.dailyCapacityHours) {
      conflicts.push({
        kind: 'OVER_CAPACITY',
        severity: 'warning',
        message:
          `This would put the day at ${round1(projected)} hours against a capacity of ` +
          `${round1(input.dailyCapacityHours)} hours.`,
        conflictingIds: sameDay.map((item) => item.id),
      });
    }
  }

  return conflicts;
}

export function hasBlockingConflict(conflicts: readonly Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === 'blocking');
}

export interface DayUtilisation {
  date: Date;
  bookedHours: number;
  capacityHours: number;
  utilisationPct: number;
  /** Under-booked days are as much of a problem as over-booked ones. */
  state: 'empty' | 'light' | 'healthy' | 'full' | 'over';
}

export function utilisationFor(
  date: Date,
  items: readonly ScheduledItem[],
  capacityHours: number,
): DayUtilisation {
  const day = startOfDay(date);
  const bookedHours = items
    .filter((item) => sameCalendarDay(item.startAt, day))
    .reduce((total, item) => total + item.estimatedHours, 0);

  const utilisationPct = capacityHours > 0 ? (bookedHours / capacityHours) * 100 : 0;

  let state: DayUtilisation['state'];
  if (bookedHours === 0) state = 'empty';
  else if (utilisationPct < 40) state = 'light';
  else if (utilisationPct <= 90) state = 'healthy';
  else if (utilisationPct <= 100) state = 'full';
  else state = 'over';

  return { date: day, bookedHours, capacityHours, utilisationPct: round1(utilisationPct), state };
}

/**
 * Suggests the earliest slot that fits, which is what a service advisor
 * actually needs while a customer is on the phone asking "when can you take
 * it?" — a calendar to stare at is not an answer.
 */
export interface SlotSuggestionInput {
  from: Date;
  durationHours: number;
  existing: readonly ScheduledItem[];
  bayIds: readonly string[];
  openingHour?: number;
  closingHour?: number;
  daysToSearch?: number;
}

export interface SuggestedSlot {
  startAt: Date;
  endAt: Date;
  bayId: string;
}

export function suggestSlots(input: SlotSuggestionInput, limit = 3): SuggestedSlot[] {
  const opening = input.openingHour ?? 8;
  const closing = input.closingHour ?? 17;
  const days = input.daysToSearch ?? 14;
  const found: SuggestedSlot[] = [];

  for (let dayOffset = 0; dayOffset < days && found.length < limit; dayOffset += 1) {
    const day = startOfDay(new Date(input.from.getTime() + dayOffset * 86_400_000));

    // Sunday. Workshops that open on Sunday can configure this later; the
    // default should not invent availability that does not exist.
    if (day.getDay() === 0) continue;

    for (let hour = opening; hour + input.durationHours <= closing; hour += 1) {
      if (found.length >= limit) break;

      const startAt = new Date(day.getTime());
      startAt.setHours(hour, 0, 0, 0);

      if (startAt < input.from) continue;

      const endAt = new Date(startAt.getTime() + input.durationHours * 3_600_000);

      for (const bayId of input.bayIds) {
        const clash = input.existing.some(
          (item) => item.bayId === bayId && overlaps(item, { startAt, endAt }),
        );
        if (!clash) {
          found.push({ startAt, endAt, bayId });
          break;
        }
      }
    }
  }

  return found;
}

function startOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
