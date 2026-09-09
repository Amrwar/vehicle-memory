import {
  add,
  type Currency,
  fromDecimal,
  type Money,
  money,
  subtract,
  sum,
  toDecimalString,
  zero,
} from '../shared/money';
import { ACCOUNT } from './accounts';

/**
 * Posting rules.
 *
 * Every operational act has a financial consequence, and this is where the two
 * meet. The rules are transcribed from
 * docs/02-design/07-accounting-model.md, which an accountant reviews; the
 * document is the specification and this is its implementation.
 *
 * Each function is pure: operational facts in, a balanced journal entry out.
 * Nothing here touches a database, so the arithmetic is testable in
 * milliseconds and a wrong posting is caught by a unit test rather than by a
 * bookkeeper in March.
 */

export interface JournalLineDraft {
  accountCode: string;
  debit: Money;
  credit: Money;
  memo?: string;
}

export interface JournalEntryDraft {
  reference: string;
  description: string;
  /** The operational document that caused this. FR-1205, never optional. */
  sourceType: string;
  sourceId: string;
  postedAt: Date;
  lines: JournalLineDraft[];
}

export class PostingError extends Error {
  readonly code: 'UNBALANCED' | 'EMPTY' | 'BOTH_SIDES' | 'NEGATIVE';

  constructor(code: PostingError['code'], message: string) {
    super(message);
    this.name = 'PostingError';
    this.code = code;
  }
}

const debitLine = (accountCode: string, amount: Money, memo?: string): JournalLineDraft => ({
  accountCode,
  debit: amount,
  credit: zero(amount.currency),
  memo,
});

const creditLine = (accountCode: string, amount: Money, memo?: string): JournalLineDraft => ({
  accountCode,
  debit: zero(amount.currency),
  credit: amount,
  memo,
});

/**
 * Validates an entry before it can be persisted.
 *
 * The database enforces balance too, with a deferred constraint trigger. Both
 * is deliberate: the domain check gives a readable error naming the two
 * figures, and the database check holds even for a write that bypasses this
 * code entirely.
 */
export function assertBalanced(entry: JournalEntryDraft): void {
  const lines = entry.lines.filter((line) => line.debit.minor !== 0 || line.credit.minor !== 0);

  if (lines.length === 0) {
    throw new PostingError('EMPTY', `Journal entry "${entry.reference}" has no lines`);
  }

  for (const line of lines) {
    if (line.debit.minor !== 0 && line.credit.minor !== 0) {
      throw new PostingError(
        'BOTH_SIDES',
        `Account ${line.accountCode} carries a debit and a credit on one line`,
      );
    }
    if (line.debit.minor < 0 || line.credit.minor < 0) {
      throw new PostingError(
        'NEGATIVE',
        `Account ${line.accountCode} has a negative amount. Reverse the side instead.`,
      );
    }
  }

  const debits = sum(lines.map((line) => line.debit));
  const credits = sum(lines.map((line) => line.credit));

  if (debits.minor !== credits.minor) {
    throw new PostingError(
      'UNBALANCED',
      `Journal entry "${entry.reference}" does not balance: debits ${toDecimalString(debits)} against credits ${toDecimalString(credits)}`,
    );
  }
}

/** Drops zero lines and checks the entry. Every rule below finishes here. */
function finalise(entry: JournalEntryDraft): JournalEntryDraft {
  const lines = entry.lines.filter((line) => line.debit.minor !== 0 || line.credit.minor !== 0);
  const finalised = { ...entry, lines };
  assertBalanced(finalised);
  return finalised;
}

/* ---------------------------------------------------------------------------
   Invoice issued
   --------------------------------------------------------------------------- */

export interface InvoicePostingInput {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  issuedAt: Date;
  /** Net, split by what was sold. Tax is separate. */
  labourNet: Money;
  partsNet: Money;
  feeNet: Money;
  taxTotal: Money;
}

/**
 * Revenue is split by line kind rather than lumped into one account.
 *
 * Parts margin and labour margin are different questions with different
 * answers, and an owner needs both. Posting them to a single revenue account
 * makes that permanently unanswerable without re-reading every invoice.
 */
