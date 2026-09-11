import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Opening a job.
 *
 * Four screens have linked to a "new job" page since Phase 1 and there has
 * never been one: the address matched the job detail route with an id of
 * "new", so pressing it opened a job that does not exist rather than failing
 * in a way anybody would notice. It was found by somebody pressing it.
 *
 * The number is allocated inside the same transaction as the job, because a
 * number taken and then not used leaves a gap, and a gap in a job sequence is
 * the first thing somebody asks about a year later.
 */

export class JobError extends Error {
  constructor(
    readonly code: 'NO_CUSTOMER' | 'NO_VEHICLE' | 'NO_DESCRIPTION' | 'NOT_YOURS' | 'MILEAGE_BACK',
    message: string,
  ) {
    super(message);
    this.name = 'JobError';
  }
}

export async function createJob(input: {
  orgId: string;
  userId: string;
  locationId: string | null;
  customerId: string;
  vehicleId: string;
  shortDescription: string;
  details?: string | null;
  odometerInKm?: number | null;
  promisedAt?: Date | null;
  jobTypeId?: string | null;
  technicianUserId?: string | null;
}) {
  const description = input.shortDescription.trim();

  if (!input.customerId) throw new JobError('NO_CUSTOMER', 'Say whose car it is.');
  if (!input.vehicleId) throw new JobError('NO_VEHICLE', 'Say which vehicle.');
  if (!description) {
    throw new JobError(
      'NO_DESCRIPTION',
      'Say what it is in for. A job with no description is one nobody can pick up without asking.',
    );
  }

  // Both checked against the organisation before anything is written: the ids
  // arrive from a form, and a form field is a value the browser chose.
  const [customer, vehicle, location] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: input.customerId, orgId: input.orgId },
      select: { id: true },
    }),
    prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { id: true, lastOdometerKm: true },
    }),
    input.locationId
      ? prisma.location.findFirst({
          where: { id: input.locationId, orgId: input.orgId },
          select: { id: true },
        })
      : prisma.location.findFirst({
          where: { orgId: input.orgId, isActive: true },
          orderBy: { isDefault: 'desc' },
          select: { id: true },
        }),
  ]);

  if (!customer) throw new JobError('NOT_YOURS', 'That customer is not in this workshop.');
  if (!vehicle) throw new JobError('NO_VEHICLE', 'That vehicle is not on record.');
  if (!location) throw new JobError('NOT_YOURS', 'This workshop has no active site.');

  const reading = input.odometerInKm ?? null;

  // A reading below the last one is either a typo or a rolled-back odometer,
  // and both want a person to look rather than a silent write. The vehicle's
  // own mileage checks catch the second; this catches the first at the point
  // somebody can still correct it.
  if (reading !== null && vehicle.lastOdometerKm !== null && reading < vehicle.lastOdometerKm) {
    throw new JobError(
      'MILEAGE_BACK',
      `The last reading on this vehicle was ${vehicle.lastOdometerKm.toLocaleString('en-GB')} km. ${reading.toLocaleString('en-GB')} is lower, so one of the two is wrong.`,
    );
  }

  const job = await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentSequence.upsert({
      where: { orgId_kind: { orgId: input.orgId, kind: 'JOB' } },
      create: { orgId: input.orgId, kind: 'JOB', next: 2 },
      update: { next: { increment: 1 } },
    });

    // The upsert returns the row after the increment, so the number just taken
    // is one below it on the update path and the seeded 1 on the create path.
    const number = sequence.next - 1;

    return tx.job.create({
      data: {
        orgId: input.orgId,
        locationId: location.id,
        number,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        status: 'RECEIVED',
        shortDescription: description,
        details: input.details?.trim() || null,
        odometerInKm: reading,
        promisedAt: input.promisedAt ?? null,
        receivedAt: new Date(),
        createdByUserId: input.userId,
        ...(input.jobTypeId ? { jobTypes: { create: [{ jobTypeId: input.jobTypeId }] } } : {}),
        ...(input.technicianUserId
          ? { technicians: { create: [{ userId: input.technicianUserId, isPrimary: true }] } }
          : {}),
        statusEvents: {
          create: [{ toStatus: 'RECEIVED', actorUserId: input.userId }],
        },
      },
      select: { id: true, number: true },
    });
  });

  // The reading travels with the vehicle as well as the job, so the mileage
  // history and everything derived from it see it without waiting for the job
  // to be completed.
  if (reading !== null) {
    await prisma.odometerReading.create({
      data: { vehicleId: input.vehicleId, km: reading, readAt: new Date(), source: 'WORKSHOP' },
    });

    await prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: { lastOdometerKm: reading },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.created',
    entityType: 'Job',
    entityId: job.id,
    after: { number: job.number, shortDescription: description },
  });

  return job;
}

/** Everything the form needs to be filled in without typing an id. */
export async function jobFormOptions(orgId: string) {
  const [customers, jobTypes, technicians] = await Promise.all([
    prisma.customer.findMany({
      where: { orgId, isActive: true },
      orderBy: { displayName: 'asc' },
      take: 500,
      select: {
        id: true,
        displayName: true,
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            vehicle: {
              select: { id: true, make: true, model: true, year: true, registration: true },
            },
          },
        },
      },
    }),
    prisma.jobType.findMany({
      where: { orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, defaultHours: true },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { orgId, role: 'TECHNICIAN', isActive: true } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return {
    // A customer's own vehicles, so choosing one narrows the other. The
    // alternative is a list of every vehicle the workshop has ever seen, which
    // is where somebody opens a job against the wrong car.
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.displayName,
      vehicles: [
        ...new Map(
          customer.jobs
            .filter((job) => job.vehicle)
            .map((job) => [job.vehicle.id, job.vehicle] as const),
        ).values(),
      ],
    })),
    jobTypes,
    technicians,
  };
}
