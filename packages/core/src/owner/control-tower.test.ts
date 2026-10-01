import { describe, expect, it } from 'vitest';

import {
  hoursOf,
  howTheTowerLooks,
  partsInTheWayFirst,
  partStandingOf,
  type RiskFacts,
  startOfDayIn,
  theRisk,
} from './control-tower';

const quiet: RiskFacts = {
  building: { late: 0 },
  day: { overbookedMinutes: 0, notIn: [] },
  customers: { unansweredLongestMinutes: null, readyAndUnpaid: 0 },
  parts: [],
  promisedToday: 0,
  morning: { clear: true, total: 0 },
};

describe('theRisk', () => {
  it('says nothing about a quiet day', () => {
    expect(theRisk(quiet)).toEqual([]);
  });

  it('puts what is already costing before what merely will, whatever order the facts arrive in', () => {
    const risks = theRisk({
      ...quiet,
      morning: { clear: false, total: 3 },
      customers: { unansweredLongestMinutes: 200, readyAndUnpaid: 1 },
      promisedToday: 2,
      parts: [{ standing: 'LATE' }, { standing: 'TODAY' }],
      day: { overbookedMinutes: 90, notIn: ['Sam'] },
      building: { late: 1 },
    });

    expect(risks.map((one) => one.kind)).toEqual([
      'late',
      'overbooked',
      'parts-late',
      'promised-today',
      'not-in',
      'unanswered',
      'ready-unpaid',
      'morning-list',
    ]);
    const tones = risks.map((one) => one.tone);
    expect(tones.slice(0, 3)).toEqual(['danger', 'danger', 'danger']);
    expect(tones.slice(3).every((tone) => tone === 'warning')).toBe(true);
  });

  it('does not call a message a risk until it has waited two hours', () => {
    const soon = theRisk({
      ...quiet,
      customers: { unansweredLongestMinutes: 119, readyAndUnpaid: 0 },
    });
    const late = theRisk({
      ...quiet,
      customers: { unansweredLongestMinutes: 120, readyAndUnpaid: 0 },
    });
    expect(soon).toEqual([]);
    expect(late.map((one) => one.kind)).toEqual(['unanswered']);
    expect(late[0]?.what.vars).toEqual({ hours: 2 });
  });

  it('names one person and counts several', () => {
    const one = theRisk({ ...quiet, day: { overbookedMinutes: 0, notIn: ['Sam'] } });
    const two = theRisk({ ...quiet, day: { overbookedMinutes: 0, notIn: ['Sam', 'Jo'] } });
    expect(one[0]?.what).toEqual({
      key: '{name} is expected today and has not clocked on',
      vars: { name: 'Sam' },
    });
    expect(two[0]?.what.vars).toEqual({ count: 2 });
  });

  it('counts a part that no open order carries as a risk only once it is late', () => {
    const risks = theRisk({
      ...quiet,
      parts: [{ standing: 'NOT_ORDERED' }, { standing: 'LATER' }],
    });
    expect(risks).toEqual([]);
  });
});

describe('howTheTowerLooks', () => {
  const danger = { kind: 'late', tone: 'danger', what: { key: 'x' }, href: '/now' } as const;
  const warning = {
    kind: 'not-in',
    tone: 'warning',
    what: { key: 'y' },
    href: '/opening',
  } as const;

  it('says the building is empty only when nothing is at risk either', () => {
    expect(howTheTowerLooks({ inShop: 0 }, [])).toEqual({ key: 'Nothing in the building.' });
    expect(howTheTowerLooks({ inShop: 0 }, [warning]).key).toBe(
      '{cars} in the building, nothing costing you yet, {count} that will by tonight.',
    );
  });

  it('counts what is already costing, and otherwise what will', () => {
    expect(howTheTowerLooks({ inShop: 4 }, [danger]).key).toBe(
      '{cars} in the building, and one thing is already costing you.',
    );
    expect(howTheTowerLooks({ inShop: 4 }, [danger, danger, warning])).toEqual({
      key: '{cars} in the building, and {count} things are already costing you.',
      vars: { cars: 4, count: 2 },
    });
    expect(howTheTowerLooks({ inShop: 4 }, [warning])).toEqual({
      key: '{cars} in the building, nothing costing you yet, {count} that will by tonight.',
      vars: { cars: 4, count: 1 },
    });
    expect(howTheTowerLooks({ inShop: 4 }, []).key).toBe(
      '{cars} in the building and nothing at risk today.',
    );
  });
});

describe('parts in the way', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  const endOfDay = new Date('2026-10-01T23:00:00Z');
  const at = (iso: string) => new Date(iso);

  it('reads the standing off the order and the clock', () => {
    expect(partStandingOf({ ordered: false, expectedAt: null, now, endOfDay })).toBe('NOT_ORDERED');
    expect(partStandingOf({ ordered: true, expectedAt: null, now, endOfDay })).toBe('LATER');
    expect(
      partStandingOf({ ordered: true, expectedAt: at('2026-09-30T12:00:00Z'), now, endOfDay }),
    ).toBe('LATE');
    expect(
      partStandingOf({ ordered: true, expectedAt: at('2026-10-01T15:00:00Z'), now, endOfDay }),
    ).toBe('TODAY');
    expect(
      partStandingOf({ ordered: true, expectedAt: at('2026-10-03T09:00:00Z'), now, endOfDay }),
    ).toBe('LATER');
  });

  it('puts late first, then the part nobody actually ordered, then today, then later', () => {
    const sorted = partsInTheWayFirst([
      { standing: 'LATER', expectedAt: at('2026-10-05T00:00:00Z') },
      { standing: 'TODAY', expectedAt: at('2026-10-01T15:00:00Z') },
      { standing: 'NOT_ORDERED', expectedAt: null },
      { standing: 'LATE', expectedAt: at('2026-09-29T00:00:00Z') },
      { standing: 'LATE', expectedAt: at('2026-09-25T00:00:00Z') },
    ]);
    expect(
      sorted.map((one) => `${one.standing}:${one.expectedAt?.toISOString().slice(0, 10) ?? '-'}`),
    ).toEqual([
      'LATE:2026-09-25',
      'LATE:2026-09-29',
      'NOT_ORDERED:-',
      'TODAY:2026-10-01',
      'LATER:2026-10-05',
    ]);
  });
});

describe('arithmetic', () => {
  it('says hours the way a workshop does', () => {
    expect(hoursOf(450)).toBe(7.5);
    expect(hoursOf(0)).toBe(0);
    expect(hoursOf(100)).toBe(1.7);
  });

  it('finds local midnight, which is not UTC midnight anywhere that matters', () => {
    // British Summer Time: midnight in London is eleven the evening before, UTC.
    expect(startOfDayIn('2026-07-01', 'Europe/London').toISOString()).toBe(
      '2026-06-30T23:00:00.000Z',
    );
    // Riyadh is three hours ahead all year.
    expect(startOfDayIn('2026-10-01', 'Asia/Riyadh').toISOString()).toBe(
      '2026-09-30T21:00:00.000Z',
    );
    // And a zone behind UTC is the same day, later.
    expect(startOfDayIn('2026-10-01', 'America/New_York').toISOString()).toBe(
      '2026-10-01T04:00:00.000Z',
    );
    expect(startOfDayIn('2026-10-01', 'UTC').toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});
