import { blocks, type MissItem, theMorning } from '@carnet/core';
import { prisma } from '@carnet/db';

import { theMachines } from './equipment';
import { diaryTrouble } from './equipment-diary';
import { whereJobsStand } from './standing';

/**
 * The morning, gathered from what the product already knows.
 *
 * Nothing here is stored and nothing is new. Every item is a question the
 * product could already answer, asked at eight in the morning instead of when
 * somebody happens to open the right screen — which is the whole of the
 * feature, because the screens were never the problem.
 *
 * Phase 84 is why most of it is possible at all: `JobStanding.next` has named
 * the single next thing for every open job since then, so the jobs arrive fit
 * for a list whose rule is one action each, without anything being invented
 * here.
 *
 * Every sentence travels as a key and its values. A formatted English string
 * assembled in a library is a string no screen can translate, and this product
 * has three languages.
 *
 * Phase 95.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Machines that cannot be used and are needed by work somebody has booked. */
async function unusableMachines(orgId: string, now: Date): Promise<MissItem[]> {
  const machines = await theMachines(orgId, now);

  return machines
    .filter((machine) => blocks(machine.state) && machine.state !== 'RETIRED')
    .filter((machine) => machine.neededBy.length > 0)
    .map((machine) => ({
      kind: 'equipment-unusable' as const,
      id: `equipment:${machine.id}`,
      what: {
        key: '{machine} cannot be used, and {work} needs it',
        vars: { machine: machine.name, work: machine.neededBy.join(', ') },
      },
      action: { key: 'Put it right' },
      href: `/equipment/${machine.id}`,
      cost: 'SAFETY' as const,
      when: machine.outOfServiceSince ?? machine.certificateExpiresAt ?? null,
    }));
}

/** Certificates running out, while there is still time to book the engineer. */
async function lapsingCertificates(
  trouble: Awaited<ReturnType<typeof diaryTrouble>>,
): Promise<MissItem[]> {
  return trouble.lapsing.map((one) => ({
    kind: 'certificate-lapsing' as const,
    id: `certificate:${one.equipmentId}`,
    // The date is on the row rather than in the sentence. It was
    // `toISOString().slice(0, 10)` here, which is nobody's way of writing a
    // date and is a date in one language besides -- and the screen, which
    // knows the reader, formats the column already.
    what: { key: '{machine}’s certificate runs out', vars: { machine: one.name } },
    action: { key: 'Book the engineer' },
    href: `/equipment/${one.equipmentId}`,
    cost: 'SAFETY' as const,
    when: one.on,
  }));
}

/** Bookings the workshop cannot keep, while moving one is still a phone call. */
async function unkeepableBookings(
  trouble: Awaited<ReturnType<typeof diaryTrouble>>,
): Promise<MissItem[]> {
  return trouble.clashes.map((clash) => ({
    kind: 'booking-cannot-be-kept' as const,
    id: `booking:${clash.bookingId}:${clash.equipmentId}:${clash.kind}`,
    what:
      clash.kind === 'DOUBLE_BOOKED'
        ? {
            key: '{what}: {machine} is already promised to somebody else',
            vars: { what: clash.label, machine: clash.machineName },
          }
        : {
            key: '{what}: {machine} will not be usable that day',
            vars: { what: clash.label, machine: clash.machineName },
          },
    action: { key: 'Move the booking' },
    href: '/plan',
    cost: 'A_PROMISE' as const,
    when: clash.startAt,
  }));
}

/**
 * Jobs that are late or promised today and still the workshop's move.
 *
 * `JobStanding.next` already names the one thing to do for each, which is why
 * these arrive fit for this list without anything being invented. Where it
 * names nothing the job is dropped rather than given a made-up action: an item
 * with no action is exactly what `isOneAction` exists to refuse, and inventing
 * one here would be smuggling it past the rule.
 */
async function jobsWorthWorryingAbout(orgId: string, now: Date): Promise<MissItem[]> {
  const jobs = await whereJobsStand(orgId, { now });

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  return jobs.flatMap<MissItem>((job) => {
    const standing = job.standing;
    if (standing.move !== 'us' || !standing.next) return [];

    const dueToday = job.promisedAt !== null && job.promisedAt.getTime() <= endOfToday.getTime();
    if (!standing.late && !dueToday) return [];

    // An estimate nobody sent is its own kind. The action is different, and
    // Phase 84 found one sitting in the seeded data reading as the customer
    // being slow when it was the workshop's own omission.
    const neverSent = standing.reason.key.includes('has not been sent');

    return [
      {
        kind: neverSent
          ? ('estimate-never-sent' as const)
          : standing.late
            ? ('job-late' as const)
            : ('job-promised-today' as const),
        id: `job:${job.id}`,
        subject: `#${job.number} ${job.registration ?? job.vehicle ?? ''}`.trim(),
        // The reason, whole, with its own vars. It used to be interpolated
        // into a sentence of this library's own, which left it in English on a
        // French page and dropped the `{amount}` out of the ones that have one.
        what: standing.reason,
        action: standing.next,
        href: `/jobs/${job.id}`,
        cost: 'A_PROMISE' as const,
        when: job.promisedAt ?? null,
      },
    ];
  });
}

