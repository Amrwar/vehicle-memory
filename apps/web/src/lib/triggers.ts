import type { Facts, TriggerEvent } from '@carnet/core';
import { prisma } from '@carnet/db';

import { fireEvent } from './automation';

/**
 * The moments a workshop's own rules are supposed to run at.
 *
 * The rules engine was complete: ten triggers, conditions, cooldowns, actions,
 * a page to write rules on, and a check that refuses a rule that could never
 * match. What it did not have was anybody calling it. One trigger —
 * service.due — was fired from the reminder sweep; the other nine were offered
 * on screen and fired from nowhere, so a workshop could write "when a bill
 * goes a fortnight overdue, text them" and it would never once run.
 *
 * Every function here gathers the facts a rule can be written against and
 * hands them to the engine. The facts matter as much as the trigger: a
 * condition on a fact nobody supplied does not match, deliberately, because
 * treating a missing figure as zero would fire every "less than" rule on
 * incomplete data.
 *
 * Nothing here throws. An automation rule is a convenience laid on top of the
 * work; a rule that cannot run must never stop an invoice being issued or a
 * job being finished.
 */

async function safely(what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    const { log } = await import('@carnet/jobs');
    log('automation.trigger.failed', {
      trigger: what,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** What is true of a customer, for rules written about them. */
async function customerFacts(customerId: string | null): Promise<Facts> {
  if (!customerId) return {};

  const [customer, paid, lastVisit] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { customerId, status: 'PAID' },
      _sum: { total: true },
      _count: true,
    }),
    prisma.job.findFirst({
      where: { customerId, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
  ]);

  if (!customer) return {};

  const facts: Facts = {
    'customer.lifetimeValue': Math.round(Number(paid._sum.total ?? 0) * 100) / 100,
    'customer.visits': paid._count,
  };

  if (lastVisit?.completedAt) {
    facts['customer.daysSinceLastVisit'] = Math.floor(
      (Date.now() - lastVisit.completedAt.getTime()) / 86_400_000,
    );
  }

  return facts;
}

/** What is true of a vehicle, for rules written about the car rather than the person. */
function vehicleFacts(
  vehicle: {
    year: number | null;
    lastOdometerKm: number | null;
  } | null,
): Facts {
  if (!vehicle) return {};

  const facts: Facts = {};

  if (vehicle.year) facts['vehicle.ageYears'] = new Date().getFullYear() - vehicle.year;
  if (vehicle.lastOdometerKm !== null) facts['vehicle.mileage'] = vehicle.lastOdometerKm;

  return facts;
}

/**
 * A job reached a state a rule might care about.
 *
 * Called for completion and for a job that is waiting on the customer, which
 * are the two states a workshop writes rules about: one is the moment to ask
 * for a review, the other is the moment to chase a decision.
 */
export async function jobReached(input: {
  orgId: string;
  jobId: string;
  event: Extract<TriggerEvent, 'job.completed' | 'job.awaiting_approval'>;
}): Promise<void> {
  await safely(input.event, async () => {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId },
      select: {
        id: true,
        customerId: true,
        vehicle: { select: { year: true, lastOdometerKm: true } },
        labourLines: { select: { hours: true, rate: true } },
        partLines: { select: { quantity: true, unitPrice: true } },
        feeLines: { select: { amount: true } },
      },
    });

    if (!job) return;

    const total =
      job.labourLines.reduce((sum, line) => sum + Number(line.hours) * Number(line.rate), 0) +
      job.partLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0) +
      job.feeLines.reduce((sum, line) => sum + Number(line.amount), 0);

    await fireEvent({
      orgId: input.orgId,
      event: input.event,
      subjectType: 'Job',
      subjectId: job.id,
      customerId: job.customerId,
      facts: {
        'job.total': Math.round(total * 100) / 100,
        ...vehicleFacts(job.vehicle),
        ...(await customerFacts(job.customerId)),
      },
    });
  });
}

/** A bill went out, or went past its due date without being paid. */
export async function invoiceReached(input: {
  orgId: string;
  invoiceId: string;
  event: Extract<TriggerEvent, 'invoice.issued' | 'invoice.overdue'>;
  now?: Date;
}): Promise<void> {
  await safely(input.event, async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, orgId: input.orgId },
      select: { id: true, customerId: true, total: true, dueAt: true },
    });

    if (!invoice) return;

    const now = input.now ?? new Date();
    const facts: Facts = {
      'invoice.total': Math.round(Number(invoice.total) * 100) / 100,
      ...(await customerFacts(invoice.customerId)),
    };

    if (invoice.dueAt) {
      facts['invoice.daysOverdue'] = Math.max(
        0,
        Math.floor((now.getTime() - invoice.dueAt.getTime()) / 86_400_000),
      );
    }

    await fireEvent({
      orgId: input.orgId,
      event: input.event,
      subjectType: 'Invoice',
      subjectId: invoice.id,
      customerId: invoice.customerId,
      facts,
      now,
    });
  });
}

/** Somebody booked, or did not turn up for what they booked. */
export async function bookingReached(input: {
  orgId: string;
  bookingId: string;
  event: Extract<TriggerEvent, 'booking.created' | 'booking.missed'>;
}): Promise<void> {
  await safely(input.event, async () => {
    const booking = await prisma.booking.findFirst({
      where: { id: input.bookingId, orgId: input.orgId },
      select: {
        id: true,
        customerId: true,
        vehicle: { select: { year: true, lastOdometerKm: true } },
      },
    });

    if (!booking) return;

    await fireEvent({
      orgId: input.orgId,
      event: input.event,
      subjectType: 'Booking',
      subjectId: booking.id,
      customerId: booking.customerId,
      facts: {
        ...vehicleFacts(booking.vehicle),
        ...(await customerFacts(booking.customerId)),
      },
    });
  });
}

/** A quote came back with a no, which is the moment worth reacting to. */
export async function estimateDeclined(input: {
  orgId: string;
  estimateId: string;
}): Promise<void> {
  await safely('estimate.declined', async () => {
    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId },
      // An estimate belongs to a job, and the job knows whose it is.
      select: { id: true, total: true, job: { select: { customerId: true } } },
    });

    if (!estimate) return;

    await fireEvent({
      orgId: input.orgId,
      event: 'estimate.declined',
      subjectType: 'Estimate',
      subjectId: estimate.id,
      customerId: estimate.job.customerId,
      facts: {
        'estimate.total': Math.round(Number(estimate.total) * 100) / 100,
        ...(await customerFacts(estimate.job.customerId)),
      },
    });
  });
}

/** A customer who used to come and has stopped. */
export async function customerLapsing(input: { orgId: string; customerId: string }): Promise<void> {
  await safely('customer.lapsing', async () => {
    await fireEvent({
      orgId: input.orgId,
      event: 'customer.lapsing',
      subjectType: 'Customer',
      subjectId: input.customerId,
      customerId: input.customerId,
      facts: await customerFacts(input.customerId),
    });
  });
}
