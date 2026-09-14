import {
  assertFeature,
  assertUsage,
  type FeatureKey,
  PLAN_ORDER,
  type PlanId,
  type PlanLimits,
  planFor,
  type Subscription,
  subscriptionStateOf,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { cache } from 'react';

import { audit } from './guard';

/**
 * The plan, enforced where a thing is created. Phase 31.
 *
 * The rules have lived in core since the pricing page; nothing called them.
 * Now every function that creates what a plan counts, or does what a plan
 * gates, asks here first, and the refusal names the plan that would allow
 * it. The pages still show their walls, but a wall is a courtesy and this
 * is the lock.
 */

/** The organisation's plan and where it stands. Cached per request. */
export const planOf = cache(async (orgId: string) => {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      plan: true,
      trialEndsAt: true,
      subscribedAt: true,
      suspendedAt: true,
      cancelledAt: true,
    },
  });
  return {
    plan: planFor(org.plan).id,
    subscription: subscriptionStateOf(org),
  };
});

/** Refuses a feature the plan does not include, naming the one that does. */
export async function assertPlanAllows(orgId: string, feature: FeatureKey): Promise<PlanId> {
  const { plan } = await planOf(orgId);
  assertFeature(plan, feature);
  return plan;
}

/** Refuses one more of something the plan counts, at the moment it would be made. */
export async function assertWithinLimit(
  orgId: string,
  limit: keyof PlanLimits,
  used: number,
): Promise<void> {
  const { plan } = await planOf(orgId);
  assertUsage(plan, limit, used);
}

/** How many of each counted thing the workshop has, for the limits and the page. */
export async function usageOf(orgId: string) {
  const [users, locations, bays, vehicles] = await Promise.all([
    prisma.membership.count({ where: { orgId, isActive: true } }),
    prisma.location.count({ where: { orgId, isActive: true } }),
    prisma.bay.count({ where: { location: { orgId }, isActive: true } }),
    prisma.vehicle.count({
      where: {
        OR: [{ jobs: { some: { orgId } } }, { accessGrants: { some: { orgId, revokedAt: null } } }],
      },
    }),
  ]);
  return { users, locations, bays, vehicles };
}

export async function subscriptionFor(orgId: string): Promise<Subscription & { plan: PlanId }> {
  const { plan, subscription } = await planOf(orgId);
  return { ...subscription, plan };
}

/**
 * Chooses a plan. There is no card yet, so this records the choice and the
 * date and reopens a workshop that had lapsed or cancelled; the money side
 * is a later phase, written to add to this rather than replace it.
 */
export async function choosePlan(input: { orgId: string; userId: string; plan: string }) {
  const plan = PLAN_ORDER.find((id) => id === input.plan.toUpperCase());
  if (!plan) throw new Error('That is not one of the plans.');

  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: { plan: true, subscribedAt: true, cancelledAt: true, suspendedAt: true },
  });

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { plan, subscribedAt: new Date(), cancelledAt: null, suspendedAt: null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'subscription.plan',
    entityType: 'Organization',
    entityId: input.orgId,
    before,
    after: { plan },
  });
}

/** Stops the subscription. Nothing is deleted; the workshop reads and exports and can come back. */
export async function cancelSubscription(input: { orgId: string; userId: string }) {
  await prisma.organization.update({
    where: { id: input.orgId },
    data: { cancelledAt: new Date() },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'subscription.cancelled',
    entityType: 'Organization',
    entityId: input.orgId,
  });
}
