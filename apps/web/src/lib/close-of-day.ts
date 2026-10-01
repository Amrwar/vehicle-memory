import {
  assertRecordable,
  businessDay,
  CLOSE_READINGS,
  CloseOfDayError,
  countTill,
  type Currency,
  type Money,
  howTheDayEnds,
  keyState,
  IN_SHOP_STATUSES,
  type CloseReading,
  type CloseReadingKind,
  shouldNotBeLeft,
  standingOf,
  TILL_TOLERANCE_MINOR,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { openTill } from './counter';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The ten readings, taken from what the product already knows.
 *
 * Every one of these is a question some other screen already answers. The
 * close asks all ten at once, at the moment somebody is standing by the door
 * with their coat on, and then records that they were asked.
 *
 * Nothing here writes anything. `closeTheDay` is the only function in this
 * file that touches the database in anger, and all it writes is the record of
 * the reading -- never the things read.
 *
 * Phase 96.
 */

const DB_KIND: Record<
  CloseReadingKind,
  | 'TILL'
  | 'CLOCKED_ON'
  | 'KEYS'
  | 'CARS_ON_SITE'
  | 'OPEN_JOBS'
  | 'UNPAID_INVOICES'
  | 'ESTIMATES_WAITING'
  | 'PARTS_LATE'
  | 'BANK_UNMATCHED'
  | 'FOLLOW_UPS_DUE'
> = {
  till: 'TILL',
  'clocked-on': 'CLOCKED_ON',
  keys: 'KEYS',
  'cars-on-site': 'CARS_ON_SITE',
  'open-jobs': 'OPEN_JOBS',
  'unpaid-invoices': 'UNPAID_INVOICES',
  'estimates-waiting': 'ESTIMATES_WAITING',
  'parts-late': 'PARTS_LATE',
  'bank-unmatched': 'BANK_UNMATCHED',
  'follow-ups-due': 'FOLLOW_UPS_DUE',
};

/**
 * The till: open, uncounted, or out by more than the tolerance.
 *
 * Three different wrongs and the count cannot distinguish them, so the
 * sentence does. "Still open" is the commonest and the most ordinary -- the
 * drawer has simply not been counted yet -- and it is still a thing that
 * should not be left, because cash counted tomorrow lands in tomorrow.
 */
async function tillReading(
  orgId: string,
  locationId: string | null,
  currency: Currency,
): Promise<CloseReading> {
  const open = await openTill(orgId, locationId);

  if (!open) {
    // No session at all. A workshop that does not take cash has nothing to
    // count, and saying "the till is fine" about a till that does not exist
    // would be the screen inventing a reassurance.
    return {
      kind: 'till',
      count: 0,
      what: { key: 'No till was opened today.' },
      href: '/counter',
    };
  }

  if (open.session.countedCash === null) {
    return {
      kind: 'till',
      count: 1,
      what: { key: 'The till is still open and has not been counted.' },
      href: '/counter',
    };
  }

  // Money, not minor units. `countTill` has taken `Money` since Phase 20 so
  // that nobody can add pence to pounds by accident, and handing it bare
  // numbers would be stepping around the one thing the type is for. The
  // currency comes from the workshop's region, which is the only place that
  // knows it -- a till cannot be counted in a currency nobody named.
  const money = (minor: number): Money => ({ minor, currency });

  const count = countTill({
    openingFloat: money(Math.round(Number(open.session.openingFloat) * 100)),
    cashSales: money(open.cashMinor),
    cashRefunds: money(0),
    paidOut: money(Math.round(Number(open.session.paidOut) * 100)),
    counted: money(Math.round(Number(open.session.countedCash) * 100)),
  });

  return {
    kind: 'till',
    count: count.significant ? 1 : 0,
    what: count.significant
      ? {
          key: 'The till is out by more than {tolerance}.',
          vars: { tolerance: TILL_TOLERANCE_MINOR / 100 },
        }
      : { key: 'The till was counted and agrees.' },
    href: '/counter',
  };
}

/** People the product still believes are in the building. */
async function clockedOnReading(orgId: string, locationId: string | null): Promise<CloseReading> {
  const count = await prisma.attendanceRecord.count({
    where: {
      endedAt: null,
      employee: { orgId },
      ...(locationId ? { locationId } : {}),
    },
  });

  return {
    kind: 'clocked-on',
    count,
    what:
      count === 0
        ? { key: 'Everybody has clocked out.' }
        : count === 1
          ? { key: '1 person is still clocked on.' }
          : { key: '{count} people are still clocked on.', vars: { count } },
    href: '/people',
  };
}

/**
 * Keys nobody can place, on cars that are still here.
 *
 * Not every job without a key event: a car the customer drove away in has its
 * keys with its owner and that is the end of it. What matters is a car on the
 * premises whose keys are in somebody's pocket or were never recorded at all,
 * because that is the one a stranger can drive off the forecourt.
 */
async function keysReading(orgId: string): Promise<CloseReading> {
  const jobs = await prisma.job.findMany({
    where: { orgId, status: { in: [...IN_SHOP_STATUSES] }, collectedAt: null },
    select: {
      id: true,
      keyEvents: {
        select: { action: true, hook: true, at: true, by: { select: { name: true } } },
        orderBy: { at: 'asc' },
      },
    },
    take: 200,
  });

  const loose = jobs.filter((job) => {
    const state = keyState(
      job.keyEvents.map((event) => ({
        action: event.action,
        hook: event.hook,
        byName: event.by?.name ?? null,
        at: event.at,
      })),
    );
    return state.where === 'with' || state.where === 'unknown';
  });

  const count = loose.length;
  return {
    kind: 'keys',
    count,
    what:
      count === 0
        ? { key: 'Every key is on its hook.' }
        : count === 1
          ? { key: '1 set of keys is not on a hook.' }
          : { key: '{count} sets of keys are not on a hook.', vars: { count } },
    href: '/floor',
  };
}

/** Cars checked in and not yet gone. Ordinary, and worth knowing. */
async function carsOnSiteReading(orgId: string): Promise<CloseReading> {
  const count = await prisma.job.count({
    where: { orgId, status: { in: [...IN_SHOP_STATUSES] }, collectedAt: null },
  });

  return {
    kind: 'cars-on-site',
    count,
    what:
      count === 0
        ? { key: 'No customer car is left on site.' }
        : count === 1
          ? { key: '1 car is still on site.' }
          : { key: '{count} cars are still on site.', vars: { count } },
    href: '/floor',
  };
}

/** Jobs still ours to move. */
async function openJobsReading(orgId: string): Promise<CloseReading> {
  const count = await prisma.job.count({
    where: { orgId, status: { notIn: ['PAID', 'CANCELLED', 'DRAFT'] } },
  });

  return {
    kind: 'open-jobs',
    count,
    what:
      count === 0
        ? { key: 'Every job is finished and settled.' }
        : count === 1
          ? { key: '1 job is still open.' }
          : { key: '{count} jobs are still open.', vars: { count } },
    href: '/now',
  };
}

/** Money owed. The same predicate the owner dashboard uses. */
async function unpaidInvoicesReading(orgId: string): Promise<CloseReading> {
  const count = await prisma.invoice.count({
    where: { orgId, status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] } },
  });

  return {
    kind: 'unpaid-invoices',
    count,
    what:
      count === 0
        ? { key: 'Nothing is owed.' }
        : count === 1
          ? { key: '1 invoice is unpaid.' }
          : { key: '{count} invoices are unpaid.', vars: { count } },
    href: '/invoices',
  };
}

