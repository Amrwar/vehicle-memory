import {
  formatMinor,
  msg,
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
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Subscription and billing') };
}
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
  AWAITING_CARD: msg('Card needed'),
  TRIAL: msg('On trial'),
  GRACE: msg('Trial ended'),
  ACTIVE: msg('On a plan'),
  PAST_DUE: msg('Payment failed'),
  SUSPENDED: msg('Read-only'),
  CANCELLED: msg('Cancelled'),
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
  const t = await tFor();

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
  const allowance = (used: number, limit: number) =>
    limit >= 1_000_000
      ? t('{used} in use, no limit', { used: used.toLocaleString(region.locale) })
      : t('{used} in use, up to {limit}', {
          used: used.toLocaleString(region.locale),
          limit: limit.toLocaleString(region.locale),
        });

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Settings')}
        title={t('Subscription and billing')}
        description={t('Where the workshop stands, what it pays, and what its plan allows')}
        actions={
          <Badge tone={TONE[subscription.state]} dot>
            {t(LABEL[subscription.state])}
          </Badge>
        }
      />

      {blocked ? (
        <Alert tone="danger" title={t('That could not be saved')} className="mb-5">
          {t(subscription.message)} {t('Nothing has been lost; reading and exporting still work.')}
        </Alert>
      ) : null}
      {welcome && subscription.state === 'TRIAL' ? (
        <Alert tone="success" title={t('The trial has started')} className="mb-5">
          {t('Your card is on file and nothing has been charged.')} {t(subscription.message)}
        </Alert>
      ) : null}
      {card === 'skipped' ? (
        <Alert tone="warning" title={t('No card was added')} className="mb-5">
          {t(
            'The workshop exists and waits for you. Add a card below to start the {days}-day trial; nothing is charged until it ends, and cancelling before then costs nothing.',
            { days: TRIAL_DAYS },
          )}
        </Alert>
      ) : null}
      {saved === 'plan' ? (
        <Alert tone="success" className="mb-5">
          {t('Plan chosen. The workshop is open, and the change is in the audit log.')}
        </Alert>
      ) : null}
      {saved === 'cancelled' ? (
        <Alert tone="warning" className="mb-5">
          {t('Cancelled.')} {t(subscription.message)} {t('Choosing a plan reopens it.')}
        </Alert>
      ) : null}
      {problem === 'nocustomer' ? (
        <Alert tone="danger" className="mb-5">
          {t('There is no billing account with the provider yet. Add a card first.')}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-5">
          <Card
            className={subscription.state === 'AWAITING_CARD' ? 'border-(--warning)' : undefined}
          >
            <CardHeader title={t('Where it stands')} description={t(subscription.message)} />
            <CardBody>
              <KeyValue
                t={t}
                columns={2}
                items={[
                  { label: t('Plan'), value: current.name },
                  { label: t('State'), value: t(LABEL[subscription.state]) },
                  {
                    label: t('Days left'),
                    value: subscription.daysLeft === null ? '—' : String(subscription.daysLeft),
                  },
                  {
                    label: t('Card on file'),
                    value: billing.card
                      ? t('{brand} ending {last4}', {
                          brand: billing.card.brand,
                          last4: billing.card.last4,
                        })
                      : t('None'),
                  },
                  {
                    label: t('Next charge'),
                    value: billing.nextCharge
                      ? t('{amount} on {date}', {
                          amount: money(
                            billing.nextCharge.amountMinor,
                            billing.nextCharge.currency,
                          ),
                          date: date(billing.nextCharge.on),
                        })
                      : t('None scheduled'),
                  },
                  {
                    label: t('Priced by'),
                    value:
                      Math.max(1, usage.bays) === 1
                        ? t('1 bay on {plan}', { plan: current.name })
                        : t('{count} bays on {plan}', { count: usage.bays, plan: current.name }),
                  },
                ]}
              />
              {subscription.state === 'AWAITING_CARD' && mayChange ? (
                <form action={addCard} className="mt-4">
                  <Button type="submit" variant="primary" size="lg">
                    {t('Add a card and start the {days}-day trial', { days: TRIAL_DAYS })}
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    {t(
                      'You will be charged {amount} a month from the day the trial ends, unless you cancel before then.',
                      { amount: money(monthly, pricedIn) },
                    )}{' '}
                    <Link href="/terms" className="underline">
                      {t('The terms say the same.')}
                    </Link>
                  </p>
                </form>
              ) : null}
              {billing.card && mayChange ? (
                <form action={manage} className="mt-4">
                  <Button type="submit" variant="secondary">
                    {t('Payment methods and invoices')}
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    {t(
                      'Add, change or remove cards, and download invoices, on the payment provider’s secure page. Card details never pass through Carnet.',
                    )}
                  </p>
                </form>
              ) : null}
              <p className="mt-4 text-[12px] leading-relaxed text-(--text-faint)">
                {t(
                  'Cancelling during the trial means nothing is ever charged. Cancelling later stops the next charge and the workshop stays open to the end of the month paid for. Nothing is deleted in any state.',
                )}{' '}
                {billing.termsAcceptedAt
                  ? `${t('The terms were accepted on {date}.', { date: date(billing.termsAcceptedAt) })} `
                  : ''}
                <Link href="/terms" className="underline">
                  {t('Read the terms')}
                </Link>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('Invoices')}
              description={
                billing.invoices.length
                  ? t('From the provider, newest first.')
                  : billing.nextCharge
                    ? t('The first invoice is issued on {date}.', {
                        date: date(billing.nextCharge.on),
                      })
                    : t('Nothing has been charged.')
              }
            />
            {billing.invoices.length ? (
              <CardBody className="p-0">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                    <tr>
                      <th className="px-4 py-2">{t('Date')}</th>
                      <th className="px-4 py-2">{t('Number')}</th>
                      <th className="px-4 py-2 text-right">{t('Amount')}</th>
                      <th className="px-4 py-2">{t('Status')}</th>
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
                            {t(i.status.toLowerCase())}
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
                              {i.pdfUrl ? 'PDF' : t('Open')}
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
            <CardHeader title={t('What the plan allows')} />
            <CardBody>
              <KeyValue
                t={t}
                columns={2}
                items={[
                  {
                    label: t('Sites'),
                    value: allowance(usage.locations, current.limits.locations),
                  },
                  {
                    label: t('Bays'),
                    value: allowance(usage.bays, current.limits.bays),
                  },
                  {
                    label: t('Vehicles'),
                    value: allowance(usage.vehicles, current.limits.vehicles),
                  },
                  {
                    label: t('Staff accounts'),
                    value: t('{count}, unlimited on every plan', { count: usage.users }),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="border-(--brand)">
            <CardHeader
              title={t('Choose a plan')}
              description={
                <>
                  {t('Per bay, per month.')}{' '}
                  <Link href="/pricing" className="underline">
                    {t('See what each plan includes')}
                  </Link>
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
                        <span className="ml-2 text-[11px] text-(--text-faint)">{t('current')}</span>
                      ) : null}
                    </p>
                    <p className="text-[12px] text-(--text-faint)">{t(PLANS[id].audience)}</p>
                  </div>
                  <Button
                    type="submit"
                    variant={id === subscription.plan ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={!mayChange}
                  >
                    {id === subscription.plan && subscription.state !== 'AWAITING_CARD'
                      ? t('Keep')
                      : t('Choose')}
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
                title={t('Cancel')}
                description={
                  subscription.state === 'TRIAL'
                    ? t(
                        'The trial ends now and the card is never charged. Everything is kept, readable and exportable, and choosing a plan reopens it.',
                      )
                    : t(
                        'The next charge is stopped and the workshop stays open to the end of the month paid for, then becomes read-only. Everything is kept.',
                      )
                }
              />
              <CardBody>
                <form action={cancel}>
                  <Button type="submit" variant="danger">
                    {t('Cancel the subscription')}
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
