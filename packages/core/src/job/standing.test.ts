import { describe, expect, it } from 'vitest';

import { type JobFacts, jobsWorstFirst, needsSomebody, standingOfJob } from './standing';

const now = new Date('2026-09-28T14:00:00Z');
const at = (iso: string) => new Date(iso);

function facts(over: Partial<JobFacts> = {}): JobFacts {
  return { status: 'RECEIVED', since: at('2026-09-28T13:00:00Z'), now, ...over };
}

describe('whose move it is', () => {
  it('is ours when the car is here and nothing has started', () => {
    const standing = standingOfJob(facts());
    expect(standing.move).toBe('us');
    expect(standing.next?.key).toBe('Start the inspection');
    expect(standing.minutes).toBe(60);
  });

  // The example the plan is written around.
  it('is the customer’s when an estimate is out, and says whether they looked', () => {
    const unopened = standingOfJob(
      facts({
        status: 'AWAITING_APPROVAL',
        since: at('2026-09-28T11:46:00Z'),
        estimate: { total: 843.2, sentAt: at('2026-09-28T11:42:00Z'), openedAt: null },
      }),
    );

    expect(unopened.move).toBe('customer');
    expect(unopened.minutes).toBe(134);
    expect(unopened.reason.key).toContain('not opened');
    expect(unopened.reason.vars).toEqual({ amount: 843.2 });
    expect(unopened.next?.key).toBe('Send a reminder');
  });

  it('and asks for a telephone call once they have opened it and not answered', () => {
    const opened = standingOfJob(
      facts({
        status: 'AWAITING_APPROVAL',
        estimate: {
          total: 843.2,
          sentAt: at('2026-09-28T11:42:00Z'),
          openedAt: at('2026-09-28T11:50:00Z'),
        },
      }),
    );

    expect(opened.next?.key).toBe('Ring them');
  });

  // The case that makes the whole thing worth having: a job sitting in
  // "awaiting approval" that nobody ever sent.
  it('is ours when a job waits for approval of an estimate never sent', () => {
    const standing = standingOfJob(
      facts({
        status: 'AWAITING_APPROVAL',
        estimate: { total: 843.2, sentAt: null, openedAt: null },
      }),
    );

    expect(standing.move).toBe('us');
    expect(standing.next?.key).toBe('Send the estimate');
  });

  it('is the supplier’s when parts are outstanding, whatever else is true', () => {
    const standing = standingOfJob(
      facts({ status: 'IN_PROGRESS', partsOutstanding: 2, somebodyOn: true }),
    );

    expect(standing.move).toBe('supplier');
    expect(standing.reason.vars).toEqual({ count: 2 });
  });

  it('names the date when the supplier gave one, and says so when they did not', () => {
    const dated = standingOfJob(
      facts({ status: 'APPROVED', partsOutstanding: 1, partsDueAt: at('2026-09-29T09:00:00Z') }),
    );
    const undated = standingOfJob(facts({ status: 'APPROVED', partsOutstanding: 1 }));

    expect(dated.reason.key).toContain('{date}');
    expect(undated.reason.key).toContain('no date');
  });

  it('is nobody’s once the car is paid for and gone', () => {
    const standing = standingOfJob(
      facts({ status: 'PAID', collectedAt: at('2026-09-28T12:00:00Z') }),
    );

    expect(standing.move).toBe('nobody');
    expect(standing.next).toBeNull();
    expect(needsSomebody(standing)).toBe(false);
  });

  it('is still somebody’s when it is paid and the car has not gone', () => {
    const standing = standingOfJob(facts({ status: 'PAID' }));
    expect(standing.move).toBe('customer');
    expect(standing.next?.key).toBe('Tell them it is ready');
  });

  it('holds a finished job back when the check it needs has not been done', () => {
    const standing = standingOfJob(
      facts({ status: 'COMPLETED', qualityCheckRequired: true, qualityCheckDone: false }),
    );

    expect(standing.next?.key).toBe('Do the check');
  });

  it('and lets it through when the check is done', () => {
    const standing = standingOfJob(
      facts({ status: 'COMPLETED', qualityCheckRequired: true, qualityCheckDone: true }),
    );

    expect(standing.next?.key).toBe('Raise the invoice');
  });
});

describe('late', () => {
  it('is past the promise and not finished', () => {
    expect(
      standingOfJob(facts({ status: 'IN_PROGRESS', promisedAt: at('2026-09-28T12:00:00Z') })).late,
    ).toBe(true);
  });

  it('is not late once it is finished, however long it took', () => {
    expect(
      standingOfJob(facts({ status: 'COMPLETED', promisedAt: at('2026-09-20T12:00:00Z') })).late,
    ).toBe(false);
  });

  it('is not late when nothing was promised', () => {
    expect(standingOfJob(facts({ status: 'IN_PROGRESS' })).late).toBe(false);
  });
});

describe('worst first', () => {
  const job = (move: 'us' | 'customer' | 'supplier' | 'nobody', minutes: number, late = false) => ({
    standing: { move, minutes, late, reason: { key: '', vars: {} }, next: null },
  });

  it('puts late before everything', () => {
    const sorted = jobsWorstFirst([job('us', 10), job('customer', 5, true)]);
    expect(sorted[0]!.standing.move).toBe('customer');
  });

  // Ours first, because those are the ones the morning can change.
  it('then ours before theirs', () => {
    const sorted = jobsWorstFirst([job('customer', 600), job('supplier', 400), job('us', 5)]);
    expect(sorted.map((one) => one.standing.move)).toEqual(['us', 'supplier', 'customer']);
  });

  it('then longest waiting first', () => {
    const sorted = jobsWorstFirst([job('us', 10), job('us', 400)]);
    expect(sorted[0]!.standing.minutes).toBe(400);
  });

  it('leaves the finished ones at the bottom', () => {
    const sorted = jobsWorstFirst([job('nobody', 9000), job('us', 1)]);
    expect(sorted.at(-1)!.standing.move).toBe('nobody');
  });
});
