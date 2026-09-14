import {
  assessReading,
  chainEvent,
  type DraftEvent,
  eventsForCompletedJob,
  type CompletedJobInput,
  verifyChain,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { env } from './env';

/**
 * Writing to the vehicle passport.
 *
 * The single place in the application that appends to the ledger. There is
 * deliberately no update or delete path anywhere: corrections append a
 * superseding event, and the database enforces that with a trigger so the rule
 * holds even from a psql session (migration 20260909000100_invariants).
 */

/**
 * Appends events to a vehicle's chain inside one transaction.
 *
 * Sequence allocation and chain head reads happen under a row lock on the
 * vehicle, because two workshops completing jobs on the same car in the same
 * second must not both claim sequence 41.
 *
 * Idempotent: an event whose key already exists is skipped, so retrying a
 * failed job completion cannot duplicate history (story C3).
 */
export async function appendEvents(drafts: readonly DraftEvent[]): Promise<number> {
  if (drafts.length === 0) return 0;

  const salt = env().LEDGER_CHAIN_SALT;
  const vehicleId = drafts[0]!.vehicleId;

  if (drafts.some((draft) => draft.vehicleId !== vehicleId)) {
    throw new Error('appendEvents expects every draft to belong to one vehicle');
  }

  return prisma.$transaction(async (tx) => {
    // Lock the vehicle row for the duration, serialising concurrent appends.
    await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId} FOR UPDATE`;

    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: { chainHead: true, eventCount: true, lastOdometerKm: true },
    });

    if (!vehicle) throw new Error(`Vehicle ${vehicleId} does not exist`);

    const existingKeys = new Set(
      (
        await tx.vehicleEvent.findMany({
          where: {
            vehicleId,
            jobRef: { in: drafts.map((d) => d.idempotencyKey) },
          },
          select: { jobRef: true },
        })
      ).map((row) => row.jobRef),
    );

    const pending = drafts.filter((draft) => !existingKeys.has(draft.idempotencyKey));
    if (pending.length === 0) return 0;

    let sequence = vehicle.eventCount;
    let prevHash = vehicle.chainHead;
    let latestOdometer = vehicle.lastOdometerKm;

    for (const draft of pending) {
      sequence += 1;

      const chained = chainEvent(
        {
          vehicleId: draft.vehicleId,
          sequence,
          type: draft.type,
          occurredAt: draft.occurredAt,
          payload: draft.payload,
          odometerKm: draft.odometerKm ?? null,
          recordedByOrgId: draft.recordedByOrgId ?? null,
          supersedesId: draft.supersedesId ?? null,
        },
        prevHash,
        salt,
      );

      await tx.vehicleEvent.create({
        data: {
          vehicleId: draft.vehicleId,
          sequence,
          type: draft.type as never,
          occurredAt: new Date(draft.occurredAt as string | number | Date),
          verification: draft.verification as never,
          title: draft.title,
          summary: draft.summary,
          payload: draft.payload as never,
          odometerKm: draft.odometerKm ?? null,
          recordedByOrgId: draft.recordedByOrgId ?? null,
          recordedByUserId: null,
          jobRef: draft.idempotencyKey,
          hash: chained.hash,
          prevHash: chained.prevHash,
          supersedesId: draft.supersedesId ?? null,
        },
      });

      prevHash = chained.hash;

      if (draft.odometerKm != null) {
        latestOdometer = draft.odometerKm;
      }
    }

    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        chainHead: prevHash,
        eventCount: sequence,
        lastOdometerKm: latestOdometer,
        lastOdometerAt: latestOdometer != null ? new Date() : undefined,
      },
    });

    return pending.length;
  });
}

/** Writes the events a completed job contributes. FR-408. */
export async function writeJobCompletion(job: CompletedJobInput): Promise<number> {
  return appendEvents(eventsForCompletedJob(job));
}

/**
 * Records an odometer reading, flagging rather than rejecting an impossible
 * one. FR-307.
 */
export async function recordOdometer(input: {
  vehicleId: string;
  km: number;
  readAt?: Date;
  source?: 'WORKSHOP' | 'OWNER' | 'INSPECTION' | 'AUTHORITY' | 'TELEMATICS';
  orgId?: string | null;
  jobRef?: string | null;
}): Promise<{ id: string; anomaly: string; message: string | null }> {
  const readAt = input.readAt ?? new Date();

  const previous = await prisma.odometerReading.findFirst({
    where: { vehicleId: input.vehicleId, anomaly: 'NONE' },
    orderBy: { readAt: 'desc' },
    select: { km: true, readAt: true },
  });

  const assessment = assessReading(
    { km: input.km, readAt },
    previous ? { km: previous.km, readAt: previous.readAt } : null,
  );

  const reading = await prisma.odometerReading.create({
    data: {
      vehicleId: input.vehicleId,
      km: input.km,
      readAt,
      source: (input.source ?? 'WORKSHOP') as never,
      anomaly: assessment.anomaly as never,
      recordedByOrgId: input.orgId ?? null,
      jobRef: input.jobRef ?? null,
    },
  });

  if (assessment.anomaly === 'NONE') {
    await prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: { lastOdometerKm: input.km, lastOdometerAt: readAt },
    });
  }

  return { id: reading.id, anomaly: assessment.anomaly, message: assessment.message };
}

/** Recomputes a vehicle's whole chain. FR-404. */
export async function verifyVehicleChain(vehicleId: string) {
  const events = await prisma.vehicleEvent.findMany({
    where: { vehicleId },
    orderBy: { sequence: 'asc' },
    select: {
      vehicleId: true,
      sequence: true,
      type: true,
      occurredAt: true,
      payload: true,
      odometerKm: true,
      recordedByOrgId: true,
      supersedesId: true,
      hash: true,
      prevHash: true,
    },
  });

  return verifyChain(
    events.map((event) => ({
      vehicleId: event.vehicleId,
      sequence: event.sequence,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
      odometerKm: event.odometerKm,
      recordedByOrgId: event.recordedByOrgId,
      supersedesId: event.supersedesId,
      hash: event.hash,
      prevHash: event.prevHash,
    })),
    env().LEDGER_CHAIN_SALT,
  );
}

/**
 * Whether an organisation may read a vehicle's history.
 *
 * A workshop earns access by servicing the vehicle. Prior events remain
 * visible at the disclosure level the owner permits, which is what makes the
 * history useful to the next mechanic without making it public.
 */
export async function orgCanReadVehicle(orgId: string, vehicleId: string): Promise<boolean> {
  const grant = await prisma.vehicleAccessGrant.findFirst({
    where: {
      vehicleId,
      orgId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (grant) return true;

  // Servicing the vehicle grants access implicitly.
  const job = await prisma.job.findFirst({
    where: { orgId, vehicleId },
    select: { id: true },
  });
  if (job) return true;

  // So does having written to the passport. A workshop that recorded an
  // entry had access at the time, and a record it cannot read back is a
  // record it cannot stand behind.
  const wrote = await prisma.vehicleEvent.findFirst({
    where: { vehicleId, recordedByOrgId: orgId },
    select: { id: true },
  });

  return wrote !== null;
}

/** Grants a workshop write access because it is servicing the vehicle. */
export async function grantServicingAccess(orgId: string, vehicleId: string): Promise<void> {
  await prisma.vehicleAccessGrant.upsert({
    where: { vehicleId_orgId: { vehicleId, orgId } },
    create: { vehicleId, orgId, scope: 'WRITE', reason: 'SERVICED' },
    update: { revokedAt: null, scope: 'WRITE' },
  });
}
