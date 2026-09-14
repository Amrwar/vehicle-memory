import { PLAN_ORDER, PLANS, type PlanId, TRIAL_DAYS } from '@carnet/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, KeyValue, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { cancelSubscription, choosePlan, subscriptionFor, usageOf } from '@/lib/billing';
import { can, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Subscription' };
export const dynamic = 'force-dynamic';

/**
 * Where the workshop stands with us, and what its plan allows. Phase 31.
 *
 * Reached on purpose from settings, and by force when a read-only workshop
 * tries to write: the refusal lands here with the reason, rather than on a
 * page that refused without saying why. There is no card yet; choosing a
 * plan records the choice and reopens the workshop.
 */
const TONE = {
  TRIAL: 'brand',
  GRACE: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  CANCELLED: 'neutral',
} as const;

const LABEL = {
  TRIAL: 'On trial',
  GRACE: 'Trial ended',
  ACTIVE: 'On a plan',
  SUSPENDED: 'Read-only',
  CANCELLED: 'Cancelled',
} as const;

async function choose(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  await choosePlan({ orgId, userId: user.userId, plan: String(formData.get('plan') ?? '') });
  redirect('/settings/subscription?saved=plan');
}

async function cancel() {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  await cancelSubscription({ orgId, userId: user.userId });
  redirect('/settings/subscription?saved=cancelled');
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; blocked?: string }>;
}) {
  const { orgId, user } = await requireSession('settings:read');
  const { saved, blocked } = await searchParams;

  const [subscription, usage] = await Promise.all([subscriptionFor(orgId), usageOf(orgId)]);
  const current = PLANS[subscription.plan];
  const mayChange = can(user.role, 'settings:write');

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">Settings</BackLink>
      </div>

      <PageHeader
        eyebrow="Settings"
        title="Subscription"
        description="Where the workshop stands, and what its plan allows"
        actions={
          <Badge tone={TONE[subscription.state]} dot>
            {LABEL[subscription.state]}
          </Badge>
        }
      />

      {blocked ? (
        <Alert tone="danger" title="That could not be saved" className="mb-5">
          {subscription.message} Nothing has been lost; reading and exporting still work.
        </Alert>
      ) : null}
      {saved === 'plan' ? (
        <Alert tone="success" className="mb-5">
          Plan chosen. The workshop is open, and the change is in the audit log.
        </Alert>
      ) : null}
      {saved === 'cancelled' ? (
        <Alert tone="warning" className="mb-5">
          Cancelled. Everything is kept and can be read and exported; choosing a plan reopens it.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Where it stands" description={subscription.message} />
          <CardBody>
            <KeyValue
              columns={2}
              items={[
                { label: 'Plan', value: current.name },
                { label: 'State', value: LABEL[subscription.state] },
                {
                  label: 'Days left',
                  value: subscription.daysLeft === null ? '—' : String(subscription.daysLeft),
                },
                {
                  label: 'Sites',
                  value: `${usage.locations} of ${current.limits.locations >= 1_000_000 ? 'any number' : current.limits.locations}`,
                },
                {
                  label: 'Bays',
                  value: `${usage.bays} of ${current.limits.bays >= 1_000_000 ? 'any number' : current.limits.bays}`,
                },
                {
                  label: 'Vehicles',
                  value: `${usage.vehicles.toLocaleString('en-GB')} of ${current.limits.vehicles >= 1_000_000 ? 'any number' : current.limits.vehicles.toLocaleString('en-GB')}`,
                },
                { label: 'Staff accounts', value: `${usage.users}, unlimited on every plan` },
              ]}
            />
            <p className="mt-4 text-[12px] leading-relaxed text-(--text-faint)">
              There is no card on file yet. Choosing a plan records the choice and keeps the
              workshop open; taking payment for it is a later phase. A {TRIAL_DAYS}-day trial
              becomes read-only a fortnight after it ends if no plan is chosen, and nothing is
              deleted at any point.
            </p>
          </CardBody>
        </Card>

        <div className="grid content-start gap-5">
          <Card className="border-(--brand)">
            <CardHeader
              title="Choose a plan"
              description={
                <>
                  What each includes is on the{' '}
                  <Link href="/pricing" className="underline">
                    pricing page
                  </Link>
                  .
                </>
              }
            />
            <CardBody className="grid gap-2">
              {PLAN_ORDER.map((id: PlanId) => (
                <form key={id} action={choose} className="flex items-center justify-between gap-3">
                  <input type="hidden" name="plan" value={id} />
                  <div>
                    <p className="text-[13px] font-medium">
                      {PLANS[id].name}
                      {id === subscription.plan && subscription.state === 'ACTIVE' ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">current</span>
                      ) : null}
                    </p>
                    <p className="text-[12px] text-(--text-faint)">{PLANS[id].audience}</p>
                  </div>
                  <Button
                    type="submit"
                    variant={id === subscription.plan ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={!mayChange}
                  >
                    {id === subscription.plan && subscription.state === 'ACTIVE'
                      ? 'Keep'
                      : 'Choose'}
                  </Button>
                </form>
              ))}
            </CardBody>
          </Card>

          {subscription.state !== 'CANCELLED' && mayChange ? (
            <Card className="border-(--danger)">
              <CardHeader
                title="Cancel"
                description="The workshop becomes read-only. Everything is kept, and can be read, exported, and reopened by choosing a plan."
              />
              <CardBody>
                <form action={cancel}>
                  <Button type="submit" variant="danger">
                    Cancel the subscription
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
