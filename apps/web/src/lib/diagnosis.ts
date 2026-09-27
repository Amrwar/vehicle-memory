import {
  type CauseEvidence,
  type CauseOutcome,
  isSettled,
  jobsBehind,
  rankCauses,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The workshop's own record of what symptoms turned out to be.
 *
 * Reading side and writing side of the corpus ADR-0016 describes. Nothing here
 * predicts anything: `evidenceFor` counts rows that technicians wrote about
 * cars they had in front of them, and the pages render the count.
 *
 * Phase 81.
 */

export class DiagnosisError extends Error {
  constructor(
    readonly code: 'NO_SYMPTOM' | 'ALREADY_OPEN' | 'NOT_OPEN' | 'NOT_A_CAUSE',
    message: string,
  ) {
    super(message);
    this.name = 'DiagnosisError';
  }
}

/** Every symptom this workshop recognises, with the causes underneath it. */
export async function catalogueFor(orgId: string) {
  return prisma.symptomCode.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      causes: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: { id: true, code: true, label: true },
      },
    },
  });
}

/** This job's diagnosis, if one has been opened. */
export async function diagnosisFor(orgId: string, jobId: string) {
  return prisma.jobDiagnosis.findFirst({
    where: { orgId, jobId },
    select: {
      id: true,
      openedAt: true,
      settledAt: true,
      notes: true,
      symptom: { select: { id: true, label: true } },
      causes: {
        orderBy: [{ cause: { sortOrder: 'asc' } }, { cause: { label: 'asc' } }],
        select: {
          id: true,
          outcome: true,
          note: true,
          decidedAt: true,
          decidedBy: { select: { name: true } },
          cause: { select: { id: true, label: true } },
        },
      },
    },
  });
}

/**
 * What this workshop has found this symptom to be before.
 *
 * `exceptJobId` leaves the job being looked at out of its own evidence. A
 * screen that counted the verdict you have just entered, and then offered it
 * back to you as the reason to believe it, would be a mirror rather than a
 * record.
 */
export async function evidenceFor(
  orgId: string,
  symptomId: string,
  options: { exceptJobId?: string } = {},
): Promise<CauseEvidence[]> {
  const causes = await prisma.causeCode.findMany({
    where: { orgId, symptomId },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, code: true, label: true },
  });

  if (causes.length === 0) return [];

  // Bounded: the causes under one symptom, which a workshop writes by hand.
  const counts = await prisma.diagnosisCause.groupBy({
    by: ['causeId', 'outcome'],
    where: {
      causeId: { in: causes.map((cause) => cause.id) },
      outcome: { not: null },
      diagnosis: {
        orgId,
        settledAt: { not: null },
        ...(options.exceptJobId ? { jobId: { not: options.exceptJobId } } : {}),
      },
    },
    _count: { _all: true },
  });

  return causes.map((cause) => {
    const of = (outcome: CauseOutcome) =>
      counts.find((row) => row.causeId === cause.id && row.outcome === outcome)?._count._all ?? 0;

    return {
      causeCode: cause.code,
      label: cause.label,
      confirmed: of('CONFIRMED'),
      rejected: of('REJECTED'),
      undetermined: of('UNDETERMINED'),
    };
  });
}

/** The evidence, ranked and counted, ready for a page to render. */
export async function whatItHasBeen(
  orgId: string,
  symptomId: string,
  options: { exceptJobId?: string } = {},
) {
  const evidence = await evidenceFor(orgId, symptomId, options);
  return { ranked: rankCauses(evidence), jobs: jobsBehind(evidence) };
}

/**
 * Opens a diagnosis on a job, with every cause under the symptom listed and
 * none of them decided.
 *
 * The list is what there is to rule on, not a suggestion of what it is. The
 * order it appears in is the catalogue's, not the evidence's: a technician
 * reading a list sorted by what the workshop usually finds is being led, and
 * the whole value of the corpus is that it records what they found rather
 * than what they were shown.
 */
export async function openDiagnosis(input: {
  orgId: string;
  userId: string;
  jobId: string;
  symptomId: string;
}): Promise<{ diagnosisId: string }> {
  const symptom = await prisma.symptomCode.findFirst({
    where: { id: input.symptomId, orgId: input.orgId, isActive: true },
    select: { id: true, label: true, causes: { where: { isActive: true }, select: { id: true } } },
  });

  if (!symptom) throw new DiagnosisError('NO_SYMPTOM', 'That is not a symptom this workshop uses.');

  const existing = await prisma.jobDiagnosis.findFirst({
    where: { orgId: input.orgId, jobId: input.jobId },
    select: { id: true },
  });

  if (existing) throw new DiagnosisError('ALREADY_OPEN', 'This job already has a diagnosis.');

  const created = await prisma.jobDiagnosis.create({
    data: {
      orgId: input.orgId,
      jobId: input.jobId,
      symptomId: symptom.id,
      causes: { create: symptom.causes.map((cause) => ({ causeId: cause.id })) },
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'diagnosis.opened',
    entityType: 'Job',
    entityId: input.jobId,
    after: { symptom: symptom.label, considering: symptom.causes.length },
  });

  return { diagnosisId: created.id };
}

/**
 * Records what a technician found one cause to be.
 *
 * Writes the person and the time with the verdict, which the database insists
 * on: a row saying CONFIRMED with nobody against it is a finding nobody made.
 * When the last cause is decided the diagnosis settles, and only then does any
 * of it count towards what the workshop knows.
 */
export async function recordVerdict(input: {
  orgId: string;
  userId: string;
  diagnosisId: string;
  causeId: string;
  outcome: CauseOutcome;
  note?: string;
}): Promise<{ settled: boolean }> {
  const diagnosis = await prisma.jobDiagnosis.findFirst({
    where: { id: input.diagnosisId, orgId: input.orgId },
    select: { id: true, jobId: true, causes: { select: { causeId: true } } },
  });

  if (!diagnosis) throw new DiagnosisError('NOT_OPEN', 'There is no diagnosis to record against.');

  if (!diagnosis.causes.some((one) => one.causeId === input.causeId)) {
    throw new DiagnosisError('NOT_A_CAUSE', 'That cause is not one this diagnosis considered.');
  }

  await prisma.diagnosisCause.update({
    where: { diagnosisId_causeId: { diagnosisId: diagnosis.id, causeId: input.causeId } },
    data: {
      outcome: input.outcome,
      note: input.note?.trim() || null,
      decidedByUserId: input.userId,
      decidedAt: new Date(),
    },
  });

  const after = await prisma.diagnosisCause.findMany({
    where: { diagnosisId: diagnosis.id },
    select: { outcome: true, cause: { select: { label: true } } },
  });

  const settled = isSettled(after);

  await prisma.jobDiagnosis.update({
    where: { id: diagnosis.id },
    data: { settledAt: settled ? new Date() : null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'diagnosis.decided',
    entityType: 'Job',
    entityId: diagnosis.jobId,
    after: {
      cause: after.find((one) => one.outcome === input.outcome)?.cause.label ?? input.causeId,
      outcome: input.outcome,
      settled,
    },
  });

  return { settled };
}
