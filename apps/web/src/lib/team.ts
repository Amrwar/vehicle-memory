import { createHash, randomBytes } from 'node:crypto';

import {
  assertAcceptable,
  assertMayChangeRole,
  assertMayInvite,
  assertNotLastOwner,
  invitationExpiry,
  type InvitationError,
  type Role,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The team, against the database.
 *
 * An invitation is a capability: the link is the credential, so the token is
 * random and only its digest is stored. Same treatment as a session and a
 * passport share. A database disclosure must not hand somebody a way into a
 * workshop they were never invited to.
 */

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export interface InviteResult {
  ok: boolean;
  error?: string;
  /** Only returned once, at creation. It is never recoverable afterwards. */
  token?: string;
}

export async function inviteColleague(input: {
  orgId: string;
  actorUserId: string;
  actorRole: Role;
  email: string;
  role: Role;
  locationId?: string | null;
  message?: string | null;
}): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();

  try {
    assertMayInvite(input.actorRole, input.role);
  } catch (error) {
    return { ok: false, error: (error as InvitationError).message };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  // Somebody already inside does not need an invitation, and sending one
  // implies their access is about to change when it is not.
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { orgId: input.orgId, isActive: true } } },
  });

  if (existing && existing.memberships.length > 0) {
    return { ok: false, error: 'That person is already in this workshop.' };
  }

  const open = await prisma.invitation.findFirst({
    where: { orgId: input.orgId, email, acceptedAt: null, revokedAt: null },
  });

  if (open) {
    return {
      ok: false,
      error: 'There is already an open invitation to that address. Withdraw it first to change it.',
    };
  }

  const token = randomBytes(32).toString('base64url');

  const invitation = await prisma.invitation.create({
    data: {
      orgId: input.orgId,
      email,
      role: input.role,
      locationId: input.locationId ?? null,
      tokenHash: digest(token),
      invitedByUserId: input.actorUserId,
      message: input.message?.trim() || null,
      expiresAt: invitationExpiry(),
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'invitation.sent',
    entityType: 'Invitation',
    entityId: invitation.id,
    after: { email, role: input.role } as never,
  });

  return { ok: true, token };
}

export async function revokeInvitation(input: {
  orgId: string;
  actorUserId: string;
  invitationId: string;
}): Promise<void> {
  const invitation = await prisma.invitation.findFirst({
    where: { id: input.invitationId, orgId: input.orgId, acceptedAt: null },
  });

  if (!invitation) return;

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'invitation.revoked',
    entityType: 'Invitation',
    entityId: invitation.id,
    before: { email: invitation.email, role: invitation.role } as never,
  });
}

/** The invitation behind a link, with the workshop it is for. */
export async function invitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash: digest(token) },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
  });
}

export interface AcceptResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

/**
 * Accepting an invitation.
 *
 * Creates the person if they are new, or attaches an existing account. Both
 * paths end in one membership and one employee record, in one transaction, so
 * a failure halfway does not leave somebody who can sign in to nothing.
 */
export async function acceptInvitation(input: {
  token: string;
  name: string;
  password: string;
}): Promise<AcceptResult> {
  const invitation = await invitationByToken(input.token);

  if (!invitation) {
    return { ok: false, error: 'That invitation link is not one we issued.' };
  }

  try {
    assertAcceptable(invitation);
  } catch (error) {
    return { ok: false, error: (error as InvitationError).message };
  }

  const { hashPassword } = await import('./auth');
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });

  if (!existing && input.password.length < 10) {
    return { ok: false, error: 'Choose a password of at least 10 characters.' };
  }

  if (!existing && input.name.trim().length < 2) {
    return { ok: false, error: 'Enter your name.' };
  }

  const userId = await prisma.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: {
          email: invitation.email,
          name: input.name.trim(),
          passwordHash: await hashPassword(input.password),
          emailVerifiedAt: new Date(),
        },
      }));

    await tx.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: invitation.orgId } },
      create: {
        userId: user.id,
        orgId: invitation.orgId,
        role: invitation.role,
        locationId: invitation.locationId,
      },
      update: { role: invitation.role, locationId: invitation.locationId, isActive: true },
    });

    // Everybody who works here is an employee, so their time costs something
    // from the first day rather than being invisible until the labour figures
    // look too good.
    const already = await tx.employee.findFirst({
      where: { orgId: invitation.orgId, userId: user.id },
    });

    if (!already) {
      const count = await tx.employee.count({ where: { orgId: invitation.orgId } });

      await tx.employee.create({
        data: {
          orgId: invitation.orgId,
          userId: user.id,
          locationId: invitation.locationId,
          reference: `EMP-${String(count + 1).padStart(3, '0')}`,
          displayName: existing?.name ?? input.name.trim(),
          startedOn: new Date(),
        },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return user.id;
  });

  await audit({
    orgId: invitation.orgId,
    actorUserId: userId,
    action: 'invitation.accepted',
    entityType: 'Invitation',
    entityId: invitation.id,
    after: { email: invitation.email, role: invitation.role } as never,
  });

  return { ok: true, userId };
}