/** Jobs finished and waiting on a sign-off nobody has done. */
async function outstandingChecks(orgId: string): Promise<MissItem[]> {
  // bounded: jobs sitting in the sign-off queue. A workshop with twenty of
  // these has a different problem, and the cap says so rather than scrolling.
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      status: 'QUALITY_CHECK',
      jobTypes: { some: { jobType: { requiresQualityCheck: true } } },
      qualityChecks: { none: { passed: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 20,
    select: {
      id: true,
      number: true,
      shortDescription: true,
      updatedAt: true,
      vehicle: { select: { registration: true } },
    },
  });

  return jobs.map((job) => ({
    kind: 'quality-check-outstanding' as const,
    id: `check:${job.id}`,
    what: {
      key: '#{number} {vehicle} is finished and not signed off',
      vars: { number: job.number, vehicle: job.vehicle.registration ?? job.shortDescription },
    },
    action: { key: 'Sign it off' },
    href: `/jobs/${job.id}`,
    cost: 'A_PROMISE' as const,
    when: job.updatedAt,
  }));
}

/**
 * Money somebody has to chase, while chasing still works.
 *
 * Nothing older than ninety days. An invoice that far gone is a fact rather
 * than a thing to miss -- whatever happens to it will not happen because of a
 * list this morning -- and a list that carried every one of them would never
 * be finished, which is how a morning list stops being opened.
 */
async function overdueInvoices(orgId: string, now: Date): Promise<MissItem[]> {
  // bounded: by the ninety-day window and the take.
  const invoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] },
      dueAt: { lt: now, gte: new Date(now.getTime() - 90 * DAY) },
    },
    orderBy: { dueAt: 'asc' },
    take: 20,
    select: {
      id: true,
      number: true,
      dueAt: true,
      total: true,
      amountPaid: true,
      customer: { select: { displayName: true } },
    },
  });

  return invoices.map((invoice) => ({
    kind: 'invoice-overdue' as const,
    id: `invoice:${invoice.id}`,
    what: {
      key: '{customer} has not paid #{number}',
      vars: { customer: invoice.customer.displayName, number: invoice.number },
    },
    action: { key: 'Chase it' },
    href: `/invoices/${invoice.id}`,
    cost: 'MONEY' as const,
    when: invoice.dueAt,
  }));
}

/** Parts a supplier said would be here, and are not. */
async function lateParts(orgId: string, now: Date): Promise<MissItem[]> {
  // bounded: open orders past their expected date, and the take.
  const orders = await prisma.purchaseOrder.findMany({
    where: { orgId, status: { in: ['SENT', 'PART_RECEIVED'] }, expectedAt: { lt: now } },
    orderBy: { expectedAt: 'asc' },
    take: 20,
    select: {
      id: true,
      number: true,
      expectedAt: true,
      supplier: { select: { name: true } },
      lines: { select: { quantity: true, received: true } },
    },
  });

  return orders
    .filter((order) => order.lines.some((line) => Number(line.quantity) > Number(line.received)))
    .map((order) => ({
      kind: 'part-late' as const,
      id: `order:${order.id}`,
      what: {
        key: 'Order #{number} from {supplier} was due and has not arrived',
        vars: { number: order.number, supplier: order.supplier.name },
      },
      action: { key: 'Ring the supplier' },
      href: `/purchasing/${order.id}`,
      cost: 'A_PROMISE' as const,
      when: order.expectedAt,
    }));
}

/** Comebacks nobody has said why about. */
async function unexplainedComebacks(orgId: string, now: Date): Promise<MissItem[]> {
  // bounded: comebacks marked in the last two months, and the take. Older ones
  // are worth recording and are not a morning's work.
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      comebackOfJobId: { not: null },
      comebackCause: null,
      comebackMarkedAt: { gte: new Date(now.getTime() - 60 * DAY) },
    },
    orderBy: { comebackMarkedAt: 'asc' },
    take: 20,
    select: {
      id: true,
      number: true,
      comebackMarkedAt: true,
      vehicle: { select: { registration: true } },
    },
  });

  return jobs.map((job) => ({
    kind: 'comeback-unexplained' as const,
    id: `comeback:${job.id}`,
    what: {
      key: '#{number} {vehicle} came back and nobody has said why',
      vars: { number: job.number, vehicle: job.vehicle.registration ?? '' },
    },
    action: { key: 'Record the cause' },
    href: `/jobs/${job.id}`,
    cost: 'THE_RECORD' as const,
    when: job.comebackMarkedAt,
  }));
}

/**
 * Everything worth not missing, in one list.
 *
 * The sources run together rather than in turn. A morning list that takes
 * three seconds is a morning list somebody stops opening, and none of them
 * depends on another — except the two that read the same diary window, which
 * share one query rather than asking twice.
 */
export async function doNotMiss(orgId: string, now = new Date()) {
  const trouble = await diaryTrouble(orgId, { from: now, to: new Date(now.getTime() + 30 * DAY) });

  const gathered = await Promise.all([
    unusableMachines(orgId, now),
    lapsingCertificates(trouble),
    unkeepableBookings(trouble),
    jobsWorthWorryingAbout(orgId, now),
    outstandingChecks(orgId),
    overdueInvoices(orgId, now),
    lateParts(orgId, now),
    unexplainedComebacks(orgId, now),
  ]);

  return theMorning(gathered.flat());
}
