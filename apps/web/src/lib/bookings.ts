import { prisma } from '@carnet/db';

import { audit } from './guard';
import { createJob, JobError } from './jobs';

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
  readonly code: 'NOT_FOUND' | 'ALREADY_CONVERTED' | 'CLOSED' | 'NO_JOB';

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

/**
 * The car is here: one press, and the booking is a job. Phase 34.
 *
 * Everything the booking already knows goes onto the job: the customer, the
 * vehicle, what it is in for, the notes, the technician, the bay and the
 * time it was promised for. Before this the desk opened a blank job form and
 * chose the customer, the vehicle and the technician a second time, then
 * typed the description again, six presses and a retype while somebody
 * stood at the counter with their keys out.
 *
 * The booking is marked arrived and converted in the same transaction as
 * the link to the job, so there is never a booking that says "arrived" with
 * no job behind it, or a job with a booking that still reads "scheduled".
 */
export async function startJobFromBooking(input: {
  orgId: string;
  userId: string;
  bookingId: string;
  odometerInKm?: number | null;
}): Promise<{ jobId: string; jobNumber: number }> {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      jobId: true,
      locationId: true,
      customerId: true,
      vehicleId: true,
      bayId: true,
      technicianId: true,
      description: true,
      notes: true,
      endAt: true,
    },
  });

  if (!booking) throw new BookingError('NOT_FOUND', 'That booking no longer exists.');

  if (booking.status === 'CONVERTED' || booking.jobId) {
    throw new BookingError(
      'ALREADY_CONVERTED',
      'This booking is already a job. Change the job instead.',
    );
  }

  if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
    throw new BookingError(
      'CLOSED',
      'This booking was closed. Book the car in again, or open a job from the vehicle.',
    );
  }

  let job: { id: string; number: number };
  try {
    job = await createJob({
      orgId: input.orgId,
      userId: input.userId,
      locationId: booking.locationId,
      customerId: booking.customerId,
      vehicleId: booking.vehicleId,
      shortDescription: booking.description,
      details: booking.notes,
      odometerInKm: input.odometerInKm ?? null,
      promisedAt: booking.endAt,
      technicianUserId: booking.technicianId,
    });
  } catch (error) {
    if (error instanceof JobError) throw new BookingError('NO_JOB', error.message);
    throw error;
  }

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: { bayId: booking.bayId ?? undefined },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONVERTED', jobId: job.id, confirmedAt: undefined },
    }),
  ]);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'booking.converted',
    entityType: 'Booking',
    entityId: booking.id,
    after: { jobId: job.id, jobNumber: job.number },
  });

  return { jobId: job.id, jobNumber: job.number };
}
