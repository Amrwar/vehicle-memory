import {
  assertFeature,
  assertUsage,
  type BillingInvoice,
  type BillingInvoiceEvent,
  type FeatureKey,
  PLAN_ORDER,
  type PlanId,
  type PlanLimits,
  planFor,
  planPrice,
  type Subscription,
  type SubscriptionEvent,
  type SubscriptionRecord,
  subscriptionDatesOf,
  subscriptionStateOf,
  TRIAL_DAYS,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { cache } from 'react';

import { env } from './env';
import { audit } from './guard';
import { traceId } from './trace';
import { paymentProvider } from './payments/provider';

/**
 * The plan, enforced where a thing is created; the subscription, billed.
 * Phase 31 and 32.6.
 *
 * The rules have lived in core since the pricing page; every function that
 * creates what a plan counts, or does what a plan gates, asks here first,
 * and the refusal names the plan that would allow it. The pages still show
 * their walls, but a wall is a courtesy and this is the lock.
 *
 * The money side: a card is taken at sign-up through the provider, the
 * trial runs, the card is charged when it ends unless the workshop
 * cancels, and what the provider says about all of that is written onto
 * the organisation so the state can be read from it.
 */

const BILLING_SELECT = {
  plan: true,
  trialEndsAt: true,
  subscribedAt: true,
  suspendedAt: true,
  cancelledAt: true,
  billingSubscriptionRef: true,
  billingStatus: true,
} as const;

/** The organisation's plan and where it stands. Cached per request. */
export const planOf = cache(async (orgId: string) => {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: BILLING_SELECT,
  });
  return {
    plan: planFor(org.plan).id,
    subscription: subscriptionStateOf(subscriptionDatesOf(org)),
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
        accessGrants: { some: { orgId, revokedAt: null } },
      },
    }),
  ]);
  return { users, locations, bays, vehicles };
}

export async function subscriptionFor(orgId: string): Promise<Subscription & { plan: PlanId }> {
  const { plan, subscription } = await planOf(orgId);
  return { ...subscription, plan };
}

/* ---------------------------------------------------------------------------
   The card, the trial, and the charge
   --------------------------------------------------------------------------- */

/** What the workshop pays per month: the plan's price per bay, times its bays, never fewer than one. */
export async function monthlyChargeFor(orgId: string): Promise<{
  plan: PlanId;
  bays: number;
  amountMinor: number;
  currency: string;
}> {
  const [{ plan }, usage, org] = await Promise.all([
    planOf(orgId),
    usageOf(orgId),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { baseCurrency: true } }),
  ]);
  const bays = Math.max(1, usage.bays);
  // The workshop's own currency, the one its books are in. The book has a
  // price for every currency a country can set; the fallback is for none.
  const price = planPrice(plan, org.baseCurrency, 'monthly');
  return { plan, bays, amountMinor: price.minor * bays, currency: price.currency };
}

function priceRefFor(plan: PlanId): string | null {
  const e = env();
  return (
    (plan === 'CORE'
      ? e.STRIPE_PRICE_CORE
      : plan === 'COMPLETE'
        ? e.STRIPE_PRICE_COMPLETE
        : e.STRIPE_PRICE_GROUP) ?? null
  );
}

/**
 * Opens the provider's checkout that takes a card and starts the trial.
 * The trial's length and the card's purpose are on the page that leads
 * here and on the provider's page; nothing is charged at this step.
 */
export async function startTrialCheckout(input: {
  orgId: string;
  userId: string;
}): Promise<{ url: string }> {
  const [org, owner, charge] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: input.orgId },
      select: { id: true, name: true, billingSubscriptionRef: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } }),
    monthlyChargeFor(input.orgId),
  ]);
  const provider = paymentProvider();
  const base = env().APP_URL;
  const checkout = await provider.createSubscriptionCheckout({
    orgId: org.id,
    plan: charge.plan,
    amountMinor: charge.amountMinor / charge.bays,
    currency: charge.currency,
    priceRef: priceRefFor(charge.plan),
    quantity: charge.bays,
    trialDays: TRIAL_DAYS,
    workshopName: org.name,
    ownerEmail: owner.email,
    returnUrl: `${base}/settings/subscription?welcome=1`,
    cancelUrl: `${base}/settings/subscription?card=skipped`,
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { billingProvider: provider.name, billingCheckoutRef: checkout.providerRef },
  });
  await audit({
    orgId: org.id,
    actorUserId: input.userId,
    action: 'subscription.checkout.started',
    entityType: 'Organization',
    entityId: org.id,
    after: { provider: provider.name, plan: charge.plan, bays: charge.bays },
  });
  return { url: checkout.url };
}

