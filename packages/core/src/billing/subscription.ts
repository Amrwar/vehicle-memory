/**
 * Where a workshop stands with us. Phase 31.
 *
 * A trial, then a plan, then perhaps a lapse. The state is read from four
 * dates rather than stored, so it cannot drift from the facts, and so a
 * workshop that comes back after lapsing finds its data where it left it:
 * nothing is deleted at any point in this machine. What a lapsed workshop
 * loses is the ability to write, not the ability to read or leave.
 *
 * There is no payment provider yet. Choosing a plan records the choice and
 * the date; the money side is a later phase, and this file is written so
 * that phase adds a state rather than rewriting these.
 */

import { TRIAL_DAYS } from './signup';

export const GRACE_DAYS = 14;

export type SubscriptionState = 'TRIAL' | 'GRACE' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export interface SubscriptionDates {
  /** When the free trial ends. Null for an organisation from before trials were recorded. */
  trialEndsAt: Date | null;
  /** When a plan was chosen. */
  subscribedAt: Date | null;
  /** Stopped by us, with a reason kept elsewhere. */
  suspendedAt: Date | null;
  /** Stopped by the workshop. */
  cancelledAt: Date | null;
}

export interface Subscription {
  state: SubscriptionState;
  /** Days left of the trial, or of the grace period; null when neither applies. */
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
  if (dates.cancelledAt) {
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
  if (dates.subscribedAt) {
    return {
      state: 'ACTIVE',
      daysLeft: null,
      readOnly: false,
      message: 'On a plan.',
    };
  }
  // A workshop from before trials were recorded is treated as one that has
  // paid its way: refusing it now would punish it for our earlier silence.
  if (!dates.trialEndsAt) {
    return { state: 'ACTIVE', daysLeft: null, readOnly: false, message: 'On a plan.' };
  }
  if (now <= dates.trialEndsAt) {
    const left = daysBetween(now, dates.trialEndsAt);
    return {
      state: 'TRIAL',
      daysLeft: left,
      readOnly: false,
      message:
        left <= 1
          ? 'The trial ends today. Choose a plan to keep writing.'
          : `${left} days left of the ${TRIAL_DAYS}-day trial.`,
    };
  }
  const graceEnds = new Date(dates.trialEndsAt.getTime() + GRACE_DAYS * DAY);
  if (now <= graceEnds) {
    const left = daysBetween(now, graceEnds);
    return {
      state: 'GRACE',
      daysLeft: left,
      readOnly: false,
      message: `The trial has ended. ${left} ${left === 1 ? 'day' : 'days'} to choose a plan before the workshop goes read-only.`,
    };
  }
  return {
    state: 'SUSPENDED',
    daysLeft: null,
    readOnly: true,
    message:
      'The trial ended and no plan was chosen, so the workshop is read-only. Everything is kept; choosing a plan reopens it.',
  };
}

/** Permissions that change something. A read-only workshop refuses these and no others. */
export function isWritePermission(permission: string): boolean {
  return /:(write|complete|send|approve|request|transfer|share|manage)$/.test(permission);
}
