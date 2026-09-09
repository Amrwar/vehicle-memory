import { describe, expect, it } from 'vitest';

import { fromDecimal, toDecimalString, zero } from '../shared/money';
import {
  ACCOUNT,
  type AccountType,
  accountType,
  normalBalance,
  signedBalance,
  STANDARD_CHART,
  statementFor,
} from './accounts';
import {
  assertBalanced,
  type JournalEntryDraft,
  jobProfit,
  PostingError,
  postCreditNote,
  postGoodsReceived,
  postInvoiceIssued,
  postPartsConsumed,
  postPaymentReceived,
  postStockAdjustment,
  postSupplierBillPaid,
  reverse,
} from './posting';
import {
  ageAnalysis,
  balanceSheet,
  bucketFor,
  type PostedLine,
  profitAndLoss,
  taxReturn,
  trialBalance,
} from './statements';

const gbp = (value: string) => fromDecimal(value);

/* ===========================================================================
   Chart of accounts
   =========================================================================== */

describe('chart of accounts', () => {
  it('has unique codes', () => {
    const codes = STANDARD_CHART.map((account) => account.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  // Getting this backwards still balances, so it survives casual testing while
  // every figure carries the wrong sign.
  it('makes assets and expenses debit-normal, everything else credit-normal', () => {
    expect(normalBalance('ASSET')).toBe('debit');
    expect(normalBalance('EXPENSE')).toBe('debit');
    expect(normalBalance('LIABILITY')).toBe('credit');
    expect(normalBalance('EQUITY')).toBe('credit');
    expect(normalBalance('REVENUE')).toBe('credit');
  });

  it('signs a balance by its normal side', () => {
    // An asset with more debits than credits is positive.
    expect(signedBalance('ASSET', 1000, 400)).toBe(600);
    // A liability with more credits than debits is also positive.
    expect(signedBalance('LIABILITY', 400, 1000)).toBe(600);
  });

  it('routes each type to the right statement', () => {
    expect(statementFor('REVENUE')).toBe('profit-and-loss');
    expect(statementFor('EXPENSE')).toBe('profit-and-loss');
    expect(statementFor('ASSET')).toBe('balance-sheet');
    expect(statementFor('LIABILITY')).toBe('balance-sheet');
    expect(statementFor('EQUITY')).toBe('balance-sheet');
  });

  it('resolves every referenced account code', () => {
    for (const code of Object.values(ACCOUNT)) {
      expect(accountType(code), `account ${code}`).toBeDefined();
    }
  });

  it('treats tax receivable as an asset, not a negative liability', () => {
    // Reclaimable input tax is something owed to the business.
    expect(accountType('2110')).toBe('ASSET');
    expect(accountType('2100')).toBe('LIABILITY');
  });
});

/* ===========================================================================
   Balance enforcement
   =========================================================================== */

describe('balance enforcement', () => {
  const entry = (lines: JournalEntryDraft['lines']): JournalEntryDraft => ({
    reference: 'T1',
    description: 'test',
    sourceType: 'Test',
    sourceId: 'x',
    postedAt: new Date(),
    lines,
  });

  it('rejects an unbalanced entry and names both figures', () => {
    try {
      assertBalanced(
        entry([
          { accountCode: '1000', debit: gbp('100.00'), credit: zero() },
          { accountCode: '4000', debit: zero(), credit: gbp('90.00') },
        ]),
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PostingError);
      expect((error as PostingError).code).toBe('UNBALANCED');
      expect((error as Error).message).toContain('100.00');
      expect((error as Error).message).toContain('90.00');
    }
  });

  it('rejects a line carrying both a debit and a credit', () => {
    expect(() =>
      assertBalanced(
        entry([{ accountCode: '1000', debit: gbp('10.00'), credit: gbp('10.00') }]),
      ),
    ).toThrow(/debit and a credit/);
  });

  it('rejects a negative amount rather than letting it balance', () => {
    expect(() =>
      assertBalanced(
        entry([
          { accountCode: '1000', debit: gbp('-50.00'), credit: zero() },
          { accountCode: '4000', debit: zero(), credit: gbp('-50.00') },
        ]),
      ),
    ).toThrow(/negative/);
  });

  it('rejects an entry with no lines', () => {
    expect(() => assertBalanced(entry([]))).toThrow(/no lines/);
  });
});

/* ===========================================================================
   Posting rules, against the worked example in the accounting model
   =========================================================================== */

describe('invoice issued', () => {
  const posted = postInvoiceIssued({
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-1043',
    customerName: 'Maria Okonkwo',
    issuedAt: new Date('2026-09-09'),
    labourNet: gbp('427.50'),
    partsNet: gbp('830.00'),
    feeNet: zero(),
    taxTotal: gbp('251.50'),
  });

  it('debits receivable with the gross figure', () => {
    const receivable = posted.lines.find((l) => l.accountCode === ACCOUNT.RECEIVABLE)!;
    expect(toDecimalString(receivable.debit)).toBe('1509.00');
  });

  // Lumping revenue into one account makes parts margin permanently
  // unanswerable without re-reading every invoice.
  it('splits revenue by what was actually sold', () => {
    const labour = posted.lines.find((l) => l.accountCode === ACCOUNT.LABOUR_REVENUE)!;
    const parts = posted.lines.find((l) => l.accountCode === ACCOUNT.PARTS_REVENUE)!;
    expect(toDecimalString(labour.credit)).toBe('427.50');
    expect(toDecimalString(parts.credit)).toBe('830.00');
  });

  it('credits output tax separately from revenue', () => {
    const tax = posted.lines.find((l) => l.accountCode === ACCOUNT.TAX_PAYABLE)!;
    expect(toDecimalString(tax.credit)).toBe('251.50');
  });

  it('drops the zero fee line rather than posting it', () => {
    expect(posted.lines.some((l) => l.accountCode === ACCOUNT.FEE_REVENUE)).toBe(false);
  });

  it('balances, and references the invoice that caused it', () => {
    expect(() => assertBalanced(posted)).not.toThrow();
    expect(posted.sourceType).toBe('Invoice');
    expect(posted.sourceId).toBe('inv_1');
  });
});

describe('parts consumed', () => {
  it('moves value from stock to cost of sales', () => {
    const posted = postPartsConsumed({
      jobId: 'job_1',
      jobNumber: 10482,
      cost: gbp('498.00'),
      at: new Date(),
    });
    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.COGS_PARTS)!.debit)).toBe('498.00');
    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.STOCK)!.credit)).toBe('498.00');
  });
});

