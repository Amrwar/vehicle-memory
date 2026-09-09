import { forOrg, prisma } from '@carnet/db';
import { assertCan, landingPathFor, type Permission, type Role } from '@carnet/core';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { currentUser, type CurrentUser } from './auth';

/**
 * Route guards.
 *
 * Every protected page begins with one of these. They return a tenant-scoped
 * Prisma client alongside the user, which is the mechanism that makes
 * forgetting to filter by organisation difficult rather than merely
 * discouraged (FR-102).
 */

export interface Session {
  user: CurrentUser;
  orgId: string;
  /** Prisma client with the tenant filter already applied. */
  db: ReturnType<typeof forOrg>;
}

/** Requires a signed-in user attached to an organisation. */
export async function requireSession(permission?: Permission): Promise<Session> {
  const user = await currentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.orgId) {
    // A portal-only customer has no organisation membership.
    redirect(landingPathFor(user.role));
  }

  if (permission) {
    assertCan(user.role, permission);
  }

  return { user, orgId: user.orgId, db: forOrg(user.orgId) };
}

/** Requires a signed-in user of any kind, including a portal customer. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Sends each role to the surface built for it. A technician landing on the
 * management dashboard is a design failure, not a permissions question
 * (ADR-0009).
 */
export async function redirectToSurface(): Promise<never> {
  const user = await currentUser();
  redirect(user ? landingPathFor(user.role) : '/login');
}

export function can(role: Role, permission: Permission): boolean {
  try {
    assertCan(role, permission);
    return true;
  } catch {
    return false;
  }
}

/* --- audit ---------------------------------------------------------------- */

/**
 * Writes an audit record. Never throws: an audit failure must not roll back
 * the user's work, but it must be visible in the logs.
 */
export async function audit(input: {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const headerList = await headers();
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: headerList.get('user-agent') ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit record', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
