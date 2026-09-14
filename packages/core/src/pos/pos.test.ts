import { describe, expect, it } from 'vitest';

import { assertBalanced } from '../accounting/posting';
import { money, toDecimalString } from '../shared/money';
import {
  assertRefundable,
  countTill,
  postCounterSale,
  revenueSplit,
  roundToCoin,
  SaleError,
  saleTotals,
  settle,
  TILL_TOLERANCE_MINOR,
  type SaleLine,
} from './counter';
import { csvField, csvFilename, csvHeaders, toCsv, type CsvColumn } from './csv';

const gbp = (major: number) => money(Math.round(major * 100));

const BULB: SaleLine = {
  kind: 'PART',
  description: 'H7 bulb',
  productId: 'p-bulb',
  quantity: 2,
  unitPrice: gbp(6),
  unitCost: gbp(2.4),
  taxRatePct: 20,
  discountPct: 0,
};

const DIAGNOSIS: SaleLine = {
  kind: 'LABOUR',
  description: 'Half hour diagnosis',
  productId: null,
  quantity: 0.5,
  unitPrice: gbp(90),
  unitCost: gbp(34),
  taxRatePct: 20,
  discountPct: 0,
};

/* ===========================================================================
   Totals
   =========================================================================== */

describe('counter sale totals', () => {
  it('totals a simple sale', () => {
    const totals = saleTotals([BULB]);

    expect(toDecimalString(totals.net)).toBe('12.00');
    expect(toDecimalString(totals.tax)).toBe('2.40');
    expect(toDecimalString(totals.total)).toBe('14.40');
  });

  it('carries cost and margin per line', () => {
    const totals = saleTotals([BULB]);

    expect(toDecimalString(totals.cost)).toBe('4.80');
    expect(toDecimalString(totals.grossProfit)).toBe('7.20');
    expect(totals.marginPct).toBe(60);
  });

  it('applies a discount before tax', () => {
    const totals = saleTotals([{ ...BULB, discountPct: 25 }]);

    expect(toDecimalString(totals.discount)).toBe('3.00');
    expect(toDecimalString(totals.net)).toBe('9.00');
    expect(toDecimalString(totals.tax)).toBe('1.80');
  });

  it('taxes each line and sums, never the other way round', () => {
    // Two lines that each round down individually. Taxing the total instead
    // gives a different answer, and it is always the customer who notices.
    const odd: SaleLine = { ...BULB, quantity: 1, unitPrice: gbp(0.15), unitCost: gbp(0.05) };
    const totals = saleTotals([odd, odd]);

    expect(toDecimalString(totals.tax)).toBe('0.06');
  });

  it('reports no margin rather than a wrong one on a free line', () => {
    const free = saleTotals([{ ...BULB, unitPrice: gbp(0) }]);
    expect(free.marginPct).toBeNull();
  });

  it('splits revenue by kind', () => {
    const lines = [BULB, DIAGNOSIS];
    const split = revenueSplit(lines, saleTotals(lines));

    expect(toDecimalString(split.partsNet)).toBe('12.00');
    expect(toDecimalString(split.labourNet)).toBe('45.00');
    expect(split.feeNet.minor).toBe(0);
  });
});

/* ===========================================================================
   Taking the money
   =========================================================================== */

describe('settling', () => {
  const totals = saleTotals([BULB]); // 14.40

  it('gives change against cash', () => {
    const settlement = settle(totals, [{ kind: 'CASH', amount: gbp(20) }]);

    expect(toDecimalString(settlement.change)).toBe('5.60');
  });

  it('gives no change on exact card', () => {
    const settlement = settle(totals, [{ kind: 'CARD', amount: gbp(14.4) }]);
    expect(settlement.change.minor).toBe(0);
  });

  it('takes a split of cash and card', () => {
    const settlement = settle(totals, [
      { kind: 'CARD', amount: gbp(10) },
      { kind: 'CASH', amount: gbp(5) },
    ]);

    expect(toDecimalString(settlement.change)).toBe('0.60');
  });

  it('refuses an over-tendered card', () => {
    // Nobody hands over more card than the total, and a till that expects to
    // give change it never gives will not balance.
    expect(() => settle(totals, [{ kind: 'CARD', amount: gbp(20) }])).toThrow(SaleError);
  });

  it('refuses change that would come out of a card', () => {
    expect(() =>
      settle(totals, [
        { kind: 'CARD', amount: gbp(14.4) },
        { kind: 'CASH', amount: gbp(0) },
      ]),
    ).not.toThrow();
  });

  it('takes a gift card like a card: exact, and never over', () => {
    const settlement = settle(totals, [
      { kind: 'GIFT_CARD', amount: gbp(10), code: 'BCDFGHJKLMNP' },
      { kind: 'CASH', amount: gbp(5) },
    ]);
    expect(toDecimalString(settlement.change)).toBe('0.60');
    expect(() => settle(totals, [{ kind: 'GIFT_CARD', amount: gbp(20) }])).toThrow(SaleError);
  });

  it('says how short a payment is', () => {
    expect(() => settle(totals, [{ kind: 'CASH', amount: gbp(10) }])).toThrow(/Short by £4.40/);
  });

  it('refuses an account sale with no account', () => {
    expect(() => settle(totals, [{ kind: 'ACCOUNT', amount: gbp(14.4) }])).toThrow(/no account/);
  });

  it('allows an account sale when there is one', () => {
    const settlement = settle(totals, [{ kind: 'ACCOUNT', amount: gbp(14.4) }], {
      accountAllowed: true,
    });

    expect(toDecimalString(settlement.onAccount)).toBe('14.40');
  });

  it('refuses an empty sale', () => {
    expect(() => settle(saleTotals([]), [{ kind: 'CASH', amount: gbp(5) }])).toThrow(/nothing on/);
  });

  it('rounds to the smallest coin in use', () => {
    // Where a five-cent coin is the smallest, 1.23 is 1.25.
    expect(toDecimalString(roundToCoin(gbp(1.23), 5))).toBe('1.25');
    expect(toDecimalString(roundToCoin(gbp(1.23)))).toBe('1.23');
  });
});

