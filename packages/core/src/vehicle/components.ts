/**
 * A vehicle as a set of components with ages, rather than a list of visits.
 *
 * Every fact needed for this was already in the product. A job fitted a part,
 * the part line recorded what and when, and the odometer reading recorded how
 * far the car had gone by then. Nothing read those rows as the life of a
 * component, so the question a technician actually asks — how old is this
 * battery — had no answer on any screen.
 *
 * Derived rather than stored, deliberately. A separate component table would
 * be a second account of what was fitted, and the two would disagree the first
 * time somebody corrected a job line. The cost of deriving is a
 * classification step that can be wrong; the cost of storing is two truths.
 *
 * Classification is therefore conservative. A part is only claimed as a known
 * component when the text says so plainly. Everything else stays an ordinary
 * part, listed but not aged, because an invented battery age is worse than no
 * battery age.
 */

/** The components worth following on their own. */
export type ComponentClass =
  | 'BATTERY'
  | 'BRAKE_PADS_FRONT'
  | 'BRAKE_PADS_REAR'
  | 'BRAKE_DISCS_FRONT'
  | 'BRAKE_DISCS_REAR'
  | 'TYRES'
  | 'CLUTCH'
  | 'TIMING_BELT'
  | 'OIL_AND_FILTER'
  | 'AIR_FILTER'
  | 'CABIN_FILTER'
  | 'FUEL_FILTER'
  | 'SPARK_PLUGS'
  | 'COOLANT'
  | 'BRAKE_FLUID'
  | 'WIPER_BLADES'
  | 'SUSPENSION'
  | 'EXHAUST';

export interface ComponentSpec {
  label: string;
  /** Where it belongs on the page. */
  group: 'Consumables' | 'Braking' | 'Running gear' | 'Driveline' | 'Electrical';
  /**
   * How long one of these is normally expected to last, as months and as
   * kilometres. Both are upper bounds on ordinary use rather than promises,
   * and whichever arrives first is the one that matters.
   *
   * These are general figures, not manufacturer schedules. They are used for
   * one purpose: to say whether a component is young, ageing or past its
   * usual life. Nothing charges anybody money on the strength of them.
   */
  expectedMonths: number;
  expectedKm: number;
}

export const COMPONENTS: Record<ComponentClass, ComponentSpec> = {
  BATTERY: { label: 'Battery', group: 'Electrical', expectedMonths: 60, expectedKm: 120_000 },
  BRAKE_PADS_FRONT: {
    label: 'Front brake pads',
    group: 'Braking',
    expectedMonths: 36,
    expectedKm: 45_000,
  },
  BRAKE_PADS_REAR: {
    label: 'Rear brake pads',
    group: 'Braking',
    expectedMonths: 48,
    expectedKm: 70_000,
  },
  BRAKE_DISCS_FRONT: {
    label: 'Front brake discs',
    group: 'Braking',
    expectedMonths: 60,
    expectedKm: 90_000,
  },
  BRAKE_DISCS_REAR: {
    label: 'Rear brake discs',
    group: 'Braking',
    expectedMonths: 72,
    expectedKm: 110_000,
  },
  TYRES: { label: 'Tyres', group: 'Running gear', expectedMonths: 60, expectedKm: 40_000 },
  CLUTCH: { label: 'Clutch', group: 'Driveline', expectedMonths: 96, expectedKm: 150_000 },
  TIMING_BELT: {
    label: 'Timing belt',
    group: 'Driveline',
    expectedMonths: 72,
    expectedKm: 100_000,
  },
  OIL_AND_FILTER: {
    label: 'Engine oil and filter',
    group: 'Consumables',
    expectedMonths: 12,
    expectedKm: 15_000,
  },
  AIR_FILTER: { label: 'Air filter', group: 'Consumables', expectedMonths: 24, expectedKm: 30_000 },
  CABIN_FILTER: {
    label: 'Cabin filter',
    group: 'Consumables',
    expectedMonths: 24,
    expectedKm: 30_000,
  },
  FUEL_FILTER: {
    label: 'Fuel filter',
    group: 'Consumables',
    expectedMonths: 36,
    expectedKm: 60_000,
  },
  SPARK_PLUGS: {
    label: 'Spark plugs',
    group: 'Consumables',
    expectedMonths: 48,
    expectedKm: 60_000,
  },
  COOLANT: { label: 'Coolant', group: 'Consumables', expectedMonths: 60, expectedKm: 100_000 },
  BRAKE_FLUID: { label: 'Brake fluid', group: 'Braking', expectedMonths: 24, expectedKm: 50_000 },
  WIPER_BLADES: {
    label: 'Wiper blades',
    group: 'Consumables',
    expectedMonths: 18,
    expectedKm: 30_000,
  },
  SUSPENSION: {
    label: 'Suspension',
    group: 'Running gear',
    expectedMonths: 96,
    expectedKm: 140_000,
  },
  EXHAUST: { label: 'Exhaust', group: 'Driveline', expectedMonths: 96, expectedKm: 140_000 },
};

