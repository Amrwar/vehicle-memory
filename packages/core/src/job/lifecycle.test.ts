import { describe, expect, it } from 'vitest';

import {
  allowedTransitions,
  assertTransition,
  checkTransition,
  isInShop,
  isTerminal,
  JOB_STATUSES,
  JobTransitionError,
  type JobStatus,
  progressFor,
  toneFor,
} from './lifecycle';

describe('permitted transitions', () => {
  it('walks the happy path from received to paid', () => {
    const path: JobStatus[] = [
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
      'PAID',
    ];

    for (let i = 0; i < path.length - 1; i += 1) {
      const result = checkTransition(path[i]!, path[i + 1]!, {
        hasPassedQualityCheck: true,
        hasApprovedEstimate: true,
        hasChargeableLines: true,
      });
      expect(result.ok, `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it('supports the walk-in path that skips inspection and estimate', () => {
    expect(checkTransition('RECEIVED', 'IN_PROGRESS').ok).toBe(true);
  });

  it('rejects a jump from draft straight to invoiced', () => {
    const result = checkTransition('DRAFT', 'INVOICED');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('ILLEGAL_TRANSITION');
      // The message must say what IS allowed, so the UI can explain itself.
      expect(result.message).toContain('Booked');
    }
  });

  it('allows a job to go backwards when a second fault is found', () => {
    // Workshops are not assembly lines. A state machine that only moves
    // forward gets worked around, and then the data is worthless.
    expect(checkTransition('IN_PROGRESS', 'DIAGNOSED').ok).toBe(true);
    expect(checkTransition('AWAITING_APPROVAL', 'ESTIMATED').ok).toBe(true);
    expect(checkTransition('COMPLETED', 'IN_PROGRESS').ok).toBe(true);
  });

  it('treats paid and cancelled as terminal', () => {
    expect(isTerminal('PAID')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(allowedTransitions('PAID')).toHaveLength(0);

    const result = checkTransition('PAID', 'INVOICED');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TERMINAL_STATUS');
  });

  it('cannot cancel a job that has already been invoiced', () => {
    // The correction for an issued invoice is a credit note, not a deletion.
    expect(checkTransition('INVOICED', 'CANCELLED').ok).toBe(false);
    expect(checkTransition('PAID', 'CANCELLED').ok).toBe(false);
  });

  it('can cancel from every status before completion', () => {
    const cancellable: JobStatus[] = [
      'DRAFT', 'BOOKED', 'RECEIVED', 'INSPECTING', 'DIAGNOSED',
      'ESTIMATED', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK',
    ];
    for (const status of cancellable) {
      expect(checkTransition(status, 'CANCELLED').ok, status).toBe(true);
    }
  });

  it('never allows a transition to itself', () => {
    for (const status of JOB_STATUSES) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });
});

describe('transition guards', () => {
  it('blocks completion when a quality check is required and missing', () => {
    const result = checkTransition('QUALITY_CHECK', 'COMPLETED', {
      requiresQualityCheck: true,
      hasPassedQualityCheck: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('QUALITY_CHECK_REQUIRED');
  });

  it('allows completion when the quality check has passed', () => {
    expect(
      checkTransition('QUALITY_CHECK', 'COMPLETED', {
        requiresQualityCheck: true,
        hasPassedQualityCheck: true,
      }).ok,
    ).toBe(true);
  });

  it('allows completion when the job type does not demand a check', () => {
    expect(
      checkTransition('IN_PROGRESS', 'COMPLETED', { requiresQualityCheck: false }).ok,
    ).toBe(true);
  });

  it('refuses to invoice a job with nothing chargeable on it', () => {
    const result = checkTransition('COMPLETED', 'INVOICED', { hasChargeableLines: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOTHING_TO_INVOICE');
  });
});

describe('assertTransition', () => {
  it('throws with the context needed to explain the failure', () => {
    try {
      assertTransition('DRAFT', 'PAID');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JobTransitionError);
      const typed = error as JobTransitionError;
      expect(typed.from).toBe('DRAFT');
      expect(typed.to).toBe('PAID');
      expect(typed.code).toBe('ILLEGAL_TRANSITION');
      expect(typed.allowed.length).toBeGreaterThan(0);
    }
  });

  it('does not throw on a legal transition', () => {
    expect(() => assertTransition('RECEIVED', 'INSPECTING')).not.toThrow();
  });
});

describe('progress trail', () => {
  it('marks earlier stages done, the current one current, and later ones upcoming', () => {
    const stages = progressFor('AWAITING_APPROVAL', [
      'RECEIVED', 'INSPECTING', 'DIAGNOSED', 'ESTIMATED',
    ]);

    const byStatus = Object.fromEntries(stages.map((s) => [s.status, s.state]));
    expect(byStatus.RECEIVED).toBe('done');
    expect(byStatus.ESTIMATED).toBe('done');
    expect(byStatus.AWAITING_APPROVAL).toBe('current');
    expect(byStatus.IN_PROGRESS).toBe('upcoming');
    expect(byStatus.PAID).toBe('upcoming');
  });

  it('marks stages that were genuinely skipped', () => {
    // A walk-in repair that never had an inspection or an estimate.
    const stages = progressFor('IN_PROGRESS', ['RECEIVED']);
    const byStatus = Object.fromEntries(stages.map((s) => [s.status, s.state]));

    expect(byStatus.RECEIVED).toBe('done');
    expect(byStatus.INSPECTING).toBe('skipped');
    expect(byStatus.ESTIMATED).toBe('skipped');
    expect(byStatus.IN_PROGRESS).toBe('current');
  });

  it('shows what was reached before cancellation', () => {
    const stages = progressFor('CANCELLED', ['RECEIVED', 'INSPECTING']);
    const byStatus = Object.fromEntries(stages.map((s) => [s.status, s.state]));

    expect(byStatus.RECEIVED).toBe('done');
    expect(byStatus.INSPECTING).toBe('done');
    expect(byStatus.COMPLETED).toBe('skipped');
    expect(stages.some((s) => s.state === 'current')).toBe(false);
  });

  it('gives every stage a human label', () => {
    for (const stage of progressFor('RECEIVED')) {
      expect(stage.label).toBeTruthy();
      expect(stage.label).not.toBe(stage.status);
    }
  });
});

describe('presentation helpers', () => {
  it('flags the statuses meaning the car is physically here', () => {
    expect(isInShop('IN_PROGRESS')).toBe(true);
    expect(isInShop('BOOKED')).toBe(false);
    expect(isInShop('PAID')).toBe(false);
  });

  it('assigns a tone to every status', () => {
    for (const status of JOB_STATUSES) {
      expect(toneFor(status)).toBeTruthy();
    }
  });

  it('uses a warning tone only where the workshop is blocked on the customer', () => {
    expect(toneFor('AWAITING_APPROVAL')).toBe('warning');
  });
});