/** Estimates sent and not answered. */
async function estimatesWaitingReading(orgId: string): Promise<CloseReading> {
  const count = await prisma.estimate.count({
    where: { orgId, status: { in: ['SENT', 'PARTIALLY_APPROVED'] }, decidedAt: null },
  });

  return {
    kind: 'estimates-waiting',
    count,
    what:
      count === 0
        ? { key: 'No estimate is waiting on a customer.' }
        : count === 1
          ? { key: '1 estimate is waiting on a customer.' }
          : { key: '{count} estimates are waiting on a customer.', vars: { count } },
    href: '/estimates',
  };
}

/** Orders that were due and have not arrived. */
async function partsLateReading(orgId: string, now: Date): Promise<CloseReading> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { orgId, status: { in: ['SENT', 'PART_RECEIVED'] }, expectedAt: { lt: now } },
    select: { id: true, lines: { select: { quantity: true, received: true } } },
    take: 200,
  });

  const count = orders.filter((order) =>
    order.lines.some((line) => Number(line.quantity) > Number(line.received)),
  ).length;

  return {
    kind: 'parts-late',
    count,
    what:
      count === 0
        ? { key: 'No order is overdue.' }
        : count === 1
          ? { key: '1 order was due and has not arrived.' }
          : { key: '{count} orders were due and have not arrived.', vars: { count } },
    href: '/purchasing',
  };
}

/** Bank lines nobody has matched. */
async function bankUnmatchedReading(orgId: string): Promise<CloseReading> {
  const count = await prisma.bankStatementLine.count({
    // Matched to a journal entry, not to a payment: a bank line can answer a
    // receipt, a charge, a transfer or a fee, and only the ledger has all four.
    where: { statement: { account: { orgId } }, matchedEntryId: null },
  });

  return {
    kind: 'bank-unmatched',
    count,
    what:
      count === 0
        ? { key: 'The bank and the ledger agree.' }
        : count === 1
          ? { key: '1 bank line is unmatched.' }
          : { key: '{count} bank lines are unmatched.', vars: { count } },
    href: '/banking',
  };
}

