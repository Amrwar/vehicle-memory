import { describe, expect, it } from 'vitest';

import { assertBalanced } from '../accounting/posting';
import { money, toDecimalString } from '../shared/money';
import {
  accountFor,
  assertApprovable,
  assertSubmittable,
  canTransition,
  describeCategory,
  type Expense,
  ExpenseError,
  expenseTotal,
  netOfReclaim,
  postExpense,
  RECEIPT_REQUIRED_ABOVE_MINOR,
  spreadOverMonths,
  summariseExpenses,
} from './expenses';
import {
  assertClosable,
  autoApplicable,
  canClose,
  closeChecks,
  closeWarnings,
  type LedgerCandidate,
  noStatement,
  PeriodCloseError,
  reconciliationState,
  type BankStatementLine,
  suggestMatches,
} from './reconcile';

const gbp = (major: number) => money(Math.round(major * 100));
const on = (day: number) => new Date(2026, 8, day);

/* ===========================================================================
   Reconciliation
   =========================================================================== */

const STATEMENT: BankStatementLine[] = [
  { id: 's1', at: on(3), description: 'BACS INV-1042', amount: gbp(283.8), reference: 'INV-1042' },
  { id: 's2', at: on(4), description: 'CARD PAYMENT', amount: gbp(120), reference: null },
  { id: 's3', at: on(5), description: 'BANK CHARGES', amount: gbp(-8.5), reference: null },
];

const CANDIDATES: LedgerCandidate[] = [
  {
    id: 'c1',
    at: on(3),
    description: 'Payment for INV-1042',
    amount: gbp(283.8),
    reference: 'INV-1042',
    sourceType: 'Payment',
  },
  {
    id: 'c2',
    at: on(4),
    description: 'Card takings',
    amount: gbp(120),
    reference: 'POS-0001',
    sourceType: 'CounterSale',
  },
  {
    id: 'c3',
    at: on(20),
    description: 'A payment much later',
    amount: gbp(120),
    reference: 'POS-0099',
    sourceType: 'CounterSale',
  },
];

describe('matching a statement', () => {
  it('matches on reference and amount together', () => {
    const matches = suggestMatches(STATEMENT, CANDIDATES);
    const exact = matches.find((match) => match.statementLineId === 's1');

    expect(exact?.candidateId).toBe('c1');
    expect(exact?.confidence).toBe('EXACT');
    expect(exact?.reason).toMatch(/reference INV-1042/);
  });

  it('matches on amount and date when there is no reference', () => {
    const matches = suggestMatches(STATEMENT, CANDIDATES);
    const likely = matches.find((match) => match.statementLineId === 's2');

    expect(likely?.candidateId).toBe('c2');
    expect(likely?.confidence).toBe('LIKELY');
  });

  it('will not match something weeks away on amount alone', () => {
    const matches = suggestMatches([STATEMENT[1]!], [CANDIDATES[2]!]);
    expect(matches).toHaveLength(0);
  });

  it('never uses one ledger entry for two statement lines', () => {
    // Otherwise a reconciliation looks complete while payments are still out.
    const twice: BankStatementLine[] = [
      { ...STATEMENT[1]!, id: 'a' },
      { ...STATEMENT[1]!, id: 'b' },
    ];

    const matches = suggestMatches(twice, [CANDIDATES[1]!]);
    expect(matches).toHaveLength(1);
  });

  it('leaves a bank charge unmatched, because nothing recorded it', () => {
    const matches = suggestMatches(STATEMENT, CANDIDATES);
    expect(matches.some((match) => match.statementLineId === 's3')).toBe(false);
  });

  it('offers a near miss as possible, and says by how much', () => {
    const off: BankStatementLine[] = [{ ...STATEMENT[1]!, amount: gbp(120.5) }];
    const matches = suggestMatches(off, [CANDIDATES[1]!]);

    expect(matches[0]?.confidence).toBe('POSSIBLE');
    expect(matches[0]?.reason).toMatch(/off by 0.50/);
  });

  it('only auto-applies the exact ones', () => {
    // A likely match is usually right, and "usually" is not a standard to
    // reconcile a bank account to.
    const matches = suggestMatches(STATEMENT, CANDIDATES);
    const safe = autoApplicable(matches);

    expect(safe).toHaveLength(1);
    expect(safe[0]?.confidence).toBe('EXACT');
  });

  it('ignores punctuation in a reference', () => {
    const punctuated: BankStatementLine[] = [
      { ...STATEMENT[0]!, reference: 'inv/1042', description: 'anything' },
    ];

    expect(suggestMatches(punctuated, [CANDIDATES[0]!])[0]?.confidence).toBe('EXACT');
  });

  it('will not match a reference that is too short to mean anything', () => {
    const vague: LedgerCandidate[] = [{ ...CANDIDATES[0]!, reference: 'A1' }];
    const line: BankStatementLine[] = [{ ...STATEMENT[0]!, amount: gbp(999) }];

    expect(suggestMatches(line, vague)).toHaveLength(0);
  });
});

