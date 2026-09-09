import { describe, expect, it } from 'vitest';

import {
  add,
  allocate,
  allocateByWeights,
  compare,
  equals,
  formatMoney,
  fromDecimal,
  money,
  MoneyError,
  multiply,
  percentOf,
  subtract,
  sum,
  toDecimalString,
  toNumber,
  zero,
} from './money';

describe('money construction', () => {
  it('rejects fractional minor units', () => {
    expect(() => money(10.5)).toThrow(MoneyError);
  });

  it('parses decimal strings exactly', () => {
    expect(fromDecimal('1408.00').minor).toBe(140_800);
    expect(fromDecimal('0.01').minor).toBe(1);
    expect(fromDecimal('-12.34').minor).toBe(-1234);
  });

  it('rounds a third decimal place half away from zero', () => {
    expect(fromDecimal('1.005').minor).toBe(101);
    expect(fromDecimal('1.004').minor).toBe(100);
  });

  it('handles currencies with no minor unit', () => {
    expect(fromDecimal('1500', 'JPY').minor).toBe(1500);
    expect(toDecimalString(money(1500, 'JPY'))).toBe('1500');
  });

  it('handles currencies with three minor digits', () => {
    expect(fromDecimal('1.234', 'KWD').minor).toBe(1234);
  });

  it('rejects malformed input rather than guessing', () => {
    expect(() => fromDecimal('twelve')).toThrow(MoneyError);
    expect(() => fromDecimal('1.2.3')).toThrow(MoneyError);
  });

  it('round-trips through a decimal string', () => {
    for (const value of ['0.00', '0.01', '19.99', '1408.00', '-5.55']) {
      expect(toDecimalString(fromDecimal(value))).toBe(value);
    }
  });
});

describe('arithmetic', () => {
  it('adds and subtracts without floating point drift', () => {
    // The canonical failure: 0.1 + 0.2 !== 0.3 in IEEE 754.
    const total = add(fromDecimal('0.10'), fromDecimal('0.20'));
    expect(toDecimalString(total)).toBe('0.30');
    expect(toNumber(total)).toBe(0.3);
  });

  it('refuses to mix currencies', () => {
    expect(() => add(money(100, 'GBP'), money(100, 'EUR'))).toThrow(MoneyError);
  });

  it('sums an empty list to zero', () => {
    expect(equals(sum([]), zero())).toBe(true);
  });

  it('multiplies by a quantity, rounding half away from zero', () => {
    expect(multiply(fromDecimal('12.50'), 3).minor).toBe(3750);
    // 2.675 * 100 is 267.49999999999997 in binary floating point.
    expect(multiply(fromDecimal('2.675'), 1).minor).toBe(268);
  });

  it('computes a percentage', () => {
    expect(toDecimalString(percentOf(fromDecimal('100.00'), 20))).toBe('20.00');
    expect(toDecimalString(percentOf(fromDecimal('19.99'), 20))).toBe('4.00');
  });

  it('subtracts into a negative correctly', () => {
    expect(toDecimalString(subtract(fromDecimal('10.00'), fromDecimal('25.50')))).toBe('-15.50');
  });

  it('orders amounts', () => {
    expect(compare(fromDecimal('1.00'), fromDecimal('2.00'))).toBe(-1);
    expect(compare(fromDecimal('2.00'), fromDecimal('2.00'))).toBe(0);
  });
});

describe('allocation', () => {
  it('splits without losing a penny', () => {
    const parts = allocate(fromDecimal('1.00'), 3);
    expect(parts.map((p) => p.minor)).toEqual([34, 33, 33]);
    expect(sum(parts).minor).toBe(100);
  });

  it('splits negative amounts without losing a penny', () => {
    const parts = allocate(fromDecimal('-1.00'), 3);
    expect(sum(parts).minor).toBe(-100);
  });

  it('distributes by weight, preserving the total exactly', () => {
    // The passport revenue share: 30% of net across three workshops.
    const pool = fromDecimal('4.14');
    const shares = allocateByWeights(pool, [11, 5, 2]);

    expect(sum(shares).minor).toBe(pool.minor);
    // Largest contributor receives the largest share.
    expect(shares[0]!.minor).toBeGreaterThan(shares[1]!.minor);
    expect(shares[1]!.minor).toBeGreaterThan(shares[2]!.minor);
  });

  it('falls back to an even split when all weights are zero', () => {
    const shares = allocateByWeights(fromDecimal('1.00'), [0, 0, 0]);
    expect(sum(shares).minor).toBe(100);
  });

  it('handles a weight distribution that would otherwise lose units', () => {
    const shares = allocateByWeights(fromDecimal('10.00'), [1, 1, 1]);
    expect(sum(shares).minor).toBe(1000);
  });
});

describe('formatting', () => {
  it('formats in the given locale and currency', () => {
    const formatted = formatMoney(fromDecimal('1408.00'), 'en-GB');
    expect(formatted).toContain('1,408.00');
  });
});