export function postInvoiceIssued(input: InvoicePostingInput): JournalEntryDraft {
  const currency = input.labourNet.currency;
  const receivable = add(
    add(add(input.labourNet, input.partsNet), input.feeNet),
    input.taxTotal,
  );

  return finalise({
    reference: input.invoiceNumber,
    description: `Invoice ${input.invoiceNumber} to ${input.customerName}`,
    sourceType: 'Invoice',
    sourceId: input.invoiceId,
    postedAt: input.issuedAt,
    lines: [
      debitLine(ACCOUNT.RECEIVABLE, receivable, 'Owed by the customer'),
      creditLine(ACCOUNT.LABOUR_REVENUE, input.labourNet, 'Charged time'),
      creditLine(ACCOUNT.PARTS_REVENUE, input.partsNet, 'Parts sold'),
      creditLine(ACCOUNT.FEE_REVENUE, input.feeNet, 'Fees'),
      creditLine(ACCOUNT.TAX_PAYABLE, input.taxTotal, 'Output tax'),
    ],
    ...(currency ? {} : {}),
  });
}

/* ---------------------------------------------------------------------------
   Parts consumed on a job
   --------------------------------------------------------------------------- */

export function postPartsConsumed(input: {
  jobId: string;
  jobNumber: number;
  cost: Money;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: `JOB-${input.jobNumber}`,
    description: `Parts consumed on job ${input.jobNumber}`,
    sourceType: 'Job',
    sourceId: input.jobId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.COGS_PARTS, input.cost, 'At weighted average cost'),
      creditLine(ACCOUNT.STOCK, input.cost, 'Off the shelf'),
    ],
  });
}

/* ---------------------------------------------------------------------------
   Payment received
   --------------------------------------------------------------------------- */

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'ONLINE'
  | 'CHEQUE'
  | 'ACCOUNT'
  | 'OTHER';

/** Cash goes to the cash account; everything else lands in the bank. */
export function accountForMethod(method: PaymentMethod): string {
  return method === 'CASH' ? ACCOUNT.CASH : ACCOUNT.BANK;
}

export function postPaymentReceived(input: {
  paymentId: string;
  reference: string;
  amount: Money;
  method: PaymentMethod;
  receivedAt: Date;
  /** True when taken before the work was invoiced. */
  isDeposit?: boolean;
}): JournalEntryDraft {
  // A deposit is a liability until the work is invoiced. Treating it as
  // revenue on receipt is the classic error, and it overstates a good month
  // while understating the one where the work is actually done.
  const creditAccount = input.isDeposit ? ACCOUNT.DEPOSITS : ACCOUNT.RECEIVABLE;

  return finalise({
    reference: input.reference,
    description: input.isDeposit ? 'Customer deposit received' : 'Payment received',
    sourceType: 'Payment',
    sourceId: input.paymentId,
    postedAt: input.receivedAt,
    lines: [
      debitLine(accountForMethod(input.method), input.amount, input.method.toLowerCase()),
      creditLine(creditAccount, input.amount),
    ],
  });
}

/* ---------------------------------------------------------------------------
   Goods received from a supplier
   --------------------------------------------------------------------------- */

/**
 * Stock is debited on receipt, not on the supplier's invoice, so the stock
 * figure reflects what is physically on the shelf rather than what has been
 * billed. Those two dates are often weeks apart.
 */
export function postGoodsReceived(input: {
  receiptId: string;
  reference: string;
  orderNumber: string;
  goodsValue: Money;
  taxValue: Money;
  receivedAt: Date;
}): JournalEntryDraft {
  const payable = add(input.goodsValue, input.taxValue);

  return finalise({
    reference: input.reference,
    description: `Goods received on ${input.orderNumber}`,
    sourceType: 'GoodsReceipt',
    sourceId: input.receiptId,
    postedAt: input.receivedAt,
    lines: [
      debitLine(ACCOUNT.STOCK, input.goodsValue, 'Onto the shelf'),
      debitLine(ACCOUNT.TAX_RECEIVABLE, input.taxValue, 'Input tax'),
      creditLine(ACCOUNT.PAYABLE, payable, 'Owed to the supplier'),
    ],
  });
}

export function postSupplierBillPaid(input: {
  billId: string;
  reference: string;
  amount: Money;
  paidAt: Date;
  fromCash?: boolean;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: 'Supplier bill paid',
    sourceType: 'SupplierBill',
    sourceId: input.billId,
    postedAt: input.paidAt,
    lines: [
      debitLine(ACCOUNT.PAYABLE, input.amount),
      creditLine(input.fromCash ? ACCOUNT.CASH : ACCOUNT.BANK, input.amount),
    ],
  });
}

/* ---------------------------------------------------------------------------
   Stock adjustment
   --------------------------------------------------------------------------- */