describe('where a reconciliation stands', () => {
  it('says so plainly when the two agree', () => {
    const state = reconciliationState({
      statementBalance: gbp(1000),
      ledgerBalance: gbp(1000),
      statement: [],
      candidates: [],
      matches: [],
    });

    expect(state.reconciled).toBe(true);
    expect(state.explanation).toBe('The bank and the ledger agree.');
  });

  it('explains a difference in terms of what is outstanding', () => {
    const matches = suggestMatches(STATEMENT, CANDIDATES);

    const state = reconciliationState({
      statementBalance: gbp(1000),
      ledgerBalance: gbp(1111.5),
      statement: STATEMENT,
      candidates: CANDIDATES,
      matches,
    });

    expect(state.reconciled).toBe(false);
    expect(state.explanation).toMatch(/differ by/);
    expect(state.explanation).toMatch(/not appeared on the statement yet/);
    expect(state.explanation).toMatch(/bank charge, a direct debit/);
  });

  it('lists what is unmatched on each side', () => {
    const matches = suggestMatches(STATEMENT, CANDIDATES);

    const state = reconciliationState({
      statementBalance: gbp(1000),
      ledgerBalance: gbp(1000),
      statement: STATEMENT,
      candidates: CANDIDATES,
      matches,
    });

    expect(state.unmatchedOnStatement.map((line) => line.id)).toEqual(['s3']);
    expect(state.unmatchedInLedger.map((candidate) => candidate.id)).toEqual(['c3']);
  });

  it('has an empty state for an account with no statement', () => {
    expect(noStatement().reconciled).toBe(true);
    expect(noStatement().explanation).toMatch(/No statement/);
  });
});

/* ===========================================================================
   Closing a period
   =========================================================================== */

const HEALTHY = {
  trialBalanced: true,
  unpostedJobs: 0,
  draftInvoices: 0,
  unreconciledBankLines: 0,
  openTills: 0,
  unapprovedTimesheets: 0,
};

describe('closing a period', () => {
  it('allows a close when everything is in order', () => {
    const checks = closeChecks(HEALTHY);

    expect(canClose(checks)).toBe(true);
    expect(() => assertClosable(checks)).not.toThrow();
    expect(closeWarnings(checks)).toHaveLength(0);
  });

  it('refuses to close on an unbalanced trial balance', () => {
    // Closing would make a wrong number permanent.
    const checks = closeChecks({ ...HEALTHY, trialBalanced: false });

    expect(canClose(checks)).toBe(false);
    expect(() => assertClosable(checks)).toThrow(PeriodCloseError);
  });

  it('refuses while completed work is still unbilled', () => {
    const checks = closeChecks({ ...HEALTHY, unpostedJobs: 3 });

    expect(canClose(checks)).toBe(false);
    expect(checks.find((check) => check.label.includes('invoiced'))?.detail).toMatch(
      /belongs in this period/,
    );
  });

  it('refuses while a till is still open', () => {
    // Cash counted after the close lands in the wrong period.
    expect(canClose(closeChecks({ ...HEALTHY, openTills: 1 }))).toBe(false);
  });

  it('warns rather than blocks on an unreconciled bank line', () => {
    // A workshop that always has one stray bank charge should still be able
    // to close its quarter.
    const checks = closeChecks({ ...HEALTHY, unreconciledBankLines: 2 });

    expect(canClose(checks)).toBe(true);
    expect(closeWarnings(checks)).toHaveLength(1);
  });

  it('warns on drafts and unapproved timesheets', () => {
    const checks = closeChecks({ ...HEALTHY, draftInvoices: 2, unapprovedTimesheets: 1 });

    expect(canClose(checks)).toBe(true);
    expect(closeWarnings(checks)).toHaveLength(2);
  });

  it('names every blocking failure in the error', () => {
    const checks = closeChecks({ ...HEALTHY, trialBalanced: false, openTills: 1 });

    try {
      assertClosable(checks);
    } catch (error) {
      expect((error as PeriodCloseError).failures).toHaveLength(2);
      expect((error as Error).message).toMatch(/trial balance/);
    }
  });
});

