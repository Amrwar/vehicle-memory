import { mayNotify, projectServiceDue } from '@carnet/core';
import { prisma } from '@carnet/db';

import { fireEvent } from './automation';
import { consentOf } from './consent';
import { log } from './log';

/**
 * Turning a service falling due into a message somebody can act on.
 */

/* ---------------------------------------------------------------------------
   Service reminders
   --------------------------------------------------------------------------- */

export async function queueServiceReminders(): Promise<number> {
  const horizon = new Date(Date.now() + 14 * 86_400_000);

  const due = await prisma.serviceSchedule.findMany({
    where: {
      isActive: true,
      reminderSentAt: null,
      OR: [{ dueAt: { lte: horizon } }, { dueKm: { not: null } }],
    },
    include: {
      vehicle: {
        select: {
          lastOdometerKm: true,
          // The most recent job is how a vehicle reaches a customer: a vehicle
          // belongs to a VIN, not to any one workshop's address book.
          jobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              customer: {
                select: {
                  id: true,
                  email: true,
                  mobile: true,
                  marketingEmailConsent: true,
                  marketingSmsConsent: true,
                },
              },
            },
          },
        },
      },
    },
    take: 50,
  });

  let queued = 0;

  for (const schedule of due) {
    const projection = projectServiceDue({
      lastPerformedAt: schedule.lastPerformedAt,
      lastPerformedKm: schedule.lastPerformedKm,
      intervalMonths: schedule.intervalMonths,
      intervalKm: schedule.intervalKm,
      currentKm: schedule.vehicle.lastOdometerKm,
      kmPerDay: null,
    });

    if (!projection.projectedDueAt || projection.projectedDueAt > horizon) continue;

    // The reminder has to reach somebody, and it has to give them somewhere to
    // go. A message saying a service is due that offers no way to book it puts
    // the work back on the customer to ring during opening hours, which is
    // exactly where the appointment gets lost.
    const owner = schedule.vehicle.jobs[0]?.customer ?? null;

    if (owner && schedule.orgId) {
      // Transactional: it is about their own vehicle, so marketing consent
      // does not gate it. Only the absence of an address does.
      const decision = mayNotify({ channel: 'EMAIL', consent: consentOf(owner) });

      if (decision.allowed) {
        await prisma.messageLog.create({
          data: {
            orgId: schedule.orgId,
            channel: 'EMAIL',
            toAddress: owner.email ?? '',
            subject: schedule.name + ' is due on your vehicle',
            body:
              schedule.name +
              ' is coming due. Pick a time that suits you at /portal/book and we will have the parts ready.',
            status: 'QUEUED',
            relatedType: 'ServiceSchedule',
            relatedId: schedule.id,
          },
        });
      }

      await fireEvent({
        orgId: schedule.orgId,
        event: 'service.due',
        subjectType: 'ServiceSchedule',
        subjectId: schedule.id,
        customerId: owner.id,
        facts: { 'vehicle.mileage': schedule.vehicle.lastOdometerKm ?? 0 },
      });
    }

    await prisma.serviceSchedule.update({
      where: { id: schedule.id },
      data: { reminderSentAt: new Date() },
    });
    queued += 1;
  }

  if (queued > 0) log('reminders.queued', { count: queued });
  return queued;
}
