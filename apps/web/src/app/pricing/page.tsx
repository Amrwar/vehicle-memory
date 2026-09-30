import {
  type FeatureKey,
  describeFeature,
  msg,
  NO_LIMIT,
  PLAN_ORDER,
  PLANS,
  TRIAL_DAYS,
  annualSavingPercent,
  COUNTRIES,
  formatMinor,
  planPrice,
  pricingCurrency,
} from '@carnet/core';
import { cn } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter, MarketingHeader, Section, SectionHead } from '@/components/marketing';
import { currentUser } from '@/lib/auth';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Pricing'),
    description: t(
      'Three plans, priced per bay. Unlimited staff accounts on every one. The vehicle passport is included in all of them.',
    ),
    robots: { index: true, follow: true },
  };
}

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
  { key: 'bays', label: msg('Bays') },
  { key: 'locations', label: msg('Sites') },
  { key: 'users', label: msg('Staff accounts') },
  { key: 'vehicles', label: msg('Vehicles on the books') },
] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; country?: string }>;
}) {
  const t = await tFor();
  const user = await currentUser();
  const { billing, country: countryParam } = await searchParams;
  const annual = billing !== 'monthly';
  const country = COUNTRIES.find((c) => c.code === (countryParam ?? 'GB')) ?? COUNTRIES[0]!;
  const currency = pricingCurrency(country.currency);
  const show = (minor: number) => formatMinor(minor, { currency, locale: country.locale });
  const term = annual ? 'annual' : 'monthly';

  return (
    <>
      <MarketingHeader signedIn={Boolean(user)} />

      <main id="main">
        <Section tone="surface">
          <SectionHead
            eyebrow={t('Pricing')}
            primary
            title={t('Per bay, per month, published in full')}
            lede={t(
              'Priced per bay, because bays are what a workshop earns from. Staff accounts are unlimited on every plan: charging per user would bill you for giving your own people access.',
            )}
            align="centre"
          />

          <div className="mt-7 flex justify-center">
            <div
              role="group"
              aria-label={t('Billing period')}
              className="inline-flex gap-0.5 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-0.5"
            >
              <Link
                href={`/pricing?country=${country.code}`}
                className={cn(
                  'inline-flex items-center rounded-(--radius-sm) px-3.5 py-1.5 text-[13px] transition-colors pointer-coarse:min-h-10',
                  annual
                    ? 'bg-(--surface) font-medium shadow-sm'
                    : 'text-(--text-faint) hover:text-(--text)',
                )}
              >
                {t('Annual')}
              </Link>
              <Link
                href={`/pricing?billing=monthly&country=${country.code}`}
                className={cn(
                  'inline-flex items-center rounded-(--radius-sm) px-3.5 py-1.5 text-[13px] transition-colors pointer-coarse:min-h-10',
                  !annual
                    ? 'bg-(--surface) font-medium shadow-sm'
                    : 'text-(--text-faint) hover:text-(--text)',
                )}
              >
                {t('Monthly')}
              </Link>
            </div>
          </div>

          <form
            method="get"
            className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]"
          >
            <input type="hidden" name="billing" value={annual ? 'annual' : 'monthly'} />
            <label htmlFor="pricing-country" className="text-(--text-faint)">
              {t('Prices in the currency of')}
            </label>
            <select
              id="pricing-country"
              name="country"
              defaultValue={country.code}
              className="min-w-0 max-w-full rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {t(c.name)} · {c.currency}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-(--radius-sm) border border-(--border-strong) px-2.5 py-1 font-medium"
            >
              {t('Show')}
            </button>
          </form>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const price = planPrice(id, currency, term);

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
                    <h2 className="font-display text-[19px] font-semibold">{t(plan.name)}</h2>
                    {plan.popular ? (
                      <span className="rounded-(--radius-xs) bg-(--brand-soft) px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wide text-(--brand-text)">
                        {t('Most chosen')}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 min-h-[2.6rem] text-[13px] leading-relaxed text-(--text-soft)">
                    {t(plan.audience)}
                  </p>

                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="tabular font-display text-[38px] font-bold leading-none">
                      {show(price.minor)}
                    </span>
                    <span className="text-[13px] text-(--text-faint)">
                      {t('per bay, per month')}
                    </span>
                  </p>

                  <p className="mt-1.5 text-[12px] text-(--text-faint)">
                    {annual ? (
                      <>
                        {t('Billed annually. Saves {percent}% against {monthly} monthly.', {
                          percent: annualSavingPercent(id, currency),
                          monthly: show(planPrice(id, currency, 'monthly').minor),
                        })}
                      </>
                    ) : (
                      <>{t('Billed monthly. Cancel any time.')}</>
                    )}
                  </p>

                  <Link
                    href={`/signup?plan=${id.toLowerCase()}&country=${country.code}`}
                    className={cn(
                      'mt-5 rounded-(--radius-md) px-4 py-2.5 text-center text-[14px] font-medium transition-colors',
                      plan.popular
                        ? 'bg-(--brand-solid) text-(--on-brand-solid) shadow-sm hover:bg-(--brand-solid-hover)'
                        : 'border border-(--border-strong) hover:bg-(--surface-sunk)',
                    )}
                  >
                    {t('Start {days}-day trial', { days: TRIAL_DAYS })}
                  </Link>

                  <ul className="mt-5 grid gap-2 border-t border-(--border) pt-5">
                    {plan.headline.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <Tick />
                        <span className="text-(--text-soft)">{t(line)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-[13px] text-(--text-faint)">
            {t(
              'Prices are in {currency}, per bay per month, and exclude {tax}. You are billed in the currency of your country and no other. The trial creates a real workshop with your data in it. A card is added at sign-up and charged only when the trial ends, unless you cancel first.',
              { currency, tax: t(country.tax.name) },
            )}
          </p>
        </Section>

        {/* --- the table -------------------------------------------------- */}
        <Section id="compare">
          <SectionHead
            eyebrow={t('Compare')}
            title={t('What each plan actually includes')}
            lede={t(
              'Limits are counted and enforced. When a workshop reaches one, the system says so before it stops rather than after.',
            )}
          />

          <div className="scroll-x mt-8 rounded-(--radius-lg) border border-(--border) bg-(--surface)">
            <table className="w-full border-collapse text-[13px]">
              {/* The header stays. Forty rows down, at "Single sign-on",
                  nothing said which column was Core and which was Group, so
                  the table could be read and not used -- which is the whole of
                  what a comparison table is for. `top-14` clears the sticky
                  site header above it. Phase 94. */}
              <thead className="sticky top-14 z-10">
                <tr className="border-b border-(--border)">
                  <th
                    scope="col"
                    className="bg-(--surface) p-3.5 text-start font-medium backdrop-blur"
                  >
                    <span className="eyebrow">{t('Limits')}</span>
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className={cn(
                        'p-3.5 text-center font-semibold backdrop-blur',
                        // The column the cards above call "Most chosen" is the
                        // one somebody came to read. It was indistinguishable
                        // from the other two.
                        PLANS[id].popular
                          ? 'bg-(--brand-soft) text-(--brand-text)'
                          : 'bg-(--surface)',
                      )}
                    >
                      {t(PLANS[id].name)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {LIMIT_ROWS.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-(--border) transition-colors hover:bg-(--surface-sunk)"
                  >
                    <th scope="row" className="p-3.5 text-start font-normal text-(--text-soft)">
                      {t(row.label)}
                    </th>
                    {PLAN_ORDER.map((id) => {
                      const value = PLANS[id].limits[row.key];
                      return (
                        <td
                          key={id}
                          className={cn(
                            // Centred under the heading rather than pushed to
                            // the far edge: the eye had to cross the whole
                            // column to pair a mark with its plan.
                            'tabular p-3.5 text-center',
                            PLANS[id].popular ? 'bg-(--brand-soft)/40' : '',
                          )}
                        >
                          {value >= NO_LIMIT ? (
                            <span className="text-(--text-faint)">{t('No limit')}</span>
                          ) : (
                            value.toLocaleString('en-GB')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="border-b border-(--border) bg-(--surface-sunk)">
                  <th scope="row" colSpan={4} className="p-3.5 text-start">
                    <span className="eyebrow">{t('Features')}</span>
                  </th>
                </tr>

                {COMPARED.map((feature) => (
                  <tr
                    key={feature}
                    className="border-b border-(--border) transition-colors last:border-0 hover:bg-(--surface-sunk)"
                  >
                    <th scope="row" className="p-3.5 text-start font-normal text-(--text-soft)">
                      {t(capitalise(describeFeature(feature)))}
                    </th>
                    {PLAN_ORDER.map((id) => (
                      <td
                        key={id}
                        className={cn(
                          'p-3.5 text-center',
                          PLANS[id].popular ? 'bg-(--brand-soft)/40' : '',
                        )}
                      >
                        {PLANS[id].features[feature] ? (
                          <span className="inline-flex justify-center">
                            <Tick />
                            <span className="sr-only">{t('Included')}</span>
                          </span>
                        ) : (
                          <span className="text-(--text-faint)" aria-label={t('Not included')}>
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
          <SectionHead
            eyebrow={t('Questions')}
            title={t('The ones worth answering before you start')}
          />

          <div className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border) md:grid-cols-2">
            {[
              {
                q: msg('Why is the passport in the cheapest plan?'),
                a: msg(
                  'Because a network nobody can join is not a network. The record is worth more to every workshop the more vehicles carry one, so putting it behind the top tier would strangle the part of the product that compounds.',
                ),
              },
              {
                q: msg('What happens at the end of the trial?'),
                a: msg(
                  'You add a card when you open the workshop; nothing is charged for {days} days. On the day the trial ends the card is charged for the first month of the plan you chose, and monthly after that, unless you cancelled before then, which takes two presses from Settings. We remind you by email three days before. Nothing is ever deleted: a cancelled workshop still reads and exports everything.',
                ),
              },
              {
                q: msg('Why per bay rather than per user?'),
                a: msg(
                  'Because bays are what a workshop earns from, and users are not. Charging per seat bills you for giving your own staff access, which pushes workshops into sharing a login and makes every record say the wrong person did the work.',
                ),
              },
              {
                q: msg('What counts as a site?'),
                a: msg(
                  'A physical premises with its own bays and its own stock. Two units on the same industrial estate sharing a store is one site. Two towns is two.',
                ),
              },
              {
                q: msg('Do customers using the portal count?'),
                a: msg(
                  'No. Your customers are unlimited on every plan, and so is the number of people who read a passport link.',
                ),
              },
              {
                q: msg('Can we move our existing history in?'),
                a: msg(
                  'Yes, and it is worth doing. Imported history is marked as migrated rather than as verified work you recorded, because a record that cannot distinguish the two is not worth trusting.',
                ),
              },
              {
                q: msg('What happens if we leave?'),
                a: msg(
                  'Your data exports in full. The passports stay with the vehicles, which is the point of them: they were never yours to take away.',
                ),
              },
            ].map((item) => (
              <div key={item.q} className="bg-(--surface) p-5">
                <h3 className="font-display text-[15px] font-semibold">{t(item.q)}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">
                  {t(item.a, { days: TRIAL_DAYS })}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <section className="bg-(--color-petrol-900) px-4 py-14 text-(--color-petrol-50) sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(1.4rem,4vw,2rem)] font-semibold tracking-tight">
              {t('Still deciding?')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-(--color-petrol-100)">
              {t('Open a passport and see what a car carries. No account, no form.')}
            </p>
            {/* On a petrol band the primary action is the near-white the band's own
                text is set in, not brass. Brass is the focus ring and an
                accent; using it for the one button on a dark teal panel made
                the most important control on the page look like a warning
                label, and it appeared nowhere else in the product as an
                action. Inverted primary is the ordinary answer and it reads
                as deliberate. Phase 94. */}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/p/demo-share-token"
                className="rounded-(--radius-md) bg-(--color-petrol-50) px-5 py-3 text-[15px] font-semibold text-(--color-petrol-950) shadow-sm transition-colors hover:bg-white"
              >
                {t('Open a passport')}
              </Link>
              <Link
                href="/signup"
                className="rounded-(--radius-md) border border-(--color-petrol-100)/35 px-5 py-3 text-[15px] font-medium text-(--color-petrol-50) transition-colors hover:border-(--color-petrol-100)/70 hover:bg-(--color-petrol-100)/10"
              >
                {t('Start a {days}-day trial', { days: TRIAL_DAYS })}
              </Link>
            </div>
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
