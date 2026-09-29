import {
  type FitEvidence,
  fitsVehicle,
  promiseVersusRecord,
  type RankedOffer,
  rankSubstitutes,
  type Substitute,
  type SupplierOffer,
  theChoice,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { supplierOptionsFor } from './owner';

/**
 * Where to buy a part, and what to fit when you cannot.
 *
 * Until Phase 87 a Product and a Supplier were not joined by anything at all.
 * A part carried one cost price — whatever it happened to cost the last time
 * somebody bought one — and knowing where to get it lived in one person's
 * head. That person goes on holiday, and the workshop quotes a customer a
 * figure from two years ago.
 *
 * Two things live here. The offers, which are typed by the workshop and
 * ranked on the four questions a buyer actually asks; and the substitutes,
 * which are not typed by anybody — every one is derived from a record this
 * database already holds, because the alternative is inventing a confidence
 * score, and an invented score is how the wrong pads reach a car.
 *
 * Phase 87.
 */

export class SourcingError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'NO_EVIDENCE' | 'SAME_PART' | 'NOT_OURS',
    message: string,
  ) {
    super(message);
    this.name = 'SourcingError';
  }
}

/* ------------------------------------------------------------------ offers */

function asOffer(row: {
  supplierId: string;
  supplier: { name: string };
  supplierPartNumber: string | null;
  brand: string | null;
  price: unknown;
  leadTimeDays: number | null;
  inStock: boolean | null;
  warrantyMonths: number | null;
  confirmedAt: Date;
}): SupplierOffer {
  return {
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    supplierPartNumber: row.supplierPartNumber,
    brand: row.brand,
    price: Number(row.price),
    leadTimeDays: row.leadTimeDays,
    inStock: row.inStock,
    warrantyMonths: row.warrantyMonths,
    confirmedAt: row.confirmedAt,
  };
}

/**
 * Every supplier who sells this part, ranked, with the argument against the
 * recommendation beside it.
 *
 * `neededBy` is the day the car is promised. Without one every offer arrives
 * in time, which is correct: there is no deadline to miss.
 */
export async function whereToBuy(
  orgId: string,
  productId: string,
  options: { neededBy?: Date | null; now?: Date } = {},
) {
  const rows = await prisma.supplierPart.findMany({
    where: { orgId, productId, isActive: true, supplier: { isActive: true } },
    select: {
      id: true,
      supplierId: true,
      supplier: { select: { name: true } },
      supplierPartNumber: true,
      brand: true,
      price: true,
      leadTimeDays: true,
      inStock: true,
      warrantyMonths: true,
      note: true,
      confirmedAt: true,
      confirmedBy: { select: { name: true } },
    },
  });

  const now = options.now ?? new Date();
  const byId = new Map(rows.map((row) => [row.supplierId, row]));
  const choice = theChoice(rows.map(asOffer), { now, neededBy: options.neededBy });

  if (!choice) return null;

  // What they say, beside what they have done. Phase 52 has measured every
  // supplier's deliveries against the day they promised ever since, and the
  // two numbers had never been put on the same screen -- so a supplier could
  // quote next-day while their own record said they make it two thirds of the
  // time, and nothing said so.
  const measured = new Map(
    (await supplierOptionsFor(orgId, productId, now)).map((option) => [option.id, option.measures]),
  );

  // The row id and who confirmed it, carried back onto the ranked offer so a
  // screen can edit the row it is looking at rather than search for it again.
  const decorate = (offer: RankedOffer) => {
    const measures = measured.get(offer.supplierId) ?? null;
    return {
      ...offer,
      rowId: byId.get(offer.supplierId)?.id ?? '',
      note: byId.get(offer.supplierId)?.note ?? null,
      confirmedBy: byId.get(offer.supplierId)?.confirmedBy?.name ?? null,
      onTimePct: measures?.onTimePct ?? null,
      ordersBehindIt: measures?.orders ?? 0,
      record: promiseVersusRecord(measures?.onTimePct ?? null),
    };
  };

  return {
    ...choice,
    pick: decorate(choice.pick),
    all: choice.all.map(decorate),
    cheaper: choice.cheaper ? decorate(choice.cheaper) : null,
  };
}

