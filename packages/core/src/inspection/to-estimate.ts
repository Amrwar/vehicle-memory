import type { PriceableLine } from '../pricing/totals';

/**
 * Turning inspection findings into estimate lines.
 *
 * This is the highest-value flow in the product (persona P3). Today a
 * technician finds three faults, tells the advisor verbally, and the advisor
 * re-types an approximation into a quote. Detail is lost at every hop, and the
 * photograph that would have justified the price never reaches the customer.
 *
 * One action instead: findings become lines, carrying their notes, their
 * measurements and their photographs. FR-705, story F3.
 */

export type Severity = 'PASS' | 'ADVISORY' | 'CRITICAL' | 'NOT_CHECKED';

export type MeasurementType =
  | 'NONE'
  | 'TREAD_DEPTH_MM'
  | 'PAD_THICKNESS_MM'
  | 'DISC_THICKNESS_MM'
  | 'PERCENT'
  | 'VOLTAGE'
  | 'PRESSURE_BAR'
  | 'TEMPERATURE_C'
  | 'MM';

export interface Finding {
  id: string;
  sectionName: string;
  itemName: string;
  severity: Severity;
  note?: string | null;
  recommendedAction?: string | null;
  estimatedCost?: number | null;
  measurementValue?: number | null;
  measurementType?: MeasurementType;
  position?: string | null;
  photoCount?: number;
}

export interface InspectionSummary {
  pass: number;
  advisory: number;
  critical: number;
  notChecked: number;
  total: number;
  /** Worst severity present, for the traffic-light headline. */
  headline: Severity;
  /** True when nothing needs the customer's attention. */
  allClear: boolean;
}

export function summarise(findings: readonly Finding[]): InspectionSummary {
  const counts = { PASS: 0, ADVISORY: 0, CRITICAL: 0, NOT_CHECKED: 0 };

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  const headline: Severity =
    counts.CRITICAL > 0 ? 'CRITICAL' : counts.ADVISORY > 0 ? 'ADVISORY' : 'PASS';

  return {
    pass: counts.PASS,
    advisory: counts.ADVISORY,
    critical: counts.CRITICAL,
    notChecked: counts.NOT_CHECKED,
    total: findings.length,
    headline,
    allClear: counts.CRITICAL === 0 && counts.ADVISORY === 0,
  };
}

/** Findings that warrant a line on an estimate. */
export function actionable(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'ADVISORY');
}

export interface ToEstimateOptions {
  /** Findings already on an estimate, so regenerating does not duplicate. */
  existingFindingIds?: readonly string[];
  /** Default tax rate applied to generated lines. */
  taxRatePct?: number;
  /**
   * Advisory findings are added as optional lines by default. The customer
   * sees them, prices them, and chooses — which is a far better conversation
   * than either hiding them or presenting them as mandatory.
   */
  advisoriesOptional?: boolean;
}

export interface GeneratedLine extends PriceableLine {
  sourceFindingId: string;
  description: string;
  detail: string;
  severity: Severity;
}

export function findingsToEstimateLines(
  findings: readonly Finding[],
  options: ToEstimateOptions = {},
): GeneratedLine[] {
  const existing = new Set(options.existingFindingIds ?? []);
  const advisoriesOptional = options.advisoriesOptional ?? true;

  return (
    actionable(findings)
      .filter((finding) => !existing.has(finding.id))
      // Critical first: the customer should read the safety item before the
      // nice-to-have, and reading order is a design decision, not an accident.
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      .map((finding) => ({
        sourceFindingId: finding.id,
        kind: 'PART' as const,
        description:
          finding.recommendedAction?.trim() || `${finding.itemName} — attention required`,
        detail: describeFinding(finding),
        severity: finding.severity,
        quantity: 1,
        unitPrice: finding.estimatedCost ?? 0,
        taxRatePct: options.taxRatePct ?? 0,
        isOptional: advisoriesOptional && finding.severity === 'ADVISORY',
      }))
  );
}

/**
 * The customer-facing explanation of a finding. Maria (persona P4) does not
 * know what 2mm of tread means, so the measurement is stated alongside the
 * consequence rather than on its own.
 */
export function describeFinding(finding: Finding): string {
  const parts: string[] = [];

  parts.push(`${finding.sectionName} — ${finding.itemName}`);

  if (finding.position) {
    parts.push(formatPosition(finding.position));
  }

  if (finding.measurementValue !== null && finding.measurementValue !== undefined) {
    parts.push(formatMeasurement(finding.measurementValue, finding.measurementType ?? 'NONE'));
  }

  if (finding.note?.trim()) {
    parts.push(finding.note.trim());
  }

  return parts.join('. ');
}

export function formatMeasurement(value: number, type: MeasurementType): string {
  switch (type) {
    case 'TREAD_DEPTH_MM':
      return `${value} mm tread remaining`;
    case 'PAD_THICKNESS_MM':
      return `${value} mm pad remaining`;
    case 'DISC_THICKNESS_MM':
      return `${value} mm disc thickness`;
    case 'PERCENT':
      return `${value}% remaining`;
    case 'VOLTAGE':
      return `${value} V`;
    case 'PRESSURE_BAR':
      return `${value} bar`;
    case 'TEMPERATURE_C':
      return `${value} C`;
    case 'MM':
      return `${value} mm`;
    case 'NONE':
      return String(value);
  }
}

export function formatPosition(position: string): string {
  const labels: Record<string, string> = {
    FRONT_LEFT: 'Front left',
    FRONT_RIGHT: 'Front right',
    REAR_LEFT: 'Rear left',
    REAR_RIGHT: 'Rear right',
    SPARE: 'Spare',
  };
  return labels[position] ?? position;
}

function severityRank(severity: Severity): number {
  switch (severity) {
    case 'CRITICAL':
      return 3;
    case 'ADVISORY':
      return 2;
    case 'PASS':
      return 1;
    case 'NOT_CHECKED':
      return 0;
  }
}

/**
 * Legal minimum tread depth in most of Europe is 1.6 mm. Advising at 3 mm is
 * the widely accepted safety recommendation, not a sales tactic — wet braking
 * distance degrades sharply below it. The thresholds are named constants so
 * the reasoning is inspectable rather than buried in a comparison.
 */
export const TREAD_CRITICAL_MM = 1.6;
export const TREAD_ADVISORY_MM = 3.0;
export const PAD_CRITICAL_MM = 3.0;
export const PAD_ADVISORY_MM = 5.0;

export function severityForMeasurement(value: number, type: MeasurementType): Severity | null {
  switch (type) {
    case 'TREAD_DEPTH_MM':
      if (value <= TREAD_CRITICAL_MM) return 'CRITICAL';
      if (value <= TREAD_ADVISORY_MM) return 'ADVISORY';
      return 'PASS';
    case 'PAD_THICKNESS_MM':
      if (value <= PAD_CRITICAL_MM) return 'CRITICAL';
      if (value <= PAD_ADVISORY_MM) return 'ADVISORY';
      return 'PASS';
    default:
      return null;
  }
}
