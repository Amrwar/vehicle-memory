import {
  COUNTRIES,
  FALLBACK_CURRENCY,
  PLAN_ORDER,
  PLANS,
  type PlanId,
  planPrice,
  PRICED_CURRENCIES,
  TERMS_VERSION,
  TRIAL_DAYS,
} from '@carnet/core';
import { Alert, Button, Field, Input } from '@carnet/ui';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Mark } from '@/components/marketing';
import { SignupPricing } from '@/components/signup-pricing';
import { currentUser, startSession } from '@/lib/auth';
import { requestVerification } from '@/lib/credentials';
import { createWorkshop } from '@/lib/onboarding';
import { startTrialCheckout } from '@/lib/billing';

export const metadata: Metadata = {
  title: 'Start a workshop',
  description: `Open a Carnet workshop. ${TRIAL_DAYS} days free; the card is charged only when the trial ends, and only if you have not cancelled.`,
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

/**
 * Signing up creates a workshop, not an account.
 *
 * The form asks for the business first and the person second, because that is
 * the order the objects are created in and the order the person thinks in:
 * they are opening a workshop, and being its owner is a consequence.
 *
 * Every problem is reported at once. One error at a time turns a form into a
 * guessing game.
 */

async function submit(formData: FormData) {
  'use server';

  const planParam = String(formData.get('plan') ?? 'CORE').toUpperCase();
  const plan = (PLAN_ORDER as readonly string[]).includes(planParam)
    ? (planParam as PlanId)
    : 'CORE';

  // The terms are a box, not a footnote. Without it nothing is created.
  if (formData.get('agree') !== 'on') {
    const params = new URLSearchParams({
      plan: plan.toLowerCase(),
      country: String(formData.get('country') ?? 'GB'),
      workshopName: String(formData.get('workshopName') ?? ''),
      contactName: String(formData.get('contactName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      sites: String(formData.get('sites') ?? 1),
      problems: 'agree:Tick the box to say you have read how the trial and the charge work.',
    });
    redirect(`/signup?${params.toString()}`);
  }

  const outcome = await createWorkshop(
    {
      workshopName: String(formData.get('workshopName') ?? ''),
      contactName: String(formData.get('contactName') ?? ''),
      country: String(formData.get('country') ?? 'GB'),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      sites: Number(formData.get('sites') ?? 1),
    },
    {
      plan,
      // The second submission carries the acknowledgement, so a personal
      // address warns once and then gets out of the way.
      acceptConsumerEmail: formData.get('acceptPersonalEmail') === 'on',
      termsVersion: TERMS_VERSION,
    },
  );

  if (!outcome.ok) {
    const params = new URLSearchParams({
      plan: plan.toLowerCase(),
      country: String(formData.get('country') ?? 'GB'),
      workshopName: String(formData.get('workshopName') ?? ''),
      contactName: String(formData.get('contactName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      sites: String(formData.get('sites') ?? 1),
      problems: outcome.problems.map((p) => `${p.field}:${p.message}`).join('|'),
    });

    redirect(`/signup?${params.toString()}`);
  }

  // Sent here rather than inside createWorkshop, which runs in one transaction
  // and has no business queueing a message that a rollback could not take
  // back. A failure to send is not a failure to sign up: the banner on the
  // dashboard offers the link again, so somebody is never stranded by it.
  await requestVerification(outcome.userId!).catch(() => undefined);

  await startSession(outcome.userId!);

  // The card, before the trial. The provider's page says what the card is
  // for; coming back without one leaves the workshop waiting, not deleted.
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: outcome.orgSlug! },
    select: { id: true },
  });
  const { url } = await startTrialCheckout({ orgId: org.id, userId: outcome.userId! });
  redirect(url);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await currentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;

  const planParam = (params.plan ?? 'core').toUpperCase();
  const plan: PlanId = (PLAN_ORDER as readonly string[]).includes(planParam)
    ? (planParam as PlanId)
    : 'CORE';

  const problems = (params.problems ?? '')
    .split('|')
    .filter(Boolean)
    .map((entry) => {
      const [field, ...rest] = entry.split(':');
      return { field: field ?? '', message: rest.join(':') };
    });

  const problemFor = (field: string) =>
    problems.find((problem) => problem.field === field)?.message;

  const softEmailWarning =
    problems.length > 0 &&
    problems.every((problem) => problem.field === 'email' && problem.message.includes('personal'));

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(27rem,34rem)]">
      {/* The case for doing this, on wide screens. Not decoration: somebody
          filling in a form deserves to be reminded what they are joining. */}
      <section className="hidden flex-col justify-between bg-(--color-petrol-900) p-10 text-(--color-petrol-50) lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-(--color-brass-300)">
            <Mark size={26} />
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-[32px] font-bold leading-[1.1] tracking-tight">
            You are opening a workshop, not an account.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-(--color-petrol-100)">
            The first thing this creates is the business. Your diary, your bays, your tax rates and
            your first employee record exist the moment you finish, so the next call can be booked
            in.
          </p>

          <ul className="mt-7 grid gap-3">
            {[
              `${TRIAL_DAYS} days free. Your card is charged only when the trial ends, and only if you have not cancelled`,
              'Set up with bays, job types and VAT already configured',
              'Every job you put through writes a permanent vehicle history',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[14px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-brass-300)" />
                <span className="text-(--color-petrol-100)">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-(--color-petrol-200)">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </section>

      {/* The form. */}
      <section className="flex flex-col justify-center bg-(--surface) px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-7 flex items-center gap-2.5 lg:hidden">
            <Mark size={22} />
            <span className="font-display text-[16px] font-semibold">Carnet</span>
          </Link>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Start free</p>
            <p className="text-[13px] text-(--text-soft)">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-(--brand-text) underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">
            Open your workshop
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
            {`${TRIAL_DAYS} days free on ${PLANS[plan].name}. You add a card on the next page; it is charged on the day the trial ends unless you cancel before, and nothing is ever deleted.`}
          </p>

          {problems.length > 0 ? (
            <Alert tone={softEmailWarning ? 'warning' : 'danger'} className="mt-5">
              {softEmailWarning
                ? 'One thing to check before we continue.'
                : `${problems.length} thing${problems.length === 1 ? '' : 's'} to fix.`}
            </Alert>
          ) : null}

          <form action={submit} className="mt-6 grid gap-4">
            <input type="hidden" name="plan" value={plan} />

            <Field
              label="Workshop name"
              hint="As it appears on your invoices"
              error={problemFor('workshopName')}
            >
              <Input
                name="workshopName"
                defaultValue={params.workshopName ?? ''}
                autoComplete="organization"
                required
                placeholder="Hillside Motors"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[1fr_7.5rem]">
              <Field label="Your name" error={problemFor('contactName')}>
                <Input
                  name="contactName"
                  defaultValue={params.contactName ?? ''}
                  autoComplete="name"
                  required
                  placeholder="Ahmed Bakri"
                />
              </Field>

              <Field label="Sites" hint="Premises" error={problemFor('sites')}>
                <Input
                  name="sites"
                  type="number"
                  min={1}
                  max={200}
                  defaultValue={params.sites ?? '1'}
                  required
                />
              </Field>
            </div>

            <Field
              label="Work email"
              hint="This becomes the owner account"
              error={problemFor('email')}
            >
              <Input
                name="email"
                type="email"
                inputMode="email"
                defaultValue={params.email ?? ''}
                autoComplete="email"
                required
                placeholder="you@yourworkshop.co.uk"
              />
            </Field>

            {softEmailWarning ? (
              <label className="flex items-start gap-2.5 rounded-(--radius-md) bg-(--warning-soft) px-3 py-2.5 text-[13px] leading-relaxed text-(--warning)">
                <input
                  type="checkbox"
                  name="acceptPersonalEmail"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--warning)"
                />
                <span>
                  Use this address anyway. I understand the account will be tied to a personal
                  inbox.
                </span>
              </label>
            ) : null}

            <Field label="Phone" hint="Optional">
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={params.phone ?? ''}
                autoComplete="tel"
                placeholder="0161 496 0114"
              />
            </Field>

            <Field label="Password" hint="At least 10 characters" error={problemFor('password')}>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </Field>

            <SignupPricing
              countries={COUNTRIES.map((c) => ({
                code: c.code,
                name: c.name,
                currency: c.currency,
                locale: c.locale,
              }))}
              plans={PLAN_ORDER.map((id) => ({ id, name: PLANS[id].name }))}
              book={Object.fromEntries(
                PRICED_CURRENCIES.map((currency) => [
                  currency,
                  Object.fromEntries(
                    PLAN_ORDER.map((id) => [id, planPrice(id, currency, 'monthly').minor]),
                  ),
                ]),
              )}
              fallbackCurrency={FALLBACK_CURRENCY}
              defaultCountry={params.country ?? 'GB'}
              defaultPlan={plan}
              trialDays={TRIAL_DAYS}
              countryError={problemFor('country')}
              termsHref="/terms"
            />

            <Button type="submit" variant="primary" size="lg" block className="mt-1">
              Create the workshop and add a card
            </Button>

            <p className="text-center text-[12px] leading-relaxed text-(--text-faint)">
              Nothing is charged today. You will be reminded by email three days before the trial
              ends, with the date and the amount.
            </p>
          </form>

          <p className="mt-6 text-center text-[13px] text-(--text-soft) lg:hidden">
            Already have an account?{' '}
            <Link href="/login" className="text-(--brand-text) underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