/**
 * Which axle a line is talking about, where it says.
 *
 * Front and rear brakes wear at different rates and are replaced at different
 * times, so calling them one component would age both from whichever was done
 * last and quietly report the rear pads as new.
 */
function axleOf(text: string): 'FRONT' | 'REAR' | null {
  if (/\b(front|nearside front|offside front|n\/s\/f|o\/s\/f)\b/.test(text)) return 'FRONT';
  if (/\b(rear|back|nearside rear|offside rear|n\/s\/r|o\/s\/r)\b/.test(text)) return 'REAR';
  return null;
}

/**
 * What component a fitted part is, or nothing.
 *
 * Ordered, and the order is load-bearing: "brake fluid" contains "brake", and
 * a discs rule that ran first would age the discs every time the fluid was
 * changed. The specific patterns are tested before the general ones.
 */
export function classifyPart(
  description: string,
  partNumber?: string | null,
): ComponentClass | null {
  const text = `${description} ${partNumber ?? ''}`.toLowerCase();

  if (/\bbrake fluid\b|\bdot\s?[345]\b/.test(text)) return 'BRAKE_FLUID';

  if (/\bdisc(s)?\b|\brotor(s)?\b/.test(text) && /\bbrake\b|\bdisc\b/.test(text)) {
    return axleOf(text) === 'REAR' ? 'BRAKE_DISCS_REAR' : 'BRAKE_DISCS_FRONT';
  }

  if (/\bpad(s)?\b/.test(text)) {
    return axleOf(text) === 'REAR' ? 'BRAKE_PADS_REAR' : 'BRAKE_PADS_FRONT';
  }

  if (/\bbatter(y|ies)\b|\bagm\b|\befb\b/.test(text)) return 'BATTERY';
  if (/\btyre(s)?\b|\btire(s)?\b/.test(text)) return 'TYRES';
  if (/\bclutch\b/.test(text)) return 'CLUTCH';
  if (/\b(timing|cam)\s?belt\b|\bcambelt\b|\btiming chain\b/.test(text)) return 'TIMING_BELT';
  if (/\bcabin filter\b|\bpollen filter\b/.test(text)) return 'CABIN_FILTER';
  if (/\bair filter\b/.test(text)) return 'AIR_FILTER';
  if (/\bfuel filter\b|\bdiesel filter\b/.test(text)) return 'FUEL_FILTER';
  if (/\bspark plug(s)?\b|\bglow plug(s)?\b/.test(text)) return 'SPARK_PLUGS';
  if (/\bcoolant\b|\bantifreeze\b/.test(text)) return 'COOLANT';
  if (/\bwiper(s)?\b|\bwiper blade(s)?\b/.test(text)) return 'WIPER_BLADES';
  if (/\bshock absorber(s)?\b|\bstrut(s)?\b|\bcoil spring(s)?\b|\bsuspension\b/.test(text)) {
    return 'SUSPENSION';
  }
  if (/\bexhaust\b|\bsilencer\b|\bcatalytic\b|\bdpf\b/.test(text)) return 'EXHAUST';

  // Oil last: "oil filter" and "engine oil" both land here, and "oil" appears
  // inside plenty of descriptions that are not a service.
  if (/\bengine oil\b|\boil (and|&) filter\b|\boil filter\b|\boil service\b/.test(text)) {
    return 'OIL_AND_FILTER';
  }

  return null;
}

/** One part that went on a vehicle, as the database already records it. */
export interface Fitting {
  description: string;
  partNumber?: string | null;
  brand?: string | null;
  fittedOn: Date;
  /** The odometer at the visit, where it was taken. */
  fittedAtKm?: number | null;
  jobId: string;
  jobNumber: number;
}

