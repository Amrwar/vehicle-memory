import { describe, expect, it } from 'vitest';

import { fromDecimal, money, sum, toDecimalString } from '../shared/money.js';
import {
  applyDocumentDiscount,
  calculateLine,
  calculateProfitability,
  calculateTotals,
  needsReapproval,
  type PriceableLine,
} from './totals.js';

// The brake job from the product documentation, so the numbers in the docs
// and the numbers the code produces are the same numbers.
const BRAKE_JOB: PriceableLine[] = [
  { kind: 'LABOUR', quantity: 1.0, unitPrice: '95.00', unitCost: '38.00', taxRatePct: 20 },
  { kind: 'LABOUR', quantity: 3.5, unitPrice: '95.00', unitCost: '38.00', taxRatePct: 20 },
  { kind: 'PART', quantity: 1, unitPrice: '420.00', unitCost: '252.00', taxRatePct: 20 },
  { kind: 'PART', quantity: 1, unitPrice: '410.00', unitCost: '246.00', taxRatePct: 20 },
];

describe('line calculation', () => {
  it('multiplies quantity by unit price', () => {
    const line = calculateLine({ kind: 'LABOUR', quantity: 3.5, unitPrice: '95.00' });
    expect(toDecimalString(line.gross)).toBe('332.50');
  });

  it('applies a line discount before tax', () => {
    const line = calculateLine({
      kind: 'PART',
      quantity: 1,
      unitPrice: '100.00',
      discountPct: 10,
      taxRatePct: 20,
    });

    expect(toDecimalString(line.discount)).toBe('10.00');
    expect(toDecimalString(line.net)).toBe('90.00');
    expect(toDecimalString(line.tax)).toBe('18.00');
    expect(toDecimalString(line.total)).toBe('108.00');
  });

  it('computes margin against cost', () => {
    const line = calculateLine({
      kind: 'PART',
      quantity: 1,
      unitPrice: '420.00',
      unitCost: '252.00',
    });

    expect(toDecimalString(line.margin)).toBe('168.00');
    expect(line.marginPct).toBe(40);
  });

  it('reports a null margin percentage rather than dividing by zero', () => {
    const line = calculateLine({ kind: 'FEE', quantity: 1, unitPrice: '0.00' });
    expect(line.marginPct).toBeNull();
  });

  it('clamps a nonsensical discount instead of producing negative revenue', () => {
    const line = calculateLine({ kind: 'PART', quantity: 1, unitPrice: '100.00', discountPct: 250 });
    expect(toDecimalString(line.net)).toBe('0.00');
  });
});

describe('document totals', () => {
  it('produces the expected total for the worked example', () => {
    const totals = calculateTotals(BRAKE_JOB);

    // 95.00 + 332.50 + 420.00 + 410.00
    expect(toDecimalString(totals.subtotal)).toBe('1257.50');
    expect(toDecimalString(totals.taxTotal)).toBe('251.50');
    expect(toDecimalString(totals.total)).toBe('1509.00');
  });

  it('makes the printed lines add up to the printed total', () => {
    // If a customer adds the invoice up by hand it must reconcile. This is
    // why each line is rounded before summing rather than after.
    const totals = calculateTotals(BRAKE_JOB);
    const chargeable = totals.lines;

    expect(sum(chargeable.map((l) => l.net)).minor).toBe(totals.subtotal.minor);
    expect(sum(chargeable.map((l) => l.tax)).minor).toBe(totals.taxTotal.minor);
    expect(sum(chargeable.map((l) => l.total)).minor).toBe(totals.total.minor);
  });

  it('breaks tax down by rate, as a tax document requires', () => {
    const mixed: PriceableLine[] = [
      { kind: 'LABOUR', quantity: 1, unitPrice: '100.00', taxRatePct: 20 },
      { kind: 'PART', quantity: 1, unitPrice: '50.00', taxRatePct: 5 },
      { kind: 'FEE', quantity: 1, unitPrice: '10.00', taxRatePct: 0 },
    ];

    const totals = calculateTotals(mixed);

    expect(totals.taxBreakdown).toHaveLength(3);
    const byRate = Object.fromEntries(
      totals.taxBreakdown.map((b) => [b.ratePct, toDecimalString(b.tax)]),
    );
    expect(byRate[20]).toBe('20.00');
    expect(byRate[5]).toBe('2.50');
    expect(byRate[0]).toBe('0.00');
  });

  it('proves that a blended rate on the subtotal would be wrong', () => {
    const mixed: PriceableLine[] = [
      { kind: 'LABOUR', quantity: 1, unitPrice: '100.00', taxRatePct: 20 },
      { kind: 'FEE', quantity: 1, unitPrice: '100.00', taxRatePct: 0 },
    ];

    const totals = calculateTotals(mixed);
    expect(toDecimalString(totals.taxTotal)).toBe('20.00');
    // Applying 20% to the 200.00 subtotal would give 40.00.
    expect(totals.taxTotal.minor).not.toBe(4000);
  });

  it('excludes optional lines from the total but keeps them on the document', () => {
    const withOptional: PriceableLine[] = [
      { kind: 'PART', quantity: 1, unitPrice: '100.00', taxRatePct: 20 },
      { kind: 'PART', quantity: 1, unitPrice: '240.00', taxRatePct: 20, isOptional: true },
    ];

    const totals = calculateTotals(withOptional);

    expect(toDecimalString(totals.subtotal)).toBe('100.00');
    // The advisory line is still there for the customer to consider.
    expect(totals.lines).toHaveLength(2);
  });

  it('excludes declined lines', () => {
    const withDeclined: PriceableLine[] = [
      { kind: 'PART', quantity: 1, unitPrice: '420.00', taxRatePct: 20 },
      { kind: 'PART', quantity: 1, unitPrice: '410.00', taxRatePct: 20, declined: true },
    ];

    expect(toDecimalString(calculateTotals(withDeclined).subtotal)).toBe('420.00');
  });

  it('handles an empty document', () => {
    const totals = calculateTotals([]);
    expect(totals.total.minor).toBe(0);
    expect(totals.marginPct).toBeNull();
  });

  it('computes gross margin across the document', () => {
    const totals = calculateTotals(BRAKE_JOB);
    // Cost: 38.00 + 133.00 + 252.00 + 246.00 = 669.00
    expect(toDecimalString(totals.costTotal)).toBe('669.00');
    expect(toDecimalString(totals.grossProfit)).toBe('588.50');
    expect(totals.marginPct).toBeCloseTo(46.8, 1);
  });
});

