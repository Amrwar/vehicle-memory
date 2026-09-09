import {
  assertApprovable,
  assertClosable,
  assertSubmittable,
  closeChecks,
  type Expense,
  type ExpenseCategory,
  type ExpenseError,
  fromDecimal,
  type LedgerCandidate,
  postExpense,
  reconciliationState,
  type BankStatementLine,
  suggestMatches,
  summariseExpenses,
  toNumber,
  trialBalance,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postedLines, postEntry } from './accounting';
import { audit } from './guard';

/**
 * Expenses and the bank, against the database.
 *
 * Two jobs. Recording money that leaves without a supplier bill behind it, and
 * proving that what the ledger says matches what the bank says. The second is
 * what turns a set of books from internally consistent into correct.
 */

const decimal = (value: unknown, currency = 'GBP') => fromDecimal(String(value ?? 0), currency);

/* ---------------------------------------------------------------------------
   Expenses
   --------------------------------------------------------------------------- */

function toDomain(row: {
  id: string;
  reference: string;
  category: string;
  status: string;
  supplier: string;
  description: string | null;
  net: unknown;
  tax: unknown;
  incurredAt: Date;
  paidFrom: string;
  receiptUrl: string | null;
  claimedByEmployeeId: string | null;
}): Expense {
  return {
    id: row.id,
    reference: row.reference,
    category: row.category as ExpenseCategory,
    status: row.status as Expense['status'],
    supplier: row.supplier,
    description: row.description ?? '',
    net: decimal(row.net),
    tax: decimal(row.tax),
    incurredAt: row.incurredAt,
    paidFrom: row.paidFrom as Expense['paidFrom'],
    hasReceipt: Boolean(row.receiptUrl),
    claimedByEmployeeId: row.claimedByEmployeeId,
  };
}

