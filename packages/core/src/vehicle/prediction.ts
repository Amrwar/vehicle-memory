/**
 * What is likely due, and in roughly how far.
 *
 * "Service due in two months" is a date somebody set once. "Brake inspection
 * in about 1,200 km" is a statement about this particular vehicle: how far it
 * actually travels in a week, and how long its own parts have actually
 * lasted. The second is worth reading and the first is not, and the
 * difference is entirely in what the estimate is built from.
 *
 * Three rules keep it honest.
 *
 * It predicts from the vehicle's own history where there is enough of it, and
 * from the general expected life where there is not, and it says which. A
 * prediction that hides which one it used cannot be argued with.
 *
 * It refuses rather than guesses. No mileage rate, no distance prediction. A
 * confident number from two readings a fortnight apart is worse than a blank,
 * because somebody plans around it.
 *
 * Its confidence is stated and falls with the distance predicted. Every
 * mileage projection is a straight line through a habit that changes, and a
 * line drawn eighteen months out is a guess wearing a number.
 */

import { COMPONENTS, type ComponentClass, type ComponentState } from './components';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Prediction {
  component: ComponentClass;
  label: string;
  /** Kilometres from now, rounded to something a person would say aloud. */
  kmAway: number | null;
  /**
   * Days from now. Always answerable: with a mileage rate it converts the
   * distance, and without one it falls back to the component's expected life
   * in months, which is why `basis` and `confidence` sit beside it.
   */
  daysAway: number;
  dueOn: Date;
  confidence: Confidence;
  /** Where the interval came from, so the number can be checked. */
  basis: 'THIS_VEHICLE' | 'GENERAL';
  why: string;
  /** True when it is already past, rather than approaching. */
  overdue: boolean;
}

/**
 * How many previous replacements it takes before this vehicle's own interval
 * is used instead of the general one.
 *
 * Two fittings give one interval, and one interval is an anecdote. Three give
 * two, which is the least that can disagree with itself.
 */
export const MIN_INTERVALS = 2;

/** Rounds to a figure somebody would actually say. */
function speak(km: number): number {
  if (km < 500) return Math.round(km / 50) * 50;
  if (km < 5_000) return Math.round(km / 100) * 100;
  return Math.round(km / 500) * 500;
}

/**
 * This vehicle's own interval for a component, from its own history.
 *
 * Returns null unless there are enough past replacements to have an opinion.
 * The median rather than the mean: one replacement done early because
 * something else was already apart should not shorten every future estimate.
 */
export function ownInterval(fittedAtKm: readonly number[]): number | null {
  const ordered = [...fittedAtKm].sort((a, b) => a - b);

  // Two lines on one job are one replacement. Collapse them before measuring
  // anything, rather than skipping the small gap and then measuring the next
  // one from the duplicate: that quietly shortens every interval after it by
  // however far apart the two lines happened to be.
  const distinct: number[] = [];
  for (const reading of ordered) {
    const last = distinct[distinct.length - 1];
    if (last === undefined || reading - last > 100) distinct.push(reading);
  }

  const gaps: number[] = [];
  for (let index = 1; index < distinct.length; index += 1) {
    gaps.push(distinct[index]! - distinct[index - 1]!);
  }

  if (gaps.length < MIN_INTERVALS) return null;

  const sorted = gaps.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

export interface PredictionInput {
  /** Current component states, from `componentsFrom`. */
  components: readonly ComponentState[];
  /**
   * Every past fitting mileage per component, oldest to newest, used to learn
   * this vehicle's own intervals.
   */
  historyKm: ReadonlyMap<ComponentClass, readonly number[]>;
  currentKm: number | null;
  /** From `averageKmPerDay`. Null where there is not enough to say. */
  kmPerDay: number | null;
  now?: Date;
}

/**
 * What is coming, nearest first.
 *
 * Linear in the number of components, which is bounded by the component list
 * itself. There is no loop over history here beyond one median per component.
 */
export function predictDue(input: PredictionInput): Prediction[] {
  const now = input.now ?? new Date();
  const predictions: Prediction[] = [];

  for (const state of input.components) {
    const spec = COMPONENTS[state.component];

    const learned = ownInterval(input.historyKm.get(state.component) ?? []);
    const interval = learned ?? spec.expectedKm;
    const basis = learned ? 'THIS_VEHICLE' : 'GENERAL';

    let kmAway: number | null = null;

    if (input.currentKm != null && state.fittedAtKm != null) {
      const travelled = input.currentKm - state.fittedAtKm;
      kmAway = interval - travelled;
    }

    // No reading to count from means no distance prediction. The component
    // still appears, aged by time, because a fifteen-year-old brake fluid
    // change is worth saying even with no mileage behind it.
    const byAgeMonths = spec.expectedMonths - state.ageMonths;

    const daysAway =
      kmAway != null && input.kmPerDay && input.kmPerDay > 0
        ? Math.round(kmAway / input.kmPerDay)
        : byAgeMonths * 30;

    const dueOn = new Date(now.getTime() + daysAway * 86_400_000);

    // Confidence falls with how far out the prediction reaches, because every
    // one of these is a straight line through a habit that changes.
    // Seven months is roughly the next visit. Beyond a year a straight line
    // through somebody's driving habit is a guess wearing a number, whatever
    // it was drawn from.
    const horizon = Math.abs(daysAway);
    const confidence: Confidence =
      basis === 'THIS_VEHICLE' && horizon <= 210 ? 'HIGH' : horizon <= 365 ? 'MEDIUM' : 'LOW';

    predictions.push({
      component: state.component,
      label: spec.label,
      kmAway: kmAway == null ? null : speak(Math.abs(kmAway)) * (kmAway < 0 ? -1 : 1),
      daysAway,
      dueOn,
      confidence,
      basis,
      why:
        basis === 'THIS_VEHICLE'
          ? `This vehicle has gone about ${interval.toLocaleString('en-GB')} km between changes.`
          : input.kmPerDay
            ? `No pattern for this vehicle yet, so a general ${interval.toLocaleString('en-GB')} km is used at ${Math.round(input.kmPerDay)} km a day.`
            : `No pattern and no mileage rate, so this is from age alone.`,
      overdue: daysAway < 0 || (kmAway != null && kmAway < 0),
    });
  }

  // Soonest first, overdue before that. Somebody reads the top three.
  return predictions.sort((a, b) => a.daysAway - b.daysAway);
}

/**
 * The two or three worth putting in front of somebody.
 *
 * A list of eighteen components each with a date is a table nobody reads. The
 * useful form is the handful arriving inside the window that matters, which
 * is roughly the next visit.
 */
export function dueWithin(predictions: readonly Prediction[], days = 120): Prediction[] {
  return predictions.filter((prediction) => prediction.daysAway <= days);
}
