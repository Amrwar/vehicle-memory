import {
  type FeatureKey,
  describeFeature,
  NO_LIMIT,
  PLAN_ORDER,
  PLANS,
  savingPercent,
  TRIAL_DAYS,
} from '@carnet/core';
import { cn } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter, MarketingHeader, Section, SectionHead } from '@/components/marketing';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Three plans, priced per bay. Unlimited staff accounts on every one. The vehicle passport is included in all of them.',
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

/**
 * Pricing.
 *
 * Every figure on this page comes from the same plan definitions the
 * application enforces. A price list maintained separately from the limits it
 * describes drifts within a month, and the first person to notice is a
 * customer who was promised something the system refuses to do.
 */

const COMPARED: FeatureKey[] = [
  'passport',
  'inspections',
  'estimates',
  'inventory',
  'purchasing',
  'ledger',
  'statements',
  'payroll',
  'commission',
  'multiSite',
  'transfers',
  'api',
  'sso',
];

const LIMIT_ROWS = [
  { key: 'bays', label: 'Bays' },
  { key: 'locations', label: 'Sites' },
  { key: 'users', label: 'Staff accounts' },
  { key: 'vehicles', label: 'Vehicles on the books' },
] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const user = await currentUser();
  const { billing } = await searchParams;
  const annual = billing !== 'monthly';

  return (
    <>
      <MarketingHeader signedIn={Boolean(user)} />

      <main id="main">
        <Section tone="surface">
          <SectionHead
            eyebrow="Pricing"
            primary
            title="Per bay, per month, published in full"
            lede="Priced per bay, because bays are what a workshop earns from. Staff accounts are unlimited on every plan: charging per user would bill you for giving your own people access."
            align="centre"
          />

          <div className="mt-7 flex justify-center">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex gap-0.5 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-0.5"
            >
              <Link
                href="/pricing"
                className={cn(
                  'rounded-(--radius-sm) px-3.5 py-1.5 text-[13px] transition-colors',
                  annual
                    ? 'bg-(--surface) font-medium shadow-sm'
                    : 'text-(--text-faint) hover:text-(--text)',
                )}
              >
                Annual
              </Link>
              <Link
                href="/pricing?billing=monthly"
                className={cn(
                  'rounded-(--radius-sm) px-3.5 py-1.5 text-[13px] transition-colors',
                  !annual
                    ? 'bg-(--surface) font-medium shadow-sm'
                    : 'text-(--text-faint) hover:text-(--text)',
                )}
              >
                Monthly
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const price = annual ? plan.price : plan.priceMonthly;

              return (
                <div
                  key={id}
                  className={cn(
                    'flex flex-col rounded-(--radius-lg) border bg-(--surface) p-6',
                    plan.popular
                      ? 'border-(--brand) shadow-md ring-1 ring-(--brand-soft)'
                      : 'border-(--border)',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-[19px] font-semibold">{plan.name}</h2>
                    {plan.popular ? (
                      <span className="rounded-(--radius-xs) bg-(--brand-soft) px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide text-(--brand-text)">
                        Most chosen
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 min-h-[2.6rem] text-[13px] leading-relaxed text-(--text-soft)">
                    {plan.audience}
                  </p>

                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="tabular font-display text-[38px] font-bold leading-none">
                      £{price.minor / 100}
                    </span>
                    <span className="text-[13px] text-(--text-faint)">per bay, per month</span>
                  </p>

                  <p className="mt-1.5 text-[12px] text-(--text-faint)">
                    {annual ? (
                      <>
                        Billed annually. Saves {savingPercent(id)}% against £
                        {plan.priceMonthly.minor / 100} monthly.
                      </>
                    ) : (
                      <>Billed monthly. Cancel any time.</>
                    )}
                  </p>

                  <Link
                    href={`/signup?plan=${id.toLowerCase()}`}
                    className={cn(
                      'mt-5 rounded-(--radius-md) px-4 py-2.5 text-center text-[14px] font-medium transition-colors',
                      plan.popular
                        ? 'bg-(--brand-solid) text-(--on-brand-solid) shadow-sm hover:bg-(--brand-solid-hover)'
                        : 'border border-(--border-strong) hover:bg-(--surface-sunk)',
                    )}
                  >
                    Start {TRIAL_DAYS}-day trial
                  </Link>

                  <ul className="mt-5 grid gap-2 border-t border-(--border) pt-5">
                    {plan.headline.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <Tick />
                        <span className="text-(--text-soft)">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-[13px] text-(--text-faint)">
            Prices exclude VAT. The trial creates a real workshop with your data in it. A card is
            added at sign-up and charged only when the trial ends, unless you cancel first.
          </p>
        </Section>

        {/* --- the table -------------------------------------------------- */}
        <Section id="compare">
          <SectionHead
            eyebrow="Compare"
            title="What each plan actually includes"
            lede="Limits are counted and enforced. When a workshop reaches one, the system says so before it stops rather than after."
          />

          <div className="scroll-x mt-8 rounded-(--radius-lg) border border-(--border) bg-(--surface)">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-(--border)">
                  <th scope="col" className="p-3.5 text-left font-medium">
                    <span className="eyebrow">Limits</span>
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} scope="col" className="p-3.5 text-right font-semibold">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {LIMIT_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-(--border)">
                    <th scope="row" className="p-3.5 text-left font-normal text-(--text-soft)">
                      {row.label}
                    </th>
                    {PLAN_ORDER.map((id) => {
                      const value = PLANS[id].limits[row.key];
                      return (
                        <td key={id} className="tabular p-3.5 text-right">
                          {value >= NO_LIMIT ? (
                            <span className="text-(--text-faint)">No limit</span>
                          ) : (
                            value.toLocaleString('en-GB')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="border-b border-(--border) bg-(--surface-sunk)">
                  <th scope="row" colSpan={4} className="p-3.5 text-left">
                    <span className="eyebrow">Features</span>
                  </th>
                </tr>

                {COMPARED.map((feature) => (
                  <tr key={feature} className="border-b border-(--border) last:border-0">
                    <th scope="row" className="p-3.5 text-left font-normal text-(--text-soft)">
                      {capitalise(describeFeature(feature))}
                    </th>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="p-3.5 text-right">
                        {PLANS[id].features[feature] ? (
                          <span className="inline-flex justify-end">
                            <Tick />
                            <span className="sr-only">Included</span>
                          </span>
                        ) : (
                          <span className="text-(--text-faint)" aria-label="Not included">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* --- questions --------------------------------------------------- */}
        <Section tone="surface">
          <SectionHead eyebrow="Questions" title="The ones worth answering before you start" />

          <div className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border) md:grid-cols-2">
            {[
              {
                q: 'Why is the passport in the cheapest plan?',
                a: 'Because a network nobody can join is not a network. The record is worth more to every workshop the more vehicles carry one, so putting it behind the top tier would strangle the part of the product that compounds.',
              },
              {
                q: 'What happens at the end of the trial?',
                a: `You add a card when you open the workshop; nothing is charged for ${TRIAL_DAYS} days. On the day the trial ends the card is charged for the first month of the plan you chose, and monthly after that, unless you cancelled before then, which takes two presses from Settings. We remind you by email three days before. Nothing is ever deleted: a cancelled workshop still reads and exports everything.`,
              },
              {
                q: 'Why per bay rather than per user?',
                a: 'Because bays are what a workshop earns from, and users are not. Charging per seat bills you for giving your own staff access, which pushes workshops into sharing a login and makes every record say the wrong person did the work.',
              },
              {
                q: 'What counts as a site?',
                a: 'A physical premises with its own bays and its own stock. Two units on the same industrial estate sharing a store is one site. Two towns is two.',
              },
              {
                q: 'Do customers using the portal count?',
                a: 'No. Your customers are unlimited on every plan, and so is the number of people who read a passport link.',
              },
              {
                q: 'Can we move our existing history in?',
                a: 'Yes, and it is worth doing. Imported history is marked as migrated rather than as verified work you recorded, because a record that cannot distinguish the two is not worth trusting.',
              },
              {
                q: 'What happens if we leave?',
                a: 'Your data exports in full. The passports stay with the vehicles, which is the point of them: they were never yours to take away.',
              },
            ].map((item) => (
              <div key={item.q} className="bg-(--surface) p-5">
                <h3 className="font-display text-[15px] font-semibold">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        <section className="bg-(--color-petrol-900) px-4 py-14 text-(--color-petrol-50) sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(1.4rem,4vw,2rem)] font-semibold tracking-tight">
              Still deciding?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-(--color-petrol-100)">
              Open a passport and see what a car carries. No account, no form.
            </p>
            <Link
              href="/p/demo-share-token"
              className="mt-6 inline-block rounded-(--radius-md) bg-(--color-brass-400) px-5 py-3 text-[15px] font-medium text-(--color-petrol-950) transition-opacity hover:opacity-90"
            >
              Open a passport
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}

function Tick() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="mt-0.5 shrink-0 text-(--success)"
    >
      <path
        d="m3.4 8.4 3 3 6.2-6.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
