import { ACCOUNT, type JournalEntryDraft } from '../accounting/index';
import { add, type Money, multiply, subtract, zero } from '../shared/money';

/**
 * Money going out that is not a supplier bill.
 *
 * Rent, insurance, the coffee, a part bought from a factor down the road on
 * somebody's own card. Until now these were posted as hand-written journal
 * entries, which works exactly as long as the person writing them knows
 * double-entry. Everybody else either guesses or stops recording them, and a
 * profit figure missing its overheads is worse than no profit figure.
 *
 * So an expense is a document with a category, a receipt and an approver, and
 * the posting is derived rather than typed.
 */

export type ExpenseCategory =
  | 'PREMISES'
  | 'UTILITIES'
  | 'INSURANCE'
  | 'VEHICLE'
  | 'EQUIPMENT'
  | 'CONSUMABLES'
  | 'MARKETING'
  | 'PROFESSIONAL'
  | 'TRAINING'
  | 'SUBSCRIPTIONS'
  | 'OTHER';

export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED';

export type PaidFrom = 'BANK' | 'CASH' | 'PERSONAL' | 'CARD';

export interface Expense {
  id: string;
  reference: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  supplier: string;
  description: string;
  net: Money;
  tax: Money;
  incurredAt: Date;
  paidFrom: PaidFrom;
  /** True when a photograph or PDF of the receipt is attached. */
  hasReceipt: boolean;
  /** Set when somebody spent their own money and is owed it back. */
  claimedByEmployeeId: string | null;
}

export function expenseTotal(expense: Pick<Expense, 'net' | 'tax'>): Money {
  return add(expense.net, expense.tax);
}

/**
 * Which overhead account a category posts to.
 *
 * Deliberately coarse. A chart of accounts with forty overhead lines is one
 * nobody codes consistently, and inconsistent coding makes the comparison
 * between this year and last year meaningless, which is the only thing an
 * overhead figure is for.
 */
export const EXPENSE_ACCOUNT_CODE = ACCOUNT.OVERHEADS;

export function accountFor(category: ExpenseCategory): string {
  switch (category) {
    case 'PREMISES':
    case 'UTILITIES':
      return ACCOUNT.PREMISES;
    // Consumables are used on jobs, so they belong in cost of sales rather
    // than in overheads. Rags and brake cleaner move with how busy the
    // workshop is; the rent does not.
    case 'CONSUMABLES':
      return ACCOUNT.COGS_PARTS;
    default:
      return ACCOUNT.OVERHEADS;
  }
}

export function describeCategory(category: ExpenseCategory): string {
  switch (category) {
    case 'PREMISES':
      return 'Rent and rates';
    case 'UTILITIES':
      return 'Utilities';
    case 'INSURANCE':
      return 'Insurance';
    case 'VEHICLE':
      return 'Vehicles and fuel';
    case 'EQUIPMENT':
      return 'Tools and equipment';
    case 'CONSUMABLES':
      return 'Workshop consumables';
    case 'MARKETING':
      return 'Marketing';
    case 'PROFESSIONAL':
      return 'Accountancy and legal';
    case 'TRAINING':
      return 'Training';
    case 'SUBSCRIPTIONS':
      return 'Software and subscriptions';
    case 'OTHER':
      return 'Other';
  }
}

/* ---------------------------------------------------------------------------
   Approval
   --------------------------------------------------------------------------- */

export class ExpenseError extends Error {
  readonly code:
    'NO_RECEIPT' | 'BAD_TRANSITION' | 'SELF_APPROVAL' | 'ZERO' | 'FUTURE' | 'TAX_EXCEEDS_NET';

  constructor(code: ExpenseError['code'], message: string) {
    super(message);
    this.name = 'ExpenseError';
    this.code = code;
  }
}

const TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['PAID', 'SUBMITTED'],
  // Terminal. A paid expense is corrected by a credit, not by an edit.
  PAID: [],
  REJECTED: ['DRAFT'],
};

