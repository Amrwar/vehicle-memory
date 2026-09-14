import { ACCOUNT, type JournalEntryDraft } from '../accounting/index';
import { add, type Money, money, multiply, subtract, sum, zero } from '../shared/money';

/**
 * Selling over the counter.
 *
 * This looks like a simplified invoice and it is not. Every other sale in the
 * system hangs off a job: the job owns the vehicle, carries the cost, and is
 * what the ledger posting and the stock movement both point at. A counter sale
 * has no job. Somebody wants a bulb, pays for it, and leaves.
 *
 * So the three things a job normally anchors have to work without it. Get that
 * wrong and the symptoms are indirect and slow: stock that drifts a little
 * every week, and a till that does not balance for reasons nobody can trace
 * back to a Tuesday afternoon.
 *
 * The other difference is time. A counter queue is not a service desk. Every
 * rule here is written so the common case is one scan and one tap.
 */

export type SaleStatus = 'OPEN' | 'PAID' | 'REFUNDED' | 'VOID';

export type SaleLineKind = 'PART' | 'LABOUR' | 'FEE';

export interface SaleLine {
  kind: SaleLineKind;
  description: string;
  /** Set for stock items, null for a one-off or a service. */
  productId: string | null;
  quantity: number;
  unitPrice: Money;
  /** Weighted average cost, for the margin and the ledger. */
  unitCost: Money;
  taxRatePct: number;
  discountPct: number;
}

export interface SaleLineTotals {
  gross: Money;
  discount: Money;
  net: Money;
  tax: Money;
  total: Money;
  cost: Money;
  margin: Money;
  marginPct: number | null;
}

export interface SaleTotals {
  lines: SaleLineTotals[];
  net: Money;
  discount: Money;
  tax: Money;
  total: Money;
  cost: Money;
  grossProfit: Money;
  marginPct: number | null;
  /** What the customer hands over, rounded to the smallest coin. */
  dueNow: Money;
}

/**
 * Totals for a counter sale.
 *
 * Tax is computed per line and then summed, never on the total. Summing first
 * and applying tax once is off by a penny often enough that somebody notices,
 * and it is always the customer who notices.
 */
export function saleTotals(lines: readonly SaleLine[], currency = 'GBP'): SaleTotals {
  const lineTotals = lines.map((line): SaleLineTotals => {
    const gross = multiply(line.unitPrice, line.quantity);
    const discount = multiply(gross, line.discountPct / 100);
    const net = subtract(gross, discount);
    const tax = multiply(net, line.taxRatePct / 100);
    const cost = multiply(line.unitCost, line.quantity);

    return {
      gross,
      discount,
      net,
      tax,
      total: add(net, tax),
      cost,
      margin: subtract(net, cost),
      marginPct: net.minor === 0 ? null : round2(((net.minor - cost.minor) / net.minor) * 100),
    };
  });

  const net = sum(
    lineTotals.map((line) => line.net),
    currency,
  );
  const tax = sum(
    lineTotals.map((line) => line.tax),
    currency,
  );
  const cost = sum(
    lineTotals.map((line) => line.cost),
    currency,
  );
  const total = add(net, tax);

  return {
    lines: lineTotals,
    net,
    discount: sum(
      lineTotals.map((line) => line.discount),
      currency,
    ),
    tax,
    total,
    cost,
    grossProfit: subtract(net, cost),
    marginPct: net.minor === 0 ? null : round2(((net.minor - cost.minor) / net.minor) * 100),
    dueNow: total,
  };
}

/**
 * Revenue split by what was actually sold.
 *
 * A counter sale of a bulb and a counter sale of half an hour diagnosing a
 * fault are different businesses with different margins. Posting both to parts
 * revenue would make the one figure an owner uses to judge the counter useless.
 */
export function revenueSplit(
  lines: readonly SaleLine[],
  totals: SaleTotals,
  currency = 'GBP',
): { labourNet: Money; partsNet: Money; feeNet: Money } {
  const netOf = (kind: SaleLineKind) =>
    sum(
      lines.map((line, index) => (line.kind === kind ? totals.lines[index]!.net : zero(currency))),
      currency,
    );

  return { labourNet: netOf('LABOUR'), partsNet: netOf('PART'), feeNet: netOf('FEE') };
}

