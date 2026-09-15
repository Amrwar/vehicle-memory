import {
  assertBaySaveable,
  assertJobTypeSaveable,
  assertNotTheLast,
  assertOrganisationSaveable,
  assertPrefixSaveable,
  assertSiteSaveable,
  assertTaxRateSaveable,
  describeChanges,
  normaliseCode,
  normalisePrefix,
  SettingsError,
  tidy,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { assertWithinLimit } from './billing';

/**
 * Settings, written. Phase 19.
 *
 * Every change here is audited with what it was and what it became, because
 * "who changed the VAT rate" is the question that gets asked six months later
 * and the answer has to be in the product, not in somebody's memory.
 *
 * Nothing is deleted. A bay, a tax rate or a kind of work that has been used
 * is referenced by jobs and invoices that must keep reading the same way, so
 * retiring hides it from new work and leaves the old work alone.
 */

export { SettingsError };

/** Prisma's unique-violation code, turned into a sentence at the form. */
function duplicateOf(error: unknown, what: string): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  ) {
    throw new SettingsError('DUPLICATE', `There is already a ${what} with that name or code.`);
  }
  throw error;
}

export async function organisationSettings(orgId: string) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      taxNumber: true,
      email: true,
      phone: true,
      website: true,
      country: true,
      baseCurrency: true,
      locale: true,
      timezone: true,
      reapprovalThresholdPct: true,
      sequences: {
        orderBy: { kind: 'asc' },
        select: { id: true, kind: true, prefix: true, next: true },
      },
    },
  });
}

export async function updateOrganisation(input: {
  orgId: string;
  userId: string;
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  reapprovalThresholdPct: number;
  country?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
}): Promise<void> {
  assertOrganisationSaveable(input);

  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: {
      name: true,
      legalName: true,
      taxNumber: true,
      email: true,
      phone: true,
      website: true,
      reapprovalThresholdPct: true,
      country: true,
      baseCurrency: true,
      locale: true,
      timezone: true,
    },
  });

  const after = {
    name: input.name.trim(),
    legalName: tidy(input.legalName),
    taxNumber: tidy(input.taxNumber),
    email: tidy(input.email),
    phone: tidy(input.phone),
    website: tidy(input.website),
    reapprovalThresholdPct: input.reapprovalThresholdPct,
    ...(input.country ? { country: input.country.toUpperCase() } : {}),
    ...(input.currency ? { baseCurrency: input.currency.toUpperCase() } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
  };

  await prisma.organization.update({ where: { id: input.orgId }, data: after });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.organisation',
    entityType: 'Organization',
    entityId: input.orgId,
    before: { ...before, reapprovalThresholdPct: Number(before.reapprovalThresholdPct) },
    after,
  });
}

export async function setNumberingPrefix(input: {
  orgId: string;
  userId: string;
  sequenceId: string;
  prefix: string;
}): Promise<void> {
  const prefix = normalisePrefix(input.prefix);
  assertPrefixSaveable(prefix);

  const sequence = await prisma.documentSequence.findFirst({
    where: { id: input.sequenceId, orgId: input.orgId },
    select: { id: true, kind: true, prefix: true },
  });
  if (!sequence)
    throw new SettingsError('NOT_YOURS', 'That numbering sequence is not this workshop’s.');

  // The counter is never touched from here. A gapless sequence that somebody
  // could wind back is not gapless.
  await prisma.documentSequence.update({ where: { id: sequence.id }, data: { prefix } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.numbering',
    entityType: 'DocumentSequence',
    entityId: sequence.id,
    before: { kind: sequence.kind, prefix: sequence.prefix },
    after: { kind: sequence.kind, prefix },
  });
}

/* ---------------------------------------------------------------- the site */

