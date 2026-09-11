import { describe, expect, it } from 'vitest';

import {
  assertQueueable,
  decideQueued,
  describeSync,
  kindOf,
  type QueuedAction,
  reconcile,
  replayOrder,
  type ServerState,
  SyncError,
} from './sync';

const at = (iso: string) => new Date(`2026-09-11T${iso}:00`);
const NOW = at('17:00');

function action(overrides: Partial<QueuedAction> & Pick<QueuedAction, 'type'>): QueuedAction {
  return {
    clientId: `client-${Math.random().toString(36).slice(2, 12)}`,
    at: at('09:00'),
    subjectId: 'job-1',
    payload: {},
    ...overrides,
  };
}

function state(overrides: Partial<ServerState> = {}): ServerState {
  return {
    seen: new Set(),
    jobStatus: new Map([['job-1', 'IN_PROGRESS']]),
    billed: new Set(),
    inspectionCompleted: new Set(),
    ...overrides,
  };
}

describe('kindOf', () => {
  it('sorts what a device records into the three kinds', () => {
    expect(kindOf('clock.start')).toBe('FACT');
    expect(kindOf('job.note')).toBe('ADDITION');
    expect(kindOf('job.status')).toBe('CLAIM');
  });
});

describe('assertQueueable', () => {
  it('accepts an ordinary action', () => {
    expect(() => assertQueueable(action({ type: 'clock.start' }), NOW)).not.toThrow();
  });

  it('refuses one with no device id', () => {
    // The only thing that makes a retry safe. Without it a flush interrupted
    // halfway writes everything twice when the signal comes back.
    expect(() => assertQueueable(action({ type: 'clock.start', clientId: 'x' }), NOW)).toThrow(
      SyncError,
    );
  });

  it('refuses an action nobody put on the list', () => {
    expect(() => assertQueueable(action({ type: 'invoice.issue' as never }), NOW)).toThrow(
      /not something a device may queue/,
    );
  });

  it('refuses one with nothing to apply it to', () => {
    expect(() => assertQueueable(action({ type: 'job.note', subjectId: '' }), NOW)).toThrow(
      /what it happened to/,
    );
  });

  it('forgives an hour of wrong clock and refuses a day of it', () => {
    // A device an hour ahead is common and is not evidence of anything. A
    // device a day ahead would put time on a job before the job existed.
    expect(() =>
      assertQueueable(action({ type: 'clock.start', at: at('17:30') }), NOW),
    ).not.toThrow();

    expect(() =>
      assertQueueable(
        action({ type: 'clock.start', at: new Date(NOW.getTime() + 86_400_000) }),
        NOW,
      ),
    ).toThrow(/device clock is wrong/);
  });

  it('refuses something that has sat on a device for a fortnight', () => {
    expect(() =>
      assertQueueable(
        action({ type: 'clock.start', at: new Date(NOW.getTime() - 20 * 86_400_000) }),
        NOW,
      ),
    ).toThrow(/somebody should look at it/i);
  });
});

describe('replayOrder', () => {
  it('orders by when things happened, not when they arrived', () => {
    // Two devices out of contact both produce a correct local sequence. The
    // merge is only correct if it is ordered by when things actually happened.
    const ordered = replayOrder([
      action({ type: 'clock.stop', at: at('12:00'), clientId: 'client-bbbbbbbb' }),
      action({ type: 'clock.start', at: at('09:00'), clientId: 'client-aaaaaaaa' }),
    ]);

    expect(ordered[0]!.type).toBe('clock.start');
  });

  it('gives the same answer whichever order the batch was sent in', () => {
    const a = action({ type: 'job.note', at: at('09:00'), clientId: 'client-aaaaaaaa' });
    const b = action({ type: 'job.note', at: at('09:00'), clientId: 'client-bbbbbbbb' });

    expect(replayOrder([a, b]).map((entry) => entry.clientId)).toEqual(
      replayOrder([b, a]).map((entry) => entry.clientId),
    );
  });
});

