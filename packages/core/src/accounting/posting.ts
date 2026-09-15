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
  const receivable = add(add(add(input.labourNet, input.partsNet), input.feeNet), input.taxTotal);

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
  | 'OTHER'
  | 'LOYALTY'
  | 'GIFT_CARD'
  | 'DEPOSIT';

/**
 * Cash goes to the cash account; everything else lands in the bank. Points
 * redeemed are not money in: they are the cost of the loyalty programme, so
 * the debit goes to marketing and the customer's debt still comes down. A
 * gift card redeemed is money that already came in when the card was sold,
 * so the debit releases the liability rather than touching the bank twice.
 */
export function accountForMethod(method: PaymentMethod): string {
  if (method === 'LOYALTY') return ACCOUNT.LOYALTY_REWARDS;
  if (method === 'GIFT_CARD') return ACCOUNT.GIFT_CARDS;
  if (method === 'DEPOSIT') return ACCOUNT.DEPOSITS;
  return method === 'CASH' ? ACCOUNT.CASH : ACCOUNT.BANK;
}

/* ---------------------------------------------------------------------------
   Money held for a customer
   --------------------------------------------------------------------------- */

/**
 * A deposit taken before the work. Money in, owed as work or owed back: a
 * liability until an invoice takes it or it is returned. The same account
 * the payment posting uses for a deposit flagged on receipt.
 */
export function postDepositTaken(input: {
  depositId: string;
  reference: string;
  amount: Money;
  method: PaymentMethod;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: 'Deposit taken',
    sourceType: 'Deposit',
    sourceId: input.depositId,
    postedAt: input.at,
    lines: [
      debitLine(accountForMethod(input.method), input.amount, input.method.toLowerCase()),
      creditLine(ACCOUNT.DEPOSITS, input.amount),
    ],
  });
}

/** Money held going back to the customer, the way money goes. */
export function postDepositReturned(input: {
  movementId: string;
  reference: string;
  amount: Money;
  method: PaymentMethod;
  reason: string;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: `Deposit returned: ${input.reason}`,
    sourceType: 'DepositMovement',
    sourceId: input.movementId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.DEPOSITS, input.amount),
      creditLine(accountForMethod(input.method), input.amount, input.method.toLowerCase()),
    ],
  });
}

/* ---------------------------------------------------------------------------
   Gift card adjusted by hand
   --------------------------------------------------------------------------- */

/**
 * A person changed what a card holds. Money added is a gift from the
 * workshop, so it is the same cost as the loyalty programme; money taken
 * off is a card the workshop no longer owes on, which is sundry income
 * rather than a sale. Either way the liability moves by exactly the amount.
 */
export function postGiftCardAdjustment(input: {
  entryId: string;
  reference: string;
  /** Always positive; the direction says which way the card moved. */
  amount: Money;
  direction: 'UP' | 'DOWN';
  reason: string;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: `Gift card adjusted: ${input.reason}`,
    sourceType: 'GiftCardEntry',
    sourceId: input.entryId,
    postedAt: input.at,
    lines:
      input.direction === 'UP'
        ? [
            debitLine(ACCOUNT.LOYALTY_REWARDS, input.amount, 'Added to a card by hand'),
            creditLine(ACCOUNT.GIFT_CARDS, input.amount),
          ]
        : [
            debitLine(ACCOUNT.GIFT_CARDS, input.amount),
            creditLine(ACCOUNT.FEE_REVENUE, input.amount, 'Taken off a card by hand'),
          ],
  });
}

/* ---------------------------------------------------------------------------
   Gift card sold
   --------------------------------------------------------------------------- */

/**
 * Money in, owed back as work. The card is a liability until it is spent;
 * booking it as revenue on the day it is sold is the classic error, and it
 * flatters December and starves January.
 */
export function postGiftCardSold(input: {
  giftCardId: string;
  reference: string;
  amount: Money;
  method: PaymentMethod;
  soldAt: Date;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: 'Gift card sold',
    sourceType: 'GiftCard',
    sourceId: input.giftCardId,
    postedAt: input.soldAt,
    lines: [
      debitLine(accountForMethod(input.method), input.amount, input.method.toLowerCase()),
      creditLine(ACCOUNT.GIFT_CARDS, input.amount),
    ],
  });
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
  const receivable = add(add(add(input.labourNet, input.partsNet), input.feeNet), input.taxTotal);

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
   Refund
   --------------------------------------------------------------------------- */

