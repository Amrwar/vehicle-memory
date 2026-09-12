import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import { observeRevenue } from './observations';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

const slice = (label: string, revenue: number, cost: number, jobs: number) => ({
  label,
  revenue: gbp(revenue),
  cost: gbp(cost),
  jobs,
});

describe('observeRevenue', () => {
  it('says nothing has happened when nothing has', () => {
    expect(
      observeRevenue({
        current: slice('September 2026', 0, 0, 0),
        previous: slice('August 2026', 12000, 7000, 30),
        byKind: [],
      }),
    ).toEqual(['Nothing invoiced yet in September 2026.']);
  });

  it('states the figure, the count and the average', () => {
    const lines = observeRevenue({
      current: slice('September 2026', 12000, 7200, 24),
      previous: slice('August 2026', 10000, 6500, 22),
      byKind: [],
    });

    expect(lines[0]).toBe('£12,000 invoiced in September 2026 across 24 jobs, £500 a job.');
  });

  it('compares when both sides are big enough', () => {
    const lines = observeRevenue({
      current: slice('September 2026', 12000, 7200, 24),
      previous: slice('August 2026', 10000, 6500, 22),
      byKind: [],
    });

    expect(lines[1]).toBe('That is up 20% on August 2026 (£10,000 across 22 jobs).');
  });

  it('refuses to call a trend on a handful of jobs', () => {
    // A rise of 40% on two invoices is two invoices.
    const lines = observeRevenue({
      current: slice('September 2026', 1400, 800, 2),
      previous: slice('August 2026', 1000, 600, 3),
      byKind: [],
    });

    expect(lines[1]).toContain('Too few jobs on one side to call a trend.');
    expect(lines.join(' ')).not.toContain('%  on');
  });

  it('states the margin and mentions the change only when it moved', () => {
    const steady = observeRevenue({
      current: slice('September 2026', 12000, 7200, 24),
      previous: slice('August 2026', 10000, 6000, 22),
      byKind: [],
    });
    expect(steady[2]).toBe('Gross margin 40%.');

    const moved = observeRevenue({
      current: slice('September 2026', 12000, 7200, 24),
      previous: slice('August 2026', 10000, 5000, 22),
      byKind: [],
    });
    expect(moved[2]).toBe('Gross margin 40%, against 50% in August 2026.');
  });

  it('names the dominant kind of work only when it dominates', () => {
    const dominated = observeRevenue({
      current: slice('September 2026', 10000, 6000, 20),
      previous: slice('August 2026', 9000, 5000, 20),
      byKind: [
        { name: 'Brakes', revenue: gbp(5000) },
        { name: 'Servicing', revenue: gbp(3000) },
        { name: 'Tyres', revenue: gbp(2000) },
      ],
    });
    expect(dominated).toContain('Brakes is 50% of it.');

    const spread = observeRevenue({
      current: slice('September 2026', 10000, 6000, 20),
      previous: slice('August 2026', 9000, 5000, 20),
      byKind: [
        { name: 'Brakes', revenue: gbp(3500) },
        { name: 'Servicing', revenue: gbp(3500) },
        { name: 'Tyres', revenue: gbp(3000) },
      ],
    });
    expect(spread.some((line) => line.includes('% of it'))).toBe(false);
  });

  it('never runs to more than four sentences', () => {
    const lines = observeRevenue({
      current: slice('September 2026', 12000, 7200, 24),
      previous: slice('August 2026', 10000, 5000, 22),
      byKind: [
        { name: 'Brakes', revenue: gbp(9000) },
        { name: 'Tyres', revenue: gbp(3000) },
      ],
    });
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.every((line) => /\d/.test(line))).toBe(true);
  });
});
