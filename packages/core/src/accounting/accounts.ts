/**
 * Chart of accounts.
 *
 * The codes and names are the ones in
 * docs/02-design/07-accounting-model.md, which an accountant reviews before
 * any of this is trusted. Keeping the two identical is the point: the
 * document is the specification, and this is its transcription.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

/**
 * Which side increases an account.
 *
 * Assets and expenses are debit-normal; everything else is credit-normal.
 * Getting this backwards is the classic error, and it produces a trial balance
 * that still balances while every figure has the wrong sign — which is why it
 * survives casual testing.
 */
export function normalBalance(type: AccountType): 'debit' | 'credit' {
  return type === 'ASSET' || type === 'EXPENSE' ? 'debit' : 'credit';
}

/** Signed movement for an account, given raw debit and credit totals. */
export function signedBalance(type: AccountType, debit: number, credit: number): number {
  return normalBalance(type) === 'debit' ? debit - credit : credit - debit;
}

export interface AccountSpec {
  code: string;
  name: string;
  type: AccountType;
  /** Explains what belongs in it, so nobody has to guess when posting. */
  purpose: string;
}

export const STANDARD_CHART: readonly AccountSpec[] = [
  { code: '1000', name: 'Bank', type: 'ASSET', purpose: 'Cleared funds in the business account' },
  { code: '1010', name: 'Cash', type: 'ASSET', purpose: 'Notes and coin held on the premises' },
  {
    code: '1100',
    name: 'Accounts receivable',
    type: 'ASSET',
    purpose: 'Invoiced to customers and not yet paid',
  },
  {
    code: '1200',
    name: 'Stock on hand',
    type: 'ASSET',
    purpose: 'Parts on the shelf, at weighted average cost',
  },
  {
    code: '1500',
    name: 'Work in progress',
    type: 'ASSET',
    purpose: 'Cost incurred on jobs not yet invoiced',
  },
  {
    code: '2000',
    name: 'Accounts payable',
    type: 'LIABILITY',
    purpose: 'Owed to suppliers and not yet paid',
  },
  {
    code: '2100',
    name: 'Tax payable',
    type: 'LIABILITY',
    purpose: 'Output tax charged to customers, owed to the authority',
  },
  {
    code: '2110',
    name: 'Tax receivable',
    type: 'ASSET',
    purpose: 'Input tax paid to suppliers, reclaimable',
  },
  {
    code: '2200',
    name: 'Customer deposits',
    type: 'LIABILITY',
    purpose: 'Money taken before the work is invoiced. Not revenue.',
  },
  {
    code: '3000',
    name: 'Retained earnings',
    type: 'EQUITY',
    purpose: 'Accumulated profit from closed periods',
  },
  { code: '4000', name: 'Labour revenue', type: 'REVENUE', purpose: 'Charged time' },
  { code: '4010', name: 'Parts revenue', type: 'REVENUE', purpose: 'Parts sold on jobs' },
  {
    code: '4020',
    name: 'Fees and sundry revenue',
    type: 'REVENUE',
    purpose: 'Everything else charged',
  },
  {
    code: '5000',
    name: 'Cost of goods sold, parts',
    type: 'EXPENSE',
    purpose: 'Cost of parts consumed on jobs',
  },
  {
    code: '5010',
    name: 'Cost of labour',
    type: 'EXPENSE',
    purpose: 'Clocked technician time at cost rate',
  },
  { code: '6000', name: 'Wages', type: 'EXPENSE', purpose: 'Payroll not attributed to a job' },
  { code: '6100', name: 'Premises', type: 'EXPENSE', purpose: 'Rent, rates, utilities' },
  {
    code: '6200',
    name: 'Stock adjustments',
    type: 'EXPENSE',
    purpose: 'Shrinkage and stocktake variance',
  },
  {
    code: '6300',
    name: 'General overheads',
    type: 'EXPENSE',
    purpose: 'Insurance, marketing, subscriptions, professional fees, everything else',
  },
] as const;

/** Codes referenced by the posting rules, named rather than sprinkled inline. */
export const ACCOUNT = {
  BANK: '1000',
  CASH: '1010',
  RECEIVABLE: '1100',
  STOCK: '1200',
  WIP: '1500',
  PAYABLE: '2000',
  TAX_PAYABLE: '2100',
  TAX_RECEIVABLE: '2110',
  DEPOSITS: '2200',
  RETAINED: '3000',
  LABOUR_REVENUE: '4000',
  PARTS_REVENUE: '4010',
  FEE_REVENUE: '4020',
  COGS_PARTS: '5000',
  COGS_LABOUR: '5010',
  WAGES: '6000',
  PREMISES: '6100',
  STOCK_ADJUSTMENT: '6200',
  OVERHEADS: '6300',
} as const;

const BY_CODE = new Map(STANDARD_CHART.map((account) => [account.code, account]));

export function accountSpec(code: string): AccountSpec | undefined {
  return BY_CODE.get(code);
}

export function accountType(code: string): AccountType | undefined {
  return BY_CODE.get(code)?.type;
}

/** Statement each account rolls into. */
export function statementFor(type: AccountType): 'balance-sheet' | 'profit-and-loss' {
  return type === 'REVENUE' || type === 'EXPENSE' ? 'profit-and-loss' : 'balance-sheet';
}

export function describeAccountType(type: AccountType): string {
  switch (type) {
    case 'ASSET':
      return 'Asset';
    case 'LIABILITY':
      return 'Liability';
    case 'EQUITY':
      return 'Equity';
    case 'REVENUE':
      return 'Revenue';
    case 'EXPENSE':
      return 'Expense';
  }
}