/** Record, or re-confirm, what one supplier charges for one part. */
export async function recordOffer(input: {
  orgId: string;
  userId: string;
  supplierId: string;
  productId: string;
  price: number;
  supplierPartNumber?: string | null;
  brand?: string | null;
  leadTimeDays?: number | null;
  inStock?: boolean | null;
  warrantyMonths?: number | null;
  note?: string | null;
}): Promise<void> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, orgId: input.orgId },
    select: { id: true },
  });
  const product = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
    select: { id: true },
  });

  if (!supplier || !product) {
    throw new SourcingError('NOT_FOUND', 'That supplier or part was not found.');
  }

  const before = await prisma.supplierPart.findUnique({
    where: { supplierId_productId: { supplierId: supplier.id, productId: product.id } },
    select: { price: true, leadTimeDays: true, inStock: true, warrantyMonths: true },
  });

  const fields = {
    supplierPartNumber: input.supplierPartNumber?.trim() || null,
    brand: input.brand?.trim() || null,
    price: input.price,
    leadTimeDays: input.leadTimeDays ?? null,
    inStock: input.inStock ?? null,
    warrantyMonths: input.warrantyMonths ?? null,
    note: input.note?.trim() || null,
    isActive: true,
    // Saving the row IS the confirmation: somebody has just looked at all four
    // figures and pressed save. Nothing else sets this, which is why a tidy-up
    // of the note cannot quietly make a two-year-old price look current.
    confirmedAt: new Date(),
    confirmedByUserId: input.userId,
  };

  await prisma.supplierPart.upsert({
    where: { supplierId_productId: { supplierId: supplier.id, productId: product.id } },
    create: { orgId: input.orgId, supplierId: supplier.id, productId: product.id, ...fields },
    update: fields,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: before ? 'supplier-part.update' : 'supplier-part.create',
    entityType: 'SupplierPart',
    entityId: `${supplier.id}:${product.id}`,
    before: before
      ? {
          price: Number(before.price),
          leadTimeDays: before.leadTimeDays,
          inStock: before.inStock,
          warrantyMonths: before.warrantyMonths,
        }
      : null,
    after: {
      price: input.price,
      leadTimeDays: fields.leadTimeDays,
      inStock: fields.inStock,
      warrantyMonths: fields.warrantyMonths,
    },
  });
}

/** Take a supplier off a part without losing what they last quoted. */
export async function retireOffer(input: {
  orgId: string;
  userId: string;
  rowId: string;
}): Promise<void> {
  const row = await prisma.supplierPart.findFirst({
    where: { id: input.rowId, orgId: input.orgId },
    select: { id: true, supplierId: true, productId: true },
  });
  if (!row) throw new SourcingError('NOT_FOUND', 'That supplier price was not found.');

  await prisma.supplierPart.update({ where: { id: row.id }, data: { isActive: false } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplier-part.retire',
    entityType: 'SupplierPart',
    entityId: `${row.supplierId}:${row.productId}`,
    before: { isActive: true },
    after: { isActive: false },
  });
}

/* ------------------------------------------------------------ substitutes */

/**
 * What else would do, and why we believe it.
 *
 * Two records can put a part on this list, and only two: somebody here has
 * already fitted it in place of the other one and confirmed that, or a
 * supplier lists both of them under one number. Both are claims that the two
 * parts *are the same thing*.
 *
 * Everything else — we fitted it to this car, to this model, somebody typed a
 * fitment, a catalogue agrees — says only that the part *suits the car*, which
 * is a different claim, and is gathered here as corroboration to show beside a
 * candidate that already qualifies. The first draft of this function treated
 * the two as one, and the screen offered a brake disc as an alternative to a
 * set of brake pads: both in the braking category, both fitting the car.
 */
