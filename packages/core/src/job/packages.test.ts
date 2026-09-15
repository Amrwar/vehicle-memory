import { describe, expect, it } from 'vitest';

import {
  assertPackageSound,
  jobLinesFromPackage,
  nextServiceFrom,
  PackageError,
  packageHours,
  packageSummary,
  packageTotal,
  type PackageShape,
} from './packages';

const service: PackageShape = {
  code: 'FULL',
  name: 'Full service',
  durationMinutes: 150,
  price: 199,
  intervalMonths: 12,
  intervalKm: 20_000,
  lines: [
    { kind: 'LABOUR', description: 'Service labour', quantity: 2.5, unitPrice: 60 },
    { kind: 'PART', description: 'Oil filter', quantity: 1, unitPrice: 12.5, productId: 'p1' },
    { kind: 'PART', description: 'Engine oil 5W-30', quantity: 5, unitPrice: 9 },
    { kind: 'FEE', description: 'Waste oil disposal', quantity: 1, unitPrice: 4 },
  ],
  checks: [{ title: 'Reset service indicator' }, { title: 'Stamp the book' }],
};

function code(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof PackageError ? error.code : String(error);
  }
}

describe('a package', () => {
  it('adds up, and a fixed price is what it is sold at', () => {
    expect(packageTotal(service)).toEqual({
      linesTotal: 211.5,
      price: 199,
      saving: 12.5,
      fixed: true,
    });
    expect(packageTotal({ ...service, price: null })).toEqual({
      linesTotal: 211.5,
      price: 211.5,
      saving: 0,
      fixed: false,
    });
  });

  it('has to be sound before it is saved', () => {
    expect(code(() => assertPackageSound(service))).toBeNull();
    expect(code(() => assertPackageSound({ ...service, name: ' ' }))).toBe('NO_NAME');
    expect(code(() => assertPackageSound({ ...service, code: '' }))).toBe('NO_CODE');
    expect(code(() => assertPackageSound({ ...service, lines: [] }))).toBe('NO_LINES');
    expect(
      code(() =>
        assertPackageSound({
          ...service,
          lines: [{ kind: 'PART', description: 'Oil', quantity: 0, unitPrice: 9 }],
        }),
      ),
    ).toBe('BAD_LINE');
    expect(code(() => assertPackageSound({ ...service, price: -1 }))).toBe('BAD_PRICE');
    expect(code(() => assertPackageSound({ ...service, durationMinutes: 0 }))).toBe('BAD_DURATION');
    expect(code(() => assertPackageSound({ ...service, intervalKm: 0 }))).toBe('BAD_INTERVAL');
  });

  it('becomes the three kinds of line a job carries', () => {
    const lines = jobLinesFromPackage(service.lines);
    expect(lines.labour).toEqual([{ description: 'Service labour', hours: 2.5, rate: 60 }]);
    expect(lines.parts).toHaveLength(2);
    expect(lines.parts[0]).toEqual({
      description: 'Oil filter',
      quantity: 1,
      unitPrice: 12.5,
      productId: 'p1',
    });
    expect(lines.fees).toEqual([{ description: 'Waste oil disposal', amount: 4 }]);
  });

  it('is diaried in quarter hours', () => {
    expect(packageHours({ durationMinutes: 150 })).toBe(2.5);
    expect(packageHours({ durationMinutes: 50 })).toBe(0.75);
    expect(packageHours({ durationMinutes: 5 })).toBe(0.25);
  });

  it('knows when the next one is due', () => {
    const done = new Date(Date.UTC(2026, 8, 15));
    expect(
      nextServiceFrom({
        completedAt: done,
        odometerKm: 74_900,
        intervalMonths: 12,
        intervalKm: 20_000,
      }),
    ).toEqual({ dueAt: new Date(Date.UTC(2027, 8, 15)), dueKm: 94_900 });
    expect(
      nextServiceFrom({
        completedAt: done,
        odometerKm: null,
        intervalMonths: null,
        intervalKm: 10_000,
      }),
    ).toEqual({ dueAt: null, dueKm: null });
    expect(
      nextServiceFrom({ completedAt: done, odometerKm: 1, intervalMonths: null, intervalKm: null }),
    ).toBeNull();
  });

  it('reads as one line on a menu', () => {
    expect(packageSummary({ name: 'Full service', durationMinutes: 150, priceText: '£199' })).toBe(
      'Full service, about 2.5 hours, £199',
    );
  });
});