export async function siteSettings(orgId: string, locationId: string | null) {
  const location = await prisma.location.findFirst({
    where: { orgId, isActive: true, ...(locationId ? { id: locationId } : {}) },
    orderBy: { isDefault: 'desc' },
    select: {
      id: true,
      name: true,
      code: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      region: true,
      postcode: true,
      country: true,
      phone: true,
      dailyCapacityHours: true,
      opensAtMinute: true,
      closesAtMinute: true,
      isDefault: true,
      bays: {
        orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          capability: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });

  return location;
}

export async function updateSite(input: {
  orgId: string;
  userId: string;
  locationId: string;
  name: string;
  code: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  locality?: string | null;
  region?: string | null;
  postcode?: string | null;
  phone?: string | null;
  dailyCapacityHours: number;
  opensAtMinute: number;
  closesAtMinute: number;
}): Promise<void> {
  const code = normaliseCode(input.code);
  assertSiteSaveable({ ...input, code });

  const before = await prisma.location.findFirst({
    where: { id: input.locationId, orgId: input.orgId },
    select: {
      name: true,
      code: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      region: true,
      postcode: true,
      phone: true,
      dailyCapacityHours: true,
      opensAtMinute: true,
      closesAtMinute: true,
    },
  });
  if (!before) throw new SettingsError('NOT_YOURS', 'That site is not this workshop’s.');

  const after = {
    name: input.name.trim(),
    code,
    addressLine1: tidy(input.addressLine1),
    addressLine2: tidy(input.addressLine2),
    locality: tidy(input.locality),
    region: tidy(input.region),
    postcode: tidy(input.postcode),
    phone: tidy(input.phone),
    dailyCapacityHours: input.dailyCapacityHours,
    opensAtMinute: input.opensAtMinute,
    closesAtMinute: input.closesAtMinute,
  };

  try {
    await prisma.location.update({ where: { id: input.locationId }, data: after });
  } catch (error) {
    duplicateOf(error, 'site');
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.site',
    entityType: 'Location',
    entityId: input.locationId,
    before: { ...before, dailyCapacityHours: Number(before.dailyCapacityHours) },
    after,
  });
}

export async function saveBay(input: {
  orgId: string;
  userId: string;
  locationId: string;
  bayId?: string | null;
  name: string;
  code: string;
  capability?: string | null;
}): Promise<string> {
  const code = normaliseCode(input.code);
  assertBaySaveable({ name: input.name, code });

  const location = await prisma.location.findFirst({
    where: { id: input.locationId, orgId: input.orgId },
    select: { id: true, _count: { select: { bays: true } } },
  });
  if (!location) throw new SettingsError('NOT_YOURS', 'That site is not this workshop’s.');

  const data = { name: input.name.trim(), code, capability: tidy(input.capability) };

  try {
    if (input.bayId) {
      const before = await prisma.bay.findFirst({
        where: { id: input.bayId, locationId: location.id },
        select: { name: true, code: true, capability: true },
      });
      if (!before) throw new SettingsError('NOT_YOURS', 'That bay is not at this site.');

      await prisma.bay.update({ where: { id: input.bayId }, data });
      await audit({
        orgId: input.orgId,
        actorUserId: input.userId,
        action: 'settings.bay',
        entityType: 'Bay',
        entityId: input.bayId,
        before,
        after: data,
      });
      return input.bayId;
    }

    // One more bay is what the plan is priced by.
    const bays = await prisma.bay.count({
      where: { location: { orgId: input.orgId }, isActive: true },
    });
    await assertWithinLimit(input.orgId, 'bays', bays);

    const bay = await prisma.bay.create({
      data: { ...data, locationId: location.id, sortOrder: location._count.bays + 1 },
      select: { id: true },
    });
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'settings.bay',
      entityType: 'Bay',
      entityId: bay.id,
      after: data,
    });
    return bay.id;
  } catch (error) {
    return duplicateOf(error, 'bay');
  }
}

