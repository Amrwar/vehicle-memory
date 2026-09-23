import { describe, expect, it } from 'vitest';

import {
  assertLendable,
  clashes,
  CourtesyError,
  daysOverdue,
  describeLoan,
  freeOver,
  lapsesDuring,
  type Loan,
  outNow,
  overdueCount,
  loanStanding,
  windowOf,
} from './courtesy';

const at = (iso: string) => new Date(iso);

const loan = (over: Partial<Loan> & { id: string; vehicleId: string }): Loan => ({
  startAt: at('2026-09-21T09:00:00Z'),
  dueBackAt: at('2026-09-23T17:00:00Z'),
  returnedAt: null,
  ...over,
});

const WEDNESDAY = at('2026-09-23T10:00:00Z');

describe('the period a car is gone for', () => {
  it('is what it was promised for, until it comes back', () => {
    expect(windowOf(loan({ id: 'a', vehicleId: 'fiesta' })).endAt).toEqual(
      at('2026-09-23T17:00:00Z'),
    );
  });

  it('shrinks when somebody brings it back early, freeing the afternoon', () => {
    const early = loan({ id: 'a', vehicleId: 'fiesta', returnedAt: at('2026-09-22T11:00:00Z') });
    expect(windowOf(early).endAt).toEqual(at('2026-09-22T11:00:00Z'));
  });

  it('stretches when they do not, which is the next customer’s problem', () => {
    const late = loan({ id: 'a', vehicleId: 'fiesta', returnedAt: at('2026-09-25T11:00:00Z') });
    expect(windowOf(late).endAt).toEqual(at('2026-09-25T11:00:00Z'));
  });
});

