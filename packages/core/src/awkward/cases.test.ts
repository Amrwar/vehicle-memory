import { describe, expect, it } from 'vitest';

import { approvedPortion, AWKWARD, AWKWARD_KEYS, splitOverpayment, vinLooksReal } from './cases';

describe('the register itself', () => {
  it('has all thirteen of them', () => {
    expect(AWKWARD_KEYS).toHaveLength(13);
  });

  it('gives every one a decision and a reason, not just a description', () => {
    for (const key of AWKWARD_KEYS) {
      const one = AWKWARD[key]!;

      expect(one.situation.length).toBeGreaterThan(20);
      expect(one.decision.length).toBeGreaterThan(20);
      expect(one.because.length).toBeGreaterThan(20);
    }
  });
});

describe('a customer who pays too much', () => {
  it('settles the bill exactly and holds the rest', () => {
    expect(splitOverpayment({ paid: 12_000, outstanding: 10_000 })).toEqual({
      settles: 10_000,
      credit: 2_000,
    });
  });

  it('does not clamp the payment, because money in and money recorded must agree', () => {
    const split = splitOverpayment({ paid: 12_000, outstanding: 10_000 });
    expect(split.settles + split.credit).toBe(12_000);
  });

  it('leaves a normal payment alone', () => {
    expect(splitOverpayment({ paid: 4_000, outstanding: 10_000 })).toEqual({
      settles: 4_000,
      credit: 0,
    });
  });

  it('treats paying the exact amount as no credit rather than a penny of it', () => {
    expect(splitOverpayment({ paid: 10_000, outstanding: 10_000 }).credit).toBe(0);
  });
});

describe('a customer who approves half the quote', () => {
  const lines = [
    { id: 'a', totalMinor: 12_000 },
    { id: 'b', totalMinor: 8_000 },
    { id: 'c', totalMinor: 3_000 },
  ];

  it('charges for what was said yes to', () => {
    expect(approvedPortion(lines, ['a', 'c']).approvedMinor).toBe(15_000);
  });

  it('keeps the rest quoted rather than refused, so it can be said yes to later', () => {
    const outcome = approvedPortion(lines, ['a']);

    expect(outcome.stillQuoted.map((line) => line.id)).toEqual(['b', 'c']);
  });

  it('handles approving none and approving all', () => {
    expect(approvedPortion(lines, []).approvedMinor).toBe(0);
    expect(approvedPortion(lines, ['a', 'b', 'c']).stillQuoted).toEqual([]);
  });
});

describe('a VIN', () => {
  it('may be missing, because a car with no VIN to hand still has to be booked in', () => {
    expect(vinLooksReal(null)).toBe(true);
    expect(vinLooksReal('')).toBe(true);
  });

  it('must be seventeen characters when it is there', () => {
    expect(vinLooksReal('WBAJA9C509G00000')).toBe(false);
    expect(vinLooksReal('WBAJA9C509G000000')).toBe(true);
  });

  it('never contains I, O or Q, which are the three that get misread', () => {
    expect(vinLooksReal('WBAJA9C509G00000I')).toBe(false);
    expect(vinLooksReal('WBAJA9C509G00000O')).toBe(false);
    expect(vinLooksReal('WBAJA9C509G00000Q')).toBe(false);
  });

  it('does not care about case or surrounding space', () => {
    expect(vinLooksReal('  wbaja9c509g000000  ')).toBe(true);
  });
});