/**
 * A shrinkage is an expense; a surplus reduces it. Both sides are handled so a
 * stocktake that finds more than expected does not need a different rule.
 */
export function postStockAdjustment(input: {
  movementId: string;
  reference: string;
  /** Negative for a shortage, positive for a surplus. */
  value: Money;
  reason: string;
  at: Date;
}): JournalEntryDraft {
  const magnitude = money(Math.abs(input.value.minor), input.value.currency);
  const isShortage = input.value.minor < 0;

  return finalise({
    reference: input.reference,
    description: `Stock adjustment: ${input.reason}`,
    sourceType: 'StockMovement',
    sourceId: input.movementId,
    postedAt: input.at,
    lines: isShortage
      ? [
          debitLine(ACCOUNT.STOCK_ADJUSTMENT, magnitude, input.reason),
          creditLine(ACCOUNT.STOCK, magnitude),
        ]
      : [
          debitLine(ACCOUNT.STOCK, magnitude),
          creditLine(ACCOUNT.STOCK_ADJUSTMENT, magnitude, input.reason),
        ],
  });
}

/* ---------------------------------------------------------------------------
   Credit note
   --------------------------------------------------------------------------- */

/**
 * An issued invoice is never edited (FR-907), so a correction reverses
 * proportionally through a credit note. Revenue and tax both come back.
 */
export function postCreditNote(input: {
  creditNoteId: string;
  number: string;
  invoiceNumber: string;
  labourNet: Money;
  partsNet: Money;
  feeNet: Money;
  taxTotal: Money;
  reason: string;
  issuedAt: Date;
}): JournalEntryDraft {
  const receivable = add(
    add(add(input.labourNet, input.partsNet), input.feeNet),
    input.taxTotal,
  );

  return finalise({
    reference: input.number,
    description: `Credit note against ${input.invoiceNumber}: ${input.reason}`,
    sourceType: 'CreditNote',
    sourceId: input.creditNoteId,
    postedAt: input.issuedAt,
    lines: [
      debitLine(ACCOUNT.LABOUR_REVENUE, input.labourNet),
      debitLine(ACCOUNT.PARTS_REVENUE, input.partsNet),
      debitLine(ACCOUNT.FEE_REVENUE, input.feeNet),
      debitLine(ACCOUNT.TAX_PAYABLE, input.taxTotal),
      creditLine(ACCOUNT.RECEIVABLE, receivable, 'No longer owed'),
    ],
  });
}

/* ---------------------------------------------------------------------------
   Reversal
   --------------------------------------------------------------------------- */

/**
 * A posted entry is never edited (FR-1204). A correction is a reversing entry
 * that references the original, so both remain visible and the audit trail
 * shows what was wrong as well as what replaced it.
 */
export function reverse(entry: JournalEntryDraft, at: Date, reason: string): JournalEntryDraft {
  return finalise({
    reference: `REV-${entry.reference}`,
    description: `Reversal of ${entry.reference}: ${reason}`,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    postedAt: at,
    lines: entry.lines.map((line) => ({
      accountCode: line.accountCode,
      debit: line.credit,
      credit: line.debit,
      memo: line.memo,
    })),
  });
}

/* ---------------------------------------------------------------------------
   Job profitability
   --------------------------------------------------------------------------- */

export interface JobProfitInput {
  labourRevenue: Money;
  partsRevenue: Money;
  feeRevenue: Money;
  partsCost: Money;
  labourCost: Money;
  currency?: Currency;
}

export interface JobProfit {
  revenue: Money;
  partsCost: Money;
  labourCost: Money;
  grossProfit: Money;
  marginPct: number | null;
  /** Margin on the parts alone, which is where quiet leakage happens. */
  partsMarginPct: number | null;
}

export function jobProfit(input: JobProfitInput): JobProfit {
  const currency = input.currency ?? input.labourRevenue.currency;
  const revenue = sum(
    [input.labourRevenue, input.partsRevenue, input.feeRevenue],
    currency,
  );
  const grossProfit = subtract(subtract(revenue, input.partsCost), input.labourCost);

  return {
    revenue,
    partsCost: input.partsCost,
    labourCost: input.labourCost,
    grossProfit,
    marginPct: revenue.minor === 0 ? null : round2((grossProfit.minor / revenue.minor) * 100),
    partsMarginPct:
      input.partsRevenue.minor === 0
        ? null
        : round2(
            ((input.partsRevenue.minor - input.partsCost.minor) / input.partsRevenue.minor) * 100,
          ),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export { fromDecimal as moneyFromDecimal };