export type ComponentCondition = 'NEW' | 'GOOD' | 'AGEING' | 'DUE' | 'OVERDUE' | 'UNKNOWN';

export interface ComponentState {
  component: ComponentClass;
  label: string;
  group: ComponentSpec['group'];
  fittedOn: Date;
  fittedAtKm: number | null;
  brand: string | null;
  jobId: string;
  jobNumber: number;
  ageMonths: number;
  /** Distance travelled since it was fitted, where both readings exist. */
  kmSince: number | null;
  /**
   * How far through its expected life it is, as a fraction. Above 1 means
   * past the usual life, and the number is deliberately not capped: a belt at
   * 1.8 is a different conversation from one at 1.05.
   */
  usedUp: number;
  /** Which of the two measures put it there, so the figure can be argued with. */
  drivenBy: 'AGE' | 'DISTANCE';
  condition: ComponentCondition;
  summary: string;
}

/** Whole months between two dates, month-end safe. */
function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function conditionFor(usedUp: number): ComponentCondition {
  if (usedUp >= 1) return 'OVERDUE';
  if (usedUp >= 0.85) return 'DUE';
  if (usedUp >= 0.6) return 'AGEING';
  if (usedUp >= 0.15) return 'GOOD';
  return 'NEW';
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

/**
 * The current state of every component this vehicle has a record of.
 *
 * Only the most recent fitting of each class counts. Replacing the front pads
 * twice does not make them older, and a list that showed both would have the
 * reader working out which one is current.
 *
 * Linear in the number of fittings, with one pass to pick the latest of each
 * class and a sort at the end. A vehicle has tens of these, not thousands.
 */
export function componentsFrom(
  fittings: readonly Fitting[],
  options: { now?: Date; currentKm?: number | null } = {},
): ComponentState[] {
  const now = options.now ?? new Date();
  const currentKm = options.currentKm ?? null;

  const latest = new Map<ComponentClass, Fitting>();

  for (const fitting of fittings) {
    const component = classifyPart(fitting.description, fitting.partNumber);
    if (!component) continue;

    const held = latest.get(component);
    if (!held || fitting.fittedOn > held.fittedOn) latest.set(component, fitting);
  }

  const states: ComponentState[] = [];

  for (const [component, fitting] of latest) {
    const spec = COMPONENTS[component];
    const ageMonths = monthsBetween(fitting.fittedOn, now);

    const kmSince =
      currentKm != null && fitting.fittedAtKm != null && currentKm >= fitting.fittedAtKm
        ? currentKm - fitting.fittedAtKm
        : null;

    const byAge = ageMonths / spec.expectedMonths;
    const byDistance = kmSince == null ? 0 : kmSince / spec.expectedKm;

    // Whichever comes first, which is the same rule warranty cover follows.
    const usedUp = Math.max(byAge, byDistance);
    const drivenBy = byDistance > byAge ? 'DISTANCE' : 'AGE';

    const distance = kmSince == null ? '' : `, ${kmSince.toLocaleString('en-GB')} km ago`;

    states.push({
      component,
      label: spec.label,
      group: spec.group,
      fittedOn: fitting.fittedOn,
      fittedAtKm: fitting.fittedAtKm ?? null,
      brand: fitting.brand ?? null,
      jobId: fitting.jobId,
      jobNumber: fitting.jobNumber,
      ageMonths,
      kmSince,
      usedUp,
      drivenBy,
      condition: conditionFor(usedUp),
      summary:
        ageMonths === 0
          ? `Fitted this month${distance}.`
          : `${plural(ageMonths, 'month')} old${distance}.`,
    });
  }

  // Worst first. Somebody opening this is looking for what needs doing.
  return states.sort((a, b) => b.usedUp - a.usedUp || a.label.localeCompare(b.label));
}

/**
 * What this vehicle has no record of at all.
 *
 * The absence is information. A twelve-year-old car with no battery on record
 * has either never had one fitted here or had one fitted before the records
 * start, and both of those are worth saying out loud rather than leaving as a
 * gap somebody reads as "fine".
 */
export function componentsMissing(states: readonly ComponentState[]): ComponentClass[] {
  const known = new Set(states.map((state) => state.component));

  return (Object.keys(COMPONENTS) as ComponentClass[]).filter((component) => !known.has(component));
}
