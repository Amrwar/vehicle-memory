import { formatMinor, fromDecimal } from '@carnet/core';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { settleAttempt } from '@/lib/card-payments';
import { tFor } from '@/lib/i18n';
import { paymentProvider } from '@/lib/payments/provider';
import { stubRemember } from '@/lib/payments/stub';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Test checkout') };
}
export const dynamic = 'force-dynamic';

/**
 * The stub provider's hosted checkout. Phase 32.
 *
 * Exists only while the stub is the provider, and looks deliberately unlike
 * Carnet: this is the page a real provider would show, on their domain,
 * with their chrome. It offers the three things a customer can do on any
 * checkout, remembers the choice as the provider's own record, and tells
 * the application the way a provider would, then sends the customer back.
 */
async function decide(formData: FormData) {
  'use server';

  const id = String(formData.get('id') ?? '');
  const choice = String(formData.get('choice') ?? '');
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id },
    select: {
      providerRef: true,
      status: true,
      amount: true,
      currency: true,
      returnUrl: true,
      cancelUrl: true,
    },
  });
  if (!attempt || paymentProvider().name !== 'stub') notFound();

  const amountMinor = fromDecimal(attempt.amount.toString(), attempt.currency).minor;
  const record =
    choice === 'pay'
      ? { status: 'SUCCEEDED' as const, reason: null }
      : choice === 'decline'
        ? { status: 'FAILED' as const, reason: 'Your card was declined by the issuer.' }
        : { status: 'CANCELLED' as const, reason: null };

  if (attempt.status === 'PENDING') {
    await stubRemember({
      providerRef: attempt.providerRef,
      amountMinor,
      currency: attempt.currency,
      ...record,
    });
    await settleAttempt({
      providerRef: attempt.providerRef,
      record: { ...record, amountMinor, currency: attempt.currency },
    });
  }
  redirect(choice === 'pay' || choice === 'decline' ? attempt.returnUrl : attempt.cancelUrl);
}

export default async function StubCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await tFor();
  const { id } = await params;
  if (paymentProvider().name !== 'stub') notFound();

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      returnUrl: true,
      invoice: { select: { number: true, org: { select: { name: true, locale: true } } } },
    },
  });
  if (!attempt) notFound();

  const amount = formatMinor(fromDecimal(attempt.amount.toString(), attempt.currency).minor, {
    currency: attempt.currency,
    locale: attempt.invoice.org.locale,
  });

  return (
    <main className="min-h-dvh bg-[#f3f4f6] px-4 py-10 font-sans text-[#111827]">
      <div className="mx-auto max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">
          {t('Test checkout')}
        </p>
        <h1 className="mt-1 text-[20px] font-semibold">{attempt.invoice.org.name}</h1>
        <p className="mt-1 text-[14px] text-[#6b7280]">
          {t(
            'Invoice {number}. No card is charged here: this page stands in for a payment provider while none is connected.',
            { number: attempt.invoice.number ?? '' },
          )}
        </p>
        <p className="mt-5 text-[32px] font-semibold tabular-nums">{amount}</p>

        {attempt.status !== 'PENDING' ? (
          <div className="mt-5 rounded-lg bg-[#f9fafb] p-4 text-[14px]">
            <p>
              {t('This checkout is finished: {status}.', {
                status: t(attempt.status.toLowerCase()),
              })}
            </p>
            <Link href={attempt.returnUrl} className="mt-2 inline-block underline">
              {t('Back to your invoices')}
            </Link>
          </div>
        ) : (
          <form action={decide} className="mt-6 grid gap-2">
            <input type="hidden" name="id" value={attempt.id} />
            <button
              type="submit"
              name="choice"
              value="pay"
              className="rounded-lg bg-[#111827] px-4 py-3 text-[15px] font-semibold text-white"
            >
              {t('Pay {amount}', { amount })}
            </button>
            <button
              type="submit"
              name="choice"
              value="decline"
              className="rounded-lg border border-[#e5e7eb] px-4 py-3 text-[14px]"
            >
              {t('Have the card declined')}
            </button>
            <button
              type="submit"
              name="choice"
              value="cancel"
              className="rounded-lg px-4 py-3 text-[14px] text-[#6b7280] underline"
            >
              {t('Cancel and go back')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
