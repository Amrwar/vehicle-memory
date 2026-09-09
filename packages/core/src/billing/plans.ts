import { type Money, money } from '../shared/money';

/**
 * What a plan actually buys.
 *
 * A published price with nothing behind it is a promise the system cannot
 * keep. Every limit here is checked where the feature is used, not printed on
 * a page and forgotten, and every one is expressed as a number a customer can
 * count for themselves rather than as a word like "unlimited" or "advanced".
 *
 * Priced per bay, not per user. Bays correlate with capacity and therefore
 * with what a workshop earns; charging per user bills a workshop for giving
 * its staff access, which is the opposite of what this product wants. Staff
 * accounts are unlimited on every tier and that is a deliberate cost, not an
 * oversight. The rationale is in docs/00-product/07-business-model.md, and
 * these figures are the ones its unit economics are built on.
 *
 * The tiers follow how a workshop actually grows, which is not how software is
 * usually tiered. A single-site garage does not want a cheaper version of the
 * accounting; it wants the accounting, and it does not want multi-site. So the
 * split is by shape of business, not by withholding features that everybody
 * needs.
 */

export type PlanId = 'CORE' | 'COMPLETE' | 'GROUP';

export type FeatureKey =
  | 'passport'
  | 'inspections'
  | 'estimates'
  | 'inventory'
  | 'purchasing'
  | 'ledger'
  | 'statements'
  | 'payroll'
  | 'commission'
  | 'multiSite'
  | 'transfers'
  | 'api'
  | 'sso';

export interface PlanLimits {
  /**
   * Staff accounts. Unlimited on every tier, deliberately.
   *
   * Kept as a limit rather than removed so the shape of the check is the same
   * everywhere, and so that reinstating a cap later is a data change rather
   * than a code change. Nothing should ever set this to a real number without
   * revisiting the business model, which argues against it explicitly.
   */
  users: number;
  /** Physical sites. The one hard boundary between Complete and Group. */
  locations: number;
  /** Bays, which is what the plan is priced by. A ceiling, not a quota. */
  bays: number;
  /** Vehicles on the books. */
  vehicles: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Who this is for, in one line, in their words. */
  audience: string;
  /** Per bay, per month, billed annually. */
  price: Money;
  /** Per bay, per month, billed monthly. Always the higher figure. */
  priceMonthly: Money;
  limits: PlanLimits;
  features: Record<FeatureKey, boolean>;
  /** Named on the pricing page as what you get over the tier below. */
  headline: string[];
  popular?: boolean;
}

/** Practically unbounded, but a real number so a limit check has one shape. */
export const NO_LIMIT = 1_000_000;

const gbp = (major: number): Money => money(major * 100, 'GBP');

const NONE: Record<FeatureKey, boolean> = {
  passport: false,
  inspections: false,
  estimates: false,
  inventory: false,
  purchasing: false,
  ledger: false,
  statements: false,
  payroll: false,
  commission: false,
  multiSite: false,
  transfers: false,
  api: false,
  sso: false,
};

export const PLANS: Record<PlanId, Plan> = {
  CORE: {
    id: 'CORE',
    name: 'Core',
    audience: 'A single workshop running the everyday work',
    price: gbp(39),
    priceMonthly: gbp(47),
    limits: { users: NO_LIMIT, locations: 1, bays: 6, vehicles: 5_000 },
    features: {
      ...NONE,
      // The passport is in every tier, deliberately. It is the thing that
      // makes the network worth joining, and putting it behind the top tier
      // would strangle the only part of the product that compounds.
      passport: true,
      inspections: true,
      estimates: true,
      inventory: true,
    },
    headline: [
      'Diary, jobs, inspections and estimates',
      'Vehicle passport on every car you touch',
      'Invoicing, payments and parts',
      'Customer portal',
    ],
  },

  COMPLETE: {
    id: 'COMPLETE',
    name: 'Complete',
    audience: 'A workshop that wants the books to be right, not reconciled later',
    price: gbp(69),
    priceMonthly: gbp(83),
    limits: { users: NO_LIMIT, locations: 1, bays: 24, vehicles: 40_000 },
    features: {
      ...NONE,
      passport: true,
      inspections: true,
      estimates: true,
      inventory: true,
      purchasing: true,
      ledger: true,
      statements: true,
      payroll: true,
      commission: true,
      api: true,
    },
    headline: [
      'Everything in Core',
      'Double-entry ledger, posted from the work itself',
      'Profit and loss, balance sheet, VAT position',
      'Purchase orders and three-way bill matching',
      'Timesheets, pay history and commission',
    ],
    popular: true,
  },

  GROUP: {
    id: 'GROUP',
    name: 'Group',
    audience: 'More than one site, read as one business',
    price: gbp(99),
    priceMonthly: gbp(119),
    limits: {
      users: NO_LIMIT,
      locations: NO_LIMIT,
      bays: NO_LIMIT,
      vehicles: NO_LIMIT,
    },
    features: {
      passport: true,
      inspections: true,
      estimates: true,
      inventory: true,
      purchasing: true,
      ledger: true,
      statements: true,
      payroll: true,
      commission: true,
      multiSite: true,
      transfers: true,
      api: true,
      sso: true,
    },
    headline: [
      'Everything in Complete, at every site',
      'Consolidated reporting that carries its spread',
      'Stock transfers, with what is on the road counted',
      'Per-site permissions and single sign-on',
    ],
  },
};

export const PLAN_ORDER: readonly PlanId[] = ['CORE', 'COMPLETE', 'GROUP'];

export function planFor(id: string): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : 'CORE'];
}

/* ---------------------------------------------------------------------------
   Entitlement
   --------------------------------------------------------------------------- */

