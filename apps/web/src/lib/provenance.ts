import {
  type AuditEntry,
  type Fitment,
  type FitmentSource,
  type FitResult,
  fitsVehicle,
  type Life,
  lifeOf,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Where a record came from, and whether a part belongs on a car.
 *
 * Two halves of one idea. The product is sold on the claim that its records
 * can be trusted, and a claim like that is only worth anything if somebody
 * can open any record and read how it got to be what it is.
 *
 * The audit log has held who, what, when, before and after since Phase 1 and
 * nothing has ever read it back except one page that mixes every action in
 * the organisation together. That page answers "what happened this morning".
 * It cannot answer "what happened to this quote", which is the question
 * people actually ask.
 */

/**
 * Entity types a life can be read for, and where to send somebody afterwards.
 *
 * An allow-list rather than anything the URL says. The entity type reaches
 * this from a path segment, and a type nobody vetted would let a URL enumerate
 * audit rows for records the page was never designed to expose.
 */
export const READABLE: Record<string, { label: string; href?: (id: string) => string }> = {
  Job: { label: 'Job', href: (id) => `/jobs/${id}` },
  Estimate: { label: 'Estimate' },
  Invoice: { label: 'Invoice' },
  Payment: { label: 'Payment' },
  Customer: { label: 'Customer', href: (id) => `/customers/${id}` },
  Vehicle: { label: 'Vehicle', href: (id) => `/vehicles/${id}` },
  Warranty: { label: 'Warranty', href: () => '/warranty' },
  WarrantyClaim: { label: 'Warranty claim', href: () => '/warranty' },
  Booking: { label: 'Booking', href: (id) => `/bookings/${id}` },
  Employee: { label: 'Employee', href: () => '/people' },
  Skill: { label: 'Skill', href: () => '/skills' },
  Supplier: { label: 'Supplier', href: (id) => `/suppliers/${id}` },
  PurchaseOrder: { label: 'Purchase order' },
  Organization: { label: 'Workshop', href: () => '/settings' },
  Inspection: { label: 'Inspection', href: () => '/inspections' },
  Product: { label: 'Part', href: (id) => `/parts/${id}` },
};

export interface Provenance extends Life {
  entityType: string;
  entityId: string;
  label: string;
  href: string | null;
}

/**
 * One record's whole life.
 *
 * Scoped to the organisation, because an audit row carries an entity id and
 * nothing else that would stop one workshop reading another's history by
 * guessing one.
 */
export async function lifeFor(
  orgId: string,
  entityType: string,
  entityId: string,
): Promise<Provenance | null> {
  const known = READABLE[entityType];
  if (!known) return null;

  const rows = await prisma.auditLog.findMany({
    where: { orgId, entityType, entityId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      before: true,
      after: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  const entries: AuditEntry[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorName: row.actor?.name ?? null,
    at: row.createdAt,
    before: row.before,
    after: row.after,
    ip: row.ip,
    userAgent: row.userAgent,
  }));

  return {
    ...lifeOf(entries),
    entityType,
    entityId,
    label: known.label,
    href: known.href ? known.href(entityId) : null,
  };
}

/**
 * The chain entries behind a vehicle's record, read as provenance.
 *
 * Separate from the audit life because these are a different kind of claim.
 * An audit row says a person did something; a chain entry says a fact about
 * the vehicle was recorded and is fixed by a hash. Presenting them in one
 * list would make the weaker claim look like the stronger one.
 */
export async function chainProvenance(vehicleId: string, limit = 40) {
  const events = await prisma.vehicleEvent.findMany({
    where: { vehicleId },
    orderBy: { sequence: 'desc' },
    take: limit,
    select: {
      id: true,
      sequence: true,
      type: true,
      title: true,
      summary: true,
      occurredAt: true,
      recordedAt: true,
      verification: true,
      odometerKm: true,
      jobRef: true,
      hash: true,
      prevHash: true,
      recordedByOrg: { select: { name: true } },
      recordedByUser: { select: { name: true } },
    },
  });

  return events.map((event) => ({
    ...event,
    // Enough of the hash to compare two screens by eye, which is what
    // somebody actually does with it. The whole thing is on the page it links
    // to for anyone who wants to verify it properly.
    fingerprint: event.hash.slice(0, 12),
  }));
}

/* ------------------------------------------------------------------------- */
/* Fitment                                                                    */
/* ------------------------------------------------------------------------- */

function toFitment(row: {
  make: string;
  model: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string | null;
  source: string;
  note: string | null;
}): Fitment {
  return { ...row, source: row.source as FitmentSource };
}

/** Everything recorded about what a part fits. */
export async function fitmentsFor(orgId: string, productId: string) {
  const rows = await prisma.partFitment.findMany({
    where: { orgId, productId },
    orderBy: [{ make: 'asc' }, { model: 'asc' }, { yearFrom: 'asc' }],
    select: {
      id: true,
      make: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engineCode: true,
      source: true,
      note: true,
      feedName: true,
      fetchedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return rows;
}

/** Whether one part belongs on one vehicle. */
export async function checkFit(
  orgId: string,
  productId: string,
  vehicleId: string,
): Promise<FitResult> {
  const [rows, vehicle] = await Promise.all([
    prisma.partFitment.findMany({
      where: { orgId, productId },
      select: {
        make: true,
        model: true,
        yearFrom: true,
        yearTo: true,
        engineCode: true,
        source: true,
        note: true,
      },
    }),
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { make: true, model: true, year: true, engineCode: true },
    }),
  ]);

  const product = await prisma.product.findFirst({
    where: { id: productId, orgId },
    select: { name: true },
  });

  return fitsVehicle(
    rows.map(toFitment),
    vehicle ?? { make: null, model: null, year: null },
    product?.name ?? 'This part',
  );
}

/**
 * Every part on a job checked against the car it is going on.
 *
 * One query for the fitment rows rather than one per line. A job with twelve
 * parts would otherwise issue twelve round trips to say nothing about eleven
 * of them.
 */
export async function fitmentWarningsForJob(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      vehicle: { select: { make: true, model: true, year: true, engineCode: true } },
      partLines: {
        where: { productId: { not: null } },
        select: { id: true, description: true, productId: true },
      },
    },
  });

  if (!job || job.partLines.length === 0) return [];

  const productIds = job.partLines.map((line) => line.productId!);

  const rows = await prisma.partFitment.findMany({
    where: { orgId, productId: { in: productIds } },
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
  });

  const byProduct = new Map<string, Fitment[]>();
  for (const row of rows) {
    const held = byProduct.get(row.productId) ?? [];
    held.push(toFitment(row));
    byProduct.set(row.productId, held);
  }

  return (
    job.partLines
      .map((line) => ({
        lineId: line.id,
        description: line.description,
        result: fitsVehicle(byProduct.get(line.productId!) ?? [], job.vehicle, line.description),
      }))
      // Only what is worth interrupting somebody for. A screen that confirmed
      // every correct line would train them to dismiss the one that matters.
      .filter((entry) => entry.result.verdict === 'DOES_NOT_FIT' || entry.result.matched !== null)
      .filter((entry) => entry.result.verdict !== 'FITS')
  );
}