describe('where a loan stands', () => {
  it('tells promised, out, overdue and back apart', () => {
    expect(loanStanding(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-20T09:00:00Z'))).toBe(
      'BOOKED',
    );
    expect(loanStanding(loan({ id: 'a', vehicleId: 'f' }), WEDNESDAY)).toBe('OUT');
    expect(loanStanding(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-26T09:00:00Z'))).toBe(
      'OVERDUE',
    );
    expect(
      loanStanding(loan({ id: 'a', vehicleId: 'f', returnedAt: WEDNESDAY }), at('2026-09-30')),
    ).toBe('BACK');
  });

  it('avoids bare words another page has already claimed', () => {
    // "Out" is the ledger's, "Back" is the navigation's. Both exist in the
    // dictionary with the wrong meaning for a car.
    const sayings = [
      describeLoan(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-20T09:00:00Z')),
      describeLoan(loan({ id: 'a', vehicleId: 'f' }), WEDNESDAY),
      describeLoan(loan({ id: 'a', vehicleId: 'f', returnedAt: WEDNESDAY }), at('2026-09-30')),
    ];

    expect(sayings).not.toContain('Out');
    expect(sayings).not.toContain('Back');
  });

  it('says how overdue, in words', () => {
    expect(describeLoan(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-24T18:00:00Z'))).toBe(
      '1 day overdue',
    );
    expect(describeLoan(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-27T18:00:00Z'))).toBe(
      '4 days overdue',
    );
    expect(daysOverdue(loan({ id: 'a', vehicleId: 'f' }), WEDNESDAY)).toBe(0);
  });

  it('never says "1 days"', () => {
    expect(
      describeLoan(loan({ id: 'a', vehicleId: 'f' }), at('2026-09-24T18:00:00Z')),
    ).not.toContain('1 days');
  });
});

describe('the same car promised twice', () => {
  const existing = [
    loan({ id: 'a', vehicleId: 'fiesta' }),
    loan({
      id: 'b',
      vehicleId: 'corsa',
      startAt: at('2026-09-28T09:00:00Z'),
      dueBackAt: at('2026-09-29T17:00:00Z'),
    }),
  ];

  it('is a clash when the days touch', () => {
    const wanted = { startAt: at('2026-09-22T09:00:00Z'), endAt: at('2026-09-24T17:00:00Z') };
    expect(clashes(existing, 'fiesta', wanted).map((one) => one.id)).toEqual(['a']);
  });

  it('is not a clash for a different car', () => {
    const wanted = { startAt: at('2026-09-22T09:00:00Z'), endAt: at('2026-09-24T17:00:00Z') };
    expect(clashes(existing, 'corsa', wanted)).toHaveLength(0);
  });

  it('is not a clash once the car is back', () => {
    const back = [loan({ id: 'a', vehicleId: 'fiesta', returnedAt: at('2026-09-22T09:00:00Z') })];
    const wanted = { startAt: at('2026-09-22T10:00:00Z'), endAt: at('2026-09-24T17:00:00Z') };
    expect(clashes(back, 'fiesta', wanted)).toHaveLength(0);
  });

  it('is not a clash when one ends exactly as the other begins', () => {
    const wanted = { startAt: at('2026-09-23T17:00:00Z'), endAt: at('2026-09-25T17:00:00Z') };
    expect(clashes(existing, 'fiesta', wanted)).toHaveLength(0);
  });

  it('leaves the free cars', () => {
    const fleet = [{ vehicleId: 'fiesta' }, { vehicleId: 'corsa' }, { vehicleId: 'up' }];
    const wanted = { startAt: at('2026-09-22T09:00:00Z'), endAt: at('2026-09-24T17:00:00Z') };
    expect(freeOver(fleet, existing, wanted).map((one) => one.vehicleId)).toEqual(['corsa', 'up']);
  });
});

describe('whether it is legal to lend', () => {
  const wanted = { startAt: at('2026-09-21T09:00:00Z'), endAt: at('2026-09-25T17:00:00Z') };

  it('names what runs out while they have it', () => {
    const papers = [
      { kind: 'MOT_CERTIFICATE', expiresAt: at('2026-09-24T00:00:00Z') },
      { kind: 'INSURANCE', expiresAt: at('2027-01-01T00:00:00Z') },
    ];

    expect(lapsesDuring(papers, wanted)).toEqual([
      { what: 'Its MOT', expiresAt: at('2026-09-24T00:00:00Z') },
    ]);
  });

  it('counts the last day, because a certificate that runs out on Friday does not cover Friday', () => {
    const papers = [{ kind: 'MOT_CERTIFICATE', expiresAt: at('2026-09-25T17:00:00Z') }];
    expect(lapsesDuring(papers, wanted)).toHaveLength(1);
  });

  it('says nothing about a car whose papers nobody uploaded', () => {
    // Not "illegal". Unknown. A refusal here would be clicked past within a
    // week, and then the real one is clicked past too.
    expect(lapsesDuring([], wanted)).toHaveLength(0);
    expect(lapsesDuring([{ kind: 'MOT_CERTIFICATE', expiresAt: null }], wanted)).toHaveLength(0);
  });

  it('ignores papers that are not about being allowed on the road', () => {
    const papers = [{ kind: 'PURCHASE_INVOICE', expiresAt: at('2026-09-22T00:00:00Z') }];
    expect(lapsesDuring(papers, wanted)).toHaveLength(0);
  });
});

describe('lending one', () => {
  const wanted = { startAt: at('2026-09-21T09:00:00Z'), endAt: at('2026-09-23T17:00:00Z') };

  it('refuses a car already promised', () => {
    expect(() =>
      assertLendable({
        wanted,
        existing: [loan({ id: 'a', vehicleId: 'fiesta' })],
        vehicleId: 'fiesta',
        papers: [],
      }),
    ).toThrow(CourtesyError);
  });

  it('refuses one whose MOT runs out first, and says which', () => {
    expect(() =>
      assertLendable({
        wanted,
        existing: [],
        vehicleId: 'fiesta',
        papers: [{ kind: 'MOT_CERTIFICATE', expiresAt: at('2026-09-22T00:00:00Z') }],
      }),
    ).toThrow(/MOT/);
  });

  it('refuses a period that runs backwards', () => {
    expect(() =>
      assertLendable({
        wanted: { startAt: wanted.endAt, endAt: wanted.startAt },
        existing: [],
        vehicleId: 'fiesta',
        papers: [],
      }),
    ).toThrow(/come back after/);
  });

  it('allows one that is free and in date', () => {
    expect(() =>
      assertLendable({
        wanted,
        existing: [loan({ id: 'a', vehicleId: 'corsa' })],
        vehicleId: 'fiesta',
        papers: [{ kind: 'MOT_CERTIFICATE', expiresAt: at('2027-06-01T00:00:00Z') }],
      }),
    ).not.toThrow();
  });
});

describe('what is out', () => {
  const loans = [
    loan({ id: 'a', vehicleId: 'fiesta' }),
    loan({
      id: 'b',
      vehicleId: 'corsa',
      startAt: at('2026-09-18T09:00:00Z'),
      dueBackAt: at('2026-09-19T17:00:00Z'),
    }),
    loan({ id: 'c', vehicleId: 'up', returnedAt: at('2026-09-22T09:00:00Z') }),
  ];

  it('lists what has not come back, soonest due first', () => {
    expect(outNow(loans, WEDNESDAY).map((one) => one.id)).toEqual(['b', 'a']);
  });

  it('counts the late ones', () => {
    expect(overdueCount(loans, WEDNESDAY)).toBe(1);
  });
});