export async function whatElseWouldDo(
  orgId: string,
  productId: string,
  options: { vehicleId?: string | null; limit?: number } = {},
) {
  const original = await prisma.product.findFirst({
    where: { id: productId, orgId },
    select: { id: true, partNumber: true, name: true, brand: true, categoryId: true },
  });
  if (!original) throw new SourcingError('NOT_FOUND', 'That part was not found.');

  // A vehicle carries no orgId -- the passport outlives the workshop -- so it
  // is reached through a job this workshop has had on it, which is also the
  // only circumstance in which its history is any of our business.
  const vehicle = options.vehicleId
    ? await prisma.vehicle.findFirst({
        where: { id: options.vehicleId, jobs: { some: { orgId } } },
        select: { id: true, make: true, model: true, year: true, engineCode: true },
      })
    : null;

  const evidence = new Map<string, Set<FitEvidence>>();
  const note = (id: string, kind: FitEvidence) => {
    if (id === original.id) return;
    const set = evidence.get(id) ?? new Set<FitEvidence>();
    set.add(kind);
    evidence.set(id, set);
  };

  // 1. A swap this workshop has already made and confirmed.
  //
  //    The strongest thing there is, and the reason the list grows: one
  //    confirmation teaches the product something permanent about those two
  //    parts, the same way Phase 81's diagnosis corpus is built out of
  //    verdicts technicians were making anyway. Direction matters -- this one
  //    fitted in place of that one, not the reverse.
  const doneBefore = await prisma.jobPartLine.findMany({
    where: {
      job: { orgId },
      substitutedForProductId: original.id,
      productId: { not: null },
      product: { isActive: true },
    },
    select: { productId: true },
    take: 200,
  });
  for (const one of doneBefore) if (one.productId) note(one.productId, 'SUBSTITUTED_BEFORE');

  // 2. A supplier who lists both of them under one number.
  //
  //    Not our own numbering: `products` is unique on (org, partNumber), so
  //    two of our products can never share one and the obvious reading of
  //    this rule could never fire at all. A factor selling the OE disc and
  //    the aftermarket disc under one line is a factor saying they are the
  //    same thing with their own money behind it, which is worth more.
  const ourNumbers = await prisma.supplierPart.findMany({
    where: { orgId, productId: original.id, supplierPartNumber: { not: null } },
    select: { supplierPartNumber: true },
  });

  const numbers = [
    original.partNumber,
    ...ourNumbers.map((row) => row.supplierPartNumber!).filter(Boolean),
  ];

  const sameNumber = await prisma.supplierPart.findMany({
    where: {
      orgId,
      productId: { not: original.id },
      isActive: true,
      product: { isActive: true },
      supplierPartNumber: { in: numbers, mode: 'insensitive' },
    },
    select: { productId: true },
  });
  for (const one of sameNumber) note(one.productId, 'SAME_PART_NUMBER');

  if (vehicle) {
    // 3. What we have actually put on this car, and on cars like it. This is
    //    the strongest evidence there is and it is free: the job history has
    //    been recording it since Phase 1.
    const onThisCar = await prisma.jobPartLine.findMany({
      where: {
        job: { orgId, vehicleId: vehicle.id },
        status: 'FITTED',
        productId: { not: null },
        product: { categoryId: original.categoryId ?? undefined, isActive: true },
      },
      select: { productId: true },
      take: 200,
    });
    for (const line of onThisCar) if (line.productId) note(line.productId, 'FITTED_TO_THIS_CAR');

    if (vehicle.make && vehicle.model) {
      const onThisModel = await prisma.jobPartLine.findMany({
        where: {
          job: {
            orgId,
            vehicle: {
              make: { equals: vehicle.make, mode: 'insensitive' },
              model: { equals: vehicle.model, mode: 'insensitive' },
            },
          },
          status: 'FITTED',
          productId: { not: null },
          product: { categoryId: original.categoryId ?? undefined, isActive: true },
        },
        select: { productId: true },
        take: 400,
      });
      for (const line of onThisModel) {
        if (line.productId) note(line.productId, 'FITTED_TO_THIS_MODEL');
      }
    }

    // 4. Fitment rows, read through the same rule the part page uses, so a
    //    part is never called an equivalent here on evidence the fitment
    //    screen would call UNKNOWN.
    const fitted = await prisma.partFitment.findMany({
      where: {
        orgId,
        productId: { not: original.id },
        product: { categoryId: original.categoryId ?? undefined, isActive: true },
        make: { equals: vehicle.make ?? '', mode: 'insensitive' },
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
      },
      take: 400,
    });

    const byProduct = new Map<string, typeof fitted>();
    for (const row of fitted) {
      byProduct.set(row.productId, [...(byProduct.get(row.productId) ?? []), row]);
    }

    for (const [candidateId, rows] of byProduct) {
      const verdict = fitsVehicle(
        rows.map((row) => ({
          make: row.make,
          model: row.model,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
          engineCode: row.engineCode,
          source: row.source,
          note: row.note,
        })),
        {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          engineCode: vehicle.engineCode,
        },
      );

      if (verdict.verdict !== 'FITS') continue;
      note(candidateId, verdict.matched?.source === 'WORKSHOP' ? 'RECORDED_HERE' : 'CATALOGUE');
    }
  }

  if (evidence.size === 0) return { original, vehicle, candidates: [] as const };

  const products = await prisma.product.findMany({
    where: { orgId, id: { in: [...evidence.keys()] }, isActive: true },
    select: {
      id: true,
      partNumber: true,
      name: true,
      brand: true,
      costPrice: true,
      stockLevels: { select: { onHand: true, reserved: true } },
    },
  });

  const candidates: Substitute[] = products.map((product) => ({
    productId: product.id,
    partNumber: product.partNumber,
    name: product.name,
    brand: product.brand,
    evidence: [...(evidence.get(product.id) ?? [])],
    // Free stock, not stock on hand: a disc reserved against another job is
    // not a disc anybody can fit to this one.
    inStock: product.stockLevels.reduce(
      (total, level) => total + Number(level.onHand) - Number(level.reserved),
      0,
    ),
    cost: Number(product.costPrice) || null,
  }));

  return {
    original,
    vehicle,
    candidates: rankSubstitutes(candidates).slice(0, options.limit ?? 8),
  };
}

