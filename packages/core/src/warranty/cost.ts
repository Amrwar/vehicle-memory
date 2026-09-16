import { add, type Money, subtract, sum, zero } from '../shared/money';

import { WarrantyError } from './cover';

/**
 * What warranty work actually costs the workshop. Phase 44.
 *
 * Until now a claim carried what the customer had been charged: the value of
 * the parts and the labour on the original job. That is the right figure for
 * deciding whether to entertain a claim and the wrong one for deciding
 * whether a product is worth stocking. Redoing a job does not cost the
 * workshop what it charged for it; it costs the parts at cost and the hours
 * at the technician's rate, and only the difference between that and what a
 * supplier pays back is money that has actually gone.
 *
 * So a settled claim records three figures: what the remedy cost, what was
 * recovered, and therefore what was carried. A workshop that never records
 * the third has no idea which of its suppliers is expensive.
 */

export interface ClaimCost {
  /** Parts on the remedy, at what the workshop paid for them. */
  partsCost: Money;
  /** Hours on the remedy, at the technician's cost rate. */
  labourCost: Money;
  /** What a supplier, insurer or manufacturer actually paid back. */
  recovered: Money;
}

export interface ClaimPosted extends ClaimCost {
  cost: Money;
  /** Cost less what came back: what the workshop carried. */
  net: Money;
}

/** The three figures, added up. */
export function claimPosition(input: ClaimCost): ClaimPosted {
  const cost = add(input.partsCost, input.labourCost);

  return {
    ...input,
    cost,
    net: subtract(cost, input.recovered),
  };
}

/**
 * Whether a claim can be settled with these figures.
 *
 * Recovering more than the work cost is not generosity, it is a typo or a
 * credit note that belongs somewhere else, and letting it through makes
 * warranty look profitable.
 */
export function assertSettlement(input: { cost: Money; recovered: Money; outcome: string }): void {
  if (!input.outcome.trim()) {
    throw new WarrantyError(
      'NO_REASON',
      'Say how it was settled. A claim closed with nothing against it tells the next person nothing.',
    );
  }

  if (input.recovered.minor < 0 || input.cost.minor < 0) {
    throw new WarrantyError('BAD_SETTLEMENT', 'Neither figure can be less than nothing.');
  }

  if (input.recovered.minor > input.cost.minor) {
    throw new WarrantyError(
      'BAD_SETTLEMENT',
      'More has been recovered than the work cost. Either the cost is understated or part of that credit belongs to another claim.',
    );
  }
}

export interface SettledClaim {
  id: string;
  /** What the failed part was, for grouping. */
  productName: string | null;
  supplierName: string | null;
  cost: Money;
  recovered: Money;
  net: Money;
  /** True where the workshop chose to help outside its own cover. */
  goodwill: boolean;
  settledAt: Date;
}

export interface WarrantyCost {
  claims: number;
  cost: Money;
  recovered: Money;
  net: Money;
  /** Of what was spent, the share somebody else paid. Null with nothing spent. */
  recoveryPct: number | null;
  /** What was carried as a share of revenue. Null without revenue. */
  ofRevenuePct: number | null;
  /** The part of the net that was given rather than owed. */
  goodwill: Money;
}

/**
 * Warranty over a period, against what the workshop turned over.
 *
 * The share of revenue is the number that means something. A workshop
 * carrying two per cent of its turnover in warranty is running a normal
 * shop; one carrying eight is either buying bad parts or fitting them badly,
 * and which of the two it is comes from the rows underneath.
 */
export function warrantyCost(
  claims: readonly SettledClaim[],
  revenue: Money,
  currency = revenue.currency,
): WarrantyCost {
  const cost = sum(
    claims.map((claim) => claim.cost),
    currency,
  );
  const recovered = sum(
    claims.map((claim) => claim.recovered),
    currency,
  );
  const net = subtract(cost, recovered);

  return {
    claims: claims.length,
    cost,
    recovered,
    net,
    recoveryPct: cost.minor > 0 ? round1((recovered.minor / cost.minor) * 100) : null,
    ofRevenuePct: revenue.minor > 0 ? round1((net.minor / revenue.minor) * 100) : null,
    goodwill: sum(
      claims.filter((claim) => claim.goodwill).map((claim) => claim.net),
      currency,
    ),
  };
}

export interface WarrantyGroup {
  name: string;
  claims: number;
  cost: Money;
  recovered: Money;
  net: Money;
}

/** What warranty costs, grouped by the part that failed or who supplied it. */
export function warrantyBy(
  claims: readonly SettledClaim[],
  key: 'product' | 'supplier',
  currency = 'GBP',
): WarrantyGroup[] {
  const groups = new Map<string, SettledClaim[]>();

  for (const claim of claims) {
    const name =
      (key === 'product' ? claim.productName : claim.supplierName) ??
      (key === 'product' ? 'Not a stocked part' : 'Nobody behind it');
    groups.set(name, [...(groups.get(name) ?? []), claim]);
  }

  return [...groups.entries()]
    .map(([name, rows]) => ({
      name,
      claims: rows.length,
      cost: sum(
        rows.map((row) => row.cost),
        currency,
      ),
      recovered: sum(
        rows.map((row) => row.recovered),
        currency,
      ),
      net: sum(
        rows.map((row) => row.net),
        currency,
      ),
    }))
    .sort((a, b) => b.net.minor - a.net.minor);
}

/**
 * Warranty in one sentence, including when there is nothing to say.
 *
 * A period with no claims is worth stating plainly rather than showing as a
 * row of zeros, because the two read very differently to somebody deciding
 * whether the feature is working.
 */
export function describeWarrantyCost(result: WarrantyCost, locale = 'en-GB'): string {
  if (result.claims === 0) {
    return 'No warranty claim was settled in this period.';
  }

  const money = (value: Money) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(
      value.minor / 100,
    );

  const recovered =
    result.recovered.minor > 0
      ? `${money(result.recovered)} came back from suppliers`
      : 'nothing came back from suppliers';

  const share =
    result.ofRevenuePct === null
      ? ''
      : ` That is ${result.ofRevenuePct}% of what the workshop turned over.`;

  return `${result.claims} ${result.claims === 1 ? 'claim' : 'claims'} settled. The work cost ${money(
    result.cost,
  )}, ${recovered}, and the workshop carried ${money(result.net)}.${share}`;
}

/** Nothing spent and nothing recovered, in the right currency. */
export function noWarrantyCost(currency = 'GBP'): WarrantyCost {
  return {
    claims: 0,
    cost: zero(currency),
    recovered: zero(currency),
    net: zero(currency),
    recoveryPct: null,
    ofRevenuePct: null,
    goodwill: zero(currency),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
