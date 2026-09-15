import { describe, expect, it } from 'vitest';

import { money, toDecimalString } from '../shared/money';
import { calculateTotals, type PriceableLine } from './totals';
import {
  assertExemption,
  assertTaxRateSound,
  chooseTaxRate,
  creditShares,
  effectiveRatePct,
  taxOnLine,
  TaxError,
  taxReport,
} from './index';
import { saleTotals } from '../pos/counter';

const gbp = (minor: number) => money(minor, 'GBP');
const cad = (minor: number) => money(minor, 'CAD');

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof TaxError ? error.code : 'OTHER';
  }
}

const GST = { name: 'GST', ratePct: 5 };
const PST = { name: 'PST', ratePct: 7 };
const QST_COMPOUND = { name: 'QST', ratePct: 9.975, compound: true };

describe('a rate as entered', () => {
  it('accepts one tax or several', () => {
    expect(
      code(() => assertTaxRateSound({ name: 'VAT 20%', parts: [{ name: 'VAT', ratePct: 20 }] })),
    ).toBeNull();
    expect(code(() => assertTaxRateSound({ name: 'GST and PST', parts: [GST, PST] }))).toBeNull();
    expect(
      code(() => assertTaxRateSound({ name: 'GST and QST', parts: [GST, QST_COMPOUND] })),
    ).toBeNull();
  });

  it('refuses what cannot be declared', () => {
    expect(code(() => assertTaxRateSound({ name: ' ', parts: [GST] }))).toBe('NO_NAME');
    expect(code(() => assertTaxRateSound({ name: 'Nothing', parts: [] }))).toBe('NO_TAXES');
    expect(
      code(() =>
        assertTaxRateSound({
          name: 'Four',
          parts: [GST, PST, { name: 'A', ratePct: 1 }, { name: 'B', ratePct: 1 }],
        }),
      ),
    ).toBe('TOO_MANY');
    expect(
      code(() => assertTaxRateSound({ name: 'Bad', parts: [{ name: 'VAT', ratePct: 120 }] })),
    ).toBe('BAD_RATE');
    expect(
      code(() => assertTaxRateSound({ name: 'Twice', parts: [GST, { name: 'gst', ratePct: 1 }] })),
    ).toBe('DUPLICATE');
    expect(code(() => assertTaxRateSound({ name: 'Odd', parts: [QST_COMPOUND] }))).toBe(
      'COMPOUND_FIRST',
    );
    expect(
      code(() => assertTaxRateSound({ name: 'Unnamed', parts: [{ name: '', ratePct: 5 }] })),
    ).toBe('NO_NAME');
  });
});

describe('several taxes on a line', () => {
  it('adds simple taxes and compounds a compound one', () => {
    expect(effectiveRatePct([GST, PST])).toBe(12);
    expect(effectiveRatePct([GST, QST_COMPOUND])).toBe(15.47375);
    expect(effectiveRatePct([])).toBe(0);
  });

  it('works each tax out on its own, before tax', () => {
    const line = taxOnLine({ amount: cad(10_000), parts: [GST, PST] });
    expect(line.taxes.map((t) => [t.name, t.tax.minor])).toEqual([
      ['GST', 500],
      ['PST', 700],
    ]);
    expect([line.net.minor, line.tax.minor, line.total.minor]).toEqual([10_000, 1_200, 11_200]);
  });

  it('charges a compound tax on the price with the first tax in', () => {
    const line = taxOnLine({ amount: cad(10_000), parts: [GST, QST_COMPOUND] });
    // QST on 105.00 at 9.975% is 10.47375, rounded to 10.47.
    expect(line.taxes.map((t) => t.tax.minor)).toEqual([500, 1_047]);
    expect(line.total.minor).toBe(11_547);
  });

  it('charges nothing to an exempt customer', () => {
    const line = taxOnLine({
      amount: gbp(10_000),
      parts: [{ name: 'VAT', ratePct: 20 }],
      exempt: true,
    });
    expect([line.net.minor, line.tax.minor, line.total.minor, line.taxes.length]).toEqual([
      10_000, 0, 10_000, 0,
    ]);
  });
});

describe('prices with tax in', () => {
  it('takes the tax out of the price and still comes to the price', () => {
    const line = taxOnLine({
      amount: gbp(12_000),
      parts: [{ name: 'VAT', ratePct: 20 }],
      pricesIncludeTax: true,
    });
    expect([line.net.minor, line.tax.minor, line.total.minor]).toEqual([10_000, 2_000, 12_000]);
  });

  it('gives the rounding penny to the largest tax', () => {
    const line = taxOnLine({ amount: cad(999), parts: [GST, PST], pricesIncludeTax: true });
    expect(line.total.minor).toBe(999);
    expect(line.net.minor + line.tax.minor).toBe(999);
    // 9.99 / 1.12 = 8.92; GST 0.45, PST 0.62 would be 9.99 exactly or off by one.
    expect(line.net.minor).toBe(892);
    expect(line.taxes.reduce((t, e) => t + e.tax.minor, 0)).toBe(107);
  });

  it('charges an exempt customer the price with the tax taken out', () => {
    const line = taxOnLine({
      amount: gbp(12_000),
      parts: [{ name: 'VAT', ratePct: 20 }],
      pricesIncludeTax: true,
      exempt: true,
    });
    expect([line.net.minor, line.tax.minor, line.total.minor]).toEqual([10_000, 0, 10_000]);
  });

  it('holds over many awkward prices', () => {
    for (let minor = 1; minor < 3_000; minor += 7) {
      const line = taxOnLine({
        amount: cad(minor),
        parts: [GST, QST_COMPOUND],
        pricesIncludeTax: true,
      });
      expect(line.net.minor + line.tax.minor).toBe(minor);
    }
  });
});

