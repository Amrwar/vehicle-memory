import {
  A_BOARD,
  businessDay,
  howTheTowerLooks,
  isInShop,
  type JobStanding,
  minutesSince,
  needsSomebody,
  type PartInTheWay,
  partsInTheWayFirst,
  partStandingOf,
  type Risk,
  type Say,
  startOfDayIn,
  type TheBuilding,
  type TheCustomers,
  type TheDay,
  type TheMoney,
  theRisk,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { doNotMiss } from './do-not-miss';
import { ownerDay } from './owner';
import { capacityOn } from './planning';
import { whoIsInToday } from './start-of-day';
import { whereJobsStand } from './standing';

/**
 * The control tower: the figures. Phase 98, and item 39 of the thirty-nine.
 *
 * Six questions, and the order is the order a tower answers them in:
 *
 *   1. What is in the building, and what blocks each of it.
 *   2. What today can hold, and who is here to do it.
 *   3. The money: taken, to invoice, owed, overdue.
 *   4. Who is waiting on us, and for how long.
 *   5. Which parts are holding up cars that are already on the ramps.
 *   6. What is going to go wrong before the doors shut.
 *
 * **Nothing here is stored and nothing here is a second opinion.** The
 * building is read off `whereJobsStand`, which is what the `/now` board and
 * the band on every job's page already read, so the tower cannot say a car is
 * waiting on a supplier while the job says it is ours. Capacity is
 * `capacityOn`, which is what the planner uses. The rota is `whoIsInToday`,
 * which is what opening up reads. The morning's list is `doNotMiss`. The
 * rules — what counts as a risk, in what order, and what the sentence at the
 * top says — are in core, with the tests.
 *
 * **It refreshes itself.** A figure that was true at eight is not evidence of
 * anything at eleven, and the person reading it is not going to press a key
 * every few minutes to find out. The page re-reads every five minutes while
 * it is visible and says when it last did.
 */

const DAY = 24 * 60 * 60_000;

/** How long a booked car may be overdue before it is "not arrived". */
const ARRIVAL_GRACE = 30 * 60_000;

/* ---------------------------------------------------------------------------
   One. In the building
   --------------------------------------------------------------------------- */

async function theBuilding(orgId: string, now: Date): Promise<TheBuilding> {
  const jobs = (await whereJobsStand(orgId, { now })).filter((job) => isInShop(job.status));

  const count = (move: JobStanding['move']) =>
    jobs.filter((job) => job.standing.move === move).length;

  const blocked = jobs.filter((job) => needsSomebody(job.standing));

  return {
    inShop: jobs.length,
    ours: count('us'),
    customer: count('customer'),
    supplier: count('supplier'),
    nobody: count('nobody'),
    late: jobs.filter((job) => job.standing.late).length,
    blocked: blocked.slice(0, A_BOARD).map((job) => ({
      id: job.id,
      number: job.number,
      what: job.what,
      who: job.who,
      vehicle: job.vehicle,
      registration: job.registration,
      standing: job.standing,
    })),
    more: Math.max(0, blocked.length - A_BOARD),
  };
}

/* ---------------------------------------------------------------------------
   Two. What today can hold
   --------------------------------------------------------------------------- */

async function theDay(
  orgId: string,
  locationId: string | null,
  timezone: string,
  now: Date,
  from: Date,
  to: Date,
): Promise<TheDay> {
  const [capacity, who, bookings] = await Promise.all([
    capacityOn(orgId, locationId, now),
    whoIsInToday(orgId, locationId, timezone, now),
    // bounded: one day of one workshop's diary.
    prisma.booking.findMany({
      where: {
        orgId,
        ...(locationId ? { locationId } : {}),
        startAt: { gte: from, lt: to },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'CONVERTED'] },
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        startAt: true,
        status: true,
        customer: { select: { displayName: true } },
        vehicle: { select: { make: true, model: true, registration: true } },
      },
    }),
  ]);

  const grace = new Date(now.getTime() - ARRIVAL_GRACE);

  return {
    bookedMinutes: capacity.bookedMinutes,
    effectiveMinutes: capacity.effectiveMinutes,
    overbookedMinutes: capacity.overbookedMinutes,
    constrainedBy: capacity.constrainedBy,
    expected: who.expected.length,
    here: who.here.length,
    notIn: who.notYet.map((one) => one.name),
    booked: bookings.length,
    nextAt: bookings.find((one) => one.startAt > now)?.startAt ?? null,
    notArrived: bookings
      .filter(
        (one) => one.startAt < grace && (one.status === 'SCHEDULED' || one.status === 'CONFIRMED'),
      )
      .map((one) => ({
        id: one.id,
        startAt: one.startAt,
        who: one.customer.displayName,
        vehicle: `${one.vehicle.make} ${one.vehicle.model}`.trim(),
        registration: one.vehicle.registration,
      })),
  };
}

