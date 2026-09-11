/**
 * One number for a vehicle's condition, and the working behind it.
 *
 * A score like this is either the most useful thing on the page or the most
 * damaging. It is damaging when it is a black box: somebody reads 62, cannot
 * find out why, and either ignores it or, worse, quotes it to a buyer.
 *
 * So three rules hold here and are enforced by the types.
 *
 * Every factor states its own score, its weight, and the evidence that
 * produced it. Nothing contributes to the total without saying why.
 *
 * A factor with no evidence is excluded and the remaining weights are
 * renormalised. The alternative — scoring an unknown as zero or as full marks
 * — is the classic way these numbers lie. A car with no inspection on record
 * is not a car that failed its inspection, and it is not a car that passed.
 *
 * The score belongs to the vehicle, not to the workshop. Nothing in it
 * measures how much the vehicle spent, how recently it visited this
 * particular workshop, or anything else that would make a well-maintained car
 * look worse for having been maintained somewhere else.
 */

export type FactorId =
  'MAINTENANCE' | 'OPEN_ISSUES' | 'DECLINED' | 'COMPONENTS' | 'INSPECTION' | 'HISTORY';

export interface Factor {
  id: FactorId;
  label: string;
  /** 0 to 100. Higher is better, always. */
  score: number;
  /** Its share of the total, before renormalising for missing factors. */
  weight: number;
  /** What produced the score, in a sentence somebody can check. */
  why: string;
}

export interface Health {
  /** 0 to 100, or null when there is not enough on record to say anything. */
  score: number | null;
  band: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';
  /** The factors that counted, with their renormalised weights. */
  factors: Factor[];
  /** The factors excluded for want of evidence, so the gap is visible. */
  unknown: { id: FactorId; label: string; why: string }[];
  /**
   * How much of the intended weight was actually available. A score built on
   * a third of its factors is a different claim from one built on all six,
   * and the reader is told which they have.
   */
  coverage: number;
  summary: string;
}

/** Everything the score is allowed to look at. */
export interface HealthInput {
  /** Active service schedules, with when each was due. */
  schedules: readonly { name: string; dueAt: Date | null; dueKm: number | null }[];
  /** Inspection findings not yet put right, by severity. */
  openCritical: number;
  openAdvisory: number;
  /** Whether any inspection has ever been carried out on this vehicle. */
  inspectionsEver: number;
  lastInspectionAt: Date | null;
  /** Work quoted and turned down, and how much of it was critical. */
  declinedTotal: number;
  declinedCritical: number;
  /** Component states from `componentsFrom`. */
  components: readonly { label: string; usedUp: number }[];
  /** Recorded visits, of any kind, anywhere. */
  visits: number;
  currentKm: number | null;
  now?: Date;
}

const WEIGHTS: Record<FactorId, number> = {
  MAINTENANCE: 0.25,
  OPEN_ISSUES: 0.25,
  COMPONENTS: 0.2,
  DECLINED: 0.15,
  INSPECTION: 0.1,
  HISTORY: 0.05,
};

const LABELS: Record<FactorId, string> = {
  MAINTENANCE: 'Maintenance kept up',
  OPEN_ISSUES: 'Faults left open',
  COMPONENTS: 'Condition of components',
  DECLINED: 'Work turned down',
  INSPECTION: 'How recently it was looked at',
  HISTORY: 'How much is on record',
};