/* ===========================================================================
   Refunds
   =========================================================================== */

describe('refunds', () => {
  it('allows a refund within what was paid', () => {
    expect(() =>
      assertRefundable({
        status: 'PAID',
        soldTotal: gbp(14.4),
        alreadyRefunded: gbp(0),
        refunding: gbp(14.4),
      }),
    ).not.toThrow();
  });

  it('refuses more than is left', () => {
    expect(() =>
      assertRefundable({
        status: 'PAID',
        soldTotal: gbp(14.4),
        alreadyRefunded: gbp(10),
        refunding: gbp(6),
      }),
    ).toThrow(/Only £4.40/);
  });

  it('refuses a refund against an unpaid sale, and says to void it', () => {
    expect(() =>
      assertRefundable({
        status: 'OPEN',
        soldTotal: gbp(14.4),
        alreadyRefunded: gbp(0),
        refunding: gbp(1),
      }),
    ).toThrow(/Void it/);
  });

  it('refuses a refund against a voided sale', () => {
    expect(() =>
      assertRefundable({
        status: 'VOID',
        soldTotal: gbp(14.4),
        alreadyRefunded: gbp(0),
        refunding: gbp(1),
      }),
    ).toThrow(SaleError);
  });
});

/* ===========================================================================
   The ledger
   =========================================================================== */

describe('posting a counter sale', () => {
  const lines = [BULB, DIAGNOSIS];
  const totals = saleTotals(lines);

  it('balances', () => {
    const entry = postCounterSale({
      saleId: 'sale-1',
      reference: 'POS-0001',
      at: new Date('2026-09-08T14:00:00'),
      totals,
      settlement: settle(totals, [{ kind: 'CASH', amount: gbp(80) }]),
      cardTaken: gbp(0),
      cashTaken: gbp(80),
      revenue: revenueSplit(lines, totals),
    });

    expect(() => assertBalanced(entry)).not.toThrow();
  });

  it('puts cash in the drawer and card in the bank', () => {
    // They arrive on different days. Treating them as one account is how a
    // bank reconciliation stops being possible.
    const entry = postCounterSale({
      saleId: 'sale-2',
      reference: 'POS-0002',
      at: new Date('2026-09-08T14:00:00'),
      totals,
      settlement: settle(totals, [
        { kind: 'CARD', amount: gbp(40) },
        { kind: 'CASH', amount: gbp(40) },
      ]),
      cardTaken: gbp(40),
      cashTaken: gbp(40),
      revenue: revenueSplit(lines, totals),
    });

    expect(entry.lines.some((line) => line.accountCode === '1010' && line.debit.minor > 0)).toBe(
      true,
    );
    expect(entry.lines.some((line) => line.accountCode === '1000' && line.debit.minor > 0)).toBe(
      true,
    );
    expect(() => assertBalanced(entry)).not.toThrow();
  });

  it('takes the cost out of stock at the moment of sale', () => {
    // There is no job to consume the part later.
    const entry = postCounterSale({
      saleId: 'sale-3',
      reference: 'POS-0003',
      at: new Date('2026-09-08T14:00:00'),
      totals,
      settlement: settle(totals, [{ kind: 'CASH', amount: gbp(80) }]),
      cardTaken: gbp(0),
      cashTaken: gbp(80),
      revenue: revenueSplit(lines, totals),
    });

    const stock = entry.lines.find((line) => line.accountCode === '1200');
    const cogs = entry.lines.find((line) => line.accountCode === '5000');

    expect(stock?.credit.minor).toBe(totals.cost.minor);
    expect(cogs?.debit.minor).toBe(totals.cost.minor);
  });

  it('posts labour to labour revenue, not to parts', () => {
    const entry = postCounterSale({
      saleId: 'sale-4',
      reference: 'POS-0004',
      at: new Date('2026-09-08T14:00:00'),
      totals,
      settlement: settle(totals, [{ kind: 'CASH', amount: gbp(80) }]),
      cardTaken: gbp(0),
      cashTaken: gbp(80),
      revenue: revenueSplit(lines, totals),
    });

    expect(entry.lines.find((line) => line.accountCode === '4000')?.credit.minor).toBe(4500);
    expect(entry.lines.find((line) => line.accountCode === '4010')?.credit.minor).toBe(1200);
  });
});

