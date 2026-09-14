import { describe, expect, it } from 'vitest';

import { COUNTRIES } from '../region/countries';
import { PLAN_ORDER, PLANS } from './plans';
import {
  annualSavingPercent,
  isPriced,
  planPrice,
  PRICE_BOOK,
  PRICED_CURRENCIES,
  pricingCurrency,
} from './prices';

describe('the price book', () => {
  it('prices every plan in every currency a country can put a workshop in', () => {
    for (const country of COUNTRIES) {
      expect(isPriced(country.currency), `${country.name} pays in ${country.currency}`).toBe(true);
      for (const plan of PLAN_ORDER) {
        const row = PRICE_BOOK[country.currency]![plan];
        expect(row.annual).toBeGreaterThan(0);
        expect(row.monthly).toBeGreaterThanOrEqual(row.annual);
        expect(Number.isInteger(row.annual) && Number.isInteger(row.monthly)).toBe(true);
      }
    }
  });

  it('keeps the plan table and the book on the same pounds', () => {
    for (const plan of PLAN_ORDER) {
      expect(planPrice(plan, 'GBP', 'annual').minor).toBe(PLANS[plan].price.minor);
      expect(planPrice(plan, 'GBP', 'monthly').minor).toBe(PLANS[plan].priceMonthly.minor);
    }
  });

  it('rises with the plan in every currency', () => {
    for (const currency of PRICED_CURRENCIES) {
      const [core, complete, group] = PLAN_ORDER.map(
        (p) => planPrice(p, currency, 'monthly').minor,
      );
      expect(core!).toBeLessThan(complete!);
      expect(complete!).toBeLessThan(group!);
    }
  });

  it('answers in the currency asked for, and in pounds for one it has never heard of', () => {
    expect(planPrice('CORE', 'CAD', 'monthly')).toEqual({ minor: 7900, currency: 'CAD' });
    expect(pricingCurrency('XXX')).toBe('GBP');
    expect(planPrice('CORE', 'XXX', 'monthly').currency).toBe('GBP');
  });

  it('states the annual saving as a whole percentage', () => {
    expect(annualSavingPercent('CORE', 'GBP')).toBe(17);
    expect(annualSavingPercent('CORE', 'CAD')).toBe(13);
  });
});
