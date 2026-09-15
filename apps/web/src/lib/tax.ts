import {
  assertExemption,
  assertTaxRateSound,
  chooseTaxRate,
  type Currency,
  effectiveRatePct,
  EXEMPT,
  fromDecimal,
  type Money,
  NO_TAX,
  type PriceableLine,
  TaxError,
  type TaxPart,
  taxReport,
  type TaxSource,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Tax, configurable. Phase 41.
 *
 * A rate is one or more taxes, each written on the document as it was
 * charged. Where a line's rate comes from, whether the price already has tax
 * in, and whether the customer is exempt are decided here, once, for every
 * path that prices a line: the job page, the invoice, the quote, the counter,
 * the fleet's monthly invoice. What each tax came to is written as a tax entry
 * when a document is issued, and the report per tax reads only those.
 */

export { TaxError };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

/** What to select on a line's tax rate so it can be priced. */
export const TAX_RATE = {
  select: {
    id: true,
    name: true,
    rate: true,
    components: {
      orderBy: { sortOrder: 'asc' as const },
      select: { name: true, rate: true, compound: true },
    },
  },
} as const;

export interface RateRow {
  name: string;
  rate: unknown;
  components?: { name: string; rate: unknown; compound: boolean }[];
}

/** The taxes a rate carries. A line with no rate carries "No tax" at 0%. */
export function partsFor(rate: RateRow | null | undefined): TaxPart[] {
  if (!rate) return [{ name: NO_TAX, ratePct: 0 }];
  if (rate.components && rate.components.length > 0) {
    return rate.components.map((part) => ({
      name: part.name,
      ratePct: Number(part.rate),
      compound: part.compound,
    }));
  }
  return [{ name: rate.name, ratePct: Number(rate.rate) }];
}

export interface TaxContext {
  pricesIncludeTax: boolean;
  exempt: boolean;
  exemptReference: string | null;
}

export const NO_CONTEXT: TaxContext = {
  pricesIncludeTax: false,
  exempt: false,
  exemptReference: null,
};

/** How a workshop prices, and whether this customer pays tax at all. */
export async function taxContextFor(
  orgId: string,
  customerId?: string | null,
  db: Db = prisma,
): Promise<TaxContext> {
  const [org, customer] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { pricesIncludeTax: true } }),
    customerId
      ? db.customer.findFirst({
          where: { id: customerId, orgId },
          select: { taxExempt: true, taxExemptReference: true },
        })
      : null,
  ]);
  return {
    pricesIncludeTax: org?.pricesIncludeTax ?? false,
    exempt: customer?.taxExempt ?? false,
    exemptReference: customer?.taxExempt ? (customer.taxExemptReference ?? null) : null,
  };
}

/** The pricing fields a line takes from its rate and the context. */
export function linePricing(
  rate: RateRow | null | undefined,
  context: TaxContext,
): Pick<PriceableLine, 'taxRatePct' | 'taxes' | 'pricesIncludeTax' | 'taxExempt'> {
  const taxes = partsFor(rate);
  return {
    taxRatePct: effectiveRatePct(taxes),
    taxes,
    pricesIncludeTax: context.pricesIncludeTax,
    taxExempt: context.exempt,
  };
}

/** The rate a new line takes at a site: the site's own, else the workshop's default. */
export async function defaultTaxRateId(
  orgId: string,
  locationId?: string | null,
  db: Db = prisma,
): Promise<string | null> {
  const [site, fallback] = await Promise.all([
    locationId
      ? db.location.findFirst({ where: { id: locationId, orgId }, select: { taxRateId: true } })
      : null,
    db.taxRate.findFirst({
      where: { orgId, isDefault: true, isActive: true },
      select: { id: true },
    }),
  ]);
  return chooseTaxRate({
    siteRateId: site?.taxRateId ?? null,
    defaultRateId: fallback?.id ?? null,
  });
}

export interface Band {
  name: string;
  ratePct: number;
  net: Money;
  tax: Money;
}

/**
 * Writes what each tax came to on a document, once. Negative for a credit
 * note. Written in the same transaction as the document, so a document and
 * its declaration cannot part company.
 */
export async function recordTaxEntries(
  tx: Db,
  input: {
    orgId: string;
    locationId: string | null;
    sourceType: TaxSource;
    sourceId: string;
    reference: string;
    occurredAt: Date;
    currency: string;
    bands: readonly Band[];
    sign?: 1 | -1;
  },
): Promise<void> {
  const sign = input.sign ?? 1;
  const rows = input.bands
    .filter((band) => band.net.minor !== 0 || band.tax.minor !== 0)
    .map((band) => ({
      orgId: input.orgId,
      locationId: input.locationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reference: input.reference,
      name: band.name,
      ratePct: band.ratePct,
      net: (sign * band.net.minor) / 100,
      tax: (sign * band.tax.minor) / 100,
      currency: input.currency,
      occurredAt: input.occurredAt,
    }));
  if (rows.length > 0) await tx.taxEntry.createMany({ data: rows, skipDuplicates: true });
}

