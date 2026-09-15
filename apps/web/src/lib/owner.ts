import {
  assertComebackLink,
  COMEBACK_LIMIT_DAYS,
  ComebackError,
  comebackCandidates,
  comebackRates,
  compareSuppliers,
  describePerformance,
  type FinishedJob,
  measureSupplier,
  monthlyRatings,
  performanceOverTime,
  type RatedAnswer,
  ratingTrend,
  reputationBy,
  summariseStock,
  type SupplierOrder,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The owner's day, sharpened. Phase 40.
 *
 * How much work comes back and whose, whether what customers say is moving
 * and where, who to buy a short part from, and whether a supplier is getting
 * slower. Every figure is read from records the product already holds; the
 * only thing added is the link that says a job is earlier work coming back,
 * because no rule can tell a brake job returning from the same car in for
 * tyres.
 */

export { ComebackError };

const DAY = 86_400_000;
const FINISHED = ['COMPLETED', 'INVOICED', 'PAID'] as const;

/* ------------------------------------------------------------------------- */
/* Comebacks                                                                  */
/* ------------------------------------------------------------------------- */

/** What the job page needs: the link if there is one, and what it could be linked to. */
export async function comebackFor(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      id: true,
      vehicleId: true,
      createdAt: true,
      comebackReason: true,
      comebackMarkedAt: true,
      comebackMarkedBy: { select: { name: true } },
      comebackOf: {
        select: { id: true, number: true, shortDescription: true, completedAt: true },
      },
      comebacks: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, number: true, comebackReason: true, createdAt: true },
      },
    },
  });
  if (!job) return null;

  const previous = await prisma.job.findMany({
    where: {
      orgId,
      vehicleId: job.vehicleId,
      id: { not: job.id },
      completedAt: {
        gte: new Date(job.createdAt.getTime() - COMEBACK_LIMIT_DAYS * DAY),
        lt: job.createdAt,
      },
    },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      number: true,
      vehicleId: true,
      completedAt: true,
      shortDescription: true,
      comebackOfJobId: true,
    },
  });

  const suggested = new Set(comebackCandidates(job, previous).map((entry) => entry.id));

  return {
    marked: job.comebackOf
      ? {
          original: job.comebackOf,
          reason: job.comebackReason ?? '',
          at: job.comebackMarkedAt,
          by: job.comebackMarkedBy?.name ?? null,
        }
      : null,
    cameBack: job.comebacks,
    eligible: previous
      .filter((entry) => entry.comebackOfJobId !== job.id)
      .map((entry) => ({ ...entry, suggested: suggested.has(entry.id) })),
  };
}

/** Records that a job is earlier work coming back. */
export async function markComeback(input: {
  orgId: string;
  userId: string;
  jobId: string;
  originalJobId: string;
  reason: string;
}) {
  const [job, original] = await Promise.all([
    prisma.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId },
      select: { id: true, vehicleId: true, createdAt: true },
    }),
    prisma.job.findFirst({
      where: { id: input.originalJobId, orgId: input.orgId },
      select: { id: true, number: true, vehicleId: true, completedAt: true, comebackOfJobId: true },
    }),
  ]);
  if (!job) throw new ComebackError('SAME_JOB', 'That job was not found.');
  if (!original) {
    throw new ComebackError(
      'NOT_FINISHED',
      'Choose the earlier job that this work came back from.',
    );
  }

  assertComebackLink({ job, original, reason: input.reason });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      comebackOfJobId: original.id,
      comebackReason: input.reason.trim(),
      comebackMarkedAt: new Date(),
      comebackMarkedByUserId: input.userId,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.comeback_marked',
    entityType: 'Job',
    entityId: job.id,
    after: { original: original.number, reason: input.reason.trim() },
  });
}

/** Takes the link off, for a comeback recorded by mistake. The audit log keeps that it was there. */
export async function clearComeback(input: { orgId: string; userId: string; jobId: string }) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, comebackOfJobId: true, comebackReason: true },
  });
  if (!job?.comebackOfJobId) return;

  await prisma.job.update({
    where: { id: job.id },
    data: {
      comebackOfJobId: null,
      comebackReason: null,
      comebackMarkedAt: null,
      comebackMarkedByUserId: null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.comeback_cleared',
    entityType: 'Job',
    entityId: job.id,
    before: { original: job.comebackOfJobId, reason: job.comebackReason },
  });
}

/**
 * The comeback rate over the last so many days, for the workshop, each site
 * and each technician, and the comebacks themselves. Measured on work
 * finished in the period, counted against whoever did the work that came
 * back.
 */
