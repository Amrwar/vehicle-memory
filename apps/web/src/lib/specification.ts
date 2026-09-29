import {
  coerceSpec,
  fitsVehicle,
  resolveSpec,
  type SpecCandidate,
  SPEC_KEYS,
  type SpecKey,
  type SpecValues,
  disagreements,
  howFull,
  intervalsFrom,
  missingSpec,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * What the car takes, gathered from what the workshop already knows.
 *
 * Three things go into the sheet and only one of them is typed for this car.
 * The model sheet — written once for a make, model, year range and engine —
 * is where almost every number comes from, because a car added from its VIN
 * decodes to exactly that key. A car-specific sheet overrides it where
 * somebody has looked at *that* vehicle. A feed would sit underneath both;
 * the columns are there and nothing writes them yet.
 *
 * Two more blocks sit beside the sheet rather than in it, and both are read
 * off records this database has held for years:
 *
 *   - **the filters that fit**, from the fitment rows Phase 43 built;
 *   - **what has actually gone in**, from the parts fitted on past jobs.
 *
 * Neither is merged into the sheet, and the reason is worth stating. Reading
 * "0W-20" out of a product called "Engine oil 0W-20, 5L" means parsing a name
 * a person typed, and a parser that is wrong once has put the wrong oil in an
 * engine. Showing the product verbatim beside the sheet claims nothing and
 * lets a technician see for themselves that the two disagree.
 *
 * Phase 88.
 */

export class SpecificationError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'NOT_OURS' | 'NOTHING_TO_SAVE' | 'NOT_A_NUMBER',
    message: string,
  ) {
    super(message);
    this.name = 'SpecificationError';
  }
}

type Row = {
  id: string;
  vehicleId: string | null;
  make: string | null;
  model: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string | null;
  feedName: string | null;
  fetchedAt: Date | null;
  updatedAt: Date;
} & Record<string, unknown>;

/** The fourteen columns off a row, as the core rules want them. */
function valuesOf(row: Row): SpecValues {
  const values: SpecValues = {};
  for (const key of SPEC_KEYS) {
    const raw = row[key];
    if (raw === null || raw === undefined) continue;
    values[key] = typeof raw === 'object' ? Number(raw) : (raw as string | number);
  }
  return values;
}

const COLUMNS = Object.fromEntries(SPEC_KEYS.map((key) => [key, true]));

/**
 * Which model sheets apply to a car.
 *
 * Read through `fitsVehicle`, the same rule the parts screens use, so a sheet
 * is never applied to a car the fitment screen would call UNKNOWN. A model
 * sheet is a fitment claim wearing different clothes: "these numbers are true
 * of that make, model, those years, that engine".
 */
function sheetsFor(
  rows: Row[],
  vehicle: {
    make: string | null;
    model: string | null;
    year: number | null;
    engineCode: string | null;
  },
): Row[] {
  return rows.filter(
    (row) =>
      fitsVehicle(
        [
          {
            make: row.make ?? '',
            model: row.model,
            yearFrom: row.yearFrom,
            yearTo: row.yearTo,
            engineCode: row.engineCode,
            source: 'WORKSHOP',
            note: null,
          },
        ],
        vehicle,
      ).verdict === 'FITS',
  );
}

/** The whole sheet for one car, with the source of every line on it. */
export async function whatTheCarTakes(orgId: string, vehicleId: string) {
  // A vehicle carries no orgId -- the passport outlives the workshop -- so it
  // is reached through a job or booking this workshop has had on it.
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      OR: [{ jobs: { some: { orgId } } }, { bookings: { some: { orgId } } }],
    },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      engineCode: true,
      engineCapacityCc: true,
      fuelType: true,
      registration: true,
    },
  });

  if (!vehicle) throw new SpecificationError('NOT_FOUND', 'That vehicle was not found.');

  const rows = (await prisma.vehicleSpecification.findMany({
    where: { orgId, OR: [{ vehicleId }, { vehicleId: null }] },
    select: {
      id: true,
      vehicleId: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engineCode: true,
      note: true,
      feedName: true,
      fetchedAt: true,
      updatedAt: true,
      ...COLUMNS,
    },
  })) as unknown as Row[];

  const own = rows.find((row) => row.vehicleId === vehicleId) ?? null;
  const models = sheetsFor(
    rows.filter((row) => row.vehicleId === null && row.feedName === null),
    vehicle,
  );
  const feeds = sheetsFor(
    rows.filter((row) => row.vehicleId === null && row.feedName !== null),
    vehicle,
  );

  const candidates: SpecCandidate[] = [
    ...(own ? [{ source: 'THIS_CAR' as const, values: valuesOf(own), at: own.updatedAt }] : []),
    ...models.map((row) => ({
      source: 'MODEL_SHEET' as const,
      values: valuesOf(row),
      at: row.updatedAt,
    })),
    ...feeds.map((row) => ({
      source: 'FEED' as const,
      values: valuesOf(row),
      feedName: row.feedName,
      at: row.fetchedAt,
    })),
  ];

  const lines = resolveSpec(candidates);

  return {
    vehicle,
    lines,
    missing: missingSpec(lines),
    disagreements: disagreements(lines),
    howFull: howFull(lines),
    intervals: intervalsFrom(lines),
    /** The row a screen would edit for this car, where one exists. */
    ownSheetId: own?.id ?? null,
    /** The model sheets it is inheriting from, so the screen can name them. */
    inheritedFrom: models.map((row) => ({
      id: row.id,
      make: row.make,
      model: row.model,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
      engineCode: row.engineCode,
    })),
  };
}