describe('payment received', () => {
  it('clears receivable and lands in the bank', () => {
    const posted = postPaymentReceived({
      paymentId: 'pay_1',
      reference: 'PAY-1',
      amount: gbp('1509.00'),
      method: 'CARD',
      receivedAt: new Date(),
    });
    expect(posted.lines.find((l) => l.debit.minor > 0)!.accountCode).toBe(ACCOUNT.BANK);
    expect(posted.lines.find((l) => l.credit.minor > 0)!.accountCode).toBe(ACCOUNT.RECEIVABLE);
  });

  it('sends cash to the cash account, not the bank', () => {
    const posted = postPaymentReceived({
      paymentId: 'pay_2',
      reference: 'PAY-2',
      amount: gbp('50.00'),
      method: 'CASH',
      receivedAt: new Date(),
    });
    expect(posted.lines.find((l) => l.debit.minor > 0)!.accountCode).toBe(ACCOUNT.CASH);
  });

  // Treating a deposit as revenue on receipt overstates a good month and
  // understates the one where the work is actually done.
  it('treats a deposit as a liability, not revenue', () => {
    const posted = postPaymentReceived({
      paymentId: 'pay_3',
      reference: 'PAY-3',
      amount: gbp('500.00'),
      method: 'CARD',
      receivedAt: new Date(),
      isDeposit: true,
    });
    expect(posted.lines.find((l) => l.credit.minor > 0)!.accountCode).toBe(ACCOUNT.DEPOSITS);
    expect(accountType(ACCOUNT.DEPOSITS)).toBe('LIABILITY');
  });
});

