import {
  assertHandoverAcceptable,
  assertHandoverInvitable,
  assertTransferable,
  buildReport,
  describeHandover,
  HANDOVER_WINDOW_DAYS,
  heldFor,
  handoverState,
  type OwnerKind,
  OwnershipError,
  ownerHistory,
  type Report,
  transferEvent,
  type Verdict,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { createHash, randomBytes } from 'node:crypto';

import { readerLocale } from './i18n';

import { audit } from './guard';
import { appendEvents, verifyVehicleChain } from './passport';
import { traceId } from './trace';

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
    locale: await readerLocale(),
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

/* ---------------------------------------------------------------------------
   Handover by invitation. Phase 44.
   --------------------------------------------------------------------------- */

const DAY = 86_400_000;

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Starts a handover and returns the link the buyer opens.
 *
 * Nothing about the ownership changes here. What is written is an invitation
 * with a digest of a token, and until somebody opens that link and accepts
 * it, the seller still owns the car. The link is returned rather than only
 * sent, because most of these are read out across a driveway.
 */
export async function inviteHandover(input: {
  vehicleId: string;
  /** The workshop starting it, or null when the owner does from the portal. */
  orgId: string | null;
  userId: string | null;
  toName: string;
  toKind: OwnerKind;
  toEmail?: string | null;
  toPhone?: string | null;
  on: Date;
  odometerKm?: number | null;
  force?: boolean;
  now?: Date;
}): Promise<{ id: string; token: string; reachable: boolean }> {
  const now = input.now ?? new Date();

  const [current, openJobs, pending, vehicle] = await Promise.all([
    prisma.vehicleOwnership.findFirst({
      where: { vehicleId: input.vehicleId, endedAt: null },
      select: {
        id: true,
        ownerName: true,
        ownerKind: true,
        startedAt: true,
        endedAt: true,
        ownerUserId: true,
      },
    }),
    input.orgId
      ? prisma.job.count({
          where: { orgId: input.orgId, vehicleId: input.vehicleId, status: { in: [...OPEN] } },
        })
      : prisma.job.count({ where: { vehicleId: input.vehicleId, status: { in: [...OPEN] } } }),
    prisma.handoverInvitation.count({
      where: { vehicleId: input.vehicleId, status: 'PENDING', expiresAt: { gt: now } },
    }),
    prisma.vehicle.findUniqueOrThrow({
      where: { id: input.vehicleId },
      select: { make: true, model: true, registration: true, lastOdometerKm: true },
    }),
  ]);

  assertHandoverInvitable({
    current: current ? { ...current, ownerKind: current.ownerKind as OwnerKind } : null,
    toName: input.toName,
    toKind: input.toKind,
    on: input.on,
    openJobs,
    pending,
    force: input.force,
    now,
  });

  const token = randomBytes(24).toString('base64url');
  const to = input.toEmail?.trim() || input.toPhone?.trim() || null;

  const invitation = await prisma.handoverInvitation.create({
    data: {
      vehicleId: input.vehicleId,
      orgId: input.orgId,
      fromOwnershipId: current!.id,
      fromUserId: current!.ownerUserId,
      toName: input.toName.trim(),
      toKind: input.toKind,
      toEmail: input.toEmail?.trim() || null,
      toPhone: input.toPhone?.trim() || null,
      tokenHash: digest(token),
      soldOn: input.on,
      odometerKm: input.odometerKm ?? vehicle.lastOdometerKm,
      expiresAt: new Date(now.getTime() + HANDOVER_WINDOW_DAYS * DAY),
      startedByUserId: input.userId,
    },
    select: { id: true },
  });

  if (to) {
    const car = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'vehicle';
    await prisma.messageLog.create({
      data: {
        traceId: await traceId(),
        orgId: input.orgId,
        channel: input.toEmail?.trim() ? 'EMAIL' : 'SMS',
        toAddress: to,
        subject: `The ${car}'s history is waiting for you`,
        body: `Hello ${input.toName.trim()}. The ${car}${vehicle.registration ? ` (${vehicle.registration})` : ''} you are buying has a service history kept in Carnet, and it comes with the car. Open this to accept it: /handover/${token}`,
        status: 'QUEUED',
        relatedType: 'HandoverInvitation',
        relatedId: invitation.id,
      },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.handover_invited',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: {
      on: input.on.toISOString(),
      reachable: Boolean(to),
      expiresInDays: HANDOVER_WINDOW_DAYS,
    },
  });

  return { id: invitation.id, token, reachable: Boolean(to) };
}

/**
 * What the link shows, or nothing.
 *
 * The seller is not named and neither is any owner before them. What comes
 * back is the car, how many hands it has been through, and how much history
 * it carries.
 */
export async function handoverByToken(token: string, now = new Date()) {
  const invitation = await prisma.handoverInvitation.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      soldOn: true,
      odometerKm: true,
      toName: true,
      fromUserId: true,
      acceptedByUserId: true,
      vehicleId: true,
      org: { select: { name: true } },
      vehicle: {
        select: {
          make: true,
          model: true,
          year: true,
          registration: true,
          vin: true,
          eventCount: true,
          ownerships: {
            select: { id: true, ownerName: true, ownerKind: true, startedAt: true, endedAt: true },
            orderBy: { startedAt: 'asc' },
          },
        },
      },
    },
  });

  if (!invitation) return null;

  const current = invitation.vehicle.ownerships.find((row) => row.endedAt === null);

  const preview = {
    vehicle:
      [invitation.vehicle.year, invitation.vehicle.make, invitation.vehicle.model]
        .filter(Boolean)
        .join(' ') || 'Vehicle',
    registration: invitation.vehicle.registration,
    owners: invitation.vehicle.ownerships.length,
    entries: invitation.vehicle.eventCount,
    heldMonths: current
      ? heldFor({ ...current, ownerKind: current.ownerKind as OwnerKind }, now)
      : 0,
    on: invitation.soldOn,
    odometerKm: invitation.odometerKm,
  };

  return {
    id: invitation.id,
    state: handoverState(invitation, now),
    toName: invitation.toName,
    fromUserId: invitation.fromUserId,
    acceptedByUserId: invitation.acceptedByUserId,
    workshop: invitation.org?.name ?? null,
    vehicleId: invitation.vehicleId,
    preview,
    summary: describeHandover(preview),
  };
}

