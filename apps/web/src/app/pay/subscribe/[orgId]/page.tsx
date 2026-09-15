import { formatMinor, TRIAL_DAYS } from '@carnet/core';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { applyBillingEvent } from '@/lib/billing';
import { tFor } from '@/lib/i18n';
import { paymentProvider } from '@/lib/payments/provider';
import { stubAddCard, stubCharge, stubSubscriptionOf } from '@/lib/payments/stub';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Test billing') };
}
export const dynamic = 'force-dynamic';

/**
 * The stub provider's subscription checkout and billing portal. Phase 32.6.
 *
 * Exists only while the stub is the provider, and looks deliberately unlike
 * Carnet: this is the page a real provider would show. As a checkout it
 * offers to add a card for the trial, or to go back. As a portal it shows
 * the card and the invoices, and offers to simulate the trial ending with a
 * charge that succeeds or fails, which is what a real provider would do on
 * its own on the day.
 */
async function decide(formData: FormData) {
  'use server';

  if (paymentProvider().name !== 'stub') notFound();
  const orgId = String(formData.get('orgId') ?? '');
  const choice = String(formData.get('choice') ?? '');
  const back = String(formData.get('return') ?? '') || null;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, billingCheckoutRef: true },
  });
  if (!org) notFound();

  if (choice === 'card') {
    const record = await stubAddCard({ orgId: org.id, trialDays: TRIAL_DAYS });
    await applyBillingEvent({
      kind: 'subscription',
      orgId: org.id,
      customerRef: record.customerRef,
      subscriptionRef: record.subscriptionRef,
      status: record.status,
      trialEndsAt: record.trialEndsAt,
      currentPeriodEnd: record.currentPeriodEnd,
      cancelAt: record.cancelAt,
    });
    redirect('/settings/subscription?welcome=1');
  }
  if (choice === 'charge' || choice === 'fail') {
    const charged = await stubCharge({
      orgId: org.id,
      outcome: choice === 'charge' ? 'PAID' : 'FAILED',
    });
    const sub = await stubSubscriptionOf(org.id);
    await applyBillingEvent({
      kind: 'billing-invoice',
      customerRef: sub!.customerRef,
      subscriptionRef: sub!.subscriptionRef,
      outcome: choice === 'charge' ? 'PAID' : 'FAILED',
      amountMinor: charged.amountMinor,
      currency: charged.currency,
      invoiceRef: charged.invoiceRef,
      url: null,
    });
    redirect(back ?? '/settings/subscription');
  }
  redirect(back ?? '/settings/subscription?card=skipped');
}

export default async function StubSubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ portal?: string; return?: string }>;
}) {
  if (paymentProvider().name !== 'stub') notFound();
  const t = await tFor();
  const { orgId } = await params;
  const { portal, return: back } = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, locale: true },
  });
  const sub = org ? await stubSubscriptionOf(org.id) : null;
  if (!org || !sub) notFound();

  const money = (minor: number) =>
    formatMinor(minor, { currency: sub.currency, locale: org.locale });
  const monthly = sub.amountMinor * sub.quantity;
  const isPortal = portal === '1' && sub.status !== 'INCOMPLETE';
  const planName = t(sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase());

  return (
    <main className="min-h-dvh bg-[#f3f4f6] px-4 py-10 font-sans text-[#111827]">
      <div className="mx-auto max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">
          {isPortal ? t('Test billing portal') : t('Test checkout')}
        </p>
        <h1 className="mt-1 text-[20px] font-semibold">
          {t('Carnet, for {workshop}', { workshop: org.name })}
        </h1>

        {isPortal ? (
          <>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              {t('This page stands in for the provider’s billing portal while none is connected.')}
            </p>
            <dl className="mt-5 grid gap-2 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">{t('Card')}</dt>
                <dd>
                  {sub.card
                    ? t('{brand} ending {last4}', { brand: sub.card.brand, last4: sub.card.last4 })
                    : t('none')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">{t('Plan')}</dt>
                <dd>
                  {sub.quantity === 1
                    ? t('{plan}, 1 bay, {amount} a month', {
                        plan: planName,
                        amount: money(monthly),
                      })
                    : t('{plan}, {count} bays, {amount} a month', {
                        plan: planName,
                        count: sub.quantity,
                        amount: money(monthly),
                      })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">{t('Status')}</dt>
                <dd>{t(sub.status.toLowerCase().replace('_', ' '))}</dd>
              </div>
            </dl>
            <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wider text-[#6b7280]">
              {t('Invoices')}
            </h2>
            {sub.invoices.length === 0 ? (
              <p className="mt-1 text-[14px] text-[#6b7280]">{t('None yet.')}</p>
            ) : (
              <ul className="mt-1 divide-y divide-[#e5e7eb] text-[14px]">
                {sub.invoices.map((i) => (
                  <li key={i.ref} className="flex justify-between py-1.5">
                    <span>
                      {i.number} · {new Date(i.issuedAt).toLocaleDateString(org.locale)}
                    </span>
                    <span>
                      {money(i.amountMinor)} · {t(i.status.toLowerCase())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={decide} className="mt-6 grid gap-2">
              <input type="hidden" name="orgId" value={org.id} />
              <input type="hidden" name="return" value={back ?? ''} />
              <button
                type="submit"
                name="choice"
                value="charge"
                className="rounded-lg border border-[#e5e7eb] px-4 py-3 text-[14px]"
              >
                {t('Simulate the next charge succeeding ({amount})', { amount: money(monthly) })}
              </button>
              <button
                type="submit"
                name="choice"
                value="fail"
                className="rounded-lg border border-[#e5e7eb] px-4 py-3 text-[14px]"
              >
                {t('Simulate the next charge failing')}
              </button>
              <button
                type="submit"
                name="choice"
                value="back"
                className="rounded-lg px-4 py-3 text-[14px] text-[#6b7280] underline"
              >
                {t('Back to Carnet')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              {t(
                'No card is charged here: this page stands in for a payment provider while none is connected.',
              )}
            </p>
            <p className="mt-5 text-[32px] font-semibold tabular-nums">{money(0)}</p>
            <p className="text-[14px] text-[#6b7280]">
              {sub.quantity === 1
                ? t(
                    'due today. {days} days free, then {amount} a month for 1 bay on {plan}, charged to the card unless cancelled before the trial ends.',
                    { days: TRIAL_DAYS, amount: money(monthly), plan: planName },
                  )
                : t(
                    'due today. {days} days free, then {amount} a month for {count} bays on {plan}, charged to the card unless cancelled before the trial ends.',
                    {
                      days: TRIAL_DAYS,
                      amount: money(monthly),
                      count: sub.quantity,
                      plan: planName,
                    },
                  )}
            </p>
            <form action={decide} className="mt-6 grid gap-2">
              <input type="hidden" name="orgId" value={org.id} />
              <button
                type="submit"
                name="choice"
                value="card"
                className="rounded-lg bg-[#111827] px-4 py-3 text-[15px] font-semibold text-white"
              >
                {t('Add a test card and start the trial')}
              </button>
              <button
                type="submit"
                name="choice"
                value="back"
                className="rounded-lg px-4 py-3 text-[14px] text-[#6b7280] underline"
              >
                {t('Go back without adding a card')}
              </button>
            </form>
            <p className="mt-4 text-[12px] text-[#9ca3af]">
              {t('{terms} say the same thing as this page.')
                .split('{terms}')
                .flatMap((part, index) =>
                  index === 0
                    ? [part]
                    : [
                        <Link key={index} href="/terms" className="underline">
                          {t('The terms')}
                        </Link>,
                        part,
                      ],
                )}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
