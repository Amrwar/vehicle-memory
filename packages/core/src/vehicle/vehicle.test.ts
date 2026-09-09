import { describe, expect, it } from 'vitest';

import { assessReading, averageKmPerDay, projectServiceDue, type Reading } from './mileage';
import {
  computeCheckDigit,
  formatVin,
  modelYearFromVin,
  normaliseVin,
  validateVin,
  verifyCheckDigit,
  worldManufacturerId,
} from './vin';

// A VIN with a known-correct check digit, from the ISO 3779 worked example.
const VALID_VIN = '1M8GDM9AXKP042788';

describe('VIN normalisation', () => {
  it('uppercases and strips separators', () => {
    expect(normaliseVin(' 1m8gdm9a-xkp042788 ')).toBe(VALID_VIN);
  });
});

describe('VIN validation', () => {
  it('accepts a conforming VIN', () => {
    const result = validateVin(VALID_VIN);
    expect(result.wellFormed).toBe(true);
    expect(result.checkDigitValid).toBe(true);
    expect(result.problems).toHaveLength(0);
    expect(result.acceptable).toBe(true);
  });

  it('reports an empty VIN', () => {
    expect(validateVin('').problems).toEqual(['EMPTY']);
  });

  it('reports the wrong length', () => {
    expect(validateVin('ABC123').problems).toContain('WRONG_LENGTH');
  });

  it('rejects the letters I, O and Q', () => {
    expect(validateVin('1M8GDM9AXKP04278O').problems).toContain('FORBIDDEN_LETTER');
  });

  // FR-304: a check-digit failure warns, it does not block. Older and
  // imported vehicles routinely fail it, and those are exactly the vehicles
  // whose history is most valuable.
  it('accepts a structurally sound VIN whose check digit disagrees', () => {
    const wrongDigit = `${VALID_VIN.slice(0, 8)}0${VALID_VIN.slice(9)}`;
    const result = validateVin(wrongDigit);

    expect(result.wellFormed).toBe(true);
    expect(result.checkDigitValid).toBe(false);
    expect(result.problems).toContain('CHECK_DIGIT_MISMATCH');
    expect(result.acceptable).toBe(true);
  });
});

describe('VIN check digit', () => {
  it('computes the documented value', () => {
    expect(computeCheckDigit(VALID_VIN)).toBe('X');
    expect(verifyCheckDigit(VALID_VIN)).toBe(true);
  });

  it('returns null for a VIN of the wrong length', () => {
    expect(computeCheckDigit('SHORT')).toBeNull();
  });
});

describe('VIN decomposition', () => {
  it('extracts the world manufacturer identifier', () => {
    expect(worldManufacturerId(VALID_VIN)).toBe('1M8');
  });

  it('resolves the model year within the current 30-year cycle', () => {
    // 'K' is 2019 in the cycle that began in 1980 and repeats every 30 years.
    expect(modelYearFromVin(VALID_VIN, 2026)).toBe(2019);
  });

  it('formats a VIN in readable groups', () => {
    expect(formatVin(VALID_VIN)).toBe('1M8 GDM9AX KP042788');
  });
});

// ---------------------------------------------------------------------------

const day = (n: number): Date => new Date(Date.UTC(2026, 0, n));

describe('odometer anomaly detection', () => {
  it('accepts the first reading for a vehicle', () => {
    expect(assessReading({ km: 50_000, readAt: day(1) }, null).anomaly).toBe('NONE');
  });

  it('accepts a normal increase', () => {
    const result = assessReading({ km: 51_000, readAt: day(31) }, { km: 50_000, readAt: day(1) });
    expect(result.anomaly).toBe('NONE');
    expect(result.kmPerDay).toBeCloseTo(33.3, 0);
  });

  // The central design decision in this module. A decreasing odometer is
  // evidence of fraud, and rejecting the reading would destroy it.
  it('records and flags a decreasing reading rather than rejecting it', () => {
    const result = assessReading({ km: 71_000, readAt: day(31) }, { km: 82_430, readAt: day(1) });

    expect(result.anomaly).toBe('DECREASE');
    expect(result.message).toContain('11,430');
  });

  it('flags an implausible daily rate', () => {
    const result = assessReading({ km: 60_000, readAt: day(2) }, { km: 50_000, readAt: day(1) });
    expect(result.anomaly).toBe('IMPLAUSIBLE_RATE');
  });

  it('does not judge readings taken within hours of each other', () => {
    const morning = new Date(Date.UTC(2026, 0, 1, 8));
    const afternoon = new Date(Date.UTC(2026, 0, 1, 16));
    const result = assessReading(
      { km: 50_400, readAt: afternoon },
      { km: 50_000, readAt: morning },
    );
    expect(result.anomaly).toBe('NONE');
  });

  it('refuses a negative reading outright', () => {
    expect(() => assessReading({ km: -1, readAt: day(1) }, null)).toThrow(RangeError);
  });
});

