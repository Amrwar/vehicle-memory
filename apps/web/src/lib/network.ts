import {
  assertAdoptable,
  identifierKind,
  type NetworkEvent,
  NetworkError,
  type NetworkSummary,
  normaliseRegistration,
  normaliseVin,
  redactForNetwork,
  summariseNetwork,
  validateVin,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { orgCanReadVehicle } from './passport';
import { assertWithinLimit, usageOf } from './billing';

/**
 * The network, against the database.
 *
 * A vehicle is global (ADR-0004) and its history is one chain whoever wrote
 * it. What this adds is the way a workshop that has never seen the car comes
 * to be allowed to read that chain and continue it: find it by VIN or plate,
 * see that history exists and who kept it, take it on, and open a job.
 */

export { NetworkError };

const EVENT_SELECT = {
  id: true,
  type: true,
  title: true,
  summary: true,
  occurredAt: true,
  odometerKm: true,
  verification: true,
  recordedByOrgId: true,
  payload: true,
  recordedByOrg: { select: { name: true } },
} as const;

function asNetworkEvent(row: {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  occurredAt: Date;
  odometerKm: number | null;
  verification: string;
  recordedByOrgId: string | null;
  payload: unknown;
  recordedByOrg: { name: string } | null;
}): NetworkEvent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    occurredAt: row.occurredAt,
    odometerKm: row.odometerKm,
    verification: row.verification,
    recordedByOrgId: row.recordedByOrgId,
    recordedByOrgName: row.recordedByOrg?.name ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Looks a vehicle up by what is painted on it.
 *
 * Returns what a workshop is told before it touches the car: that it exists,
 * how much history there is and who kept it. Not the entries themselves: those
 * come once the vehicle is on the books here and there is a reason to read
 * them. A plate that has been on two cars is refused with the way out, which
 * is the VIN.
 */
export async function findOnNetwork(orgId: string, identifier: string) {
  const kind = identifierKind(identifier);

  if (kind === 'NEITHER') {
    throw new NetworkError(
      'BAD_IDENTIFIER',
      'That is neither a registration nor a 17-character VIN.',
    );
  }

  const cleaned = normaliseRegistration(identifier);

  const matches =
    kind === 'VIN'
      ? await prisma.vehicle.findMany({
          where: { vin: cleaned },
          select: { id: true, vin: true, registration: true, make: true, model: true, year: true },
        })
      : await prisma.$queryRaw<
          {
            id: string;
            vin: string;
            registration: string | null;
            make: string | null;
            model: string | null;
            year: number | null;
          }[]
        >`
          SELECT "id", "vin", "registration", "make", "model", "year"
          FROM "vehicles"
          WHERE "registration" IS NOT NULL
            AND upper(replace(replace("registration", ' ', ''), '-', '')) = ${cleaned}
          LIMIT 3
        `;

  if (matches.length === 0)
    return { kind, identifier: cleaned, vehicle: null, summary: null, servicedHere: false };

  if (matches.length > 1) {
    throw new NetworkError(
      'BAD_IDENTIFIER',
      `That registration has been on ${matches.length} vehicles. Enter the VIN instead; it is on the windscreen and the door frame.`,
    );
  }

  const vehicle = matches[0]!;

  const [events, servicedHere] = await Promise.all([
    prisma.vehicleEvent.findMany({ where: { vehicleId: vehicle.id }, select: EVENT_SELECT }),
    orgCanReadVehicle(orgId, vehicle.id),
  ]);

  return {
    kind,
    identifier: cleaned,
    vehicle,
    summary: summariseNetwork(events.map(asNetworkEvent), orgId),
    servicedHere,
  };
}

/**
 * Takes a vehicle onto the books here, before the first job.
 *
 * Read access, on the grounds that the car is about to be serviced. Write
 * access comes with the job itself. The grant is what lets the workshop open
 * the vehicle's page and see the history before deciding what to do with it.
 */
export async function adoptVehicle(input: {
  orgId: string;
  userId: string;
  vehicleId: string;
}): Promise<void> {
  await assertWithinLimit(input.orgId, 'vehicles', (await usageOf(input.orgId)).vehicles);
  const [vehicle, servicedHere] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: input.vehicleId }, select: { id: true, vin: true } }),
    orgCanReadVehicle(input.orgId, input.vehicleId),
  ]);

  assertAdoptable({ vehicleExists: vehicle !== null, alreadyServicedHere: servicedHere });

  await prisma.vehicleAccessGrant.upsert({
    where: { vehicleId_orgId: { vehicleId: input.vehicleId, orgId: input.orgId } },
    create: { vehicleId: input.vehicleId, orgId: input.orgId, scope: 'READ', reason: 'SERVICED' },
    update: { revokedAt: null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.adopted',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: { vin: vehicle!.vin },
  });
}