/** Writes what the provider says onto the organisation. The state is read from these afterwards. */
async function recordSubscription(orgId: string, record: SubscriptionRecord): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { subscribedAt: true, cancelledAt: true, trialEndsAt: true },
  });
  const now = new Date();
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      billingCustomerRef: record.customerRef,
      billingSubscriptionRef: record.subscriptionRef,
      billingStatus: record.status,
      billingCardBrand: record.card?.brand ?? null,
      billingCardLast4: record.card?.last4 ?? null,
      currentPeriodEnd: record.currentPeriodEnd,
      // The provider's trial end is the one that counts: it is the day the
      // card is charged.
      ...(record.status === 'TRIALING' && record.trialEndsAt
        ? { trialEndsAt: record.trialEndsAt }
        : {}),
      // Paid, or moved past the trial into a period: on a plan from now.
      ...(record.status === 'ACTIVE' && !org.subscribedAt ? { subscribedAt: now } : {}),
      // Ending at the period's end, or ended by the provider (a trial with
      // no card, a card that never paid): the date the doors close.
      ...(record.cancelAt
        ? { cancelledAt: record.cancelAt }
        : record.status === 'CANCELLED'
          ? { cancelledAt: org.cancelledAt ?? now }
          : { cancelledAt: null }),
    },
  });
}

/** Asks the provider about the workshop's subscription and records the answer. */
export async function syncBillingFromProvider(orgId: string): Promise<SubscriptionRecord | null> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { billingSubscriptionRef: true, billingCheckoutRef: true },
  });
  const ref = org.billingSubscriptionRef ?? org.billingCheckoutRef;
  if (!ref) return null;
  const record = await paymentProvider().retrieveSubscription(ref);
  if (record) await recordSubscription(orgId, record);
  return record;
}

async function orgForEvent(input: {
  orgId?: string | null;
  subscriptionRef?: string | null;
  customerRef?: string | null;
}): Promise<{ id: string } | null> {
  if (input.orgId) {
    const byId = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true },
    });
    if (byId) return byId;
  }
  if (input.subscriptionRef) {
    const bySub = await prisma.organization.findFirst({
      where: {
        OR: [
          { billingSubscriptionRef: input.subscriptionRef },
          { billingCheckoutRef: input.subscriptionRef },
        ],
      },
      select: { id: true },
    });
    if (bySub) return bySub;
  }
  if (input.customerRef) {
    return prisma.organization.findFirst({
      where: { billingCustomerRef: input.customerRef },
      select: { id: true },
    });
  }
  return null;
}

async function tellOwner(orgId: string, subject: string, lines: string[]): Promise<void> {
  const owner = await prisma.membership.findFirst({
    where: { orgId, role: 'OWNER', isActive: true },
    select: { user: { select: { email: true, name: true } } },
  });
  if (!owner) return;
  await prisma.messageLog.create({
    data: {
      traceId: await traceId(),
      orgId,
      channel: 'EMAIL',
      toAddress: owner.user.email,
      subject,
      body: [`Hello ${owner.user.name.split(' ')[0]}.`, '', ...lines, '', 'Carnet'].join('\n'),
      status: 'QUEUED',
      relatedType: 'Billing',
      relatedId: orgId,
    },
  });
}

/**
 * What the provider tells us unprompted about a subscription or one of its
 * invoices, applied once. A subscription event is followed by asking the
 * provider for the whole record, so the card and the dates are never read
 * from a partial event.
 */
export async function applyBillingEvent(
  event: SubscriptionEvent | BillingInvoiceEvent,
): Promise<{ outcome: 'recorded' | 'unknown' }> {
  if (event.kind === 'subscription') {
    const org = await orgForEvent(event);
    if (!org) return { outcome: 'unknown' };
    const full = await paymentProvider().retrieveSubscription(event.subscriptionRef);
    await recordSubscription(
      org.id,
      full ?? {
        customerRef: event.customerRef,
        subscriptionRef: event.subscriptionRef,
        status: event.status,
        trialEndsAt: event.trialEndsAt,
        currentPeriodEnd: event.currentPeriodEnd,
        cancelAt: event.cancelAt,
        card: null,
      },
    );
    await audit({
      orgId: org.id,
      action: `subscription.${event.status.toLowerCase()}`,
      entityType: 'Organization',
      entityId: org.id,
      after: { subscriptionRef: event.subscriptionRef },
    });
    return { outcome: 'recorded' };
  }

  const org = await orgForEvent(event);
  if (!org) return { outcome: 'unknown' };
  const amount = `${(event.amountMinor / 100).toFixed(2)} ${event.currency}`;
  if (event.outcome === 'PAID') {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingStatus: 'ACTIVE', subscribedAt: new Date(), suspendedAt: null },
    });
    // A first charge is the trial ending, and a workshop should hear it
    // from us and not only from its bank statement.
    await tellOwner(org.id, `Payment received: ${amount} for Carnet`, [
      `We have received ${amount} for your Carnet subscription. Thank you.`,
      event.url ? `The invoice is at ${event.url}.` : 'The invoice is on your billing page.',
      'The next charge is a month from now. You can cancel at any time from Settings, Subscription.',
    ]);
  } else {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingStatus: 'PAST_DUE' },
    });
    await tellOwner(org.id, `A payment for Carnet did not go through`, [
      `The charge of ${amount} for your Carnet subscription failed. Nothing has changed yet: the workshop keeps working while the provider tries again over the next few days.`,
      'Please check the card from Settings, Subscription. If no payment succeeds within a fortnight, the workshop becomes read-only until one does. Nothing is deleted.',
    ]);
  }
  await audit({
    orgId: org.id,
    action: event.outcome === 'PAID' ? 'subscription.paid' : 'subscription.payment_failed',
    entityType: 'Organization',
    entityId: org.id,
    after: { invoiceRef: event.invoiceRef, amountMinor: event.amountMinor },
  });
  return { outcome: 'recorded' };
}

