import {
  add,
  allocateByWeights,
  type Currency,
  fromDecimal,
  type Money,
  money,
  multiply,
  percentOf,
  subtract,
  sum,
  zero,
} from '../shared/money';

/**
 * Document totals for estimates, jobs and invoices.
 *
 * The rules that matter, and why:
 *
 * 1. **Tax is computed per line and then summed**, never by applying a rate to
 *    the subtotal. A document mixing 20% VAT parts with a zero-rated fee gives
 *    a different answer each way, and only the per-line answer is correct.
 *
 * 2. **Each line is rounded to minor units before summing.** Summing unrounded
 *    values and rounding once produces a total that does not equal the sum of
 *    the printed lines. A customer adding up the invoice by hand must reach
 *    the printed total, or they will not trust anything else on the page.
 *
 * 3. **Totals are always derived, never stored as an independent truth**
 *    (invariant J4). Stored totals drift the first time a line changes
 *    through a path that forgot to recompute.
 */

export type LineKind = 'LABOUR' | 'PART' | 'FEE' | 'DISCOUNT';

export interface PriceableLine {
  kind: LineKind;
  /** Hours for labour, units for parts, 1 for a fee. */
  quantity: number;
  /** Unit price in major units, e.g. 128.50. */
  unitPrice: number | string;
  /** Cost to the workshop, used for margin. Not shown to the customer. */
  unitCost?: number | string;
  /** Line discount as a percentage, 0 to 100. */
  discountPct?: number;
  /** Tax rate as a percentage, e.g. 20 for 20% VAT. */
  taxRatePct?: number;
  /** Excluded from totals until the customer opts in. */
  isOptional?: boolean;
  /** Set when the customer has declined this line. FR-806. */
  declined?: boolean;
}

export interface LineTotal {
  gross: Money;
  discount: Money;
  net: Money;
  tax: Money;
  total: Money;
  cost: Money;
  margin: Money;
  marginPct: number | null;
}

export interface DocumentTotals {
  currency: Currency;
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  total: Money;
  costTotal: Money;
  grossProfit: Money;
  marginPct: number | null;
  /** Tax broken down by rate, which every tax authority requires on an invoice. */
  taxBreakdown: TaxBand[];
  lines: LineTotal[];
}

export interface TaxBand {
  ratePct: number;
  net: Money;
  tax: Money;
}

export function calculateLine(line: PriceableLine, currency: Currency = 'GBP'): LineTotal {
  const unitPrice = fromDecimal(line.unitPrice, currency);
  const unitCost = fromDecimal(line.unitCost ?? 0, currency);

  const gross = multiply(unitPrice, line.quantity);
  const discount = percentOf(gross, clampPercent(line.discountPct ?? 0));
  const net = subtract(gross, discount);
  const tax = percentOf(net, line.taxRatePct ?? 0);
  const total = add(net, tax);
  const cost = multiply(unitCost, line.quantity);
  const margin = subtract(net, cost);

  return {
    gross,
    discount,
    net,
    tax,
    total,
    cost,
    margin,
    marginPct: net.minor === 0 ? null : round2((margin.minor / net.minor) * 100),
  };
}

/**
 * Lines counted towards the total. Optional lines the customer has not taken,
 * and lines they have declined, are excluded — but they remain on the
 * document, because "we offered this and you said no" is exactly the record
 * that prevents an argument later.
 */
function isChargeable(line: PriceableLine): boolean {
  return !line.declined && !line.isOptional;
}

export function calculateTotals(
  lines: readonly PriceableLine[],
  currency: Currency = 'GBP',
): DocumentTotals {
  const chargeable = lines.filter(isChargeable);
  const lineTotals = lines.map((line) => calculateLine(line, currency));
  const chargeableTotals = chargeable.map((line) => calculateLine(line, currency));

  const subtotal = sum(
    chargeableTotals.map((l) => l.net),
    currency,
  );
  const discountTotal = sum(
    chargeableTotals.map((l) => l.discount),
    currency,
  );
  const taxTotal = sum(
    chargeableTotals.map((l) => l.tax),
    currency,
  );
  const costTotal = sum(
    chargeableTotals.map((l) => l.cost),
    currency,
  );
  const total = add(subtotal, taxTotal);
  const grossProfit = subtract(subtotal, costTotal);

  return {
    currency,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    costTotal,
    grossProfit,
    marginPct: subtotal.minor === 0 ? null : round2((grossProfit.minor / subtotal.minor) * 100),
    taxBreakdown: buildTaxBreakdown(chargeable, chargeableTotals, currency),
    lines: lineTotals,
  };
}

