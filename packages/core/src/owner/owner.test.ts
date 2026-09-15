import { describe, expect, it } from 'vitest';

import {
  assertComebackLink,
  ComebackError,
  comebackCandidates,
  comebackRates,
  compareSuppliers,
  describePerformance,
  describeRate,
  describeTrend,
  type FinishedJob,
  measureSupplier,
  monthlyRatings,
  performanceOverTime,
  rateOf,
  type RatedAnswer,
  ratingTrend,
  reputationBy,
  type SupplierMeasures,
  type SupplierOption,
  type SupplierOrder,
} from './index';

const DAY = 86_400_000;
const now = new Date(2026, 8, 15, 12, 0, 0);
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ComebackError ? error.code : 'OTHER';
  }
}

describe('recording a comeback', () => {
  const job = { id: 'j2', vehicleId: 'v1', createdAt: now };
  const original = { id: 'j1', number: 41, vehicleId: 'v1', completedAt: daysAgo(12) };

  it('accepts finished work on the same car, with a reason', () => {
    expect(code(() => assertComebackLink({ job, original, reason: 'Same squeal' }))).toBeNull();
  });

  it('refuses itself, another car, unfinished work and work finished later', () => {
    expect(
      code(() => assertComebackLink({ job, original: { ...original, id: 'j2' }, reason: 'x x x' })),
    ).toBe('SAME_JOB');
    expect(
      code(() =>
        assertComebackLink({
          job,
          original: { ...original, vehicleId: 'v9' },
          reason: 'Same squeal',
        }),
      ),
    ).toBe('OTHER_VEHICLE');
    expect(
      code(() =>
        assertComebackLink({
          job,
          original: { ...original, completedAt: null },
          reason: 'Same squeal',
        }),
      ),
    ).toBe('NOT_FINISHED');
    expect(
      code(() =>
        assertComebackLink({
          job,
          original: { ...original, completedAt: new Date(now.getTime() + 1000) },
          reason: 'Same squeal',
        }),
      ),
    ).toBe('NOT_BEFORE');
  });

  it('refuses work finished too long ago, a loop, and no reason', () => {
    expect(
      code(() =>
        assertComebackLink({
          job,
          original: { ...original, completedAt: daysAgo(91) },
          reason: 'Same squeal',
        }),
      ),
    ).toBe('TOO_LATE');
    expect(
      code(() =>
        assertComebackLink({
          job,
          original: { ...original, comebackOfJobId: 'j2' },
          reason: 'Same squeal',
        }),
      ),
    ).toBe('LOOP');
    expect(code(() => assertComebackLink({ job, original, reason: '  ' }))).toBe('NO_REASON');
  });

  it('names the job in the refusal', () => {
    try {
      assertComebackLink({ job, original: { ...original, vehicleId: 'v9' }, reason: 'Same' });
    } catch (error) {
      expect((error as Error).message).toContain('Job #41');
    }
  });
});

