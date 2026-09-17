import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';
import {
  amountPaidAgrees,
  auditOf,
  cardBalanceAgrees,
  closedPeriodUntouched,
  describeAudit,
  entryBalances,
  heldAgrees,
  invoiceAddsUp,
  owedAgrees,
  receivableAgrees,
  stockAddsUp,
  unaccountedFor,
  worstFirst,
} from './books';

const gbp = (major: number) => money(Math.round(major * 100));

describe('an entry on its own', () => {
  it('says nothing when it balances', () => {
    expect(entryBalances({ reference: 'INV-1', debits: gbp(120), credits: gbp(120) })).toBeNull();
  });

  it('names the entry and the difference when it does not', () => {
    const breach = entryBalances({ reference: 'INV-1', debits: gbp(120), credits: gbp(100) });

    expect(breach?.sentence).toContain('Entry INV-1');
    expect(breach?.sentence).toContain('£20.00');
    expect(breach?.difference.minor).toBe(2_000);
  });

  it('is checked one entry at a time, so two wrong in opposite directions are both found', () => {
    // The shape a bad migration leaves: a trial balance that sums to zero over
    // two entries that are each wrong.
    const found = [
      entryBalances({ reference: 'A', debits: gbp(100), credits: gbp(90) }),
      entryBalances({ reference: 'B', debits: gbp(90), credits: gbp(100) }),
    ];

    expect(auditOf(2, found).breaches).toHaveLength(2);
  });
});

describe('a bill against the things underneath it', () => {
  it('adds its lines, its tax and what was taken off', () => {
    expect(
      invoiceAddsUp({
        number: 'INV-1041',
        total: gbp(306),
        net: gbp(270),
        tax: gbp(54),
        discount: gbp(18),
      }),
    ).toBeNull();
  });

  it('is a breach when the stored total has drifted from its lines', () => {
    const breach = invoiceAddsUp({
      number: 'INV-1041',
      total: gbp(312),
      net: gbp(270),
      tax: gbp(54),
      discount: gbp(32),
    });

    expect(breach?.sentence).toContain('Invoice INV-1041');
    expect(breach?.difference.minor).toBe(2_000);
  });

  it('reads what is paid from the payments rather than from the running total', () => {
    const breach = amountPaidAgrees({
      number: 'INV-1041',
      amountPaid: gbp(100),
      payments: gbp(140),
    });

    expect(breach).not.toBeNull();
    expect(breach?.sentence).toContain('the payments against it');
  });

  it('checks what is owed against the bill less what was paid and credited', () => {
    expect(
      owedAgrees({
        number: 'INV-1041',
        outstanding: gbp(60),
        total: gbp(300),
        paid: gbp(200),
        credited: gbp(40),
      }),
    ).toBeNull();
  });
});

describe('a penny', () => {
  it('is a breach, because money here is integers and there is no rounding to forgive', () => {
    const breach = invoiceAddsUp({
      number: 'INV-1',
      total: money(30_001),
      net: money(30_000),
      tax: money(0),
      discount: money(0),
    });

    expect(breach?.difference.minor).toBe(1);
  });
});

describe('the things beside the ledger', () => {
  it('checks a shelf against its movements, in units', () => {
    expect(stockAddsUp({ part: '87139-0D070', onHand: 6, movements: 6 })).toBeNull();

    const off = stockAddsUp({ part: '87139-0D070', onHand: 6, movements: 4 });
    expect(off?.sentence).toContain('a difference of 2');
  });

  it('checks a card against what was loaded and spent', () => {
    expect(cardBalanceAgrees({ code: 'ABCD', balance: gbp(40), entries: gbp(40) })).toBeNull();
  });

  it('checks money held against what was taken, used and returned', () => {
    expect(
      heldAgrees({
        reference: 'D-1',
        held: gbp(50),
        taken: gbp(200),
        applied: gbp(120),
        returned: gbp(30),
      }),
    ).toBeNull();
  });

  it('bridges the ledger to the bills it is supposed to describe', () => {
    const breach = receivableAgrees({ ledger: gbp(1_200), invoices: gbp(1_150) });
    expect(breach?.document).toBe('Money owed by customers');
    expect(breach?.difference.minor).toBe(5_000);
  });
});

describe('a period somebody has reported on', () => {
  it('passes when everything was posted before it closed', () => {
    expect(
      closedPeriodUntouched({
        reference: 'INV-1',
        period: '2026 Q1',
        postedAt: new Date('2026-03-30'),
        closedAt: new Date('2026-04-02'),
      }),
    ).toBeNull();
  });

  it('is a violation when something landed after the close, whoever did it', () => {
    const violation = closedPeriodUntouched({
      reference: 'INV-9',
      period: '2026 Q1',
      postedAt: new Date('2026-04-11'),
      closedAt: new Date('2026-04-02'),
    });

    expect(violation?.sentence).toContain('2026-04-11');
    expect(violation?.sentence).toContain('2026-04-02');
  });
});

describe('reading the audit', () => {
  const found = [
    entryBalances({ reference: 'A', debits: gbp(100), credits: gbp(90) }),
    entryBalances({ reference: 'B', debits: gbp(100), credits: gbp(40) }),
    stockAddsUp({ part: 'P', onHand: 2, movements: 1 }),
    null,
  ];

  it('separates a figure that does not add up from a rule that was broken', () => {
    const audit = auditOf(4, found);

    expect(audit.breaches).toHaveLength(2);
    expect(audit.violations).toHaveLength(1);
  });

  it('puts the biggest difference first, because that is where to start', () => {
    const worst = worstFirst(auditOf(4, found).breaches);
    expect(worst[0]?.document).toBe('Entry B');
  });

  it('adds up what is unaccounted for', () => {
    expect(unaccountedFor(auditOf(4, found)).minor).toBe(7_000);
  });

  it('says so plainly when everything agrees', () => {
    expect(describeAudit(auditOf(12, [null, null]))).toBe('12 checked, everything agrees.');
  });

  it('and names the damage when it does not', () => {
    expect(describeAudit(auditOf(4, found))).toContain('3 wrong');
    expect(describeAudit(auditOf(4, found))).toContain('£70.00');
  });
});
