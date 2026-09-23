import {
  assertFollowUp,
  assertNotDone,
  FollowUpError,
  needingAttention,
  type Role,
  standingOf,
  mostOverdueFirst,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Chasing something later. Phase 66. FR-617.
 *
 * The rules are in `@carnet/core`; this is the part that touches the database.
 *
 * Every query here names the job. `JobFollowUp` carries no `orgId` of its own —
 * it hangs off a job, which does — so the tenant extension has nothing to
 * narrow it by and never will. Phase 64 made that a checked rule rather than a
 * convention: a read of a model in `CHILD_OF` that does not name its parent
 * fails `verify-scoping` by file and line. This module is the first feature
 * written under it.
 */

export { FollowUpError };

const ROW = {
  id: true,
  note: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  assignedTo: { select: { id: true, name: true } },
  completedBy: { select: { name: true } },
  job: { select: { id: true, number: true, vehicle: { select: { registration: true } } } },
} as const;

export interface FollowUpRow {
  id: string;
  note: string;
  dueAt: Date;
  completedAt: Date | null;
  assignedTo: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  job: { id: string; number: number; registration: string | null };
}

type Loaded = {
  id: string;
  note: string;
  dueAt: Date;
  completedAt: Date | null;
  assignedTo: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  job: { id: string; number: number; vehicle: { registration: string | null } | null };
};

const shape = (row: Loaded): FollowUpRow => ({
  id: row.id,
  note: row.note,
  dueAt: row.dueAt,
  completedAt: row.completedAt,
  assignedTo: row.assignedTo,
  completedBy: row.completedBy,
  job: {
    id: row.job.id,
    number: row.job.number,
    registration: row.job.vehicle?.registration ?? null,
  },
});

/** The follow-ups on one job, worst first. */
export async function followUpsForJob(orgId: string, jobId: string): Promise<FollowUpRow[]> {
  // bounded: the follow-ups of one job. A job with forty is a job somebody is
  // using this as a notepad for, and forty rows is still one small query.
  const rows = await prisma.jobFollowUp.findMany({
    where: { jobId, job: { orgId } },
    select: ROW,
    orderBy: { dueAt: 'asc' },
  });

  return mostOverdueFirst(rows.map(shape));
}

/**
 * What the workshop should be chasing.
 *
 * Late and due today only, because that is what a list is for. Everything
 * further out is on the job it belongs to, where somebody will see it when
 * they are looking at that car.
 */
export async function followUpsDue(
  orgId: string,
  options: { userId?: string; limit?: number } = {},
): Promise<FollowUpRow[]> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // bounded: by the date, by the organisation, and by a limit. Overdue work
  // accumulates in a workshop that ignores it, which is exactly the workshop
  // whose list must still draw.
  const rows = await prisma.jobFollowUp.findMany({
    where: {
      job: { orgId },
      completedAt: null,
      dueAt: { lte: endOfToday },
      ...(options.userId ? { assignedToUserId: options.userId } : {}),
    },
    select: ROW,
    orderBy: { dueAt: 'asc' },
    take: options.limit ?? 50,
  });

  return mostOverdueFirst(rows.map(shape));
}

/** How many need doing, for a figure on a screen somebody already reads. */
export async function followUpsNeedingAttention(orgId: string, userId?: string): Promise<number> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return prisma.jobFollowUp.count({
    where: {
      job: { orgId },
      completedAt: null,
      dueAt: { lte: endOfToday },
      ...(userId ? { assignedToUserId: userId } : {}),
    },
  });
}

/**
 * Setting one.
 *
 * The assignee is optional and the note is not. A follow-up with nobody on it
 * is the workshop's to pick up, which is how most of them start — "somebody
 * ring her" — and pretending otherwise would mean the person writing it has to
 * decide who, at the moment they are least able to.
 */
export async function setFollowUp(input: {
  orgId: string;
  userId: string;
  jobId: string;
  note: string;
  dueAt: Date;
  assignedToUserId?: string | null;
}): Promise<{ id: string }> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: { id: true, number: true },
  });

  if (!job) throw new FollowUpError('That job is not one of yours.', 'NOT_YOURS');

  assertFollowUp({ note: input.note, dueAt: input.dueAt });

  // An assignee has to be on this workshop's team. Somebody else's technician
  // is not a person this workshop may hand work to, and the refusal says the
  // same thing whether they are on another team or do not exist.
  if (input.assignedToUserId) {
    const member = await prisma.membership.findFirst({
      where: { userId: input.assignedToUserId, orgId: input.orgId, isActive: true },
      select: { id: true },
    });

    if (!member) throw new FollowUpError('That is not somebody on this team.', 'NOT_YOURS');
  }

  const created = await prisma.jobFollowUp.create({
    data: {
      jobId: job.id,
      note: input.note.trim(),
      dueAt: input.dueAt,
      assignedToUserId: input.assignedToUserId ?? null,
    },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.followup_set',
    entityType: 'JobFollowUp',
    entityId: created.id,
    after: {
      jobId: job.id,
      dueAt: input.dueAt.toISOString(),
      assignedToUserId: input.assignedToUserId ?? null,
    },
  });

  // And tell them, if it is somebody else's to do. Telling the person who
  // wrote it that they have written it is noise, and noise is how a
  // notification list stops being read.
  if (input.assignedToUserId && input.assignedToUserId !== input.userId) {
    const { notifyOne } = await import('./search');

    await notifyOne({
      orgId: input.orgId,
      userId: input.assignedToUserId,
      kind: 'FOLLOW_UP_ASSIGNED',
      title: `Job #${job.number}: something to follow up`,
      body: input.note.trim(),
      href: `/jobs/${job.id}#followup`,
      entityType: 'JobFollowUp',
      entityId: created.id,
    });
  }

  return created;
}

/** Ticking one off, with who did it. */
export async function completeFollowUp(input: {
  orgId: string;
  userId: string;
  followUpId: string;
}): Promise<void> {
  const followUp = await prisma.jobFollowUp.findFirst({
    where: { id: input.followUpId, job: { orgId: input.orgId } },
    select: { id: true, dueAt: true, completedAt: true, jobId: true },
  });

  if (!followUp) throw new FollowUpError('That follow-up is not one of yours.', 'NOT_YOURS');

  assertNotDone(followUp);

  await prisma.jobFollowUp.update({
    where: { id: followUp.id },
    data: { completedAt: new Date(), completedByUserId: input.userId },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.followup_done',
    entityType: 'JobFollowUp',
    entityId: followUp.id,
    after: { jobId: followUp.jobId, standing: standingOf(followUp) },
  });
}

/** Everyone this workshop could hand a follow-up to. */
export async function couldFollowUp(
  orgId: string,
): Promise<{ id: string; name: string; role: Role }[]> {
  // bounded: the team of one workshop. Anybody on it may be given one — a
  // follow-up is usually a telephone call, so restricting it to technicians
  // would leave out the people who make most of them.
  const team = await prisma.membership.findMany({
    where: { orgId, isActive: true },
    select: { role: true, user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  return team.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    role: member.role as Role,
  }));
}

export { needingAttention, standingOf };