/* ===========================================================================
   The till
   =========================================================================== */

describe('counting the till', () => {
  const base = {
    openingFloat: gbp(100),
    cashSales: gbp(240),
    cashRefunds: gbp(15),
    paidOut: gbp(25),
  };

  it('expects float plus takings less refunds and payouts', () => {
    const count = countTill({ ...base, counted: gbp(300) });
    expect(toDecimalString(count.expected)).toBe('300.00');
    expect(count.variance.minor).toBe(0);
  });

  it('reports a shortfall rather than absorbing it', () => {
    // A till that silently agrees with itself every evening is a formality,
    // not a control.
    const count = countTill({ ...base, counted: gbp(280) });

    expect(toDecimalString(count.variance)).toBe('-20.00');
    expect(count.significant).toBe(true);
  });

  it('leaves a penny or two below the threshold', () => {
    const count = countTill({ ...base, counted: gbp(299) });

    expect(count.variance.minor).toBe(-100);
    expect(count.significant).toBe(false);
    expect(TILL_TOLERANCE_MINOR).toBeGreaterThan(100);
  });

  it('reports a surplus too', () => {
    const count = countTill({ ...base, counted: gbp(320) });
    expect(count.variance.minor).toBeGreaterThan(0);
  });
});

/* ===========================================================================
   CSV
   =========================================================================== */

interface Row {
  partNumber: string;
  name: string;
  quantity: number;
  soldOn: Date;
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: 'Part number', value: (row) => row.partNumber, literal: true },
  { header: 'Name', value: (row) => row.name },
  { header: 'Quantity', value: (row) => row.quantity },
  { header: 'Sold', value: (row) => row.soldOn },
];

describe('csv export', () => {
  const rows: Row[] = [
    { partNumber: '04152', name: 'Oil filter', quantity: 3, soldOn: new Date('2026-03-04') },
  ];

  it('keeps a leading zero', () => {
    // Without this a part number becomes 4152 and nobody notices until
    // somebody orders the wrong thing.
    expect(toCsv(rows, COLUMNS)).toContain('="04152"');
  });

  it('writes dates in a form no locale can reinterpret', () => {
    // 04/03 is March in Britain and April in America.
    expect(toCsv(rows, COLUMNS)).toContain('2026-03-04');
  });

  it('defuses a formula', () => {
    // A customer named this is a real payload, and the workshop exporting
    // their own customer list is the one who runs it.
    const attack = csvField("=cmd|' /c calc'!A1");
    expect(attack.startsWith("'") || attack.startsWith('"\'')).toBe(true);
  });

  it('defuses every character a spreadsheet treats as a formula', () => {
    for (const start of ['=', '+', '-', '@']) {
      expect(csvField(`${start}danger`)).toMatch(/^'/);
    }
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvField('He said "no"')).toBe('"He said ""no"""');
  });

  it('quotes a field containing a comma or a newline', () => {
    expect(csvField('Leeds, West Yorkshire')).toMatch(/^".*"$/);
    // A dot does not match a newline, so this pattern needs the s flag.
    expect(csvField('line one\nline two')).toMatch(/^".*"$/s);
  });

  it('leaves an ordinary field alone', () => {
    expect(csvField('Oil filter')).toBe('Oil filter');
  });

  it('writes a byte order mark and CRLF endings', () => {
    const csv = toCsv(rows, COLUMNS);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
  });

  it('writes an empty cell for a missing value', () => {
    const csv = toCsv(
      [{ ...rows[0]!, name: '' }],
      [
        { header: 'Name', value: (row) => row.name },
        { header: 'Quantity', value: (row) => row.quantity },
      ],
    );

    // The row is present with an empty first cell, not omitted.
    expect(csv.split('\r\n')[1]).toBe(',3');
  });

  it('can declare the separator for a comma-decimal locale', () => {
    expect(toCsv(rows, COLUMNS, { declareSeparator: true })).toContain('sep=,');
  });

  it('names the file after the report and the day', () => {
    expect(csvFilename('Parts profitability', new Date('2026-09-08'))).toBe(
      'parts-profitability-2026-09-08.csv',
    );
  });

  it('sets headers that make a browser save it', () => {
    const headers = csvHeaders('report.csv');

    expect(headers['Content-Disposition']).toContain('attachment');
    expect(headers['Cache-Control']).toBe('no-store');
  });
});
