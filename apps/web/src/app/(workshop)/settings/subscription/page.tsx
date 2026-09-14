import {
  formatMinor,
  PLAN_ORDER,
  PLANS,
  type PlanId,
  planPrice,
  pricingCurrency,
  TRIAL_DAYS,
} from '@carnet/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, KeyValue, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import {
  billingOverview,
  billingPortalLink,
  cancelSubscription,
  choosePlan,
  startTrialCheckout,
  subscriptionFor,
  syncBillingFromProvider,
  usageOf,
} from '@/lib/billing';
import { can, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Subscription and billing' };
export const dynamic = 'force-dynamic';

/**
 * Where the workshop stands with us, what its plan allows, and the money
 * side: the card, the next charge, the invoices. Phase 31, billed in 32.6.
 *
 * Reached on purpose from settings, by force when a read-only workshop
 * tries to write, and on the way back from the provider's checkout. The
 * next charge is stated as a date and an amount, because a subscription
 * page that hides either is how people come to feel tricked.
 */
const TONE = {
  AWAITING_CARD: 'warning',
  TRIAL: 'brand',
  GRACE: 'warning',
  ACTIVE: 'success',
  PAST_DUE: 'danger',
  SUSPENDED: 'danger',
  CANCELLED: 'neutral',
} as const;

const LABEL = {
  AWAITING_CARD: 'Card needed',
  TRIAL: 'On trial',
  GRACE: 'Trial ended',
  ACTIVE: 'On a plan',
  PAST_DUE: 'Payment failed',
  SUSPENDED: 'Read-only',
  CANCELLED: 'Cancelled',
} as const;

async function choose(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const { needsCard } = await choosePlan({
    orgId,
    userId: user.userId,
    plan: String(formData.get('plan') ?? ''),
  });
  if (needsCard) {
    const { url } = await startTrialCheckout({ orgId, userId: user.userId });
    redirect(url);
  }
  redirect('/settings/subscription?saved=plan');
}

async function addCard() {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const { url } = await startTrialCheckout({ orgId, userId: user.userId });
  redirect(url);
}

async function manage() {
  'use server';

  const { orgId } = await requireSession('settings:write');
  const url = await billingPortalLink(orgId);
  redirect(url ?? '/settings/subscription?problem=nocustomer');
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
  searchParams: Promise<{
    saved?: string;
    blocked?: string;
    welcome?: string;
    card?: string;
    problem?: string;
  }>;
}) {
  const { orgId, user, region } = await requireSession('settings:read');
  const { saved, blocked, welcome, card, problem } = await searchParams;

  // Back from the provider: ask it what it holds now, so the page the owner
  // lands on already shows the card and the trial's end.
  if (welcome) await syncBillingFromProvider(orgId);

  const [subscription, usage, billing] = await Promise.all([
    subscriptionFor(orgId),
    usageOf(orgId),
    billingOverview(orgId),
  ]);
  const current = PLANS[subscription.plan];
  const mayChange = can(user.role, 'settings:write');
  const date = (d: Date) =>
    d.toLocaleDateString(region.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const money = (minor: number, currency: string) =>
    formatMinor(minor, { currency, locale: region.locale });
  const monthly =
    billing.nextCharge?.amountMinor ??
    planPrice(subscription.plan, region.currency, 'monthly').minor * Math.max(1, usage.bays);
  const pricedIn = pricingCurrency(region.currency);
  const endingSoon = subscription.message.startsWith('Cancelled');

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">Settings</BackLink>
      </div>

      <PageHeader
        eyebrow="Settings"
        title="Subscription and billing"
        description="Where the workshop stands, what it pays, and what its plan allows"
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
      {welcome && subscription.state === 'TRIAL' ? (
        <Alert tone="success" title="The trial has started" className="mb-5">
          Your card is on file and nothing has been charged. {subscription.message}
        </Alert>
      ) : null}
      {card === 'skipped' ? (
        <Alert tone="warning" title="No card was added" className="mb-5">
          The workshop exists and waits for you. Add a card below to start the {TRIAL_DAYS}-day
          trial; nothing is charged until it ends, and cancelling before then costs nothing.
        </Alert>
      ) : null}
      {saved === 'plan' ? (
        <Alert tone="success" className="mb-5">
          Plan chosen. The workshop is open, and the change is in the audit log.
        </Alert>
      ) : null}
      {saved === 'cancelled' ? (
        <Alert tone="warning" className="mb-5">
          Cancelled. {subscription.message} Choosing a plan reopens it.
        </Alert>
      ) : null}
      {problem === 'nocustomer' ? (
        <Alert tone="danger" className="mb-5">
          There is no billing account with the provider yet. Add a card first.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-5">
          <Card
            className={subscription.state === 'AWAITING_CARD' ? 'border-(--warning)' : undefined}
          >
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
                    label: 'Card on file',
                    value: billing.card
                      ? `${billing.card.brand} ending ${billing.card.last4}`
                      : 'None',
                  },
                  {
                    label: 'Next charge',
                    value: billing.nextCharge
                      ? `${money(billing.nextCharge.amountMinor, billing.nextCharge.currency)} on ${date(billing.nextCharge.on)}`
                      : 'None scheduled',
                  },
                  {
                    label: 'Priced by',
                    value: `${Math.max(1, usage.bays)} ${usage.bays === 1 ? 'bay' : 'bays'} on ${current.name}`,
                  },
                ]}
              />
              {subscription.state === 'AWAITING_CARD' && mayChange ? (
                <form action={addCard} className="mt-4">
                  <Button type="submit" variant="primary" size="lg">
                    Add a card and start the {TRIAL_DAYS}-day trial
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    You will be charged {money(monthly, pricedIn)} a month from the day the trial
                    ends, unless you cancel before then. The{' '}
                    <Link href="/terms" className="underline">
                      terms
                    </Link>{' '}
                    say the same.
                  </p>
                </form>
              ) : null}
              {billing.card && mayChange ? (
                <form action={manage} className="mt-4">
                  <Button type="submit" variant="secondary">
                    Payment methods and invoices
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    Add, change or remove cards, and download invoices, on the payment
                    provider&apos;s secure page. Card details never pass through Carnet.
                  </p>
                </form>
              ) : null}
              <p className="mt-4 text-[12px] leading-relaxed text-(--text-faint)">
                Cancelling during the trial means nothing is ever charged. Cancelling later stops
                the next charge and the workshop stays open to the end of the month paid for.
                Nothing is deleted in any state.{' '}
                <Link href="/terms" className="underline">
                  The terms
                </Link>
                {billing.termsAcceptedAt
                  ? ` were accepted on ${date(billing.termsAcceptedAt)}.`
                  : '.'}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Invoices"
              description={
                billing.invoices.length
                  ? 'From the provider, newest first.'
                  : billing.nextCharge
                    ? `The first invoice is issued on ${date(billing.nextCharge.on)}.`
                    : 'Nothing has been charged.'
              }
            />
            {billing.invoices.length ? (
              <CardBody className="p-0">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Number</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.invoices.map((i) => (
                      <tr key={i.ref} className="border-t border-(--border)">
                        <td className="px-4 py-2 whitespace-nowrap">{date(i.issuedAt)}</td>
                        <td className="px-4 py-2">{i.number ?? i.ref}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {money(i.amountMinor, i.currency)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            tone={
                              i.status === 'PAID'
                                ? 'success'
                                : i.status === 'FAILED'
                                  ? 'danger'
                                  : 'neutral'
                            }
                            size="sm"
                          >
                            {i.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {(i.pdfUrl ?? i.url) ? (
                            <a
                              href={i.pdfUrl ?? i.url ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {i.pdfUrl ? 'PDF' : 'Open'}
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="What the plan allows" />
            <CardBody>
              <KeyValue
                columns={2}
                items={[
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
                    value: `${usage.vehicles.toLocaleString(region.locale)} of ${current.limits.vehicles >= 1_000_000 ? 'any number' : current.limits.vehicles.toLocaleString(region.locale)}`,
                  },
                  { label: 'Staff accounts', value: `${usage.users}, unlimited on every plan` },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="border-(--brand)">
            <CardHeader
              title="Choose a plan"
              description={
                <>
                  Per bay, per month. What each includes is on the{' '}
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
                      <span className="ml-2 text-[12px] text-(--text-faint)">
                        {money(planPrice(id, region.currency, 'monthly').minor, pricedIn)}
                      </span>
                      {id === subscription.plan && subscription.state !== 'AWAITING_CARD' ? (
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
                    {id === subscription.plan && subscription.state !== 'AWAITING_CARD'
                      ? 'Keep'
                      : 'Choose'}
                  </Button>
                </form>
              ))}
            </CardBody>
          </Card>

          {subscription.state !== 'CANCELLED' &&
          subscription.state !== 'AWAITING_CARD' &&
          mayChange &&
          !endingSoon ? (
            <Card className="border-(--danger)">
              <CardHeader
                title="Cancel"
                description={
                  subscription.state === 'TRIAL'
                    ? 'The trial ends now and the card is never charged. Everything is kept, readable and exportable, and choosing a plan reopens it.'
                    : 'The next charge is stopped and the workshop stays open to the end of the month paid for, then becomes read-only. Everything is kept.'
                }
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