/**
 * Record that a different part went on, and who said it was the right one.
 *
 * Nothing here decides anything. The evidence is checked against what the
 * database actually holds — a caller cannot claim `FITTED_TO_THIS_CAR` for a
 * part that never was — and then the line carries the substitution, the
 * evidence and the person, together, because the database will not accept
 * them apart.
 */
export async function confirmSubstitution(input: {
  orgId: string;
  userId: string;
  partLineId: string;
  productId: string;
}): Promise<FitEvidence> {
  const line = await prisma.jobPartLine.findFirst({
    where: { id: input.partLineId, job: { orgId: input.orgId } },
    select: {
      id: true,
      productId: true,
      description: true,
      job: { select: { id: true, vehicleId: true } },
    },
  });
  if (!line) throw new SourcingError('NOT_FOUND', 'That part line was not found.');
  if (!line.productId) {
    throw new SourcingError('NOT_FOUND', 'That line is not a catalogued part.');
  }
  if (line.productId === input.productId) {
    throw new SourcingError('SAME_PART', 'That is the part already on the line.');
  }

  // The evidence is recomputed here rather than trusted from the form. A form
  // field saying "we fitted this to this car before" is a claim the person
  // posting it can make about any part at all.
  const found = await whatElseWouldDo(input.orgId, line.productId, {
    vehicleId: line.job.vehicleId,
  });
  const chosen = found.candidates.find((one) => one.productId === input.productId);

  if (!chosen) {
    throw new SourcingError(
      'NO_EVIDENCE',
      'Nothing on record says that part fits this car. Record a fitment first.',
    );
  }

  const replacement = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
    select: { id: true, partNumber: true, name: true, costPrice: true, sellPrice: true },
  });
  if (!replacement) throw new SourcingError('NOT_FOUND', 'That part was not found.');

  await prisma.jobPartLine.update({
    where: { id: line.id },
    data: {
      productId: replacement.id,
      partNumber: replacement.partNumber,
      description: replacement.name,
      unitCost: replacement.costPrice,
      unitPrice: replacement.sellPrice,
      substitutedForProductId: line.productId,
      substitutionEvidence: chosen.strongest,
      substitutionConfirmedByUserId: input.userId,
      substitutionConfirmedAt: new Date(),
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.part.substituted',
    entityType: 'JobPartLine',
    entityId: line.id,
    before: { productId: line.productId, description: line.description },
    after: {
      productId: replacement.id,
      description: replacement.name,
      evidence: chosen.strongest,
    },
  });

  return chosen.strongest;
}
