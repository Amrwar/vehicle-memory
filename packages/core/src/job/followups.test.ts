import { describe, expect, it } from 'vitest';

import {
  assertFollowUp,
  assertNotDone,
  daysLate,
  describeFollowUp,
  FollowUpError,
  needingAttention,
  standingOf,
  mostOverdueFirst,
} from './followups';

const MONDAY = new Date('2026-09-21T09:00:00Z');

const due = (iso: string, completedAt: Date | null = null) => ({
  dueAt: new Date(iso),
  completedAt,
});

describe('where a follow-up stands', () => {
  it('is due today when it is today, whatever the hour', () => {
    // Set for nine this morning, read at ten past. Not late.
    expect(standingOf(due('2026-09-21T09:00:00Z'), new Date('2026-09-21T09:10:00Z'))).toBe('TODAY');
    expect(standingOf(due('2026-09-21T23:00:00Z'), MONDAY)).toBe('TODAY');
  });

  it('is overdue the day after, and counts the days', () => {
    expect(standingOf(due('2026-09-18T09:00:00Z'), MONDAY)).toBe('OVERDUE');
    expect(daysLate(due('2026-09-18T09:00:00Z'), MONDAY)).toBe(3);
  });

  it('separates the coming week from the rest', () => {
    expect(standingOf(due('2026-09-25T09:00:00Z'), MONDAY)).toBe('SOON');
    expect(standingOf(due('2026-11-25T09:00:00Z'), MONDAY)).toBe('LATER');
  });

  it('is done when it is done, however late it was', () => {
    expect(standingOf(due('2020-01-01T09:00:00Z', MONDAY), MONDAY)).toBe('DONE');
    expect(daysLate(due('2020-01-01T09:00:00Z', MONDAY), MONDAY)).toBe(0);
  });
});

describe('what it says', () => {
  it('says how late rather than showing a colour', () => {
    expect(describeFollowUp(due('2026-09-20T09:00:00Z'), MONDAY)).toBe('1 day late');
    expect(describeFollowUp(due('2026-09-14T09:00:00Z'), MONDAY)).toBe('7 days late');
  });

  it('never says "1 days"', () => {
    expect(describeFollowUp(due('2026-09-20T09:00:00Z'), MONDAY)).not.toContain('1 days');
  });
});

describe('what to look at first', () => {
  const list = [
    due('2026-11-01T09:00:00Z'),
    due('2026-09-01T09:00:00Z'),
    due('2026-09-21T09:00:00Z'),
    due('2026-09-10T09:00:00Z'),
    due('2026-01-01T09:00:00Z', MONDAY),
  ];

  it('puts the worst first, then today, then the rest by date', () => {
    const order = mostOverdueFirst(list, MONDAY).map((one) => one.dueAt.toISOString().slice(0, 10));

    expect(order).toEqual([
      '2026-09-01', // most overdue
      '2026-09-10',
      '2026-09-21', // today
      '2026-11-01',
      '2026-01-01', // done, out of the way
    ]);
  });

  it('counts what needs doing now, which is late plus today', () => {
    expect(needingAttention(list, MONDAY)).toBe(3);
  });

  it('does not count what is done or what is not due yet', () => {
    expect(needingAttention([due('2026-11-01T09:00:00Z')], MONDAY)).toBe(0);
    expect(needingAttention([due('2020-01-01T09:00:00Z', MONDAY)], MONDAY)).toBe(0);
  });
});

describe('setting one', () => {
  it('accepts a date in the past, because work arrives already late', () => {
    // "We should have rung them last week" is the commonest follow-up there is.
    expect(() =>
      assertFollowUp({ note: 'Ring about the rear discs', dueAt: new Date('2026-09-14') }, MONDAY),
    ).not.toThrow();
  });

  it('refuses a year in the past, which is a typed year', () => {
    expect(() =>
      assertFollowUp({ note: 'Ring about the discs', dueAt: new Date('2024-09-14') }, MONDAY),
    ).toThrow(FollowUpError);
  });

  it('refuses a note that says nothing', () => {
    expect(() => assertFollowUp({ note: '  ', dueAt: MONDAY }, MONDAY)).toThrow(/what needs doing/);
  });

  it('refuses ticking off something already ticked off', () => {
    expect(() => assertNotDone(due('2026-09-01T09:00:00Z', MONDAY))).toThrow(FollowUpError);
    expect(() => assertNotDone(due('2026-09-01T09:00:00Z'))).not.toThrow();
  });
});