/** Everything the billing page shows. */
export async function billingOverview(orgId: string): Promise<{
  provider: string | null;
  card: { brand: string; last4: string } | null;
  nextCharge: { on: Date; amountMinor: number; currency: string; bays: number } | null;
  invoices: BillingInvoice[];
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
}> {
  const [org, charge] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        billingProvider: true,
        billingCustomerRef: true,
        billingSubscriptionRef: true,
        billingCardBrand: true,
        billingCardLast4: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        cancelledAt: true,
        subscribedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
      },
    }),
    monthlyChargeFor(orgId),
  ]);
  const card =
    org.billingCardBrand && org.billingCardLast4
      ? { brand: org.billingCardBrand, last4: org.billingCardLast4 }
      : null;
  const on = org.subscribedAt ? org.currentPeriodEnd : org.trialEndsAt;
  const nextCharge =
    org.billingSubscriptionRef && on && !org.cancelledAt
      ? { on, amountMinor: charge.amountMinor, currency: charge.currency, bays: charge.bays }
      : null;
  let invoices: BillingInvoice[] = [];
  if (org.billingCustomerRef) {
    try {
      invoices = await paymentProvider().listBillingInvoices(org.billingCustomerRef);
    } catch {
      invoices = [];
    }
  }
  return {
    provider: org.billingProvider,
    card,
    nextCharge,
    invoices,
    termsAcceptedAt: org.termsAcceptedAt,
    termsVersion: org.termsVersion,
  };
}

/** The provider's own page for changing the card and reading invoices. */
export async function billingPortalLink(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { billingCustomerRef: true },
  });
  if (!org.billingCustomerRef) return null;
  return paymentProvider().billingPortalUrl(
    org.billingCustomerRef,
    `${env().APP_URL}/settings/subscription`,
  );
}

/**
 * Chooses a plan. A workshop on the provider records the choice and, if it
 * has no card yet, is sent to add one; a workshop from before billing
 * (the pilot) is reopened as before.
 */
export async function choosePlan(input: {
  orgId: string;
  userId: string;
  plan: string;
}): Promise<{ needsCard: boolean }> {
  const plan = PLAN_ORDER.find((id) => id === input.plan.toUpperCase());
  if (!plan) throw new Error('That is not one of the plans.');

  const before = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: {
      plan: true,
      subscribedAt: true,
      cancelledAt: true,
      suspendedAt: true,
      trialEndsAt: true,
      billingSubscriptionRef: true,
    },
  });
  const needsCard = Boolean(before.trialEndsAt) && !before.billingSubscriptionRef;

  await prisma.organization.update({
    where: { id: input.orgId },
    data: needsCard
      ? { plan }
      : { plan, subscribedAt: new Date(), cancelledAt: null, suspendedAt: null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'subscription.plan',
    entityType: 'Organization',
    entityId: input.orgId,
    before,
    after: { plan, needsCard },
  });
  return { needsCard };
}

/**
 * Stops the subscription. Through the provider it ends at the end of what
 * was paid for; a trial ends at once and nothing is ever charged. Nothing is
 * deleted; the workshop reads and exports and can come back.
 */
export async function cancelSubscription(input: { orgId: string; userId: string }) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
    select: { billingSubscriptionRef: true, subscribedAt: true, trialEndsAt: true },
  });
  let endsAt = new Date();
  if (org.billingSubscriptionRef) {
    const record = await paymentProvider().cancelSubscription(org.billingSubscriptionRef);
    // During the trial the doors close now and no charge is ever made; on a
    // plan they close when the paid period does.
    endsAt = org.subscribedAt ? (record.cancelAt ?? record.currentPeriodEnd ?? endsAt) : endsAt;
    await recordSubscription(input.orgId, { ...record, cancelAt: endsAt });
  }
  await prisma.organization.update({
    where: { id: input.orgId },
    data: { cancelledAt: endsAt },
  });
  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'subscription.cancelled',
    entityType: 'Organization',
    entityId: input.orgId,
    after: { endsAt: endsAt.toISOString() },
  });
  return { endsAt };
}
