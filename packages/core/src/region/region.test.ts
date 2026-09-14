import { describe, expect, it } from 'vitest';

import {
  COUNTRIES,
  countryFor,
  CURRENCIES,
  formatDate,
  formatMinor,
  isCountry,
  isCurrency,
  regionForCountry,
  safeLocale,
} from './countries';

describe('countries', () => {
  it('have unique codes and a currency, locale, timezone and tax each', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of COUNTRIES) {
      expect(country.currency).toMatch(/^[A-Z]{3}$/);
      expect(safeLocale(country.locale, 'x')).toBe(country.locale);
      expect(country.tax.rate).toBeGreaterThan(0);
      expect(() => new Intl.DateTimeFormat('en', { timeZone: country.timezone })).not.toThrow();
    }
  });

  it('fall back to Britain for a code that is not one of ours', () => {
    expect(countryFor('XX').code).toBe('GB');
    expect(countryFor(null).code).toBe('GB');
    expect(countryFor(' ca ').code).toBe('CA');
    expect(isCountry('ca')).toBe(true);
    expect(isCountry('ZZ')).toBe(false);
  });

  it('know their currencies', () => {
    expect(isCurrency('CAD')).toBe(true);
    expect(isCurrency('XAU')).toBe(false);
    expect(CURRENCIES).toContain('EUR');
  });
});

describe('regionForCountry', () => {
  it('gives a Canadian workshop dollars, Canadian English and Toronto', () => {
    expect(regionForCountry('CA')).toEqual({
      country: 'CA',
      currency: 'CAD',
      locale: 'en-CA',
      timezone: 'America/Toronto',
    });
  });
});

describe('formatting', () => {
  // The runtime pads with a non-breaking space; the test does not care which.
  const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

  it('formats money the way the region reads it', () => {
    expect(plain(formatMinor(140800, { currency: 'GBP', locale: 'en-GB' }))).toBe('£1,408.00');
    expect(plain(formatMinor(140800, { currency: 'CAD', locale: 'en-CA' }))).toBe('$1,408.00');
    expect(plain(formatMinor(140800, { currency: 'EUR', locale: 'de-DE' }))).toBe('1.408,00 €');
  });

  it('formats a date in the region’s own time', () => {
    const at = new Date('2026-09-14T23:30:00Z');
    expect(formatDate(at, { locale: 'en-GB', timezone: 'Europe/London' })).toBe('15/09/2026');
    expect(formatDate(at, { locale: 'en-CA', timezone: 'America/Toronto' })).toBe('2026-09-14');
  });

  it('survives a locale the runtime does not know', () => {
    expect(safeLocale('xx-YY')).toBe('en-GB');
    expect(safeLocale('')).toBe('en-GB');
  });
});
