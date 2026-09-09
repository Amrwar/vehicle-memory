import { add, type Money, money, subtract, sum, zero } from '../shared/money';

/**
 * Reading a group as a group.
 *
 * Two things go wrong when a multi-site business reports. The first is
 * averaging: a group at 68% productivity might be two sites at 67% and 69%, or
 * one at 95% and one at 41%, and only the second is a management problem.
 * Every roll-up here therefore carries its spread, not just its middle.
 *
 * The second is double counting. A part transferred from one site to another
 * is one part; adding both sites' stock movements makes it two. Inter-site
 * activity is netted out of the group figures and reported separately, so the
 * group total is what the group owns rather than what its sites did.
 */

export interface SitePerformance {
  locationId: string;
  siteName: string;
  revenue: Money;
  costOfSales: Money;
  overheads: Money;
  jobsCompleted: number;
  attendedMinutes: number;
  soldMinutes: number;
  stockValue: Money;
  receivables: Money;
}

export interface SiteResult extends SitePerformance {
  grossProfit: Money;
  netProfit: Money;
  marginPct: number | null;
  productivityPct: number | null;
  revenuePerJob: Money;
  /** Share of the group's revenue, so a small site is read as a small site. */
  shareOfGroupPct: number;
}

export interface GroupResult {
  sites: SiteResult[];
  total: SiteResult;
  /** Best and worst on productivity, and the gap between them. */
  spread: {
    metric: 'productivity';
    best: SiteResult | null;
    worst: SiteResult | null;
    gapPoints: number | null;
  };
  /** Sites whose margin sits below the group's, worth a conversation. */
  laggards: SiteResult[];
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function resultFor(site: SitePerformance, groupRevenueMinor: number): SiteResult {
  const grossProfit = subtract(site.revenue, site.costOfSales);
  const netProfit = subtract(grossProfit, site.overheads);

  return {
    ...site,
    grossProfit,
    netProfit,
    marginPct: site.revenue.minor === 0 ? null : ratio(netProfit.minor, site.revenue.minor),
    productivityPct: ratio(site.soldMinutes, site.attendedMinutes),
    revenuePerJob:
      site.jobsCompleted > 0
        ? money(Math.round(site.revenue.minor / site.jobsCompleted), site.revenue.currency)
        : zero(site.revenue.currency),
    shareOfGroupPct:
      groupRevenueMinor > 0 ? Math.round((site.revenue.minor / groupRevenueMinor) * 1000) / 10 : 0,
  };
}

export function consolidate(sites: readonly SitePerformance[], currency = 'GBP'): GroupResult {
  const groupRevenue = sum(
    sites.map((site) => site.revenue),
    currency,
  );

  const results = sites
    .map((site) => resultFor(site, groupRevenue.minor))
    .sort((a, b) => b.revenue.minor - a.revenue.minor);

  const total = resultFor(
    {
      locationId: 'group',
      siteName: 'Group',
      revenue: groupRevenue,
      costOfSales: sum(
        sites.map((site) => site.costOfSales),
        currency,
      ),
      overheads: sum(
        sites.map((site) => site.overheads),
        currency,
      ),
      jobsCompleted: sites.reduce((count, site) => count + site.jobsCompleted, 0),
      attendedMinutes: sites.reduce((count, site) => count + site.attendedMinutes, 0),
      soldMinutes: sites.reduce((count, site) => count + site.soldMinutes, 0),
      stockValue: sum(
        sites.map((site) => site.stockValue),
        currency,
      ),
      receivables: sum(
        sites.map((site) => site.receivables),
        currency,
      ),
    },
    groupRevenue.minor,
  );

  const rated = results.filter((site) => site.productivityPct !== null);
  const byProductivity = [...rated].sort(
    (a, b) => (b.productivityPct ?? 0) - (a.productivityPct ?? 0),
  );

  const best = byProductivity[0] ?? null;
  const worst = byProductivity[byProductivity.length - 1] ?? null;

  return {
    sites: results,
    total,
    spread: {
      metric: 'productivity',
      best,
      worst,
      gapPoints:
        best && worst && best !== worst
          ? Math.round(((best.productivityPct ?? 0) - (worst.productivityPct ?? 0)) * 10) / 10
          : null,
    },
    laggards:
      total.marginPct === null
        ? []
        : results.filter(
            (site) => site.marginPct !== null && site.marginPct < (total.marginPct ?? 0),
          ),
  };
}

/* ---------------------------------------------------------------------------
   Inter-site activity
   --------------------------------------------------------------------------- */

export interface InterSiteMovement {
  fromLocationId: string;
  toLocationId: string;
  value: Money;
  count: number;
}

/**
 * Nets out movements between sites in the group.
 *
 * These are real at site level and not real at group level: nothing was
 * bought or sold, a box moved. Leaving them in inflates group purchasing and
 * makes stock look like it is turning over faster than it is.
 */
export function netInterSite(
  movements: readonly InterSiteMovement[],
  currency = 'GBP',
): { eliminated: Money; count: number; byPair: InterSiteMovement[] } {
  const byPair = new Map<string, InterSiteMovement>();

  for (const movement of movements) {
    const key = `${movement.fromLocationId}->${movement.toLocationId}`;
    const existing = byPair.get(key);
    byPair.set(
      key,
      existing
        ? {
            ...existing,
            value: add(existing.value, movement.value),
            count: existing.count + movement.count,
          }
        : movement,
    );
  }

  return {
    eliminated: sum(
      movements.map((movement) => movement.value),
      currency,
    ),
    count: movements.reduce((total, movement) => total + movement.count, 0),
    byPair: [...byPair.values()].sort((a, b) => b.value.minor - a.value.minor),
  };
}

/* ---------------------------------------------------------------------------
   Per-site access
   --------------------------------------------------------------------------- */

/**
 * Which sites a person can see.
 *
 * A membership without a location is deliberately group-wide rather than
 * broken: an owner, a bookkeeper and a group manager all work across sites,
 * and making them pick one every morning would be the more common case
 * treated as the exception. A membership pinned to a location sees that
 * location only.
 *
 * This is a second axis on top of tenant isolation, not a replacement for it.
 * Crossing organisations is a security boundary; crossing sites within one
 * organisation is a visibility choice the owner makes.
 */
export interface LocationScope {
  /** Null means every site in the organisation. */
  locationIds: string[] | null;
  /** The site whose screen this person lands on. */
  homeLocationId: string | null;
}

export function scopeFor(
  membershipLocationId: string | null,
  allLocationIds: readonly string[],
): LocationScope {
  if (!membershipLocationId) {
    return { locationIds: null, homeLocationId: allLocationIds[0] ?? null };
  }

  return { locationIds: [membershipLocationId], homeLocationId: membershipLocationId };
}

export function canSeeLocation(scope: LocationScope, locationId: string): boolean {
  return scope.locationIds === null || scope.locationIds.includes(locationId);
}

/**
 * Narrows a requested site to one the person may actually see.
 *
 * Returns null for "all sites" rather than throwing, because a stale link to
 * a site somebody has been moved away from should show them their own work,
 * not an error page.
 */
export function resolveLocationFilter(
  scope: LocationScope,
  requested: string | null | undefined,
): string | null {
  if (!requested || requested === 'all') {
    return scope.locationIds === null ? null : (scope.locationIds[0] ?? null);
  }

  return canSeeLocation(scope, requested) ? requested : (scope.locationIds?.[0] ?? null);
}
