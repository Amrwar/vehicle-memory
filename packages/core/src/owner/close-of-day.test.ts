import { describe, expect, it } from 'vitest';

import {
  assertRecordable,
  businessDay,
  CLOSE_READINGS,
  CloseOfDayError,
  howTheCloseLooks,
  howTheDayEnds,
  type CloseReading,
  type CloseReadingKind,
  SHOULD_NOT_BE_LEFT,
  settled,
  shouldNotBeLeft,
} from './close-of-day';

function reading(kind: CloseReadingKind, count: number): CloseReading {
  return {
    kind,
    count,
    what: { key: `${kind} says something`, vars: { count } },
    href: `/${kind}`,
  };
}

/** A whole close, every reading nought unless named otherwise. */
function allTen(over: Partial<Record<CloseReadingKind, number>> = {}): CloseReading[] {
  return CLOSE_READINGS.map((kind) => reading(kind, over[kind] ?? 0));
}

describe('the ten readings', () => {
  it('are all distinct', () => {
    expect(new Set(CLOSE_READINGS).size).toBe(CLOSE_READINGS.length);
  });

  it('are ten, because the plan said ten', () => {
    expect(CLOSE_READINGS).toHaveLength(10);
  });

  it('name the three that should not be left overnight', () => {
    expect([...SHOULD_NOT_BE_LEFT].sort()).toEqual(['clocked-on', 'keys', 'till']);
  });

  it('only calls a real reading one that should not be left', () => {
    for (const kind of SHOULD_NOT_BE_LEFT) {
      expect(CLOSE_READINGS).toContain(kind);
    }
  });

  it('treats a car on site overnight as ordinary', () => {
    // Every workshop leaves cars out. Saying so in the same voice as keys
    // nobody can place would teach people to read the whole list in that voice.
    expect(shouldNotBeLeft('cars-on-site')).toBe(false);
    expect(shouldNotBeLeft('open-jobs')).toBe(false);
  });
});

describe('how the day ends', () => {
  it('is clear when every reading is nought', () => {
    const close = howTheDayEnds(allTen());
    expect(close.clear).toBe(true);
    expect(howTheCloseLooks(close)).toEqual({
      key: 'Everything is counted, and nobody is still here.',
    });
  });

  it('separates what should not be left from what is merely outstanding', () => {
    const close = howTheDayEnds(allTen({ keys: 2, 'open-jobs': 4 }));

    expect(close.leftOvernight.map((one) => one.kind)).toEqual(['keys']);
    expect(close.outstanding.map((one) => one.kind)).toEqual(['open-jobs']);
    expect(close.clear).toBe(false);
  });

  it('leads with what should not be left, even when more is merely outstanding', () => {
    const close = howTheDayEnds(
      allTen({ till: 1, 'open-jobs': 4, 'unpaid-invoices': 9, 'parts-late': 3 }),
    );

    expect(howTheCloseLooks(close)).toEqual({ key: '1 thing should not be left overnight.' });
  });

  it('counts more than one of them', () => {
    const close = howTheDayEnds(allTen({ till: 1, keys: 2, 'clocked-on': 1 }));
    expect(howTheCloseLooks(close)).toEqual({
      key: '{count} things should not be left overnight.',
      vars: { count: 3 },
    });
  });

  it('says plainly when nothing has to wait up', () => {
    expect(howTheCloseLooks(howTheDayEnds(allTen({ 'open-jobs': 4 })))).toEqual({
      key: '1 thing is outstanding, and none of it has to wait up.',
    });
    expect(
      howTheCloseLooks(howTheDayEnds(allTen({ 'open-jobs': 4, 'follow-ups-due': 2 }))),
    ).toEqual({
      key: '{count} things are outstanding, and none of it has to wait up.',
      vars: { count: 2 },
    });
  });

  it('keeps all ten readings whatever they say', () => {
    // The screen shows the settled ones too. A close that listed only problems
    // could not tell "the till balanced" from "nobody counted the till".
    expect(howTheDayEnds(allTen({ keys: 1 })).readings).toHaveLength(10);
  });

  it('calls nought settled and anything else not', () => {
    expect(settled(reading('keys', 0))).toBe(true);
    expect(settled(reading('keys', 1))).toBe(false);
  });
});