export class PlanLimitError extends Error {
  readonly code: 'FEATURE' | 'LIMIT';
  readonly plan: PlanId;
  readonly suggestion: PlanId | null;

  constructor(
    code: PlanLimitError['code'],
    message: string,
    plan: PlanId,
    suggestion: PlanId | null,
  ) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.plan = plan;
    this.suggestion = suggestion;
  }
}

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return PLANS[plan].features[feature];
}

/** The cheapest plan that includes a feature, for the message on the wall. */
export function cheapestWith(feature: FeatureKey): PlanId | null {
  return PLAN_ORDER.find((id) => PLANS[id].features[feature]) ?? null;
}

const FEATURE_NAMES: Record<FeatureKey, string> = {
  passport: 'the vehicle passport',
  inspections: 'digital inspections',
  estimates: 'estimates and approvals',
  inventory: 'the parts catalogue',
  purchasing: 'purchase orders',
  ledger: 'the general ledger',
  statements: 'financial statements',
  payroll: 'timesheets and payroll',
  commission: 'commission schemes',
  multiSite: 'more than one site',
  transfers: 'stock transfers between sites',
  api: 'the API',
  sso: 'single sign-on',
};

export function describeFeature(feature: FeatureKey): string {
  return FEATURE_NAMES[feature];
}

/**
 * Refuses a feature the plan does not include, and names the plan that does.
 *
 * "Upgrade to continue" with no destination is the worst version of this
 * message. Somebody hitting a wall should learn what they hit, which plan
 * clears it, and what that costs, in the sentence that stops them.
 */
export function assertFeature(plan: PlanId, feature: FeatureKey): void {
  if (hasFeature(plan, feature)) return;

  const suggestion = cheapestWith(feature);

  throw new PlanLimitError(
    'FEATURE',
    suggestion
      ? `${capitalise(FEATURE_NAMES[feature])} is part of ${PLANS[suggestion].name}. You are on ${PLANS[plan].name}.`
      : `${capitalise(FEATURE_NAMES[feature])} is not available on any plan.`,
    plan,
    suggestion,
  );
}

export interface UsageCheck {
  within: boolean;
  used: number;
  limit: number;
  /** Above this share of the limit, a workshop should be told before it stops. */
  approaching: boolean;
  message: string | null;
}

const WARN_AT = 0.8;

/**
 * Whether one more of something is allowed.
 *
 * Reports approaching separately from exceeded, because a workshop that hits a
 * hard stop at four o'clock on a Friday with a car on the ramp will not
 * remember that the limit was published.
 */
export function checkUsage(plan: PlanId, limit: keyof PlanLimits, used: number): UsageCheck {
  const allowed = PLANS[plan].limits[limit];
  const within = used < allowed;
  const approaching = within && allowed !== NO_LIMIT && used / allowed >= WARN_AT;

  const nouns: Record<keyof PlanLimits, string> = {
    users: 'staff accounts',
    locations: 'sites',
    bays: 'bays',
    vehicles: 'vehicles',
  };

  const next = PLAN_ORDER.find((id) => PLANS[id].limits[limit] > allowed);

  return {
    within,
    used,
    limit: allowed,
    approaching,
    message: within
      ? approaching
        ? `${used} of ${allowed} ${nouns[limit]}. ${next ? `${PLANS[next].name} raises this to ${PLANS[next].limits[limit] === NO_LIMIT ? 'no limit' : PLANS[next].limits[limit]}.` : ''}`.trim()
        : null
      : `${PLANS[plan].name} covers ${allowed} ${nouns[limit]} and you have ${used}. ${
          next ? `${PLANS[next].name} raises this.` : 'Talk to us about a bespoke plan.'
        }`,
  };
}

export function assertUsage(plan: PlanId, limit: keyof PlanLimits, used: number): void {
  const check = checkUsage(plan, limit, used);
  if (check.within) return;

  throw new PlanLimitError(
    'LIMIT',
    check.message ?? 'This plan does not cover any more of those.',
    plan,
    PLAN_ORDER.find((id) => PLANS[id].limits[limit] > PLANS[plan].limits[limit]) ?? null,
  );
}

/* ---------------------------------------------------------------------------
   Pricing arithmetic
   --------------------------------------------------------------------------- */

/** What a workshop pays per month, given its bays and billing period. */
export function monthlyCost(plan: PlanId, bays: number, annual: boolean): Money {
  const rate = annual ? PLANS[plan].price : PLANS[plan].priceMonthly;
  return money(rate.minor * Math.max(1, bays), rate.currency);
}

/** What choosing annual saves over a year, which is the figure people want. */
export function annualSaving(plan: PlanId, bays: number): Money {
  const monthly = monthlyCost(plan, bays, false);
  const yearly = monthlyCost(plan, bays, true);
  return money((monthly.minor - yearly.minor) * 12, monthly.currency);
}

export function savingPercent(plan: PlanId): number {
  const { price, priceMonthly } = PLANS[plan];
  if (priceMonthly.minor === 0) return 0;
  return Math.round(((priceMonthly.minor - price.minor) / priceMonthly.minor) * 100);
}

/**
 * The plan a workshop of this shape should start on.
 *
 * Used on the pricing page rather than making somebody read three columns and
 * work it out. More than one site is the only hard signal; everything else is
 * a matter of what they want the books to do.
 */
export function suggestPlan(input: {
  sites: number;
  bays: number;
  wantsAccounts: boolean;
}): PlanId {
  if (input.sites > 1) return 'GROUP';
  if (input.wantsAccounts || input.bays > PLANS.CORE.limits.bays) return 'COMPLETE';
  return 'CORE';
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
