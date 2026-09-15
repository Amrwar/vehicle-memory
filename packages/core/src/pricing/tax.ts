import {
  add,
  allocateByWeights,
  type Currency,
  type Money,
  multiply,
  percentOf,
  subtract,
  sum,
  zero,
} from '../shared/money';

/**
 * Tax, configurable. Phase 41.
 *
 * A rate is one or more taxes. Most workshops have one (VAT at 20%). Some
 * have two on the same line, a federal and a provincial tax, and in a few
 * places the second is charged on the price with the first already added.
 * Each tax is computed on its own and rounded on its own, because each is
 * reported to a different authority and each report has to add up.
 *
 * Prices are either before tax, as a trade price list reads, or with tax in,
 * as a price on a counter reads. With tax in, the price is what the customer
 * pays and the taxes are taken out of it; any penny the rounding leaves is
 * given to the largest tax, so the line still comes to the price.
 *
 * An exempt customer pays no tax, and the certificate that says so is kept
 * on the document. With prices that include tax, an exempt customer pays the
 * price with the tax taken out, never the full price with nothing declared.
 */

export interface TaxPart {
  name: string;
  ratePct: number;
  /** Charged on the price plus the taxes before it, rather than on the price alone. */
  compound?: boolean;
}

export interface TaxAmount {
  name: string;
  ratePct: number;
  tax: Money;
}

export type TaxErrorCode =
  | 'NO_NAME'
  | 'NO_TAXES'
  | 'TOO_MANY'
  | 'BAD_RATE'
  | 'DUPLICATE'
  | 'COMPOUND_FIRST'
  | 'NO_CERTIFICATE';

export class TaxError extends Error {
  readonly code: TaxErrorCode;

  constructor(code: TaxErrorCode, message: string) {
    super(message);
    this.name = 'TaxError';
    this.code = code;
  }
}

/** The most taxes one rate may carry. Nobody charges five on a brake pad. */
export const MAX_TAX_PARTS = 3;

/** The name a line with no tax rate carries in the breakdown. */
export const NO_TAX = 'No tax';
/** The name an exempt customer's lines carry in the breakdown. */
export const EXEMPT = 'Exempt';

