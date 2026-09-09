import { type Role, ROLES } from '../access/roles';

/**
 * Adding somebody to a workshop.
 *
 * Until now the only way to create a second user was a database write, which
 * means in practice a workshop could not add its second user. That is not a
 * missing feature so much as a missing assumption: everything built so far
 * assumed the person was already inside and knew what they were doing.
 *
 * Two rules carry the weight here. An invitation is a capability, so the token
 * is random and only its digest is stored. And nobody may invite somebody more
 * powerful than themselves, because an invitation that can grant ownership is
 * a privilege escalation with a friendly form around it.
 */

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface Invitation {
  email: string;
  role: Role;
  locationId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

export class InvitationError extends Error {
  readonly code:
    | 'ROLE_TOO_HIGH'
    | 'CANNOT_INVITE'
    | 'ALREADY_MEMBER'
    | 'EXPIRED'
    | 'ALREADY_USED'
    | 'REVOKED'
    | 'BAD_EMAIL'
    | 'LAST_OWNER';

  constructor(code: InvitationError['code'], message: string) {
    super(message);
    this.name = 'InvitationError';
    this.code = code;
  }
}

/** How long an invitation stays open. */
export const INVITATION_DAYS = 7;

export function invitationExpiry(from: Date = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + INVITATION_DAYS);
  return expires;
}

/**
 * Seniority, for deciding who may invite whom.
 *
 * Not a general ranking of importance: a technician is not "worth less" than a
 * bookkeeper. This is strictly about how much of the organisation a role can
 * change, which is the only thing that matters when deciding whether somebody
 * may hand it out.
 */
const SENIORITY: Record<Role, number> = {
  OWNER: 100,
  MANAGER: 80,
  BOOKKEEPER: 50,
  SERVICE_ADVISOR: 40,
  TECHNICIAN: 20,
  CUSTOMER: 0,
};

export function seniorityOf(role: Role): number {
  return SENIORITY[role];
}

/** Roles a given role is allowed to hand out. */
export function invitableRoles(inviter: Role): Role[] {
  if (!canInvite(inviter)) return [];

  return ROLES.filter((role) => role !== 'CUSTOMER' && SENIORITY[role] <= SENIORITY[inviter]);
}

export function canInvite(role: Role): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/**
 * Whether an invitation may be sent.
 *
 * An owner may create another owner; that is a real thing a partnership needs.
 * A manager may not, because otherwise the weakest role that can invite can
 * promote itself in two steps.
 */
export function assertMayInvite(inviter: Role, invited: Role): void {
  if (!canInvite(inviter)) {
    throw new InvitationError(
      'CANNOT_INVITE',
      'Only an owner or a manager can invite somebody to the workshop.',
    );
  }

  if (invited === 'CUSTOMER') {
    throw new InvitationError(
      'ROLE_TOO_HIGH',
      'Customers are not staff. They get access through the portal instead.',
    );
  }

  if (SENIORITY[invited] > SENIORITY[inviter]) {
    throw new InvitationError(
      'ROLE_TOO_HIGH',
      `${sentenceCase(humanRole(inviter))} cannot invite somebody as ${humanRole(invited)}.`,
    );
  }
}

/* ---------------------------------------------------------------------------
   Acceptance
   --------------------------------------------------------------------------- */

export function statusOf(invitation: Invitation, asOf: Date = new Date()): InvitationStatus {
  if (invitation.acceptedAt) return 'ACCEPTED';
  if (invitation.revokedAt) return 'REVOKED';
  if (invitation.expiresAt <= asOf) return 'EXPIRED';
  return 'PENDING';
}

/**
 * Whether an invitation can still be accepted, and why not if it cannot.
 *
 * Each refusal names what happened rather than saying the link is invalid.
 * "Invalid link" is the message that makes somebody email support, because it
 * describes the system's opinion rather than their situation.
 */
export function assertAcceptable(invitation: Invitation, asOf: Date = new Date()): void {
  switch (statusOf(invitation, asOf)) {
    case 'ACCEPTED':
      throw new InvitationError(
        'ALREADY_USED',
        'This invitation has already been used. Sign in instead.',
      );
    case 'REVOKED':
      throw new InvitationError(
        'REVOKED',
        'This invitation was withdrawn. Ask whoever sent it for a new one.',
      );
    case 'EXPIRED':
      throw new InvitationError(
        'EXPIRED',
        `Invitations last ${INVITATION_DAYS} days and this one has run out. Ask for another.`,
      );
    case 'PENDING':
      return;
  }
}

/**
 * The address on the invitation is the address that may accept it.
 *
 * Otherwise a forwarded email lets somebody join a workshop under a name
 * nobody chose, and every record that person writes carries it.
 */
export function assertEmailMatches(invitation: Invitation, email: string): void {
  if (invitation.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new InvitationError(
      'BAD_EMAIL',
      `This invitation was sent to ${invitation.email}. Sign in with that address, or ask for one addressed to you.`,
    );
  }
}

/* ---------------------------------------------------------------------------
   Changing and removing people
   --------------------------------------------------------------------------- */

/**
 * Whether a role change is allowed.
 *
 * The rule is the same as inviting, plus one more: nobody may change their own
 * role. A manager quietly promoting themselves to owner is the exact thing
 * roles exist to prevent, and it is easy to miss because the form looks
 * identical to changing anybody else.
 */
export function assertMayChangeRole(input: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetCurrentRole: Role;
  targetNewRole: Role;
}): void {
  if (input.actorUserId === input.targetUserId) {
    throw new InvitationError(
      'CANNOT_INVITE',
      'You cannot change your own role. Ask another owner.',
    );
  }

  if (!canInvite(input.actorRole)) {
    throw new InvitationError('CANNOT_INVITE', 'Only an owner or a manager can change a role.');
  }

  if (SENIORITY[input.targetCurrentRole] > SENIORITY[input.actorRole]) {
    throw new InvitationError(
      'ROLE_TOO_HIGH',
      `${sentenceCase(humanRole(input.actorRole))} cannot change an owner's role.`,
    );
  }

  if (SENIORITY[input.targetNewRole] > SENIORITY[input.actorRole]) {
    throw new InvitationError(
      'ROLE_TOO_HIGH',
      `${sentenceCase(humanRole(input.actorRole))} cannot make somebody ${humanRole(input.targetNewRole)}.`,
    );
  }
}

/**
 * A workshop must keep at least one active owner.
 *
 * Locking everybody out of their own organisation is a recoverable problem
 * only with a support call and a database write, so it is refused here.
 */
export function assertNotLastOwner(input: {
  targetRole: Role;
  activeOwners: number;
  action: 'deactivate' | 'demote';
}): void {
  if (input.targetRole !== 'OWNER') return;
  if (input.activeOwners > 1) return;

  throw new InvitationError(
    'LAST_OWNER',
    input.action === 'deactivate'
      ? 'This is the only owner. Make somebody else an owner first, or nobody can administer the workshop.'
      : 'This is the only owner, so their role cannot be lowered. Promote somebody else first.',
  );
}

/** "a manager" becomes "A manager", so a sentence does not start "A a". */
function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanRole(role: Role): string {
  switch (role) {
    case 'OWNER':
      return 'an owner';
    case 'MANAGER':
      return 'a manager';
    case 'SERVICE_ADVISOR':
      return 'a service advisor';
    case 'TECHNICIAN':
      return 'a technician';
    case 'BOOKKEEPER':
      return 'a bookkeeper';
    case 'CUSTOMER':
      return 'a customer';
  }
}
