import {
  assertClaimable,
  type Cover,
  expiringWithin,
  positionFor,
  coverStatusOf,
  WarrantyError,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Warranty, against the database.
 *
 * The thing this exists to stop is quiet and expensive: a workshop replaces a
 * part under its own warranty while the supplier's warranty on the same part
 * is still running, absorbs the cost, and never claims it back. Nothing in an
 * ordinary system ever points that out, because nothing holds both dates.
 */

export { WarrantyError };

function toCover(row: {
  id: string;
  kind: string;
  description: string;
  startedOn: Date;
  months: number;
  km: number | null;
  startedAtKm: number | null;
  voidedReason: string | null;
  supplierMonths: number | null;
  supplier: { name: string } | null;
}): Cover {
  return {
    id: row.id,
    kind: row.kind as Cover['kind'],
    description: row.description,
    startedOn: row.startedOn,
    months: row.months,
    km: row.km,
    startedAtKm: row.startedAtKm,
    voidedReason: row.voidedReason,
    supplierName: row.supplier?.name ?? null,
    supplierMonths: row.supplierMonths,
  };
}

const SELECT = {
  id: true,
  kind: true,
  description: true,
  startedOn: true,
  months: true,
  km: true,
  startedAtKm: true,
  voidedReason: true,
  supplierMonths: true,
  partsValue: true,
  labourValue: true,
  supplier: { select: { name: true } },
  vehicle: {
    select: { id: true, make: true, model: true, registration: true, lastOdometerKm: true },
  },
  job: { select: { id: true, number: true } },
  claims: {
    orderBy: { raisedAt: 'desc' as const },
    select: {
      id: true,
      status: true,
      complaint: true,
      outcome: true,
      raisedAt: true,
      outsideCover: true,
      exposure: true,
      recoverable: true,
    },
  },
};

/** Everything covered on one vehicle, with whether it still holds. */
export async function coverForVehicle(orgId: string, vehicleId: string, now = new Date()) {
  const rows = await prisma.warranty.findMany({
    where: { orgId, vehicleId },
    orderBy: { startedOn: 'desc' },
    select: SELECT,
  });

  return rows.map((row) => ({
    row,
    cover: toCover(row),
    status: coverStatusOf(toCover(row), now, row.vehicle.lastOdometerKm),
  }));
}

/**
 * The warranty book: what is live, what is running out, what is being claimed.
 *
 * Ordered so the two things somebody can act on come first. Cover expiring
 * inside a month is a reason to invite the car in; an open claim is money
 * sitting with a supplier who has not been chased.
 */
export async function warrantyBook(orgId: string, now = new Date()) {
  const rows = await prisma.warranty.findMany({
    where: { orgId },
    orderBy: { startedOn: 'desc' },
    take: 200,
    select: SELECT,
  });

  const assessed = rows.map((row) => ({
    row,
    cover: toCover(row),
    status: coverStatusOf(toCover(row), now, row.vehicle.lastOdometerKm),
  }));

  const openClaims = assessed.filter((entry) =>
    entry.row.claims.some((claim) => claim.status === 'OPEN'),
  );

  return {
    all: assessed,
    active: assessed.filter((entry) => entry.status.active),
    expiring: expiringWithin(assessed, 30),
    openClaims,
    // What the workshop is carrying on claims nobody has settled. The figure
    // that turns a pile of small repairs into a number somebody looks at.
    exposure: openClaims.reduce(
      (total, entry) =>
        total +
        entry.row.claims
          .filter((claim) => claim.status === 'OPEN')
          .reduce((sum, claim) => sum + Number(claim.exposure), 0),
      0,
    ),
  };
}

/**
 * Records cover, usually as a job closes.
 *
 * Both the customer's warranty and the supplier's are written at the same
 * time, because the supplier's term is knowable now and unknowable in eleven
 * months when somebody comes back with a failed part.
 */
export async function recordCover(input: {
  orgId: string;
  userId: string;
  jobId: string;
  vehicleId: string;
  kind: 'PART' | 'LABOUR';
  description: string;
  months: number;
  km?: number | null;
  startedAtKm?: number | null;
  partsValue?: number;
  labourValue?: number;
  productId?: string | null;
  supplierId?: string | null;
  supplierMonths?: number | null;
  startedOn?: Date;
}) {
  const warranty = await prisma.warranty.create({
    data: {
      orgId: input.orgId,
      jobId: input.jobId,
      vehicleId: input.vehicleId,
      kind: input.kind,
      description: input.description.trim(),
      startedOn: input.startedOn ?? new Date(),
      months: Math.max(1, input.months),
      km: input.km ?? null,
      // A mileage allowance with nothing to count from never expires on
      // distance, so the reading travels with it or the allowance does not.
      startedAtKm: input.km ? (input.startedAtKm ?? null) : null,
      partsValue: input.partsValue ?? 0,
      labourValue: input.labourValue ?? 0,
      productId: input.productId ?? null,
      supplierId: input.supplierId ?? null,
      // A supplier term with nobody attached to it is not a term. It would
      // read on the page as cover somebody owes and claim back nothing,
      // which is worse than recording no supplier cover at all.
      supplierMonths: input.supplierId ? (input.supplierMonths ?? null) : null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'warranty.recorded',
    entityType: 'Warranty',
    entityId: warranty.id,
    after: { description: input.description.trim(), months: input.months },
  });

  return warranty.id;
}

/**
 * Raises a claim, and works out who should pay for it before anybody argues.
 *
 * The exposure and the recoverable amount are written at the moment the claim
 * is raised rather than computed on read, because supplier cover moves on and
 * the question "what did this cost us" has to keep its answer.
 */
export async function raiseClaim(input: {
  orgId: string;
  userId: string;
  warrantyId: string;
  complaint: string;
  goodwillReason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const row = await prisma.warranty.findFirstOrThrow({
    where: { id: input.warrantyId, orgId: input.orgId },
    select: SELECT,
  });

  const cover = toCover(row);
  const status = coverStatusOf(cover, now, row.vehicle.lastOdometerKm);

  assertClaimable({
    status,
    openClaims: row.claims.filter((claim) => claim.status === 'OPEN').length,
    reason: input.goodwillReason,
  });

  const position = positionFor({
    cover,
    status,
    partsValue: Number(row.partsValue),
    labourValue: Number(row.labourValue),
    now,
  });

  const claim = await prisma.warrantyClaim.create({
    data: {
      warrantyId: row.id,
      complaint: input.complaint.trim(),
      outsideCover: !status.active,
      goodwillReason: status.active ? null : (input.goodwillReason?.trim() ?? null),
      exposure: position.exposure,
      recoverable: position.recoverable,
      raisedByUserId: input.userId,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'warranty.claim.raised',
    entityType: 'WarrantyClaim',
    entityId: claim.id,
    after: {
      outsideCover: !status.active,
      exposure: position.exposure,
      recoverable: position.recoverable,
    },
  });

  return { id: claim.id, position, status };
}

/** Closes a claim with what actually happened. */
export async function settleClaim(input: {
  orgId: string;
  userId: string;
  claimId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'SETTLED';
  outcome: string;
  supplierRef?: string | null;
}) {
  const claim = await prisma.warrantyClaim.findFirstOrThrow({
    where: { id: input.claimId, warranty: { orgId: input.orgId } },
    select: { id: true, status: true },
  });

  if (claim.status !== 'OPEN') {
    throw new WarrantyError('ALREADY_CLAIMED', 'That claim has already been closed.');
  }

  if (!input.outcome.trim()) {
    throw new WarrantyError(
      'NO_REASON',
      'Say what happened. "Settled" with nothing against it means nothing to whoever reads it next.',
    );
  }

  await prisma.warrantyClaim.update({
    where: { id: claim.id },
    data: {
      status: input.status,
      outcome: input.outcome.trim(),
      supplierRef: input.supplierRef?.trim() || null,
      settledAt: input.status === 'SETTLED' ? new Date() : null,
      // ACCEPTED and REJECTED are decisions, not conclusions, so they do not
      // carry a settled time. The constraint only asks for one on SETTLED.
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: `warranty.claim.${input.status.toLowerCase()}`,
    entityType: 'WarrantyClaim',
    entityId: claim.id,
    after: { outcome: input.outcome.trim() },
  });
}
