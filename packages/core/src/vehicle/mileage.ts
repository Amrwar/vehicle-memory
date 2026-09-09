/**
 * Odometer readings.
 *
 * The design rule here is counter-intuitive and worth stating plainly.
 *
 * The obvious implementation rejects a reading lower than the last one,
 * because a car cannot un-drive. That implementation is wrong. A decreasing
 * odometer is either a clerical error or **odometer fraud**, and the second is
 * precisely the thing a used-car buyer most needs to know. Rejecting the
 * reading destroys the evidence.
 *
 * So: record everything, flag what is impossible, and let the passport show
 * it. FR-307, invariant V7.
 */

export type OdometerAnomaly = 'NONE' | 'DECREASE' | 'IMPLAUSIBLE_RATE';

export interface Reading {
  km: number;
  readAt: Date;
}

/**
 * A daily distance above this is treated as implausible for a normal vehicle.
 * 1,000 km/day sustained is roughly 12 hours of motorway driving every day,
 * which does happen for long-haul fleet vehicles but is worth a human look.
 */
export const IMPLAUSIBLE_KM_PER_DAY = 1000;

/** Below this many days apart, rate analysis is too noisy to be meaningful. */
const MIN_DAYS_FOR_RATE = 0.5;

export interface AnomalyAssessment {
  anomaly: OdometerAnomaly;
  /** Implied average, null when the interval is too short to judge. */
  kmPerDay: number | null;
  message: string | null;
}

export function assessReading(candidate: Reading, previous: Reading | null): AnomalyAssessment {
  if (candidate.km < 0) {
    throw new RangeError('An odometer reading cannot be negative');
  }

  if (!previous) {
    return { anomaly: 'NONE', kmPerDay: null, message: null };
  }

  if (candidate.km < previous.km) {
    const difference = previous.km - candidate.km;
    return {
      anomaly: 'DECREASE',
      kmPerDay: null,
      message:
        `This reading is ${difference.toLocaleString()} km lower than the previous one ` +
        `(${previous.km.toLocaleString()} km on ${previous.readAt.toISOString().slice(0, 10)}). ` +
        'It has been recorded and flagged.',
    };
  }

  const days = (candidate.readAt.getTime() - previous.readAt.getTime()) / 86_400_000;

  if (days < MIN_DAYS_FOR_RATE) {
    return { anomaly: 'NONE', kmPerDay: null, message: null };
  }

  const kmPerDay = (candidate.km - previous.km) / days;

  if (kmPerDay > IMPLAUSIBLE_KM_PER_DAY) {
    return {
      anomaly: 'IMPLAUSIBLE_RATE',
      kmPerDay,
      message:
        `This implies ${Math.round(kmPerDay).toLocaleString()} km per day since the previous ` +
        'reading, which is unusually high. It has been recorded and flagged.',
    };
  }

  return { anomaly: 'NONE', kmPerDay, message: null };
}

/**
 * Average daily distance from the recent history, used to project when the
 * next service falls due (FR-308).
 *
 * Readings are used in ascending date order and only positive intervals count,
 * so a flagged decrease does not poison the projection. Returns null when
 * there is not enough evidence, which the caller must handle rather than
 * silently assuming a default — a fabricated service interval is worse than
 * no service interval.
 */
export function averageKmPerDay(readings: readonly Reading[], minimumSamples = 2): number | null {
  const ordered = [...readings].sort((a, b) => a.readAt.getTime() - b.readAt.getTime());

  if (ordered.length < minimumSamples) return null;

  let totalKm = 0;
  let totalDays = 0;

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (!previous || !current) continue;

    const km = current.km - previous.km;
    const days = (current.readAt.getTime() - previous.readAt.getTime()) / 86_400_000;

    if (km <= 0 || days <= 0) continue;

    totalKm += km;
    totalDays += days;
  }

  if (totalDays <= 0) return null;

  return totalKm / totalDays;
}

export interface ServiceDue {
  dueAt: Date | null;
  dueKm: number | null;
  /** Whichever of the two comes first, which is how service intervals work. */
  projectedDueAt: Date | null;
  isOverdue: boolean;
  kmRemaining: number | null;
  daysRemaining: number | null;
}

export interface ServiceIntervalInput {
  lastPerformedAt: Date | null;
  lastPerformedKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  currentKm: number | null;
  kmPerDay: number | null;
  now?: Date;
}

/**
 * Projects the next service, by date and by distance, and reports whichever
 * arrives first. A workshop quoting "due in March or at 90,000 km, whichever
 * comes first" is stating exactly this calculation.
 */
export function projectServiceDue(input: ServiceIntervalInput): ServiceDue {
  const now = input.now ?? new Date();

  const dueAt =
    input.lastPerformedAt && input.intervalMonths
      ? addMonths(input.lastPerformedAt, input.intervalMonths)
      : null;

  const dueKm =
    input.lastPerformedKm !== null && input.intervalKm
      ? input.lastPerformedKm + input.intervalKm
      : null;

  const kmRemaining = dueKm !== null && input.currentKm !== null ? dueKm - input.currentKm : null;

  const daysRemaining = dueAt ? (dueAt.getTime() - now.getTime()) / 86_400_000 : null;

  // Project the distance-based due date from the observed driving rate.
  let projectedFromKm: Date | null = null;
  if (kmRemaining !== null && input.kmPerDay && input.kmPerDay > 0) {
    projectedFromKm = new Date(now.getTime() + (kmRemaining / input.kmPerDay) * 86_400_000);
  }

  const candidates = [dueAt, projectedFromKm].filter((d): d is Date => d !== null);
  const projectedDueAt =
    candidates.length > 0
      ? new Date(Math.min(...candidates.map((d) => d.getTime())))
      : null;

  const isOverdue =
    (daysRemaining !== null && daysRemaining < 0) || (kmRemaining !== null && kmRemaining < 0);

  return { dueAt, dueKm, projectedDueAt, isOverdue, kmRemaining, daysRemaining };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const day = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);

  // Clamp: 31 January plus one month is 28 or 29 February, not 3 March.
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));

  return result;
}

export function formatKm(km: number, locale = 'en-GB'): string {
  return `${km.toLocaleString(locale)} km`;
}