/**
 * The buyer accepts, and the car changes hands.
 *
 * One transaction closes the seller's ownership, opens the buyer's against
 * their own login and marks the invitation accepted, so a link opened twice
 * cannot transfer a vehicle twice. The seller keeps nothing: their access to
 * the record ends with their ownership row, and the history stays with the
 * car.
 */
export async function acceptHandover(input: {
  token: string;
  userId: string;
  now?: Date;
}): Promise<{ vehicleId: string }> {
  const now = input.now ?? new Date();

  const invitation = await prisma.handoverInvitation.findUnique({
    where: { tokenHash: digest(input.token) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      fromUserId: true,
      fromOwnershipId: true,
      vehicleId: true,
      orgId: true,
      toName: true,
      toKind: true,
      soldOn: true,
      odometerKm: true,
    },
  });

  if (!invitation) {
    throw new OwnershipError('NOT_FOUND', 'That handover link is not one we know.');
  }

  assertHandoverAcceptable(invitation, input.userId, now);

  const opened = await prisma.$transaction(async (tx) => {
    const taken = await tx.handoverInvitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: now, acceptedByUserId: input.userId },
    });

    if (taken.count === 0) {
      throw new OwnershipError(
        'NOT_PENDING',
        'This handover is no longer open. Ask the seller to start it again.',
      );
    }

    await tx.vehicleOwnership.update({
      where: { id: invitation.fromOwnershipId },
      data: { endedAt: invitation.soldOn },
    });

    return tx.vehicleOwnership.create({
      data: {
        vehicleId: invitation.vehicleId,
        ownerUserId: input.userId,
        ownerName: invitation.toName,
        ownerKind: invitation.toKind,
        startedAt: invitation.soldOn,
        source: 'Accepted by the buyer from the seller’s invitation.',
      },
      select: { id: true },
    });
  });

  const event = transferEvent({ on: invitation.soldOn, odometerKm: invitation.odometerKm });

  await appendEvents([
    {
      vehicleId: invitation.vehicleId,
      type: 'OWNERSHIP_TRANSFER',
      occurredAt: invitation.soldOn,
      title: event.title,
      summary: event.summary,
      payload: event.payload,
      odometerKm: invitation.odometerKm,
      // The two people agreed it between themselves; no workshop saw the car
      // change hands, and the record says so rather than borrowing authority.
      verification: 'SELF_REPORTED',
      recordedByOrgId: invitation.orgId,
      supersedesId: null,
      idempotencyKey: `transfer:${opened.id}`,
    },
  ]);

  await audit({
    orgId: invitation.orgId,
    actorUserId: input.userId,
    action: 'vehicle.handover_accepted',
    entityType: 'Vehicle',
    entityId: invitation.vehicleId,
    after: { on: invitation.soldOn.toISOString(), odometerKm: invitation.odometerKm },
  });

  return { vehicleId: invitation.vehicleId };
}

