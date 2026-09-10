import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * What a technician can actually do from the tablet.
 *
 * Every control on the shop floor screen used to be inert: start and stop the
 * clock, open an inspection, request a part. Four buttons and a link, none of
 * them wired to anything. This is the layer behind them.
 *
 * The clock is the one that matters most, because every labour cost, every
 * utilisation figure and every job profit in the product is built on time
 * entries, and until now the only way one got written was the seed.
 */

export class ShopFloorError extends Error {
  readonly code: 'NOT_YOURS' | 'BLOCKED' | 'NOTHING_OPEN';

  constructor(code: ShopFloorError['code'], message: string) {
    super(message);
    this.name = 'ShopFloorError';
    this.code = code;
  }
}

/** Statuses where the technician must not start work yet. */
const BLOCKED: string[] = ['ESTIMATED', 'AWAITING_APPROVAL', 'CANCELLED', 'PAID', 'INVOICED'];

/**
 * Starts the clock on a job, or stops it if it is already running.
 *
 * One control rather than two, because the technician's question is never
 * "should I press start or stop", it is "am I on this job or not", and the
 * screen already tells them which.
 *
 * Starting a job closes any other open entry for the same person first. A
 * technician who walks from one car to another does not stop at the tablet on
 * the way, and two open clocks means both jobs are charged for the same hour.
 */
export async function toggleClock(input: { orgId: string; userId: string; jobId: string }) {
  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, status: true, number: true },
  });

  const open = await prisma.timeEntry.findFirst({
    where: { jobId: job.id, userId: input.userId, endedAt: null },
    select: { id: true, startedAt: true },
  });

  if (open) {
    const endedAt = new Date();
    const minutes = Math.max(
      1,
      Math.round((endedAt.getTime() - open.startedAt.getTime()) / 60_000),
    );

    await prisma.timeEntry.update({
      where: { id: open.id },
      data: { endedAt, minutes },
    });

    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'job.clock.stopped',
      entityType: 'Job',
      entityId: job.id,
      after: { minutes },
    });

    return { running: false, minutes };
  }

  if (BLOCKED.includes(job.status)) {
    throw new ShopFloorError(
      'BLOCKED',
      'This job is waiting on the customer. Starting work now risks doing something they have not agreed to pay for.',
    );
  }

  // Whatever else this person had running, they are not doing it any more.
  const others = await prisma.timeEntry.findMany({
    where: { userId: input.userId, endedAt: null },
    select: { id: true, startedAt: true },
  });

  for (const other of others) {
    await prisma.timeEntry.update({
      where: { id: other.id },
      data: {
        endedAt: new Date(),
        minutes: Math.max(1, Math.round((Date.now() - other.startedAt.getTime()) / 60_000)),
        note: 'Closed automatically when another job was started.',
      },
    });
  }

  const rate = await prisma.employee.findFirst({
    where: { orgId: input.orgId, userId: input.userId },
    select: {
      payRates: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: { costPerHour: true },
      },
    },
  });

  await prisma.timeEntry.create({
    data: {
      jobId: job.id,
      userId: input.userId,
      startedAt: new Date(),
      // Captured now, not read at reporting time. A pay rise next year must
      // not rewrite what this hour cost.
      costRate: rate?.payRates[0]?.costPerHour ?? null,
    },
  });

  // Work has started, so the job says so rather than waiting for somebody at
  // the front desk to notice.
  if (job.status === 'APPROVED' || job.status === 'RECEIVED') {
    await prisma.job.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.clock.started',
    entityType: 'Job',
    entityId: job.id,
    after: { closedOthers: others.length },
  });

  return { running: true, minutes: 0 };
}

/**
 * A part wanted for a job, raised from the floor.
 *
 * Deliberately a request rather than an order. The technician knows what the
 * car needs and does not know what the workshop can spend, and the approval
 * threshold that already governs purchasing is the right place for that
 * decision.
 */
export async function requestPart(input: {
  orgId: string;
  userId: string;
  jobId: string;
  notes: string;
}) {
  const job = await prisma.job.findFirstOrThrow({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, number: true },
  });

  const request = await prisma.purchaseRequest.create({
    data: {
      orgId: input.orgId,
      jobId: job.id,
      requestedByUserId: input.userId,
      status: 'PENDING',
      notes: input.notes.trim(),
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'purchase.requested',
    entityType: 'PurchaseRequest',
    entityId: request.id,
    after: { jobNumber: job.number, notes: input.notes.trim() },
  });

  return request.id;
}

/** Whether this person's clock is running, and on which job. */
export async function openEntryFor(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    select: { id: true, jobId: true, startedAt: true },
  });
}
