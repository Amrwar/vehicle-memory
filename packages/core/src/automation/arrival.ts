/**
 * What to offer when the car is on the ramp.
 *
 * The moment a vehicle arrives is the only moment the workshop has the
 * customer's attention, the car in the air and a technician standing next to
 * it. Work found an hour later is a phone call; work found now is a line on
 * the job. This module turns what the vehicle's own history already says into
 * that list, so nobody has to remember that the brake fluid was last done four
 * years ago.
 *
 * Every suggestion carries the reason it appeared. A list of parts with no
 * explanation reads as an upsell and gets ignored, by the technician first and
 * by the customer immediately after. "Declined at the last visit" and "due by
 * mileage in 300 miles" are different conversations and the person at the
 * counter needs to know which one they are having.
 *
 * Nothing here decides anything. It suggests, a person accepts, and only then
 * does a line reach the job.
 */

/** Why a suggestion appeared. Ordered by how hard it is to argue with. */
export type SuggestionBasis =
  'OVERDUE' | 'DUE_SOON' | 'DECLINED_BEFORE' | 'ADVISORY' | 'INTERVAL' | 'AGE';

export interface Suggestion {
  serviceItemId: string | null;
  name: string;
  basis: SuggestionBasis;
  /** The sentence shown to whoever is booking the car in. */
  reason: string;
  /** Higher comes first. Derived, never stored. */
  weight: number;
}

export interface ScheduleFact {
  serviceItemId: string | null;
  name: string;
  dueAt: Date | null;
  dueKm: number | null;
  lastPerformedAt: Date | null;
  intervalMonths: number | null;
}

export interface DeclinedFact {
  serviceItemId: string | null;
  name: string;
  declinedAt: Date;
  /** What it would have cost then, in minor units. */
  quotedMinor: number | null;
}

export interface AdvisoryFact {
  name: string;
  /** From the last inspection: AMBER is watch, RED is act. */
  severity: 'AMBER' | 'RED';
  notedAt: Date;
}

export interface ArrivalContext {
  now: Date;
  /** Reading taken at the gate, when there is one. */
  odometerKm: number | null;
  schedules: readonly ScheduleFact[];
  declined: readonly DeclinedFact[];
  advisories: readonly AdvisoryFact[];
}

/** Inside this, a service is close enough to do while the car is already here. */
export const DUE_SOON_DAYS = 60;

/** Same idea by distance. */
export const DUE_SOON_KM = 1_000;

/** Older than this, a declined item is a fresh conversation, not a repeat. */
export const DECLINED_STALE_DAYS = 540;

const WEIGHT: Record<SuggestionBasis, number> = {
  OVERDUE: 100,
  ADVISORY: 90,
  DUE_SOON: 70,
  DECLINED_BEFORE: 50,
  INTERVAL: 30,
  AGE: 10,
};

