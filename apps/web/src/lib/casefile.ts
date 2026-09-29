import {
  byCause,
  type ComebackCause,
  type ComebackRecord,
  oursOf,
  patternsIn,
  stillMissing,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The case file: everything about the job a car came back from, in one place.
 *
 * Marking a comeback has been possible since Phase 26 — a link and a sentence.
 * What was never possible was answering the question the link raises: *why*.
 * Somebody looking at a returned car had to open the original job, the
 * inspection, the parts and the clock in four places and hold it in their head.
 *
 * None of this is new data. The original complaint, what was diagnosed, which
 * parts went on, who did the work and what the inspection said are all already
 * recorded — the case file is a query, not a table. The one new fact is the
 * cause, because that is a judgement somebody makes and nothing can derive.
 *
 * Phase 86.
 */

export class CaseFileError extends Error {
  constructor(
    readonly code: 'NOT_A_COMEBACK' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'CaseFileError';
  }
}

/** The whole story of a comeback, gathered from what is already written down. */
export async function caseFileFor(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      id: true,
      number: true,
      shortDescription: true,
      comebackReason: true,
      comebackCause: true,
      comebackMarkedAt: true,
      comebackMarkedBy: { select: { name: true } },
      comebackOf: {
        select: {
          id: true,
          number: true,
          shortDescription: true,
          diagnosis: true,
          completedAt: true,
          odometerOutKm: true,
          technicians: { select: { user: { select: { name: true } } } },
          partLines: {
            select: { description: true, partNumber: true, quantity: true },
            orderBy: { sortOrder: 'asc' },
          },
          // What the technician settled on, from the corpus Phase 81 built.
          diagnoses: {
            where: { settledAt: { not: null } },
            select: {
              symptom: { select: { label: true } },
              causes: {
                where: { outcome: 'CONFIRMED' },
                select: { cause: { select: { label: true } } },
              },
            },
          },
          inspections: {
            where: { status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              completedAt: true,
              criticalCount: true,
              advisoryCount: true,
              performedBy: { select: { name: true } },
            },
          },
          qualityChecks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { passed: true, checkedBy: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!job) throw new CaseFileError('NOT_FOUND', 'That job was not found.');
  if (!job.comebackOf) return null;

  const original = job.comebackOf;

  return {
    cause: job.comebackCause as ComebackCause | null,
    newComplaint: job.shortDescription,
    noticed: job.comebackMarkedAt,
    noticedBy: job.comebackMarkedBy?.name ?? null,
    saidAtTheTime: job.comebackReason,
    missing: stillMissing({
      cause: job.comebackCause as ComebackCause | null,
      hasOriginal: true,
      hasNewComplaint: Boolean(job.shortDescription?.trim()),
    }),
    original: {
      id: original.id,
      number: original.number,
      complaint: original.shortDescription,
      diagnosisNote: original.diagnosis,
      finishedAt: original.completedAt,
      mileageOut: original.odometerOutKm,
      technicians: original.technicians.map((one) => one.user.name),
      parts: original.partLines.map((line) => ({
        description: line.description,
        partNumber: line.partNumber,
        quantity: Number(line.quantity),
      })),
      // What the corpus says was confirmed. If the cause of the comeback is
      // "the diagnosis was wrong", this is the thing that was wrong, by name.
      settled: original.diagnoses.map((one) => ({
        symptom: one.symptom.label,
        confirmed: one.causes.map((each) => each.cause.label),
      })),
      inspection: original.inspections[0] ?? null,
      signOff: original.qualityChecks[0] ?? null,
    },
  };
}

/** Records why it came back. */
export async function recordCause(input: {
  orgId: string;
  userId: string;
  jobId: string;
  cause: ComebackCause;
}): Promise<void> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, comebackOfJobId: true, comebackCause: true },
  });

  if (!job) throw new CaseFileError('NOT_FOUND', 'That job was not found.');

  // The database says the same thing, and says it second. A cause on a job
  // that is not a comeback is a cause for nothing.
  if (!job.comebackOfJobId) {
    throw new CaseFileError(
      'NOT_A_COMEBACK',
      'Link this job to the one it came back from before saying why.',
    );
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { comebackCause: input.cause },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'comeback.cause',
    entityType: 'Job',
    entityId: job.id,
    before: { cause: job.comebackCause },
    after: { cause: input.cause },
  });
}

/**
 * Comebacks over a period, by cause, with the patterns worth interrupting
 * somebody for.
 */
export async function comebacksByCause(orgId: string, options: { days?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const days = options.days ?? 90;
  const since = new Date(now.getTime() - days * 86_400_000);

  // Bounded by the period: the comebacks one workshop had in a quarter.
  const rows = await prisma.job.findMany({
    where: { orgId, comebackOfJobId: { not: null }, createdAt: { gte: since, lte: now } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      comebackCause: true,
      createdAt: true,
      vehicleId: true,
      comebackOf: { select: { shortDescription: true } },
    },
  });

  const records: ComebackRecord[] = rows.map((row) => ({
    jobId: row.id,
    cause: row.comebackCause as ComebackCause | null,
    originalWork: row.comebackOf?.shortDescription ?? null,
    vehicleId: row.vehicleId,
    at: row.createdAt,
  }));

  return {
    days,
    total: records.length,
    tally: byCause(records),
    ours: oursOf(records),
    patterns: patternsIn(records),
    unclassified: records.filter((one) => one.cause == null).length,
  };
}