describe('goods received', () => {
  it('debits stock and input tax, credits the supplier', () => {
    const posted = postGoodsReceived({
      receiptId: 'gr_1',
      reference: 'DN-88210',
      orderNumber: 'PO-2041',
      goodsValue: gbp('498.00'),
      taxValue: gbp('99.60'),
      receivedAt: new Date(),
    });

    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.STOCK)!.debit)).toBe('498.00');
    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.TAX_RECEIVABLE)!.debit)).toBe('99.60');
    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.PAYABLE)!.credit)).toBe('597.60');
  });

  it('clears the payable when the bill is paid', () => {
    const posted = postSupplierBillPaid({
      billId: 'bill_1',
      reference: 'PMF-40128',
      amount: gbp('597.60'),
      paidAt: new Date(),
    });
    expect(posted.lines.find((l) => l.debit.minor > 0)!.accountCode).toBe(ACCOUNT.PAYABLE);
  });
});

describe('stock adjustment', () => {
  it('expenses a shortage', () => {
    const posted = postStockAdjustment({
      movementId: 'sm_1',
      reference: 'ADJ-1',
      value: gbp('-42.00'),
      reason: 'Stocktake shortage',
      at: new Date(),
    });
    expect(posted.lines.find((l) => l.debit.minor > 0)!.accountCode).toBe(ACCOUNT.STOCK_ADJUSTMENT);
    expect(posted.lines.find((l) => l.credit.minor > 0)!.accountCode).toBe(ACCOUNT.STOCK);
  });

  it('reverses the sides for a surplus, without needing a separate rule', () => {
    const posted = postStockAdjustment({
      movementId: 'sm_2',
      reference: 'ADJ-2',
      value: gbp('42.00'),
      reason: 'Stocktake surplus',
      at: new Date(),
    });
    expect(posted.lines.find((l) => l.debit.minor > 0)!.accountCode).toBe(ACCOUNT.STOCK);
  });
});

describe('credit note', () => {
  it('reverses revenue and tax proportionally', () => {
    const posted = postCreditNote({
      creditNoteId: 'cn_1',
      number: 'CN-1',
      invoiceNumber: 'INV-1043',
      labourNet: zero(),
      partsNet: gbp('410.00'),
      feeNet: zero(),
      taxTotal: gbp('82.00'),
      reason: 'Part returned',
      issuedAt: new Date(),
    });

    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.PARTS_REVENUE)!.debit)).toBe('410.00');
    expect(toDecimalString(posted.lines.find((l) => l.accountCode === ACCOUNT.RECEIVABLE)!.credit)).toBe('492.00');
  });
});

describe('reversal', () => {
  it('swaps every side and keeps the source reference', () => {
    const original = postPartsConsumed({
      jobId: 'job_1',
      jobNumber: 1,
      cost: gbp('100.00'),
      at: new Date(),
    });
    const reversed = reverse(original, new Date(), 'posted in error');

    expect(reversed.reference).toBe(`REV-${original.reference}`);
    expect(reversed.sourceId).toBe(original.sourceId);
    expect(
      toDecimalString(reversed.lines.find((l) => l.accountCode === ACCOUNT.STOCK)!.debit),
    ).toBe('100.00');
    expect(() => assertBalanced(reversed)).not.toThrow();
  });
});

/* ===========================================================================
   Statements
   =========================================================================== */

function line(code: string, debit: string, credit: string, when = '2026-09-09'): PostedLine {
  const spec = STANDARD_CHART.find((account) => account.code === code)!;
  return {
    accountCode: code,
    accountName: spec.name,
    accountType: spec.type as AccountType,
    debit: gbp(debit),
    credit: gbp(credit),
    postedAt: new Date(when),
  };
}

/**
 * A complete month: one invoice, its parts cost, the payment, a delivery
 * booked in, and rent. Enough that the statements have to agree with each
 * other rather than merely compute.
 */
