import {
  type ActionType,
  type QueuedAction,
  reconcile,
  type ServerState,
  type SyncResult,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { recordResult, completeInspection } from './inspections';
import { requestPart, toggleClock } from './shopfloor';

/**
 * Applying what a device recorded while it had no signal.
 *
 * The deciding is in `@carnet/core` and is pure, so the cases that matter —
 * two devices, one job, a state nobody can reproduce by clicking — are
 * testable without a database. This file is the part that reads the state
 * those decisions are made against and writes the ones that pass.
 *
 * One rule runs through all of it. Nothing is applied twice and nothing is
 * lost quietly: every action comes back with an outcome, and a device keeps
 * whatever did not apply along with the sentence saying why.
 */

/** Work that has been billed is closed to a device that has been offline. */
const BILLED = ['INVOICED', 'PAID'] as const;

export interface FlushSummary {
  results: SyncResult[];
  applied: number;
  duplicates: number;
  conflicts: number;
}

/**
 * Reads everything the batch needs to be decided against, in one round.
 *
 * One query per kind of subject rather than one per action. A device coming
 * back from a morning offline sends tens of actions about a handful of jobs,
 * and a lookup per action would be tens of round trips to answer the same few
 * questions.
 */
async function stateFor(orgId: string, actions: readonly QueuedAction[]): Promise<ServerState> {
  const clientIds = actions.map((action) => action.clientId);

  const jobIds = [
    ...new Set(
      actions
        .map((action) =>
          action.type.startsWith('inspection.')
            ? (action.payload.jobId as string | undefined)
            : action.subjectId,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const inspectionIds = [
    ...new Set(
      actions
        .filter((action) => action.type.startsWith('inspection.'))
        .map((action) => action.subjectId),
    ),
  ];

  const [seen, jobs, inspections] = await Promise.all([
    prisma.syncedAction.findMany({
      where: { orgId, clientId: { in: clientIds } },
      select: { clientId: true },
    }),
    jobIds.length > 0
      ? prisma.job.findMany({
          where: { orgId, id: { in: jobIds } },
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
    inspectionIds.length > 0
      ? prisma.inspection.findMany({
          where: { id: { in: inspectionIds }, job: { orgId } },
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    seen: new Set(seen.map((row) => row.clientId)),
    jobStatus: new Map(jobs.map((job) => [job.id, job.status])),
    billed: new Set(
      jobs.filter((job) => BILLED.includes(job.status as never)).map((job) => job.id),
    ),
    inspectionCompleted: new Set(
      inspections.filter((entry) => entry.status === 'COMPLETED').map((entry) => entry.id),
    ),
  };
}

/**
 * Carries out one action that has already been decided as applicable.
 *
 * Each case goes through the same service function the online screens use.
 * A second write path for offline work would be a second set of rules to keep
 * in step, and the first thing to drift would be whichever one nobody tests.
 */
async function apply(orgId: string, userId: string, action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'clock.start':
    case 'clock.stop':
      await toggleClock({ orgId, userId, jobId: action.subjectId });
      return;

    case 'job.note': {
      const text = String(action.payload.text ?? '').trim();
      if (!text) return;

      // A row of its own rather than text appended to a field. Two notes from
      // two devices both survive by construction, which is the whole reason a
      // note is an addition rather than a claim, and each keeps the moment it
      // was written rather than the moment it arrived.
      await prisma.job.findFirstOrThrow({
        where: { id: action.subjectId, orgId },
        select: { id: true },
      });

      await prisma.jobNote.create({
        data: {
          jobId: action.subjectId,
          authorUserId: userId,
          body: text,
          createdAt: action.at,
        },
      });
      return;
    }

    case 'job.status':
      await prisma.job.update({
        where: { id: action.subjectId },
        data: { status: String(action.payload.status ?? '') as never },
      });
      return;

    case 'inspection.result':
      await recordResult({
        orgId,
        userId,
        inspectionId: action.subjectId,
        templateItemId: String(action.payload.templateItemId ?? ''),
        severity: String(action.payload.severity ?? '') as never,
        note: action.payload.note ? String(action.payload.note) : undefined,
        measurementValue:
          action.payload.measurementValue == null
            ? undefined
            : Number(action.payload.measurementValue),
      });
      return;

    case 'inspection.complete':
      await completeInspection({ orgId, userId, inspectionId: action.subjectId });
      return;

    case 'part.request':
      await requestPart({
        orgId,
        userId,
        jobId: action.subjectId,
        notes: String(action.payload.notes ?? ''),
      });
      return;

    case 'odometer.record':
      await prisma.odometerReading.create({
        data: {
          vehicleId: action.subjectId,
          km: Number(action.payload.km ?? 0),
          readAt: action.at,
          source: 'WORKSHOP',
        },
      });
      return;

    default:
      // Unreachable: the action list is closed and checked before this runs.
      return;
  }
}

/**
 * A device's whole queue, applied.
 *
 * Actions are applied one at a time rather than in a single transaction. A
 * batch is not one operation: it is an hour of somebody's morning, and eight
 * good actions should not be rolled back because the ninth turned out to be
 * about a job that has since been invoiced.
 */
export async function flush(input: {
  orgId: string;
  userId: string;
  actions: readonly QueuedAction[];
}): Promise<FlushSummary> {
  if (input.actions.length === 0) {
    return { results: [], applied: 0, duplicates: 0, conflicts: 0 };
  }

  const state = await stateFor(input.orgId, input.actions);
  const decided = reconcile(input.actions, state);

  const byId = new Map(input.actions.map((action) => [action.clientId, action]));
  const results: SyncResult[] = [];

  for (const result of decided.results) {
    if (result.outcome.status !== 'APPLIED') {
      results.push(result);
      continue;
    }

    const action = byId.get(result.clientId)!;

    try {
      await apply(input.orgId, input.userId, action);

      // Written after the work, not before. A row claiming an action was
      // applied when the write then failed would make the retry read as a
      // duplicate and lose it for good.
      await prisma.syncedAction.create({
        data: {
          orgId: input.orgId,
          userId: input.userId,
          clientId: action.clientId,
          type: action.type,
          subjectId: action.subjectId,
          recordedAt: action.at,
        },
      });

      results.push(result);
    } catch (error) {
      results.push({
        clientId: result.clientId,
        outcome: {
          status: 'CONFLICT',
          reason:
            error instanceof Error
              ? error.message
              : 'That could not be saved. It is still on the device.',
        },
      });
    }
  }

  const applied = results.filter((result) => result.outcome.status === 'APPLIED').length;
  const duplicates = results.filter((result) => result.outcome.status === 'DUPLICATE').length;
  const conflicts = results.length - applied - duplicates;

  if (applied > 0 || conflicts > 0) {
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'offline.synced',
      entityType: 'Organization',
      entityId: input.orgId,
      after: { applied, duplicates, conflicts, sent: input.actions.length },
    });
  }

  return { results, applied, duplicates, conflicts };
}

/**
 * Everything a device needs to work with no signal, for one technician.
 *
 * Sent in one response and cached on the device. Deliberately narrow: the
 * jobs assigned to this person that are still open, with the vehicle and the
 * inspection they would be working through. A technician with no signal does
 * not need the customer's address or anything about money.
 */
export async function briefcaseFor(orgId: string, userId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      technicians: { some: { userId } },
      status: { in: ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'QUALITY_CHECK'] },
    },
    orderBy: { promisedAt: 'asc' },
    take: 40,
    select: {
      id: true,
      number: true,
      status: true,
      shortDescription: true,
      details: true,
      promisedAt: true,
      odometerInKm: true,
      bay: { select: { name: true } },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          registration: true,
          vin: true,
          lastOdometerKm: true,
        },
      },
      inspections: {
        where: { status: 'DRAFT' },
        take: 1,
        select: {
          id: true,
          status: true,
          results: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sectionName: true,
              itemName: true,
              severity: true,
              note: true,
              measurementType: true,
              measurementValue: true,
            },
          },
        },
      },
    },
  });

  return { takenAt: new Date().toISOString(), jobs };
}

/** Parses what a device sent, without trusting any of it. */
export function readActions(body: unknown): QueuedAction[] {
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as { actions?: unknown }).actions)
  ) {
    return [];
  }

  const raw = (body as { actions: unknown[] }).actions;

  return raw.slice(0, 500).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const record = entry as Record<string, unknown>;
    const at = new Date(String(record.at ?? ''));

    // A date the device could not produce is not a date. Letting it through
    // as an Invalid Date would sort unpredictably and end up written.
    if (Number.isNaN(at.getTime())) return [];

    return [
      {
        clientId: String(record.clientId ?? ''),
        type: String(record.type ?? '') as ActionType,
        at,
        subjectId: String(record.subjectId ?? ''),
        payload:
          record.payload && typeof record.payload === 'object'
            ? (record.payload as Record<string, unknown>)
            : {},
      },
    ];
  });
}
