import {
  customerMessageFor,
  shouldNotify,
  DEFAULT_OPENING,
  offerSlots,
  type BookingStage,
  type Slot,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { traceId } from './trace';

/**
 * Booking, from the customer's side.
 *
 * The rule this module exists to keep: a slot is offered only when the
 * workshop can genuinely do the work. A diary with a free hour at half past
 * four and a three-hour job is not an opportunity, it is a promise that gets
 * broken on the day and costs a phone call to move.
 */

export interface BookableService {
  id: string;
  name: string;
  hours: number;
  price: number | null;
  /** A package carries its lines and checklist onto the job. Phase 37. */
  kind: 'package' | 'item';
  description?: string | null;
}

export async function servicesFor(orgId: string): Promise<BookableService[]> {
  const [packages, items] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { orgId, isActive: true, bookable: true },
      orderBy: { sortOrder: 'asc' },
      include: { lines: { select: { quantity: true, unitPrice: true } } },
    }),
    prisma.serviceItem.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return [
    ...packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      hours: Math.max(0.25, Math.round((pkg.durationMinutes / 60) * 4) / 4),
      price:
        pkg.price === null
          ? Math.round(
              pkg.lines.reduce((t, l) => t + Number(l.quantity) * Number(l.unitPrice), 0) * 100,
            ) / 100
          : Number(pkg.price),
      kind: 'package' as const,
      description: pkg.description,
    })),
    ...items.map((item) => ({
      id: item.id,
      name: item.name,
      hours: Number(item.defaultHours ?? 1),
      price: item.defaultPrice === null ? null : Number(item.defaultPrice),
      kind: 'item' as const,
      description: item.description,
    })),
  ];
}

/** The slots a customer may be offered for a given piece of work. */
export async function slotsFor(input: {
  orgId: string;
  locationId: string;
  hours: number;
  daysAhead?: number;
}): Promise<Slot[]> {
  const location = await prisma.location.findFirstOrThrow({
    where: { id: input.locationId, orgId: input.orgId },
    include: { bays: { where: { isActive: true } } },
  });

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const horizon = new Date(from);
  horizon.setDate(horizon.getDate() + (input.daysAhead ?? 14));

  const booked = await prisma.booking.findMany({
    where: {
      orgId: input.orgId,
      locationId: input.locationId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      startAt: { gte: from, lte: horizon },
    },
    select: { id: true, startAt: true, endAt: true, estimatedHours: true },
  });

  return offerSlots(
    {
      from,
      daysAhead: input.daysAhead ?? 14,
      hours: input.hours,
      dailyCapacityHours: Number(location.dailyCapacityHours),
      opening: DEFAULT_OPENING,
      booked: booked.map((booking) => ({
        id: booking.id,
        startAt: booking.startAt,
        endAt: booking.endAt,
        estimatedHours: Number(booking.estimatedHours),
      })),
      // Nothing today, and nothing in the next two hours. A workshop needs
      // notice, and a slot at ten past nine offered at nine is not a booking,
      // it is somebody turning up.
      notBefore: new Date(Date.now() + 2 * 3_600_000),
      bays: Math.max(1, location.bays.length),
    },
    3,
    6,
  );
}

export interface BookingRequest {
  orgId: string;
  customerId: string;
  /**
   * The portal account the vehicle is owned by.
   *
   * Ownership is recorded against the person, not against the workshop's
   * customer record, because the passport follows the car between garages and
   * a customer row belongs to one of them.
   */
  ownerUserId: string;
  vehicleId: string;
  locationId: string;
  serviceItemId: string | null;
  description: string;
  startAt: Date;
  hours: number;
  notes?: string | null;
}

export interface BookingOutcome {
  ok: boolean;
  error?: string;
  bookingId?: string;
}

/**
 * Takes a booking, re-checking the slot inside the transaction.
 *
 * The slot was free when the page rendered. Between then and the submit,
 * somebody at the counter may have taken it. Trusting the form is how two
 * customers arrive for the same ramp at the same time.
 */