const LEDGER: PostedLine[] = [
  // Invoice 1,509.00
  line('1100', '1509.00', '0'),
  line('4000', '0', '427.50'),
  line('4010', '0', '830.00'),
  line('2100', '0', '251.50'),
  // Parts consumed
  line('5000', '498.00', '0'),
  line('1200', '0', '498.00'),
  // Payment received in full
  line('1000', '1509.00', '0'),
  line('1100', '0', '1509.00'),
  // Goods received, 498.00 + 99.60 tax
  line('1200', '498.00', '0'),
  line('2110', '99.60', '0'),
  line('2000', '0', '597.60'),
  // Rent
  line('6100', '800.00', '0'),
  line('1000', '0', '800.00'),
];

describe('trial balance', () => {
  const balance = trialBalance(LEDGER);

  it('balances', () => {
    expect(balance.balanced).toBe(true);
    expect(balance.difference.minor).toBe(0);
  });

  it('aggregates repeated postings to one account', () => {
    const bank = balance.rows.find((row) => row.accountCode === '1000')!;
    expect(toDecimalString(bank.debit)).toBe('1509.00');
    expect(toDecimalString(bank.credit)).toBe('800.00');
    expect(toDecimalString(bank.balance)).toBe('709.00');
  });

  it('leaves a fully settled receivable at zero', () => {
    const receivable = balance.rows.find((row) => row.accountCode === '1100')!;
    expect(receivable.balance.minor).toBe(0);
  });

  it('reports a credit-normal account as positive on its own side', () => {
    const payable = balance.rows.find((row) => row.accountCode === '2000')!;
    expect(toDecimalString(payable.balance)).toBe('597.60');
  });

  it('notices an unbalanced ledger', () => {
    const broken = trialBalance([...LEDGER, line('1000', '10.00', '0')]);
    expect(broken.balanced).toBe(false);
    expect(toDecimalString(broken.difference)).toBe('10.00');
  });
});

describe('profit and loss', () => {
  const pl = profitAndLoss(LEDGER);

  it('totals revenue', () => {
    expect(toDecimalString(pl.totalRevenue)).toBe('1257.50');
  });

  it('separates cost of sales from overhead', () => {
    expect(toDecimalString(pl.totalCostOfSales)).toBe('498.00');
    expect(toDecimalString(pl.totalOverheads)).toBe('800.00');
  });

  it('computes gross profit and margin', () => {
    expect(toDecimalString(pl.grossProfit)).toBe('759.50');
    expect(pl.grossMarginPct).toBeCloseTo(60.4, 1);
  });

  it('computes net profit after overhead', () => {
    expect(toDecimalString(pl.netProfit)).toBe('-40.50');
  });

  it('reports a null margin rather than dividing by zero', () => {
    expect(profitAndLoss([]).grossMarginPct).toBeNull();
  });
});

describe('balance sheet', () => {
  const sheet = balanceSheet(LEDGER);

  // The whole point. If this fails, nothing else on the statement means
  // anything.
  it('balances: assets equal liabilities plus equity', () => {
    expect(sheet.balanced).toBe(true);
    expect(sheet.difference.minor).toBe(0);
  });

  it('counts profit earned but not yet closed as equity', () => {
    // Omitting this is the usual reason a balance sheet fails before close.
    expect(toDecimalString(sheet.retainedThisPeriod)).toBe('-40.50');
  });

  it('totals assets', () => {
    // bank 709.00 + stock 0.00 + tax receivable 99.60
    expect(toDecimalString(sheet.totalAssets)).toBe('808.60');
  });

  it('totals liabilities', () => {
    // payable 597.60 + tax payable 251.50
    expect(toDecimalString(sheet.totalLiabilities)).toBe('849.10');
  });

  it('still balances on an empty ledger', () => {
    expect(balanceSheet([]).balanced).toBe(true);
  });
});

describe('tax return', () => {
  it('nets output tax against input tax', () => {
    const result = taxReturn(LEDGER);
    expect(toDecimalString(result.outputTax)).toBe('251.50');
    expect(toDecimalString(result.inputTax)).toBe('99.60');
    expect(toDecimalString(result.net)).toBe('151.90');
    expect(result.owed).toBe(true);
  });

  it('reports a reclaim when input exceeds output', () => {
    const result = taxReturn([line('2110', '500.00', '0'), line('2000', '0', '500.00')]);
    expect(result.owed).toBe(false);
  });
});

