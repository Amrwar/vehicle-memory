import { assertTransferable, OwnershipError, type OwnerKind, type Ownership } from './transfer';

/**
 * Selling a car to somebody who is not standing at the counter. Phase 44.
 *
 * Recording a transfer at the workshop's counter works when both people are
 * there. Most cars are not sold that way: they are sold on a driveway, and
 * the workshop hears about it weeks later, if at all. So the seller starts
 * the handover, the buyer opens a link and accepts it, and only then does
 * the car change hands.
 *
 * Nothing moves until the buyer accepts, because a transfer the buyer never
 * agreed to is a car taken off somebody's account by a stranger. Nothing
 * about the seller reaches the buyer either: before accepting they are shown
 * the vehicle and how many people have owned it, never who they were.
 *
 * When it is accepted the seller's access ends and the history stays. That
 * is the whole promise of the product in one operation.
 */

export type HandoverState = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

/** How long an invitation stands. Long enough to be read, short enough to end. */
export const HANDOVER_WINDOW_DAYS = 21;

export interface HandoverInvitation {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  toName: string;
  toEmail: string | null;
  toPhone: string | null;
  /** The day the car changed hands, as the seller stated it. */
  on: Date;
  expiresAt: Date;
  /** The portal login of the person selling, where they have one. */
  fromUserId: string | null;
}

/**
 * What an invitation is now, with time taken into account.
 *
 * A pending invitation past its date is expired rather than pending, and the
 * database is not rewritten to say so: the state is a reading of the row, so
 * a clock that is wrong for an hour cannot make somebody's sale disappear.
 */
export function handoverState(
  invitation: Pick<HandoverInvitation, 'status' | 'expiresAt'>,
  now = new Date(),
): HandoverState {
  if (invitation.status !== 'PENDING') return invitation.status;
  return invitation.expiresAt <= now ? 'EXPIRED' : 'PENDING';
}

export interface InviteRequest {
  current: Ownership | null;
  toName: string;
  toKind: OwnerKind;
  on: Date;
  /** Work still open on the vehicle at the workshop starting this. */
  openJobs: number;
  /** Invitations already standing for this vehicle. */
  pending: number;
  force?: boolean;
  now?: Date;
}

/**
 * Whether this invitation can be sent.
 *
 * Every rule that applies to recording a transfer applies to inviting one, so
 * a buyer is never asked to accept something that would then be refused. Two
 * invitations standing at once are refused as well: a car cannot be sold to
 * two people, and whichever accepted first would leave the other holding a
 * link that quietly stopped working.
 */
export function assertHandoverInvitable(request: InviteRequest): void {
  assertTransferable({
    current: request.current,
    toName: request.toName,
    toKind: request.toKind,
    on: request.on,
    openJobs: request.openJobs,
    force: request.force,
    now: request.now,
  });

  if (request.pending > 0) {
    throw new OwnershipError(
      'ALREADY_INVITED',
      'This vehicle already has a handover waiting for the buyer to accept. Cancel that one before starting another.',
    );
  }
}

/**
 * Whether this person can accept this invitation.
 *
 * The seller cannot accept their own: a handover accepted by the person
 * selling is the counter transfer again, without the buyer's agreement that
 * the whole point of the invitation was to get.
 */
export function assertHandoverAcceptable(
  invitation: Pick<HandoverInvitation, 'status' | 'expiresAt' | 'fromUserId'>,
  acceptingUserId: string,
  now = new Date(),
): void {
  const state = handoverState(invitation, now);

  if (state === 'EXPIRED') {
    throw new OwnershipError(
      'EXPIRED',
      'This handover has run out. Ask the seller to start it again.',
    );
  }

  if (state !== 'PENDING') {
    throw new OwnershipError(
      'NOT_PENDING',
      state === 'ACCEPTED'
        ? 'This handover has already been accepted. The vehicle is on your account.'
        : 'This handover is no longer open. Ask the seller to start it again.',
    );
  }

  if (invitation.fromUserId && invitation.fromUserId === acceptingUserId) {
    throw new OwnershipError(
      'SELLER_ACCEPTING',
      'You are the one selling this vehicle. The person buying it opens the link and accepts it themselves.',
    );
  }
}

/**
 * What the buyer is shown before they accept.
 *
 * The car, and how many people have owned it. Not their names, not their
 * telephone numbers, and not what any of them was charged. Somebody deciding
 * whether to accept a car is entitled to know its shape; the people who owned
 * it before are entitled to the rest.
 */
export interface HandoverPreview {
  vehicle: string;
  registration: string | null;
  owners: number;
  /** Entries in the vehicle's history, as a count. */
  entries: number;
  /** Whole months the seller has had it. */
  heldMonths: number;
  on: Date;
  odometerKm: number | null;
}

export function describeHandover(preview: HandoverPreview): string {
  const owners =
    preview.owners <= 1
      ? 'You would be its second recorded owner'
      : `You would be owner ${preview.owners + 1} on record`;
  const held =
    preview.heldMonths >= 12
      ? `${Math.floor(preview.heldMonths / 12)} year${preview.heldMonths >= 24 ? 's' : ''}`
      : `${preview.heldMonths} month${preview.heldMonths === 1 ? '' : 's'}`;

  const entries =
    preview.entries === 1
      ? '1 entry, which stays with the car'
      : `${preview.entries} entries, which stay with the car`;

  return `${owners}. The seller has had it ${held}, and its history carries ${entries}.`;
}
