import type { JobStanding } from '../job/standing';
import type { Say } from './do-not-miss';

/**
 * The control tower: the arithmetic and the rules. Phase 98, and item 39 of
 * the thirty-nine — "the screen an owner leaves open all day."
 *
 * Nothing here reads a database. The web library gathers the figures from the
 * functions the rest of the product already trusts and hands them to these,
 * which decide what is at risk, in what order, and what the one sentence at
 * the top says. Kept apart so the rules can be tested with numbers rather than
 * with a seeded workshop, and so the risk order is a fact about this file
 * rather than about whatever the queries happened to return in.
 *
 * Every sentence travels as a key and its values (ADR-0019). `verify-tower`
 * reads the keys out of this file and looks each up in French and Arabic.
 */

const MINUTE = 60_000;

/** A customer's message that has waited this long is a risk, not an inbox. */
export const UNANSWERED_TOO_LONG_MINUTES = 120;

/** How many blocked cars the tower lists before pointing at the board. */
export const A_BOARD = 8;

/* ---------------------------------------------------------------------------
   What the tower is made of
   --------------------------------------------------------------------------- */

export interface CarInTheBuilding {
  id: string;
  number: number;
  what: string;
  who: string | null;
  vehicle: string | null;
  registration: string | null;
  standing: JobStanding;
}

export interface TheBuilding {
  inShop: number;
  ours: number;
  customer: number;
  supplier: number;
  nobody: number;
  late: number;
  /** The ones somebody is waiting on, worst first, as many as fit. */
  blocked: CarInTheBuilding[];
  /** How many more are blocked than are listed. */
  more: number;
}

export interface NotArrived {
  id: string;
  startAt: Date;
  who: string;
  vehicle: string;
  registration: string | null;
}

export interface TheDay {
  /** Minutes of work promised against the day, and minutes the building has. */
  bookedMinutes: number;
  effectiveMinutes: number;
  overbookedMinutes: number;
  constrainedBy: 'PEOPLE' | 'BAYS' | null;
  /** The rota against the clock. */
  expected: number;
  here: number;
  notIn: string[];
  /** The diary. */
  booked: number;
  nextAt: Date | null;
  /** Booked for earlier today, and the car has not been received. */
  notArrived: NotArrived[];
}

export interface TheMoney {
  takenToday: number;
  /** Finished, and nobody has raised the bill. */
  toInvoice: number;
  toInvoiceCount: number;
  owed: number;
  overdue: number;
  overdueCount: number;
}

export interface TheCustomers {
  /** Estimates in front of a customer, and how long the oldest has sat. */
  deciding: number;
  decidingLongestMinutes: number | null;
  /** Messages in, and nobody has answered. */
  unanswered: number;
  unansweredLongestMinutes: number | null;
  /** Finished and still on the premises. */
  readyToCollect: number;
  readyAndUnpaid: number;
}

export type PartStanding = 'LATE' | 'TODAY' | 'LATER' | 'NOT_ORDERED';

export interface PartInTheWay {
  jobId: string;
  number: number;
  vehicle: string | null;
  registration: string | null;
  part: string;
  supplier: string | null;
  orderId: string | null;
  expectedAt: Date | null;
  standing: PartStanding;
}

/**
 * Late first, because that is already costing. Then a part marked on order
 * that no open order has, because somebody believes it is coming and nothing
 * is: that is a part that will be late and does not know it yet.
 */
export const PART_STANDING_ORDER: Record<PartStanding, number> = {
  LATE: 0,
  NOT_ORDERED: 1,
  TODAY: 2,
  LATER: 3,
};

export function partStandingOf(input: {
  ordered: boolean;
  expectedAt: Date | null;
  now: Date;
  endOfDay: Date;
}): PartStanding {
  if (!input.ordered) return 'NOT_ORDERED';
  if (!input.expectedAt) return 'LATER';
  if (input.expectedAt < input.now) return 'LATE';
  if (input.expectedAt < input.endOfDay) return 'TODAY';
  return 'LATER';
}

export function partsInTheWayFirst<T extends { standing: PartStanding; expectedAt: Date | null }>(
  parts: readonly T[],
): T[] {
  return [...parts].sort(
    (a, b) =>
      PART_STANDING_ORDER[a.standing] - PART_STANDING_ORDER[b.standing] ||
      (a.expectedAt?.getTime() ?? 0) - (b.expectedAt?.getTime() ?? 0),
  );
}

/* ---------------------------------------------------------------------------
   What will go wrong before the doors shut
   --------------------------------------------------------------------------- */

export type RiskKind =
  | 'late'
  | 'overbooked'
  | 'parts-late'
  | 'promised-today'
  | 'not-in'
  | 'unanswered'
  | 'ready-unpaid'
  | 'morning-list';

export interface Risk {
  kind: RiskKind;
  /** Already costing something, or will have by closing time. */
  tone: 'danger' | 'warning';
  what: Say;
  href: string;
}

export interface RiskFacts {
  building: Pick<TheBuilding, 'late'>;
  day: Pick<TheDay, 'overbookedMinutes' | 'notIn'>;
  customers: Pick<TheCustomers, 'unansweredLongestMinutes' | 'readyAndUnpaid'>;
  parts: readonly Pick<PartInTheWay, 'standing'>[];
  /** Promised back before the end of today and not finished. */
  promisedToday: number;
  /** This morning's list: whether it is clear, and how long it is. */
  morning: { clear: boolean; total: number };
}

/**
 * The risk band is not a list of everything wrong. `/morning` is that, and it
 * has one action per line. This is the handful of things that will have cost
 * the workshop something by closing time if nobody looks — and the order is
 * fixed: what is already costing comes before what merely will.
 *
 * Three things are already costing: a promise broken, a day overbooked, a
 * part late for a car on the ramps. Everything else is still avoidable.
 */
