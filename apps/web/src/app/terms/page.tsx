import {
  formatMinor,
  GRACE_DAYS,
  PLAN_ORDER,
  planPrice,
  PLANS,
  PRICED_CURRENCIES,
  TERMS_VERSION,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
} from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Mark } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'The terms a workshop agrees to when it opens on Carnet: the trial, the charge, cancelling, and what happens to the data.',
};

/**
 * The terms, in plain words. Phase 32.6.
 *
 * Written so that the sentence a workshop is most likely to be surprised by,
 * that the card is charged when the trial ends, is the first thing on the
 * page and the same sentence that sits beside the sign-up button.
 */
export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <Mark size={22} />
        <span className="font-display text-[16px] font-semibold">Carnet</span>
      </Link>

      <p className="eyebrow mb-2">Terms of service</p>
      <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">
        What you agree to when you open a workshop
      </h1>
      <p className="mt-2 text-[13px] text-(--text-faint)">Version {TERMS_VERSION}.</p>

      <div className="prose-carnet mt-8 grid gap-6 text-[15px] leading-relaxed text-(--text-soft)">
        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">
            1. The trial, and the charge that follows it
          </h2>
          <p className="mt-2">
            Opening a workshop starts a free trial of {TRIAL_DAYS} days. To start it you add a
            payment card. Nothing is charged during the trial.
          </p>
          <p className="mt-2">
            <strong className="text-(--text)">
              When the trial ends, the card is charged automatically for the first month of the plan
              you chose, and then every month on the same day, unless you cancel before the trial
              ends.
            </strong>{' '}
            We tell you this here, on the sign-up form, in the welcome email, and again by email{' '}
            {TRIAL_REMINDER_DAYS} days before the trial ends, with the date and the amount.
          </p>
          <p className="mt-2">
            The plans and their prices are on the{' '}
            <Link href="/pricing" className="text-(--brand-text) underline">
              pricing page
            </Link>
            , per bay, per month, and exclude tax. You are billed in the currency of your country,
            the one your books are kept in, and in no other. Paid monthly, per bay per month, the
            plans cost:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                <tr>
                  <th className="py-1 pr-3">Currency</th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} className="py-1 pr-3 text-right">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICED_CURRENCIES.map((currency) => (
                  <tr key={currency} className="border-t border-(--border)">
                    <td className="py-1 pr-3">{currency}</td>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="py-1 pr-3 text-right tabular-nums">
                        {formatMinor(planPrice(id, currency, 'monthly').minor, {
                          currency,
                          locale: 'en',
                        })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            The amount you will be charged, the price times your bays, is shown on your billing page
            before the trial ends.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">2. Cancelling</h2>
          <p className="mt-2">
            You can cancel at any time from Settings, Subscription, in two presses, with no call and
            no notice period. Cancelling during the trial means nothing is ever charged. Cancelling
            after that stops the next charge; the workshop stays open until the end of the month you
            have paid for, then becomes read-only.
          </p>
          <p className="mt-2">
            We do not refund a month already started, except where the law where you are requires it
            or where the service was not available for a material part of that month.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">
            3. If a payment fails
          </h2>
          <p className="mt-2">
            If a charge fails, we tell you by email and the provider tries again over the following
            days. The workshop keeps working while that happens. If no payment succeeds within{' '}
            {GRACE_DAYS} days, the workshop becomes read-only until a payment goes through. Nothing
            is deleted.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">4. Your data</h2>
          <p className="mt-2">
            Everything you enter is yours. A read-only or cancelled workshop can still read all of
            it and export all of it. We do not delete a workshop&apos;s data when it stops paying;
            we delete it when you ask us to, subject to the retention the law requires for invoices
            and tax records.
          </p>
          <p className="mt-2">
            The vehicle passport is different by design: an entry a workshop writes to a
            vehicle&apos;s history belongs to the vehicle&apos;s record and stays readable to the
            vehicle&apos;s owner after the workshop leaves Carnet. Nothing in it identifies a
            workshop&apos;s customers to anybody else.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">
            5. Card payments from your customers
          </h2>
          <p className="mt-2">
            When your customers pay an invoice by card through Carnet, the payment is processed by
            our payment provider. Card details never reach Carnet or you. The provider&apos;s fees
            for those payments are shown on your billing page and on the provider&apos;s statement.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">6. Changes</h2>
          <p className="mt-2">
            If we change a price or these terms in a way that matters, we tell you by email at least
            30 days before it applies, and you can cancel before then. The version you accepted is
            recorded on your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-semibold text-(--text)">7. Who we are</h2>
          <p className="mt-2">
            Carnet is operated by Carnet Software. Questions about these terms or a charge go to the
            support address on the pricing page, and we answer them.
          </p>
        </section>
      </div>
    </main>
  );
}