/** The buyer says it is not their car. */
export async function declineHandover(input: {
  token: string;
  userId?: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  const invitation = await prisma.handoverInvitation.findUnique({
    where: { tokenHash: digest(input.token) },
    select: { id: true, status: true, expiresAt: true, vehicleId: true, orgId: true },
  });

  if (!invitation) {
    throw new OwnershipError('NOT_FOUND', 'That handover link is not one we know.');
  }

  if (handoverState(invitation, now) !== 'PENDING') {
    throw new OwnershipError(
      'NOT_PENDING',
      'This handover is no longer open, so there is nothing to decline.',
    );
  }

  await prisma.handoverInvitation.update({
    where: { id: invitation.id },
    data: { status: 'DECLINED', closedAt: now, closedReason: 'Declined by the buyer.' },
  });

  await audit({
    orgId: invitation.orgId,
    actorUserId: input.userId ?? null,
    action: 'vehicle.handover_declined',
    entityType: 'Vehicle',
    entityId: invitation.vehicleId,
  });
}

/** The seller, or the workshop that started it, calls it off. */
export async function cancelHandover(input: {
  invitationId: string;
  userId: string;
  orgId?: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  const invitation = await prisma.handoverInvitation.findUnique({
    where: { id: input.invitationId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      vehicleId: true,
      orgId: true,
      fromUserId: true,
    },
  });

  if (!invitation) {
    throw new OwnershipError('NOT_FOUND', 'That handover is not one we know.');
  }

  // Either the person selling, or the workshop that started it on their behalf.
  const theirs =
    invitation.fromUserId === input.userId ||
    (input.orgId !== null && input.orgId !== undefined && invitation.orgId === input.orgId);

  if (!theirs) {
    throw new OwnershipError('NOT_FOUND', 'That handover is not one we know.');
  }

  if (handoverState(invitation, now) !== 'PENDING') {
    throw new OwnershipError(
      'NOT_PENDING',
      'This handover is no longer open, so there is nothing to cancel.',
    );
  }

  await prisma.handoverInvitation.update({
    where: { id: invitation.id },
    data: { status: 'CANCELLED', closedAt: now, closedReason: 'Cancelled by the seller.' },
  });

  await audit({
    orgId: invitation.orgId,
    actorUserId: input.userId,
    action: 'vehicle.handover_cancelled',
    entityType: 'Vehicle',
    entityId: invitation.vehicleId,
  });
}

/** The handover standing on a vehicle, if there is one. */
export async function pendingHandover(vehicleId: string, now = new Date()) {
  return prisma.handoverInvitation.findFirst({
    where: { vehicleId, status: 'PENDING', expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      toName: true,
      toEmail: true,
      toPhone: true,
      soldOn: true,
      expiresAt: true,
      createdAt: true,
      org: { select: { name: true } },
    },
  });
}

/** Handovers this person started, for the portal. */
export async function handoversStartedBy(userId: string, now = new Date()) {
  const rows = await prisma.handoverInvitation.findMany({
    where: { fromUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      expiresAt: true,
      toName: true,
      soldOn: true,
      vehicle: { select: { id: true, make: true, model: true, registration: true } },
    },
  });

  return rows.map((row) => ({ ...row, state: handoverState(row, now) }));
}
