import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  agreementSaving,
  applyFleetAgreement,
  assertAgreementSaveable,
  assertConsolidatable,
  type ConsolidatableJob,
  consolidationWindow,
  describeConsolidation,
} from './fleet';
import { calculateTotals } from './totals';

const agreement = {
  labourDiscountPct: 10,
  partsDiscountPct: 5,
  paymentTermsDays: 30,
  consolidateMonthly: true,
  purchaseOrderRequired: false,
};

describe('assertAgreementSaveable', () => {
  it('accepts sensible terms for a company', () => {
    expect(() => assertAgreementSaveable({ customerKind: 'COMPANY', agreement })).not.toThrow();
  });

  it('is only for companies', () => {
    // A person with two cars is a customer, not a fleet.
    expect(() => assertAgreementSaveable({ customerKind: 'INDIVIDUAL', agreement })).toThrow(
      /company customer/,
    );
  });

  it('keeps discounts as percentages', () => {
    expect(() =>
      assertAgreementSaveable({
        customerKind: 'COMPANY',
        agreement: { ...agreement, partsDiscountPct: 101 },
      }),
    ).toThrow(/between 0 and 100/);
  });

  it('keeps terms as whole days within reason', () => {
    expect(() =>
      assertAgreementSaveable({
        customerKind: 'COMPANY',
        agreement: { ...agreement, paymentTermsDays: 200 },
      }),
    ).toThrow(/up to 120/);
  });
});

describe('applyFleetAgreement', () => {
  const lines = [
    { kind: 'LABOUR' as const, quantity: 2, unitPrice: 60, taxRatePct: 20 },
    { kind: 'PART' as const, quantity: 1, unitPrice: 100, discountPct: 10, taxRatePct: 20 },
    { kind: 'FEE' as const, quantity: 1, unitPrice: 5, taxRatePct: 20 },
  ];

  it('discounts labour and parts at their agreed rates and leaves fees alone', () => {
    const agreed = applyFleetAgreement(lines, agreement);
    expect(agreed[0]?.discountPct).toBe(10);
    expect(agreed[2]?.discountPct).toBeUndefined();
  });

  it('compounds with a discount already on the line', () => {
    // 10% off then 5% off is 14.5% off, not 15%.
    const agreed = applyFleetAgreement(lines, agreement);
    expect(agreed[1]?.discountPct).toBe(14.5);
  });

  it('changes the total by exactly the saving', () => {
    const list = calculateTotals(lines);
    const agreed = calculateTotals(applyFleetAgreement(lines, agreement));
    // Labour 120 at 10% off is 12; the part at 90 net gets a further 5%, 4.50.
    expect(list.subtotal.minor - agreed.subtotal.minor).toBe(1650);
  });

  it('does nothing with a zero agreement', () => {
    expect(applyFleetAgreement(lines, { labourDiscountPct: 0, partsDiscountPct: 0 })).toEqual(
      lines,
    );
  });
});

describe('consolidationWindow', () => {
  it('covers the whole calendar month', () => {
    const { from, to, label } = consolidationWindow(2026, 9);
    expect(from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-09-30T23:59:59.999Z');
    expect(label).toBe('September 2026');
  });

  it('copes with February and December', () => {
    expect(consolidationWindow(2028, 2).to.getUTCDate()).toBe(29);
    expect(consolidationWindow(2026, 12).to.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });
});

describe('assertConsolidatable', () => {
  const window = consolidationWindow(2026, 9);

  const job = (over: Partial<ConsolidatableJob> & { id: string }): ConsolidatableJob => ({
    number: 1,
    status: 'COMPLETED',
    completedAt: new Date('2026-09-15T10:00:00Z'),
    purchaseOrderNumber: null,
    alreadyInvoiced: false,
    chargeableLines: 2,
    ...over,
  });

  it('includes completed, priced, uninvoiced jobs from the month', () => {
    const { include, skipped } = assertConsolidatable({
      jobs: [job({ id: 'a' }), job({ id: 'b', number: 2 })],
      window,
      agreement,
    });
    expect(include.map((j) => j.id)).toEqual(['a', 'b']);
    expect(skipped).toEqual([]);
  });

  it('leaves out what does not belong, and says why', () => {
    const { include, skipped } = assertConsolidatable({
      jobs: [
        job({ id: 'ok' }),
        job({ id: 'ramp', status: 'IN_PROGRESS', completedAt: null }),
        job({ id: 'august', completedAt: new Date('2026-08-30T10:00:00Z') }),
        job({ id: 'billed', alreadyInvoiced: true }),
        job({ id: 'empty', chargeableLines: 0 }),
      ],
      window,
      agreement,
    });

    expect(include.map((j) => j.id)).toEqual(['ok']);
    expect(skipped.map((s) => s.reason)).toEqual([
      'not completed',
      'completed outside the month',
      'already invoiced on its own',
      'nothing priced on it',
    ]);
  });

  it('refuses the month when nothing is left, with the reasons counted', () => {
    expect(() =>
      assertConsolidatable({
        jobs: [job({ id: 'a', alreadyInvoiced: true }), job({ id: 'b', alreadyInvoiced: true })],
        window,
        agreement,
      }),
    ).toThrow(/2 already invoiced on its own/);
  });

  it('insists on a purchase order number when the fleet requires one', () => {
    // Their accounts department will refuse the invoice for exactly this.
    expect(() =>
      assertConsolidatable({
        jobs: [job({ id: 'a', number: 1042 })],
        window,
        agreement: { purchaseOrderRequired: true },
      }),
    ).toThrow(/Job 1042 has no purchase order number/);
  });
});

describe('describeConsolidation and agreementSaving', () => {
  it('says what the month came to and what the agreement cost', () => {
    const line = describeConsolidation({
      fleetName: 'Pennine Plumbing',
      label: 'September 2026',
      jobs: 4,
      total: money(120000, 'GBP'),
      saved: money(1650, 'GBP'),
    });
    expect(line).toBe(
      'Pennine Plumbing, September 2026: 4 jobs, £1,200.00, £16.50 off list under the agreement.',
    );
  });

  it('never reports a negative saving', () => {
    expect(agreementSaving([money(100)], [money(120)]).minor).toBe(0);
  });
});
