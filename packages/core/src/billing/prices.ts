import { type Currency, money, type Money } from '../shared/money';
import type { PlanId } from './plans';

/**
 * The price book: what each plan costs, per bay per month, in every currency
 * a workshop can be in. Phase 32.7.
 *
 * A workshop has one currency, chosen from its country at sign-up, and it
 * sees and pays the plan in that currency and no other: the pricing page,
 * the sign-up box, the terms, the reminder email, the billing page and the
 * provider's charge all read this table. The figures are prices, not
 * conversions: set by hand to round numbers a workshop in that country would
 * recognise, and changed here when they change, never by an exchange rate on
 * the day.
 *
 * "annual" is the per-month price when paid for the year; "monthly" is the
 * per-month price when paid monthly, which is what the trial rolls into.
 */

export type PlanTerm = 'monthly' | 'annual';

type PlanPrices = Record<PlanId, { annual: number; monthly: number }>;

/** Whole units of the currency, per bay per month. */
export const PRICE_BOOK: Readonly<Record<string, PlanPrices>> = {
  GBP: {
    CORE: { annual: 39, monthly: 47 },
    COMPLETE: { annual: 69, monthly: 83 },
    GROUP: { annual: 99, monthly: 119 },
  },
  EUR: {
    CORE: { annual: 45, monthly: 55 },
    COMPLETE: { annual: 79, monthly: 95 },
    GROUP: { annual: 115, monthly: 139 },
  },
  USD: {
    CORE: { annual: 49, monthly: 59 },
    COMPLETE: { annual: 89, monthly: 105 },
    GROUP: { annual: 125, monthly: 149 },
  },
  CAD: {
    CORE: { annual: 69, monthly: 79 },
    COMPLETE: { annual: 119, monthly: 145 },
    GROUP: { annual: 169, monthly: 199 },
  },
  AUD: {
    CORE: { annual: 75, monthly: 89 },
    COMPLETE: { annual: 129, monthly: 159 },
    GROUP: { annual: 189, monthly: 225 },
  },
  NZD: {
    CORE: { annual: 79, monthly: 95 },
    COMPLETE: { annual: 139, monthly: 169 },
    GROUP: { annual: 199, monthly: 239 },
  },
  AED: {
    CORE: { annual: 179, monthly: 219 },
    COMPLETE: { annual: 319, monthly: 379 },
    GROUP: { annual: 459, monthly: 549 },
  },
  SAR: {
    CORE: { annual: 185, monthly: 225 },
    COMPLETE: { annual: 329, monthly: 389 },
    GROUP: { annual: 469, monthly: 559 },
  },
  ZAR: {
    CORE: { annual: 899, monthly: 1079 },
    COMPLETE: { annual: 1590, monthly: 1899 },
    GROUP: { annual: 2290, monthly: 2749 },
  },
  INR: {
    CORE: { annual: 3999, monthly: 4799 },
    COMPLETE: { annual: 6999, monthly: 8399 },
    GROUP: { annual: 9999, monthly: 11999 },
  },
  EGP: {
    CORE: { annual: 2390, monthly: 2890 },
    COMPLETE: { annual: 4190, monthly: 4990 },
    GROUP: { annual: 5990, monthly: 7190 },
  },
};

/** The currency the book falls back to for one it has never heard of. */
export const FALLBACK_CURRENCY = 'GBP';

export const PRICED_CURRENCIES: readonly string[] = Object.keys(PRICE_BOOK);

/** Whether the book has a row for the currency; a workshop in another is priced in the fallback. */
export function isPriced(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRICE_BOOK, currency);
}

/** The currency a workshop is priced in: its own when the book has it, else the fallback. */
export function pricingCurrency(currency: string): string {
  return isPriced(currency) ? currency : FALLBACK_CURRENCY;
}

/** What a plan costs per bay per month, in a currency, for a term. */
export function planPrice(plan: PlanId, currency: string, term: PlanTerm): Money {
  const priced = pricingCurrency(currency);
  const row = PRICE_BOOK[priced]![plan];
  return money(row[term] * 100, priced as Currency);
}

/** The saving, as a whole percentage, of paying for the year rather than monthly. */
export function annualSavingPercent(plan: PlanId, currency: string): number {
  const row = PRICE_BOOK[pricingCurrency(currency)]![plan];
  return Math.round((1 - row.annual / row.monthly) * 100);
}
