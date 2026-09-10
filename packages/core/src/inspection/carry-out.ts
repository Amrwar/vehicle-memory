import {
  PAD_ADVISORY_MM,
  PAD_CRITICAL_MM,
  type MeasurementType,
  type Severity,
  severityForMeasurement,
  TREAD_ADVISORY_MM,
  TREAD_CRITICAL_MM,
} from './to-estimate';

/**
 * Carrying out an inspection, as opposed to reading one afterwards.
 *
 * The person using this is standing next to a car with a tablet, often with
 * oily hands, and is being interrupted. Every rule here follows from that.
 *
 * An unchecked item stays unchecked. The obvious design is to refuse to
 * complete an inspection with gaps in it, and it is wrong: a technician who
 * cannot finish will tick boxes to get out of the screen, and a green tick
 * that means "I wanted to leave" is worse than an honest blank. So gaps are
 * allowed, recorded, and shown to the customer as not checked.
 *
 * A measurement suggests a severity and never sets it. Two millimetres of pad
 * is critical on almost every car and is not on a few, and the person holding
 * the gauge knows which they are looking at. The suggestion saves the typing;
 * the technician keeps the decision.
 *
 * Nothing is scored and nothing is averaged. An inspection with nine greens
 * and one red is not ninety per cent healthy, it is a car with a red on it.
 */

export type ItemSeverity = Severity;

export interface TemplateItem {
  id: string;
  sectionName: string;
  name: string;
  guidance?: string | null;
  measurementType: MeasurementType;
  position?: string | null;
}

export interface RecordedResult {
  templateItemId: string;
  severity: ItemSeverity;
  note?: string | null;
  measurementValue?: number | null;
  recommendedAction?: string | null;
  estimatedCost?: number | null;
  photoCount?: number;
}

export interface Progress {
  total: number;
  checked: number;
  remaining: number;
  /** Whole percent, for a bar. Never used as a health score. */
  percent: number;
  critical: number;
  advisory: number;
}

export function progressOf(
  items: readonly TemplateItem[],
  results: readonly RecordedResult[],
): Progress {
  const byItem = new Map(results.map((result) => [result.templateItemId, result]));

  let checked = 0;
  let critical = 0;
  let advisory = 0;

  for (const item of items) {
    const result = byItem.get(item.id);

    if (!result || result.severity === 'NOT_CHECKED') continue;

    checked += 1;
    if (result.severity === 'CRITICAL') critical += 1;
    if (result.severity === 'ADVISORY') advisory += 1;
  }

  return {
    total: items.length,
    checked,
    remaining: items.length - checked,
    percent: items.length === 0 ? 0 : Math.round((checked / items.length) * 100),
    critical,
    advisory,
  };
}

/**
 * What a measurement implies, before the technician decides.
 *
 * Returns nothing when the measurement type carries no published threshold,
 * rather than inventing one. A voltage reading means different things on
 * different vehicles and this module has no business guessing.
 */
export function suggestSeverity(
  measurementType: MeasurementType,
  value: number | null | undefined,
): { severity: ItemSeverity; because: string } | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;

  const severity = severityForMeasurement(value, measurementType);
  if (!severity) return null;

  const because =
    measurementType === 'TREAD_DEPTH_MM'
      ? severity === 'CRITICAL'
        ? `${value}mm is at or below the ${TREAD_CRITICAL_MM}mm legal limit.`
        : `${value}mm is below ${TREAD_ADVISORY_MM}mm, so it will not last another year.`
      : measurementType === 'PAD_THICKNESS_MM'
        ? severity === 'CRITICAL'
          ? `${value}mm of pad left, at or below the ${PAD_CRITICAL_MM}mm replacement point.`
          : `${value}mm of pad left, below the ${PAD_ADVISORY_MM}mm at which it is worth quoting.`
        : `${value} reads as ${severity.toLowerCase()}.`;

  return { severity, because };
}

