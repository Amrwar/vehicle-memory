import { describe, expect, it } from 'vitest';

import {
  BARELY,
  canReport,
  describeTakeUp,
  describeUptake,
  type Capability,
  type Uptake,
  uptakeVerdictOf,
  worthAsking,
} from './uptake';

const surface = (over: Partial<Capability> = {}): Capability => ({
  name: 'Gift cards',
  area: 'Money',
  actions: ['giftcard.sold'],
  expected: true,
  ...over,
});

const used = (times: number, people: number, over: Partial<Capability> = {}): Uptake => ({
  surface: surface(over),
  times,
  people,
  last: times > 0 ? new Date('2026-09-18') : null,
});

describe('whether a capability was taken up', () => {
  it('counts real use as taken up', () => {
    expect(uptakeVerdictOf(used(40, 3))).toBe('taken up');
  });

  it('separates one person doing it from a workshop doing it', () => {
    // Either it is one person's job, or everybody else could not find it, and
    // those are different conversations.
    expect(uptakeVerdictOf(used(40, 1))).toBe('one pair of hands');
  });

  it('does not call twice uptake, however many people did it', () => {
    expect(BARELY).toBe(3);
    expect(uptakeVerdictOf(used(2, 2))).toBe('one pair of hands');
  });

  it('separates untouched from never expected, because only one is a finding', () => {
    expect(uptakeVerdictOf(used(0, 0))).toBe('untouched');
    expect(uptakeVerdictOf(used(0, 0, { expected: false }))).toBe('not for them');
  });
});

describe('what to ask about at the debrief', () => {
  const all = [
    used(40, 4, { name: 'Invoices' }),
    used(0, 0, { name: 'Gift cards' }),
    used(6, 1, { name: 'Deposits' }),
    used(0, 0, { name: 'Fleets', expected: false }),
  ];

  it('leaves out what plainly worked', () => {
    expect(worthAsking(all).map((one) => one.surface.name)).not.toContain('Invoices');
  });

  it('puts the untouched and expected first', () => {
    expect(worthAsking(all)[0]!.surface.name).toBe('Gift cards');
  });

  it('leaves out what nobody expected anybody to use', () => {
    expect(worthAsking(all).map((one) => one.surface.name)).toEqual(['Gift cards', 'Deposits']);
  });

  it('says the whole picture in one line', () => {
    const said = describeTakeUp(all);

    expect(said).toContain('1 taken up');
    expect(said).toContain('1 untouched');
    expect(said).toContain('1 not for this workshop');
  });

  it('words an untouched capability differently from an unwanted one', () => {
    expect(describeUptake(used(0, 0))).toContain('the pilot expected somebody would');
    expect(describeUptake(used(0, 0, { expected: false }))).toContain('nobody said they would');
  });

  it('counts people and times in words somebody would use', () => {
    expect(describeUptake(used(1, 1))).toBe('Gift cards: 1 time by 1 person.');
    expect(describeUptake(used(9, 2))).toBe('Gift cards: 9 times by 2 people.');
  });
});

describe('whether the pilot can produce its own exit', () => {
  it('is asked before the pilot, not after it', () => {
    const ready = canReport({ broke: true, slow: true, missing: true, unused: true });

    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);
  });

  it('names what has no source rather than hoping somebody remembers', () => {
    const notReady = canReport({ broke: true, slow: true, missing: false, unused: false });

    expect(notReady.ready).toBe(false);
    expect(notReady.missing).toEqual(['missing', 'unused']);
  });
});
