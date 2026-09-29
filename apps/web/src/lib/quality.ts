import {
  afterCheck,
  DEFAULT_QUALITY_SHEET,
  gapsIn,
  outcomeOf,
  type QualityAnswer,
  type QualityItem,
  type QualityOutcome,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { moveJob } from './money';

/**
 * Recording a quality check, which nothing in this product could do until
 * Phase 85.
 *
 * `assertTransition` has refused to complete a job whose type asks for a check
 * since Phase 1 (FR-612), the default job types all ask for one, and no code
 * path anywhere created a `quality_checks` row. A workshop that signed up and
 * booked in a service was told, correctly, that it needed a passed check, and
 * given no way to record one.
 *
 * Pass finishes the job. Fail sends it back to the bench and says which lines
 * are why.
 */

export class QualityError extends Error {
  constructor(
    readonly code: 'NO_SHEET' | 'NOT_CHECKABLE' | 'UNKNOWN_LINE',
    message: string,
  ) {
    super(message);
    this.name = 'QualityError';
  }
}

/** The lines this workshop asks, in its own order. */
export async function sheetFor(orgId: string): Promise<QualityItem[]> {
  const items = await prisma.qualityCheckItem.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, label: true, kind: true, required: true },
  });

  return items.map((item) => ({ ...item, kind: item.kind as QualityItem['kind'] }));
}

/**
 * Gives a workshop the starting sheet, once.
 *
 * Called when a workshop is created and again from the settings screen if
 * somebody has emptied it. Never overwrites: a workshop that has written its
 * own sheet keeps it.
 */
export async function ensureSheet(orgId: string): Promise<number> {
  const already = await prisma.qualityCheckItem.count({ where: { orgId } });
  if (already > 0) return 0;

  await prisma.qualityCheckItem.createMany({
    data: DEFAULT_QUALITY_SHEET.map((item, index) => ({
      orgId,
      label: item.label,
      kind: item.kind,
      required: item.required,
      sortOrder: index,
    })),
  });

  return DEFAULT_QUALITY_SHEET.length;
}

/** Checks already recorded against a job, newest first. */
export async function checksFor(orgId: string, jobId: string) {
  return prisma.qualityCheck.findMany({
    where: { jobId, job: { orgId } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      passed: true,
      notes: true,
      createdAt: true,
      checkedBy: { select: { name: true } },
      answers: {
        select: {
          confirmed: true,
          value: true,
          item: { select: { id: true, label: true, kind: true, required: true } },
        },
      },
    },
  });
}

/**
 * Records one check and moves the job.
 *
 * The outcome is not passed in. It is computed from the answers against the
 * sheet, by the same function the screen uses to grey out the button, because
 * an outcome somebody can send is an outcome somebody can send without
 * answering anything.
 */
export async function recordQualityCheck(input: {
  orgId: string;
  userId: string;
  jobId: string;
  answers: QualityAnswer[];
  notes?: string;
}): Promise<{ outcome: QualityOutcome; gaps: { label: string; why: string }[] }> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, status: true, number: true },
  });

  if (!job) throw new QualityError('NOT_CHECKABLE', 'There is no such job in this workshop.');

  if (!['IN_PROGRESS', 'QUALITY_CHECK'].includes(job.status)) {
    throw new QualityError(
      'NOT_CHECKABLE',
      'A job is checked when the work is done, not before it starts or after it is invoiced.',
    );
  }

  const items = await sheetFor(input.orgId);

  if (items.length === 0) {
    throw new QualityError(
      'NO_SHEET',
      'This workshop has no sign-off sheet yet. Add the lines in settings first.',
    );
  }

  const known = new Set(items.map((item) => item.id));
  const answers = input.answers.filter((answer) => known.has(answer.itemId));

  if (answers.length !== input.answers.length) {
    throw new QualityError('UNKNOWN_LINE', 'An answer was given for a line not on the sheet.');
  }

  const outcome = outcomeOf(items, answers);
  const gaps = gapsIn(items, answers);

  const check = await prisma.qualityCheck.create({
    data: {
      jobId: job.id,
      checkedByUserId: input.userId,
      passed: outcome === 'PASS',
      notes: input.notes?.trim() || null,
      answers: {
        create: answers.map((answer) => ({
          itemId: answer.itemId,
          // The database insists on one or the other: a row with neither is a
          // line somebody skipped while appearing to have answered it.
          confirmed: answer.value == null ? (answer.confirmed ?? false) : null,
          value: answer.value == null ? null : answer.value,
        })),
      },
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: outcome === 'PASS' ? 'quality.passed' : 'quality.failed',
    entityType: 'Job',
    entityId: job.id,
    after: {
      check: check.id,
      outcome,
      unanswered: gaps.filter((gap) => gap.why === 'unanswered').length,
      refused: gaps.filter((gap) => gap.why === 'refused').length,
    },
  });

  // Pass finishes the job; fail puts it back on the bench. The move goes
  // through the ordinary transition, so every other rule still applies — a
  // check that passed does not excuse an unapproved estimate.
  //
  // A failed check on a job that is already on the bench moves nothing, and
  // must not try to: the transition machinery refuses a move from a status to
  // itself, which is right, and asking it to would turn a recorded failure
  // into an error the technician sees instead of the reason it failed. The
  // check is written either way; that is what the record is for.
  const goesTo = afterCheck(outcome);

  if (goesTo !== job.status) {
    await moveJob({
      orgId: input.orgId,
      userId: input.userId,
      jobId: job.id,
      to: goesTo,
      note:
        outcome === 'PASS'
          ? null
          : gaps.map((gap) => gap.label).join('; ') || 'Quality check not passed',
    });
  }

  return { outcome, gaps: gaps.map((gap) => ({ label: gap.label, why: gap.why })) };
}
