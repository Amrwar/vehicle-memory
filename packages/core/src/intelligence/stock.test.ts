import { describe, expect, it } from 'vitest';

import { demandProfile, divergences, MIN_PERIODS, recommendReorder, type Usage } from './demand';
import { assessQuoting, durationFor, MIN_SAMPLES, type Sample, worstQuoted } from './duration';

const NOW = new Date('2026-09-10T09:00:00');

/** Usage of `quantity`, `monthsAgo` months back. */
function used(monthsAgo: number, quantity: number): Usage {
  return { at: new Date(NOW.getTime() - monthsAgo * 30 * 86_400_000), quantity };
}

/* ===========================================================================
   Demand
   =========================================================================== */

describe('bucketing usage into months', () => {
  it('keeps empty months as zeros', () => {
    // Dropping them makes a part used once a quarter read as one used every
    // month, which triples the stock the workshop is told to hold.
    const profile = demandProfile([used(0.5, 6), used(3.5, 6)], { now: NOW, periods: 6 });

    expect(profile.periods.filter((value) => value === 0)).toHaveLength(4);
    expect(profile.mean).toBe(2);
  });

  it('measures how much months differ from each other', () => {
    const steady = demandProfile(
      Array.from({ length: 6 }, (_, month) => used(month + 0.5, 10)),
      { now: NOW, periods: 6 },
    );

    const lumpy = demandProfile([used(0.5, 60)], { now: NOW, periods: 6 });

    expect(steady.mean).toBe(10);
    expect(steady.deviation).toBe(0);
    // Same average, completely different stocking problem.
    expect(lumpy.mean).toBe(10);
    expect(lumpy.deviation).toBeGreaterThan(20);
  });

  it('notices usage that has been climbing', () => {
    const rising = demandProfile(
      [used(5.5, 1), used(4.5, 2), used(3.5, 4), used(2.5, 8), used(1.5, 10), used(0.5, 12)],
      { now: NOW, periods: 6 },
    );

    expect(rising.rising).toBe(true);
  });
});

describe('what to reorder', () => {
  const steady = demandProfile(
    Array.from({ length: 12 }, (_, month) => used(month + 0.5, 10)),
    { now: NOW, periods: 12 },
  );

  it('answers when there is enough to go on', () => {
    const recommendation = recommendReorder({ profile: steady, leadTimeDays: 7 });

    expect(recommendation.known).toBe(true);
    if (recommendation.known) {
      // Roughly a week of use, plus nothing for variability since it never varies.
      expect(recommendation.reorderAt).toBeGreaterThanOrEqual(2);
      expect(recommendation.safetyStock).toBe(0);
      expect(recommendation.reason).toMatch(/Steady usage/);
    }
  });

  it('refuses when there is not', () => {
    // A figure from two months looks identical to one from two hundred.
    const thin = demandProfile([used(0.5, 3)], { now: NOW, periods: MIN_PERIODS - 1 });
    const recommendation = recommendReorder({ profile: thin, leadTimeDays: 7 });

    expect(recommendation.known).toBe(false);
    if (!recommendation.known) expect(recommendation.reason).toMatch(/Not enough/);
  });

  it('refuses when a part has moved only once', () => {
    const once = demandProfile([used(2.5, 40)], { now: NOW, periods: 12 });
    const recommendation = recommendReorder({ profile: once, leadTimeDays: 7 });

    expect(recommendation.known).toBe(false);
    if (!recommendation.known) expect(recommendation.reason).toMatch(/only one month/);
  });

  it('says nothing at all about a part that never moves', () => {
    const dead = demandProfile([], { now: NOW, periods: 12 });
    const recommendation = recommendReorder({ profile: dead, leadTimeDays: 7 });

    expect(recommendation.known).toBe(false);
    if (!recommendation.known) expect(recommendation.reason).toMatch(/has not moved at all/);
  });

  it('holds more of a part whose usage swings, at the same average', () => {
    // The reason safety stock exists. Two parts averaging ten a month need
    // different shelves if one sells ten every month and the other sixty once.
    const lumpy = demandProfile([used(0.5, 40), used(4.5, 40), used(8.5, 40)], {
      now: NOW,
      periods: 12,
    });

    const even = recommendReorder({ profile: steady, leadTimeDays: 7 });
    const uneven = recommendReorder({ profile: lumpy, leadTimeDays: 7 });

    expect(even.known && uneven.known).toBe(true);
    if (even.known && uneven.known) {
      expect(uneven.safetyStock).toBeGreaterThan(even.safetyStock);
      expect(uneven.reason).toMatch(/swings widely/);
    }
  });

  it('holds more when the wait is longer', () => {
    const quick = recommendReorder({ profile: steady, leadTimeDays: 3 });
    const slow = recommendReorder({ profile: steady, leadTimeDays: 21 });

    expect(quick.known && slow.known).toBe(true);
    if (quick.known && slow.known) {
      expect(slow.reorderAt).toBeGreaterThan(quick.reorderAt);
    }
  });
});

