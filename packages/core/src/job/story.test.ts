import { describe, expect, it } from 'vitest';

import {
  dayOf,
  howTheStoryReads,
  inTheOrderItHappened,
  spanOf,
  type StoryEntry,
  tellTheStory,
} from './story';

const at = (iso: string) => new Date(iso);

function entry(partial: Partial<StoryEntry> & Pick<StoryEntry, 'id' | 'at' | 'kind'>): StoryEntry {
  return { side: 'us', who: null, what: { key: partial.kind }, ...partial };
}

describe('inTheOrderItHappened', () => {
  it('orders by time, and in the same instant by what would have happened first', () => {
    const ordered = inTheOrderItHappened([
      entry({ id: 'n', at: at('2026-10-01T09:00:00Z'), kind: 'note' }),
      entry({ id: 's', at: at('2026-10-01T09:00:00Z'), kind: 'status' }),
      entry({ id: 'o', at: at('2026-10-01T08:00:00Z'), kind: 'opened' }),
      entry({ id: 'c', at: at('2026-10-01T09:00:00Z'), kind: 'checked-in' }),
    ]);
    expect(ordered.map((one) => one.id)).toEqual(['o', 'c', 's', 'n']);
  });

  it('is stable on identical entries, by id', () => {
    const ordered = inTheOrderItHappened([
      entry({ id: 'b', at: at('2026-10-01T09:00:00Z'), kind: 'note' }),
      entry({ id: 'a', at: at('2026-10-01T09:00:00Z'), kind: 'note' }),
    ]);
    expect(ordered.map((one) => one.id)).toEqual(['a', 'b']);
  });
});

describe('tellTheStory', () => {
  const entries: StoryEntry[] = [
    entry({ id: '1', at: at('2026-09-28T08:05:00Z'), kind: 'opened', who: 'Ahmed' }),
    entry({ id: '2', at: at('2026-09-28T08:20:00Z'), kind: 'checked-in', who: 'Ahmed' }),
    entry({ id: '3', at: at('2026-09-28T10:00:00Z'), kind: 'estimate-sent', who: 'Ahmed' }),
    entry({ id: '4', at: at('2026-09-28T10:00:30Z'), kind: 'message-out', side: 'system' }),
    entry({ id: '5', at: at('2026-10-01T14:00:00Z'), kind: 'message-in', side: 'customer' }),
    entry({ id: '6', at: at('2026-10-01T14:10:00Z'), kind: 'estimate-decided', side: 'customer' }),
    entry({ id: '7', at: at('2026-10-01T15:00:00Z'), kind: 'message-out', who: 'Ahmed' }),
  ];

  it('breaks the story into the workshop’s days', () => {
    const story = tellTheStory(entries, 'Europe/London');
    expect(story.days.map((day) => [day.day, day.entries.length])).toEqual([
      ['2026-09-28', 4],
      ['2026-10-01', 3],
    ]);
  });

  it('uses the workshop’s zone for the day, not UTC', () => {
    const late = [entry({ id: 'x', at: at('2026-09-30T23:30:00Z'), kind: 'note' })];
    expect(tellTheStory(late, 'Europe/London').days[0]?.day).toBe('2026-10-01');
    expect(tellTheStory(late, 'UTC').days[0]?.day).toBe('2026-09-30');
  });

  it('finds the silence and says what was last done before it', () => {
    const story = tellTheStory(entries, 'Europe/London');
    expect(story.silences).toHaveLength(1);
    expect(story.silences[0]?.after.id).toBe('4');
    expect(story.silences[0]?.minutes).toBe(3 * 24 * 60 + 4 * 60);
    expect(story.summary.longestSilence?.after.kind).toBe('message-out');
  });

  it('does not call lunch a silence', () => {
    const story = tellTheStory(entries.slice(0, 4), 'Europe/London');
    expect(story.silences).toEqual([]);
    expect(story.summary.longestSilence).toBeNull();
  });

  it('counts what a reader of a complaint wants counted', () => {
    const { summary } = tellTheStory(entries, 'Europe/London');
    expect(summary).toMatchObject({
      moments: 7,
      byUs: 4,
      byCustomer: 2,
      bySystem: 1,
      messagesOut: 2,
      messagesIn: 1,
    });
    expect(summary.first?.toISOString()).toBe('2026-09-28T08:05:00.000Z');
    expect(summary.last?.toISOString()).toBe('2026-10-01T15:00:00.000Z');
  });

  it('tells an empty story plainly', () => {
    const story = tellTheStory([], 'Europe/London');
    expect(story.days).toEqual([]);
    expect(story.summary.moments).toBe(0);
    expect(howTheStoryReads(story.summary)).toEqual({
      key: 'Nothing has happened on this job yet.',
    });
  });

  it('says the sentence at the top with the counts in it', () => {
    const { summary } = tellTheStory(entries, 'Europe/London');
    expect(howTheStoryReads(summary)).toEqual({
      key: '{moments} moments over {span}: {us} by the workshop, {customer} by the customer, {system} by the product on its own.',
      vars: { moments: 7, span: '3d', us: 4, customer: 2, system: 1 },
    });
  });
});

describe('the small words', () => {
  it('says a span the way somebody does', () => {
    expect(spanOf(40)).toBe('40m');
    expect(spanOf(6 * 60 + 20)).toBe('6h');
    expect(spanOf(3 * 24 * 60 + 11 * 60)).toBe('3d');
  });

  it('reads a day off a zone', () => {
    expect(dayOf(at('2026-10-01T02:00:00Z'), 'America/New_York')).toBe('2026-09-30');
  });
});
