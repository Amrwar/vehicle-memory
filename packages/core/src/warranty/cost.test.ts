import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  assertSettlement,
  claimPosition,
  describeWarrantyCost,
  noWarrantyCost,
  type SettledClaim,
  warrantyBy,
  warrantyCost,
} from './cost';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

const claim = (over: Partial<SettledClaim> & { id: string }): SettledClaim => ({
  productName: 'Brake pads, front',
  supplierName: 'Pennine Motor Factors',
  cost: gbp(120),
  recovered: gbp(80),
  net: gbp(40),
  goodwill: false,
  settledAt: new Date('2026-08-01'),
  ...over,
});

describe('one claim', () => {
  it('adds the parts and the hours and takes off what came back', () => {
    const position = claimPosition({
      partsCost: gbp(74.5),
      labourCost: gbp(45.5),
      recovered: gbp(74.5),
    });
    expect([position.cost.minor, position.net.minor]).toEqual([12000, 4550]);
  });

  it('refuses a settlement nobody could defend', () => {
    expect(() =>
      assertSettlement({ cost: gbp(120), recovered: gbp(80), outcome: 'Credited in full' }),
    ).not.toThrow();
    expect(() => assertSettlement({ cost: gbp(120), recovered: gbp(80), outcome: '  ' })).toThrow(
      /Say how it was settled/,
    );
    expect(() =>
      assertSettlement({ cost: gbp(120), recovered: gbp(130), outcome: 'Credited' }),
    ).toThrow(/More has been recovered/);
    expect(() =>
      assertSettlement({ cost: gbp(120), recovered: gbp(-1), outcome: 'Credited' }),
    ).toThrow(/less than nothing/);
  });
});

describe('warranty over a period', () => {
  const claims = [
    claim({ id: 'a' }),
    claim({ id: 'b', cost: gbp(200), recovered: gbp(0), net: gbp(200), goodwill: true }),
  ];

  it('says what was spent, what came back and what was carried', () => {
    const result = warrantyCost(claims, gbp(12_000));
    expect([result.claims, result.cost.minor, result.recovered.minor, result.net.minor]).toEqual([
      2, 32000, 8000, 24000,
    ]);
    expect(result.recoveryPct).toBe(25);
    expect(result.ofRevenuePct).toBe(2);
    expect(result.goodwill.minor).toBe(20000);
  });

  it('refuses a share of nothing', () => {
    const quiet = warrantyCost([], gbp(0));
    expect([quiet.recoveryPct, quiet.ofRevenuePct]).toEqual([null, null]);
    expect(noWarrantyCost('EGP').net.currency).toBe('EGP');
  });

  it('groups by the part that failed and by who stood behind it', () => {
    const byProduct = warrantyBy(
      [...claims, claim({ id: 'c', productName: null, net: gbp(500), supplierName: null })],
      'product',
    );
    expect(byProduct[0]).toMatchObject({ name: 'Not a stocked part', claims: 1 });
    expect(byProduct[1]).toMatchObject({ name: 'Brake pads, front', claims: 2 });
    expect(warrantyBy([claim({ id: 'c', supplierName: null })], 'supplier')[0]?.name).toBe(
      'Nobody behind it',
    );
  });

  it('reads as a sentence, including when there is nothing to say', () => {
    expect(describeWarrantyCost(warrantyCost(claims, gbp(12_000)))).toBe(
      '2 claims settled. The work cost £320.00, £80.00 came back from suppliers, and the workshop carried £240.00. That is 2% of what the workshop turned over.',
    );
    expect(describeWarrantyCost(noWarrantyCost())).toBe(
      'No warranty claim was settled in this period.',
    );
  });
});