/** Whether a rate as entered can be saved. */
export function assertTaxRateSound(input: { name: string; parts: readonly TaxPart[] }): void {
  if (!input.name.trim()) {
    throw new TaxError(
      'NO_NAME',
      'Name the rate the way it appears on an invoice: "VAT 20%", "GST and PST".',
    );
  }
  if (input.parts.length === 0) {
    throw new TaxError('NO_TAXES', 'A rate needs at least one tax, even if it is at 0%.');
  }
  if (input.parts.length > MAX_TAX_PARTS) {
    throw new TaxError('TOO_MANY', `A rate carries at most ${MAX_TAX_PARTS} taxes.`);
  }
  const seen = new Set<string>();
  input.parts.forEach((part, index) => {
    const name = part.name.trim();
    if (!name) {
      throw new TaxError(
        'NO_NAME',
        `Name tax ${index + 1} as the authority names it: "GST", "PST".`,
      );
    }
    if (!Number.isFinite(part.ratePct) || part.ratePct < 0 || part.ratePct > 100) {
      throw new TaxError('BAD_RATE', `${name} must be a percentage from 0 to 100.`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new TaxError('DUPLICATE', `${name} is on this rate twice.`);
    }
    seen.add(key);
    if (index === 0 && part.compound) {
      throw new TaxError(
        'COMPOUND_FIRST',
        `${name} is the first tax, so there is nothing before it to be charged on.`,
      );
    }
  });
}

/**
 * What the taxes come to as one percentage of the price before tax. Simple
 * taxes add; a compound tax is charged on what came before it too.
 */
export function effectiveRatePct(parts: readonly TaxPart[]): number {
  let taxed = 0;
  for (const part of parts) {
    const base = 1 + (part.compound ? taxed : 0);
    taxed += (base * part.ratePct) / 100;
  }
  return Math.round(taxed * 100 * 1_000_000) / 1_000_000;
}

function taxesOnNet(net: Money, parts: readonly TaxPart[]): TaxAmount[] {
  let running = zero(net.currency);
  return parts.map((part) => {
    const base = part.compound ? add(net, running) : net;
    const tax = percentOf(base, part.ratePct);
    running = add(running, tax);
    return { name: part.name, ratePct: part.ratePct, tax };
  });
}

export interface LineTax {
  net: Money;
  taxes: TaxAmount[];
  tax: Money;
  total: Money;
}

/**
 * The tax on one line's amount after discount.
 *
 * Before tax: each tax on the amount, the total on top. With tax in: the net
 * is the amount divided by one plus the effective rate, each tax is worked out
 * on that net, and the rounding penny goes to the largest tax so the line
 * still totals the price.
 */
export function taxOnLine(input: {
  amount: Money;
  parts: readonly TaxPart[];
  pricesIncludeTax?: boolean;
  exempt?: boolean;
}): LineTax {
  const { amount, parts } = input;
  const currency = amount.currency;

  if (!input.pricesIncludeTax) {
    if (input.exempt) return { net: amount, taxes: [], tax: zero(currency), total: amount };
    const taxes = taxesOnNet(amount, parts);
    const tax = sum(
      taxes.map((entry) => entry.tax),
      currency,
    );
    return { net: amount, taxes, tax, total: add(amount, tax) };
  }

  const effective = effectiveRatePct(parts);
  const net = multiply(amount, 1 / (1 + effective / 100));

  if (input.exempt) return { net, taxes: [], tax: zero(currency), total: net };

  const taxes = taxesOnNet(net, parts);
  const drift =
    amount.minor - net.minor - taxes.reduce((total, entry) => total + entry.tax.minor, 0);
  if (drift !== 0 && taxes.length > 0) {
    let largest = 0;
    taxes.forEach((entry, index) => {
      if (entry.tax.minor > taxes[largest]!.tax.minor) largest = index;
    });
    const target = taxes[largest]!;
    taxes[largest] = { ...target, tax: { minor: target.tax.minor + drift, currency } };
  }
  const tax = sum(
    taxes.map((entry) => entry.tax),
    currency,
  );
  // With no taxes to take the penny, the net is the price.
  const settledNet = taxes.length === 0 ? amount : net;
  return { net: settledNet, taxes, tax, total: add(settledNet, tax) };
}

/** The certificate an exemption rests on. Without one, it is a discount nobody can defend. */
export function assertExemption(input: { exempt: boolean; reference?: string | null }): void {
  if (input.exempt && (input.reference ?? '').trim().length < 3) {
    throw new TaxError(
      'NO_CERTIFICATE',
      'An exempt customer needs the certificate or registration number that makes them exempt. It is printed on every invoice to them.',
    );
  }
}

/** The rate a new line takes: the site's own where it has one, else the workshop's default. */
export function chooseTaxRate(input: {
  siteRateId?: string | null;
  defaultRateId?: string | null;
}): string | null {
  return input.siteRateId ?? input.defaultRateId ?? null;
}

export interface TaxBandLike {
  name: string;
  ratePct: number;
  net: Money;
  tax: Money;
}

/**
 * A credit note's share of each tax on the invoice it credits. The credited
 * tax is spread by what each tax came to, to the penny, so the shares add up
 * to the tax the credit note takes back. Each tax's taxable amount is reduced
 * in the same proportion as the invoice, because two taxes on the same line
 * were each charged on all of it.
 */
export function creditShares(
  bands: readonly TaxBandLike[],
  credit: { tax: Money; ratio: number },
): TaxBandLike[] {
  if (bands.length === 0) return [];
  const taxes = allocateByWeights(
    credit.tax,
    bands.map((band) => band.tax.minor),
  );
  return bands.map((band, index) => ({
    name: band.name,
    ratePct: band.ratePct,
    net: multiply(band.net, credit.ratio),
    tax: taxes[index]!,
  }));
}

export type TaxSource = 'INVOICE' | 'CREDIT_NOTE' | 'COUNTER_SALE';

export interface TaxEntryLike {
  name: string;
  ratePct: number;
  sourceType: TaxSource;
  /** Signed: a credit note and a counter refund are negative. */
  net: Money;
  tax: Money;
}

export interface TaxReportRow {
  name: string;
  ratePct: number;
  salesNet: Money;
  salesTax: Money;
  creditedNet: Money;
  creditedTax: Money;
  net: Money;
  tax: Money;
  documents: number;
}

/**
 * One row per tax and rate for a period: what was charged, what was given
 * back, and what is owed. A tax that changed rate mid-period is two rows,
 * because each is declared separately.
 */
export function taxReport(
  entries: readonly TaxEntryLike[],
  currency: Currency,
): { rows: TaxReportRow[]; net: Money; tax: Money } {
  const rows = new Map<string, TaxReportRow>();
  const nothing = zero(currency);

  for (const entry of entries) {
    const key = `${entry.name} ${entry.ratePct}`;
    const row = rows.get(key) ?? {
      name: entry.name,
      ratePct: entry.ratePct,
      salesNet: nothing,
      salesTax: nothing,
      creditedNet: nothing,
      creditedTax: nothing,
      net: nothing,
      tax: nothing,
      documents: 0,
    };
    const giving = entry.tax.minor < 0 || entry.net.minor < 0;
    if (giving) {
      row.creditedNet = subtract(row.creditedNet, entry.net);
      row.creditedTax = subtract(row.creditedTax, entry.tax);
    } else {
      row.salesNet = add(row.salesNet, entry.net);
      row.salesTax = add(row.salesTax, entry.tax);
    }
    row.net = add(row.net, entry.net);
    row.tax = add(row.tax, entry.tax);
    row.documents += 1;
    rows.set(key, row);
  }

  const sorted = [...rows.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.ratePct - b.ratePct,
  );
  return {
    rows: sorted,
    net: sum(
      sorted.map((row) => row.net),
      currency,
    ),
    tax: sum(
      sorted.map((row) => row.tax),
      currency,
    ),
  };
}