describe('what may be recorded', () => {
  it('accepts all ten', () => {
    expect(() => assertRecordable(allTen())).not.toThrow();
  });

  it('accepts a close with everything outstanding', () => {
    // A workshop may close with the world on fire. That is the point of
    // recording it, and a close that refused would be worked around by not
    // opening the screen.
    const everything = CLOSE_READINGS.map((kind) => reading(kind, 7));
    expect(() => assertRecordable(everything)).not.toThrow();
  });

  it('refuses one with a reading missing', () => {
    const nine = allTen().filter((one) => one.kind !== 'keys');
    try {
      assertRecordable(nine);
      expect.unreachable('it was allowed');
    } catch (error) {
      expect((error as CloseOfDayError).code).toBe('INCOMPLETE');
      expect((error as Error).message).toContain('keys');
    }
  });

  it('refuses one that answers a reading twice', () => {
    const eleven = [...allTen(), reading('keys', 3)];
    expect(() => assertRecordable(eleven)).toThrow(CloseOfDayError);
  });

  it('refuses a count that is not a whole number of things', () => {
    const odd = allTen().map((one) => (one.kind === 'keys' ? reading('keys', -1) : one));
    expect(() => assertRecordable(odd)).toThrow(CloseOfDayError);

    const fractional = allTen().map((one) => (one.kind === 'keys' ? reading('keys', 1.5) : one));
    expect(() => assertRecordable(fractional)).toThrow(CloseOfDayError);
  });
});

describe('which day a close belongs to', () => {
  it('is the workshop’s day, not the server’s', () => {
    // Six in the evening in Sydney is already tomorrow in UTC. A close dated by
    // the server would file half the workshop's year on the wrong day.
    const at = new Date('2026-10-01T08:00:00Z'); // 19:00 in Sydney, 09:00 in London
    expect(businessDay(at, 'Australia/Sydney')).toBe('2026-10-01');
    expect(businessDay(at, 'Europe/London')).toBe('2026-10-01');

    const evening = new Date('2026-10-01T22:00:00Z'); // 09:00 next day in Sydney
    expect(businessDay(evening, 'Australia/Sydney')).toBe('2026-10-02');
    expect(businessDay(evening, 'Europe/London')).toBe('2026-10-01');
  });

  it('files a one-in-the-morning close against the day that is ending', () => {
    const late = new Date('2026-10-02T01:30:00Z');
    expect(businessDay(late, 'Europe/London')).toBe('2026-10-01');
  });

  it('files anything after the cut against the day that has started', () => {
    const early = new Date('2026-10-02T05:00:00Z');
    expect(businessDay(early, 'Europe/London')).toBe('2026-10-02');
  });

  it('treats midnight itself as the night before', () => {
    const midnight = new Date('2026-10-02T00:00:00Z');
    expect(businessDay(midnight, 'Europe/London')).toBe('2026-10-01');
  });

  it('steps back over the start of a month', () => {
    const justAfterMidnight = new Date('2026-10-01T00:20:00Z');
    expect(businessDay(justAfterMidnight, 'Europe/London')).toBe('2026-09-30');
  });

  it('steps back over the start of a year', () => {
    const newYear = new Date('2027-01-01T02:00:00Z');
    expect(businessDay(newYear, 'Europe/London')).toBe('2026-12-31');
  });

  it('is right on the evening a clock goes back', () => {
    // British clocks go back at 02:00 on 25 October 2026. A close that evening
    // is still that evening's close.
    const after = new Date('2026-10-25T19:00:00Z');
    expect(businessDay(after, 'Europe/London')).toBe('2026-10-25');
  });
});
