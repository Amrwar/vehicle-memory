import {
  assessQuoting,
  demandProfile,
  divergences,
  durationFor,
  type HistoryFinding,
  type HistoryReading,
  inspectHistory,
  type Quoting,
  recommendReorder,
  type Sample,
  summariseHistory,
  type Usage,
  worstQuoted,
} from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * What the data supports saying, against the database.
 *
 * The rule running through this file is that a query returning too little must
 * produce a refusal rather than a small number. Everything downstream of here
 * is shown to somebody who will act on it, and a reorder point derived from
 * two movements looks exactly like one derived from two hundred.
 */

/* ---------------------------------------------------------------------------
   Mileage history
   --------------------------------------------------------------------------- */

/**
 * Everything the record can be made to say about one vehicle's mileage.
 *
 * Reads across every workshop that has ever recorded a reading, which is the
 * whole point: clocking happens between garages, and a single workshop's own
 * records are internally consistent almost by definition.
 */
export async function mileageFindings(
  vehicleId: string,
  now = new Date(),
): Promise<{ findings: HistoryFinding[]; summary: string; readings: number }> {
  const rows = await prisma.odometerReading.findMany({
    where: { vehicleId },
    orderBy: { readAt: 'asc' },
    select: {
      km: true,
      readAt: true,
      source: true,
      recordedByOrgId: true,
      org: { select: { name: true } },
    },
  });

  const readings: HistoryReading[] = rows.map((row) => ({
    km: row.km,
    readAt: row.readAt,
    source: row.source as HistoryReading['source'],
    orgId: row.recordedByOrgId,
    orgName: row.org?.name ?? null,
  }));

  const findings = inspectHistory(readings, now);

  return {
    findings,
    summary: summariseHistory(findings, readings.length),
    readings: readings.length,
  };
}

/* ---------------------------------------------------------------------------
   Stock
   --------------------------------------------------------------------------- */

/** Movements that mean a part left the shelf to be used. */
const CONSUMING = ['ISSUE', 'TRANSFER_OUT'] as const;

/**
 * How long this workshop's orders actually take to arrive.
 *
 * Measured from its own history rather than read from a field, because a
 * lead-time setting is one more thing nobody fills in, and one nobody updates
 * when a supplier gets slower. The median across recent orders, which ignores
 * the one that got lost.
 */
export async function typicalLeadTimeDays(orgId: string, fallback = 7): Promise<number> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { orgId, receipts: { some: {} } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      createdAt: true,
      receipts: { orderBy: { receivedAt: 'asc' }, take: 1, select: { receivedAt: true } },
    },
  });

  const waits = orders
    .map((order) => {
      const received = order.receipts[0]?.receivedAt;
      if (!received) return null;

      return (received.getTime() - order.createdAt.getTime()) / 86_400_000;
    })
    .filter((wait): wait is number => wait !== null && wait >= 0)
    .sort((a, b) => a - b);

  // Three orders is not a lead time. Below that the default is more honest
  // than a median of two numbers.
  if (waits.length < 3) return fallback;

  const middle = waits[Math.floor(waits.length / 2)] ?? fallback;

  return Math.max(1, Math.round(middle));
}

/**
 * Parts whose reorder point disagrees with what the shelf actually did.
 *
 * Returns only the ones worth changing. A list of every part with a
 * recommendation beside it is a list nobody reads, and the value is entirely
 * in the handful that are badly wrong.
 */