describe('average daily distance', () => {
  const readings: Reading[] = [
    { km: 50_000, readAt: day(1) },
    { km: 51_000, readAt: day(31) },
    { km: 52_000, readAt: day(61) },
  ];

  it('averages across the whole history', () => {
    expect(averageKmPerDay(readings)).toBeCloseTo(33.3, 0);
  });

  it('returns null without enough samples, rather than inventing a figure', () => {
    expect(averageKmPerDay([readings[0]!])).toBeNull();
  });

  it('ignores a flagged decrease so it cannot poison the projection', () => {
    const withFraud: Reading[] = [...readings, { km: 20_000, readAt: day(91) }];
    expect(averageKmPerDay(withFraud)).toBeCloseTo(33.3, 0);
  });

  it('accepts readings supplied out of order', () => {
    const shuffled = [readings[2]!, readings[0]!, readings[1]!];
    expect(averageKmPerDay(shuffled)).toBeCloseTo(averageKmPerDay(readings)!, 5);
  });
});

describe('service due projection', () => {
  it('projects by date when only a time interval is set', () => {
    const result = projectServiceDue({
      lastPerformedAt: new Date(Date.UTC(2026, 0, 1)),
      lastPerformedKm: null,
      intervalMonths: 12,
      intervalKm: null,
      currentKm: null,
      kmPerDay: null,
      now: new Date(Date.UTC(2026, 5, 1)),
    });

    expect(result.dueAt?.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(result.isOverdue).toBe(false);
  });

  it('clamps a month interval that would overflow the end of the month', () => {
    const result = projectServiceDue({
      lastPerformedAt: new Date(Date.UTC(2026, 0, 31)),
      lastPerformedKm: null,
      intervalMonths: 1,
      intervalKm: null,
      currentKm: null,
      kmPerDay: null,
    });
    // 31 January plus one month is 28 February, not 3 March.
    expect(result.dueAt?.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('takes whichever of date or distance arrives first', () => {
    const result = projectServiceDue({
      lastPerformedAt: new Date(Date.UTC(2026, 0, 1)),
      lastPerformedKm: 80_000,
      intervalMonths: 12,
      intervalKm: 10_000,
      currentKm: 82_430,
      kmPerDay: 100, // 7,570 km remaining at 100/day is about 76 days
      now: new Date(Date.UTC(2026, 0, 1)),
    });

    expect(result.dueKm).toBe(90_000);
    expect(result.kmRemaining).toBe(7_570);
    // The mileage projection lands well before the twelve-month date.
    expect(result.projectedDueAt!.getTime()).toBeLessThan(result.dueAt!.getTime());
  });

  it('reports overdue when the distance has already passed', () => {
    const result = projectServiceDue({
      lastPerformedAt: new Date(Date.UTC(2026, 0, 1)),
      lastPerformedKm: 80_000,
      intervalMonths: 24,
      intervalKm: 10_000,
      currentKm: 95_000,
      kmPerDay: 50,
      now: new Date(Date.UTC(2026, 6, 1)),
    });

    expect(result.isOverdue).toBe(true);
    expect(result.kmRemaining).toBeLessThan(0);
  });

  it('returns nulls rather than guessing when nothing is known', () => {
    const result = projectServiceDue({
      lastPerformedAt: null,
      lastPerformedKm: null,
      intervalMonths: null,
      intervalKm: null,
      currentKm: null,
      kmPerDay: null,
    });

    expect(result.dueAt).toBeNull();
    expect(result.projectedDueAt).toBeNull();
    expect(result.isOverdue).toBe(false);
  });
});