describe('document-level discount', () => {
  it('spreads a discount across lines while preserving the exact total', () => {
    const lines: PriceableLine[] = [
      { kind: 'PART', quantity: 1, unitPrice: '100.00' },
      { kind: 'PART', quantity: 1, unitPrice: '200.00' },
      { kind: 'LABOUR', quantity: 1, unitPrice: '300.00' },
    ];

    const discounted = applyDocumentDiscount(lines, fromDecimal('60.00'));
    const totals = calculateTotals(discounted);

    // 600.00 less 60.00
    expect(toDecimalString(totals.subtotal)).toBe('540.00');
  });

  it('leaves zero-value lines alone', () => {
    const lines: PriceableLine[] = [
      { kind: 'FEE', quantity: 1, unitPrice: '0.00' },
      { kind: 'PART', quantity: 1, unitPrice: '100.00' },
    ];

    const discounted = applyDocumentDiscount(lines, fromDecimal('10.00'));
    expect(discounted[0]!.discountPct ?? 0).toBe(0);
  });
});

describe('re-approval threshold', () => {
  it('allows work within the tolerance', () => {
    expect(needsReapproval(fromDecimal('1000.00'), fromDecimal('1080.00'), 10)).toBe(false);
  });

  it('requires re-approval beyond the tolerance', () => {
    expect(needsReapproval(fromDecimal('1000.00'), fromDecimal('1150.00'), 10)).toBe(true);
  });

  it('treats exactly the threshold as acceptable', () => {
    expect(needsReapproval(fromDecimal('1000.00'), fromDecimal('1100.00'), 10)).toBe(false);
  });

  it('requires approval for any charge when nothing was approved', () => {
    expect(needsReapproval(money(0), fromDecimal('50.00'), 10)).toBe(true);
    expect(needsReapproval(money(0), money(0), 10)).toBe(false);
  });
});

describe('job profitability', () => {
  it('costs labour from clocked time, not from charged hours', () => {
    // Charged 4.5 hours; the technician actually took 5.2 hours (312 min).
    // Profitability must use the time that was really spent.
    const result = calculateProfitability({
      revenue: fromDecimal('1257.50'),
      partsCost: fromDecimal('498.00'),
      labourMinutes: 312,
      labourCostPerHour: '38.00',
    });

    expect(toDecimalString(result.labourCost)).toBe('197.60');
    expect(toDecimalString(result.grossProfit)).toBe('561.90');
    expect(result.marginPct).toBeCloseTo(44.7, 1);
  });

  it('reports a loss honestly', () => {
    const result = calculateProfitability({
      revenue: fromDecimal('100.00'),
      partsCost: fromDecimal('150.00'),
      labourMinutes: 120,
      labourCostPerHour: '38.00',
    });

    expect(result.grossProfit.minor).toBeLessThan(0);
    expect(result.marginPct).toBeLessThan(0);
  });

  it('returns a null margin on a zero-revenue job', () => {
    const result = calculateProfitability({
      revenue: money(0),
      partsCost: money(0),
      labourMinutes: 0,
      labourCostPerHour: '38.00',
    });
    expect(result.marginPct).toBeNull();
  });
});