/**
 * Money going back to a customer.
 *
 * The credit note has already taken the sale out of revenue and reduced what
 * the customer owed. If they had paid, that leaves them owed money, sitting as
 * a credit balance on receivable. The refund clears it: receivable comes back
 * to nought and the bank goes down by the same amount. Nothing touches revenue
 * here, because the credit note already did, and doing it twice is how a
 * refund is double-counted.
 */
export function postRefund(input: {
  refundId: string;
  reference: string;
  amount: Money;
  method: PaymentMethod;
  refundedAt: Date;
  reason: string;
}): JournalEntryDraft {
  return finalise({
    reference: input.reference,
    description: `Refund to customer: ${input.reason}`,
    sourceType: 'Refund',
    sourceId: input.refundId,
    postedAt: input.refundedAt,
    lines: [
      debitLine(ACCOUNT.RECEIVABLE, input.amount, 'Credit balance cleared'),
      creditLine(accountForMethod(input.method), input.amount, input.method.toLowerCase()),
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
  const revenue = sum([input.labourRevenue, input.partsRevenue, input.feeRevenue], currency);
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

/* ---------------------------------------------------------------------------
   Parts back to a supplier, and sublet work. Phase 38.
   --------------------------------------------------------------------------- */

/** A part leaves the shelf for the supplier: its cost becomes a credit they owe. */
export function postReturnSent(input: {
  returnId: string;
  number: string;
  held: Money;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: `${input.number}/S`,
    description: `Parts returned to the supplier, ${input.number}`,
    sourceType: 'SupplierReturn',
    sourceId: input.returnId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.SUPPLIER_CREDITS, input.held, 'Owed back by the supplier'),
      creditLine(ACCOUNT.STOCK, input.held, 'Off the shelf, at cost'),
    ],
  });
}

/**
 * The supplier's credit note: what is owed to them comes down by the gross,
 * the input tax is given back, the credit due is cleared, and any difference
 * between the credit and the cost held goes to cost: a credit short of it is
 * a loss on stock, a credit above it (a core charge coming back) reduces the
 * cost of parts.
 */
export function postReturnCredited(input: {
  returnId: string;
  number: string;
  reference: string;
  net: Money;
  tax: Money;
  held: Money;
  at: Date;
}): JournalEntryDraft {
  const currency = input.net.currency;
  const gross = money(input.net.minor + input.tax.minor, currency);
  const difference = input.net.minor - input.held.minor;
  return finalise({
    reference: `${input.number}/C`,
    description: `Credit note ${input.reference} for ${input.number}`,
    sourceType: 'SupplierReturn',
    sourceId: input.returnId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.PAYABLE, gross, 'Less owed to the supplier'),
      ...(difference < 0
        ? [debitLine(ACCOUNT.STOCK_ADJUSTMENT, money(-difference, currency), 'Credited below cost')]
        : []),
      creditLine(ACCOUNT.SUPPLIER_CREDITS, input.held, 'Credit due, cleared'),
      creditLine(ACCOUNT.TAX_RECEIVABLE, input.tax, 'Input tax given back'),
      ...(difference > 0
        ? [creditLine(ACCOUNT.COGS_PARTS, money(difference, currency), 'Core charge refunded')]
        : []),
    ],
  });
}

/** The supplier will not credit the parts: the value held is written off. */
export function postReturnRefused(input: {
  returnId: string;
  number: string;
  held: Money;
  at: Date;
}): JournalEntryDraft {
  return finalise({
    reference: `${input.number}/R`,
    description: `Return ${input.number} refused by the supplier`,
    sourceType: 'SupplierReturn',
    sourceId: input.returnId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.STOCK_ADJUSTMENT, input.held, 'Written off'),
      creditLine(ACCOUNT.SUPPLIER_CREDITS, input.held, 'No credit coming'),
    ],
  });
}

/** A vendor's bill for sublet work: its own cost, input tax, owed to the vendor. */
export function postSubletBilled(input: {
  subletId: string;
  reference: string;
  net: Money;
  tax: Money;
  at: Date;
}): JournalEntryDraft {
  const gross = money(input.net.minor + input.tax.minor, input.net.currency);
  return finalise({
    reference: `${input.reference}/SUB`,
    description: `Sublet bill ${input.reference}`,
    sourceType: 'JobSublet',
    sourceId: input.subletId,
    postedAt: input.at,
    lines: [
      debitLine(ACCOUNT.COGS_SUBLET, input.net, 'Work bought in'),
      debitLine(ACCOUNT.TAX_RECEIVABLE, input.tax, 'Input tax'),
      creditLine(ACCOUNT.PAYABLE, gross, 'Owed to the vendor'),
    ],
  });
}