export function canTransition(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Above this, a receipt is required rather than encouraged. */
export const RECEIPT_REQUIRED_ABOVE_MINOR = 2500;

/**
 * Whether an expense can be submitted for approval.
 *
 * The receipt threshold is the rule most likely to be resented and the one
 * most worth keeping: an overhead figure built on remembered amounts cannot be
 * defended to anybody, and the person who has to defend it is not the person
 * who skipped the photograph.
 */
export function assertSubmittable(expense: Expense, now: Date = new Date()): void {
  const total = expenseTotal(expense);

  if (total.minor <= 0) {
    throw new ExpenseError('ZERO', 'An expense needs an amount.');
  }

  if (expense.tax.minor > expense.net.minor) {
    throw new ExpenseError(
      'TAX_EXCEEDS_NET',
      'The tax is more than the amount. Check which box on the receipt is which.',
    );
  }

  if (expense.incurredAt > now) {
    throw new ExpenseError('FUTURE', 'An expense cannot be dated in the future.');
  }

  if (!expense.hasReceipt && total.minor > RECEIPT_REQUIRED_ABOVE_MINOR) {
    throw new ExpenseError(
      'NO_RECEIPT',
      `Anything over ${(RECEIPT_REQUIRED_ABOVE_MINOR / 100).toFixed(2)} needs a receipt attached.`,
    );
  }
}

/**
 * Whether somebody may approve this.
 *
 * Not their own. An approval workflow where the claimant is also the approver
 * is a form, not a control, and the first time it matters is the first time
 * somebody is tempted.
 */
export function assertApprovable(input: {
  status: ExpenseStatus;
  claimedByEmployeeId: string | null;
  approverEmployeeId: string | null;
}): void {
  if (!canTransition(input.status, 'APPROVED')) {
    throw new ExpenseError(
      'BAD_TRANSITION',
      input.status === 'PAID'
        ? 'This expense has been paid. Correct it with a credit rather than by editing it.'
        : `An expense that is ${input.status.toLowerCase()} cannot be approved.`,
    );
  }

  if (
    input.claimedByEmployeeId !== null &&
    input.claimedByEmployeeId === input.approverEmployeeId
  ) {
    throw new ExpenseError('SELF_APPROVAL', 'You cannot approve your own claim.');
  }
}

/* ---------------------------------------------------------------------------
   Posting
   --------------------------------------------------------------------------- */

/**
 * Posts an expense.
 *
 * Input tax is separated so it can be reclaimed. Posting the gross to
 * overheads is the most common mistake in a small set of books and it
 * overstates costs by a fifth, every month, invisibly.
 *
 * An expense somebody paid personally credits a liability rather than the
 * bank, because the business owes them until it pays them back.
 */
export function postExpense(expense: Expense): JournalEntryDraft {
  const currency = expense.net.currency;
  const total = expenseTotal(expense);

  const creditAccount =
    expense.paidFrom === 'CASH'
      ? ACCOUNT.CASH
      : expense.paidFrom === 'PERSONAL'
        ? ACCOUNT.PAYABLE
        : ACCOUNT.BANK;

  const lines: JournalEntryDraft['lines'] = [
    {
      accountCode: accountFor(expense.category),
      debit: expense.net,
      credit: zero(currency),
      memo: `${describeCategory(expense.category)}: ${expense.supplier}`,
    },
  ];

  if (expense.tax.minor > 0) {
    lines.push({
      accountCode: ACCOUNT.TAX_RECEIVABLE,
      debit: expense.tax,
      credit: zero(currency),
      memo: 'Input tax, reclaimable',
    });
  }

  lines.push({
    accountCode: creditAccount,
    debit: zero(currency),
    credit: total,
    memo:
      expense.paidFrom === 'PERSONAL'
        ? 'Owed back to whoever paid it'
        : `Paid from ${expense.paidFrom.toLowerCase()}`,
  });

  return {
    reference: expense.reference,
    description: expense.description || describeCategory(expense.category),
    sourceType: 'Expense',
    sourceId: expense.id,
    postedAt: expense.incurredAt,
    lines,
  };
}

/* ---------------------------------------------------------------------------
   Reading a set of expenses
   --------------------------------------------------------------------------- */

export interface ExpenseSummary {
  byCategory: { category: ExpenseCategory; label: string; total: Money; count: number }[];
  total: Money;
  reclaimableTax: Money;
  /** Claims from people who are owed their money back. */
  owedToStaff: Money;
  missingReceipts: number;
  awaitingApproval: number;
}

export function summariseExpenses(expenses: readonly Expense[], currency = 'GBP'): ExpenseSummary {
  const byCategory = new Map<ExpenseCategory, { total: Money; count: number }>();
  let total = zero(currency);
  let tax = zero(currency);
  let owed = zero(currency);

  for (const expense of expenses) {
    if (expense.status === 'REJECTED') continue;

    const amount = expenseTotal(expense);
    const existing = byCategory.get(expense.category) ?? { total: zero(currency), count: 0 };

    byCategory.set(expense.category, {
      total: add(existing.total, amount),
      count: existing.count + 1,
    });

    total = add(total, amount);
    tax = add(tax, expense.tax);

    if (expense.paidFrom === 'PERSONAL' && expense.status !== 'PAID') {
      owed = add(owed, amount);
    }
  }

  return {
    byCategory: [...byCategory.entries()]
      .map(([category, value]) => ({
        category,
        label: describeCategory(category),
        total: value.total,
        count: value.count,
      }))
      .sort((a, b) => b.total.minor - a.total.minor),
    total,
    reclaimableTax: tax,
    owedToStaff: owed,
    missingReceipts: expenses.filter(
      (expense) =>
        !expense.hasReceipt &&
        expense.status !== 'REJECTED' &&
        expenseTotal(expense).minor > RECEIPT_REQUIRED_ABOVE_MINOR,
    ).length,
    awaitingApproval: expenses.filter((expense) => expense.status === 'SUBMITTED').length,
  };
}

/**
 * What an expense costs the business after tax is reclaimed.
 *
 * The figure people mean when they ask what something cost, and not the one on
 * the receipt.
 */
export function netOfReclaim(expense: Expense): Money {
  return subtract(expenseTotal(expense), expense.tax);
}

/** Apportions a yearly cost across the months it covers. */
export function spreadOverMonths(amount: Money, months: number): Money {
  return months <= 1 ? amount : multiply(amount, 1 / months);
}