describe('on a document', () => {
  it('breaks the tax down by each tax, each counting the net it was charged on', () => {
    const lines: PriceableLine[] = [
      { kind: 'LABOUR', quantity: 1, unitPrice: '100.00', taxes: [GST, PST] },
      { kind: 'FEE', quantity: 1, unitPrice: '10.00', taxes: [GST] },
    ];
    const totals = calculateTotals(lines, 'CAD');
    expect(
      totals.taxBreakdown.map((b) => [
        b.name,
        b.ratePct,
        toDecimalString(b.net),
        toDecimalString(b.tax),
      ]),
    ).toEqual([
      ['GST', 5, '110.00', '5.50'],
      ['PST', 7, '100.00', '7.00'],
    ]);
    expect(toDecimalString(totals.taxTotal)).toBe('12.50');
    expect(toDecimalString(totals.total)).toBe('122.50');
  });

  it('names an exempt customer’s lines as exempt', () => {
    const totals = calculateTotals([
      { kind: 'PART', quantity: 2, unitPrice: '5.00', taxRatePct: 20, taxExempt: true },
    ]);
    expect(
      totals.taxBreakdown.map((b) => [b.name, toDecimalString(b.net), toDecimalString(b.tax)]),
    ).toEqual([['Exempt', '10.00', '0.00']]);
  });

  it('prices a counter sale the same way', () => {
    const totals = saleTotals(
      [
        {
          kind: 'PART',
          description: 'Bulb',
          productId: null,
          quantity: 1,
          unitPrice: gbp(600),
          unitCost: gbp(200),
          taxRatePct: 20,
          discountPct: 0,
          pricesIncludeTax: true,
        },
      ],
      'GBP',
    );
    expect([totals.net.minor, totals.tax.minor, totals.total.minor]).toEqual([500, 100, 600]);
  });
});

describe('the rest', () => {
  it('needs a certificate for an exemption', () => {
    expect(code(() => assertExemption({ exempt: true, reference: '' }))).toBe('NO_CERTIFICATE');
    expect(code(() => assertExemption({ exempt: true, reference: 'EX-4471' }))).toBeNull();
    expect(code(() => assertExemption({ exempt: false }))).toBeNull();
  });

  it('prefers the site’s rate', () => {
    expect(chooseTaxRate({ siteRateId: 'site', defaultRateId: 'org' })).toBe('site');
    expect(chooseTaxRate({ siteRateId: null, defaultRateId: 'org' })).toBe('org');
    expect(chooseTaxRate({})).toBeNull();
  });

  it('spreads a credit across the taxes to the penny', () => {
    const shares = creditShares(
      [
        { name: 'GST', ratePct: 5, net: cad(11_000), tax: cad(550) },
        { name: 'PST', ratePct: 7, net: cad(10_000), tax: cad(700) },
      ],
      { tax: cad(625), ratio: 0.5 },
    );
    expect(shares.map((s) => [s.name, s.net.minor, s.tax.minor])).toEqual([
      ['GST', 5_500, 275],
      ['PST', 5_000, 350],
    ]);
  });

  it('reports each tax with what was charged and what was given back', () => {
    const report = taxReport(
      [
        { name: 'VAT', ratePct: 20, sourceType: 'INVOICE', net: gbp(10_000), tax: gbp(2_000) },
        { name: 'VAT', ratePct: 20, sourceType: 'COUNTER_SALE', net: gbp(500), tax: gbp(100) },
        { name: 'VAT', ratePct: 20, sourceType: 'CREDIT_NOTE', net: gbp(-1_000), tax: gbp(-200) },
        { name: 'VAT', ratePct: 5, sourceType: 'INVOICE', net: gbp(1_000), tax: gbp(50) },
      ],
      'GBP',
    );
    expect(
      report.rows.map((r) => [
        r.name,
        r.ratePct,
        r.salesTax.minor,
        r.creditedTax.minor,
        r.tax.minor,
        r.documents,
      ]),
    ).toEqual([
      ['VAT', 5, 50, 0, 50, 1],
      ['VAT', 20, 2_100, 200, 1_900, 3],
    ]);
    expect(report.tax.minor).toBe(1_950);
  });
});
