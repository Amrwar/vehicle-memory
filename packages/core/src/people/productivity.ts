import { type Money, money, subtract, sum, zero } from '../shared/money';

/**
 * The three hours, and the two ratios between them.
 *
 * A workshop measures a technician's day three times over, and the gaps
 * between the measurements are where the money is:
 *
 *   attended    they were on site and being paid
 *   productive  they were clocked onto a job
 *   sold        the job was billed for that much labour
 *
 * Utilisation is productive over attended: how much of the paid day reached a
 * vehicle at all. It falls when people are waiting for parts, for a decision,
 * or for a bay.
 *
 * Efficiency is sold over productive: how the actual work compared with the
 * time the job was quoted at. Above 100% means beating the book.
 *
 * Productivity is sold over attended, and it is the only one that pays wages.
 * It is also the one that gets quoted least, because it is the least
 * flattering: a technician can be 95% utilised and 110% efficient and the
 * business still loses money if the hours were never sold.
 *
 * Reporting only efficiency is the classic way to make an unprofitable
 * workshop look well run, so all three are computed together and none is
 * available without the others.
 */

export interface HoursWorked {
  technicianId: string;
  technicianName: string;
  /** On site and paid. Attendance, not job time. */
  attendedMinutes: number;
  /** Clocked onto jobs. */
  productiveMinutes: number;
  /** Billed to customers as labour on those jobs. */
  soldMinutes: number;
  /** What the attended time cost, at the rates in force on each day. */
  labourCost: Money;
  /** What the sold labour brought in, net of tax and discount. */
  labourRevenue: Money;
  jobsTouched: number;
}

export interface Productivity extends HoursWorked {
  attendedHours: number;
  productiveHours: number;
  soldHours: number;
  /** productive / attended. Null when nobody attended. */
  utilisationPct: number | null;
  /** sold / productive. Null when nothing was clocked. */
  efficiencyPct: number | null;
  /** sold / attended. The one that pays wages. */
  productivityPct: number | null;
  /** Revenue less the cost of the whole attended day, not just the sold part. */
  labourProfit: Money;
  /** Attended time that never reached a job. */
  idleMinutes: number;
  /** Revenue per attended hour. Comparable across people and sites. */
  revenuePerAttendedHour: Money;
}

const HOURS = 60;

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function productivityFor(worked: HoursWorked): Productivity {
  const attendedHours = worked.attendedMinutes / HOURS;

  return {
    ...worked,
    attendedHours: round1(attendedHours),
    productiveHours: round1(worked.productiveMinutes / HOURS),
    soldHours: round1(worked.soldMinutes / HOURS),
    utilisationPct: ratio(worked.productiveMinutes, worked.attendedMinutes),
    efficiencyPct: ratio(worked.soldMinutes, worked.productiveMinutes),
    productivityPct: ratio(worked.soldMinutes, worked.attendedMinutes),
    labourProfit: subtract(worked.labourRevenue, worked.labourCost),
    // Never negative: clocking more job time than attendance is a data
    // problem, and reporting it as negative idle time hides it inside a
    // plausible-looking number.
    idleMinutes: Math.max(0, worked.attendedMinutes - worked.productiveMinutes),
    revenuePerAttendedHour:
      attendedHours > 0
        ? money(
            Math.round(worked.labourRevenue.minor / attendedHours),
            worked.labourRevenue.currency,
          )
        : zero(worked.labourRevenue.currency),
  };
}

export interface TeamProductivity {
  people: Productivity[];
  totals: Productivity;
  /** People whose clocked time exceeds their attendance. */
  suspect: Productivity[];
}

/**
 * Rolls up a team, and names the records that cannot be right.
 *
 * More job time than attendance means somebody clocked onto a job they were
 * not on site for, or forgot to clock out of one. Averaging that away makes
 * every other figure on the page slightly wrong, so it is surfaced instead.
 */
export function summariseTeam(worked: readonly HoursWorked[], currency = 'GBP'): TeamProductivity {
  const people = worked.map(productivityFor).sort((a, b) => {
    const left = a.productivityPct ?? -1;
    const right = b.productivityPct ?? -1;
    return right - left;
  });

  const totals = productivityFor({
    technicianId: 'total',
    technicianName: 'Team',
    attendedMinutes: worked.reduce((total, row) => total + row.attendedMinutes, 0),
    productiveMinutes: worked.reduce((total, row) => total + row.productiveMinutes, 0),
    soldMinutes: worked.reduce((total, row) => total + row.soldMinutes, 0),
    labourCost: sum(
      worked.map((row) => row.labourCost),
      currency,
    ),
    labourRevenue: sum(
      worked.map((row) => row.labourRevenue),
      currency,
    ),
    jobsTouched: worked.reduce((total, row) => total + row.jobsTouched, 0),
  });

  return {
    people,
    totals,
    suspect: people.filter((person) => person.productiveMinutes > person.attendedMinutes),
  };
}

/* ---------------------------------------------------------------------------
   Attendance
   --------------------------------------------------------------------------- */

export interface AttendanceSpan {
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
}

/**
 * Paid minutes on site.
 *
 * An open span counts up to `asOf` rather than to zero, because a technician
 * halfway through a shift has genuinely attended half a shift, and showing
 * nothing until they clock out makes the live board useless all morning.
 */
export function attendedMinutes(spans: readonly AttendanceSpan[], asOf: Date = new Date()): number {
  return spans.reduce((total, span) => {
    const end = span.endedAt ?? asOf;
    if (end <= span.startedAt) return total;
    const gross = Math.floor((end.getTime() - span.startedAt.getTime()) / 60_000);
    return total + Math.max(0, gross - span.breakMinutes);
  }, 0);
}

/**
 * Spans that overlap each other, which one person cannot have worked.
 *
 * Usually a forgotten clock-out followed by a fresh clock-in the next
 * morning, which otherwise reads as a nineteen-hour shift.
 */
export function overlapping(spans: readonly AttendanceSpan[]): AttendanceSpan[] {
  const sorted = [...spans].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const found: AttendanceSpan[] = [];

  for (const [index, span] of sorted.entries()) {
    const next = sorted[index + 1];
    if (!next) continue;
    const end = span.endedAt;
    if (end === null || end > next.startedAt) found.push(next);
  }

  return found;
}

/** A shift longer than this was almost certainly never closed. NFR. */
export const IMPLAUSIBLE_SHIFT_MINUTES = 16 * 60;

export function implausible(
  spans: readonly AttendanceSpan[],
  asOf: Date = new Date(),
): AttendanceSpan[] {
  return spans.filter((span) => {
    const end = span.endedAt ?? asOf;
    return (end.getTime() - span.startedAt.getTime()) / 60_000 > IMPLAUSIBLE_SHIFT_MINUTES;
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