/**
 * The bands a set of priced lines comes to, for documents priced outside
 * calculateTotals, such as a counter sale. Each tax counts the net it was
 * charged on; an exempt customer's lines are one "Exempt" band.
 */
export function bandsOfLines(
  lines: readonly { net: Money; taxes: readonly { name: string; ratePct: number; tax: Money }[] }[],
  exempt: boolean,
  currency: string,
): Band[] {
  const bands = new Map<string, Band>();
  const add = (name: string, ratePct: number, net: Money, tax: Money) => {
    const key = `${name} ${ratePct}`;
    const band = bands.get(key) ?? {
      name,
      ratePct,
      net: { minor: 0, currency },
      tax: { minor: 0, currency },
    };
    bands.set(key, {
      ...band,
      net: { minor: band.net.minor + net.minor, currency },
      tax: { minor: band.tax.minor + tax.minor, currency },
    });
  };
  for (const line of lines) {
    if (exempt || line.taxes.length === 0) {
      add(exempt ? EXEMPT : NO_TAX, 0, line.net, { minor: 0, currency });
      continue;
    }
    for (const entry of line.taxes) add(entry.name, entry.ratePct, line.net, entry.tax);
  }
  return [...bands.values()];
}

/** An invoice's taxes as declared, for its credit notes and its page. */
export async function bandsFor(sourceType: TaxSource, sourceId: string): Promise<Band[]> {
  const rows = await prisma.taxEntry.findMany({
    where: { sourceType, sourceId },
    orderBy: [{ ratePct: 'asc' }, { name: 'asc' }],
    select: { name: true, ratePct: true, net: true, tax: true, currency: true },
  });
  return rows.map((row) => ({
    name: row.name,
    ratePct: Number(row.ratePct),
    net: fromDecimal(row.net.toString(), row.currency as Currency),
    tax: fromDecimal(row.tax.toString(), row.currency as Currency),
  }));
}

/**
 * The report per tax for a period: one row per tax and rate, what was charged,
 * what was given back, and what is owed; and the same for each site.
 */
export async function taxReportFor(
  orgId: string,
  period: { from: Date; to: Date },
  currency: Currency,
) {
  const entries = await prisma.taxEntry.findMany({
    where: { orgId, occurredAt: { gte: period.from, lt: period.to } },
    orderBy: { occurredAt: 'asc' },
    select: {
      name: true,
      ratePct: true,
      net: true,
      tax: true,
      sourceType: true,
      reference: true,
      occurredAt: true,
      location: { select: { id: true, name: true } },
    },
  });

  const toLike = (entry: (typeof entries)[number]) => ({
    name: entry.name,
    ratePct: Number(entry.ratePct),
    sourceType: entry.sourceType as TaxSource,
    net: fromDecimal(entry.net.toString(), currency),
    tax: fromDecimal(entry.tax.toString(), currency),
  });

  const sites = new Map<string, { name: string; entries: typeof entries }>();
  for (const entry of entries) {
    const key = entry.location?.id ?? 'none';
    const site = sites.get(key) ?? { name: entry.location?.name ?? '', entries: [] };
    site.entries.push(entry);
    sites.set(key, site);
  }

  return {
    ...taxReport(entries.map(toLike), currency),
    bySite: [...sites.entries()].map(([id, site]) => ({
      id,
      name: site.name,
      ...taxReport(site.entries.map(toLike), currency),
    })),
    documents: new Set(entries.map((entry) => `${entry.sourceType}:${entry.reference}`)).size,
  };
}

/* ------------------------------------------------------------------------- */
/* Settings                                                                   */
/* ------------------------------------------------------------------------- */

/** With tax in, or before tax. Open jobs re-price; issued documents keep what they were. */
export async function setPricesIncludeTax(input: {
  orgId: string;
  userId: string;
  value: boolean;
}): Promise<void> {
  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: { pricesIncludeTax: true },
  });
  if (before.pricesIncludeTax === input.value) return;
  await prisma.organization.update({
    where: { id: input.orgId },
    data: { pricesIncludeTax: input.value },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.prices_include_tax',
    entityType: 'Organization',
    entityId: input.orgId,
    before,
    after: { pricesIncludeTax: input.value },
  });
}