describe('which settings are actually wrong', () => {
  const steady = demandProfile(
    Array.from({ length: 12 }, (_, month) => used(month + 0.5, 30)),
    { now: NOW, periods: 12 },
  );

  const recommendation = recommendReorder({ profile: steady, leadTimeDays: 14 });

  it('ignores a difference too small to act on', () => {
    const suggested = recommendation.known ? recommendation.reorderAt : 0;

    expect(
      divergences([
        { productId: 'p1', name: 'Oil filter', reorderPoint: suggested, recommendation },
      ]),
    ).toEqual([]);
  });

  it('names a setting far too low, which stops jobs', () => {
    const found = divergences([
      { productId: 'p1', name: 'Oil filter', reorderPoint: 1, recommendation },
    ]);

    expect(found[0]?.direction).toBe('TOO_LOW');
  });

  it('names a setting far too high, which is cash on a shelf', () => {
    const found = divergences([
      { productId: 'p1', name: 'Oil filter', reorderPoint: 400, recommendation },
    ]);

    expect(found[0]?.direction).toBe('TOO_HIGH');
  });

  it('says nothing about a part it could not assess', () => {
    expect(
      divergences([
        {
          productId: 'p2',
          name: 'Rare bracket',
          reorderPoint: 5,
          recommendation: { known: false, reason: 'no' },
        },
      ]),
    ).toEqual([]);
  });
});

/* ===========================================================================
   Duration
   =========================================================================== */

function job(minutes: number, estimatedMinutes: number | null = null, index = 0): Sample {
  return {
    jobId: `j${index}`,
    minutes,
    estimatedMinutes,
    completedAt: new Date(NOW.getTime() - index * 86_400_000),
  };
}

describe('how long a job takes', () => {
  it('refuses to answer from too few', () => {
    // Somebody will schedule against whatever number appears here.
    const estimate = durationFor([job(60), job(70)]);

    expect(estimate.known).toBe(false);
    if (!estimate.known) expect(estimate.reason).toMatch(/Too few to schedule against/);
  });

  it('uses the middle, not the average', () => {
    // One job with the clock left running over lunch moves a mean and does
    // not move a median.
    const samples = [
      job(60, null, 1),
      job(62, null, 2),
      job(58, null, 3),
      job(61, null, 4),
      job(600, null, 5),
    ];
    const estimate = durationFor(samples);

    expect(estimate.known).toBe(true);
    if (estimate.known) expect(estimate.median).toBe(61);
  });

  it('reports the spread, because that is the schedulable part', () => {
    const tight = durationFor(
      [88, 90, 90, 92, 94].map((minutes, index) => job(minutes, null, index)),
    );

    const wild = durationFor(
      [40, 60, 90, 180, 240].map((minutes, index) => job(minutes, null, index)),
    );

    expect(tight.known && wild.known).toBe(true);
    if (tight.known && wild.known) {
      expect(tight.spread).toBeLessThan(wild.spread);
      expect(wild.reason).toMatch(/vary too much to be one job/);
    }
  });

  it('ignores a job with no time booked to it', () => {
    expect(durationFor([job(0), job(0), job(60), job(62), job(58)]).known).toBe(false);
  });

  it('needs the floor exactly', () => {
    const samples = Array.from({ length: MIN_SAMPLES }, (_, index) => job(60, null, index));
    expect(durationFor(samples).known).toBe(true);
  });
});

describe('whether a job is sold for what it costs', () => {
  const samples = [95, 100, 100, 105, 110].map((minutes, index) => job(minutes, null, index));

  it('spots work that runs over what it was sold for', () => {
    const quoting = assessQuoting({ jobType: 'Full service', samples, bookedMinutes: 60 });

    expect(quoting.verdict).toBe('UNDERQUOTED');
    expect(quoting.note).toMatch(/unpaid/);
  });

  it('spots work that is booked for longer than it takes', () => {
    // Never shows up in the accounts: the work is profitable and the diary
    // has holes in it nobody can explain.
    const quoting = assessQuoting({ jobType: 'Full service', samples, bookedMinutes: 180 });

    expect(quoting.verdict).toBe('OVERQUOTED');
    expect(quoting.note).toMatch(/could be sold/);
  });

  it('leaves alone a booking that is close enough', () => {
    expect(assessQuoting({ jobType: 'Full service', samples, bookedMinutes: 100 }).verdict).toBe(
      'ABOUT_RIGHT',
    );
  });

  it('says it does not know rather than guessing', () => {
    expect(
      assessQuoting({ jobType: 'Full service', samples: [job(60)], bookedMinutes: 60 }).verdict,
    ).toBe('UNKNOWN');

    expect(assessQuoting({ jobType: 'Full service', samples, bookedMinutes: null }).verdict).toBe(
      'UNKNOWN',
    );
  });

  it('ranks by what it costs across the year, not by the gap on one job', () => {
    // Twenty minutes on a job done four times a day beats two hours on a job
    // done twice a year.
    const common = assessQuoting({
      jobType: 'Oil change',
      samples: Array.from({ length: 200 }, (_, index) => job(50, null, index)),
      bookedMinutes: 30,
    });

    const rare = assessQuoting({
      jobType: 'Gearbox rebuild',
      samples: Array.from({ length: 5 }, (_, index) => job(600, null, index)),
      bookedMinutes: 480,
    });

    expect(worstQuoted([rare, common])[0]?.jobType).toBe('Oil change');
  });
});