/* ===========================================================================
   Ageing
   =========================================================================== */

const asOf = new Date('2026-09-09');
const daysBefore = (n: number) => new Date(asOf.getTime() - n * 86_400_000);

describe('ageing', () => {
  it('buckets by how far past due', () => {
    expect(bucketFor(daysBefore(-5), asOf)).toBe('current');
    expect(bucketFor(daysBefore(10), asOf)).toBe('1-30');
    expect(bucketFor(daysBefore(45), asOf)).toBe('31-60');
    expect(bucketFor(daysBefore(75), asOf)).toBe('61-90');
    expect(bucketFor(daysBefore(120), asOf)).toBe('90+');
  });

  it('treats a document with no due date as current', () => {
    expect(bucketFor(null, asOf)).toBe('current');
  });

  it('totals each bucket and flags what is worth chasing today', () => {
    const analysis = ageAnalysis(
      [
        { id: '1', reference: 'INV-1', partyName: 'A', outstanding: gbp('100.00'), dueAt: daysBefore(-2) },
        { id: '2', reference: 'INV-2', partyName: 'B', outstanding: gbp('200.00'), dueAt: daysBefore(20) },
        { id: '3', reference: 'INV-3', partyName: 'C', outstanding: gbp('300.00'), dueAt: daysBefore(70) },
        { id: '4', reference: 'INV-4', partyName: 'D', outstanding: gbp('400.00'), dueAt: daysBefore(200) },
      ],
      asOf,
    );

    expect(toDecimalString(analysis.buckets.current)).toBe('100.00');
    expect(toDecimalString(analysis.buckets['1-30'])).toBe('200.00');
    expect(toDecimalString(analysis.total)).toBe('1000.00');
    // Past 60 days is the part worth a phone call today.
    expect(toDecimalString(analysis.atRisk)).toBe('700.00');
  });

  it('lists the oldest debt first', () => {
    const analysis = ageAnalysis(
      [
        { id: '1', reference: 'A', partyName: 'A', outstanding: gbp('10.00'), dueAt: daysBefore(5) },
        { id: '2', reference: 'B', partyName: 'B', outstanding: gbp('10.00'), dueAt: daysBefore(90) },
      ],
      asOf,
    );
    expect(analysis.documents[0]!.reference).toBe('B');
  });

  it('ignores settled documents', () => {
    const analysis = ageAnalysis(
      [{ id: '1', reference: 'A', partyName: 'A', outstanding: zero(), dueAt: daysBefore(90) }],
      asOf,
    );
    expect(analysis.documents).toHaveLength(0);
    expect(analysis.total.minor).toBe(0);
  });
});

/* ===========================================================================
   Job profitability
   =========================================================================== */

describe('job profitability', () => {
  it('computes gross profit and both margins', () => {
    const profit = jobProfit({
      labourRevenue: gbp('427.50'),
      partsRevenue: gbp('830.00'),
      feeRevenue: zero(),
      partsCost: gbp('498.00'),
      labourCost: gbp('197.60'),
    });

    expect(toDecimalString(profit.revenue)).toBe('1257.50');
    expect(toDecimalString(profit.grossProfit)).toBe('561.90');
    expect(profit.marginPct).toBeCloseTo(44.7, 1);
    // Parts margin separately: where quiet leakage happens.
    expect(profit.partsMarginPct).toBeCloseTo(40.0, 1);
  });

  it('reports a loss honestly', () => {
    const profit = jobProfit({
      labourRevenue: gbp('100.00'),
      partsRevenue: zero(),
      feeRevenue: zero(),
      partsCost: gbp('150.00'),
      labourCost: gbp('80.00'),
    });
    expect(profit.grossProfit.minor).toBeLessThan(0);
    expect(profit.marginPct).toBeLessThan(0);
  });

  it('returns null margins on a zero-value job', () => {
    const profit = jobProfit({
      labourRevenue: zero(),
      partsRevenue: zero(),
      feeRevenue: zero(),
      partsCost: zero(),
      labourCost: zero(),
    });
    expect(profit.marginPct).toBeNull();
    expect(profit.partsMarginPct).toBeNull();
  });
});
