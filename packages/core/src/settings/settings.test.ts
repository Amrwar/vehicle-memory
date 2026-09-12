import { describe, expect, it } from 'vitest';

import {
  assertBaySaveable,
  assertJobTypeSaveable,
  assertNotTheLast,
  assertOrganisationSaveable,
  assertPrefixSaveable,
  assertSiteSaveable,
  assertTaxRateSaveable,
  describeChanges,
  formatClock,
  normaliseCode,
  normalisePrefix,
  parseClock,
  SettingsError,
  tidy,
} from './settings';

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof SettingsError) return error.code;
    throw error;
  }
  return 'ALLOWED';
}

describe('tidy', () => {
  it('turns whitespace into nothing and keeps the rest', () => {
    expect(tidy('  ')).toBeNull();
    expect(tidy(undefined)).toBeNull();
    expect(tidy(' Hillside ')).toBe('Hillside');
  });
});

describe('assertOrganisationSaveable', () => {
  const good = {
    name: 'Hillside Motors',
    email: 'hello@hillside.test',
    reapprovalThresholdPct: 10,
  };

  it('allows an ordinary profile', () => {
    expect(codeOf(() => assertOrganisationSaveable(good))).toBe('ALLOWED');
  });

  it('insists on a trading name', () => {
    expect(codeOf(() => assertOrganisationSaveable({ ...good, name: ' ' }))).toBe('NO_NAME');
  });

  it('refuses a non-address, but allows a blank one', () => {
    expect(codeOf(() => assertOrganisationSaveable({ ...good, email: 'front desk' }))).toBe(
      'BAD_EMAIL',
    );
    expect(codeOf(() => assertOrganisationSaveable({ ...good, email: '' }))).toBe('ALLOWED');
  });

  it('keeps the threshold a percentage', () => {
    expect(codeOf(() => assertOrganisationSaveable({ ...good, reapprovalThresholdPct: 150 }))).toBe(
      'BAD_THRESHOLD',
    );
    expect(codeOf(() => assertOrganisationSaveable({ ...good, reapprovalThresholdPct: -1 }))).toBe(
      'BAD_THRESHOLD',
    );
    expect(
      codeOf(() => assertOrganisationSaveable({ ...good, reapprovalThresholdPct: Number.NaN })),
    ).toBe('BAD_THRESHOLD');
    expect(codeOf(() => assertOrganisationSaveable({ ...good, reapprovalThresholdPct: 0 }))).toBe(
      'ALLOWED',
    );
  });
});

describe('codes', () => {
  it('normalises to what the diary can show', () => {
    expect(normaliseCode(' bay 1 ')).toBe('BAY1');
    expect(normaliseCode('b-2')).toBe('B-2');
    expect(normaliseCode('ünïcode!')).toBe('NCODE');
  });

  it('refuses an empty or absurd code', () => {
    expect(codeOf(() => assertBaySaveable({ name: 'Lift', code: '' }))).toBe('BAD_CODE');
    expect(codeOf(() => assertBaySaveable({ name: 'Lift', code: 'A'.repeat(13) }))).toBe(
      'BAD_CODE',
    );
    expect(codeOf(() => assertBaySaveable({ name: '', code: 'B1' }))).toBe('NO_NAME');
    expect(codeOf(() => assertBaySaveable({ name: 'Lift', code: 'B1' }))).toBe('ALLOWED');
  });
});

describe('clock', () => {
  it('reads and writes times of day', () => {
    expect(parseClock('08:00')).toBe(480);
    expect(parseClock(' 18:30 ')).toBe(1110);
    expect(parseClock('24:00')).toBe(1440);
    expect(parseClock('8:5')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('noon')).toBeNull();
    expect(formatClock(480)).toBe('08:00');
    expect(formatClock(1110)).toBe('18:30');
  });
});

