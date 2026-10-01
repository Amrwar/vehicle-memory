import { describe, expect, it } from 'vitest';

import {
  A_MORNING,
  COST_ORDER,
  COST_SENTENCE,
  howTheMorningLooks,
  isOneAction,
  MISS_KINDS,
  type MissItem,
  theMorning,
  worstToMissFirst,
} from './do-not-miss';

const day = (offset: number) => new Date(Date.UTC(2026, 9, 1 + offset, 9));

function item(over: Partial<MissItem> = {}): MissItem {
  return {
    kind: 'job-late',
    id: over.id ?? 'x',
    what: { key: 'Job #{number} is past its promised time', vars: { number: 10482 } },
    action: { key: 'Tell the customer' },
    href: '/jobs/abc',
    cost: 'A_PROMISE',
    when: day(0),
    ...over,
  };
}

describe('what it costs to miss something', () => {
  it('has a sentence for each', () => {
    for (const cost of COST_ORDER) expect(COST_SENTENCE[cost]).toBeTruthy();
  });

  it('puts somebody being hurt above everything', () => {
    expect(COST_ORDER[0]).toBe('SAFETY');
  });

  it('puts a promise above money', () => {
    // The money is usually recoverable and the customer often is not.
    expect(COST_ORDER.indexOf('A_PROMISE')).toBeLessThan(COST_ORDER.indexOf('MONEY'));
  });

  it('puts the record last, because it will still be there this afternoon', () => {
    expect(COST_ORDER.at(-1)).toBe('THE_RECORD');
  });
});

describe('exactly one action', () => {
  it('accepts an item that names a verb and somewhere to do it', () => {
    expect(isOneAction(item())).toBe(true);
  });

  it('refuses one with nothing to do', () => {
    expect(isOneAction(item({ action: { key: '' } }))).toBe(false);
    expect(isOneAction(item({ action: { key: '   ' } }))).toBe(false);
  });

  it('refuses one with nowhere to go', () => {
    expect(isOneAction(item({ href: '' }))).toBe(false);
    expect(isOneAction(item({ href: 'https://elsewhere.test' }))).toBe(false);
  });

  it('refuses one with nothing to say', () => {
    expect(isOneAction(item({ what: { key: '' } }))).toBe(false);
  });

  it('refuses a count dressed up as an action', () => {
    // "3 invoices overdue" is a number, and a number leaves the reader to work
    // out what to do -- which they will do tomorrow instead.
    expect(isOneAction(item({ action: { key: 'Overdue invoices: 3' } }))).toBe(false);
  });
});

describe('the order of a morning', () => {
  it('puts safety above a promise, and a promise above money', () => {
    const ordered = worstToMissFirst([
      item({ id: 'money', cost: 'MONEY' }),
      item({ id: 'record', cost: 'THE_RECORD' }),
      item({ id: 'safety', cost: 'SAFETY' }),
      item({ id: 'promise', cost: 'A_PROMISE' }),
    ]);

    expect(ordered.map((one) => one.id)).toEqual(['safety', 'promise', 'money', 'record']);
  });

  it('puts the earlier of two equal things first', () => {
    // The one sitting since Tuesday is the one somebody has already walked
    // past once.
    const ordered = worstToMissFirst([
      item({ id: 'today', when: day(0) }),
      item({ id: 'tuesday', when: day(-3) }),
    ]);

    expect(ordered.map((one) => one.id)).toEqual(['tuesday', 'today']);
  });

  it('puts something with no date last among its equals', () => {
    const ordered = worstToMissFirst([
      item({ id: 'undated', when: null }),
      item({ id: 'dated', when: day(0) }),
    ]);

    expect(ordered.map((one) => one.id)).toEqual(['dated', 'undated']);
  });
});

describe('the morning itself', () => {
  it('is clear when there is nothing, and says so', () => {
    const list = theMorning([]);
    expect(list.clear).toBe(true);
    expect(howTheMorningLooks(list)).toEqual({ key: 'Nothing to miss this morning.' });
  });

  it('counts one thing as one thing', () => {
    expect(howTheMorningLooks(theMorning([item()]))).toEqual({
      key: '1 thing to deal with.',
    });
  });

  it('counts what is behind the cap as well as what is on the screen', () => {
    const many = Array.from({ length: A_MORNING + 5 }, (_, index) => item({ id: `i${index}` }));
    const list = theMorning(many);

    expect(list.items).toHaveLength(A_MORNING);
    expect(list.more).toBe(5);
    expect(howTheMorningLooks(list)).toEqual({
      key: '{count} things to deal with.',
      vars: { count: A_MORNING + 5 },
    });
  });

  it('admits what is behind the cap rather than hiding it', () => {
    // A workshop with sixty things has a problem this screen cannot solve, and
    // pretending it has eight would be the screen lying to look calm.
    expect(theMorning(Array.from({ length: 60 }, (_, i) => item({ id: `i${i}` }))).more).toBe(
      60 - A_MORNING,
    );
  });

  it('drops a row that is not one action rather than showing it badly', () => {
    const list = theMorning([item({ id: 'good' }), item({ id: 'bad', action: { key: '' } })]);
    expect(list.items.map((one) => one.id)).toEqual(['good']);
  });

  it('is clear when every row was unfit', () => {
    expect(theMorning([item({ action: { key: '' } })]).clear).toBe(true);
  });

  it('counts how many of each cost, for the line at the top', () => {
    const list = theMorning([
      item({ id: 'a', cost: 'SAFETY' }),
      item({ id: 'b', cost: 'MONEY' }),
      item({ id: 'c', cost: 'MONEY' }),
    ]);

    expect(list.byCost).toEqual([
      { cost: 'SAFETY', count: 1 },
      { cost: 'MONEY', count: 2 },
    ]);
  });

  it('leaves a cost out of the count entirely when nothing has it', () => {
    expect(theMorning([item({ cost: 'MONEY' })]).byCost).toEqual([{ cost: 'MONEY', count: 1 }]);
  });
});

describe('the kinds', () => {
  it('are all distinct', () => {
    expect(new Set(MISS_KINDS).size).toBe(MISS_KINDS.length);
  });

  it('cover safety, promises, money and the record between them', () => {
    // Not an assertion about any one kind: a list that could only ever report
    // money would be the dashboard again.
    expect(MISS_KINDS.length).toBeGreaterThanOrEqual(COST_ORDER.length);
  });
});
