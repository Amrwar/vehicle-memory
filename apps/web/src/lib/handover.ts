import {
  assertTransferable,
  buildReport,
  type OwnerKind,
  OwnershipError,
  ownerHistory,
  type Report,
  transferEvent,
  type Verdict,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { appendEvents, verifyVehicleChain } from './passport';

/**
 * A vehicle changing hands, and the report that makes the history worth
 * having when it does.
 *
 * These two belong together. The transfer is what makes the record survive a
 * sale; the report is what makes somebody pay for a car because of it. Either
 * on its own is half a feature.
 */

export { OwnershipError };

/** Work that is still in the building. */
const OPEN = [
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'IN_PROGRESS',
  'QUALITY_CHECK',
] as const;

/**
 * Records a sale.
 *
 * One transaction closes the outgoing ownership and opens the incoming one,
 * because a vehicle with two open owners and a vehicle with none are both
 * states nothing else in the product knows how to read. The database has a
 * partial unique index that refuses the first of those outright; this makes
 * sure the second cannot happen either.
 *
 * The chain event is appended after the transaction rather than inside it.
 * Appending takes a row lock on the vehicle and does its own transaction, and
 * nesting the two would hold the ownership rows locked for the duration of a
 * hash computation for no benefit. If the append fails the ownership is
 * already correct and the event can be replayed; the reverse order would
 * leave a chain claiming a sale that never got recorded.
 */
export async function transferOwnership(input: {
  orgId: string;
  userId: string;
  vehicleId: string;
  toName: string;
  toKind: OwnerKind;
  on: Date;
  odometerKm?: number | null;
  force?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  const [current, openJobs, vehicle] = await Promise.all([
    prisma.vehicleOwnership.findFirst({
      where: { vehicleId: input.vehicleId, endedAt: null },
      select: { id: true, ownerName: true, ownerKind: true, startedAt: true, endedAt: true },
    }),
    prisma.job.count({
      where: { orgId: input.orgId, vehicleId: input.vehicleId, status: { in: [...OPEN] } },
    }),
    prisma.vehicle.findUniqueOrThrow({
      where: { id: input.vehicleId },
      select: { lastOdometerKm: true },
    }),
  ]);

  assertTransferable({
    current: current ? { ...current, ownerKind: current.ownerKind as OwnerKind } : null,
    toName: input.toName,
    toKind: input.toKind,
    on: input.on,
    openJobs,
    force: input.force,
    now,
  });

  const odometerKm = input.odometerKm ?? vehicle.lastOdometerKm;

  const opened = await prisma.$transaction(async (tx) => {
    await tx.vehicleOwnership.update({
      where: { id: current!.id },
      data: { endedAt: input.on },
    });

    return tx.vehicleOwnership.create({
      data: {
        vehicleId: input.vehicleId,
        ownerName: input.toName.trim(),
        ownerKind: input.toKind,
        startedAt: input.on,
        source: 'Recorded by the workshop at the point of sale.',
      },
      select: { id: true },
    });
  });

  const event = transferEvent({ on: input.on, odometerKm });

  await appendEvents([
    {
      vehicleId: input.vehicleId,
      type: 'OWNERSHIP_TRANSFER',
      occurredAt: input.on,
      title: event.title,
      summary: event.summary,
      payload: event.payload,
      odometerKm,
      verification: 'WORKSHOP_RECORDED',
      recordedByOrgId: input.orgId,
      supersedesId: null,
      // One transfer per ownership row, so replaying this cannot write the
      // sale twice.
      idempotencyKey: `transfer:${opened.id}`,
    },
  ]);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.transferred',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    // The outgoing name is deliberately not written here either. The audit
    // log records that a transfer happened and who recorded it; who owned the
    // car is in the ownership rows, where an erasure request can reach it.
    after: { on: input.on.toISOString(), odometerKm, openJobsAtTransfer: openJobs },
  });

  return { ownershipId: opened.id };
}

export interface VehicleReport extends Report {
  owners: { position: number; kind: OwnerKind; months: number; current: boolean }[];
  vehicle: {
    make: string | null;
    model: string | null;
    year: number | null;
    registration: string | null;
    vin: string;
  };
}

/**
 * The report, from whatever the vehicle's record actually holds.
 *
 * Deliberately takes no organisation. A buyer's report is about the vehicle,
 * and scoping it to one workshop would produce a different report depending
 * on who generated it, which is the opposite of the point.
 *
 * Counted rather than listed wherever a count is all that is shown: a vehicle
 * with four hundred events should not load four hundred rows to print the
 * number 400.
 */
export async function reportFor(
  vehicleId: string,
  now = new Date(),
): Promise<VehicleReport | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      vin: true,
      make: true,
      model: true,
      year: true,
      registration: true,
      lastOdometerKm: true,
      firstRegisteredAt: true,
      ownerships: {
        orderBy: { startedAt: 'asc' },
        select: { id: true, ownerName: true, ownerKind: true, startedAt: true, endedAt: true },
      },
    },
  });

  if (!vehicle) return null;

  const [events, serviceEvents, inspections, openRecalls, anomalies, first, lastService, latest] =
    await Promise.all([
      prisma.vehicleEvent.count({ where: { vehicleId } }),
      prisma.vehicleEvent.count({ where: { vehicleId, type: { in: ['SERVICE', 'REPAIR'] } } }),
      prisma.inspection.count({ where: { job: { vehicleId }, status: 'COMPLETED' } }),
      prisma.vehicleRecall.count({ where: { vehicleId, status: 'OPEN' } }),
      prisma.odometerReading.count({ where: { vehicleId, anomaly: { not: 'NONE' } } }),
      prisma.vehicleEvent.findFirst({
        where: { vehicleId },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
      prisma.vehicleEvent.findFirst({
        where: { vehicleId, type: { in: ['SERVICE', 'REPAIR'] } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
      prisma.inspection.findFirst({
        where: { job: { vehicleId }, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: {
          results: {
            where: { severity: { in: ['CRITICAL', 'ADVISORY'] } },
            select: { severity: true, estimateLines: { select: { decision: true } } },
          },
        },
      }),
    ]);

  let unresolvedCritical = 0;
  let unresolvedAdvisory = 0;

  for (const result of latest?.results ?? []) {
    if (result.estimateLines.some((line) => line.decision === 'APPROVED')) continue;
    if (result.severity === 'CRITICAL') unresolvedCritical += 1;
    else unresolvedAdvisory += 1;
  }

  const verification = await verifyVehicleChain(vehicleId);

  // Three states, not two. "Could not be checked" is a different claim from
  // "has been tampered with", and collapsing them either accuses a clean
  // record or excuses a broken one.
  const chain: Verdict = events === 0 ? 'UNVERIFIED' : verification.valid ? 'INTACT' : 'BROKEN';

  const report = buildReport({
    owners: vehicle.ownerships.length,
    events,
    serviceEvents,
    inspections,
    unresolvedCritical,
    unresolvedAdvisory,
    openRecalls,
    odometerKm: vehicle.lastOdometerKm,
    firstRecordAt: first?.occurredAt ?? null,
    lastServiceAt: lastService?.occurredAt ?? null,
    firstRegisteredAt: vehicle.firstRegisteredAt,
    mileageAnomalies: anomalies,
    chain,
    now,
  });

  return {
    ...report,
    owners: ownerHistory(
      vehicle.ownerships.map((ownership) => ({
        ...ownership,
        ownerKind: ownership.ownerKind as OwnerKind,
      })),
      now,
    ),
    vehicle: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      registration: vehicle.registration,
      vin: vehicle.vin,
    },
  };
}
