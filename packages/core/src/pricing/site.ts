import { type Money, money } from '../shared/money';

/**
 * What a thing costs, at this site. Phase 44.
 *
 * A group with a branch in a city centre and one on an industrial estate
 * cannot charge the same hourly rate at both, and nothing in the product let
 * them say so: a labour rate was a number somebody typed on a quote, and a
 * part had one selling price wherever it was sold. Both are now a list with
 * the workshop's own figure at the top and a site's own figure underneath,
 * and the same rule decides which applies: the site's where it has one, the
 * workshop's where it does not.
 *
 * The rule matters more than the numbers. A price that silently falls back to
 * something else is how a branch quotes at the wrong rate for six months, so
 * everything here says which figure it used and where it came from.
 */

export class PricingError extends Error {
  constructor(
    readonly code: 'NO_NAME' | 'BAD_RATE' | 'BAD_PRICE' | 'NOT_A_SITE',
    message: string,
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

export type PriceSource = 'SITE' | 'WORKSHOP' | 'LIST' | 'NONE';

export interface ChosenRate {
  id: string | null;
  name: string | null;
  /** Major units per hour, as the workshop types it. */
  perHour: Money;
  source: PriceSource;
}

export interface LabourRateRow {
  id: string;
  name: string;
  perHour: Money;
  locationId: string | null;
  isDefault: boolean;
}

/**
 * The hourly rate a new line takes at this site.
 *
 * A rate named for this site wins; otherwise the workshop's default; and
 * where a workshop has never set one, nothing, which the form shows as an
 * empty box rather than as a zero somebody might not notice.
 */
export function chooseLabourRate(
  rates: readonly LabourRateRow[],
  locationId: string | null,
  currency = 'GBP',
): ChosenRate {
  const site = locationId
    ? (rates.find((rate) => rate.locationId === locationId && rate.isDefault) ??
      rates.find((rate) => rate.locationId === locationId))
    : undefined;

  const workshop =
    rates.find((rate) => rate.locationId === null && rate.isDefault) ??
    rates.find((rate) => rate.locationId === null);

  const chosen = site ?? workshop;

  if (!chosen) {
    return { id: null, name: null, perHour: money(0, currency), source: 'NONE' };
  }

  return {
    id: chosen.id,
    name: chosen.name,
    perHour: chosen.perHour,
    source: site ? 'SITE' : 'WORKSHOP',
  };
}

export interface SitePriceRow {
  locationId: string;
  sellPrice: Money;
}

/**
 * What a part sells for at this site.
 *
 * The product's own price is the list; a site may hold its own. Nothing here
 * discounts or marks up by a percentage, because a percentage applied to a
 * list that later changes is a price nobody chose.
 */
export function chooseSitePrice(
  listPrice: Money,
  overrides: readonly SitePriceRow[],
  locationId: string | null,
): { price: Money; source: PriceSource } {
  const override = locationId ? overrides.find((row) => row.locationId === locationId) : undefined;

  return override
    ? { price: override.sellPrice, source: 'SITE' }
    : { price: listPrice, source: 'LIST' };
}

/** How much dearer, or cheaper, a site is than the list. Null at the list. */
export function differenceFromList(listPrice: Money, price: Money): number | null {
  if (listPrice.minor === 0 || price.minor === listPrice.minor) return null;
  return Math.round(((price.minor - listPrice.minor) / listPrice.minor) * 1000) / 10;
}

/** A labour rate somebody can be charged at, or a refusal that says why. */
export function assertLabourRateSaveable(input: { name: string; perHour: Money }): void {
  if (!input.name.trim()) {
    throw new PricingError(
      'NO_NAME',
      'Give the rate a name. "Standard", "MOT" and "Diagnostic" are what a quote will say.',
    );
  }

  if (input.perHour.minor <= 0 || input.perHour.minor > 100_000_00) {
    throw new PricingError(
      'BAD_RATE',
      'An hourly rate is more than nothing and less than a hundred thousand. Charging nothing for an hour is a discount, not a rate.',
    );
  }
}

/** A price a site may hold for a part. */
export function assertSitePriceSaveable(input: { sellPrice: Money }): void {
  if (input.sellPrice.minor < 0 || input.sellPrice.minor > 1_000_000_00) {
    throw new PricingError(
      'BAD_PRICE',
      'A price is neither less than nothing nor more than a million. Leave it empty to use the workshop’s.',
    );
  }
}

/** One line about where a figure came from, for whoever is quoting. */
export function describePriceSource(source: PriceSource, siteName: string | null): string {
  switch (source) {
    case 'SITE':
      return siteName ? `This site’s own rate (${siteName}).` : 'This site’s own rate.';
    case 'WORKSHOP':
      return 'The workshop’s rate, because this site has none of its own.';
    case 'LIST':
      return 'The part’s own price, the same at every site.';
    default:
      return 'No rate has been set, so a figure has to be typed.';
  }
}