describe('decideQueued', () => {
  it('recognises a retry rather than writing it twice', () => {
    const queued = action({ type: 'clock.start', clientId: 'client-already-here' });
    const outcome = decideQueued(queued, state({ seen: new Set(['client-already-here']) }));

    expect(outcome.status).toBe('DUPLICATE');
  });

  it('applies a fact without argument', () => {
    expect(decideQueued(action({ type: 'clock.start' }), state()).status).toBe('APPLIED');
  });

  it('applies two notes from two devices, losing neither', () => {
    const first = action({ type: 'job.note', payload: { text: 'From the ramp' } });
    const second = action({ type: 'job.note', payload: { text: 'From the office' } });

    expect(decideQueued(first, state()).status).toBe('APPLIED');
    expect(decideQueued(second, state()).status).toBe('APPLIED');
  });

  it('stops anything landing on a job that was invoiced meanwhile', () => {
    // Time appearing on a job after the customer has paid is a bill that has
    // to be reissued. The one case worth blocking even a plain fact for.
    const outcome = decideQueued(
      action({ type: 'clock.stop' }),
      state({ billed: new Set(['job-1']) }),
    );

    expect(outcome.status).toBe('CONFLICT');
    expect(outcome.status === 'CONFLICT' && outcome.reason).toContain('reissuing the bill');
  });

  it('stops a finding rewriting an inspection the customer has read', () => {
    const outcome = decideQueued(
      action({ type: 'inspection.result', subjectId: 'insp-1' }),
      state({ inspectionCompleted: new Set(['insp-1']) }),
    );

    expect(outcome.status).toBe('CONFLICT');
    expect(outcome.status === 'CONFLICT' && outcome.reason).toContain('already read');
  });

  it('allows a finding on an inspection still open', () => {
    expect(
      decideQueued(action({ type: 'inspection.result', subjectId: 'insp-1' }), state()).status,
    ).toBe('APPLIED');
  });

  it('allows a legal status move', () => {
    const outcome = decideQueued(
      action({ type: 'job.status', payload: { status: 'QUALITY_CHECK' } }),
      state(),
    );

    expect(outcome.status).toBe('APPLIED');
  });

  it('refuses a move that is no longer legal, and says what happened', () => {
    // The case last-write-wins gets wrong. The device thinks the job is in
    // progress; it was completed and quality checked an hour ago.
    const outcome = decideQueued(
      action({ type: 'job.status', payload: { status: 'QUALITY_CHECK' } }),
      state({ jobStatus: new Map([['job-1', 'INVOICED']]) }),
    );

    expect(outcome.status).toBe('CONFLICT');
    expect(outcome.status === 'CONFLICT' && outcome.reason).toContain('invoiced');
  });

  it('treats a move somebody else already made as done, not as a conflict', () => {
    // The world is already as this action asked for. Calling that a conflict
    // would make a technician sort out something that needs no sorting.
    const outcome = decideQueued(
      action({ type: 'job.status', payload: { status: 'COMPLETED' } }),
      state({ jobStatus: new Map([['job-1', 'COMPLETED']]) }),
    );

    expect(outcome.status).toBe('APPLIED');
  });

  it('refuses a status move on a job that has gone', () => {
    const outcome = decideQueued(
      action({ type: 'job.status', subjectId: 'job-gone', payload: { status: 'COMPLETED' } }),
      state(),
    );

    expect(outcome.status).toBe('REFUSED');
  });
});

describe('reconcile', () => {
  it('gives every action an outcome, including the ones that failed', () => {
    // A flush returning only successes leaves the device unable to tell what
    // it still holds, and the safe thing for it to do then is send everything
    // again.
    const summary = reconcile(
      [
        action({ type: 'clock.start', at: at('09:00') }),
        action({ type: 'job.status', payload: { status: 'INVOICED' } }),
      ],
      state(),
      NOW,
    );

    expect(summary.results).toHaveLength(2);
    expect(summary.applied).toBe(1);
    expect(summary.conflicts).toBe(1);
  });

  it('lets a device queue a whole sequence and flush it at once', () => {
    // Started it, finished it, sent it for checking, all with no signal. Each
    // action has to see the state the one before it produced.
    const summary = reconcile(
      [
        action({ type: 'job.status', at: at('09:00'), payload: { status: 'QUALITY_CHECK' } }),
        action({ type: 'job.status', at: at('11:00'), payload: { status: 'COMPLETED' } }),
      ],
      state(),
      NOW,
    );

    expect(summary.applied).toBe(2);
    expect(summary.conflicts).toBe(0);
  });

  it('catches the same action queued twice in one flush', () => {
    const twice = action({ type: 'clock.start', clientId: 'client-duplicated' });

    const summary = reconcile([twice, { ...twice }], state(), NOW);

    expect(summary.applied).toBe(1);
    expect(summary.duplicates).toBe(1);
  });

  it('refuses a malformed action without failing the rest of the morning', () => {
    const summary = reconcile(
      [
        action({ type: 'clock.start', clientId: 'x' }),
        action({ type: 'job.note', at: at('10:00') }),
      ],
      state(),
      NOW,
    );

    expect(summary.applied).toBe(1);
    expect(summary.conflicts).toBe(1);
  });

  it('does not change what it was given', () => {
    const held = state();
    reconcile([action({ type: 'job.status', payload: { status: 'COMPLETED' } })], held, NOW);

    expect(held.jobStatus.get('job-1')).toBe('IN_PROGRESS');
    expect(held.seen.size).toBe(0);
  });
});

describe('describeSync', () => {
  it('says nothing was waiting when nothing was', () => {
    expect(describeSync({ applied: 0, duplicates: 0, conflicts: 0 })).toBe('Nothing was waiting.');
  });

  it('says what is still on the device', () => {
    const line = describeSync({ applied: 3, duplicates: 1, conflicts: 2 });

    expect(line).toContain('3 saved');
    expect(line).toContain('kept on the device');
  });
});