function days(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Whether a scheduled service is worth raising, and how it should be put.
 *
 * Overdue by date and overdue by distance are the same suggestion said two
 * ways, and the vehicle only needs to cross one of them. Taking the stronger
 * of the two matters: a van that has done its mileage in four months is due
 * whatever the calendar says.
 */
function fromSchedule(schedule: ScheduleFact, context: ArrivalContext): Suggestion | null {
  const overdueDays = schedule.dueAt ? days(schedule.dueAt, context.now) : null;

  const kmToGo =
    schedule.dueKm !== null && context.odometerKm !== null
      ? schedule.dueKm - context.odometerKm
      : null;

  if ((overdueDays !== null && overdueDays > 0) || (kmToGo !== null && kmToGo <= 0)) {
    const reason =
      overdueDays !== null && overdueDays > 0
        ? `Overdue by ${plural(overdueDays, 'day', 'days')}.`
        : `Past its mileage by ${plural(Math.abs(kmToGo ?? 0), 'mile', 'miles')}.`;

    return {
      serviceItemId: schedule.serviceItemId,
      name: schedule.name,
      basis: 'OVERDUE',
      reason,
      weight: WEIGHT.OVERDUE,
    };
  }

  const dueByDate = overdueDays !== null && overdueDays > -DUE_SOON_DAYS;
  const dueByKm = kmToGo !== null && kmToGo <= DUE_SOON_KM;

  if (dueByDate || dueByKm) {
    const reason = dueByKm
      ? `Due in about ${plural(kmToGo ?? 0, 'mile', 'miles')}, and the car is here now.`
      : `Due in ${plural(Math.abs(overdueDays ?? 0), 'day', 'days')}, and the car is here now.`;

    return {
      serviceItemId: schedule.serviceItemId,
      name: schedule.name,
      basis: 'DUE_SOON',
      reason,
      weight: WEIGHT.DUE_SOON,
    };
  }

  // Nothing scheduled, but a long time since it was last done. Weak, and
  // deliberately worded as a question rather than a claim.
  if (schedule.dueAt === null && schedule.lastPerformedAt && schedule.intervalMonths) {
    const since = days(schedule.lastPerformedAt, context.now);

    if (since > schedule.intervalMonths * 30) {
      return {
        serviceItemId: schedule.serviceItemId,
        name: schedule.name,
        basis: 'INTERVAL',
        reason: `Last done ${plural(Math.round(since / 30), 'month', 'months')} ago, on a ${schedule.intervalMonths}-month interval.`,
        weight: WEIGHT.INTERVAL,
      };
    }
  }

  return null;
}

/**
 * Everything worth mentioning while the car is here, strongest first.
 *
 * Deduplicated by service item, keeping the strongest basis. The same brake
 * fluid change can be overdue, declined last year and flagged amber, and
 * saying it three times makes the whole list look automated.
 */
export function suggestOnArrival(context: ArrivalContext): Suggestion[] {
  const found: Suggestion[] = [];

  for (const schedule of context.schedules) {
    const suggestion = fromSchedule(schedule, context);
    if (suggestion) found.push(suggestion);
  }

  for (const advisory of context.advisories) {
    found.push({
      serviceItemId: null,
      name: advisory.name,
      basis: 'ADVISORY',
      reason:
        advisory.severity === 'RED'
          ? `Marked red at the last inspection, ${plural(days(advisory.notedAt, context.now), 'day', 'days')} ago.`
          : `Marked amber at the last inspection, worth another look.`,
      weight: advisory.severity === 'RED' ? WEIGHT.ADVISORY : WEIGHT.ADVISORY - 15,
    });
  }

  for (const declined of context.declined) {
    const ago = days(declined.declinedAt, context.now);

    // Beyond this it is not "the thing you turned down", it is a new
    // recommendation, and raising it as a refusal puts the customer on the
    // defensive about a decision they have forgotten making.
    if (ago > DECLINED_STALE_DAYS) continue;

    found.push({
      serviceItemId: declined.serviceItemId,
      name: declined.name,
      basis: 'DECLINED_BEFORE',
      reason:
        declined.quotedMinor !== null
          ? `Turned down ${plural(ago, 'day', 'days')} ago at £${(declined.quotedMinor / 100).toFixed(2)}.`
          : `Turned down ${plural(ago, 'day', 'days')} ago.`,
      weight: WEIGHT.DECLINED_BEFORE,
    });
  }

  const strongest = new Map<string, Suggestion>();

  for (const suggestion of found) {
    const key = suggestion.serviceItemId ?? `name:${suggestion.name.toLowerCase()}`;
    const existing = strongest.get(key);

    if (!existing || suggestion.weight > existing.weight) strongest.set(key, suggestion);
  }

  return [...strongest.values()].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name),
  );
}

/**
 * The line a service adviser reads out.
 *
 * One sentence, because the list is read aloud at a counter with somebody
 * waiting, and a paragraph does not get read.
 */
export function describeArrival(suggestions: readonly Suggestion[]): string {
  if (suggestions.length === 0) return 'Nothing outstanding on this vehicle.';

  const overdue = suggestions.filter((suggestion) => suggestion.basis === 'OVERDUE').length;

  return overdue > 0
    ? `${plural(overdue, 'item is', 'items are')} overdue, and ${suggestions.length - overdue} more worth raising while it is here.`
    : `${plural(suggestions.length, 'item', 'items')} worth raising while it is here.`;
}
