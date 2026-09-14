import { describe, expect, it } from 'vitest';

import { GRACE_DAYS, isWritePermission, subscriptionStateOf } from './subscription';

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
const none = { trialEndsAt: null, subscribedAt: null, suspendedAt: null, cancelledAt: null };

describe('subscriptionStateOf', () => {
  it('is a trial with days left before the trial ends', () => {
    const s = subscriptionStateOf({ ...none, trialEndsAt: at('2026-10-14') }, at('2026-09-14'));
    expect(s.state).toBe('TRIAL');
    expect(s.daysLeft).toBe(30);
    expect(s.readOnly).toBe(false);
  });

  it('is grace, still writing, for a fortnight after the trial', () => {
    const s = subscriptionStateOf({ ...none, trialEndsAt: at('2026-09-01') }, at('2026-09-10'));
    expect(s.state).toBe('GRACE');
    expect(s.readOnly).toBe(false);
    expect(s.daysLeft).toBe(GRACE_DAYS - 9);
  });

  it('goes read-only after the grace, and nothing is deleted', () => {
    const s = subscriptionStateOf({ ...none, trialEndsAt: at('2026-09-01') }, at('2026-09-30'));
    expect(s.state).toBe('SUSPENDED');
    expect(s.readOnly).toBe(true);
    expect(s.message).toMatch(/kept/);
  });

  it('is active once a plan is chosen, whatever the trial said', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-01'), subscribedAt: at('2026-09-20') },
      at('2026-12-01'),
    );
    expect(s.state).toBe('ACTIVE');
    expect(s.readOnly).toBe(false);
  });

  it('treats a workshop from before trials were recorded as active', () => {
    expect(subscriptionStateOf(none, at('2026-09-14')).state).toBe('ACTIVE');
  });

  it('cancelled beats everything, and suspended beats a plan', () => {
    expect(
      subscriptionStateOf(
        { ...none, subscribedAt: at('2026-01-01'), cancelledAt: at('2026-06-01') },
        at('2026-09-14'),
      ).state,
    ).toBe('CANCELLED');
    expect(
      subscriptionStateOf(
        { ...none, subscribedAt: at('2026-01-01'), suspendedAt: at('2026-06-01') },
        at('2026-09-14'),
      ).readOnly,
    ).toBe(true);
  });
});

describe('isWritePermission', () => {
  it('knows a write from a read', () => {
    expect(isWritePermission('job:write')).toBe(true);
    expect(isWritePermission('payroll:approve')).toBe(true);
    expect(isWritePermission('passport:transfer')).toBe(true);
    expect(isWritePermission('job:read')).toBe(false);
    expect(isWritePermission('job:read:assigned')).toBe(false);
    expect(isWritePermission('report:financial')).toBe(false);
  });
});
