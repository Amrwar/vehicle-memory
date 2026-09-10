import { type Money, money, zero } from '../shared/money';

/**
 * A customer deciding what work to have done.
 *
 * This is the one screen in the product where the person using it is not a
 * professional, is often standing in a car park, and is being asked for money.
 * Everything here follows from that.
 *
 * The decision is per line, not per estimate. An estimate offered as one
 * take-it-or-leave-it figure gets declined whole, and the workshop loses the
 * three items the customer would have said yes to. Splitting it is worth more
 * to the workshop than it costs.
 *
 * Nothing is preselected. A screen that arrives with every box already ticked
 * is not asking, it is assuming, and the approval it produces is worth nothing
 * if it is ever disputed.
 *
 * A safety-critical item can be declined. It is the customer's car. What the
 * system must do is make sure they were told, and record that they were told,
 * which is a different thing from refusing to let them.
 */

export type Decision = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface DecidableLine {
  id: string;
  description: string;
  /** What it comes to, in minor units, tax included. */
  totalMinor: number;
  /** Optional work can be left; the rest is what the workshop recommends. */
  isOptional: boolean;
  /** Set when the line came from an inspection item marked critical. */
  isSafetyCritical: boolean;
  decision: Decision;
}

export type EstimateState =
  'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DECLINED' | 'EXPIRED' | 'SUPERSEDED';

export class DecisionError extends Error {
  readonly code: 'NOT_OPEN' | 'EXPIRED' | 'NOTHING_CHOSEN' | 'UNKNOWN_LINE';

  constructor(code: DecisionError['code'], message: string) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
  }
}

/**
 * Whether this estimate can still be answered, in words the customer gets.
 *
 * The distinction that matters is between an estimate that has gone stale and
 * one that has been replaced. "This quote has expired" invites a phone call.
 * "Your workshop has sent an updated quote" tells somebody where to look, and
 * they are not the same message.
 */
export function assertDecidable(input: {
  status: EstimateState;
  validUntil: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.status === 'SUPERSEDED') {
    throw new DecisionError(
      'NOT_OPEN',
      'Your workshop has sent an updated quote, so this one no longer applies.',
    );
  }

  if (input.status === 'APPROVED' || input.status === 'PARTIALLY_APPROVED') {
    throw new DecisionError('NOT_OPEN', 'You have already answered this quote.');
  }

  if (input.status === 'DECLINED') {
    throw new DecisionError(
      'NOT_OPEN',
      'This quote was declined. Your workshop can send a new one.',
    );
  }

  if (input.status === 'DRAFT') {
    throw new DecisionError('NOT_OPEN', 'Your workshop has not sent this quote yet.');
  }

  if (input.status === 'EXPIRED' || (input.validUntil && input.validUntil < now)) {
    throw new DecisionError(
      'EXPIRED',
      'This quote has expired. Ask your workshop to send it again and they will confirm the price.',
    );
  }
}

export interface DecisionOutcome {
  approvedIds: string[];
  declinedIds: string[];
  approved: Money;
  declined: Money;
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DECLINED';
  /** Declined lines the customer was warned about, kept for the record. */
  declinedSafetyCritical: DecidableLine[];
}

/**
 * Turns a set of ticked boxes into a decision.
 *
 * Everything not ticked is declined, explicitly. Leaving a line pending would
 * mean the workshop has to ring to find out, which is the phone call the whole
 * screen exists to avoid.
 */
export function decide(
  lines: readonly DecidableLine[],
  approvedIds: readonly string[],
  currency = 'GBP',
): DecisionOutcome {
  const known = new Set(lines.map((line) => line.id));

  for (const id of approvedIds) {
    if (!known.has(id)) {
      throw new DecisionError('UNKNOWN_LINE', 'Part of this quote has changed. Please reload it.');
    }
  }

  const chosen = new Set(approvedIds);
  const approved = lines.filter((line) => chosen.has(line.id));
  const declined = lines.filter((line) => !chosen.has(line.id));

  const approvedMinor = approved.reduce((total, line) => total + line.totalMinor, 0);
  const declinedMinor = declined.reduce((total, line) => total + line.totalMinor, 0);

  const status =
    approved.length === 0 ? 'DECLINED' : declined.length === 0 ? 'APPROVED' : 'PARTIALLY_APPROVED';

  return {
    approvedIds: approved.map((line) => line.id),
    declinedIds: declined.map((line) => line.id),
    approved: approvedMinor === 0 ? zero(currency) : money(approvedMinor, currency),
    declined: declinedMinor === 0 ? zero(currency) : money(declinedMinor, currency),
    status,
    declinedSafetyCritical: declined.filter((line) => line.isSafetyCritical),
  };
}

/**
 * What to say before a decision is committed.
 *
 * Written as a statement of consequence rather than as a warning, because a
 * warning gets dismissed. Somebody declining a brake pipe should read what
 * happens next, not be told they are making a mistake.
 */
export function confirmationFor(outcome: DecisionOutcome): string {
  if (outcome.status === 'DECLINED') {
    return 'You are turning down all of this work. Your workshop will be told, and nothing will be done.';
  }

  const safety =
    outcome.declinedSafetyCritical.length > 0
      ? ` ${outcome.declinedSafetyCritical.length === 1 ? 'One item you are leaving was' : `${outcome.declinedSafetyCritical.length} items you are leaving were`} marked as a safety concern by the technician, and ${outcome.declinedSafetyCritical.length === 1 ? 'it' : 'they'} will stay on the vehicle's record.`
      : '';

  return outcome.status === 'APPROVED'
    ? 'You are approving all of this work. Your workshop will start once they have the parts.'
    : `You are approving part of this quote and turning down the rest.${safety}`;
}

/**
 * The sentence a customer sees about a job in progress.
 *
 * Status names are written for the workshop. "Quality check" means something
 * precise to a service manager and nothing at all to the person waiting for
 * their car, whose only question is when they can have it back.
 */
export function customerProgressFor(status: string): {
  label: string;
  detail: string;
  done: boolean;
} {
  switch (status) {
    case 'BOOKED':
      return { label: 'Booked in', detail: 'We have your slot.', done: false };
    case 'RECEIVED':
      return { label: 'With us', detail: 'Your car has arrived and is booked in.', done: false };
    case 'INSPECTING':
    case 'DIAGNOSED':
      return { label: 'Being looked at', detail: 'A technician is checking it over.', done: false };
    case 'ESTIMATED':
    case 'AWAITING_APPROVAL':
      return {
        label: 'Waiting on you',
        detail: 'There is a quote for you to look at.',
        done: false,
      };
    case 'APPROVED':
      return { label: 'Approved', detail: 'Work will start shortly.', done: false };
    case 'IN_PROGRESS':
      return { label: 'Being worked on', detail: 'The work is under way.', done: false };
    case 'QUALITY_CHECK':
      return {
        label: 'Almost ready',
        detail: 'The work is done and is being checked before you collect it.',
        done: false,
      };
    case 'COMPLETED':
      return { label: 'Ready', detail: 'Your car is ready to collect.', done: true };
    case 'INVOICED':
      return { label: 'Invoiced', detail: 'There is an invoice for this visit.', done: true };
    case 'PAID':
      return { label: 'Settled', detail: 'Paid in full. Thank you.', done: true };
    case 'CANCELLED':
      return { label: 'Cancelled', detail: 'This visit was cancelled.', done: true };
    default:
      return { label: 'Booked in', detail: 'We have your slot.', done: false };
  }
}