/* ---------------------------------------------------------------------------
   Three. The money
   --------------------------------------------------------------------------- */

async function theMoney(orgId: string, now: Date, from: Date, to: Date): Promise<TheMoney> {
  const [taken, unbilled, day] = await Promise.all([
    prisma.payment.aggregate({
      where: { orgId, receivedAt: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    // Finished work with no bill against it. The approved estimate's total
    // stands in for the invoice that does not exist yet; where there is no
    // estimate either, the count still says there is work to bill.
    // bounded: completed and uninvoiced is a day or two of one workshop's
    // output, and the take.
    prisma.job.findMany({
      where: {
        orgId,
        status: 'COMPLETED',
        invoices: { none: { status: { not: 'VOID' } } },
      },
      take: 50,
      select: {
        estimates: {
          where: { status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] } },
          orderBy: { version: 'desc' },
          take: 1,
          select: { total: true },
        },
      },
    }),
    ownerDay(orgId, now),
  ]);

  return {
    takenToday: Number(taken._sum.amount ?? 0),
    toInvoice: unbilled.reduce((sum, job) => sum + Number(job.estimates[0]?.total ?? 0), 0),
    toInvoiceCount: unbilled.length,
    owed: day.owed,
    overdue: day.overdue,
    overdueCount: day.overdueCount,
  };
}

/* ---------------------------------------------------------------------------
   Four. Who is waiting on us
   --------------------------------------------------------------------------- */

async function theCustomers(orgId: string, now: Date): Promise<TheCustomers> {
  const [deciding, oldestDeciding, unanswered, oldestUnanswered, ready] = await Promise.all([
    prisma.job.count({ where: { orgId, status: 'AWAITING_APPROVAL' } }),
    prisma.estimate.findFirst({
      where: { orgId, status: 'SENT', job: { status: 'AWAITING_APPROVAL' } },
      orderBy: { sentAt: 'asc' },
      select: { sentAt: true },
    }),
    prisma.inboundMessage.count({ where: { orgId, handledAt: null } }),
    prisma.inboundMessage.findFirst({
      where: { orgId, handledAt: null },
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    }),
    // bounded: finished and not collected is the cars on the forecourt, and
    // the take.
    prisma.job.findMany({
      where: {
        orgId,
        status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
        collectedAt: null,
      },
      take: 100,
      select: { status: true },
    }),
  ]);

  const since = (at: Date | null | undefined) => (at ? minutesSince(at, now) : null);

  return {
    deciding,
    decidingLongestMinutes: since(oldestDeciding?.sentAt),
    unanswered,
    unansweredLongestMinutes: since(oldestUnanswered?.receivedAt),
    readyToCollect: ready.length,
    readyAndUnpaid: ready.filter((job) => job.status !== 'PAID').length,
  };
}

/* ---------------------------------------------------------------------------
   Five. Parts holding up cars in the building
   --------------------------------------------------------------------------- */

/**
 * A part line says `ON_ORDER` and nothing else: the schema does not tie a job's
 * part to the purchase order it went on. The order is found by the product,
 * among the orders still open with some of it still to come, earliest
 * expected first — which is the order the stores would look at too.
 */
async function thePartsInTheWay(orgId: string, now: Date, to: Date): Promise<PartInTheWay[]> {
  // bounded: parts on order for cars in the building, and the take.
  const lines = await prisma.jobPartLine.findMany({
    where: {
      status: 'ON_ORDER',
      job: {
        orgId,
        status: {
          in: [
            'RECEIVED',
            'INSPECTING',
            'DIAGNOSED',
            'ESTIMATED',
            'AWAITING_APPROVAL',
            'APPROVED',
            'IN_PROGRESS',
            'QUALITY_CHECK',
          ],
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      productId: true,
      description: true,
      job: {
        select: {
          id: true,
          number: true,
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
    },
  });

  const productIds = [...new Set(lines.map((line) => line.productId).filter(Boolean))] as string[];

  const orders =
    productIds.length === 0
      ? []
      : // bounded: open orders carrying one of those products, and the take.
        await prisma.purchaseOrder.findMany({
          where: {
            orgId,
            status: { in: ['SENT', 'PART_RECEIVED'] },
            lines: { some: { productId: { in: productIds } } },
          },
          orderBy: { expectedAt: 'asc' },
          take: 50,
          select: {
            id: true,
            expectedAt: true,
            supplier: { select: { name: true } },
            lines: { select: { productId: true, quantity: true, received: true } },
          },
        });

  const orderFor = new Map<string, (typeof orders)[number]>();
  for (const order of orders) {
    for (const line of order.lines) {
      if (!line.productId || orderFor.has(line.productId)) continue;
      if (Number(line.quantity) <= Number(line.received)) continue;
      orderFor.set(line.productId, order);
    }
  }

  return partsInTheWayFirst(
    lines.map((line) => {
      const order = line.productId ? orderFor.get(line.productId) : undefined;
      const expectedAt = order?.expectedAt ?? null;
      return {
        jobId: line.job.id,
        number: line.job.number,
        vehicle: line.job.vehicle ? `${line.job.vehicle.make} ${line.job.vehicle.model}` : null,
        registration: line.job.vehicle?.registration ?? null,
        part: line.description,
        supplier: order?.supplier.name ?? null,
        orderId: order?.id ?? null,
        expectedAt,
        standing: partStandingOf({ ordered: Boolean(order), expectedAt, now, endOfDay: to }),
      };
    }),
  );
}

/* ---------------------------------------------------------------------------
   The tower
   --------------------------------------------------------------------------- */

export interface Tower {
  asOf: Date;
  /** The workshop's own day, on its own clock: what "today" means above. */
  window: { from: Date; to: Date };
  building: TheBuilding;
  day: TheDay;
  money: TheMoney;
  customers: TheCustomers;
  parts: PartInTheWay[];
  risk: Risk[];
  /** Everything above, for a reader who wants one sentence. */
  headline: Say;
}

export async function theTower(
  orgId: string,
  locationId: string | null,
  timezone: string,
  now = new Date(),
): Promise<Tower> {
  const today = businessDay(now, timezone, 0);
  const from = startOfDayIn(today, timezone);
  const to = new Date(from.getTime() + DAY);

  const [building, day, money, customers, parts, promisedToday, morning] = await Promise.all([
    theBuilding(orgId, now),
    theDay(orgId, locationId, timezone, now, from, to),
    theMoney(orgId, now, from, to),
    theCustomers(orgId, now),
    thePartsInTheWay(orgId, now, to),
    // Promised back before the end of today and not yet finished. Past the
    // promise is counted apart, in the building, and not again here.
    prisma.job.count({
      where: {
        orgId,
        promisedAt: { gte: now, lt: to },
        status: { notIn: ['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'] },
      },
    }),
    doNotMiss(orgId, now),
  ]);

  const risk = theRisk({
    building,
    day,
    customers,
    parts,
    promisedToday,
    morning: { clear: morning.clear, total: morning.items.length + morning.more },
  });

  return {
    asOf: now,
    window: { from, to },
    building,
    day,
    money,
    customers,
    parts,
    risk,
    headline: howTheTowerLooks(building, risk),
  };
}