describe('assertSiteSaveable', () => {
  const good = {
    name: 'Hillside Road',
    code: 'HR',
    dailyCapacityHours: 40,
    opensAtMinute: 480,
    closesAtMinute: 1080,
  };

  it('allows an ordinary site', () => {
    expect(codeOf(() => assertSiteSaveable(good))).toBe('ALLOWED');
  });

  it('insists the site opens before it closes', () => {
    expect(
      codeOf(() => assertSiteSaveable({ ...good, opensAtMinute: 1080, closesAtMinute: 480 })),
    ).toBe('BAD_HOURS');
    expect(
      codeOf(() => assertSiteSaveable({ ...good, opensAtMinute: 600, closesAtMinute: 600 })),
    ).toBe('BAD_HOURS');
    expect(codeOf(() => assertSiteSaveable({ ...good, closesAtMinute: 1500 }))).toBe('BAD_HOURS');
  });

  it('keeps capacity sane', () => {
    expect(codeOf(() => assertSiteSaveable({ ...good, dailyCapacityHours: -5 }))).toBe(
      'BAD_CAPACITY',
    );
    expect(codeOf(() => assertSiteSaveable({ ...good, dailyCapacityHours: Number.NaN }))).toBe(
      'BAD_CAPACITY',
    );
  });
});

describe('assertTaxRateSaveable', () => {
  it('is a named percentage', () => {
    expect(codeOf(() => assertTaxRateSaveable({ name: 'VAT 20%', rate: 20 }))).toBe('ALLOWED');
    expect(codeOf(() => assertTaxRateSaveable({ name: 'Zero rated', rate: 0 }))).toBe('ALLOWED');
    expect(codeOf(() => assertTaxRateSaveable({ name: '', rate: 20 }))).toBe('NO_NAME');
    expect(codeOf(() => assertTaxRateSaveable({ name: 'Odd', rate: 120 }))).toBe('BAD_RATE');
  });
});

describe('assertJobTypeSaveable', () => {
  it('is a named colour with optional hours', () => {
    expect(
      codeOf(() => assertJobTypeSaveable({ name: 'MOT', colour: '#2a41d8', defaultHours: 1 })),
    ).toBe('ALLOWED');
    expect(
      codeOf(() => assertJobTypeSaveable({ name: 'MOT', colour: '#2a41d8', defaultHours: null })),
    ).toBe('ALLOWED');
    expect(
      codeOf(() => assertJobTypeSaveable({ name: '', colour: '#2a41d8', defaultHours: 1 })),
    ).toBe('NO_NAME');
    expect(
      codeOf(() => assertJobTypeSaveable({ name: 'MOT', colour: 'blue', defaultHours: 1 })),
    ).toBe('BAD_COLOUR');
    expect(
      codeOf(() => assertJobTypeSaveable({ name: 'MOT', colour: '#2a41d8', defaultHours: -2 })),
    ).toBe('BAD_HOURS');
  });
});

describe('prefixes', () => {
  it('are short, upper case, and safe to read out', () => {
    expect(normalisePrefix(' inv- ')).toBe('INV-');
    expect(codeOf(() => assertPrefixSaveable('INV-'))).toBe('ALLOWED');
    expect(codeOf(() => assertPrefixSaveable(''))).toBe('ALLOWED');
    expect(codeOf(() => assertPrefixSaveable('INVOICE-2026'))).toBe('BAD_PREFIX');
    expect(codeOf(() => assertPrefixSaveable('INV #'))).toBe('BAD_PREFIX');
  });
});

describe('assertNotTheLast', () => {
  it('will not let the last default go', () => {
    expect(codeOf(() => assertNotTheLast(0, 'tax rate'))).toBe('LAST_ONE');
    expect(codeOf(() => assertNotTheLast(1, 'tax rate'))).toBe('ALLOWED');
  });
});

describe('describeChanges', () => {
  it('names each field that moved and nothing else', () => {
    expect(
      describeChanges(
        { name: 'Hillside', phone: null, email: 'a@b.test' },
        { name: 'Hillside Motors', phone: '0113 000', email: 'a@b.test' },
      ),
    ).toEqual(['name: Hillside → Hillside Motors', 'phone: blank → 0113 000']);
  });
});
