/**
 * How much work a day can actually absorb, from the people who will be there.
 *
 * The product has carried a figure called `dailyCapacityHours` on every site
 * since Phase 1. It is a number somebody typed once. It does not know that
 * two people are on holiday on Thursday, that one works mornings, or that the
 * apprentice is at college every other Friday, and every planning decision
 * made against it inherits all three mistakes.
 *
 * This replaces it with arithmetic over the working patterns and the approved
 * absences the product already holds. The output is deliberately three
 * separate numbers rather than one:
 *
 * People. The minutes technicians are contracted to be present, less breaks
 * and less absence.
 *
 * Bays. The minutes of bay time the building physically has. A workshop with
 * six technicians and two ramps is a two-ramp workshop.
 *
 * Booked. What has already been promised to somebody.
 *
 * Only the smaller of the first two is real capacity, and a workshop that is
 * short of people on Tuesday and short of ramps on Wednesday is short for two
 * entirely different reasons that want two different answers.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WorkingPattern {
  employeeId: string;
  /** ISO weekday: 1 is Monday, 7 is Sunday. */
  weekday: Weekday;
  /** Minutes from midnight, local to the site. */
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
}

export interface AbsenceSpan {
  employeeId: string;
  startsOn: Date;
  endsOn: Date;
}

export interface PersonLoad {
  employeeId: string;
  name: string;
  /** Minutes they are contracted to be on site, net of breaks. */
  availableMinutes: number;
  /** Minutes of work already assigned to them that day. */
  bookedMinutes: number;
  absent: boolean;
  /** Booked over available, or null when they are not in that day. */
  utilisation: number | null;
}

export interface DayCapacity {
  date: Date;
  weekday: Weekday;
  /** Net minutes of technician time, across everybody in that day. */
  peopleMinutes: number;
  /** Minutes of bay time the building has that day. */
  bayMinutes: number;
  bookedMinutes: number;
  /** The smaller of people and bays: the one that actually binds. */
  effectiveMinutes: number;
  /** Which of the two is the constraint, or null when neither binds. */
  constrainedBy: 'PEOPLE' | 'BAYS' | null;
  /** Positive when more work is promised than can be done. */
  overbookedMinutes: number;
  people: PersonLoad[];
  absent: number;
  summary: string;
}

/** ISO weekday for a date: 1 Monday through 7 Sunday. */
export function weekdayOf(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** Same calendar day, ignoring the time of day on either side. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Whether somebody is away on a given day.
 *
 * Inclusive at both ends, because a holiday recorded as Monday to Friday
 * includes the Friday, and an exclusive end is the classic way somebody gets
 * booked in on the last day of their own leave.
 */
export function absentOn(
  absences: readonly AbsenceSpan[],
  employeeId: string,
  date: Date,
): boolean {
  return absences.some((absence) => {
    if (absence.employeeId !== employeeId) return false;
    if (sameDay(absence.startsOn, date) || sameDay(absence.endsOn, date)) return true;
    return absence.startsOn < date && absence.endsOn > date;
  });
}

/** Net working minutes in one pattern, never negative. */
export function netMinutes(pattern: WorkingPattern): number {
  return Math.max(0, pattern.endMinute - pattern.startMinute - pattern.breakMinutes);
}

export interface CapacityInput {
  date: Date;
  people: readonly { employeeId: string; name: string }[];
  patterns: readonly WorkingPattern[];
  absences: readonly AbsenceSpan[];
  /** Bays available that day, and how long the site is open, in minutes. */
  bays: number;
  openMinutes: number;
  /** Work already promised, as minutes per employee and in total. */
  booked: readonly { employeeId: string | null; minutes: number }[];
}

function hours(minutes: number): string {
  const value = minutes / 60;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * The day, as three numbers and a sentence.
 *
 * Linear in people plus bookings. Nothing here is quadratic, and nothing here
 * queries: the same arithmetic runs in a test, on a server and in a report
 * without three versions of it drifting apart.
 */
export function capacityFor(input: CapacityInput): DayCapacity {
  const weekday = weekdayOf(input.date);

  const bookedByPerson = new Map<string, number>();
  let bookedTotal = 0;

  for (const entry of input.booked) {
    bookedTotal += entry.minutes;
    if (!entry.employeeId) continue;
    bookedByPerson.set(
      entry.employeeId,
      (bookedByPerson.get(entry.employeeId) ?? 0) + entry.minutes,
    );
  }

  const people: PersonLoad[] = input.people.map((person) => {
    const pattern = input.patterns.find(
      (entry) => entry.employeeId === person.employeeId && entry.weekday === weekday,
    );

    const absent = absentOn(input.absences, person.employeeId, input.date);
    const availableMinutes = absent || !pattern ? 0 : netMinutes(pattern);
    const bookedMinutes = bookedByPerson.get(person.employeeId) ?? 0;

    return {
      employeeId: person.employeeId,
      name: person.name,
      availableMinutes,
      bookedMinutes,
      absent,
      // Null rather than zero or infinity. Somebody who is not in has no
      // utilisation, and a figure of 0% would read as an idle person.
      utilisation: availableMinutes === 0 ? null : bookedMinutes / availableMinutes,
    };
  });

  const peopleMinutes = people.reduce((total, person) => total + person.availableMinutes, 0);
  const bayMinutes = Math.max(0, input.bays) * Math.max(0, input.openMinutes);

  const effectiveMinutes = Math.min(peopleMinutes, bayMinutes);

  const constrainedBy =
    bookedTotal <= effectiveMinutes ? null : peopleMinutes <= bayMinutes ? 'PEOPLE' : 'BAYS';

  const overbookedMinutes = Math.max(0, bookedTotal - effectiveMinutes);
  const absent = people.filter((person) => person.absent).length;

  const summary =
    peopleMinutes === 0
      ? 'Nobody is working that day.'
      : overbookedMinutes > 0
        ? `Overbooked by ${hours(overbookedMinutes)} hours. ${
            constrainedBy === 'BAYS'
              ? 'The bays are the limit, not the people: more hands will not help.'
              : 'The people are the limit, not the bays.'
          }`
        : `${hours(bookedTotal)} of ${hours(effectiveMinutes)} hours promised.${
            absent > 0 ? ` ${absent} away.` : ''
          }`;

  return {
    date: input.date,
    weekday,
    peopleMinutes,
    bayMinutes,
    bookedMinutes: bookedTotal,
    effectiveMinutes,
    constrainedBy,
    overbookedMinutes,
    people: people.sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1)),
    absent,
    summary,
  };
}

/**
 * The next few days that could take a given amount of work.
 *
 * Used for the one thing an overbooked day actually needs, which is not a
 * warning but somewhere to move something to.
 */
export function daysWithRoom(
  days: readonly DayCapacity[],
  minutes: number,
): { date: Date; spareMinutes: number }[] {
  return days
    .map((day) => ({ date: day.date, spareMinutes: day.effectiveMinutes - day.bookedMinutes }))
    .filter((day) => day.spareMinutes >= minutes)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