/* ---------------------------------------------------------------------------
   Changing and removing people
   --------------------------------------------------------------------------- */

export async function changeRole(input: {
  orgId: string;
  actorUserId: string;
  actorRole: Role;
  targetUserId: string;
  role: Role;
}): Promise<{ ok: boolean; error?: string }> {
  const target = await prisma.membership.findFirst({
    where: { orgId: input.orgId, userId: input.targetUserId },
  });

  if (!target) return { ok: false, error: 'That person is not in this workshop.' };

  try {
    assertMayChangeRole({
      actorRole: input.actorRole,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      targetCurrentRole: target.role as Role,
      targetNewRole: input.role,
    });

    if (target.role === 'OWNER' && input.role !== 'OWNER') {
      assertNotLastOwner({
        targetRole: 'OWNER',
        activeOwners: await prisma.membership.count({
          where: { orgId: input.orgId, role: 'OWNER', isActive: true },
        }),
        action: 'demote',
      });
    }
  } catch (error) {
    return { ok: false, error: (error as InvitationError).message };
  }

  await prisma.membership.update({ where: { id: target.id }, data: { role: input.role } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'membership.role_changed',
    entityType: 'Membership',
    entityId: target.id,
    before: { role: target.role } as never,
    after: { role: input.role } as never,
  });

  return { ok: true };
}

/**
 * A leaver is deactivated, never deleted.
 *
 * Their history is what last year's job costs are built on, and the audit log
 * refers to them by name. Removing the row would either fail or quietly
 * detach the record of everything they did.
 */
export async function deactivateMember(input: {
  orgId: string;
  actorUserId: string;
  actorRole: Role;
  targetUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, error: 'You cannot remove your own access.' };
  }

  const target = await prisma.membership.findFirst({
    where: { orgId: input.orgId, userId: input.targetUserId },
  });

  if (!target) return { ok: false, error: 'That person is not in this workshop.' };

  try {
    assertMayChangeRole({
      actorRole: input.actorRole,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      targetCurrentRole: target.role as Role,
      targetNewRole: target.role as Role,
    });

    assertNotLastOwner({
      targetRole: target.role as Role,
      activeOwners: await prisma.membership.count({
        where: { orgId: input.orgId, role: 'OWNER', isActive: true },
      }),
      action: 'deactivate',
    });
  } catch (error) {
    return { ok: false, error: (error as InvitationError).message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: target.id }, data: { isActive: false } });

    await tx.employee.updateMany({
      where: { orgId: input.orgId, userId: input.targetUserId },
      data: { isActive: false, endedOn: new Date() },
    });

    // Their sessions end now, not when they happen to expire.
    await tx.session.updateMany({
      where: { userId: input.targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'membership.deactivated',
    entityType: 'Membership',
    entityId: target.id,
    before: { role: target.role, isActive: true } as never,
  });

  return { ok: true };
}

/** Everybody in the workshop, with their invitations still outstanding. */
export async function teamFor(orgId: string) {
  const [members, invitations, locations] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
        location: { select: { name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }],
    }),
    prisma.invitation.findMany({
      where: { orgId, acceptedAt: null, revokedAt: null },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.location.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { members, invitations, locations };
}
