import { describe, expect, it } from 'vitest';

import {
  describeRun,
  describeTiming,
  isOncePerRow,
  isUnbounded,
  medianOf,
  nearTheLine,
  overBudget,
  p95Of,
  queriesPerRow,
  type Timing,
  worstOf,
  worstOverrunsFirst,
} from './budget';

const timing = (over: Partial<Timing> = {}): Timing => ({
  screen: 'Customers',
  path: '/customers',
  samples: [100, 110, 120],
  budget: 400,
  because: 'NFR-102.',
  ...over,
});

describe('reading a set of samples', () => {
  it('takes p95 at the nearest rank, so it reports a request that happened', () => {
    // Twenty samples: the 95th percentile is the 19th, not an interpolation
    // between two of them that nobody actually waited for.
    const samples = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    expect(p95Of(samples)).toBe(190);
  });

  it('is not fooled by a mean, which is the whole reason for using p95', () => {
    // Fifty quick requests and five terrible ones. The mean is comfortable;
    // the five are the ones somebody is sitting in front of.
    const samples = [...Array.from({ length: 50 }, () => 50), ...Array(5).fill(3_000)];

    expect(Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)).toBeLessThan(350);
    expect(p95Of(samples)).toBe(3_000);
  });

  it('says nothing rather than crashing on no samples at all', () => {
    expect(p95Of([])).toBe(0);
    expect(medianOf([])).toBe(0);
    expect(worstOf([])).toBe(0);
  });

  it('reports the typical and the worst beside the p95, because all three matter', () => {
    const said = describeTiming(timing({ samples: [80, 100, 900] }));

    expect(said).toContain('100 ms typical');
    expect(said).toContain('900 ms at p95');
    expect(said).toContain('400 ms allowed');
  });
});

describe('a screen against its budget', () => {
  it('says nothing when it is inside', () => {
    expect(overBudget(timing())).toBeNull();
  });

  it('names the screen, the figure, the budget and how many times over', () => {
    const over = overBudget(timing({ samples: [1_200, 1_200, 1_200] }));

    expect(over?.times).toBe(3);
    expect(over?.sentence).toContain('/customers');
    expect(over?.sentence).toContain('3 times over');
    expect(over?.sentence).toContain('NFR-102');
  });

  it('orders by how far over its own budget, not by how slow', () => {
    // A passport at 900 ms against 800 is closer to right than a single record
    // at 300 against 200, and a list sorted by raw time would send somebody to
    // the wrong one first.
    const over = [
      overBudget(timing({ screen: 'Passport', samples: [900], budget: 800 }))!,
      overBudget(timing({ screen: 'Customer', samples: [600], budget: 200 }))!,
    ];

    expect(worstOverrunsFirst(over).map((one) => one.screen)).toEqual(['Customer', 'Passport']);
  });

  it('names what is close to the line, which is what fails at twice the data', () => {
    const near = nearTheLine([
      timing({ screen: 'Close', samples: [360], budget: 400 }),
      timing({ screen: 'Fine', samples: [40], budget: 400 }),
      timing({ screen: 'Over', samples: [500], budget: 400 }),
    ]);

    expect(near.map((one) => one.screen)).toEqual(['Close']);
  });

  it('reads the whole run in one line', () => {
    expect(describeRun([timing()])).toBe('1 screens measured, all inside budget.');
    expect(describeRun([timing({ samples: [900] })])).toContain('1 over budget');
  });
});

describe('the shapes that make a screen slow', () => {
  it('spots a query per row, which is invisible when the loop runs twice', () => {
    expect(isOncePerRow({ queries: 51, rows: 50 })).toBe(true);
    expect(isOncePerRow({ queries: 3, rows: 50 })).toBe(false);
  });

  it('does not call two rows and two queries a problem, because it is not yet one', () => {
    expect(isOncePerRow({ queries: 2, rows: 2 })).toBe(false);
  });

  it('reports the ratio, so a report can say how bad', () => {
    expect(queriesPerRow({ queries: 150, rows: 50 })).toBe(3);
    expect(queriesPerRow({ queries: 5, rows: 0 })).toBe(0);
  });

  it('spots a list that never stops, which works until a workshop is three years old', () => {
    expect(isUnbounded({ rows: 5_000, limit: null })).toBe(true);
    expect(isUnbounded({ rows: 5_000, limit: 50 })).toBe(false);
    expect(isUnbounded({ rows: 12, limit: null })).toBe(false);
  });
});