export async function recordExpense(input: {
  orgId: string;
  userId: string;
  locationId: string | null;
  category: ExpenseCategory;
  supplier: string;
  description: string;
  net: number;
  tax: number;
  incurredAt: Date;
  paidFrom: Expense['paidFrom'];
  receiptUrl?: string | null;
  claimedByEmployeeId?: string | null;
}): Promise<{ ok: boolean; error?: string; expenseId?: string }> {
  const count = await prisma.expense.count({ where: { orgId: input.orgId } });
  const reference = `EXP-${String(count + 1).padStart(4, '0')}`;

  const draft: Expense = {
    id: 'pending',
    reference,
    category: input.category,
    status: 'DRAFT',
    supplier: input.supplier.trim(),
    description: input.description.trim(),
    net: { minor: Math.round(input.net * 100), currency: 'GBP' },
    tax: { minor: Math.round(input.tax * 100), currency: 'GBP' },
    incurredAt: input.incurredAt,
    paidFrom: input.paidFrom,
    hasReceipt: Boolean(input.receiptUrl),
    claimedByEmployeeId: input.claimedByEmployeeId ?? null,
  };

  try {
    assertSubmittable(draft);
  } catch (error) {
    return { ok: false, error: (error as ExpenseError).message };
  }

  const expense = await prisma.expense.create({
    data: {
      orgId: input.orgId,
      locationId: input.locationId,
      reference,
      category: input.category,
      status: 'SUBMITTED',
      supplier: draft.supplier,
      description: draft.description || null,
      net: input.net,
      tax: input.tax,
      incurredAt: input.incurredAt,
      paidFrom: input.paidFrom,
      receiptUrl: input.receiptUrl ?? null,
      claimedByEmployeeId: input.claimedByEmployeeId ?? null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'expense.recorded',
    entityType: 'Expense',
    entityId: expense.id,
    after: { reference, category: input.category, net: input.net } as never,
  });

  return { ok: true, expenseId: expense.id };
}

/**
 * Approves an expense and posts it.
 *
 * The posting happens on approval rather than on entry, because an expense
 * nobody has agreed to is not yet a cost. Posting first and reversing on
 * rejection would put every mistaken claim into the accounts and then take it
 * out again, which is noise in a place that has to stay legible.
 */
export async function approveExpense(input: {
  orgId: string;
  expenseId: string;
  approverUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.expense.findFirst({
    where: { id: input.expenseId, orgId: input.orgId },
    include: { claimedBy: { select: { userId: true } } },
  });

  if (!row) return { ok: false, error: 'That expense does not exist.' };

  const approverEmployee = await prisma.employee.findFirst({
    where: { orgId: input.orgId, userId: input.approverUserId },
    select: { id: true },
  });

  try {
    assertApprovable({
      status: row.status as Expense['status'],
      claimedByEmployeeId: row.claimedByEmployeeId,
      approverEmployeeId: approverEmployee?.id ?? null,
    });
  } catch (error) {
    return { ok: false, error: (error as ExpenseError).message };
  }

  const expense = toDomain(row);

  await prisma.expense.update({
    where: { id: row.id },
    data: { status: 'APPROVED', approvedByUserId: input.approverUserId, approvedAt: new Date() },
  });

  await postEntry(input.orgId, postExpense({ ...expense, status: 'APPROVED' }));

  await audit({
    orgId: input.orgId,
    actorUserId: input.approverUserId,
    action: 'expense.approved',
    entityType: 'Expense',
    entityId: row.id,
    after: { reference: row.reference } as never,
  });

  return { ok: true };
}

export async function expensesFor(orgId: string, range?: { from: Date; to: Date }) {
  const rows = await prisma.expense.findMany({
    where: {
      orgId,
      ...(range ? { incurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    include: {
      claimedBy: { select: { displayName: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { incurredAt: 'desc' },
    take: 100,
  });

  return { rows, summary: summariseExpenses(rows.map(toDomain)) };
}

/* ---------------------------------------------------------------------------
   Reconciliation
   --------------------------------------------------------------------------- */

/**
 * Where an account stands against its statement.
 *
 * Candidates are journal lines that touched the bank account, because those
 * are the only postings a bank statement could possibly correspond to. Every
 * suggestion carries its reasoning, and only the exact ones are offered for
 * one-click acceptance.
 */
export async function reconciliation(orgId: string, bankAccountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, orgId },
    include: {
      statements: {
        orderBy: { startsOn: 'desc' },
        take: 1,
        include: { lines: { orderBy: { postedOn: 'asc' } } },
      },
    },
  });

  if (!account) return null;

  const statement = account.statements[0];

  const lines: BankStatementLine[] = (statement?.lines ?? [])
    .filter((line) => line.matchedEntryId === null)
    .map((line) => ({
      id: line.id,
      at: line.postedOn,
      description: line.description,
      amount: decimal(line.amount),
      reference: line.reference,
    }));

  const postings = await prisma.journalLine.findMany({
    where: {
      entry: {
        orgId,
        ...(statement
          ? {
              postedAt: {
                gte: addDays(statement.startsOn, -14),
                lte: addDays(statement.endsOn, 14),
              },
            }
          : {}),
      },
      account: { code: account.accountCode },
    },
    include: { entry: true },
  });

  const matchedIds = new Set(
    (statement?.lines ?? [])
      .map((line) => line.matchedEntryId)
      .filter((id): id is string => id !== null),
  );

  const candidates: LedgerCandidate[] = postings
    .filter((line) => !matchedIds.has(line.entryId))
    .map((line) => ({
      id: line.entryId,
      at: line.entry.postedAt,
      description: line.entry.description,
      // A debit to the bank is money in, a credit is money out, which is the
      // same sign convention a statement uses.
      amount: {
        minor: Math.round((Number(line.debit) - Number(line.credit)) * 100),
        currency: 'GBP',
      },
      reference: line.entry.reference,
      sourceType: line.entry.sourceType ?? 'Journal',
    }));

  const matches = suggestMatches(lines, candidates);

  const ledgerBalance = postings.reduce(
    (total, line) => total + Math.round((Number(line.debit) - Number(line.credit)) * 100),
    0,
  );

  return {
    account,
    statement,
    state: reconciliationState({
      statementBalance: statement
        ? decimal(statement.closingBalance)
        : { minor: 0, currency: 'GBP' },
      ledgerBalance: { minor: ledgerBalance, currency: 'GBP' },
      statement: lines,
      candidates,
      matches,
    }),
    matches,
    candidates,
  };
}

/** Accepts a match, recording why it was made. */
export async function acceptMatch(input: {
  orgId: string;
  statementLineId: string;
  entryId: string;
  reason: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const line = await prisma.bankStatementLine.findFirst({
    where: { id: input.statementLineId, statement: { account: { orgId: input.orgId } } },
  });

  if (!line) return { ok: false, error: 'That statement line does not exist.' };
  if (line.matchedEntryId) return { ok: false, error: 'That line is already matched.' };

  await prisma.bankStatementLine.update({
    where: { id: line.id },
    data: { matchedEntryId: input.entryId, matchedAt: new Date(), matchReason: input.reason },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'bank.matched',
    entityType: 'BankStatementLine',
    entityId: line.id,
    after: { entryId: input.entryId, reason: input.reason } as never,
  });

  return { ok: true };
}

/* ---------------------------------------------------------------------------
   Closing a period
   --------------------------------------------------------------------------- */

/** Everything that has to be true before a period stops moving. */
export async function periodReadiness(orgId: string, periodId: string) {
  const period = await prisma.fiscalPeriod.findFirst({ where: { id: periodId, orgId } });
  if (!period) return null;

  const [balance, unpostedJobs, draftInvoices, openTills, unapproved, unmatched] =
    await Promise.all([
      postedLines(orgId).then(trialBalance),
      prisma.job.count({
        where: {
          orgId,
          status: 'COMPLETED',
          completedAt: { gte: period.startsAt, lte: period.endsAt },
        },
      }),
      prisma.invoice.count({ where: { orgId, status: 'DRAFT' } }),
      prisma.tillSession.count({ where: { orgId, closedAt: null } }),
      prisma.timesheet.count({ where: { orgId, status: { in: ['OPEN', 'SUBMITTED'] } } }),
      prisma.bankStatementLine.count({
        where: {
          matchedEntryId: null,
          statement: {
            account: { orgId },
            endsOn: { lte: period.endsAt },
          },
        },
      }),
    ]);

  const checks = closeChecks({
    trialBalanced: balance.balanced,
    unpostedJobs,
    draftInvoices,
    unreconciledBankLines: unmatched,
    openTills,
    unapprovedTimesheets: unapproved,
  });

  return { period, checks };
}

export async function closePeriod(input: {
  orgId: string;
  periodId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const readiness = await periodReadiness(input.orgId, input.periodId);
  if (!readiness) return { ok: false, error: 'That period does not exist.' };

  try {
    assertClosable(readiness.checks);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  await prisma.fiscalPeriod.update({
    where: { id: input.periodId },
    data: { isClosed: true, closedAt: new Date() },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'period.closed',
    entityType: 'FiscalPeriod',
    entityId: input.periodId,
    after: { name: readiness.period.name } as never,
  });

  return { ok: true };
}

export async function periodsFor(orgId: string) {
  return prisma.fiscalPeriod.findMany({ where: { orgId }, orderBy: { startsAt: 'desc' } });
}

export async function bankAccountsFor(orgId: string) {
  return prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export { toNumber };
