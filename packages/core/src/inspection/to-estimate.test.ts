import { describe, expect, it } from 'vitest';

import { calculateTotals } from '../pricing/totals';
import {
  actionable,
  describeFinding,
  type Finding,
  findingsToEstimateLines,
  formatMeasurement,
  severityForMeasurement,
  summarise,
  TREAD_ADVISORY_MM,
  TREAD_CRITICAL_MM,
} from './to-estimate';

const FINDINGS: Finding[] = [
  { id: 'f1', sectionName: 'Brakes', itemName: 'Front pads', severity: 'CRITICAL',
    note: 'Metal on metal', recommendedAction: 'Replace front brake pads and discs',
    estimatedCost: 850, measurementValue: 1.5, measurementType: 'PAD_THICKNESS_MM',
    photoCount: 2 },
  { id: 'f2', sectionName: 'Electrical', itemName: 'Battery', severity: 'ADVISORY',
    note: 'Holding charge but weak under load', recommendedAction: 'Replace battery',
    estimatedCost: 240, measurementValue: 11.9, measurementType: 'VOLTAGE' },
  { id: 'f3', sectionName: 'Tires', itemName: 'Front left tyre', severity: 'PASS',
    measurementValue: 6.2, measurementType: 'TREAD_DEPTH_MM', position: 'FRONT_LEFT' },
  { id: 'f4', sectionName: 'Engine', itemName: 'Cabin filter', severity: 'NOT_CHECKED' },
];

describe('summary', () => {
  it('counts by severity', () => {
    const summary = summarise(FINDINGS);
    expect(summary).toMatchObject({
      pass: 1, advisory: 1, critical: 1, notChecked: 1, total: 4,
    });
  });

  it('headlines the worst severity present', () => {
    expect(summarise(FINDINGS).headline).toBe('CRITICAL');
    expect(summarise(FINDINGS.filter((f) => f.severity !== 'CRITICAL')).headline).toBe('ADVISORY');
    expect(summarise([FINDINGS[2]!]).headline).toBe('PASS');
  });

  it('reports all clear only when nothing needs attention', () => {
    expect(summarise(FINDINGS).allClear).toBe(false);
    expect(summarise([FINDINGS[2]!, FINDINGS[3]!]).allClear).toBe(true);
  });

  it('handles an empty inspection', () => {
    expect(summarise([])).toMatchObject({ total: 0, headline: 'PASS', allClear: true });
  });
});

describe('actionable findings', () => {
  it('selects only advisory and critical items', () => {
    expect(actionable(FINDINGS).map((f) => f.id)).toEqual(['f1', 'f2']);
  });
});

describe('generating estimate lines', () => {
  it('creates one line per actionable finding', () => {
    const lines = findingsToEstimateLines(FINDINGS, { taxRatePct: 20 });
    expect(lines).toHaveLength(2);
  });

  it('puts critical items first, so the safety item is read first', () => {
    const lines = findingsToEstimateLines(FINDINGS);
    expect(lines[0]!.severity).toBe('CRITICAL');
    expect(lines[1]!.severity).toBe('ADVISORY');
  });

  it('carries the recommended action across as the description', () => {
    const lines = findingsToEstimateLines(FINDINGS);
    expect(lines[0]!.description).toBe('Replace front brake pads and discs');
  });

  it('carries the note and measurement into the customer-facing detail', () => {
    const lines = findingsToEstimateLines(FINDINGS);
    expect(lines[0]!.detail).toContain('Brakes');
    expect(lines[0]!.detail).toContain('1.5 mm pad remaining');
    expect(lines[0]!.detail).toContain('Metal on metal');
  });

  it('carries the estimated cost across as the price', () => {
    const lines = findingsToEstimateLines(FINDINGS);
    expect(lines[0]!.unitPrice).toBe(850);
  });

  it('makes advisories optional so the customer chooses rather than being told', () => {
    const lines = findingsToEstimateLines(FINDINGS);
    expect(lines[0]!.isOptional).toBeFalsy();
    expect(lines[1]!.isOptional).toBe(true);
  });

  it('can present advisories as mandatory when the workshop prefers', () => {
    const lines = findingsToEstimateLines(FINDINGS, { advisoriesOptional: false });
    expect(lines[1]!.isOptional).toBe(false);
  });

  // FR-705: regenerating must not duplicate lines already on the estimate.
  it('skips findings already carried onto the estimate', () => {
    const lines = findingsToEstimateLines(FINDINGS, { existingFindingIds: ['f1'] });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.sourceFindingId).toBe('f2');
  });

  it('falls back to a sensible description when no action was recommended', () => {
    const sparse: Finding[] = [
      { id: 'x', sectionName: 'Engine', itemName: 'Coolant', severity: 'CRITICAL' },
    ];
    expect(findingsToEstimateLines(sparse)[0]!.description).toContain('Coolant');
  });

  it('prices a generated estimate correctly end to end', () => {
    // The whole point of the flow: findings in, a priced estimate out.
    const lines = findingsToEstimateLines(FINDINGS, { taxRatePct: 20 });
    const totals = calculateTotals(lines);

    // Only the critical line is chargeable; the advisory is optional.
    expect(totals.subtotal.minor).toBe(85_000);
    expect(totals.taxTotal.minor).toBe(17_000);
    expect(totals.total.minor).toBe(102_000);
  });

  it('produces nothing when the vehicle is healthy', () => {
    expect(findingsToEstimateLines([FINDINGS[2]!])).toHaveLength(0);
  });
});

describe('customer-facing description', () => {
  it('names the section, the item, the position and the measurement', () => {
    const text = describeFinding(FINDINGS[2]!);
    expect(text).toContain('Tires');
    expect(text).toContain('Front left');
    expect(text).toContain('6.2 mm tread remaining');
  });

  it('formats each measurement type in words a non-expert can read', () => {
    expect(formatMeasurement(3, 'TREAD_DEPTH_MM')).toBe('3 mm tread remaining');
    expect(formatMeasurement(12.4, 'VOLTAGE')).toBe('12.4 V');
    expect(formatMeasurement(80, 'PERCENT')).toBe('80% remaining');
  });
});

describe('severity from measurement', () => {
  it('uses the legal minimum and the safety recommendation for tread', () => {
    expect(severityForMeasurement(1.5, 'TREAD_DEPTH_MM')).toBe('CRITICAL');
    expect(severityForMeasurement(TREAD_CRITICAL_MM, 'TREAD_DEPTH_MM')).toBe('CRITICAL');
    expect(severityForMeasurement(2.5, 'TREAD_DEPTH_MM')).toBe('ADVISORY');
    expect(severityForMeasurement(TREAD_ADVISORY_MM, 'TREAD_DEPTH_MM')).toBe('ADVISORY');
    expect(severityForMeasurement(6.0, 'TREAD_DEPTH_MM')).toBe('PASS');
  });

  it('grades brake pad thickness', () => {
    expect(severityForMeasurement(2, 'PAD_THICKNESS_MM')).toBe('CRITICAL');
    expect(severityForMeasurement(4, 'PAD_THICKNESS_MM')).toBe('ADVISORY');
    expect(severityForMeasurement(8, 'PAD_THICKNESS_MM')).toBe('PASS');
  });

  it('declines to guess for measurements with no accepted threshold', () => {
    expect(severityForMeasurement(12.4, 'VOLTAGE')).toBeNull();
  });
});
