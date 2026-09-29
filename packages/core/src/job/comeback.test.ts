import { describe, expect, it } from 'vitest';

import {
  byCause,
  COMEBACK_CAUSES,
  type ComebackCause,
  type ComebackRecord,
  isClaimable,
  isOurs,
  oursOf,
  patternsIn,
  stillMissing,
} from './comeback';

let n = 0;

function came(cause: ComebackCause | null, over: Partial<ComebackRecord> = {}): ComebackRecord {
  n += 1;
  return {
    jobId: `job-${n}`,
    cause,
    originalWork: 'Front brakes',
    vehicleId: `car-${n}`,
    at: new Date('2026-09-28T09:00:00Z'),
    ...over,
  };
}

describe('whose fault it was', () => {
  it('counts the four the workshop did as ours', () => {
    expect(isOurs('INCORRECT_DIAGNOSIS')).toBe(true);
    expect(isOurs('DEFECTIVE_PART')).toBe(true);
    expect(isOurs('INSTALLATION')).toBe(true);
    expect(isOurs('MISSED_IN_INSPECTION')).toBe(true);
  });

  // The rate has to be believable or nobody looks at it, and it has to be
  // honest or it is worth nothing.
  it('and the three that were not', () => {
    expect(isOurs('CUSTOMER_MISUSE')).toBe(false);
    expect(isOurs('UNRELATED')).toBe(false);
    expect(isOurs('UNKNOWN')).toBe(false);
  });

  it('a faulty part is ours to the customer and the supplier’s to us', () => {
    expect(isOurs('DEFECTIVE_PART')).toBe(true);
    expect(isClaimable('DEFECTIVE_PART')).toBe(true);
    expect(isClaimable('INSTALLATION')).toBe(false);
  });

  it('separates the two counts rather than choosing one', () => {
    const records = [came('INSTALLATION'), came('UNRELATED'), came('CUSTOMER_MISUSE')];
    expect(oursOf(records)).toEqual({ ours: 1, all: 3 });
  });
});

describe('the tally', () => {
  it('is biggest first', () => {
    const records = [
      came('INSTALLATION'),
      came('DEFECTIVE_PART'),
      came('DEFECTIVE_PART'),
      came('DEFECTIVE_PART'),
    ];
    expect(byCause(records)[0]).toMatchObject({ cause: 'DEFECTIVE_PART', count: 3, ours: true });
  });

  // Unclassified last, always: a heading that says "Not established: 9" at the
  // top of the list is a report about the workshop's paperwork rather than
  // about its work.
  it('with the unclassified at the bottom however many there are', () => {
    const records = [came(null), came(null), came(null), came('INSTALLATION')];
    const tally = byCause(records);
    expect(tally.at(-1)).toMatchObject({ cause: 'UNKNOWN', count: 3 });
    expect(tally[0]!.cause).toBe('INSTALLATION');
  });

  it('and nothing recorded yet is an empty tally, not a row of zeroes', () => {
    expect(byCause([])).toEqual([]);
  });
});

describe('a pattern rather than a count', () => {
  it('is the same repair back on several different cars', () => {
    const records = [
      came('INSTALLATION', { originalWork: 'Front brakes', vehicleId: 'a' }),
      came('INSTALLATION', { originalWork: 'Front brakes', vehicleId: 'b' }),
      came('DEFECTIVE_PART', { originalWork: 'Front brakes', vehicleId: 'c' }),
    ];

    expect(patternsIn(records)).toEqual([{ work: 'Front brakes', vehicles: 3, comebacks: 3 }]);
  });

  // The distinction the whole function exists for.
  it('and one stubborn car is not a pattern, however many times it returns', () => {
    const same = [
      came('UNKNOWN', { originalWork: 'Misfire', vehicleId: 'a' }),
      came('UNKNOWN', { originalWork: 'Misfire', vehicleId: 'a' }),
      came('UNKNOWN', { originalWork: 'Misfire', vehicleId: 'a' }),
      came('UNKNOWN', { originalWork: 'Misfire', vehicleId: 'a' }),
    ];

    expect(patternsIn(same)).toEqual([]);
  });

  it('ignores comebacks with no original work to group by', () => {
    const records = [
      came('UNKNOWN', { originalWork: null, vehicleId: 'a' }),
      came('UNKNOWN', { originalWork: '  ', vehicleId: 'b' }),
      came('UNKNOWN', { originalWork: null, vehicleId: 'c' }),
    ];
    expect(patternsIn(records)).toEqual([]);
  });

  it('and the threshold can be tightened', () => {
    const records = [
      came('INSTALLATION', { originalWork: 'Clutch', vehicleId: 'a' }),
      came('INSTALLATION', { originalWork: 'Clutch', vehicleId: 'b' }),
      came('INSTALLATION', { originalWork: 'Clutch', vehicleId: 'c' }),
    ];
    expect(patternsIn(records, 3)).toHaveLength(1);
    expect(patternsIn(records, 4)).toHaveLength(0);
  });
});

describe('what is still missing from a case', () => {
  it('names each gap', () => {
    expect(stillMissing({ cause: null, hasOriginal: false, hasNewComplaint: false })).toEqual([
      'which job it came back from',
      'what it came back with',
      'what caused it',
    ]);
  });

  it('and nothing when the case is whole', () => {
    expect(
      stillMissing({ cause: 'INSTALLATION', hasOriginal: true, hasNewComplaint: true }),
    ).toEqual([]);
  });
});

describe('the list itself', () => {
  it('has seven causes and every one has a label', () => {
    expect(COMEBACK_CAUSES).toHaveLength(7);
    expect(new Set(COMEBACK_CAUSES).size).toBe(7);
  });
});
