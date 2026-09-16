import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  assertLabourRateSaveable,
  assertSitePriceSaveable,
  chooseLabourRate,
  chooseSitePrice,
  describePriceSource,
  differenceFromList,
  type LabourRateRow,
} from './site';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

const rates: LabourRateRow[] = [
  { id: 'org-standard', name: 'Standard', perHour: gbp(95), locationId: null, isDefault: true },
  { id: 'org-mot', name: 'MOT', perHour: gbp(60), locationId: null, isDefault: false },
  { id: 'city-standard', name: 'Standard', perHour: gbp(120), locationId: 'city', isDefault: true },
];

describe('the rate a line takes', () => {
  it('takes the site’s own rate where it has one', () => {
    const chosen = chooseLabourRate(rates, 'city');
    expect([chosen.perHour.minor, chosen.source]).toEqual([12000, 'SITE']);
  });

  it('falls back to the workshop’s, and says so', () => {
    const chosen = chooseLabourRate(rates, 'estate');
    expect([chosen.perHour.minor, chosen.source, chosen.name]).toEqual([
      9500,
      'WORKSHOP',
      'Standard',
    ]);
    expect(chooseLabourRate(rates, null).source).toBe('WORKSHOP');
    expect(describePriceSource('WORKSHOP', null)).toContain('this site has none of its own');
  });

  it('shows nothing rather than nought when no rate has ever been set', () => {
    const chosen = chooseLabourRate([], 'city');
    expect([chosen.id, chosen.perHour.minor, chosen.source]).toEqual([null, 0, 'NONE']);
    expect(describePriceSource('NONE', null)).toContain('has to be typed');
  });
});

describe('what a part sells for', () => {
  it('takes a site’s own price over the list', () => {
    const overrides = [{ locationId: 'city', sellPrice: gbp(72) }];
    expect(chooseSitePrice(gbp(60), overrides, 'city')).toEqual({
      price: gbp(72),
      source: 'SITE',
    });
    expect(chooseSitePrice(gbp(60), overrides, 'estate').source).toBe('LIST');
    expect(chooseSitePrice(gbp(60), overrides, null).price.minor).toBe(6000);
  });

  it('says how far a site is from the list', () => {
    expect(differenceFromList(gbp(60), gbp(72))).toBe(20);
    expect(differenceFromList(gbp(60), gbp(54))).toBe(-10);
    expect(differenceFromList(gbp(60), gbp(60))).toBeNull();
    expect(differenceFromList(gbp(0), gbp(60))).toBeNull();
  });
});

describe('what can be saved', () => {
  it('refuses a rate nobody could quote', () => {
    expect(() => assertLabourRateSaveable({ name: 'Standard', perHour: gbp(95) })).not.toThrow();
    expect(() => assertLabourRateSaveable({ name: ' ', perHour: gbp(95) })).toThrow(/name/);
    expect(() => assertLabourRateSaveable({ name: 'Free', perHour: gbp(0) })).toThrow(
      /more than nothing/,
    );
  });

  it('refuses a price that is not one', () => {
    expect(() => assertSitePriceSaveable({ sellPrice: gbp(0) })).not.toThrow();
    expect(() => assertSitePriceSaveable({ sellPrice: gbp(-1) })).toThrow(/less than nothing/);
    expect(() => assertSitePriceSaveable({ sellPrice: gbp(2_000_000) })).toThrow(/a million/);
  });
});