/**
 * The filters and other parts a fitment row says belong on this car.
 *
 * Nothing new is stored: these are the `PartFitment` rows Phase 43 already
 * holds, read through the same rule, so the specification sheet and the part
 * page can never disagree about what fits.
 */
export async function partsThatFit(orgId: string, vehicleId: string, limit = 12) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      OR: [{ jobs: { some: { orgId } } }, { bookings: { some: { orgId } } }],
    },
    select: { make: true, model: true, year: true, engineCode: true },
  });
  if (!vehicle?.make) return [];

  const rows = await prisma.partFitment.findMany({
    where: {
      orgId,
      make: { equals: vehicle.make, mode: 'insensitive' },
      product: { isActive: true },
    },
    select: {
      productId: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engineCode: true,
      source: true,
      note: true,
      product: {
        select: {
          id: true,
          partNumber: true,
          name: true,
          brand: true,
          category: { select: { name: true } },
          stockLevels: { select: { onHand: true, reserved: true } },
        },
      },
    },
    take: 400,
  });

  const seen = new Set<string>();
  const fits: {
    productId: string;
    partNumber: string;
    name: string;
    brand: string | null;
    category: string | null;
    inStock: number;
  }[] = [];

  for (const row of rows) {
    if (seen.has(row.productId)) continue;
    const verdict = fitsVehicle(
      [
        {
          make: row.make,
          model: row.model,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
          engineCode: row.engineCode,
          source: row.source,
          note: row.note,
        },
      ],
      vehicle,
    );
    if (verdict.verdict !== 'FITS') continue;

    seen.add(row.productId);
    fits.push({
      productId: row.product.id,
      partNumber: row.product.partNumber,
      name: row.product.name,
      brand: row.product.brand,
      category: row.product.category?.name ?? null,
      inStock: row.product.stockLevels.reduce(
        (total, level) => total + Number(level.onHand) - Number(level.reserved),
        0,
      ),
    });
  }

  return fits.slice(0, limit);
}

/**
 * What has actually gone into this car, most recent first.
 *
 * Shown beside the sheet and never merged into it. A product called "Engine
 * oil 0W-20, 5L" is a name somebody typed, and reading a grade out of it means
 * writing a parser that will one day be wrong about an engine. Verbatim, with
 * the date, claims nothing and still lets a technician see that the sheet and
 * the last service disagree.
 */
export async function whatWentIn(orgId: string, vehicleId: string, limit = 8) {
  const lines = await prisma.jobPartLine.findMany({
    where: { job: { orgId, vehicleId }, status: 'FITTED' },
    orderBy: { job: { completedAt: 'desc' } },
    select: {
      id: true,
      description: true,
      partNumber: true,
      quantity: true,
      job: { select: { id: true, number: true, completedAt: true } },
    },
    take: limit,
  });

  return lines.map((line) => ({
    id: line.id,
    description: line.description,
    partNumber: line.partNumber,
    quantity: Number(line.quantity),
    jobId: line.job.id,
    jobNumber: line.job.number,
    at: line.job.completedAt,
  }));
}

/** Everything a form may send. Anything absent is left as it was. */
export type SpecInput = Partial<Record<SpecKey, string | number | null>> & { note?: string | null };

/**
 * A form's strings, turned into what the columns hold -- or refused.
 *
 * `coerceSpec` is in the pure rules and tested there. A typed pressure that is
 * not a number comes back refused rather than silently becoming nought, which
 * matters because nought bar is a real pressure and a real thing to be wrong
 * about.
 */
/**
 * The one cast in this file, in one place with its reason written down.
 *
 * `SpecValues` is keyed by `SpecKey` with a union value, because the rules
 * that reason about the sheet do not care which column holds which; Prisma's
 * generated input types care a great deal. `coerceSpec` has already turned
 * every figure into the kind its column holds, and `verify-specification`
 * proves it by writing every line and reading it back, so the cast is checked
 * by something that runs rather than by assertion.
 */
function asColumns(data: SpecValues & { note: string | null }) {
  return data as Record<string, string | number | null>;
}