/** A site's own rate, or none to use the workshop's default. */
export async function setSiteTaxRate(input: {
  orgId: string;
  userId: string;
  locationId: string;
  taxRateId: string | null;
}): Promise<void> {
  const [site, rate] = await Promise.all([
    prisma.location.findFirst({
      where: { id: input.locationId, orgId: input.orgId },
      select: { id: true, taxRateId: true },
    }),
    input.taxRateId
      ? prisma.taxRate.findFirst({
          where: { id: input.taxRateId, orgId: input.orgId, isActive: true },
          select: { id: true, name: true },
        })
      : null,
  ]);
  if (!site) throw new TaxError('NO_NAME', 'That site is not this workshop’s.');
  if (input.taxRateId && !rate) {
    throw new TaxError('NO_TAXES', 'That tax rate is not one this workshop can use.');
  }
  await prisma.location.update({
    where: { id: site.id },
    data: { taxRateId: rate?.id ?? null },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.site_tax_rate',
    entityType: 'Location',
    entityId: site.id,
    before: { taxRateId: site.taxRateId },
    after: { taxRateId: rate?.id ?? null, name: rate?.name ?? null },
  });
}

/** Exempt on the strength of a certificate, or not. */
export async function setCustomerExemption(input: {
  orgId: string;
  userId: string;
  customerId: string;
  exempt: boolean;
  reference?: string | null;
}): Promise<void> {
  const reference = input.reference?.trim() || null;
  assertExemption({ exempt: input.exempt, reference });
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, orgId: input.orgId },
    select: { id: true, taxExempt: true, taxExemptReference: true },
  });
  if (!customer) throw new TaxError('NO_NAME', 'That customer is not this workshop’s.');
  await prisma.customer.update({
    where: { id: customer.id },
    data: { taxExempt: input.exempt, taxExemptReference: input.exempt ? reference : null },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.exempt ? 'customer.tax_exempt' : 'customer.tax_charged',
    entityType: 'Customer',
    entityId: customer.id,
    before: { taxExempt: customer.taxExempt, taxExemptReference: customer.taxExemptReference },
    after: { taxExempt: input.exempt, taxExemptReference: input.exempt ? reference : null },
  });
}

/**
 * A rate and its taxes, saved whole. A rate already on an invoice keeps its
 * taxes: lines priced at it would re-price underneath a document already
 * sent, so different taxes are a new rate and the old one is retired.
 */
export async function saveTaxRateWithParts(input: {
  orgId: string;
  userId: string;
  taxRateId?: string | null;
  name: string;
  parts: TaxPart[];
}): Promise<string> {
  const name = input.name.trim();
  const parts = input.parts.map((part, index) => ({
    name: part.name.trim(),
    ratePct: part.ratePct,
    compound: index > 0 && Boolean(part.compound),
  }));
  assertTaxRateSound({ name, parts });
  const effective = effectiveRatePct(parts);

  const signature = (list: { name: string; ratePct: number; compound?: boolean }[]) =>
    JSON.stringify(list.map((part) => [part.name, part.ratePct, Boolean(part.compound)]));

  if (input.taxRateId) {
    const before = await prisma.taxRate.findFirst({
      where: { id: input.taxRateId, orgId: input.orgId },
      select: TAX_RATE.select,
    });
    if (!before) throw new TaxError('NO_NAME', 'That tax rate is not this workshop’s.');
    const used = await prisma.invoiceLine.count({ where: { taxRateId: before.id } });
    if (used > 0 && signature(partsFor(before)) !== signature(parts)) {
      throw new TaxError(
        'BAD_RATE',
        `That rate is on ${used} invoice lines. Add a new rate with these taxes and retire this one, so what was invoiced keeps reading the way it was.`,
      );
    }
    await prisma.$transaction([
      prisma.taxRate.update({ where: { id: before.id }, data: { name, rate: effective } }),
      prisma.taxComponent.deleteMany({ where: { taxRateId: before.id } }),
      prisma.taxComponent.createMany({
        data: parts.map((part, index) => ({
          taxRateId: before.id,
          name: part.name,
          rate: part.ratePct,
          compound: part.compound,
          sortOrder: index,
        })),
      }),
    ]);
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'settings.taxrate',
      entityType: 'TaxRate',
      entityId: before.id,
      before: { name: before.name, taxes: partsFor(before) },
      after: { name, taxes: parts },
    });
    return before.id;
  }

  const created = await prisma.taxRate.create({
    data: {
      orgId: input.orgId,
      name,
      rate: effective,
      components: {
        create: parts.map((part, index) => ({
          name: part.name,
          rate: part.ratePct,
          compound: part.compound,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.taxrate',
    entityType: 'TaxRate',
    entityId: created.id,
    after: { name, taxes: parts },
  });
  return created.id;
}

export { toNumber };
