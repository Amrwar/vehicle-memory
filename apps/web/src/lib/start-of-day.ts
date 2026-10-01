import {
  businessDay,
  type CloseReadingKind,
  type HandoverLine,
  howItMoved,
  type SinceWhen,
  theHandover,
  whoIsIn,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { theEndOfTheDay } from './close-of-day';

/**
 * What happened while we were shut.
 *
 * Two questions, and only the first of them is new work. "What is still true?"
 * is answered by taking today's close readings and comparing them with the
 * figures last night's close wrote down -- which is possible only because
 * Phase 96 stored them rather than deriving them.
 *
 * "What arrived?" is answered from the source records, deliberately and not
 * from `StaffNotification`. That feed exists, is per-person and read-marked,
 * and `notifyStaff` swallows its own errors -- so the absence of a
 * notification is not evidence that nothing happened, and a morning screen
 * built on it would be quietly wrong on exactly the mornings that matter.
 *
 * Nothing here writes anything at all. Phase 97.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The database spelling of a reading kind. */
const FROM_DB: Record<string, CloseReadingKind> = {
  TILL: 'till',
  CLOCKED_ON: 'clocked-on',
  KEYS: 'keys',
  CARS_ON_SITE: 'cars-on-site',
  OPEN_JOBS: 'open-jobs',
  UNPAID_INVOICES: 'unpaid-invoices',
  ESTIMATES_WAITING: 'estimates-waiting',
  PARTS_LATE: 'parts-late',
  BANK_UNMATCHED: 'bank-unmatched',
  FOLLOW_UPS_DUE: 'follow-ups-due',
};

/**
 * The close this morning is measured against.
 *
 * The most recent one for this site, whatever day it falls on -- not
 * yesterday's specifically, because a workshop shut on Sunday opens on Monday
 * against Saturday's close and that is the right comparison. A close older
 * than a week is not a night any more, and saying "nobody closed" is more
 * honest than comparing this morning with a fortnight ago.
 */
async function lastClose(orgId: string, locationId: string, now: Date) {
  return prisma.dayClose.findFirst({
    where: {
      orgId,
      locationId,
      on: { gte: new Date(new Date(now.getTime() - 7 * DAY).toISOString().slice(0, 10)) },
    },
    orderBy: { on: 'desc' },
    include: { closedBy: { select: { name: true } }, readings: true },
  });
}

/**
 * Last night's figures against this morning's.
 *
 * The sentences come from today's reading rather than from the close, because
 * the close stored counts and not prose -- which was the right decision there
 * and means the words have to be re-made here. They describe what is true now,
 * which is what somebody reading at eight in the morning wants.
 */
export async function theNight(
  orgId: string,
  locationId: string | null,
  currency: string,
  now = new Date(),
) {
  const close = locationId ? await lastClose(orgId, locationId, now) : null;
  const today = await theEndOfTheDay(orgId, locationId, currency, now);

  const since: SinceWhen = close
    ? { kind: 'close', at: close.closedAt, by: close.closedBy.name }
    : { kind: 'nobody-closed', at: now };

  if (!close) return theHandover(since, []);

  const was = new Map<CloseReadingKind, number>();
  for (const reading of close.readings) {
    const kind = FROM_DB[reading.kind];
    if (kind) was.set(kind, reading.count);
  }

  const lines: HandoverLine[] = today.readings.map((reading) => {
    const before = was.get(reading.kind) ?? 0;
    return {
      kind: reading.kind,
      was: before,
      is: reading.count,
      move: howItMoved(before, reading.count),
      what: reading.what,
      href: reading.href,
    };
  });

  return theHandover(since, lines);
}

/* ---------------------------------------------------------------------------
   What came in while nobody was here
   --------------------------------------------------------------------------- */

export interface Arrived {
  kind:
    | 'estimates-decided'
    | 'payments-received'
    | 'messages-unanswered'
    | 'booked-online'
    | 'cars-claimed'
    | 'reviews-answered'
    | 'clocks-closed-for-them';
  count: number;
  what: { key: string; vars?: Record<string, string | number> };
  href: string;
}

/**
 * Everything that arrived between the close and now.
 *
 * Each of these is a thing a customer or a machine did while the building was
 * empty. None of them is in `/morning`, which is about what to do today, and
 * none is in the close, which is about what was left.
 */
export async function whatArrived(orgId: string, since: Date, now = new Date()) {
  const [decided, payments, messages, booked, claims, reviews, autoClosed] = await Promise.all([
    // bounded: the window, which is one night.
    prisma.estimate.count({
      where: { orgId, decidedAt: { gte: since, lte: now } },
    }),

    prisma.payment.count({
      where: { orgId, method: 'ONLINE', receivedAt: { gte: since, lte: now } },
    }),

    // Not "arrived overnight" but "arrived overnight and nobody has answered
    // it", which is the only version worth a row at eight in the morning.
    prisma.inboundMessage.count({
      where: { orgId, receivedAt: { gte: since, lte: now }, handledAt: null },
    }),

    // `ONLINE` and not `PORTAL`: a booking taken through the portal is
    // scheduled like any other and `source` records only that nobody keyed it
    // in. `PORTAL` is a message channel in this schema, never a booking source.
    prisma.booking.count({
      where: { orgId, source: 'ONLINE', createdAt: { gte: since, lte: now } },
    }),

    prisma.vehicleClaim.count({
      where: { orgId, status: 'PENDING', askedAt: { gte: since, lte: now } },
    }),

    prisma.reviewRequest.count({
      where: { orgId, respondedAt: { gte: since, lte: now } },
    }),

    // The hourly sweeper closes a clock somebody left running and flags it,
    // with a comment in `packages/jobs` saying a manager should see it. Until
    // now nothing showed it to anybody, which is as good as not recording it.
    prisma.timeEntry.count({
      where: {
        job: { orgId },
        autoClosed: true,
        endedAt: { gte: since, lte: now },
      },
    }),
  ]);

  const rows: Arrived[] = [
    {
      kind: 'messages-unanswered',
      count: messages,
      what:
        messages === 1
          ? { key: '1 message came in and nobody has answered it.' }
          : {
              key: '{count} messages came in and nobody has answered them.',
              vars: { count: messages },
            },
      href: '/inbox',
    },
    {
      kind: 'estimates-decided',
      count: decided,
      what:
        decided === 1
          ? { key: '1 customer answered an estimate.' }
          : { key: '{count} customers answered an estimate.', vars: { count: decided } },
      href: '/estimates',
    },
    {
      kind: 'booked-online',
      count: booked,
      what:
        booked === 1
          ? { key: '1 booking was made online.' }
          : { key: '{count} bookings were made online.', vars: { count: booked } },
      href: '/diary',
    },
    {
      kind: 'payments-received',
      count: payments,
      what:
        payments === 1
          ? { key: '1 payment came in by card.' }
          : { key: '{count} payments came in by card.', vars: { count: payments } },
      href: '/payments',
    },
    {
      kind: 'cars-claimed',
      count: claims,
      what:
        claims === 1
          ? { key: '1 driver asked to claim a car.' }
          : { key: '{count} drivers asked to claim a car.', vars: { count: claims } },
      href: '/claims',
    },
    {
      kind: 'reviews-answered',
      count: reviews,
      what:
        reviews === 1
          ? { key: '1 customer left a review.' }
          : { key: '{count} customers left a review.', vars: { count: reviews } },
      href: '/reputation',
    },
    {
      kind: 'clocks-closed-for-them',
      count: autoClosed,
      what:
        autoClosed === 1
          ? { key: '1 clock was left running and was closed automatically.' }
          : {
              key: '{count} clocks were left running and were closed automatically.',
              vars: { count: autoClosed },
            },
      href: '/people',
    },
  ];

  return rows.filter((row) => row.count > 0);
}

/* ---------------------------------------------------------------------------
   Who is expected, and who is here
   --------------------------------------------------------------------------- */

/**
 * The rota against the clock.
 *
 * `WorkingPattern` is per weekday rather than per date, so "expected today" is
 * a pattern for today's weekday, less an approved absence covering today. That
 * is how `planning.ts` has computed capacity since Phase 48, and using the same
 * two tables means the morning screen and the capacity arithmetic cannot
 * disagree about who was meant to be in.
 */
export async function whoIsInToday(
  orgId: string,
  locationId: string | null,
  timezone: string,
  now = new Date(),
) {
  const today = businessDay(now, timezone, 0);
  const from = new Date(`${today}T00:00:00Z`);
  const to = new Date(`${today}T23:59:59Z`);
  // ISO weekday: the schema stores 1 = Monday through 7 = Sunday.
  const weekday = ((from.getUTCDay() + 6) % 7) + 1;

  const [employees, patterns, absences, attendance] = await Promise.all([
    prisma.employee.findMany({
      where: { orgId, isActive: true, ...(locationId ? { locationId } : {}) },
      select: { id: true, displayName: true },
    }),
    prisma.workingPattern.findMany({ where: { orgId, weekday }, select: { employeeId: true } }),
    prisma.absence.findMany({
      where: { orgId, approved: true, startsOn: { lte: to }, endsOn: { gte: from } },
      select: { employeeId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { employee: { orgId }, endedAt: null, ...(locationId ? { locationId } : {}) },
      select: { employeeId: true },
    }),
  ]);

  const byId = new Map(employees.map((one) => [one.id, one.displayName]));
  const away = new Set(absences.map((one) => one.employeeId));

  const expected = patterns
    .filter((one) => byId.has(one.employeeId) && !away.has(one.employeeId))
    .map((one) => ({ employeeId: one.employeeId, name: byId.get(one.employeeId)! }));

  const here = attendance
    .filter((one) => byId.has(one.employeeId))
    .map((one) => ({ employeeId: one.employeeId, name: byId.get(one.employeeId)! }));

  return whoIsIn(expected, here);
}