export class InspectionError extends Error {
  readonly code: 'ALREADY_COMPLETE' | 'NOTHING_CHECKED' | 'UNKNOWN_ITEM' | 'MISSING_REASON';

  constructor(code: InspectionError['code'], message: string) {
    super(message);
    this.name = 'InspectionError';
    this.code = code;
  }
}

/**
 * Whether one recorded item makes sense on its own.
 *
 * A red with no note and no recommended action is the failure this catches. It
 * reaches the customer as an alarming colour with nothing behind it, and the
 * conversation that follows starts with the workshop unable to say what is
 * wrong.
 */
export function assertResultSound(input: {
  severity: ItemSeverity;
  note?: string | null;
  recommendedAction?: string | null;
  measurementValue?: number | null;
}): void {
  if (input.severity !== 'CRITICAL' && input.severity !== 'ADVISORY') return;

  // `!= null` rather than `!== null`, deliberately: an absent measurement
  // arrives as undefined, and comparing only against null let a red with
  // nothing at all behind it through.
  const hasReason =
    Boolean(input.note?.trim()) ||
    Boolean(input.recommendedAction?.trim()) ||
    input.measurementValue != null;

  if (!hasReason) {
    throw new InspectionError(
      'MISSING_REASON',
      'Marking something amber or red needs a measurement, a note or a recommendation. The customer sees the colour and has to be told why.',
    );
  }
}

/**
 * Whether the inspection can be handed to the customer.
 *
 * The only refusal is an inspection where nothing at all was checked, because
 * that is not an inspection. Gaps are permitted deliberately: the alternative
 * is a technician ticking boxes to escape the screen.
 */
export function assertCompletable(input: {
  status: 'DRAFT' | 'COMPLETED';
  progress: Progress;
}): void {
  if (input.status === 'COMPLETED') {
    throw new InspectionError(
      'ALREADY_COMPLETE',
      'This inspection has already been completed. Start a new one to record another look at the vehicle.',
    );
  }

  if (input.progress.checked === 0) {
    throw new InspectionError(
      'NOTHING_CHECKED',
      'Nothing has been checked yet, so there is nothing to send.',
    );
  }
}

/**
 * The sentence shown before an inspection goes to the customer.
 *
 * Says what was found and, separately, what was not looked at. Reporting the
 * second is the difference between a clean bill of health and an honest one,
 * and it is the sentence that protects the workshop when something fails a
 * fortnight later on a part nobody examined.
 */
export function describeCompletion(progress: Progress): string {
  const found =
    progress.critical > 0
      ? `${progress.critical} ${progress.critical === 1 ? 'item needs' : 'items need'} attention now`
      : progress.advisory > 0
        ? `${progress.advisory} ${progress.advisory === 1 ? 'item is' : 'items are'} worth watching`
        : 'nothing needs attention';

  const gaps =
    progress.remaining > 0
      ? ` ${progress.remaining} of ${progress.total} items were not checked, and the customer will be told so.`
      : '';

  return `You checked ${progress.checked} of ${progress.total} items and ${found}.${gaps}`;
}

/**
 * The next item worth going to.
 *
 * Ordered as the template is ordered rather than by anything clever, because a
 * technician works around a car in a physical order and a screen that jumps
 * about makes them walk back and forth.
 */
export function nextUnchecked(
  items: readonly TemplateItem[],
  results: readonly RecordedResult[],
): TemplateItem | null {
  const checked = new Set(
    results.filter((result) => result.severity !== 'NOT_CHECKED').map((r) => r.templateItemId),
  );

  return items.find((item) => !checked.has(item.id)) ?? null;
}

/** Items grouped as the technician walks them, section by section. */
export function bySection(
  items: readonly TemplateItem[],
): { name: string; items: TemplateItem[] }[] {
  const sections: { name: string; items: TemplateItem[] }[] = [];

  for (const item of items) {
    const existing = sections.find((section) => section.name === item.sectionName);

    if (existing) existing.items.push(item);
    else sections.push({ name: item.sectionName, items: [item] });
  }

  return sections;
}