/* ===========================================================================
   Expenses
   =========================================================================== */

const RENT: Expense = {
  id: 'e1',
  reference: 'EXP-0001',
  category: 'PREMISES',
  status: 'DRAFT',
  supplier: 'Hillside Estates',
  description: 'September rent',
  net: gbp(1450),
  tax: gbp(290),
  incurredAt: on(1),
  paidFrom: 'BANK',
  hasReceipt: true,
  claimedByEmployeeId: null,
};

describe('expenses', () => {
  it('totals net plus tax', () => {
    expect(toDecimalString(expenseTotal(RENT))).toBe('1740.00');
  });

  it('reports what it really cost, after reclaiming the tax', () => {
    // The figure people mean when they ask what something cost, and not the
    // one on the receipt.
    expect(toDecimalString(netOfReclaim(RENT))).toBe('1450.00');
  });

  it('sends premises and utilities to the premises account', () => {
    expect(accountFor('PREMISES')).toBe('6100');
    expect(accountFor('UTILITIES')).toBe('6100');
  });

  it('sends consumables to cost of sales, not overheads', () => {
    // Rags and brake cleaner move with how busy the workshop is; rent does not.
    expect(accountFor('CONSUMABLES')).toBe('5000');
  });

  it('sends everything else to general overheads', () => {
    for (const category of ['INSURANCE', 'MARKETING', 'TRAINING', 'OTHER'] as const) {
      expect(accountFor(category)).toBe('6300');
    }
  });

  it('names every category in words', () => {
    expect(describeCategory('PROFESSIONAL')).toBe('Accountancy and legal');
    expect(describeCategory('SUBSCRIPTIONS')).toBe('Software and subscriptions');
  });
});

describe('submitting an expense', () => {
  it('accepts a complete one', () => {
    expect(() => assertSubmittable(RENT, on(10))).not.toThrow();
  });

  it('refuses one with no amount', () => {
    expect(() => assertSubmittable({ ...RENT, net: gbp(0), tax: gbp(0) }, on(10))).toThrow(
      /needs an amount/,
    );
  });

  it('refuses tax larger than the amount', () => {
    expect(() => assertSubmittable({ ...RENT, tax: gbp(2000) }, on(10))).toThrow(
      /which box on the receipt/,
    );
  });

  it('refuses a date in the future', () => {
    expect(() => assertSubmittable(RENT, on(-5))).toThrow(ExpenseError);
  });

  it('requires a receipt above the threshold', () => {
    // An overhead figure built on remembered amounts cannot be defended.
    expect(() => assertSubmittable({ ...RENT, hasReceipt: false }, on(10))).toThrow(
      /needs a receipt/,
    );
  });

  it('lets a small amount through without one', () => {
    const coffee: Expense = {
      ...RENT,
      net: money(RECEIPT_REQUIRED_ABOVE_MINOR - 200),
      tax: gbp(0),
      hasReceipt: false,
    };

    expect(() => assertSubmittable(coffee, on(10))).not.toThrow();
  });
});