/** Clamps to the 0–100 the whole page assumes. */
function bounded(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function bandFor(score: number): Health['band'] {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
}

/**
 * The score.
 *
 * Linear in the number of schedules and components, both of which are tens at
 * most. Nothing here queries; everything it needs is passed in, so the same
 * arithmetic runs in a test, on a server and in a report without three
 * versions of it existing.
 */
export function healthOf(input: HealthInput): Health {
  const now = input.now ?? new Date();

  const factors: Factor[] = [];
  const unknown: Health['unknown'] = [];

  const skip = (id: FactorId, why: string) => unknown.push({ id, label: LABELS[id], why });

  /* --- maintenance kept up ------------------------------------------------ */

  if (input.schedules.length === 0) {
    skip('MAINTENANCE', 'No service schedule on record for this vehicle.');
  } else {
    const overdue = input.schedules.filter(
      (schedule) => schedule.dueAt !== null && schedule.dueAt < now,
    );

    // How late, not merely whether late. A service a week overdue and one two
    // years overdue are not the same vehicle, and a count cannot tell them
    // apart.
    const worstDays = overdue.reduce(
      (worst, schedule) => Math.max(worst, daysBetween(schedule.dueAt!, now)),
      0,
    );

    // Full marks with nothing overdue; a year late is nothing left.
    const lateness = Math.min(1, worstDays / 365);
    const share = overdue.length / input.schedules.length;
    const score = bounded(100 * (1 - Math.max(lateness, share * 0.6)));

    factors.push({
      id: 'MAINTENANCE',
      label: LABELS.MAINTENANCE,
      score,
      weight: WEIGHTS.MAINTENANCE,
      why:
        overdue.length === 0
          ? `All ${input.schedules.length} scheduled services are up to date.`
          : `${overdue.length} of ${input.schedules.length} overdue, the worst by ${worstDays} days.`,
    });
  }

  /* --- faults left open ---------------------------------------------------- */

  if (input.inspectionsEver === 0) {
    skip('OPEN_ISSUES', 'Nothing has ever been inspected, so nothing is known to be wrong.');
  } else {
    // A critical finding is a safety item somebody has already seen and
    // written down. It weighs an order more than an advisory.
    const penalty = Math.min(100, input.openCritical * 30 + input.openAdvisory * 6);
    const score = bounded(100 - penalty);

    factors.push({
      id: 'OPEN_ISSUES',
      label: LABELS.OPEN_ISSUES,
      score,
      weight: WEIGHTS.OPEN_ISSUES,
      why:
        input.openCritical + input.openAdvisory === 0
          ? 'Nothing found at the last inspection is still outstanding.'
          : `${input.openCritical} critical and ${input.openAdvisory} advisory items still open.`,
    });
  }

  /* --- condition of components --------------------------------------------- */

  if (input.components.length === 0) {
    skip('COMPONENTS', 'No parts on record, so no component can be aged.');
  } else {
    // The worst component carries most of this. A car with nine good parts
    // and a timing belt at twice its life is not a healthy car, and an
    // average would say it was.
    const worst = input.components.reduce(
      (highest, component) => Math.max(highest, component.usedUp),
      0,
    );
    const mean =
      input.components.reduce((total, component) => total + component.usedUp, 0) /
      input.components.length;

    const used = Math.min(1.5, worst * 0.7 + mean * 0.3);
    const score = bounded(100 * (1 - used / 1.5));

    const worstLabel =
      input.components.find((component) => component.usedUp === worst)?.label ?? 'a component';

    factors.push({
      id: 'COMPONENTS',
      label: LABELS.COMPONENTS,
      score,
      weight: WEIGHTS.COMPONENTS,
      why:
        worst >= 1
          ? `${worstLabel} is past its usual life.`
          : `${worstLabel} is the furthest through its life, at ${Math.round(worst * 100)}%.`,
    });
  }

  /* --- work turned down ----------------------------------------------------- */

  if (input.declinedTotal === 0 && input.visits === 0) {
    skip('DECLINED', 'Nothing has been quoted on this vehicle yet.');
  } else {
    const penalty = Math.min(100, input.declinedCritical * 35 + input.declinedTotal * 8);
    const score = bounded(100 - penalty);

    factors.push({
      id: 'DECLINED',
      label: LABELS.DECLINED,
      score,
      weight: WEIGHTS.DECLINED,
      why:
        input.declinedTotal === 0
          ? 'No recommended work has been turned down.'
          : `${input.declinedTotal} recommended item${input.declinedTotal === 1 ? '' : 's'} turned down, ${input.declinedCritical} of them critical.`,
    });
  }

  /* --- how recently it was looked at ---------------------------------------- */

  if (!input.lastInspectionAt) {
    skip('INSPECTION', 'No inspection has been carried out on this vehicle.');
  } else {
    const days = daysBetween(input.lastInspectionAt, now);
    // Full marks inside six months, nothing after two years.
    const score = bounded(100 * (1 - Math.max(0, days - 182) / (730 - 182)));

    factors.push({
      id: 'INSPECTION',
      label: LABELS.INSPECTION,
      score,
      weight: WEIGHTS.INSPECTION,
      why: `Last inspected ${days} days ago.`,
    });
  }

  /* --- how much is on record ------------------------------------------------ */

  if (input.visits === 0) {
    skip('HISTORY', 'No visits on record.');
  } else {
    // Not a measure of the vehicle, and it is weighted lowest for that
    // reason. It is a measure of how much the rest of this score is standing
    // on, and it belongs in the open rather than hidden in a caveat.
    const score = bounded(Math.min(100, input.visits * 20));

    factors.push({
      id: 'HISTORY',
      label: LABELS.HISTORY,
      score,
      weight: WEIGHTS.HISTORY,
      why: `${input.visits} recorded visit${input.visits === 1 ? '' : 's'}.`,
    });
  }

  /* --- the total ------------------------------------------------------------ */

  const available = factors.reduce((total, factor) => total + factor.weight, 0);

  if (available === 0) {
    return {
      score: null,
      band: 'UNKNOWN',
      factors: [],
      unknown,
      coverage: 0,
      summary: 'Nothing is on record for this vehicle yet, so there is nothing to score.',
    };
  }

  // Renormalise. A missing factor must not drag the total down or push it up;
  // it must simply not be part of it.
  const renormalised = factors.map((factor) => ({
    ...factor,
    weight: factor.weight / available,
  }));

  const score = bounded(
    renormalised.reduce((total, factor) => total + factor.score * factor.weight, 0),
  );

  const weakest = [...renormalised].sort((a, b) => a.score - b.score)[0]!;

  return {
    score,
    band: bandFor(score),
    // Worst first: the reason to look at the page is what is wrong with it.
    factors: renormalised.sort((a, b) => a.score - b.score),
    unknown,
    coverage: available,
    summary:
      weakest.score >= 85
        ? 'Nothing on record needs attention.'
        : `${weakest.label.toLowerCase()} is what holds this back. ${weakest.why}`,
  };
}
