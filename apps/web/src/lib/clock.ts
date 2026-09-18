import { type Measured, type Stretch } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * The workshop's own clock, from the records it already keeps. Phase 52.
 *
 * Every stretch below is two timestamps the product writes because it needed
 * them for something else — when the car arrived, when the estimate was sent,
 * when the part was ordered. Nothing is instrumented specially, and that is
 * the point: a number that exists only to be measured is a number somebody
 * eventually manages, and one taken from the records of the work itself
 * cannot be.
 *
 * The targets are judgements. None of them come from a requirement, and each
 * says what it is based on so that disagreeing with one is a conversation
 * about the reason rather than about the number.
 */

export const STRETCHES: Record<string, Stretch> = {
  arrival: {
    name: 'Car in to job open',
    span: 'From the car arriving to the job being written.',
    target: 15 * 60,
    because: `A car on the forecourt with no job against it is work nobody can see, and a quarter of an hour is long enough to find the keys and the customer.`,
  },
  inspection: {
    name: 'Inspection, start to finish',
    span: 'From the inspection being started to it being completed.',
    target: 45 * 60,
    because: `A full check with photographs, without rushing it.`,
  },
  quoting: {
    name: 'Findings to quote sent',
    span: 'From the inspection being completed to the estimate going out.',
    target: 60 * 60,
    because: `The customer is waiting and the car is on the ramp; an hour is the point at which the ramp is the cost.`,
  },
  approval: {
    name: 'Quote sent to answered',
    span: 'From the estimate going out to the customer deciding.',
    target: 4 * 3_600,
    because: `Mostly the customer’s time rather than the workshop’s — which is exactly why it is worth watching, because a quote that takes two days to answer is usually one that was hard to read.`,
  },
  ordering: {
    name: 'Part needed to part ordered',
    span: 'From the shortfall raising a request to the order being sent.',
    target: 2 * 3_600,
    because: `A job stopped for a part is a bay not earning, and ordering is a few minutes of somebody’s attention.`,
  },
  onTheRamp: {
    name: 'Work started to finished',
    span: 'From the work being started to it being completed.',
    target: 8 * 3_600,
    because: `A working day. Longer is not wrong, but it means the car stayed overnight, and a workshop should know how often that happens.`,
  },
  collection: {
    name: 'Finished to collected',
    span: 'From the job being completed to the car leaving.',
    target: 24 * 3_600,
    because: `A finished car occupying a space is the most expensive kind of storage there is.`,
  },
  billing: {
    name: 'Finished to invoiced',
    span: 'From the job being completed to the invoice being issued.',
    target: 2 * 3_600,
    because: `An invoice not written is money not asked for, and the details are freshest on the day.`,
  },
  paid: {
    name: 'Invoiced to paid',
    span: 'From the invoice being issued to the money arriving.',
    target: 7 * 86_400,
    because: `Most work is paid on collection; this is the figure that says how much is not.`,
  },
};

/** Seconds between two moments, or nothing when either is missing. */
function gap(from: Date | null | undefined, to: Date | null | undefined): number | null {
  if (!from || !to) return null;

  const seconds = Math.round((to.getTime() - from.getTime()) / 1000);

  // A negative gap is a clock or a correction, not a fast workshop. Counting
  // it would quietly pull a median down, which is the worst way for a figure
  // to be wrong: nobody goes looking for a number that improved.
  return seconds >= 0 ? seconds : null;
}

function collect(
  stretch: Stretch,
  rows: readonly { from: Date | null; to: Date | null }[],
): Measured {
  const samples: number[] = [];

  for (const row of rows) {
    const seconds = gap(row.from, row.to);
    if (seconds !== null) samples.push(seconds);
  }

  return { stretch, samples, candidates: rows.length };
}

/**
 * Every stretch, for one workshop, over a window.
 *
 * The window matters for the comparison the phase exists for: a figure from
 * the month before a pilot and a figure from the month after are only worth
 * putting beside each other if they cover the same length of time.
 */
export async function workshopClock(
  orgId: string,
  since: Date,
  until = new Date(),
): Promise<Measured[]> {
  const window = { gte: since, lte: until };

  const [jobs, inspections, estimates, requests, invoices] = await Promise.all([
    prisma.job.findMany({
      where: { orgId, createdAt: window },
      select: {
        receivedAt: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        collectedAt: true,
        invoicedAt: true,
      },
    }),
    prisma.inspection.findMany({
      where: { job: { orgId }, startedAt: window },
      select: {
        startedAt: true,
        completedAt: true,
        job: {
          select: {
            estimates: { orderBy: { createdAt: 'asc' }, take: 1, select: { sentAt: true } },
          },
        },
      },
    }),
    prisma.estimate.findMany({
      where: { orgId, sentAt: window },
      select: { sentAt: true, decidedAt: true },
    }),
    prisma.purchaseRequest.findMany({
      where: { orgId, createdAt: window },
      select: {
        createdAt: true,
        orders: { orderBy: { createdAt: 'asc' }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { orgId, issuedAt: window },
      select: {
        issuedAt: true,
        payments: { orderBy: { receivedAt: 'asc' }, take: 1, select: { receivedAt: true } },
      },
    }),
  ]);

  return [
    collect(
      STRETCHES.arrival!,
      jobs.map((job) => ({ from: job.receivedAt, to: job.createdAt })),
    ),
    collect(
      STRETCHES.inspection!,
      inspections.map((one) => ({ from: one.startedAt, to: one.completedAt })),
    ),
    collect(
      STRETCHES.quoting!,
      inspections.map((one) => ({
        from: one.completedAt,
        to: one.job.estimates[0]?.sentAt ?? null,
      })),
    ),
    collect(
      STRETCHES.approval!,
      estimates.map((one) => ({ from: one.sentAt, to: one.decidedAt })),
    ),
    collect(
      STRETCHES.ordering!,
      requests.map((one) => ({
        from: one.createdAt,
        to: one.orders[0]?.createdAt ?? null,
      })),
    ),
    collect(
      STRETCHES.onTheRamp!,
      jobs.map((job) => ({ from: job.startedAt, to: job.completedAt })),
    ),
    collect(
      STRETCHES.collection!,
      jobs.map((job) => ({ from: job.completedAt, to: job.collectedAt })),
    ),
    collect(
      STRETCHES.billing!,
      jobs.map((job) => ({ from: job.completedAt, to: job.invoicedAt })),
    ),
    collect(
      STRETCHES.paid!,
      invoices.map((one) => ({
        from: one.issuedAt,
        to: one.payments[0]?.receivedAt ?? null,
      })),
    ),
  ];
}