/* ---------------------------------------------------------------------------
   Taking the money
   --------------------------------------------------------------------------- */

export type TenderKind = 'CASH' | 'CARD' | 'ACCOUNT' | 'GIFT_CARD';

export interface Tender {
  kind: TenderKind;
  amount: Money;
  /** The card's number, for a gift card. */
  code?: string;
}

export class SaleError extends Error {
  readonly code:
    'EMPTY' | 'UNDERPAID' | 'OVERPAID_CARD' | 'NO_ACCOUNT' | 'ALREADY_SETTLED' | 'REFUND_EXCEEDS';

  constructor(code: SaleError['code'], message: string) {
    super(message);
    this.name = 'SaleError';
    this.code = code;
  }
}

export interface Settlement {
  taken: Money;
  /** Cash back to the customer. Never negative. */
  change: Money;
  /** Left on the customer's account, for an account sale. */
  onAccount: Money;
}

/**
 * Works out change, and refuses the combinations that cannot happen.
 *
 * Cash can be over-tendered, because that is what a twenty for a fiver is.
 * A card cannot: nobody hands over more card than the total, and accepting it
 * silently would mean the till expects change it never gives.
 */
export function settle(
  totals: SaleTotals,
  tenders: readonly Tender[],
  options: { accountAllowed?: boolean } = {},
): Settlement {
  if (totals.lines.length === 0) {
    throw new SaleError('EMPTY', 'There is nothing on this sale.');
  }

  const currency = totals.total.currency;
  const taken = sum(
    tenders.map((tender) => tender.amount),
    currency,
  );

  // A card and a gift card are alike here: nobody hands over more of either
  // than the total, and neither can give change.
  const card = sum(
    tenders
      .filter((tender) => tender.kind === 'CARD' || tender.kind === 'GIFT_CARD')
      .map((tender) => tender.amount),
    currency,
  );

  const account = sum(
    tenders.filter((tender) => tender.kind === 'ACCOUNT').map((tender) => tender.amount),
    currency,
  );

  if (account.minor > 0 && !options.accountAllowed) {
    throw new SaleError(
      'NO_ACCOUNT',
      'This sale has no account customer, so nothing can be put on account.',
    );
  }

  if (card.minor > totals.total.minor) {
    throw new SaleError(
      'OVERPAID_CARD',
      'A card cannot be over-tendered. Take the exact amount on the card.',
    );
  }

  if (taken.minor < totals.total.minor) {
    throw new SaleError('UNDERPAID', `Short by ${format(subtract(totals.total, taken))}.`);
  }

  const cash = sum(
    tenders.filter((tender) => tender.kind === 'CASH').map((tender) => tender.amount),
    currency,
  );

  const change = money(Math.max(0, taken.minor - totals.total.minor), currency);

  // Change only ever comes out of cash. Over-tendering on a card is already
  // refused above, so any surplus is cash the customer handed over.
  if (change.minor > cash.minor) {
    throw new SaleError('OVERPAID_CARD', 'Change can only be given against cash.');
  }

  return { taken, change, onAccount: account };
}

/** The smallest coin, so a till is never asked to give a half penny. */
export function roundToCoin(value: Money, smallestCoinMinor = 1): Money {
  if (smallestCoinMinor <= 1) return value;
  return money(Math.round(value.minor / smallestCoinMinor) * smallestCoinMinor, value.currency);
}

/* ---------------------------------------------------------------------------
   Refunds
   --------------------------------------------------------------------------- */

/**
 * A refund goes back against the original sale, not out of the till at random.
 *
 * Without the link, a refund is indistinguishable from cash going missing, and
 * the stock coming back has nothing saying what it was sold for, so the
 * weighted average quietly moves.
 */
export function assertRefundable(input: {
  status: SaleStatus;
  soldTotal: Money;
  alreadyRefunded: Money;
  refunding: Money;
}): void {
  if (input.status === 'VOID') {
    throw new SaleError('ALREADY_SETTLED', 'This sale was voided, so there is nothing to refund.');
  }

  if (input.status === 'OPEN') {
    throw new SaleError(
      'ALREADY_SETTLED',
      'This sale has not been paid for. Void it instead of refunding it.',
    );
  }

  const remaining = subtract(input.soldTotal, input.alreadyRefunded);

  if (input.refunding.minor > remaining.minor) {
    throw new SaleError(
      'REFUND_EXCEEDS',
      `Only ${format(remaining)} of this sale is left to refund.`,
    );
  }
}