export function theRisk(facts: RiskFacts): Risk[] {
  const risks: Risk[] = [];
  const { building, day, customers, parts, promisedToday, morning } = facts;

  if (building.late > 0) {
    risks.push({
      kind: 'late',
      tone: 'danger',
      what:
        building.late === 1
          ? { key: '1 car in the building is past the time it was promised back' }
          : {
              key: '{count} cars in the building are past the time they were promised back',
              vars: { count: building.late },
            },
      href: '/now',
    });
  }

  if (day.overbookedMinutes > 0) {
    risks.push({
      kind: 'overbooked',
      tone: 'danger',
      what: {
        key: '{hours} more hours are promised today than the building can do',
        vars: { hours: hoursOf(day.overbookedMinutes) },
      },
      href: '/capacity',
    });
  }

  const lateParts = parts.filter((part) => part.standing === 'LATE').length;
  if (lateParts > 0) {
    risks.push({
      kind: 'parts-late',
      tone: 'danger',
      what:
        lateParts === 1
          ? { key: '1 part for a car on the ramps is late from the supplier' }
          : {
              key: '{count} parts for cars on the ramps are late from the supplier',
              vars: { count: lateParts },
            },
      href: '#parts',
    });
  }

  if (promisedToday > 0) {
    risks.push({
      kind: 'promised-today',
      tone: 'warning',
      what:
        promisedToday === 1
          ? { key: '1 car is promised back today and is not finished' }
          : {
              key: '{count} cars are promised back today and are not finished',
              vars: { count: promisedToday },
            },
      href: '/now',
    });
  }

  if (day.notIn.length > 0) {
    risks.push({
      kind: 'not-in',
      tone: 'warning',
      what:
        day.notIn.length === 1
          ? {
              key: '{name} is expected today and has not clocked on',
              vars: { name: day.notIn[0]! },
            }
          : {
              key: '{count} people are expected today and have not clocked on',
              vars: { count: day.notIn.length },
            },
      href: '/opening',
    });
  }

  if (
    customers.unansweredLongestMinutes !== null &&
    customers.unansweredLongestMinutes >= UNANSWERED_TOO_LONG_MINUTES
  ) {
    risks.push({
      kind: 'unanswered',
      tone: 'warning',
      // Whole hours. "16.9 hours" is a figure; "16 hours" is what somebody says.
      what: {
        key: 'A customer’s message has waited {hours} hours for an answer',
        vars: { hours: Math.floor(customers.unansweredLongestMinutes / 60) },
      },
      href: '/inbox',
    });
  }

  if (customers.readyAndUnpaid > 0) {
    risks.push({
      kind: 'ready-unpaid',
      tone: 'warning',
      what:
        customers.readyAndUnpaid === 1
          ? { key: '1 finished car is still here and not paid for' }
          : {
              key: '{count} finished cars are still here and not paid for',
              vars: { count: customers.readyAndUnpaid },
            },
      href: '/jobs?status=COMPLETED',
    });
  }

  if (!morning.clear) {
    risks.push({
      kind: 'morning-list',
      tone: 'warning',
      what:
        morning.total === 1
          ? { key: '1 thing on this morning’s list has not been done' }
          : {
              key: '{count} things on this morning’s list have not been done',
              vars: { count: morning.total },
            },
      href: '/morning',
    });
  }

  return risks;
}

/** The sentence at the top. */
export function howTheTowerLooks(
  building: Pick<TheBuilding, 'inShop'>,
  risk: readonly Risk[],
): Say {
  const danger = risk.filter((one) => one.tone === 'danger').length;
  const warning = risk.length - danger;
  if (building.inShop === 0 && risk.length === 0) return { key: 'Nothing in the building.' };
  if (danger === 1) {
    return {
      key: '{cars} in the building, and one thing is already costing you.',
      vars: { cars: building.inShop },
    };
  }
  if (danger > 1) {
    return {
      key: '{cars} in the building, and {count} things are already costing you.',
      vars: { cars: building.inShop, count: danger },
    };
  }
  if (warning > 0) {
    return {
      key: '{cars} in the building, nothing costing you yet, {count} that will by tonight.',
      vars: { cars: building.inShop, count: warning },
    };
  }
  return {
    key: '{cars} in the building and nothing at risk today.',
    vars: { cars: building.inShop },
  };
}

/* ---------------------------------------------------------------------------
   Arithmetic
   --------------------------------------------------------------------------- */

/** Minutes as hours to one place, the way a workshop says it: 7.5, not 450. */
export function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/** Whole minutes from `from` to `to`, never negative. */
export function minutesSince(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MINUTE));
}

/**
 * Midnight at the start of a calendar day, on the workshop's own clock.
 *
 * `businessDay` gives the date; this gives the instant it began. A garage in
 * Riyadh whose day started at midnight local time started it at nine the
 * previous evening in UTC, and "taken today" summed from UTC midnight would
 * be missing three hours of the morning.
 */
export function startOfDayIn(day: string, timezone: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(guess);
  const of = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  // Under hour12: false the hour can come back as 24, which is midnight.
  const hour = Number(of('hour')) % 24;
  const wall = Date.UTC(
    Number(of('year')),
    Number(of('month')) - 1,
    Number(of('day')),
    hour,
    Number(of('minute')),
  );
  // What the zone's clock read at `guess`, less what UTC read, is the offset;
  // local midnight is that much the other way.
  return new Date(guess.getTime() - (wall - guess.getTime()));
}
