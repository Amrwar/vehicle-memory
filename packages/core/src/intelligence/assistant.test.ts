import { describe, expect, it } from 'vitest';

import {
  assistantBudget,
  describeExchange,
  draftAllowances,
  type DraftFacts,
  draftMessage,
  estimateCostMinor,
  explainJob,
  type JobStory,
} from './assistant';
import { verifyAgainstFacts } from './summary';

const facts: DraftFacts = {
  customerFirstName: 'Maria',
  vehicle: '2019 Volkswagen Golf',
  registration: 'AB12 CDE',
  odometerKm: 81_200,
  labour: [{ description: 'Front brake pads and discs', hours: 2 }],
  parts: [{ description: 'Front pads', partNumber: 'BP-1234', quantity: 1 }],
  findings: [{ item: 'Rear tyres', severity: 'ADVISORY', note: '3mm' }],
  declined: ['Rear wiper blade'],
  total: '£312.40',
  workshopName: 'Hillside Motors',
  jobNumber: 1042,
  status: 'IN_PROGRESS',
  promisedAt: new Date(2026, 8, 15, 17),
  estimateTotal: '£312.40',
  closesAt: '18:00',
};

describe('draftMessage', () => {
  it('writes a progress update from the job and nothing else', () => {
    const text = draftMessage('PROGRESS', facts);
    expect(text).toMatch(
      /^Hello Maria, Hillside Motors here about your 2019 Volkswagen Golf \(AB12 CDE\)\./,
    );
    expect(text).toContain('front brake pads and discs');
    expect(text).toContain('Tuesday 15 September');
    expect(text).toMatch(/Reply to this message/);
    expect(verifyAgainstFacts(text, facts, draftAllowances(facts)).ok).toBe(true);
  });

  it('asks for a decision with the estimate figure', () => {
    const text = draftMessage('WAITING_ON_APPROVAL', facts);
    expect(text).toContain('estimate for £312.40');
    expect(text).toContain('approve or decline each line');
  });

  it('says the car is ready, what it costs, and what was left', () => {
    const text = draftMessage('READY', facts);
    expect(text).toContain('ready to collect. Job 1042.');
    expect(text).toContain('The total is £312.40.');
    expect(text).toContain('Not done, at your request: Rear wiper blade.');
    expect(text).toContain('here until 18:00');
  });

  it('never invents a figure the job does not have', () => {
    const bare: DraftFacts = {
      ...facts,
      total: null,
      estimateTotal: null,
      promisedAt: null,
      closesAt: null,
      labour: [],
      declined: [],
    };
    for (const kind of ['PROGRESS', 'WAITING_ON_APPROVAL', 'READY'] as const) {
      const text = draftMessage(kind, bare);
      expect(text).not.toMatch(/£/);
      expect(verifyAgainstFacts(text, bare, draftAllowances(bare)).ok).toBe(true);
    }
  });
});

const story: JobStory = {
  jobNumber: 1042,
  status: 'AWAITING_APPROVAL',
  shortDescription: 'Grinding under braking',
  customerName: 'Maria Lopez',
  vehicle: '2019 Volkswagen Golf',
  registration: 'AB12 CDE',
  technician: 'Dani',
  promisedAt: new Date(2026, 8, 10, 17),
  openedAt: new Date(2026, 8, 8, 9),
  estimate: { status: 'SENT', total: '£312.40', sentAt: new Date(2026, 8, 9, 10) },
  partsRequested: 2,
  partsReserved: 1,
  findings: { critical: 1, advisory: 2 },
  invoice: null,
  hoursLogged: 1.5,
};

describe('explainJob', () => {
  const now = new Date(2026, 8, 13, 12);

  it('says where it stands and what it is waiting on first', () => {
    const text = explainJob(story, now);
    expect(text).toMatch(
      /^Job 1042: Maria Lopez's 2019 Volkswagen Golf \(AB12 CDE\), in for "Grinding under braking", is waiting on the customer\./,
    );
    expect(text).toContain(
      'Waiting on: the estimate for £312.40 has been with the customer for 4 days; 2 parts are requested and not on the shelf.',
    );
    expect(text).toContain('1 critical and 2 advisory items');
    expect(text).toContain('Dani has it, with 1.5 hours logged.');
    expect(text).toContain('It was promised for Thursday 10 September, which has passed.');
  });

  it('says when nobody has it and when the money is owed', () => {
    const text = explainJob(
      {
        ...story,
        status: 'INVOICED',
        technician: null,
        partsRequested: 0,
        estimate: null,
        invoice: { number: 'INV-77', status: 'ISSUED', outstanding: '£312.40' },
      },
      now,
    );
    expect(text).toContain('is invoiced and not yet paid.');
    expect(text).not.toContain('Waiting on:');
    expect(text).toContain('Nobody is assigned to it yet.');
    expect(text).toContain('Invoice INV-77 is issued with £312.40 outstanding.');
  });
});

describe('assistantBudget', () => {
  it('allows within the month and refuses beyond it', () => {
    const within = assistantBudget({
      monthlyTokenBudget: 1_000_000,
      usedInputTokens: 400_000,
      usedOutputTokens: 100_000,
    });
    expect(within.allowed).toBe(true);
    expect(within.remaining).toBe(500_000);
    expect(within.statement).toContain('50%');

    const spent = assistantBudget({
      monthlyTokenBudget: 1_000_000,
      usedInputTokens: 900_000,
      usedOutputTokens: 100_000,
    });
    expect(spent.allowed).toBe(false);
    expect(spent.statement).toMatch(/spent/);
  });

  it('treats a zero budget as the model switched off', () => {
    const off = assistantBudget({ monthlyTokenBudget: 0, usedInputTokens: 0, usedOutputTokens: 0 });
    expect(off.allowed).toBe(false);
    expect(off.statement).toMatch(/switched off/);
  });
});

describe('estimateCostMinor', () => {
  it('prices by model, in cents, and defaults sensibly', () => {
    expect(estimateCostMinor(1_000_000, 0, 'claude-sonnet-5')).toBe(300);
    expect(estimateCostMinor(0, 1_000_000, 'claude-haiku-4-5-20251001')).toBe(500);
    expect(estimateCostMinor(3_000, 300, 'claude-sonnet-5')).toBe(1);
    expect(estimateCostMinor(1_000_000, 0, null)).toBe(300);
  });
});

describe('describeExchange', () => {
  it('says what happened to the words', () => {
    expect(
      describeExchange({ kind: 'QUESTION', polished: false, rejected: null, model: null }),
    ).toBe('Answered from the records, plain.');
    expect(
      describeExchange({ kind: 'DRAFT', polished: true, rejected: null, model: 'claude-sonnet-5' }),
    ).toBe('Drafted from the job, tidied by claude-sonnet-5 and checked.');
    expect(
      describeExchange({ kind: 'EXPLAIN', polished: false, rejected: 'budget', model: null }),
    ).toMatch(/not used: budget/);
  });
});