export async function setBayActive(input: {
  orgId: string;
  userId: string;
  bayId: string;
  active: boolean;
}): Promise<void> {
  const bay = await prisma.bay.findFirst({
    where: { id: input.bayId, location: { orgId: input.orgId } },
    select: { id: true, name: true, isActive: true, locationId: true },
  });
  if (!bay) throw new SettingsError('NOT_YOURS', 'That bay is not this workshop’s.');
  if (bay.isActive === input.active) return;

  if (!input.active) {
    const remaining = await prisma.bay.count({
      where: { locationId: bay.locationId, isActive: true, NOT: { id: bay.id } },
    });
    assertNotTheLast(remaining, 'bay at this site');
  }

  await prisma.bay.update({ where: { id: bay.id }, data: { isActive: input.active } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.active ? 'settings.bay.restored' : 'settings.bay.retired',
    entityType: 'Bay',
    entityId: bay.id,
    before: { isActive: bay.isActive },
    after: { isActive: input.active, name: bay.name },
  });
}

/* ----------------------------------------------------------- the catalogue */

export async function catalogueSettings(orgId: string) {
  const [taxRates, jobTypes] = await Promise.all([
    prisma.taxRate.findMany({
      where: { orgId },
      orderBy: [{ isActive: 'desc' }, { isDefault: 'desc' }, { rate: 'desc' }],
      select: {
        id: true,
        name: true,
        rate: true,
        isDefault: true,
        isActive: true,
        components: {
          orderBy: { sortOrder: 'asc' },
          select: { name: true, rate: true, compound: true },
        },
      },
    }),
    prisma.jobType.findMany({
      where: { orgId },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        colour: true,
        requiresQualityCheck: true,
        defaultHours: true,
        isActive: true,
        _count: { select: { jobs: true, skills: true } },
      },
    }),
  ]);

  return { taxRates, jobTypes };
}

export async function saveTaxRate(input: {
  orgId: string;
  userId: string;
  taxRateId?: string | null;
  name: string;
  rate: number;
}): Promise<string> {
  assertTaxRateSaveable(input);
  const data = { name: input.name.trim(), rate: input.rate };

  try {
    if (input.taxRateId) {
      const before = await prisma.taxRate.findFirst({
        where: { id: input.taxRateId, orgId: input.orgId },
        select: { name: true, rate: true },
      });
      if (!before) throw new SettingsError('NOT_YOURS', 'That tax rate is not this workshop’s.');

      // The percentage on a rate that has been used is not changed: lines
      // already priced at it would silently re-price. A new percentage is a
      // new rate, and the old one is retired.
      const used = await prisma.invoiceLine.count({ where: { taxRateId: input.taxRateId } });
      if (used > 0 && Number(before.rate) !== input.rate) {
        throw new SettingsError(
          'BAD_RATE',
          `That rate is on ${used} invoice line${used === 1 ? '' : 's'}. Add a new rate at ${input.rate}% and retire this one, so what was invoiced keeps reading the way it was.`,
        );
      }

      await prisma.taxRate.update({ where: { id: input.taxRateId }, data });
      await audit({
        orgId: input.orgId,
        actorUserId: input.userId,
        action: 'settings.taxrate',
        entityType: 'TaxRate',
        entityId: input.taxRateId,
        before: { ...before, rate: Number(before.rate) },
        after: data,
      });
      return input.taxRateId;
    }

    const rate = await prisma.taxRate.create({
      data: { ...data, orgId: input.orgId },
      select: { id: true },
    });
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'settings.taxrate',
      entityType: 'TaxRate',
      entityId: rate.id,
      after: data,
    });
    return rate.id;
  } catch (error) {
    return duplicateOf(error, 'tax rate');
  }
}

