import { DEFAULT_REGION, formatDate, formatMinor, type Region, safeLocale } from '@carnet/core';
import { prisma } from '@carnet/db';
import { cache } from 'react';

export type { Region };
export { DEFAULT_REGION };

/**
 * The region a page formats by. Phase 29.
 *
 * A workshop keeps one set of books in one currency, so the region is the
 * organisation's, not the person's: a member of staff signing in from
 * abroad sees the same figures as everyone at the counter. A driver in the
 * portal sees each workshop's amounts in that workshop's currency, and
 * dates in the region of the workshop they use most.
 */

export function regionOf(org: {
  country: string;
  baseCurrency: string;
  locale: string;
  timezone: string;
}): Region {
  return {
    country: org.country,
    currency: org.baseCurrency,
    locale: safeLocale(org.locale, DEFAULT_REGION.locale),
    timezone: org.timezone,
  };
}

/** The organisation's region. Cached per request. */
export const regionFor = cache(async (orgId: string): Promise<Region> => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { country: true, baseCurrency: true, locale: true, timezone: true },
  });
  return org ? regionOf(org) : DEFAULT_REGION;
});

/** A driver's region: the workshop they have used most, or the default. */
export const regionForUser = cache(async (userId: string): Promise<Region> => {
  const customer = await prisma.customer.findFirst({
    where: { portalUserId: userId },
    orderBy: { jobs: { _count: 'desc' } },
    select: {
      org: { select: { country: true, baseCurrency: true, locale: true, timezone: true } },
    },
  });
  return customer ? regionOf(customer.org) : DEFAULT_REGION;
});

/** The formatting a page needs, ready to spread onto a Money or hand to a date. */
export function formatters(region: Region) {
  return {
    money: (minor: number) => formatMinor(minor, region),
    /** Major units, as the pages mostly hold them. */
    amount: (major: number) => formatMinor(Math.round(major * 100), region),
    date: (at: Date, options?: Intl.DateTimeFormatOptions) => formatDate(at, region, options),
    props: { currency: region.currency, locale: region.locale },
  };
}