export async function comebackPicture(orgId: string, options: { days?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const days = options.days ?? 90;
  const since = new Date(now.getTime() - days * DAY);

  const [finished, recent] = await Promise.all([
    prisma.job.findMany({
      where: { orgId, status: { in: [...FINISHED] }, completedAt: { gte: since, lte: now } },
      select: {
        id: true,
        completedAt: true,
        location: { select: { id: true, name: true } },
        technicians: { select: { user: { select: { id: true, name: true } } } },
        _count: { select: { comebacks: true } },
      },
    }),
    prisma.job.findMany({
      where: { orgId, comebackOfJobId: { not: null }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        number: true,
        createdAt: true,
        comebackReason: true,
        vehicle: { select: { registration: true, make: true, model: true } },
        comebackOf: {
          select: {
            id: true,
            number: true,
            shortDescription: true,
            technicians: { select: { user: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const jobs: FinishedJob[] = finished.map((job) => ({
    id: job.id,
    completedAt: job.completedAt!,
    site: job.location,
    people: job.technicians.map((entry) => entry.user),
    cameBack: job._count.comebacks > 0,
  }));

  return { days, ...comebackRates(jobs), recent };
}

/* ------------------------------------------------------------------------- */
/* Reputation over time                                                       */
/* ------------------------------------------------------------------------- */

/** Answers over the last year, by month, and the last ninety days against the ninety before. */
export async function reputationTrend(orgId: string, now = new Date()) {
  const rows = await prisma.reviewRequest.findMany({
    where: {
      orgId,
      rating: { not: null },
      respondedAt: { gte: new Date(now.getTime() - 365 * DAY), lte: now },
    },
    select: {
      rating: true,
      respondedAt: true,
      job: {
        select: {
          location: { select: { id: true, name: true } },
          technicians: { select: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  const answers: RatedAnswer[] = rows.map((row) => ({
    rating: row.rating!,
    at: row.respondedAt!,
    site: row.job.location,
    people: row.job.technicians.map((entry) => entry.user),
  }));

  return {
    months: monthlyRatings(answers, 6, now),
    overall: ratingTrend(answers, { now }),
    bySite: reputationBy(answers, 'site', { now }),
    byPerson: reputationBy(answers, 'person', { now }),
  };
}

/* ------------------------------------------------------------------------- */
/* Suppliers                                                                  */
/* ------------------------------------------------------------------------- */

/** Returns that were the supplier's doing. Surplus and cores are the workshop's. */
const THEIR_FAULT = ['DEFECTIVE', 'WRONG_PART'] as const;

async function ordersBySupplier(
  orgId: string,
  where: { supplierId?: string; since: Date },
): Promise<Map<string, SupplierOrder[]>> {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      orgId,
      status: { not: 'DRAFT' },
      createdAt: { gte: where.since },
      ...(where.supplierId ? { supplierId: where.supplierId } : {}),
    },
    select: {
      supplierId: true,
      status: true,
      createdAt: true,
      expectedAt: true,
      receipts: { orderBy: { receivedAt: 'asc' }, take: 1, select: { receivedAt: true } },
      lines: { select: { quantity: true, received: true, unitCost: true } },
      returns: {
        where: { reason: { in: [...THEIR_FAULT] } },
        select: { lines: { select: { quantity: true, unitCost: true } } },
      },
    },
  });

  const out = new Map<string, SupplierOrder[]>();
  for (const order of orders) {
    const list = out.get(order.supplierId) ?? [];
    list.push({
      createdAt: order.createdAt,
      expectedAt: order.expectedAt,
      firstReceivedAt: order.receipts[0]?.receivedAt ?? null,
      ordered: order.lines.reduce((total, line) => total + Number(line.quantity), 0),
      received: order.lines.reduce((total, line) => total + Number(line.received), 0),
      receivedValue: order.lines.reduce(
        (total, line) => total + Number(line.received) * Number(line.unitCost),
        0,
      ),
      returnedValue: order.returns.reduce(
        (total, entry) =>
          total +
          entry.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0),
        0,
      ),
      closed: order.status === 'RECEIVED' || order.status === 'BILLED',
    });
    out.set(order.supplierId, list);
  }
  return out;
}

/**
 * Every active supplier side by side for one part: what they last charged
 * for it, how often they supplied it, and how they have behaved over the
 * last year on every order.
 */
export async function supplierOptionsFor(orgId: string, productId: string, now = new Date()) {
  const since = new Date(now.getTime() - 365 * DAY);
  const [suppliers, lines, orders] = await Promise.all([
    prisma.supplier.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.purchaseOrderLine.findMany({
      where: { productId, order: { orgId, status: { not: 'DRAFT' } } },
      orderBy: { order: { createdAt: 'desc' } },
      select: { unitCost: true, order: { select: { supplierId: true, createdAt: true } } },
    }),
    ordersBySupplier(orgId, { since }),
  ]);

  return compareSuppliers(
    suppliers.map((supplier) => {
      const theirs = lines.filter((line) => line.order.supplierId === supplier.id);
      return {
        id: supplier.id,
        name: supplier.name,
        lastCost: theirs[0] ? Number(theirs[0].unitCost) : null,
        lastOrderedAt: theirs[0]?.order.createdAt ?? null,
        timesSupplied: theirs.length,
        measures: measureSupplier(orders.get(supplier.id) ?? []),
      };
    }),
  );
}

/** One supplier quarter by quarter over the last year, with what changed in sentences. */
export async function supplierOverTime(orgId: string, supplierId: string, now = new Date()) {
  const quarters = 4;
  const since = new Date(
    now.getFullYear(),
    (Math.floor(now.getMonth() / 3) - (quarters - 1)) * 3,
    1,
  );
  const orders = (await ordersBySupplier(orgId, { supplierId, since })).get(supplierId) ?? [];
  const periods = performanceOverTime(orders, { now, quarters });
  return { periods, overall: measureSupplier(orders), sentences: describePerformance(periods) };
}

/* ------------------------------------------------------------------------- */
/* The dashboard's business and inventory blocks                              */
/* ------------------------------------------------------------------------- */

/**
 * What the owner reads after today: what is owed and overdue, what came
 * back, what customers are saying, and what is short, late or sitting on
 * the shelf. Each figure is a count or an amount that opens the list behind
 * it.
 */
export async function ownerDay(orgId: string, now = new Date()) {
  const [invoices, comebacks, trend, products, openOrders] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId, status: { in: ['ISSUED', 'PART_PAID', 'OVERDUE'] } },
      select: { total: true, amountPaid: true, dueAt: true },
    }),
    comebackPicture(orgId, { days: 90, now }),
    reputationTrend(orgId, now),
    prisma.product.findMany({
      where: { orgId, isActive: true, isStocked: true },
      select: {
        id: true,
        name: true,
        partNumber: true,
        reorderPoint: true,
        stockLevels: { select: { onHand: true, reserved: true, avgCost: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { orgId, status: { in: ['SENT', 'PART_RECEIVED'] } },
      select: {
        expectedAt: true,
        lines: { select: { productId: true, quantity: true, received: true } },
      },
    }),
  ]);

  let owed = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    const balance = Number(invoice.total) - Number(invoice.amountPaid);
    if (balance <= 0) continue;
    owed += balance;
    if (invoice.dueAt && invoice.dueAt < now) {
      overdue += balance;
      overdueCount += 1;
    }
  }

  const onOrder = new Map<string, number>();
  for (const order of openOrders) {
    for (const line of order.lines) {
      if (!line.productId) continue;
      const outstanding = Math.max(0, Number(line.quantity) - Number(line.received));
      onOrder.set(line.productId, (onOrder.get(line.productId) ?? 0) + outstanding);
    }
  }

  let stockValue = 0;
  const short: {
    id: string;
    name: string;
    partNumber: string;
    available: number;
    reorderPoint: number;
  }[] = [];
  for (const product of products) {
    const levels = product.stockLevels;
    const onHand = levels.reduce((total, level) => total + Number(level.onHand), 0);
    const reserved = levels.reduce((total, level) => total + Number(level.reserved), 0);
    stockValue += levels.reduce(
      (total, level) => total + Math.max(0, Number(level.onHand)) * Number(level.avgCost),
      0,
    );
    const summary = summariseStock(
      { onHand, reserved, avgCost: '0' },
      Number(product.reorderPoint),
      onOrder.get(product.id) ?? 0,
    );
    if (summary.needsOrdering && (summary.reorderPoint > 0 || summary.available <= 0)) {
      short.push({
        id: product.id,
        name: product.name,
        partNumber: product.partNumber,
        available: summary.available,
        reorderPoint: summary.reorderPoint,
      });
    }
  }
  short.sort((a, b) => a.available - a.reorderPoint - (b.available - b.reorderPoint));

  return {
    owed,
    overdue,
    overdueCount,
    comebacks: comebacks.overall,
    satisfaction: trend.overall,
    short,
    lateOrders: openOrders.filter((order) => order.expectedAt && order.expectedAt < now).length,
    stockValue,
  };
}
