import {
  assertLabourRateSaveable,
  assertSitePriceSaveable,
  chooseLabourRate,
  chooseSitePrice,
  type ChosenRate,
  fromDecimal,
  type LabourRateRow,
  PricingError,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { regionFor } from './region';

/**
 * Prices, at the site that is charging them. Phase 44.
 *
 * Two lists and one rule. The labour rates a workshop charges, some of them
 * belonging to a particular site; the prices a site holds for a part, where it
 * differs from the product's own. The rule is the same as for tax: the site's
 * figure where it has one, the workshop's where it does not, and every screen
 * that uses it says which it was.
 */

export { PricingError };

const rowsFor = async (orgId: string, currency: string): Promise<LabourRateRow[]> => {
  const rows = await prisma.labourRate.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ locationId: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, perHour: true, locationId: true, isDefault: true },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    perHour: fromDecimal(String(row.perHour), currency),
    locationId: row.locationId,
    isDefault: row.isDefault,
  }));
};

/** Every rate the workshop charges, the sites' own among them. */
export async function labourRates(orgId: string) {
  const region = await regionFor(orgId);
  const rows = await prisma.labourRate.findMany({
    where: { orgId },
    orderBy: [{ isActive: 'desc' }, { locationId: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      perHour: true,
      locationId: true,
      isDefault: true,
      isActive: true,
      location: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    perHourNumber: Number(row.perHour),
    currency: region.currency,
  }));
}

/** The rate a new line takes at this site. */
export async function labourRateAt(orgId: string, locationId: string | null): Promise<ChosenRate> {
  const region = await regionFor(orgId);
  return chooseLabourRate(await rowsFor(orgId, region.currency), locationId, region.currency);
}

export async function saveLabourRate(input: {
  orgId: string;
  userId: string;
  id?: string | null;
  locationId: string | null;
  name: string;
  perHour: number;
  isDefault: boolean;
}): Promise<string> {
  const region = await regionFor(input.orgId);
  const perHour = fromDecimal(String(input.perHour || 0), region.currency);

  assertLabourRateSaveable({ name: input.name, perHour });

  if (input.locationId) {
    const site = await prisma.location.findFirst({
      where: { id: input.locationId, orgId: input.orgId },
      select: { id: true },
    });
    if (!site) throw new PricingError('NOT_A_SITE', 'That site is not in this workshop.');
  }

  const data = {
    orgId: input.orgId,
    locationId: input.locationId,
    name: input.name.trim(),
    perHour: toNumber(perHour),
    isDefault: input.isDefault,
    isActive: true,
  };

  const id = await prisma.$transaction(async (tx) => {
    // One rate per scope is the one new lines take, and the database says so
    // as well; clearing the old one first keeps the write from bouncing off
    // its own index.
    if (input.isDefault) {
      await tx.labourRate.updateMany({
        where: {
          orgId: input.orgId,
          locationId: input.locationId,
          isDefault: true,
          ...(input.id ? { id: { not: input.id } } : {}),
        },
        data: { isDefault: false },
      });
    }

    if (input.id) {
      const existing = await tx.labourRate.findFirst({
        where: { id: input.id, orgId: input.orgId },
        select: { id: true },
      });
      if (!existing) throw new PricingError('NOT_A_SITE', 'That rate is not in this workshop.');
      await tx.labourRate.update({ where: { id: existing.id }, data });
      return existing.id;
    }

    const created = await tx.labourRate.create({ data, select: { id: true } });
    return created.id;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.id ? 'settings.labour_rate_updated' : 'settings.labour_rate_added',
    entityType: 'LabourRate',
    entityId: id,
    after: { name: data.name, perHour: data.perHour, locationId: input.locationId },
  });

  return id;
}

/** Retires a rate. Quotes already priced keep the figure they were priced at. */
export async function retireLabourRate(input: {
  orgId: string;
  userId: string;
  id: string;
}): Promise<void> {
  const rate = await prisma.labourRate.findFirst({
    where: { id: input.id, orgId: input.orgId },
    select: { id: true, name: true, isActive: true },
  });

  if (!rate) throw new PricingError('NOT_A_SITE', 'That rate is not in this workshop.');

  await prisma.labourRate.update({
    where: { id: rate.id },
    data: { isActive: !rate.isActive, isDefault: false },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: rate.isActive ? 'settings.labour_rate_retired' : 'settings.labour_rate_restored',
    entityType: 'LabourRate',
    entityId: rate.id,
    after: { name: rate.name },
  });
}

/* ---------------------------------------------------------------------------
   A part's price at a site
   --------------------------------------------------------------------------- */

/** What one part sells for here, and whether that is the site's own figure. */
export async function sellPriceAt(
  orgId: string,
  productId: string,
  locationId: string | null,
): Promise<{ price: number; source: 'SITE' | 'LIST' }> {
  const region = await regionFor(orgId);

  const product = await prisma.product.findFirst({
    where: { id: productId, orgId },
    select: {
      sellPrice: true,
      sitePrices: { select: { locationId: true, sellPrice: true } },
    },
  });

  if (!product) return { price: 0, source: 'LIST' };

  const chosen = chooseSitePrice(
    fromDecimal(String(product.sellPrice), region.currency),
    product.sitePrices.map((row) => ({
      locationId: row.locationId,
      sellPrice: fromDecimal(String(row.sellPrice), region.currency),
    })),
    locationId,
  );

  return { price: Number(chosen.price.minor) / 100, source: chosen.source as 'SITE' | 'LIST' };
}

/** Every site price held for one part. */
export async function sitePricesFor(orgId: string, productId: string) {
  return prisma.productSitePrice.findMany({
    where: { orgId, productId },
    orderBy: { location: { name: 'asc' } },
    select: {
      id: true,
      sellPrice: true,
      locationId: true,
      location: { select: { name: true } },
    },
  });
}

/**
 * Sets, or clears, what a part sells for at one site.
 *
 * An empty box clears the override rather than writing a zero, because a part
 * priced at nothing and a part priced like everywhere else are different
 * things and only one of them is ever meant.
 */
export async function setSitePrice(input: {
  orgId: string;
  userId: string;
  productId: string;
  locationId: string;
  sellPrice: number | null;
}): Promise<void> {
  const region = await regionFor(input.orgId);

  const [product, site] = await Promise.all([
    prisma.product.findFirst({
      where: { id: input.productId, orgId: input.orgId },
      select: { id: true, name: true, sellPrice: true },
    }),
    prisma.location.findFirst({
      where: { id: input.locationId, orgId: input.orgId },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) throw new PricingError('BAD_PRICE', 'That part is not in this workshop.');
  if (!site) throw new PricingError('NOT_A_SITE', 'That site is not in this workshop.');

  if (input.sellPrice === null) {
    await prisma.productSitePrice.deleteMany({
      where: { productId: product.id, locationId: site.id },
    });
  } else {
    assertSitePriceSaveable({ sellPrice: fromDecimal(String(input.sellPrice), region.currency) });

    await prisma.productSitePrice.upsert({
      where: { productId_locationId: { productId: product.id, locationId: site.id } },
      create: {
        orgId: input.orgId,
        productId: product.id,
        locationId: site.id,
        sellPrice: input.sellPrice,
      },
      update: { sellPrice: input.sellPrice },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.sellPrice === null ? 'settings.site_price_cleared' : 'settings.site_price_set',
    entityType: 'Product',
    entityId: product.id,
    after: { site: site.name, sellPrice: input.sellPrice, list: Number(product.sellPrice) },
  });
}

/** The sites a workshop has, for the forms that price by site. */
export async function sitesOf(orgId: string) {
  return prisma.location.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, isDefault: true },
  });
}