describe('offering candidates', () => {
  it('offers finished work on the same car within the window, newest first', () => {
    const job = { id: 'j9', vehicleId: 'v1', createdAt: now };
    const found = comebackCandidates(job, [
      { id: 'a', vehicleId: 'v1', completedAt: daysAgo(20) },
      { id: 'b', vehicleId: 'v1', completedAt: daysAgo(3) },
      { id: 'c', vehicleId: 'v2', completedAt: daysAgo(3) },
      { id: 'd', vehicleId: 'v1', completedAt: daysAgo(31) },
      { id: 'e', vehicleId: 'v1', completedAt: null },
      { id: 'j9', vehicleId: 'v1', completedAt: daysAgo(1) },
    ]);
    expect(found.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('the comeback rate', () => {
  it('says nothing as a rate on too few jobs', () => {
    expect(rateOf(1, 4).value).toBeNull();
    expect(rateOf(1, 10).value).toBe(10);
    expect(rateOf(1, 3, 3).value).toBe(33.3);
    expect(describeRate(rateOf(1, 4))).toBe('1 back out of 4 jobs. Too few to state as a rate.');
    expect(describeRate(rateOf(2, 20))).toBe('10%: 2 back out of 20 jobs.');
    expect(describeRate(rateOf(0, 0))).toBe('No finished jobs in this period.');
  });

  it('counts a comeback against the site and every technician who did the work', () => {
    const north = { id: 's1', name: 'North' };
    const south = { id: 's2', name: 'South' };
    const ann = { id: 'u1', name: 'Ann' };
    const bo = { id: 'u2', name: 'Bo' };
    const jobs: FinishedJob[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`,
        completedAt: daysAgo(i),
        site: north,
        people: [ann],
        cameBack: i < 2,
      })),
      { id: 's0', completedAt: daysAgo(1), site: south, people: [ann, bo, bo], cameBack: true },
      { id: 's1', completedAt: daysAgo(1), site: south, people: [bo], cameBack: false },
    ];
    const rates = comebackRates(jobs);
    expect(rates.overall).toEqual({ part: 3, base: 12, value: 25 });
    expect(rates.bySite.map((row) => [row.name, row.rate.value, row.rate.part])).toEqual([
      ['North', 20, 2],
      ['South', null, 1],
    ]);
    expect(rates.byPerson.map((row) => [row.name, row.rate.base, row.rate.part])).toEqual([
      ['Ann', 11, 3],
      ['Bo', 2, 1],
    ]);
  });
});

describe('what customers said, over time', () => {
  const answers = (ratings: number[], at: Date, extra: Partial<RatedAnswer> = {}): RatedAnswer[] =>
    ratings.map((rating) => ({ rating, at, ...extra }));

  it('averages each month only when enough answered', () => {
    const rows = [...answers([5, 5, 4, 4, 5], daysAgo(3)), ...answers([2, 3], daysAgo(40))];
    const months = monthlyRatings(rows, 3, now);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months.map((m) => [m.count, m.average])).toEqual([
      [0, null],
      [2, null],
      [5, 4.6],
    ]);
  });

  it('names a direction only when both windows can be averaged', () => {
    const rows = [
      ...answers([5, 5, 5, 4, 5], daysAgo(10)),
      ...answers([4, 4, 4, 4, 4], daysAgo(100)),
    ];
    const trend = ratingTrend(rows, { now });
    expect(trend).toMatchObject({ current: 4.8, previous: 4, direction: 'up' });
    expect(describeTrend(trend)).toBe('4.8 from 5 answers, up from 4.');

    const steady = ratingTrend(
      [...answers([4, 4, 4, 4, 4], daysAgo(5)), ...answers([4, 4, 4, 4, 5], daysAgo(95))],
      { now },
    );
    expect(steady.direction).toBe('steady');

    const thin = ratingTrend(answers([5, 5, 5, 5, 5], daysAgo(5)), { now });
    expect(thin.direction).toBeNull();
    expect(describeTrend(thin)).toBe('5 from 5 answers. Too few before that to compare.');
    expect(describeTrend(ratingTrend(answers([1], daysAgo(1)), { now }))).toBe(
      '1 answer lately. Too few to average.',
    );
    expect(describeTrend(ratingTrend([], { now }))).toBe('Nobody has answered.');
  });

  it('calls a fall a fall', () => {
    const rows = [
      ...answers([3, 3, 4, 3, 3], daysAgo(10)),
      ...answers([5, 5, 4, 5, 5], daysAgo(120)),
    ];
    expect(ratingTrend(rows, { now }).direction).toBe('down');
  });

  it('splits by site and by each technician on the rated job, busiest first', () => {
    const north = { id: 's1', name: 'North' };
    const ann = { id: 'u1', name: 'Ann' };
    const bo = { id: 'u2', name: 'Bo' };
    const rows = [
      ...answers([5, 5], daysAgo(2), { site: north, people: [ann, bo] }),
      ...answers([3], daysAgo(2), { site: null, people: [bo] }),
      ...answers([4], daysAgo(400), { site: north, people: [ann] }),
    ];
    const sites = reputationBy(rows, 'site', { now });
    expect(sites.map((row) => [row.name, row.trend.currentCount])).toEqual([['North', 2]]);
    const people = reputationBy(rows, 'person', { now });
    expect(people.map((row) => [row.name, row.trend.currentCount])).toEqual([
      ['Bo', 3],
      ['Ann', 2],
    ]);
  });
});

describe('suppliers', () => {
  const order = (over: Partial<SupplierOrder>): SupplierOrder => ({
    createdAt: daysAgo(10),
    expectedAt: daysAgo(7),
    firstReceivedAt: daysAgo(8),
    ordered: 10,
    received: 10,
    receivedValue: 100,
    returnedValue: 0,
    closed: true,
    ...over,
  });

  it('measures only on enough orders', () => {
    expect(measureSupplier([order({}), order({})])).toEqual({
      orders: 2,
      leadDays: null,
      onTimePct: null,
      fillPct: null,
      returnPct: null,
    });
  });

  it('measures the wait, arriving when promised, filling, and sending back', () => {
    const measures = measureSupplier([
      order({}),
      order({ firstReceivedAt: daysAgo(4), received: 5, returnedValue: 10 }),
      order({ firstReceivedAt: daysAgo(6.5) }),
      order({ firstReceivedAt: null, expectedAt: null, closed: false, received: 0 }),
    ]);
    expect(measures.orders).toBe(4);
    expect(measures.leadDays).toBe(4);
    // The third arrived on the promised day, a few hours after midnight.
    expect(measures.onTimePct).toBe(66.7);
    expect(measures.fillPct).toBe(83.3);
    expect(measures.returnPct).toBe(3.3);
  });

  it('goes quarter by quarter and says what changed', () => {
    const q1 = new Date(2026, 0, 10);
    const q3 = new Date(2026, 6, 10);
    const at = (base: Date, wait: number, late: boolean) =>
      order({
        createdAt: base,
        expectedAt: new Date(base.getTime() + 2 * DAY),
        firstReceivedAt: new Date(base.getTime() + (late ? wait : 1) * DAY),
      });
    const orders = [
      at(q1, 2, false),
      at(q1, 2, false),
      at(q1, 2, false),
      at(q3, 6, true),
      at(q3, 5, true),
      at(q3, 6, true),
    ];
    const periods = performanceOverTime(orders, { now, quarters: 3 });
    expect(periods.map((p) => p.label)).toEqual(['Q1 2026', 'Q2 2026', 'Q3 2026']);
    expect(periods.map((p) => p.measures.orders)).toEqual([3, 0, 3]);
    expect(describePerformance(periods)).toEqual([
      'Slower: deliveries took 6 days in Q3 2026, against 1 in Q1 2026.',
      'Less reliable: 0% arrived by the day promised in Q3 2026, against 100% in Q1 2026.',
    ]);
    expect(describePerformance(performanceOverTime([order({})], { now }))).toEqual([
      'Too few orders in each quarter to say whether they are changing.',
    ]);
  });

  it('lays suppliers side by side, and marks a best only among two or more', () => {
    const measures = (leadDays: number | null, onTimePct: number | null): SupplierMeasures => ({
      orders: 5,
      leadDays,
      onTimePct,
      fillPct: null,
      returnPct: null,
    });
    const options: SupplierOption[] = [
      {
        id: 'a',
        name: 'Alpha',
        lastCost: 12,
        lastOrderedAt: daysAgo(5),
        timesSupplied: 3,
        measures: measures(4, 90),
      },
      {
        id: 'b',
        name: 'Beta',
        lastCost: 10,
        lastOrderedAt: daysAgo(50),
        timesSupplied: 1,
        measures: measures(2, 60),
      },
      {
        id: 'c',
        name: 'Gamma',
        lastCost: null,
        lastOrderedAt: null,
        timesSupplied: 0,
        measures: measures(1, null),
      },
      {
        id: 'd',
        name: 'Delta',
        lastCost: null,
        lastOrderedAt: null,
        timesSupplied: 0,
        measures: measures(null, null),
      },
    ];
    const rows = compareSuppliers(options);
    expect(rows.map((row) => row.name)).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta']);
    expect(rows.map((row) => [row.cheapest, row.quickest, row.mostReliable])).toEqual([
      [true, false, false],
      [false, false, true],
      [false, true, false],
      [false, false, false],
    ]);

    const alone = compareSuppliers([options[0]!]);
    expect([alone[0]!.cheapest, alone[0]!.quickest, alone[0]!.mostReliable]).toEqual([
      false,
      false,
      false,
    ]);
  });
});
