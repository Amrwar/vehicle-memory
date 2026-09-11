/**
 * Work recorded with no signal, reconciled when there is some.
 *
 * Workshops have bad wi-fi, and the parts of the building with the worst
 * signal are the parts with the cars in them. A technician has to be able to
 * open a job, record findings, take a note and run the clock with nothing
 * connected, and have none of it lost afterwards.
 *
 * The reconciling is the whole difficulty, and it is where this kind of
 * feature is usually got wrong. Two people editing one job from two devices
 * cannot be resolved by last-write-wins, because the record a customer is
 * billed from is not a document: it is a sequence of claims about what
 * happened, and the later claim is not automatically the true one.
 *
 * So every queued action is put into exactly one of three kinds, and the kind
 * decides how it merges.
 *
 * A FACT happened at a moment and is simply true: a clock started at 09:12, a
 * photograph was taken, a finding was recorded. Facts replay in the order
 * they happened and never conflict with each other. They are deduplicated by
 * an id the device generated, so a retry cannot write the same fact twice.
 *
 * An ADDITION appends to something without replacing it: a note, a part
 * request. Two of them from two devices both apply, and neither is lost.
 *
 * A CLAIM asserts the state of something: a job is now finished, this item is
 * now red. Two claims about the same thing from two devices is the only case
 * that can genuinely conflict, and it is resolved by whether the transition is
 * still legal against what the server holds, not by which arrived last. When
 * it is not, the action is refused and handed back with a sentence saying why,
 * for a person to sort out.
 *
 * Nothing here silently discards anything. An action either applies, is
 * recognised as a duplicate, or comes back with a reason.
 */

export type QueuedKind = 'FACT' | 'ADDITION' | 'CLAIM';

/**
 * Everything a technician's device is allowed to queue.
 *
 * A closed list rather than anything the client sends. These arrive from a
 * browser that has been offline and may have been tampered with, and a queue
 * that accepted arbitrary operations would be a remote write API with no
 * schema.
 */
export const ACTIONS = {
  'clock.start': 'FACT',
  'clock.stop': 'FACT',
  'inspection.result': 'CLAIM',
  'inspection.complete': 'CLAIM',
  'job.note': 'ADDITION',
  'job.status': 'CLAIM',
  'part.request': 'ADDITION',
  'odometer.record': 'FACT',
} as const satisfies Record<string, QueuedKind>;

export type ActionType = keyof typeof ACTIONS;

export interface QueuedAction {
  /**
   * Generated on the device before anything is sent. The only thing that
   * makes a retry safe: without it, a flush interrupted halfway writes
   * everything twice the next time the signal comes back.
   */
  clientId: string;
  type: ActionType;
  /** When it happened on the device, not when it arrived. */
  at: Date;
  /** What it happened to. */
  subjectId: string;
  payload: Record<string, unknown>;
}

export type Outcome =
  | { status: 'APPLIED' }
  | { status: 'DUPLICATE' }
  | { status: 'CONFLICT'; reason: string }
  | { status: 'REFUSED'; reason: string };

export interface SyncResult {
  clientId: string;
  outcome: Outcome;
}