/** Records what a part fits. */
export async function recordFitment(input: {
  orgId: string;
  userId: string;
  productId: string;
  make: string;
  model?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineCode?: string | null;
  source?: FitmentSource;
  note?: string | null;
}) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
    select: { id: true, name: true },
  });

  if (!product) throw new Error('That part is not in this workshop.');

  const make = input.make.trim();
  if (!make) throw new Error('A fitment has to name a make.');

  const from = input.yearFrom ?? null;
  const to = input.yearTo ?? null;

  // Caught here as well as in the database, because the message a person sees
  // should say what they did rather than name a constraint.
  if (from !== null && to !== null && from > to) {
    throw new Error('The first year is after the last one. One of the two is the wrong way round.');
  }

  const row = await prisma.partFitment.create({
    data: {
      orgId: input.orgId,
      productId: input.productId,
      make,
      model: input.model?.trim() || null,
      yearFrom: from,
      yearTo: to,
      engineCode: input.engineCode?.trim() || null,
      source: input.source ?? 'WORKSHOP',
      note: input.note?.trim() || null,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fitment.recorded',
    entityType: 'Product',
    entityId: input.productId,
    after: { make, model: input.model ?? null, yearFrom: from, yearTo: to },
  });

  return row.id;
}

/** Removes a fitment claim that turned out to be wrong. */
export async function removeFitment(input: { orgId: string; userId: string; fitmentId: string }) {
  const row = await prisma.partFitment.findFirst({
    where: { id: input.fitmentId, orgId: input.orgId },
    select: { id: true, productId: true, make: true, model: true },
  });

  if (!row) throw new Error('That fitment is not in this workshop.');

  await prisma.partFitment.delete({ where: { id: row.id } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'fitment.removed',
    entityType: 'Product',
    entityId: row.productId,
    before: { make: row.make, model: row.model },
  });
}