function cleaned(input: SpecInput): SpecValues {
  const { values, refused } = coerceSpec(input as Partial<Record<SpecKey, unknown>>);
  if (refused.length > 0) {
    throw new SpecificationError(
      'NOT_A_NUMBER',
      'Those figures need to be numbers, or left empty.',
    );
  }
  return values;
}

/** Write, or rewrite, the sheet for one car. */
export async function recordCarSheet(input: {
  orgId: string;
  userId: string;
  vehicleId: string;
  values: SpecInput;
}): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: input.vehicleId,
      OR: [
        { jobs: { some: { orgId: input.orgId } } },
        { bookings: { some: { orgId: input.orgId } } },
      ],
    },
    select: { id: true },
  });
  if (!vehicle) throw new SpecificationError('NOT_FOUND', 'That vehicle was not found.');

  const values = cleaned(input.values);
  const before = await prisma.vehicleSpecification.findFirst({
    where: { orgId: input.orgId, vehicleId: vehicle.id },
    select: { id: true },
  });

  const data = { ...values, note: input.values.note?.toString().trim() || null };

  if (before) {
    await prisma.vehicleSpecification.update({ where: { id: before.id }, data: asColumns(data) });
  } else {
    await prisma.vehicleSpecification.create({
      data: {
        orgId: input.orgId,
        vehicleId: vehicle.id,
        recordedByUserId: input.userId,
        ...asColumns(data),
      },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: before ? 'vehicle.specification.update' : 'vehicle.specification.create',
    entityType: 'VehicleSpecification',
    entityId: vehicle.id,
    before: null,
    after: data as Record<string, unknown>,
  });
}

/** Write, or rewrite, the sheet for a model. This is the one that pays. */
export async function recordModelSheet(input: {
  orgId: string;
  userId: string;
  sheetId?: string | null;
  make: string;
  model?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineCode?: string | null;
  values: SpecInput;
}): Promise<string> {
  const make = input.make.trim();
  if (!make) {
    throw new SpecificationError('NOTHING_TO_SAVE', 'A model sheet needs at least a make.');
  }

  const data = {
    make,
    model: input.model?.trim() || null,
    yearFrom: input.yearFrom ?? null,
    yearTo: input.yearTo ?? null,
    engineCode: input.engineCode?.trim() || null,
    ...cleaned(input.values),
    note: input.values.note?.toString().trim() || null,
  };

  if (input.sheetId) {
    const existing = await prisma.vehicleSpecification.findFirst({
      where: { id: input.sheetId, orgId: input.orgId, vehicleId: null },
      select: { id: true },
    });
    if (!existing) throw new SpecificationError('NOT_FOUND', 'That sheet was not found.');

    await prisma.vehicleSpecification.update({ where: { id: existing.id }, data: asColumns(data) });
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'vehicle.specification.update',
      entityType: 'VehicleSpecification',
      entityId: existing.id,
      before: null,
      after: data as Record<string, unknown>,
    });
    return existing.id;
  }

  const created = await prisma.vehicleSpecification.create({
    data: { orgId: input.orgId, recordedByUserId: input.userId, ...asColumns(data) },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.specification.create',
    entityType: 'VehicleSpecification',
    entityId: created.id,
    before: null,
    after: data as Record<string, unknown>,
  });

  return created.id;
}

/** Take a sheet away. Only ever a sheet somebody here wrote. */
export async function removeSheet(input: {
  orgId: string;
  userId: string;
  sheetId: string;
}): Promise<void> {
  const sheet = await prisma.vehicleSpecification.findFirst({
    where: { id: input.sheetId, orgId: input.orgId },
    select: { id: true },
  });
  if (!sheet) throw new SpecificationError('NOT_FOUND', 'That sheet was not found.');

  await prisma.vehicleSpecification.delete({ where: { id: sheet.id } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.specification.delete',
    entityType: 'VehicleSpecification',
    entityId: sheet.id,
    before: null,
    after: null,
  });
}

/** Every model sheet the workshop has written, for a settings screen. */
export async function modelSheets(orgId: string) {
  const rows = (await prisma.vehicleSpecification.findMany({
    where: { orgId, vehicleId: null },
    orderBy: [{ make: 'asc' }, { model: 'asc' }, { yearFrom: 'asc' }],
    select: {
      id: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engineCode: true,
      note: true,
      feedName: true,
      fetchedAt: true,
      updatedAt: true,
      ...COLUMNS,
    },
  })) as unknown as Row[];

  return rows.map((row) => ({
    id: row.id,
    make: row.make,
    model: row.model,
    yearFrom: row.yearFrom,
    yearTo: row.yearTo,
    engineCode: row.engineCode,
    feedName: row.feedName,
    values: valuesOf(row),
    answered: Object.keys(valuesOf(row)).length,
  }));
}