export async function stockDivergences(orgId: string, months = 12, now = new Date()) {
  const since = new Date(now.getTime() - months * 30 * 86_400_000);

  const [products, movements, leadTimeDays] = await Promise.all([
    prisma.product.findMany({
      where: { orgId, isStocked: true, isActive: true },
      select: { id: true, name: true, partNumber: true, reorderPoint: true, reorderQty: true },
    }),
    prisma.stockMovement.findMany({
      where: { orgId, type: { in: [...CONSUMING] }, createdAt: { gte: since } },
      select: { productId: true, quantity: true, createdAt: true },
    }),
    typicalLeadTimeDays(orgId),
  ]);

  const byProduct = new Map<string, Usage[]>();

  for (const movement of movements) {
    const usage = byProduct.get(movement.productId) ?? [];

    // Issues are recorded as positive quantities leaving; take the magnitude
    // so a sign convention change cannot silently invert every figure here.
    usage.push({ at: movement.createdAt, quantity: Math.abs(Number(movement.quantity)) });
    byProduct.set(movement.productId, usage);
  }

  const assessed = products.map((product) => {
    const profile = demandProfile(byProduct.get(product.id) ?? [], { now, periods: months });

    return {
      productId: product.id,
      name: `${product.name} (${product.partNumber})`,
      reorderPoint: Number(product.reorderPoint),
      recommendation: recommendReorder({ profile, leadTimeDays }),
    };
  });

  return {
    leadTimeDays,
    divergences: divergences(assessed),
    assessed: assessed.filter((part) => part.recommendation.known).length,
    total: assessed.length,
  };
}

/* ---------------------------------------------------------------------------
   Job duration
   --------------------------------------------------------------------------- */

/**
 * How long each kind of work really takes, against how long it is sold for.
 *
 * Grouped by job type rather than by job, because the useful question is not
 * "did this one overrun" but "does this kind of work always overrun", and only
 * the second is something a workshop can price differently.
 */
export async function quotingAssessments(orgId: string, months = 12, now = new Date()) {
  const since = new Date(now.getTime() - months * 30 * 86_400_000);

  const types = await prisma.jobType.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, defaultHours: true },
  });

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      completedAt: { gte: since },
    },
    select: {
      id: true,
      completedAt: true,
      createdAt: true,
      estimatedHours: true,
      jobTypes: { select: { jobTypeId: true } },
      timeEntries: { select: { minutes: true } },
    },
  });

  const samplesByType = new Map<string, Sample[]>();

  for (const job of jobs) {
    const minutes = job.timeEntries.reduce((total, entry) => total + (entry.minutes ?? 0), 0);

    // A job with no time booked to it says nothing about how long the work
    // takes; it says somebody forgot to start the clock.
    if (minutes <= 0) continue;

    const sample: Sample = {
      jobId: job.id,
      minutes,
      estimatedMinutes: job.estimatedHours ? Math.round(Number(job.estimatedHours) * 60) : null,
      completedAt: job.completedAt ?? job.createdAt,
    };

    for (const link of job.jobTypes) {
      samplesByType.set(link.jobTypeId, [...(samplesByType.get(link.jobTypeId) ?? []), sample]);
    }
  }

  const assessments: Quoting[] = types.map((type) =>
    assessQuoting({
      jobType: type.name,
      samples: samplesByType.get(type.id) ?? [],
      bookedMinutes: type.defaultHours ? Math.round(Number(type.defaultHours) * 60) : null,
    }),
  );

  return {
    assessments,
    worst: worstQuoted(assessments),
    measured: assessments.filter((assessment) => assessment.estimate.known).length,
    total: assessments.length,
  };
}

/**
 * How long one kind of work takes, for the diary.
 *
 * Separate from the assessment above because the booking screen wants a number
 * and a spread, not a verdict on pricing.
 */
export async function durationForType(orgId: string, jobTypeId: string, months = 12) {
  const since = new Date(Date.now() - months * 30 * 86_400_000);

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      status: { in: ['COMPLETED', 'INVOICED', 'PAID'] },
      completedAt: { gte: since },
      jobTypes: { some: { jobTypeId } },
    },
    select: {
      id: true,
      completedAt: true,
      createdAt: true,
      estimatedHours: true,
      timeEntries: { select: { minutes: true } },
    },
  });

  const samples: Sample[] = jobs.map((job) => ({
    jobId: job.id,
    minutes: job.timeEntries.reduce((total, entry) => total + (entry.minutes ?? 0), 0),
    estimatedMinutes: job.estimatedHours ? Math.round(Number(job.estimatedHours) * 60) : null,
    completedAt: job.completedAt ?? job.createdAt,
  }));

  return durationFor(samples);
}
