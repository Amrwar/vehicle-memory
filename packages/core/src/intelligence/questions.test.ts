import { describe, expect, it } from 'vitest';

import {
  COVERAGE,
  describePeriod,
  parseQuestion,
  periodBounds,
  periodIn,
  refusal,
} from './questions';

describe('parseQuestion', () => {
  it('recognises every example it advertises', () => {
    for (const entry of COVERAGE) {
      expect(parseQuestion(entry.example), entry.example).not.toBeNull();
    }
  });

  it('hears revenue in the words an owner uses', () => {
    expect(parseQuestion('What did we take this month?')).toEqual({
      kind: 'REVENUE',
      period: 'month',
      breakdown: false,
    });
    expect(parseQuestion('turnover last month by service type')).toEqual({
      kind: 'REVENUE',
      period: 'last-month',
      breakdown: true,
    });
  });

  it('tells who owes us from what we owe', () => {
    expect(parseQuestion('Who owes us money?')).toEqual({ kind: 'OUTSTANDING' });
    expect(parseQuestion('What do we owe suppliers?')).toEqual({ kind: 'OWED_TO_SUPPLIERS' });
    expect(parseQuestion('any overdue invoices?')).toEqual({ kind: 'OVERDUE_INVOICES' });
  });

  it('reads profit, wages and cash as their own questions', () => {
    expect(parseQuestion('How profitable were we last month?')).toEqual({
      kind: 'PROFIT',
      period: 'last-month',
    });
    expect(parseQuestion('what did wages cost this year')).toEqual({
      kind: 'WAGES',
      period: 'year',
    });
    expect(parseQuestion('how much cash came in today')).toEqual({
      kind: 'CASH_TAKEN',
      period: 'today',
    });
  });

  it('reads the shop floor', () => {
    expect(parseQuestion('how many cars are in the shop')).toEqual({ kind: 'JOBS_IN_SHOP' });
    expect(parseQuestion('what is waiting on customers')).toEqual({ kind: 'AWAITING_APPROVAL' });
    expect(parseQuestion('what is our stock worth')).toEqual({ kind: 'STOCK_VALUE' });
  });

  it('reads customers and services', () => {
    expect(parseQuestion('who are our best customers this year')).toEqual({
      kind: 'TOP_CUSTOMERS',
      period: 'year',
    });
    expect(parseQuestion("which customers haven't we seen for a while")).toEqual({
      kind: 'LAPSED_CUSTOMERS',
    });
    expect(parseQuestion('which vehicles are due a service')).toEqual({ kind: 'DUE_SOON' });
  });

  it('refuses what it does not know rather than guessing', () => {
    // Fluent nonsense is the failure mode this exists to avoid.
    expect(parseQuestion('should we buy a second ramp')).toBeNull();
    expect(parseQuestion('what is the weather')).toBeNull();
    expect(parseQuestion('')).toBeNull();
  });
});

describe('periodIn and periodBounds', () => {
  it('finds the period in the sentence, or falls back', () => {
    expect(periodIn('revenue last month', 'month')).toBe('last-month');
    expect(periodIn('revenue ytd', 'month')).toBe('year');
    expect(periodIn('revenue', 'month')).toBe('month');
  });

  it('bounds last month to its own calendar month', () => {
    const now = new Date(2026, 8, 12, 10, 0, 0);
    const { from, to } = periodBounds('last-month', now);
    expect(from.getMonth()).toBe(7);
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(7);
    expect(to.getDate()).toBe(31);
  });

  it('starts the week on Monday', () => {
    const wednesday = new Date(2026, 8, 9, 12, 0, 0);
    expect(periodBounds('week', wednesday).from.getDay()).toBe(1);
  });

  it('names the period for a headline', () => {
    const now = new Date(2026, 8, 12);
    expect(describePeriod('month', now)).toBe('September 2026');
    expect(describePeriod('last-month', now)).toBe('August 2026');
    expect(describePeriod('quarter', now)).toBe('Q3 2026 to date');
  });
});

describe('refusal', () => {
  it('quotes the question and says what it can do instead', () => {
    const text = refusal('should we buy a second ramp');
    expect(text).toContain('"should we buy a second ramp"');
    expect(text).toContain('does not guess');
  });
});