/**
 * Adds a vehicle nobody on the network has seen.
 *
 * The VIN is validated and a bad check digit is a warning, not a refusal
 * (FR-304): a workshop with the car in front of it knows better than an
 * algorithm, and a typo is corrected on the vehicle rather than refused at
 * the door. What is refused is a VIN already on the network, because that is
 * the other case entirely and the way in is to find it.
 */
export async function registerVehicle(input: {
  orgId: string;
  userId: string;
  vin: string;
  registration?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
}): Promise<{ id: string; warning: string | null }> {
  await assertWithinLimit(input.orgId, 'vehicles', (await usageOf(input.orgId)).vehicles);
  const vin = normaliseVin(input.vin);
  const validation = validateVin(vin);

  if (!validation.wellFormed) {
    throw new NetworkError('BAD_VIN', 'A VIN is exactly 17 characters, with no I, O or Q.');
  }

  const existing = await prisma.vehicle.findUnique({ where: { vin }, select: { id: true } });
  if (existing) {
    throw new NetworkError(
      'VIN_TAKEN',
      'That VIN is already on the network. Find it rather than adding it again.',
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      vin,
      vinValid: validation.checkDigitValid,
      registration: input.registration?.trim()
        ? normaliseRegistration(input.registration).replace(/^(.{4})(?=.)/, '$1 ')
        : null,
      make: input.make?.trim() || null,
      model: input.model?.trim() || null,
      year: input.year ?? null,
      accessGrants: {
        create: { orgId: input.orgId, scope: 'WRITE', reason: 'SERVICED' },
      },
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'vehicle.registered',
    entityType: 'Vehicle',
    entityId: vehicle.id,
    after: { vin, valid: validation.checkDigitValid },
  });

  return {
    id: vehicle.id,
    warning: validation.checkDigitValid
      ? null
      : 'The VIN check digit does not add up. It has been recorded as typed; check it against the plate on the door frame.',
  };
}

/** The one sentence at the top of a vehicle page about where its history came from. */
export async function networkStatementFor(
  orgId: string,
  vehicleId: string,
): Promise<NetworkSummary> {
  const events = await prisma.vehicleEvent.findMany({ where: { vehicleId }, select: EVENT_SELECT });
  return summariseNetwork(events.map(asNetworkEvent), orgId);
}

/** The history as another workshop may read it: everything about the car, nothing about the garage. */
export async function networkHistory(
  orgId: string,
  vehicleId: string,
): Promise<NetworkEvent[] | null> {
  if (!(await orgCanReadVehicle(orgId, vehicleId))) return null;

  const events = await prisma.vehicleEvent.findMany({
    where: { vehicleId },
    orderBy: { sequence: 'asc' },
    select: EVENT_SELECT,
  });

  return events
    .map(asNetworkEvent)
    .map((event) =>
      event.recordedByOrgId === orgId
        ? event
        : { ...event, payload: redactForNetwork(event.payload) },
    );
}