/** Follow-ups due today or already late. */
async function followUpsDueReading(orgId: string, now: Date): Promise<CloseReading> {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const count = await prisma.jobFollowUp.count({
    where: { job: { orgId }, completedAt: null, dueAt: { lte: endOfToday } },
  });

  return {
    kind: 'follow-ups-due',
    count,
    what:
      count === 0
        ? { key: 'No follow-up is due.' }
        : count === 1
          ? { key: '1 follow-up is due.' }
          : { key: '{count} follow-ups are due.', vars: { count } },
    // There is no follow-ups page of its own; the dashboard is where the due
    // ones are listed, and sending somebody to a route that does not exist is
    // the fault the morning list's route check was built to catch.
    href: '/dashboard',
  };
}

/**
 * All ten, read at once.
 *
 * In parallel, because somebody is standing at the door. They are independent
 * questions of independent tables and there is nothing to be gained by asking
 * them in turn.
 */
export async function theEndOfTheDay(
  orgId: string,
  locationId: string | null,
  currency: Currency,
  now = new Date(),
) {
  const readings = await Promise.all([
    tillReading(orgId, locationId, currency),
    clockedOnReading(orgId, locationId),
    keysReading(orgId),
    carsOnSiteReading(orgId),
    openJobsReading(orgId),
    unpaidInvoicesReading(orgId),
    estimatesWaitingReading(orgId),
    partsLateReading(orgId, now),
    bankUnmatchedReading(orgId),
    followUpsDueReading(orgId, now),
  ]);

  // The order the rules module declares, not the order the promises settled.
  const byKind = new Map(readings.map((one) => [one.kind, one]));
  return howTheDayEnds(CLOSE_READINGS.map((kind) => byKind.get(kind)!));
}

/** Whether today is already closed, and by whom. */
export async function closeFor(orgId: string, locationId: string, on: string) {
  return prisma.dayClose.findFirst({
    where: { orgId, locationId, on: new Date(`${on}T00:00:00Z`) },
    include: {
      closedBy: { select: { name: true } },
      readings: true,
    },
  });
}

/**
 * The closes of the last few days, newest first.
 *
 * Bounded by date and not only by count. `take` alone would put a close from
 * eighteen months ago under a heading that says "the last week" the moment a
 * workshop had fewer than seven recent ones -- which is exactly what the first
 * design shot showed, with `verify-close`'s 1990 probe sitting at the top of
 * "Lately". The take stays as a second bound so the query is still finite for
 * a group closing several sites a night.
 */
export async function recentCloses(orgId: string, days = 7, take = 30) {
  const from = new Date(Date.now() - days * DAY);
  return prisma.dayClose.findMany({
    where: { orgId, on: { gte: new Date(from.toISOString().slice(0, 10)) } },
    orderBy: { on: 'desc' },
    take,
    include: { closedBy: { select: { name: true } }, readings: true },
  });
}

/**
 * Record that somebody closed the day, and what they were looking at.
 *
 * The readings are taken again here rather than trusted from the page. A form
 * that posted its own figures would record what the browser last saw, which
 * may be twenty minutes and one payment old -- and the whole value of this row
 * is that it says what was true at the moment of the act.
 *
 * @repeat GUARDED(UNIQUE: day_closes_orgId_locationId_on_key) A second close
 * for the same site and day is refused by the database, not by a check that
 * could race with itself.
 */
export async function closeTheDay(input: {
  orgId: string;
  locationId: string;
  userId: string;
  timezone: string;
  currency: Currency;
  note?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const on = businessDay(now, input.timezone);

  const already = await closeFor(input.orgId, input.locationId, on);
  if (already) {
    throw new CloseOfDayError(
      'ALREADY_CLOSED',
      `That day was closed at ${already.closedAt.toISOString()} by ${already.closedBy.name}.`,
    );
  }

  const close = await theEndOfTheDay(input.orgId, input.locationId, input.currency, now);
  assertRecordable(close.readings);

  const note = input.note?.trim() ? input.note.trim() : null;

  return prisma.dayClose.create({
    data: {
      orgId: input.orgId,
      locationId: input.locationId,
      on: new Date(`${on}T00:00:00Z`),
      closedAt: now,
      closedByUserId: input.userId,
      note,
      readings: {
        create: close.readings.map((reading) => ({
          kind: DB_KIND[reading.kind],
          count: reading.count,
          leftOvernight: shouldNotBeLeft(reading.kind) && reading.count > 0,
        })),
      },
    },
    include: { readings: true },
  });
}

export { businessDay, standingOf };
