import { forOrg, prisma } from '@carnet/db';
import {
  assertCan,
  type FeatureKey,
  ForbiddenError,
  hasFeature,
  landingPathFor,
  type Permission,
  type PlanId,
  planFor,
  type Region,
  isWritePermission,
  type Subscription,
  subscriptionStateOf,
  readingLocaleFor,
  type Role,
} from '@carnet/core';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { currentUser, type CurrentUser } from './auth';
import { currentLanguage } from './i18n';
import { TRACE_HEADER } from './trace';

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
  /** The organisation's plan, for the pages that a plan gates. */
  plan: PlanId;
  /** What money and dates are formatted by. */
  region: Region;
  /** Where the workshop stands with us. */
  subscription: Subscription;
}

/** Requires a signed-in user attached to an organisation. */
export async function requireSession(permission?: Permission): Promise<Session> {
  const user = await currentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.orgId) {
    // Two different people arrive here and they need different answers.
    //
    // Somebody on a workshop's team who has not said which one: sent to
    // choose. Their role reads as CUSTOMER at this point, because a role is a
    // property of a membership and they are acting under none, so sending
    // them by role would put a technician in the customer portal (FR-9801).
    if (user.belongings.length > 0) redirect('/choose');

    // A portal-only customer has no organisation membership.
    redirect(landingPathFor(user.role));
  }

  // A workshop that has lapsed or cancelled keeps reading and exporting and
  // loses writing. The refusal lands on the page that explains why.
  if (permission && user.subscription?.readOnly && isWritePermission(permission)) {
    redirect('/settings/subscription?blocked=1');
  }

  if (permission) {
    try {
      assertCan(user.role, permission);
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;

      // Reachable only by typing a URL: the navigation already filters by
      // permission. Throwing here would stream a 200 with a stack trace
      // behind it, because the loading boundary has already flushed. Sending
      // the person to their own surface with a reason is the same principle
      // as ADR-0009 — the answer to "wrong screen" is the right screen, not
      // an error.
      redirect(`${landingPathFor(user.role)}?denied=${encodeURIComponent(permission)}`);
    }
  }

  return {
    user,
    orgId: user.orgId,
    db: forOrg(user.orgId),
    plan: planFor(user.orgPlan ?? 'CORE').id,
    // Dates and money in the reader's language, in the workshop's country. Phase 40.5.
    region: { ...user.region, locale: readingLocaleFor(await currentLanguage(), user.region) },
    subscription:
      user.subscription ??
      subscriptionStateOf({
        trialEndsAt: null,
        subscribedAt: null,
        suspendedAt: null,
        cancelledAt: null,
      }),
  };
}

/**
 * Whether the organisation's plan includes a feature.
 *
 * Separate from `can()`, because role and plan are different questions. A
 * manager on Core genuinely has permission to read a ledger; their workshop
 * has not bought one. Conflating the two produces the wrong message on the
 * wall, which is the whole reason somebody gets stuck.
 */
export function planIncludes(plan: PlanId, feature: FeatureKey): boolean {
  return hasFeature(plan, feature);
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
  if (!user) redirect('/login');
  // As above: somebody on a team but in no workshop is not a customer, they
  // are somebody who has not chosen yet.
  if (!user.orgId && user.belongings.length > 0) redirect('/choose');
  redirect(landingPathFor(user.role));
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
    // Outside a request, from a job or a verification script, there are no
    // headers. The record is still written: an audit trail with holes where
    // the automation acted is not an audit trail.
    let headerList: Awaited<ReturnType<typeof headers>> | null = null;
    try {
      headerList = await headers();
    } catch {
      headerList = null;
    }
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId ?? null,
        actorUserId: input.actorUserId ?? null,
        // The request this came from. Phase 59, NFR-803.
        traceId: headerList?.get(TRACE_HEADER) ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ip: headerList?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: headerList?.get('user-agent') ?? null,
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
