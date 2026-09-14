/**
 * Countries, and what follows from one. Phase 29.
 *
 * A workshop keeps one set of books in one currency, so country, currency,
 * locale and timezone live on the organisation and are chosen once, at
 * sign-up, from this table. The table is deliberately short: it is the
 * places the product is sold, not the world. Adding a country is adding a
 * row here, and nothing else in the product has to know.
 *
 * Tax is only defaulted here. The rate a country starts with is a sensible
 * first tax rate, not a tax engine; that is its own phase.
 */

export interface Country {
  code: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  /** The sensible first tax rate for a new workshop, and what it is called. */
  tax: { name: string; rate: number };
  /** Whether the road signs are in miles. Odometers are still kept in km. */
  miles: boolean;
}

export const COUNTRIES: readonly Country[] = [
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    locale: 'en-GB',
    timezone: 'Europe/London',
    tax: { name: 'VAT 20%', rate: 20 },
    miles: true,
  },
  {
    code: 'IE',
    name: 'Ireland',
    currency: 'EUR',
    locale: 'en-IE',
    timezone: 'Europe/Dublin',
    tax: { name: 'VAT 23%', rate: 23 },
    miles: false,
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    locale: 'en-CA',
    timezone: 'America/Toronto',
    tax: { name: 'GST 5%', rate: 5 },
    miles: false,
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York',
    tax: { name: 'Sales tax 7%', rate: 7 },
    miles: true,
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
    tax: { name: 'GST 10%', rate: 10 },
    miles: false,
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
    locale: 'en-NZ',
    timezone: 'Pacific/Auckland',
    tax: { name: 'GST 15%', rate: 15 },
    miles: false,
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
    tax: { name: 'TVA 20%', rate: 20 },
    miles: false,
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    locale: 'de-DE',
    timezone: 'Europe/Berlin',
    tax: { name: 'MwSt 19%', rate: 19 },
    miles: false,
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    locale: 'nl-NL',
    timezone: 'Europe/Amsterdam',
    tax: { name: 'BTW 21%', rate: 21 },
    miles: false,
  },
  {
    code: 'BE',
    name: 'Belgium',
    currency: 'EUR',
    locale: 'nl-BE',
    timezone: 'Europe/Brussels',
    tax: { name: 'BTW 21%', rate: 21 },
    miles: false,
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
    locale: 'es-ES',
    timezone: 'Europe/Madrid',
    tax: { name: 'IVA 21%', rate: 21 },
    miles: false,
  },
  {
    code: 'PT',
    name: 'Portugal',
    currency: 'EUR',
    locale: 'pt-PT',
    timezone: 'Europe/Lisbon',
    tax: { name: 'IVA 23%', rate: 23 },
    miles: false,
  },
  {
    code: 'IT',
    name: 'Italy',
    currency: 'EUR',
    locale: 'it-IT',
    timezone: 'Europe/Rome',
    tax: { name: 'IVA 22%', rate: 22 },
    miles: false,
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    locale: 'en-AE',
    timezone: 'Asia/Dubai',
    tax: { name: 'VAT 5%', rate: 5 },
    miles: false,
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    locale: 'ar-SA',
    timezone: 'Asia/Riyadh',
    tax: { name: 'VAT 15%', rate: 15 },
    miles: false,
  },
  {
    code: 'EG',
    name: 'Egypt',
    currency: 'EGP',
    locale: 'ar-EG',
    timezone: 'Africa/Cairo',
    tax: { name: 'VAT 14%', rate: 14 },
    miles: false,
  },
  {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    locale: 'en-ZA',
    timezone: 'Africa/Johannesburg',
    tax: { name: 'VAT 15%', rate: 15 },
    miles: false,
  },
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    tax: { name: 'GST 18%', rate: 18 },
    miles: false,
  },
];

export const DEFAULT_COUNTRY = 'GB';

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function countryFor(code: string | null | undefined): Country {
  return BY_CODE.get((code ?? '').trim().toUpperCase()) ?? BY_CODE.get(DEFAULT_COUNTRY)!;
}

export function isCountry(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase());
}

/** The currencies the product will keep books in: those of its countries. */
export const CURRENCIES: readonly string[] = [...new Set(COUNTRIES.map((c) => c.currency))];

export function isCurrency(code: string): boolean {
  return CURRENCIES.includes(code.trim().toUpperCase());
}

/**
 * A region: the four facts the product formats by. Country and currency are
 * a decision; locale and timezone follow the country unless overridden.
 */
export interface Region {
  country: string;
  currency: string;
  locale: string;
  timezone: string;
}

export const DEFAULT_REGION: Region = {
  country: 'GB',
  currency: 'GBP',
  locale: 'en-GB',
  timezone: 'Europe/London',
};

/** What a country implies, for a workshop that has not said otherwise. */
export function regionForCountry(code: string): Region {
  const country = countryFor(code);
  return {
    country: country.code,
    currency: country.currency,
    locale: country.locale,
    timezone: country.timezone,
  };
}

/** A locale the runtime will accept, or the region's default when it will not. */
export function safeLocale(locale: string | null | undefined, fallback = 'en-GB'): string {
  if (!locale) return fallback;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 ? locale : fallback;
  } catch {
    return fallback;
  }
}

/** Money as a person in this region reads it. */
export function formatMinor(minor: number, region: Pick<Region, 'currency' | 'locale'>): string {
  return new Intl.NumberFormat(safeLocale(region.locale), {
    style: 'currency',
    currency: region.currency,
  }).format(minor / 100);
}

/** A date as a person in this region reads it, in the region's own time. */
export function formatDate(
  at: Date,
  region: Pick<Region, 'locale' | 'timezone'>,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return at.toLocaleDateString(safeLocale(region.locale), {
    timeZone: region.timezone,
    ...options,
  });
}
