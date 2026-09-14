import { describe, expect, it } from 'vitest';

import { TRIAL_DAYS } from './signup';
import {
  GRACE_DAYS,
  isWritePermission,
  subscriptionDatesOf,
  subscriptionStateOf,
  trialReminderDue,
} from './subscription';

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
const none = { trialEndsAt: null, subscribedAt: null, suspendedAt: null, cancelledAt: null };

describe('subscriptionStateOf', () => {
  it('is fourteen days', () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it('waits for a card before the trial starts, read-only, and says what the card is for', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-28'), cardOnFile: false },
      at('2026-09-14'),
    );
    expect(s.state).toBe('AWAITING_CARD');
    expect(s.readOnly).toBe(true);
    expect(s.message).toMatch(/Nothing is charged until the trial ends/);
  });

  it('is a trial with days left once a card is on file, and says the card will be charged', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-28'), cardOnFile: true },
      at('2026-09-14'),
    );
    expect(s.state).toBe('TRIAL');
    expect(s.daysLeft).toBe(14);
    expect(s.readOnly).toBe(false);
    expect(s.message).toMatch(/charged when it ends unless you cancel/);
  });

  it('does not refuse an older caller that never asked about cards', () => {
    expect(
      subscriptionStateOf({ ...none, trialEndsAt: at('2026-09-28') }, at('2026-09-14')).state,
    ).toBe('TRIAL');
  });

  it('is grace, still writing, for a fortnight after the trial', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-01'), cardOnFile: true },
      at('2026-09-10'),
    );
    expect(s.state).toBe('GRACE');
    expect(s.readOnly).toBe(false);
    expect(s.daysLeft).toBe(GRACE_DAYS - 9);
  });

  it('goes read-only after the grace, and nothing is deleted', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-01'), cardOnFile: true },
      at('2026-09-30'),
    );
    expect(s.state).toBe('SUSPENDED');
    expect(s.readOnly).toBe(true);
    expect(s.message).toMatch(/kept/);
  });

  it('is active once paid, whatever the trial said', () => {
    const s = subscriptionStateOf(
      { ...none, trialEndsAt: at('2026-09-01'), subscribedAt: at('2026-09-20'), cardOnFile: true },
      at('2026-12-01'),
    );
    expect(s.state).toBe('ACTIVE');
    expect(s.readOnly).toBe(false);
  });

  it('is past due, still writing, when the provider says the payment failed', () => {
    const s = subscriptionStateOf(
      { ...none, subscribedAt: at('2026-09-01'), cardOnFile: true, billingStatus: 'PAST_DUE' },
      at('2026-10-02'),
    );
    expect(s.state).toBe('PAST_DUE');
    expect(s.readOnly).toBe(false);
    expect(s.message).toMatch(/Update the card/);
  });

  it('treats a workshop from before trials were recorded as active', () => {
    expect(subscriptionStateOf(none, at('2026-09-14')).state).toBe('ACTIVE');
  });

  it('keeps a cancelled workshop open until the date it paid to, then closes it', () => {
    const dates = {
      ...none,
      subscribedAt: at('2026-01-01'),
      cancelledAt: at('2026-10-01'),
      cardOnFile: true,
    };
    const before = subscriptionStateOf(dates, at('2026-09-14'));
    expect(before.state).toBe('ACTIVE');
    expect(before.readOnly).toBe(false);
    expect(before.daysLeft).toBe(17);
    expect(before.message).toMatch(/stays open for 17 more days/);
    const after = subscriptionStateOf(dates, at('2026-10-02'));
    expect(after.state).toBe('CANCELLED');
    expect(after.readOnly).toBe(true);
  });

  it('suspended beats a plan', () => {
    expect(
      subscriptionStateOf(
        { ...none, subscribedAt: at('2026-01-01'), suspendedAt: at('2026-06-01') },
        at('2026-09-14'),
      ).readOnly,
    ).toBe(true);
  });

  it('reads the dates off an organisation row', () => {
    const dates = subscriptionDatesOf({
      ...none,
      trialEndsAt: at('2026-09-28'),
      billingSubscriptionRef: 'sub_1',
      billingStatus: 'TRIALING',
    });
    expect(dates.cardOnFile).toBe(true);
    expect(dates.billingStatus).toBe('TRIALING');
    expect(
      subscriptionDatesOf({ ...none, billingSubscriptionRef: null, billingStatus: 'nonsense' })
        .billingStatus,
    ).toBeNull();
  });
});

describe('trialReminderDue', () => {
  const base = {
    trialEndsAt: at('2026-09-28'),
    subscribedAt: null,
    cancelledAt: null,
    cardOnFile: true,
    reminderSentAt: null,
  };

  it('is due three days before the trial ends, and not before', () => {
    expect(trialReminderDue({ ...base, now: at('2026-09-20') })).toBe(false);
    expect(trialReminderDue({ ...base, now: at('2026-09-25') })).toBe(true);
    expect(trialReminderDue({ ...base, now: at('2026-09-27') })).toBe(true);
  });

  it('is never sent twice, after the trial, without a card, or once paid or cancelled', () => {
    expect(
      trialReminderDue({ ...base, now: at('2026-09-26'), reminderSentAt: at('2026-09-25') }),
    ).toBe(false);
    expect(trialReminderDue({ ...base, now: at('2026-09-29') })).toBe(false);
    expect(trialReminderDue({ ...base, now: at('2026-09-26'), cardOnFile: false })).toBe(false);
    expect(
      trialReminderDue({ ...base, now: at('2026-09-26'), subscribedAt: at('2026-09-20') }),
    ).toBe(false);
    expect(
      trialReminderDue({ ...base, now: at('2026-09-26'), cancelledAt: at('2026-09-27') }),
    ).toBe(false);
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
