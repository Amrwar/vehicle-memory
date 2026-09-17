import { prisma } from '@carnet/db';

import { fileUnfiled } from './conversations';
import { bookingReached, customerLapsing, invoiceReached } from './triggers';

/**
 * The triggers that are not events but conditions. Phase 46.6.
 *
 * A bill going overdue, somebody not turning up, a customer quietly stopping
 * coming: nothing happens at the moment any of these become true, so nothing
 * can fire them. They have to be looked for.
 *
 * Looked for hourly, and each one fires at most once per subject because the
 * engine's own cooldown holds it: without that, a bill a fortnight overdue
 * would chase the customer every hour for a fortnight, which is how a workshop
 * loses a customer rather than collects a debt.
 */

/** How far back a sweep bothers looking. Older than this is somebody else's job. */
const WINDOW_DAYS = 90;

/** Silence from a customer for longer than this is worth a workshop knowing about. */
const LAPSED_AFTER_DAYS = 400;

/**
 * Bills that have gone past their due date without being paid.
 *
 * Only ones that have just crossed the line and ones still within the window,
 * because a rule with a "more than thirty days" condition needs to see the
 * bill on the thirty-first day, not only on the first.
 */
export async function sweepOverdueInvoices(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] },
      dueAt: { lt: now, gte: since },
    },
    select: { id: true, orgId: true },
    take: 500,
  });

  for (const invoice of overdue) {
    await invoiceReached({
      orgId: invoice.orgId,
      invoiceId: invoice.id,
      event: 'invoice.overdue',
      now,
    });
  }

  return overdue.length;
}

/**
 * Bookings whose time came and went with nobody marking them arrived.
 *
 * A no-show is only a no-show once the slot has passed; a booking at four
 * o'clock is not missed at half past three. An hour's grace, because a
 * customer stuck in traffic is not a no-show either.
 */
export async function sweepMissedBookings(now = new Date()): Promise<number> {
  const grace = new Date(now.getTime() - 3_600_000);
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  const missed = await prisma.booking.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      endAt: { lt: grace, gte: since },
    },
    select: { id: true, orgId: true },
    take: 500,
  });

  for (const booking of missed) {
    await bookingReached({ orgId: booking.orgId, bookingId: booking.id, event: 'booking.missed' });
  }

  return missed.length;
}

/**
 * Customers who used to come and have stopped.
 *
 * Deliberately blunt: anybody whose last finished job is more than a year and
 * a month ago, which is long enough that a yearly service has been missed
 * rather than merely being late. The rule a workshop writes on top of this
 * carries the real judgement, in conditions about how much they used to spend
 * and how often they used to come.
 */
export async function sweepLapsingCustomers(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LAPSED_AFTER_DAYS * 86_400_000);
  const floor = new Date(now.getTime() - (LAPSED_AFTER_DAYS + 30) * 86_400_000);

  // The last job each customer had, where that job finished inside the month
  // after the cutoff. A wider net would re-examine every dormant customer in
  // the database every hour to no purpose.
  const lapsing = await prisma.job.groupBy({
    by: ['orgId', 'customerId'],
    where: { completedAt: { lt: cutoff, gte: floor } },
    _max: { completedAt: true },
    orderBy: { _max: { completedAt: 'desc' } },
    take: 500,
  });

  let fired = 0;

  for (const row of lapsing) {
    const since = await prisma.job.count({
      where: { customerId: row.customerId, completedAt: { gte: cutoff } },
    });

    // Somebody who has been back since is not lapsing, whatever the older job
    // says.
    if (since > 0) continue;

    await customerLapsing({ orgId: row.orgId, customerId: row.customerId });
    fired += 1;
  }

  return fired;
}

/**
 * Files messages that arrived or left without a thread. FR-8603.
 *
 * Filing is cheap per message and expensive in a loop, so it belongs on a
 * schedule rather than on a page: before Phase 51 the only thing that ever
 * filed anything was somebody opening a job or the inbox, which meant a
 * workshop that did neither accumulated unfiled messages for ever, and one
 * that opened a job paid for the backlog.
 */
export async function sweepConversations(): Promise<number> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  let filed = 0;

  for (const org of orgs) {
    filed += await fileUnfiled(org.id, 200);
  }

  return filed;
}

/** All of them, for the hourly job. */
export async function sweepConditions(now = new Date()): Promise<{
  overdue: number;
  missed: number;
  lapsing: number;
  filed: number;
}> {
  return {
    overdue: await sweepOverdueInvoices(now),
    missed: await sweepMissedBookings(now),
    lapsing: await sweepLapsingCustomers(now),
    filed: await sweepConversations(),
  };
}
