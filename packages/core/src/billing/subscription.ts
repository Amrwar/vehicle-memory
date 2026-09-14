/**
 * Where a workshop stands with us. Phase 31, billed in Phase 32.6.
 *
 * A card, then a trial, then a plan charged to the card, then perhaps a
 * lapse. The state is read from dates rather than stored, so it cannot
 * drift from the facts, and so a workshop that comes back after lapsing
 * finds its data where it left it: nothing is deleted at any point in this
 * machine. What a lapsed workshop loses is the ability to write, not the
 * ability to read or leave.
 *
 * The card comes first, on purpose and in the open: the trial is free, the
 * card is charged on the day it ends unless the workshop cancels before
 * then, and both of those sentences are on the sign-up form, in the
 * welcome email, in a reminder three days before, and on the billing page.
 * A trial that quietly turns into a charge is the thing this file exists
 * to make impossible.
 */

import { TRIAL_DAYS } from './signup';

export const GRACE_DAYS = 14;
/** Days before the trial ends that the workshop is reminded the card will be charged. */
export const TRIAL_REMINDER_DAYS = 3;

export type SubscriptionState =
  'AWAITING_CARD' | 'TRIAL' | 'GRACE' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export type BillingStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE';

export interface SubscriptionDates {
  /** When the free trial ends. Null for an organisation from before trials were recorded. */
  trialEndsAt: Date | null;
  /** When a plan was chosen, or the first charge was paid. */
  subscribedAt: Date | null;
  /** Stopped by us, with a reason kept elsewhere. */
  suspendedAt: Date | null;
  /** Stopped by the workshop. In the future when it ends at the period's end. */
  cancelledAt: Date | null;
  /** Whether the provider holds a card for the workshop. Undefined means "not asked", for older callers. */
  cardOnFile?: boolean;
  /** What the provider last said about the subscription. */
  billingStatus?: BillingStatus | null;
}

export interface Subscription {
  state: SubscriptionState;
  /** Days left of the trial, or of the grace period, or until a cancellation ends; null when none applies. */
  daysLeft: number | null;
  /** Writes are refused. Reading and exporting never are. */
  readOnly: boolean;
  /** One sentence for the person, in the product's words. */
  message: string;
}

const DAY = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY));
}

export function subscriptionStateOf(dates: SubscriptionDates, now = new Date()): Subscription {
  if (dates.cancelledAt && dates.cancelledAt <= now) {
    return {
      state: 'CANCELLED',
      daysLeft: null,
      readOnly: true,
      message:
        'This workshop cancelled its subscription. Everything is kept and can be read and exported; choosing a plan reopens it.',
    };
  }
  if (dates.suspendedAt) {
    return {
      state: 'SUSPENDED',
      daysLeft: null,
      readOnly: true,
      message:
        'This workshop is suspended. Everything is kept and can be read and exported; get in touch to reopen it.',
    };
  }
  // Cancelled, but paid to a date: everything works until then, and the
  // page says so rather than cutting the workshop off before what it paid for.
  if (dates.cancelledAt) {
    const left = daysBetween(now, dates.cancelledAt);
    return {
      state: 'ACTIVE',
      daysLeft: left,
      readOnly: false,
      message: `Cancelled. The workshop stays open for ${left} more ${left === 1 ? 'day' : 'days'}, then becomes read-only. Nothing is deleted.`,
    };
  }
  if (dates.subscribedAt) {
    if (dates.billingStatus === 'PAST_DUE') {
      return {
        state: 'PAST_DUE',
        daysLeft: null,
        readOnly: false,
        message:
          'The last payment did not go through. Update the card on the billing page; the provider will try again.',
      };
    }
    return { state: 'ACTIVE', daysLeft: null, readOnly: false, message: 'On a plan.' };
  }
  // A workshop from before trials were recorded is treated as one that has
  // paid its way: refusing it now would punish it for our earlier silence.
  if (!dates.trialEndsAt) {
    return { state: 'ACTIVE', daysLeft: null, readOnly: false, message: 'On a plan.' };
  }
  // The card comes before the trial. Asked explicitly, so an older caller
  // that does not know about cards is not refused by accident.
  if (dates.cardOnFile === false) {
    return {
      state: 'AWAITING_CARD',
      daysLeft: null,
      readOnly: true,
      message: `Add a card to start the ${TRIAL_DAYS}-day free trial. Nothing is charged until the trial ends, and cancelling before then costs nothing.`,
    };
  }
  if (now <= dates.trialEndsAt) {
    const left = daysBetween(now, dates.trialEndsAt);
    return {
      state: 'TRIAL',
      daysLeft: left,
      readOnly: false,
      message:
        left <= 1
          ? 'The trial ends today. The card on file is charged for the first month unless you cancel.'
          : `${left} days left of the ${TRIAL_DAYS}-day trial. The card on file is charged when it ends unless you cancel before.`,
    };
  }
  const graceEnds = new Date(dates.trialEndsAt.getTime() + GRACE_DAYS * DAY);
  if (now <= graceEnds) {
    const left = daysBetween(now, graceEnds);
    return {
      state: 'GRACE',
      daysLeft: left,
      readOnly: false,
      message: `The trial has ended and the first payment has not been confirmed. ${left} ${left === 1 ? 'day' : 'days'} before the workshop goes read-only.`,
    };
  }
  return {
    state: 'SUSPENDED',
    daysLeft: null,
    readOnly: true,
    message:
      'The trial ended and no payment was made, so the workshop is read-only. Everything is kept; choosing a plan reopens it.',
  };
}

/** The version of the terms a workshop accepts at sign-up. Bump on any change of substance. */
export const TERMS_VERSION = '2026-09-14';

const BILLING_STATUSES: readonly BillingStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'INCOMPLETE',
];

/** The dates the state is read from, off an organisation row as the database holds it. */
export function subscriptionDatesOf(org: {
  trialEndsAt: Date | null;
  subscribedAt: Date | null;
  suspendedAt: Date | null;
  cancelledAt: Date | null;
  billingSubscriptionRef?: string | null;
  billingStatus?: string | null;
}): SubscriptionDates {
  return {
    trialEndsAt: org.trialEndsAt,
    subscribedAt: org.subscribedAt,
    suspendedAt: org.suspendedAt,
    cancelledAt: org.cancelledAt,
    cardOnFile: Boolean(org.billingSubscriptionRef),
    billingStatus: BILLING_STATUSES.includes(org.billingStatus as BillingStatus)
      ? (org.billingStatus as BillingStatus)
      : null,
  };
}

/** Whether a trial is close enough to its end that the workshop should be reminded of the charge. */
export function trialReminderDue(input: {
  trialEndsAt: Date | null;
  subscribedAt: Date | null;
  cancelledAt: Date | null;
  cardOnFile: boolean;
  reminderSentAt: Date | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (!input.trialEndsAt || input.subscribedAt || input.cancelledAt || !input.cardOnFile)
    return false;
  if (input.reminderSentAt) return false;
  if (input.trialEndsAt <= now) return false;
  return input.trialEndsAt.getTime() - now.getTime() <= TRIAL_REMINDER_DAYS * DAY;
}

/** Permissions that change something. A read-only workshop refuses these and no others. */
export function isWritePermission(permission: string): boolean {
  return /:(write|complete|send|approve|request|transfer|share|manage)$/.test(permission);
}