describe('approving an expense', () => {
  it('allows an approver who did not claim it', () => {
    expect(() =>
      assertApprovable({
        status: 'SUBMITTED',
        claimedByEmployeeId: 'emp-1',
        approverEmployeeId: 'emp-2',
      }),
    ).not.toThrow();
  });

  it('refuses somebody approving their own claim', () => {
    // An approval where the claimant is the approver is a form, not a control.
    expect(() =>
      assertApprovable({
        status: 'SUBMITTED',
        claimedByEmployeeId: 'emp-1',
        approverEmployeeId: 'emp-1',
      }),
    ).toThrow(/your own claim/);
  });

  it('refuses to reopen a paid expense, and says what to do instead', () => {
    expect(() =>
      assertApprovable({ status: 'PAID', claimedByEmployeeId: null, approverEmployeeId: 'emp-2' }),
    ).toThrow(/Correct it with a credit/);
  });

  it('follows the transitions', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'PAID')).toBe(true);
    expect(canTransition('DRAFT', 'PAID')).toBe(false);
    expect(canTransition('PAID', 'SUBMITTED')).toBe(false);
  });
});

describe('posting an expense', () => {
  it('balances', () => {
    expect(() => assertBalanced(postExpense(RENT))).not.toThrow();
  });

  it('separates input tax so it can be reclaimed', () => {
    // Posting the gross to overheads overstates costs by a fifth, every
    // month, invisibly.
    const entry = postExpense(RENT);

    expect(entry.lines.find((line) => line.accountCode === '6100')?.debit.minor).toBe(145000);
    expect(entry.lines.find((line) => line.accountCode === '2110')?.debit.minor).toBe(29000);
    expect(entry.lines.find((line) => line.accountCode === '1000')?.credit.minor).toBe(174000);
  });

  it('omits the tax line when there is none', () => {
    const entry = postExpense({ ...RENT, tax: gbp(0) });
    expect(entry.lines.some((line) => line.accountCode === '2110')).toBe(false);
  });

  it('credits cash when it came out of the drawer', () => {
    const entry = postExpense({ ...RENT, paidFrom: 'CASH' });
    expect(entry.lines.find((line) => line.accountCode === '1010')?.credit.minor).toBe(174000);
  });

  it('owes somebody money when they paid it themselves', () => {
    const entry = postExpense({ ...RENT, paidFrom: 'PERSONAL' });
    const owed = entry.lines.find((line) => line.accountCode === '2000');

    expect(owed?.credit.minor).toBe(174000);
    expect(owed?.memo).toMatch(/Owed back/);
  });
});

describe('summarising expenses', () => {
  const set: Expense[] = [
    RENT,
    { ...RENT, id: 'e2', category: 'INSURANCE', net: gbp(300), tax: gbp(0), status: 'SUBMITTED' },
    {
      ...RENT,
      id: 'e3',
      category: 'MARKETING',
      net: gbp(80),
      tax: gbp(16),
      paidFrom: 'PERSONAL',
      claimedByEmployeeId: 'emp-1',
      status: 'APPROVED',
    },
    { ...RENT, id: 'e4', category: 'OTHER', net: gbp(50), tax: gbp(10), status: 'REJECTED' },
    { ...RENT, id: 'e5', category: 'OTHER', net: gbp(90), tax: gbp(0), hasReceipt: false },
  ];

  it('groups by category, largest first', () => {
    const summary = summariseExpenses(set);
    expect(summary.byCategory[0]?.category).toBe('PREMISES');
  });

  it('leaves rejected claims out of the totals', () => {
    const summary = summariseExpenses(set);
    expect(toDecimalString(summary.total)).toBe('2226.00');
  });

  it('adds up the tax that can be reclaimed', () => {
    expect(toDecimalString(summariseExpenses(set).reclaimableTax)).toBe('306.00');
  });

  it('says what is owed back to staff', () => {
    expect(toDecimalString(summariseExpenses(set).owedToStaff)).toBe('96.00');
  });

  it('counts what still needs a receipt and what needs approving', () => {
    const summary = summariseExpenses(set);

    expect(summary.missingReceipts).toBe(1);
    expect(summary.awaitingApproval).toBe(1);
  });

  it('spreads a yearly cost across the months it covers', () => {
    expect(toDecimalString(spreadOverMonths(gbp(1200), 12))).toBe('100.00');
    expect(toDecimalString(spreadOverMonths(gbp(1200), 1))).toBe('1200.00');
  });
});