function buildTaxBreakdown(
  lines: readonly PriceableLine[],
  totals: readonly LineTotal[],
  currency: Currency,
): TaxBand[] {
  const bands = new Map<number, { net: Money; tax: Money }>();

  lines.forEach((line, index) => {
    const computed = totals[index];
    if (!computed) return;

    const ratePct = line.taxRatePct ?? 0;
    const existing = bands.get(ratePct) ?? { net: zero(currency), tax: zero(currency) };

    bands.set(ratePct, {
      net: add(existing.net, computed.net),
      tax: add(existing.tax, computed.tax),
    });
  });

  return [...bands.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ratePct, { net, tax }]) => ({ ratePct, net, tax }));
}

/**
 * Applies a document-level discount across lines proportionally, preserving
 * the total to the penny. Used when a workshop knocks a round figure off a
 * job as a goodwill gesture: the reduction has to land somewhere real so that
 * tax and margin stay correct.
 */
export function applyDocumentDiscount(
  lines: readonly PriceableLine[],
  discount: Money,
  currency: Currency = 'GBP',
): PriceableLine[] {
  const chargeable = lines.map((line) =>
    isChargeable(line) ? calculateLine(line, currency) : null,
  );
  const weights = chargeable.map((l) => l?.net.minor ?? 0);
  const shares = allocateByWeights(discount, weights);

  return lines.map((line, index) => {
    const computed = chargeable[index];
    const share = shares[index];
    if (!computed || !share || computed.net.minor === 0) return line;

    const existingDiscount = line.discountPct ?? 0;
    const additional = (share.minor / computed.gross.minor) * 100;

    return { ...line, discountPct: clampPercent(existingDiscount + additional) };
  });
}

/**
 * Whether work exceeds the approved figure by more than the organisation's
 * tolerance, and therefore needs re-approval. FR-812, story G3.
 */
export function needsReapproval(
  approvedTotal: Money,
  currentTotal: Money,
  thresholdPct: number,
): boolean {
  if (approvedTotal.minor <= 0) return currentTotal.minor > 0;

  const allowance = add(approvedTotal, percentOf(approvedTotal, thresholdPct));
  return currentTotal.minor > allowance.minor;
}

/**
 * Job profitability (FR-613). Labour cost comes from clocked time at the
 * technician's cost rate, not from the charged hours — the distinction
 * between a labour line and a time entry is the whole point of keeping both.
 */
export interface ProfitabilityInput {
  revenue: Money;
  partsCost: Money;
  labourMinutes: number;
  labourCostPerHour: number | string;
  otherCost?: Money;
  currency?: Currency;
}

export interface Profitability {
  revenue: Money;
  partsCost: Money;
  labourCost: Money;
  otherCost: Money;
  grossProfit: Money;
  marginPct: number | null;
}

export function calculateProfitability(input: ProfitabilityInput): Profitability {
  const currency = input.currency ?? input.revenue.currency;
  const hourlyCost = fromDecimal(input.labourCostPerHour, currency);
  const labourCost = money(Math.round((hourlyCost.minor * input.labourMinutes) / 60), currency);
  const otherCost = input.otherCost ?? zero(currency);

  const grossProfit = subtract(
    subtract(subtract(input.revenue, input.partsCost), labourCost),
    otherCost,
  );

  return {
    revenue: input.revenue,
    partsCost: input.partsCost,
    labourCost,
    otherCost,
    grossProfit,
    marginPct:
      input.revenue.minor === 0 ? null : round2((grossProfit.minor / input.revenue.minor) * 100),
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
