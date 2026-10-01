import { jobsWorstFirst, type JobStatus, standingOfJob } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * Where every job in the workshop stands, from the records that already say.
 *
 * Nothing here is stored. A job's position is read off its status, its
 * estimate, its parts, its invoice and its clock every time it is asked for,
 * because a field that said "waiting for parts" would be a second thing to
 * keep true and would be wrong the first time somebody booked a part in
 * without touching the job. Phase 84.
 *
 * One query for the jobs and everything hanging off them. The bound is the
 * jobs that are open in one workshop, which is the number of cars in the
 * building plus the ones waiting to come in — tens, not thousands — and
 * `openOnly` keeps it that way.
 */

/** Statuses that are still somebody's problem. */
const OPEN: JobStatus[] = [
  'DRAFT',
  'BOOKED',
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'COMPLETED',
  'INVOICED',
];

export async function whereJobsStand(
  orgId: string,
  options: { now?: Date; openOnly?: boolean; jobId?: string } = {},
) {
  const now = options.now ?? new Date();

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      ...(options.jobId ? { id: options.jobId } : {}),
      ...(options.openOnly === false ? {} : { status: { in: OPEN } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      shortDescription: true,
      promisedAt: true,
      collectedAt: true,
      createdAt: true,
      customer: { select: { displayName: true } },
      vehicle: { select: { make: true, model: true, registration: true } },
      jobTypes: { select: { jobType: { select: { requiresQualityCheck: true } } } },
      qualityChecks: { select: { passed: true } },
      // The most recent move into the status it is in now, which is what
      // "2h 14m" is counted from. A job created and never moved has none, so
      // the fallback is when it was written.
      statusEvents: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { toStatus: true, createdAt: true },
      },
      estimates: {
        where: { status: { in: ['SENT', 'DRAFT'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { total: true, sentAt: true, decidedAt: true },
      },
      partLines: { where: { status: 'ON_ORDER' }, select: { id: true } },
      invoices: {
        select: { total: true, amountPaid: true, status: true },
      },
      timeEntries: { where: { endedAt: null }, select: { id: true } },
    },
  });

  const standing = jobs.map((job) => {
    const latest = job.statusEvents[0];
    const since = latest?.toStatus === job.status ? latest.createdAt : job.createdAt;

    const estimate = job.estimates[0];
    const owed = job.invoices
      // A voided invoice is owed by nobody. A draft one has not been put to
      // the customer yet, so it is not theirs to pay either.
      .filter((invoice) => invoice.status !== 'VOID' && invoice.status !== 'DRAFT')
      .reduce((total, invoice) => total + Number(invoice.total) - Number(invoice.amountPaid), 0);

    return {
      id: job.id,
      number: job.number,
      what: job.shortDescription,
      who: job.customer?.displayName ?? null,
      vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}`.trim() : null,
      registration: job.vehicle?.registration ?? null,
      status: job.status as JobStatus,
      // Already queried for the standing itself; returned too, so a caller
      // can tell "late" from "due before the end of today" without asking
      // the database the same question again. Phase 95.
      promisedAt: job.promisedAt,
      standing: standingOfJob({
        status: job.status as JobStatus,
        since,
        now,
        promisedAt: job.promisedAt,
        estimate: estimate
          ? {
              total: Number(estimate.total),
              sentAt: estimate.sentAt,
              // The product does not record an estimate being opened yet, so
              // "opened" is "answered": a decision is proof they saw it. Until
              // there is an open event this is the honest reading, and it is
              // deliberately not guessed from anything softer.
              openedAt: estimate.decidedAt,
            }
          : null,
        partsOutstanding: job.partLines.length,
        qualityCheckRequired: job.jobTypes.some((one) => one.jobType.requiresQualityCheck),
        qualityCheckDone: job.qualityChecks.some((one) => one.passed),
        owed: Math.round(owed * 100) / 100,
        collectedAt: job.collectedAt,
        somebodyOn: job.timeEntries.length > 0,
      }),
    };
  });

  return jobsWorstFirst(standing);
}

/** One job's position, for the band at the top of its own page. */
export async function whereOneJobStands(orgId: string, jobId: string, now?: Date) {
  const [only] = await whereJobsStand(orgId, { jobId, openOnly: false, now });
  return only ?? null;
}
