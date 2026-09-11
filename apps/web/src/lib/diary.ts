import {
  assertMove,
  type DiaryBooking,
  type DiaryView,
  floorAt,
  type LaneSource,
  lanesFor,
  rangeFor,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The diary, against the database.
 *
 * One query per view rather than one query per lane. A workshop week is a few
 * dozen rows, so the arranging is done in memory by the domain layer and this
 * file only decides what span to fetch.
 *
 * Moving a booking runs the same capacity check that guards making one. A
 * diary that accepts any drop and complains when somebody opens the booking
 * later manufactures double bookings faster than paper did.
 */

export class DiaryError extends Error {
  readonly code: 'NOT_FOUND' | 'BLOCKED' | 'CLOSED';

  constructor(code: DiaryError['code'], message: string) {
    super(message);
    this.name = 'DiaryError';
    this.code = code;
  }
}

/** Bookings that have not been cancelled and have somewhere to be. */
const LIVE = ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'CONVERTED'] as const;

function toDomain(row: {
  id: string;
  startAt: Date;
  endAt: Date;
  estimatedHours: unknown;
  bayId: string | null;
  technicianId: string | null;
  locationId: string;
  status: string;
  description: string;
  jobId: string | null;
  customer: { displayName: string };
  vehicle: { make: string | null; model: string | null; registration: string | null };
}): DiaryBooking {
  return {
    id: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    estimatedHours: Number(row.estimatedHours),
    bayId: row.bayId,
    technicianId: row.technicianId,
    locationId: row.locationId,
    status: row.status,
    jobId: row.jobId,
    title: `${row.vehicle.make ?? ''} ${row.vehicle.model ?? ''}`.trim() || row.description,
    subtitle: row.customer.displayName,
    registration: row.vehicle.registration,
  };
}

const SELECT = {
  id: true,
  startAt: true,
  endAt: true,
  estimatedHours: true,
  bayId: true,
  technicianId: true,
  locationId: true,
  status: true,
  description: true,
  jobId: true,
  customer: { select: { displayName: true } },
  vehicle: { select: { make: true, model: true, registration: true } },
};

/** Everything one view needs, arranged into its lanes. */
export async function diaryFor(orgId: string, view: DiaryView, anchor: Date) {
  const range = rangeFor(view, anchor);

  const [rows, bays, technicians, locations] = await Promise.all([
    prisma.booking.findMany({
      where: { orgId, startAt: { gte: range.start, lt: range.end }, status: { in: [...LIVE] } },
      orderBy: { startAt: 'asc' },
      select: SELECT,
    }),
    prisma.bay.findMany({
      where: { location: { orgId }, isActive: true },
      orderBy: [{ location: { name: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { orgId, role: 'TECHNICIAN', isActive: true },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.location.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, dailyCapacityHours: true },
    }),
  ]);

  const source: LaneSource = {
    bays,
    technicians: technicians.map((row) => ({ id: row.user.id, name: row.user.name })),
    locations: locations.map((row) => ({ id: row.id, name: row.name })),
  };

  const bookings = rows.map(toDomain);

  return {
    range,
    lanes: lanesFor(view, bookings, source, range),
    bookings,
    source,
    capacityHours: Number(locations[0]?.dailyCapacityHours ?? 40),
  };
}

/**
 * Moves a booking to a different bay, person or time.
 *
 * The capacity check runs against everything else on the day, so the answer is
 * the same one the booking screen would give. A warning goes through and is
 * reported; only the physically impossible is refused.
 */
export async function moveBooking(input: {
  orgId: string;
  userId: string;
  bookingId: string;
  bayId?: string | null;
  technicianId?: string | null;
  startAt?: Date;
}) {
  const row = await prisma.booking.findFirst({
    where: { id: input.bookingId, orgId: input.orgId },
    select: SELECT,
  });

  if (!row) throw new DiaryError('NOT_FOUND', 'That booking no longer exists.');

  if (row.status === 'CANCELLED' || row.status === 'NO_SHOW') {
    throw new DiaryError('CLOSED', 'That booking is closed, so there is nowhere to move it to.');
  }

  const booking = toDomain(row);

  // Everything else on the same day, which is what a clash is measured
  // against. A week would be wasteful and a single bay would miss the person.
  const dayStart = new Date(booking.startAt);
  dayStart.setHours(0, 0, 0, 0);

  const others = await prisma.booking.findMany({
    where: {
      orgId: input.orgId,
      id: { not: booking.id },
      startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
      status: { in: [...LIVE] },
    },
    select: SELECT,
  });

  const location = await prisma.location.findFirst({
    where: { id: row.locationId },
    select: { dailyCapacityHours: true },
  });

  const outcome = assertMove({
    booking,
    target: {
      bayId: input.bayId,
      technicianId: input.technicianId,
      startAt: input.startAt,
    },
    existing: others.map(toDomain),
    dailyCapacityHours: Number(location?.dailyCapacityHours ?? 0) || undefined,
  });

  if (!outcome.allowed) throw new DiaryError('BLOCKED', outcome.reason);

  const startAt = input.startAt ?? booking.startAt;
  const span = booking.endAt.getTime() - booking.startAt.getTime();

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      bayId: input.bayId === undefined ? undefined : input.bayId || null,
      technicianId: input.technicianId === undefined ? undefined : input.technicianId || null,
      startAt,
      // The length travels with the booking. A car that needed two hours in
      // Bay 1 needs two hours in Bay 3.
      endAt: new Date(startAt.getTime() + span),
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'booking.moved',
    entityType: 'Booking',
    entityId: booking.id,
    before: {
      bayId: booking.bayId,
      technicianId: booking.technicianId,
      startAt: booking.startAt.toISOString(),
    },
    after: {
      bayId: input.bayId ?? booking.bayId,
      technicianId: input.technicianId ?? booking.technicianId,
      startAt: startAt.toISOString(),
    },
  });

  return outcome;
}

/**
 * The floor as it stands right now.
 *
 * Today's bookings only. A bay board showing tomorrow is a diary, and there is
 * already one of those.
 */
export async function floorNow(orgId: string, now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [rows, bays] = await Promise.all([
    prisma.booking.findMany({
      where: {
        orgId,
        startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
        status: { in: [...LIVE] },
      },
      select: SELECT,
    }),
    prisma.bay.findMany({
      where: { location: { orgId }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return floorAt(now, bays, rows.map(toDomain));
}
