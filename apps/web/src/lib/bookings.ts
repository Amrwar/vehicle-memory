import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Bookings from the workshop's side of the counter.
 *
 * The customer's own booking flow has existed since Phase 4.6 and takes the
 * slot inside a transaction that re-checks capacity. This is the other half:
 * the booking somebody takes over the telephone, which is still how most of
 * them arrive, and the screen for one that already exists.
 *
 * The diary has linked to both since Phase 1 and neither page existed, so
 * every appointment in the product was a link to a 404.
 */

export class BookingError extends Error {
  readonly code: 'NOT_FOUND' | 'ALREADY_CONVERTED' | 'CLOSED';

  constructor(code: BookingError['code'], message: string) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

/** One booking, with everything the person on the telephone needs. */
export async function bookingDetail(orgId: string, bookingId: string) {
  return prisma.booking.findFirst({
    where: { id: bookingId, orgId },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      estimatedHours: true,
      description: true,
      notes: true,
      source: true,
      reminderSentAt: true,
      confirmedAt: true,
      cancelledAt: true,
      cancelReason: true,
      createdAt: true,
      customer: {
        select: { id: true, displayName: true, email: true, mobile: true, phone: true },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          registration: true,
          lastOdometerKm: true,
        },
      },
      bay: { select: { name: true } },
      technician: { select: { name: true } },
      location: { select: { name: true } },
      job: { select: { id: true, number: true, status: true } },
    },
  });
}

/** Customers and their vehicles, for the booking form. */
export async function bookableCustomers(orgId: string) {
  return prisma.customer.findMany({
    where: { orgId, isActive: true },
    orderBy: { displayName: 'asc' },
    select: {
      id: true,
      displayName: true,
      jobs: {
        distinct: ['vehicleId'],
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          vehicle: { select: { id: true, make: true, model: true, registration: true } },
        },
      },
    },
  });
}

/**
 * Takes a booking over the counter.
 *
 * The bay is optional here and is not on the customer's own flow, because the
 * person on the telephone often knows the car is coming and not yet where it
 * will go. Leaving it unassigned is honest; guessing a bay produces a diary
 * that looks planned and is not.
 */
export async function createBooking(input: {
  orgId: string;
  userId: string;
  locationId: string;
  customerId: string;
  vehicleId: string;
  startAt: Date;
  estimatedHours: number;
  description: string;
  bayId?: string | null;
  technicianId?: string | null;
  notes?: string | null;
}) {
  const endAt = new Date(input.startAt.getTime() + input.estimatedHours * 3_600_000);

  const booking = await prisma.booking.create({
    data: {
      orgId: input.orgId,
      locationId: input.locationId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      bayId: input.bayId || null,
      technicianId: input.technicianId || null,
      startAt: input.startAt,
      endAt,
      estimatedHours: input.estimatedHours,
      description: input.description.trim(),
      notes: input.notes?.trim() || null,
      // Taken by a person, so it says so. The source is what makes the
      // conversion report on the business page mean anything.
      source: 'PHONE',
      status: 'SCHEDULED',
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'booking.created',
    entityType: 'Booking',
    entityId: booking.id,
    after: { startAt: input.startAt.toISOString(), description: input.description.trim() },
  });

  return booking.id;
}

/** Moves a booking along: confirmed, arrived, missed or cancelled. */
export async function setBookingStatus(input: {
  orgId: string;
  userId: string;
  bookingId: string;
  status: 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED';
  reason?: string | null;
}) {
  const booking = await prisma.booking.findFirstOrThrow({
    where: { id: input.bookingId, orgId: input.orgId },
    select: { id: true, status: true, jobId: true },
  });

  if (booking.status === 'CONVERTED') {
    throw new BookingError(
      'ALREADY_CONVERTED',
      'This booking is already a job. Change the job instead.',
    );
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: input.status,
      confirmedAt: input.status === 'CONFIRMED' ? new Date() : undefined,
      cancelledAt: input.status === 'CANCELLED' ? new Date() : undefined,
      cancelReason: input.status === 'CANCELLED' ? input.reason?.trim() || null : undefined,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: `booking.${input.status.toLowerCase()}`,
    entityType: 'Booking',
    entityId: booking.id,
  });
}