export class SyncError extends Error {
  constructor(
    readonly code: 'UNKNOWN_ACTION' | 'NO_CLIENT_ID' | 'NO_SUBJECT' | 'FUTURE' | 'TOO_OLD',
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** How old a queued action may be before it needs a person to look at it. */
export const STALE_AFTER_DAYS = 14;

export function kindOf(type: ActionType): QueuedKind {
  return ACTIONS[type];
}

/**
 * Whether an action is well enough formed to be worth applying.
 *
 * Checked before anything touches the database, because the alternative is a
 * malformed row from a tampered client landing in the middle of a batch and
 * the rest of somebody's morning failing with it.
 */
export function assertQueueable(action: QueuedAction, now = new Date()): void {
  if (!action.clientId || action.clientId.length < 8) {
    throw new SyncError(
      'NO_CLIENT_ID',
      'Every queued action needs an id the device generated, or a retry writes it twice.',
    );
  }

  if (!(action.type in ACTIONS)) {
    throw new SyncError('UNKNOWN_ACTION', `${action.type} is not something a device may queue.`);
  }

  if (!action.subjectId) {
    throw new SyncError('NO_SUBJECT', 'A queued action has to say what it happened to.');
  }

  // A device with a wrong clock is common and a device an hour ahead is not
  // evidence of anything. An hour of tolerance, then it is refused rather
  // than silently written into the future of somebody's timesheet.
  if (action.at.getTime() > now.getTime() + 3_600_000) {
    throw new SyncError(
      'FUTURE',
      'This was recorded in the future. The device clock is wrong, and accepting it would put time on a job before the job existed.',
    );
  }

  if (action.at.getTime() < now.getTime() - STALE_AFTER_DAYS * 86_400_000) {
    throw new SyncError(
      'TOO_OLD',
      `This has been sitting on a device for more than ${STALE_AFTER_DAYS} days. Somebody should look at it rather than have it appear silently.`,
    );
  }
}

/**
 * The order actions are applied in.
 *
 * By the moment they happened, not the moment they arrived. Two devices out
 * of contact with each other both produce a correct local sequence, and the
 * merge of the two is only correct if it is ordered by when things actually
 * happened.
 *
 * Ties break on the client id so the result is the same whichever order the
 * batch was sent in. Two facts at the same millisecond are independent, and a
 * merge that depended on arrival order would produce two different timelines
 * from the same two devices.
 */
export function replayOrder(actions: readonly QueuedAction[]): QueuedAction[] {
  return [...actions].sort(
    (a, b) => a.at.getTime() - b.at.getTime() || a.clientId.localeCompare(b.clientId),
  );
}

export interface ServerState {
  /** Client ids already applied, so a retry is recognised rather than repeated. */
  seen: ReadonlySet<string>;
  /** Current status of each job the batch touches. */
  jobStatus: ReadonlyMap<string, string>;
  /** Whether a job is already finished and billed, which closes it to edits. */
  billed: ReadonlySet<string>;
  /** Inspections already completed, which stops a later finding rewriting one. */
  inspectionCompleted: ReadonlySet<string>;
}

/**
 * Statuses a technician's device may move a job into.
 *
 * Deliberately short. A device with no signal has no business invoicing
 * anything, and the states here are the ones somebody with gloves on actually
 * changes: picked it up, finished it, needs checking.
 */
const TECHNICIAN_TRANSITIONS: Record<string, readonly string[]> = {
  RECEIVED: ['INSPECTING', 'IN_PROGRESS'],
  INSPECTING: ['DIAGNOSED', 'IN_PROGRESS'],
  DIAGNOSED: ['IN_PROGRESS'],
  IN_PROGRESS: ['QUALITY_CHECK', 'COMPLETED'],
  QUALITY_CHECK: ['COMPLETED', 'IN_PROGRESS'],
};

/**
 * What to do with one action, given what the server already holds.
 *
 * Pure. It decides; the caller writes. That separation is what makes this
 * testable against the cases that matter, which all involve two devices and
 * a state nobody can reproduce by clicking.
 */
export function decideQueued(action: QueuedAction, state: ServerState): Outcome {
  if (state.seen.has(action.clientId)) return { status: 'DUPLICATE' };

  const kind = kindOf(action.type);

  // A job that has been invoiced is closed to everybody, whatever kind of
  // action this is. Time appearing on a job after the customer has paid is a
  // bill that has to be reissued, and it is the one outcome worth blocking
  // even a plain fact for.
  const jobId =
    action.type === 'job.note' ||
    action.type === 'job.status' ||
    action.type === 'clock.start' ||
    action.type === 'clock.stop' ||
    action.type === 'part.request'
      ? action.subjectId
      : (action.payload.jobId as string | undefined);

  if (jobId && state.billed.has(jobId)) {
    return {
      status: 'CONFLICT',
      reason:
        'This job was invoiced while the device was offline. Nothing can be added to it now without reissuing the bill, so somebody has to decide.',
    };
  }

  if (kind === 'FACT' || kind === 'ADDITION') {
    // Facts and additions never conflict with each other. That is the whole
    // reason for sorting actions into kinds: the majority of what a
    // technician records offline simply applies.
    return { status: 'APPLIED' };
  }

  /* --- claims, the only kind that can genuinely disagree -------------------- */

  if (action.type === 'inspection.result' || action.type === 'inspection.complete') {
    if (state.inspectionCompleted.has(action.subjectId)) {
      return {
        status: 'CONFLICT',
        reason:
          'This inspection was completed and sent to the customer while the device was offline. A finding recorded now would change a document they have already read.',
      };
    }

    return { status: 'APPLIED' };
  }

  if (action.type === 'job.status') {
    const current = state.jobStatus.get(action.subjectId);
    const wanted = String(action.payload.status ?? '');

    if (!current) {
      return { status: 'REFUSED', reason: 'That job is no longer here.' };
    }

    if (current === wanted) {
      // Somebody else got there first and put it where this device wanted it.
      // Not a conflict: the world is already as this action asked for.
      return { status: 'APPLIED' };
    }

    const allowed = TECHNICIAN_TRANSITIONS[current] ?? [];

    if (!allowed.includes(wanted)) {
      return {
        status: 'CONFLICT',
        reason: `The job moved to ${current.toLowerCase().replace(/_/g, ' ')} while the device was offline, and it cannot go from there to ${wanted.toLowerCase().replace(/_/g, ' ')}.`,
      };
    }

    return { status: 'APPLIED' };
  }

  return { status: 'REFUSED', reason: 'Nothing knows how to apply that.' };
}

/**
 * A whole batch, decided.
 *
 * Every action gets an outcome, including the ones that failed. A flush that
 * returned only successes would leave a device unable to tell what it still
 * holds, and the safe thing for it to do then is send everything again.
 */
export function reconcile(actions: readonly QueuedAction[], state: ServerState, now = new Date()) {
  const results: SyncResult[] = [];

  // Applied ids accumulate as the batch is decided, so a device that queued
  // the same action twice in one flush has the second recognised as a
  // duplicate rather than applied again.
  const seen = new Set(state.seen);
  const jobStatus = new Map(state.jobStatus);

  for (const action of replayOrder(actions)) {
    try {
      assertQueueable(action, now);
    } catch (error) {
      results.push({
        clientId: action.clientId,
        outcome: {
          status: 'REFUSED',
          reason: error instanceof SyncError ? error.message : 'That could not be read.',
        },
      });
      continue;
    }

    const outcome = decideQueued(action, { ...state, seen, jobStatus });

    if (outcome.status === 'APPLIED') {
      seen.add(action.clientId);

      // The next action in the same batch sees the state this one produced,
      // which is what lets a device queue "start it, then finish it" while
      // offline and have both apply in one flush.
      if (action.type === 'job.status') {
        jobStatus.set(action.subjectId, String(action.payload.status ?? ''));
      }
    }

    results.push({ clientId: action.clientId, outcome });
  }

  return {
    results,
    applied: results.filter((result) => result.outcome.status === 'APPLIED').length,
    duplicates: results.filter((result) => result.outcome.status === 'DUPLICATE').length,
    conflicts: results.filter(
      (result) => result.outcome.status === 'CONFLICT' || result.outcome.status === 'REFUSED',
    ).length,
  };
}

/** What to tell somebody after a flush, in one line. */
export function describeSync(summary: {
  applied: number;
  duplicates: number;
  conflicts: number;
}): string {
  if (summary.applied === 0 && summary.conflicts === 0) return 'Nothing was waiting.';

  const parts: string[] = [];

  if (summary.applied > 0) parts.push(`${summary.applied} saved`);
  if (summary.duplicates > 0) parts.push(`${summary.duplicates} already here`);
  if (summary.conflicts > 0) {
    parts.push(
      `${summary.conflicts} need${summary.conflicts === 1 ? 's' : ''} a decision, kept on the device`,
    );
  }

  return `${parts.join(', ')}.`;
}
