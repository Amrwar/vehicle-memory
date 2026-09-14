import { PLANS } from '@carnet/core';
import { cn } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFooter, MarketingHeader, Section, SectionHead } from '@/components/marketing';
import { PassportBooklet } from '@/components/passport-booklet';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Carnet — workshop management with a service history that follows the car',
  description:
    'Run the diary, jobs, inspections, parts and the books in one system. Every job writes to a service history the vehicle keeps for life, and takes with it when it is sold.',
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

/**
 * The front door.
 *
 * Written for somebody who runs a workshop and has ten minutes, not for
 * somebody who likes software. The order is theirs: what breaks today, what
 * this does about it, what makes it different from the incumbent, what it
 * costs, and how to start. The passport gets its own section because it is the
 * only claim here that nobody else can make.
 *
 * No hero the height of the screen. The first still frame has to carry the
 * proposition, and a full-viewport opener pushes the proposition off it.
 */
export default async function HomePage() {
  const user = await currentUser();

  return (
    <>
      <MarketingHeader signedIn={Boolean(user)} />

      <main id="main">
        {/* --- proposition ------------------------------------------------ */}
        <section className="border-b border-(--border) bg-(--surface) px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-[1180px] items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="eyebrow mb-3">Workshop management · Vehicle passport</p>
              <h1 className="font-display text-[clamp(2rem,6vw,3.15rem)] font-bold leading-[1.05] tracking-[-0.02em]">
                The history should belong to the car.
              </h1>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-(--text-soft)">
                Carnet runs the diary, the job, the inspection, the parts and the books. Every
                completed job also writes to a permanent record the vehicle keeps, verifiable by
                whoever owns it next.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className={cn(
                    'rounded-(--radius-md) bg-(--brand-solid) px-5 py-3 text-[15px] font-medium',
                    'text-(--on-brand-solid) shadow-sm transition-colors hover:bg-(--brand-solid-hover)',
                  )}
                >
                  Start a 14-day trial
                </Link>
                <Link
                  href="/p/demo-share-token"
                  className={cn(
                    'rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-5 py-3',
                    'text-[15px] transition-colors hover:bg-(--surface-sunk)',
                  )}
                >
                  See a real passport
                </Link>
              </div>

              <p className="mt-3.5 text-[13px] text-(--text-faint)">
                No card. The trial creates a real workshop you keep.
              </p>
            </div>

            {/* The claim, as an object. A passport you can open, with the
                vehicle turning in its photograph window and its real entries
                pressed as stamps. The one thing on this page a competitor
                cannot copy: they have no record that belongs to the car.
                Everything it shows is also text and buttons, so the canvas
                inside it is decoration in the strict sense. */}
            <PassportBooklet />
          </div>
        </section>

        {/* --- the problem ------------------------------------------------ */}
        <Section id="how">
          <SectionHead
            eyebrow="The problem"
            title="A car outlives every system that ever recorded it"
            lede="Three garages, two owners and eleven years later, the folder in the glovebox is a stack of receipts and a guess. The work was real. The evidence is gone."
          />

          <div className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border) sm:grid-cols-3">
            {[
              {
                title: 'The garage owns the record',
                body: 'Your history lives in your system. When the customer moves away, or you close, it goes with you. The car keeps nothing.',
              },
              {
                title: 'Nobody can verify a claim',
                body: '"Full service history" means a folder of paper anybody could print. A buyer discounts what they cannot check, and the seller pays for it.',
              },
              {
                title: 'The next garage starts blind',
                body: 'A car arrives with no record of the cambelt, the fluid, or what the last workshop already advised on. The same checks get done twice and paid for once.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-(--surface) p-5">
                <h3 className="font-display text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- the passport ----------------------------------------------- */}
        <Section id="passport" tone="surface">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <SectionHead
                eyebrow="What makes this different"
                title="A record the vehicle keeps"
                lede="Every completed job writes entries against the car itself: the work, the parts, the mileage, the photographs. Not against your customer record. Against the VIN."
              />

              <dl className="mt-7 grid gap-5">
                {[
                  {
                    term: 'It transfers on sale',
                    detail:
                      'Ownership changes hands and the history goes with the car. The new owner sees everything, including what a workshop they have never heard of did in 2019.',
                  },
                  {
                    term: 'It cannot be quietly edited',
                    detail:
                      'Entries are appended and hash-linked. Correcting one leaves both versions visible. A history that can be rewritten is worth exactly as much as the folder it replaced.',
                  },
                  {
                    term: 'It is worth money at resale',
                    detail:
                      'A verifiable record is the difference between a buyer taking your word for it and a buyer checking. That difference has a price, and the seller has been paying it.',
                  },
                  {
                    term: 'It works even where Carnet does not',
                    detail:
                      'A passport opens as a public link. The next garage needs no account, no login and no relationship with us to read what you wrote.',
                  },
                ].map((item) => (
                  <div key={item.term} className="border-l-2 border-(--accent) pl-4">
                    <dt className="font-display text-[15px] font-semibold">{item.term}</dt>
                    <dd className="mt-1.5 text-[13px] leading-relaxed text-(--text-soft)">
                      {item.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <PassportSample />
          </div>
        </Section>

        {/* --- what it does ----------------------------------------------- */}
        <Section id="features">
          <SectionHead
            eyebrow="What it does"
            title="The whole job, from the phone call to the ledger"
            lede="One data model, so the estimate the customer approved is the job the technician worked, is the invoice they paid, is the entry in the accounts. Nothing is re-keyed."
          />

          <div className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border) sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Diary and jobs',
                body: 'Bay-level scheduling with real capacity. Fourteen job statuses that refuse the transitions that make no sense, and say why.',
              },
              {
                title: 'Inspections with photographs',
                body: 'Structured checks with measurements and pictures. A customer approving brake work can see the pads.',
              },
              {
                title: 'Estimates the customer decides on',
                body: 'Sent as a link, approved line by line. Work exceeding what was approved needs approving again.',
              },
              {
                title: 'Parts and purchasing',
                body: 'Weighted average cost, reservations against jobs, reorder suggestions from actual usage, three-way bill matching.',
              },
              {
                title: 'Invoicing and the ledger',
                body: 'Double-entry posted from the work itself. Trial balance, profit and loss, balance sheet, VAT, aged debtors.',
              },
              {
                title: 'People and productivity',
                body: 'Attended, clocked and sold hours side by side, so utilisation and efficiency stop hiding each other.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-(--surface) p-5">
                <h3 className="font-display text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* --- the day ---------------------------------------------------- */}
        <Section tone="surface">
          <SectionHead
            eyebrow="A Tuesday"
            title="What the flow actually looks like"
            lede="Every step below writes to the same job. The passport entries at the end are produced by the work, not typed in afterwards."
          />

          <ol className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border) md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: 'Books in',
                body: 'Customer calls. Booking takes a bay and a technician, and checks the day has room for it.',
              },
              {
                step: 'Inspected',
                body: 'Technician works the checklist on a tablet. Two reds and three ambers, with photographs.',
              },
              {
                step: 'Approved',
                body: 'Estimate goes out as a link. The customer approves the brakes and declines the tyres.',
              },
              {
                step: 'Invoiced and recorded',
                body: 'Parts leave stock, time is costed, the invoice posts to the ledger, and the car keeps the history.',
              },
            ].map((item, index) => (
              <li key={item.step} className="bg-(--surface) p-5">
                <span className="datum text-[11px] text-(--accent)">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-1.5 font-display text-[15px] font-semibold">{item.step}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">{item.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* --- pricing teaser --------------------------------------------- */}
        <Section>
          <SectionHead
            eyebrow="Pricing"
            title="Priced per bay, published in full"
            lede="Three plans, and unlimited staff accounts on every one. The vehicle passport is in all of them, because a network nobody can join is not a network."
            align="centre"
          />

          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {(['CORE', 'COMPLETE', 'GROUP'] as const).map((id) => {
              const plan = PLANS[id];

              return (
                <div
                  key={id}
                  className={cn(
                    'rounded-(--radius-lg) border bg-(--surface) p-5',
                    plan.popular ? 'border-(--brand) shadow-md' : 'border-(--border)',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-[16px] font-semibold">{plan.name}</h3>
                    {plan.popular ? (
                      <span className="rounded-(--radius-xs) bg-(--brand-soft) px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide text-(--brand-text)">
                        Most chosen
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                    {plan.audience}
                  </p>
                  <p className="mt-3">
                    <span className="tabular font-display text-[26px] font-semibold">
                      £{plan.price.minor / 100}
                    </span>
                    <span className="text-[12px] text-(--text-faint)"> /bay /month</span>
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center">
            <Link
              href="/pricing"
              className="text-[14px] text-(--brand-text) underline underline-offset-4 hover:opacity-80"
            >
              See what each plan includes
            </Link>
          </p>
        </Section>

        {/* --- close ------------------------------------------------------ */}
        <section className="bg-(--color-petrol-900) px-4 py-14 text-(--color-petrol-50) sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(1.5rem,4vw,2.1rem)] font-semibold leading-tight tracking-tight">
              Start with one car
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-(--color-petrol-100)">
              Put the next job through it. At the end you will have an invoice, a set of accounts
              that balance, and one vehicle with a history it keeps for the rest of its life.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-(--radius-md) bg-(--color-brass-400) px-5 py-3 text-[15px] font-medium text-(--color-petrol-950) shadow-sm transition-opacity hover:opacity-90"
              >
                Start a 14-day trial
              </Link>
              <Link
                href="/pricing"
                className="rounded-(--radius-md) border border-(--color-petrol-700) px-5 py-3 text-[15px] transition-colors hover:bg-(--color-petrol-800)"
              >
                See pricing
              </Link>
            </div>

            {/* The other half of the promise. Everything above is addressed to
                a workshop, and a driver who read this far deserves a door of
                their own rather than being left to work out that the trial is
                not for them. */}
            <p className="mt-8 text-[14px] leading-relaxed text-(--color-petrol-200)">
              Not a workshop?{' '}
              <Link
                href="/signup/customer"
                className="text-(--color-brass-300) underline underline-offset-2"
              >
                Keep your own car&rsquo;s history
              </Link>{' '}
              instead. Free, and the record follows the car when you sell it.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Illustrations
   --------------------------------------------------------------------------- */

/** A fragment of a real passport entry, at the level of detail it carries. */
function PassportSample() {
  return (
    <div className="rounded-(--radius-xl) border border-(--border) bg-(--ground) p-5 shadow-sm">
      <p className="eyebrow mb-3">An entry, as the next owner sees it</p>

      <div className="grid gap-3">
        {[
          {
            when: '12 March 2024',
            who: 'Pennine Motors',
            title: 'Front brake pads and discs replaced',
            detail: 'Pads at 2mm on inspection. Discs lipped. Photographs attached.',
            mileage: '84,102 mi',
          },
          {
            when: '12 March 2024',
            who: 'Pennine Motors',
            title: 'Advisory: rear tyres approaching limit',
            detail: 'Declined by owner at the time. Recorded either way.',
            mileage: '84,102 mi',
          },
        ].map((entry) => (
          <div
            key={entry.title}
            className="rounded-(--radius-md) border border-(--border) bg-(--surface) p-3.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p className="text-[13px] font-medium">{entry.title}</p>
              <span className="datum text-[11px] text-(--text-faint)">{entry.mileage}</span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-(--text-soft)">{entry.detail}</p>
            <p className="mt-1.5 text-[11px] text-(--text-faint)">
              {entry.when} · {entry.who}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-[12px] leading-relaxed text-(--text-faint)">
        The declined advisory is in the record too. A history that only shows what was sold is a
        sales document, not a history.
      </p>
    </div>
  );
}