/* ---------------------------------------------------------------------------
   The ledger
   --------------------------------------------------------------------------- */

/**
 * Posts a counter sale.
 *
 * Cash and card land in different accounts because they arrive on different
 * days: card money is a bank receipt whenever the processor settles, cash is
 * in the drawer now. Treating them as one is how a bank reconciliation stops
 * being possible.
 *
 * Cost of sale is posted here too, at the same moment, because there is no job
 * to consume the part later.
 */
export function postCounterSale(input: {
  saleId: string;
  reference: string;
  at: Date;
  totals: SaleTotals;
  settlement: Settlement;
  cardTaken: Money;
  cashTaken: Money;
  /** Spent from gift cards: a liability released, not money in. */
  giftCardTaken?: Money;
  /** Split by kind, so labour is not posted as parts. */
  revenue: { labourNet: Money; partsNet: Money; feeNet: Money };
}): JournalEntryDraft {
  const currency = input.totals.total.currency;
  const lines: JournalEntryDraft['lines'] = [];

  const debit = (accountCode: string, amount: Money, memo?: string) => {
    if (amount.minor === 0) return;
    lines.push({ accountCode, debit: amount, credit: zero(currency), memo });
  };

  const credit = (accountCode: string, amount: Money, memo?: string) => {
    if (amount.minor === 0) return;
    lines.push({ accountCode, debit: zero(currency), credit: amount, memo });
  };

  // What came in. Cash net of change actually given.
  debit(ACCOUNT.CASH, subtract(input.cashTaken, input.settlement.change), 'Into the drawer');
  debit(ACCOUNT.BANK, input.cardTaken, 'Card, settling to the bank');
  if (input.giftCardTaken) {
    debit(ACCOUNT.GIFT_CARDS, input.giftCardTaken, 'Gift card, released');
  }
  debit(ACCOUNT.RECEIVABLE, input.settlement.onAccount, 'On account');

  // What was sold, split by kind. A bulb and half an hour of diagnosis are
  // different businesses with different margins.
  credit(ACCOUNT.PARTS_REVENUE, input.revenue.partsNet, 'Counter sale, parts');
  credit(ACCOUNT.LABOUR_REVENUE, input.revenue.labourNet, 'Counter sale, labour');
  credit(ACCOUNT.FEE_REVENUE, input.revenue.feeNet, 'Counter sale, fees');
  credit(ACCOUNT.TAX_PAYABLE, input.totals.tax, 'Output tax');

  // And what it cost, now rather than when a job consumes it.
  debit(ACCOUNT.COGS_PARTS, input.totals.cost, 'Cost of counter sale');
  credit(ACCOUNT.STOCK, input.totals.cost, 'Off the shelf');

  return {
    reference: input.reference,
    description: 'Counter sale',
    sourceType: 'CounterSale',
    sourceId: input.saleId,
    postedAt: input.at,
    lines,
  };
}

/* ---------------------------------------------------------------------------
   Closing the till
   --------------------------------------------------------------------------- */

export interface TillCount {
  /** What the drawer should hold, from the sales. */
  expected: Money;
  /** What was actually counted. */
  counted: Money;
  variance: Money;
  /** Anything above this is worth investigating rather than absorbing. */
  significant: boolean;
}

export const TILL_TOLERANCE_MINOR = 500;

/**
 * Reconciles the drawer at close of day.
 *
 * The variance is reported rather than absorbed. A till that silently agrees
 * with itself every evening is not a control, it is a formality, and the first
 * anybody learns of a problem is at stocktake.
 */
export function countTill(input: {
  openingFloat: Money;
  cashSales: Money;
  cashRefunds: Money;
  paidOut: Money;
  counted: Money;
}): TillCount {
  const expected = subtract(
    add(input.openingFloat, input.cashSales),
    add(input.cashRefunds, input.paidOut),
  );

  const variance = subtract(input.counted, expected);

  return {
    expected,
    counted: input.counted,
    variance,
    significant: Math.abs(variance.minor) > TILL_TOLERANCE_MINOR,
  };
}

function format(value: Money): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
