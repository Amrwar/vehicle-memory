import { add, type Currency, type Money, money, subtract, sum, zero } from '../shared/money';
import {
  type AccountType,
  accountType,
  normalBalance,
  signedBalance,
  statementFor,
} from './accounts';

/**
 * Financial statements, derived from posted journal lines.
 *
 * Everything here is a projection of the ledger. Nothing is stored, so a
 * statement cannot drift from the entries behind it, and every figure is
 * traceable back to the operational document that caused it.
 */

export interface PostedLine {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: Money;
  credit: Money;
  postedAt: Date;
}

/* ---------------------------------------------------------------------------
   Trial balance
   --------------------------------------------------------------------------- */

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: Money;
  credit: Money;
  /** Positive means the account sits on its normal side. */
  balance: Money;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebits: Money;
  totalCredits: Money;
  /** If this is ever false, stop and investigate. Nothing else is meaningful. */
  balanced: boolean;
  difference: Money;
}

export function trialBalance(
  lines: readonly PostedLine[],
  currency: Currency = 'GBP',
): TrialBalance {
  const byAccount = new Map<string, TrialBalanceRow>();

  for (const line of lines) {
    const existing = byAccount.get(line.accountCode) ?? {
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      debit: zero(currency),
      credit: zero(currency),
      balance: zero(currency),
    };

    existing.debit = add(existing.debit, line.debit);
    existing.credit = add(existing.credit, line.credit);
    byAccount.set(line.accountCode, existing);
  }

  const rows = [...byAccount.values()]
    .map((row) => ({
      ...row,
      balance: money(signedBalance(row.accountType, row.debit.minor, row.credit.minor), currency),
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalDebits = sum(
    rows.map((row) => row.debit),
    currency,
  );
  const totalCredits = sum(
    rows.map((row) => row.credit),
    currency,
  );

  return {
    rows,
    totalDebits,
    totalCredits,
    balanced: totalDebits.minor === totalCredits.minor,
    difference: subtract(totalDebits, totalCredits),
  };
}

/* ---------------------------------------------------------------------------
   Profit and loss
   --------------------------------------------------------------------------- */

export interface StatementLine {
  accountCode: string;
  accountName: string;
  amount: Money;
}

export interface ProfitAndLoss {
  revenue: StatementLine[];
  totalRevenue: Money;
  costOfSales: StatementLine[];
  totalCostOfSales: Money;
  grossProfit: Money;
  grossMarginPct: number | null;
  overheads: StatementLine[];
  totalOverheads: Money;
  netProfit: Money;
  netMarginPct: number | null;
}

/** Cost of sales is the 5xxx range; everything else in expenses is overhead. */
const isCostOfSales = (code: string): boolean => code.startsWith('5');

export function profitAndLoss(
  lines: readonly PostedLine[],
  currency: Currency = 'GBP',
): ProfitAndLoss {
  const balance = trialBalance(lines, currency);
  const pl = balance.rows.filter((row) => statementFor(row.accountType) === 'profit-and-loss');

  const toLine = (row: TrialBalanceRow): StatementLine => ({
    accountCode: row.accountCode,
    accountName: row.accountName,
    amount: row.balance,
  });

  const revenue = pl.filter((row) => row.accountType === 'REVENUE').map(toLine);
  const expenses = pl.filter((row) => row.accountType === 'EXPENSE');

  const costOfSales = expenses.filter((row) => isCostOfSales(row.accountCode)).map(toLine);
  const overheads = expenses.filter((row) => !isCostOfSales(row.accountCode)).map(toLine);

  const totalRevenue = sum(
    revenue.map((line) => line.amount),
    currency,
  );
  const totalCostOfSales = sum(
    costOfSales.map((line) => line.amount),
    currency,
  );
  const totalOverheads = sum(
    overheads.map((line) => line.amount),
    currency,
  );

  const grossProfit = subtract(totalRevenue, totalCostOfSales);
  const netProfit = subtract(grossProfit, totalOverheads);

  return {
    revenue,
    totalRevenue,
    costOfSales,
    totalCostOfSales,
    grossProfit,
    grossMarginPct:
      totalRevenue.minor === 0 ? null : round2((grossProfit.minor / totalRevenue.minor) * 100),
    overheads,
    totalOverheads,
    netProfit,
    netMarginPct:
      totalRevenue.minor === 0 ? null : round2((netProfit.minor / totalRevenue.minor) * 100),
  };
}

/* ---------------------------------------------------------------------------
   Balance sheet
   --------------------------------------------------------------------------- */

export interface BalanceSheet {
  assets: StatementLine[];
  totalAssets: Money;
  liabilities: StatementLine[];
  totalLiabilities: Money;
  equity: StatementLine[];
  /** Profit for the period, which has not yet been closed to reserves. */
  retainedThisPeriod: Money;
  totalEquity: Money;
  /** Assets must equal liabilities plus equity. */
  balanced: boolean;
  difference: Money;
}

export function balanceSheet(
  lines: readonly PostedLine[],
  currency: Currency = 'GBP',
): BalanceSheet {
  const balance = trialBalance(lines, currency);
  const pl = profitAndLoss(lines, currency);

  const toLine = (row: TrialBalanceRow): StatementLine => ({
    accountCode: row.accountCode,
    accountName: row.accountName,
    amount: row.balance,
  });

  const assets = balance.rows.filter((row) => row.accountType === 'ASSET').map(toLine);
  const liabilities = balance.rows.filter((row) => row.accountType === 'LIABILITY').map(toLine);
  const equity = balance.rows.filter((row) => row.accountType === 'EQUITY').map(toLine);

  const totalAssets = sum(
    assets.map((line) => line.amount),
    currency,
  );
  const totalLiabilities = sum(
    liabilities.map((line) => line.amount),
    currency,
  );

  // Profit earned but not yet closed to retained earnings still belongs to the
  // owners, so it counts as equity. Omitting it is the usual reason a balance
  // sheet fails to balance before period close.
  const totalEquity = add(
    sum(
      equity.map((line) => line.amount),
      currency,
    ),
    pl.netProfit,
  );

  const difference = subtract(totalAssets, add(totalLiabilities, totalEquity));

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    retainedThisPeriod: pl.netProfit,
    totalEquity,
    balanced: difference.minor === 0,
    difference,
  };
}

/* ---------------------------------------------------------------------------
   Ageing
   --------------------------------------------------------------------------- */

export interface AgeableDocument {
  id: string;
  reference: string;
  partyName: string;
  outstanding: Money;
  dueAt: Date | null;
}

export type AgeBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export const AGE_BUCKETS: readonly AgeBucket[] = ['current', '1-30', '31-60', '61-90', '90+'];

/**
 * Where each bucket ends, in days overdue. The last one has no end.
 *
 * Exported because the same boundaries have to exist in SQL: a workshop with a
 * hundred thousand unpaid bills cannot have them all fetched and bucketed in
 * memory, so the sums are done in the database. Two copies of 30, 60 and 90
 * would drift the first time somebody changed one of them, and the drift would
 * be silent — the totals would still add up, against different definitions.
 * Phase 51.
 */
export const AGE_BOUNDARIES: readonly { bucket: AgeBucket; upToDays: number | null }[] = [
  { bucket: 'current', upToDays: 0 },
  { bucket: '1-30', upToDays: 30 },
  { bucket: '31-60', upToDays: 60 },
  { bucket: '61-90', upToDays: 90 },
  { bucket: '90+', upToDays: null },
];

export function bucketFor(dueAt: Date | null, asOf: Date): AgeBucket {
  if (!dueAt) return 'current';

  const days = Math.floor((asOf.getTime() - dueAt.getTime()) / 86_400_000);

  for (const { bucket, upToDays } of AGE_BOUNDARIES) {
    if (upToDays === null || days <= upToDays) return bucket;
  }

  return '90+';
}

export interface AgedAnalysis {
  buckets: Record<AgeBucket, Money>;
  total: Money;
  documents: (AgeableDocument & { bucket: AgeBucket; daysOverdue: number })[];
  /** Anything past 60 days is the part worth a phone call today. */
  atRisk: Money;
}

export function ageAnalysis(
  documents: readonly AgeableDocument[],
  asOf: Date = new Date(),
  currency: Currency = 'GBP',
): AgedAnalysis {
  const buckets: Record<AgeBucket, Money> = {
    current: zero(currency),
    '1-30': zero(currency),
    '31-60': zero(currency),
    '61-90': zero(currency),
    '90+': zero(currency),
  };

  const aged = documents
    .filter((document) => document.outstanding.minor > 0)
    .map((document) => {
      const bucket = bucketFor(document.dueAt, asOf);
      buckets[bucket] = add(buckets[bucket], document.outstanding);
      const daysOverdue = document.dueAt
        ? Math.max(0, Math.floor((asOf.getTime() - document.dueAt.getTime()) / 86_400_000))
        : 0;
      return { ...document, bucket, daysOverdue };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    buckets,
    total: sum(Object.values(buckets), currency),
    documents: aged,
    atRisk: add(buckets['61-90'], buckets['90+']),
  };
}

/* ---------------------------------------------------------------------------
   Tax
   --------------------------------------------------------------------------- */

export interface TaxReturn {
  outputTax: Money;
  inputTax: Money;
  /** Positive means owed to the authority; negative means reclaimable. */
  net: Money;
  owed: boolean;
}

export function taxReturn(lines: readonly PostedLine[], currency: Currency = 'GBP'): TaxReturn {
  const balance = trialBalance(lines, currency);

  const outputTax =
    balance.rows.find((row) => row.accountCode === '2100')?.balance ?? zero(currency);
  const inputTax =
    balance.rows.find((row) => row.accountCode === '2110')?.balance ?? zero(currency);

  const net = subtract(outputTax, inputTax);

  return { outputTax, inputTax, net, owed: net.minor >= 0 };
}

/** Filters lines to a period, for a statement covering a date range. */
export function withinPeriod(lines: readonly PostedLine[], from: Date, to: Date): PostedLine[] {
  return lines.filter((line) => line.postedAt >= from && line.postedAt <= to);
}

/** Everything up to a date, which is what a balance sheet needs. */
export function upTo(lines: readonly PostedLine[], asOf: Date): PostedLine[] {
  return lines.filter((line) => line.postedAt <= asOf);
}

export { accountType, normalBalance };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