/** Exactly one default at a time, in one transaction. */
export async function setDefaultTaxRate(input: {
  orgId: string;
  userId: string;
  taxRateId: string;
}): Promise<void> {
  const rate = await prisma.taxRate.findFirst({
    where: { id: input.taxRateId, orgId: input.orgId, isActive: true },
    select: { id: true, name: true },
  });
  if (!rate)
    throw new SettingsError('NOT_YOURS', 'That tax rate is not one this workshop can use.');

  await prisma.$transaction([
    prisma.taxRate.updateMany({
      where: { orgId: input.orgId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.taxRate.update({ where: { id: rate.id }, data: { isDefault: true } }),
  ]);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'settings.taxrate.default',
    entityType: 'TaxRate',
    entityId: rate.id,
    after: { name: rate.name, isDefault: true },
  });
}

export async function setTaxRateActive(input: {
  orgId: string;
  userId: string;
  taxRateId: string;
  active: boolean;
}): Promise<void> {
  const rate = await prisma.taxRate.findFirst({
    where: { id: input.taxRateId, orgId: input.orgId },
    select: { id: true, name: true, isActive: true, isDefault: true },
  });
  if (!rate) throw new SettingsError('NOT_YOURS', 'That tax rate is not this workshop’s.');
  if (rate.isActive === input.active) return;

  if (!input.active) {
    if (rate.isDefault) {
      throw new SettingsError(
        'LAST_ONE',
        'That is the default rate. Make another the default first.',
      );
    }
    const remaining = await prisma.taxRate.count({
      where: { orgId: input.orgId, isActive: true, NOT: { id: rate.id } },
    });
    assertNotTheLast(remaining, 'tax rate');
  }

  await prisma.taxRate.update({ where: { id: rate.id }, data: { isActive: input.active } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.active ? 'settings.taxrate.restored' : 'settings.taxrate.retired',
    entityType: 'TaxRate',
    entityId: rate.id,
    before: { isActive: rate.isActive },
    after: { isActive: input.active, name: rate.name },
  });
}

export async function saveJobType(input: {
  orgId: string;
  userId: string;
  jobTypeId?: string | null;
  name: string;
  colour: string;
  defaultHours: number | null;
  requiresQualityCheck: boolean;
}): Promise<string> {
  const colour = input.colour.trim().toLowerCase();
  assertJobTypeSaveable({ ...input, colour });

  const data = {
    name: input.name.trim(),
    colour,
    defaultHours: input.defaultHours,
    requiresQualityCheck: input.requiresQualityCheck,
  };

  try {
    if (input.jobTypeId) {
      const before = await prisma.jobType.findFirst({
        where: { id: input.jobTypeId, orgId: input.orgId },
        select: { name: true, colour: true, defaultHours: true, requiresQualityCheck: true },
      });
      if (!before)
        throw new SettingsError('NOT_YOURS', 'That kind of work is not this workshop’s.');

      await prisma.jobType.update({ where: { id: input.jobTypeId }, data });
      await audit({
        orgId: input.orgId,
        actorUserId: input.userId,
        action: 'settings.jobtype',
        entityType: 'JobType',
        entityId: input.jobTypeId,
        before: {
          ...before,
          defaultHours: before.defaultHours === null ? null : Number(before.defaultHours),
        },
        after: data,
      });
      return input.jobTypeId;
    }

    const count = await prisma.jobType.count({ where: { orgId: input.orgId } });
    const type = await prisma.jobType.create({
      data: { ...data, orgId: input.orgId, sortOrder: count + 1 },
      select: { id: true },
    });
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'settings.jobtype',
      entityType: 'JobType',
      entityId: type.id,
      after: data,
    });
    return type.id;
  } catch (error) {
    return duplicateOf(error, 'kind of work');
  }
}

export async function setJobTypeActive(input: {
  orgId: string;
  userId: string;
  jobTypeId: string;
  active: boolean;
}): Promise<void> {
  const type = await prisma.jobType.findFirst({
    where: { id: input.jobTypeId, orgId: input.orgId },
    select: { id: true, name: true, isActive: true },
  });
  if (!type) throw new SettingsError('NOT_YOURS', 'That kind of work is not this workshop’s.');
  if (type.isActive === input.active) return;

  await prisma.jobType.update({ where: { id: type.id }, data: { isActive: input.active } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.active ? 'settings.jobtype.restored' : 'settings.jobtype.retired',
    entityType: 'JobType',
    entityId: type.id,
    before: { isActive: type.isActive },
    after: { isActive: input.active, name: type.name },
  });
}

/** For the settings overview: what changed lately, in words. */
export function changeSummary(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string {
  const lines = describeChanges(before, after);
  return lines.length === 0 ? 'Nothing changed.' : lines.join('; ');
}