export async function requestBooking(input: BookingRequest): Promise<BookingOutcome> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: input.vehicleId,
      ownerships: { some: { ownerUserId: input.ownerUserId, endedAt: null } },
    },
    select: { id: true, make: true, model: true },
  });

  if (!vehicle) {
    return { ok: false, error: 'That vehicle is not one of yours.' };
  }

  const endAt = new Date(input.startAt.getTime() + input.hours * 3_600_000);

  try {
    const bookingId = await prisma.$transaction(async (tx) => {
      const location = await tx.location.findFirstOrThrow({
        where: { id: input.locationId, orgId: input.orgId },
        include: { bays: { where: { isActive: true } } },
      });

      const dayStart = new Date(input.startAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sameDay = await tx.booking.findMany({
        where: {
          orgId: input.orgId,
          locationId: input.locationId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          startAt: { gte: dayStart, lt: dayEnd },
        },
        select: { startAt: true, endAt: true },
      });

      const committed = sameDay.reduce(
        (total, booking) =>
          total + (booking.endAt.getTime() - booking.startAt.getTime()) / 3_600_000,
        0,
      );

      if (committed + input.hours > Number(location.dailyCapacityHours)) {
        throw new Error('That day filled up while you were choosing. Please pick another.');
      }

      const concurrent = sameDay.filter(
        (booking) => input.startAt < booking.endAt && booking.startAt < endAt,
      ).length;

      if (concurrent >= Math.max(1, location.bays.length)) {
        throw new Error('Somebody took that slot a moment ago. Please pick another.');
      }

      const booking = await tx.booking.create({
        data: {
          orgId: input.orgId,
          locationId: input.locationId,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          // There is no REQUESTED status: a booking taken online is scheduled
          // like any other, and `source` records that nobody keyed it in.
          status: 'SCHEDULED',
          startAt: input.startAt,
          endAt,
          estimatedHours: input.hours,
          description: input.description,
          notes: input.notes?.trim() || null,
          source: 'ONLINE',
          // A package chosen online is the package the job starts from. Phase 37.
          packageId: input.serviceItemId
            ? ((
                await tx.servicePackage.findFirst({
                  where: { id: input.serviceItemId, orgId: input.orgId, isActive: true },
                  select: { id: true },
                })
              )?.id ?? null)
            : null,
        },
      });

      // The message the customer gets is queued here, in the same transaction
      // as the booking. A confirmation that goes out for a booking that then
      // failed to save is worse than one that is a minute late.
      //
      // Queued as a message rather than as an outbox event, which is what it
      // used to be: nothing handled that event type, so the confirmation this
      // code went to the trouble of composing was written into a row, parked
      // with "no handler registered", and never sent. Phase 46.6.
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { displayName: true, email: true, mobile: true, org: { select: { name: true } } },
      });

      const said = customerMessageFor('REQUESTED', `${vehicle.make} ${vehicle.model}`);
      const channel = customer?.email ? 'EMAIL' : customer?.mobile ? 'SMS' : null;
      const to = customer?.email ?? customer?.mobile;

      if (customer && channel && to && said) {
        await tx.messageLog.create({
          data: {
            traceId: await traceId(),
            orgId: input.orgId,
            channel,
            toAddress: to,
            subject: `${customer.org?.name ?? 'Your workshop'}: booking request`,
            body:
              channel === 'EMAIL'
                ? [
                    `Hello ${customer.displayName.split(' ')[0]}.`,
                    '',
                    said,
                    '',
                    customer.org?.name ?? '',
                  ].join('\n')
                : said,
            status: 'QUEUED',
            relatedType: 'Booking',
            relatedId: booking.id,
          },
        });
      }

      return booking.id;
    });

    await audit({
      orgId: input.orgId,
      action: 'booking.requested',
      entityType: 'Booking',
      entityId: bookingId,
      after: { source: 'ONLINE', startAt: input.startAt.toISOString() } as never,
    });

    // A booking taken online reaches the diary and whoever keeps it. Phase 39.
    const { notifyStaff } = await import('./search');
    await notifyStaff({
      orgId: input.orgId,
      kind: 'BOOKING_REQUESTED',
      title: `Booked online: ${vehicle.make ?? ''} ${vehicle.model ?? ''}, ${input.startAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
      body: input.description,
      href: `/bookings/${bookingId}`,
      entityType: 'Booking',
      entityId: bookingId,
    });

    return { ok: true, bookingId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'That booking could not be taken.',
    };
  }
}

/* ---------------------------------------------------------------------------
   Keeping the customer informed
   --------------------------------------------------------------------------- */

/**
 * Tells the customer their car has reached a stage worth telling them about.
 *
 * Only the stages a customer cares about, because sending every status change
 * trains people to ignore all of them, which costs the one message that
 * mattered: the car needs a decision.
 *
 * This wrote an outbox event that nothing handled. The copy existed, the rule
 * about which stages are worth sending existed, both were tested — and the
 * function had no callers, so in a year of running this product no customer
 * was ever told their car was ready. It now queues a real message the way an
 * invoice does, and is called from the one place a job changes state.
 *
 * Never throws. A message provider having a bad second must not stop a job
 * moving on the board in front of somebody.
 */
export async function notifyCustomer(input: {
  orgId: string;
  jobId: string;
  stage: BookingStage;
}): Promise<boolean> {
  if (!shouldNotify(input.stage)) return false;

  try {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId },
      select: {
        id: true,
        number: true,
        customer: { select: { displayName: true, email: true, mobile: true } },
        vehicle: { select: { make: true, model: true } },
        org: { select: { name: true } },
      },
    });

    if (!job) return false;

    const message = customerMessageFor(
      input.stage,
      `${job.vehicle.make} ${job.vehicle.model}`.trim(),
    );

    if (!message) return false;

    // Email where there is one, a text where there is not. This is not
    // marketing — it is about their own car — so it does not ask for consent,
    // and the address is whichever one the workshop actually has.
    const channel = job.customer.email ? 'EMAIL' : job.customer.mobile ? 'SMS' : null;
    const to = job.customer.email ?? job.customer.mobile;

    if (!channel || !to) return false;

    const queued = await prisma.messageLog.create({
      data: {
        traceId: await traceId(),
        orgId: input.orgId,
        channel,
        toAddress: to,
        subject: `${job.org.name}: job ${job.number}`,
        body:
          channel === 'EMAIL'
            ? [
                `Hello ${job.customer.displayName.split(' ')[0]}.`,
                '',
                message,
                '',
                'Ring or reply if you need anything.',
                '',
                job.org.name,
              ].join('\n')
            : `${job.org.name}: ${message}`,
        status: 'QUEUED',
        relatedType: 'Job',
        relatedId: job.id,
      },
      select: { id: true },
    });

    const { pushNow } = await import('./outbound');
    await pushNow(queued.id);

    return true;
  } catch {
    // Deliberately silent, like every other message the product sends: the
    // work in front of somebody must not stop because a mailbox did.
    return false;
  }
}

/* ---------------------------------------------------------------------------
   Reminders
   --------------------------------------------------------------------------- */

/**
 * What is due, and why.
 *
 * The reminder engine has been running since Phase 1 and nobody could see it.
 * A machine that sends messages with no screen showing what it is about to do
 * is indistinguishable from one that has quietly stopped.
 */
export async function remindersDue(orgId: string, withinDays = 30) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);

  const schedules = await prisma.serviceSchedule.findMany({
    where: {
      orgId,
      isActive: true,
      OR: [{ dueAt: { lte: horizon } }, { dueAt: null, dueKm: { not: null } }],
    },
    include: {
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          registration: true,
          ownerships: {
            where: { endedAt: null },
            take: 1,
            include: { owner: { select: { name: true, email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: 'asc' },
    take: 60,
  });

  const now = Date.now();

  return schedules.map((schedule) => {
    const days = schedule.dueAt ? Math.ceil((schedule.dueAt.getTime() - now) / 86_400_000) : null;

    return {
      ...schedule,
      owner: schedule.vehicle.ownerships[0]?.owner ?? null,
      ownerName: schedule.vehicle.ownerships[0]?.ownerName ?? null,
      daysUntilDue: days,
      overdue: days !== null && days < 0,
      // Already sent, so it is on the list as a record rather than as work.
      alreadySent: schedule.reminderSentAt !== null,
      // A reminder with nobody to send it to is the finding, not a blank row.
      unreachable: !schedule.vehicle.ownerships[0]?.owner?.email,
    };
  });
}
