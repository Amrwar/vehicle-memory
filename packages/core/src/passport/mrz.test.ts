import { describe, expect, it } from 'vitest';

import { mrzCheckDigit, mrzClean, mrzLines, mrzVerify } from './mrz';

describe('mrzCheckDigit', () => {
  it('matches the ICAO 9303 worked example', () => {
    // From the specification: document number 520727 has check digit 3.
    expect(mrzCheckDigit('520727')).toBe('3');
    // Fillers count as zero, letters as 10 to 35.
    expect(mrzCheckDigit('AB2134<<<')).toBe('5');
  });
});

describe('mrzClean', () => {
  it('keeps only what the zone can carry', () => {
    expect(mrzClean('Citroën C3 Aircross')).toBe('CITROEN<C3<AIRCROSS');
    expect(mrzClean('AB12 CDE')).toBe('AB12<CDE');
    expect(mrzClean(null)).toBe('');
  });
});

describe('mrzLines', () => {
  const vehicle = {
    vin: 'WBAJA9C509G000000',
    registration: 'MK20 XRT',
    make: 'BMW',
    model: 'X5',
    year: 2020,
    firstRegisteredAt: new Date(2020, 2, 14),
    owners: 3,
    entries: 7,
  };

  it('is two lines of forty-four characters', () => {
    const [line1, line2] = mrzLines(vehicle);
    expect(line1).toHaveLength(44);
    expect(line2).toHaveLength(44);
    expect(line1).toMatch(/^P<CNTBMW<<X5<<2020<+$/);
    expect(line2.startsWith('WBAJA9C509G000000')).toBe(true);
  });

  it('checks, and a changed character fails the check', () => {
    const [, line2] = mrzLines(vehicle);
    expect(mrzVerify(line2)).toBe(true);
    const tampered = `${line2.slice(0, 5)}X${line2.slice(6)}`;
    expect(mrzVerify(tampered)).toBe(false);
  });

  it('copes with a vehicle that has almost nothing on record', () => {
    const [line1, line2] = mrzLines({
      vin: 'ZZPRBNET000000001',
      registration: null,
      make: null,
      model: null,
      year: null,
      firstRegisteredAt: null,
      owners: 0,
      entries: 0,
    });
    expect(line1).toBe('P<CNT'.padEnd(44, '<'));
    expect(mrzVerify(line2)).toBe(true);
    expect(line2).toContain('<<<<<<<<<');
  });
});
