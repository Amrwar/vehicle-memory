import { RESET_MIN_PASSWORD_LENGTH } from '@carnet/core';
import { Alert, Button, Card, CardBody, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Mark } from '@/components/marketing';
import { currentUser, startSession } from '@/lib/auth';
import { ClaimError, registerCustomer } from '@/lib/claims';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Keep your car history'),
    description: t(
      'A free Carnet account for drivers. Every service, repair and MOT on your car, in one place, and it stays with the car when you sell it.',
    ),
    robots: { index: true, follow: true },
  };
}

export const dynamic = 'force-dynamic';

/**
 * Signing up as a driver.
 *
 * The other sign-up page creates a business. This one creates a person, and
 * the difference matters more than it looks: a workshop account arrives with a
 * diary, bays and tax rates, whereas this account arrives with nothing at all
 * and is worth nothing until a workshop says otherwise.
 *
 * That emptiness is the feature. Anybody can read a plate through a windscreen,
 * so if typing one were enough to open a service history, the history would be
 * public. The page says so rather than letting somebody sign up expecting their
 * car to be waiting.
 */

/**
 * Where to send them afterwards, when they arrived from somewhere.
 *
 * Only ever a path on this site: an address somebody can put in a link is an
 * address somebody can point at another site, and "sign up and you will be
 * taken straight there" is exactly the sentence that makes that work.
 */
function safeNext(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

async function submit(formData: FormData) {
  'use server';

  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  const next = safeNext(String(formData.get('next') ?? '') || undefined);

  try {
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    const user = await registerCustomer({
      name,
      email,
      password: String(formData.get('password') ?? ''),
      ip,
    });

    await startSession(user.id);
  } catch (error) {
    if (!(error instanceof ClaimError)) throw error;

    const params = new URLSearchParams({ name, email, problem: error.message });
    if (next) params.set('next', next);
    redirect(`/signup/customer?${params.toString()}`);
  }

  // Outside the try. redirect() works by throwing, and catching it here would
  // turn a successful sign-up into a reported failure.
  // Straight back to whatever sent them here — a vehicle waiting to be
  // accepted, most often — rather than to a general "claim a car" page that
  // makes them find it again.
  redirect(next ?? '/portal/claim?welcome=1');
}

export default async function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await tFor();
  const params = await searchParams;
  const onwards = safeNext(params.next);

  const user = await currentUser();
  if (user) redirect(onwards ?? '/portal');

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(27rem,34rem)]">
      {/* Why a driver would want this. Somebody filling in a form deserves to
          be reminded what they are joining. */}
      <section className="hidden flex-col justify-between bg-(--color-petrol-900) p-10 text-(--color-petrol-50) lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-(--color-brass-300)">
            <Mark size={26} />
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-[32px] leading-[1.1] font-bold tracking-tight">
            {t('The history belongs to the car, not to the garage.')}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-(--color-petrol-100)">
            {t(
              'Change garages and the paperwork usually stays behind. Here it does not. Everything done to your car is written to a record that follows it, and follows you.',
            )}
          </p>

          <ul className="mt-7 grid gap-3">
            {[
              t('Every service, repair and part, with dates and mileages'),
              t('What was recommended and declined, so nothing is a surprise later'),
              t('A buyer report you can hand over when you sell'),
              t('Free, and it stays free'),
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[14px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-brass-300)" />
                <span className="text-(--color-petrol-100)">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-(--color-petrol-200)">
          {t('Run a workshop instead?')}{' '}
          <Link href="/signup" className="underline underline-offset-2">
            {t('Open a workshop account')}
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

          <p className="eyebrow mb-2">{t('For drivers')}</p>
          <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight">
            {t('Keep your car’s history')}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
            {t(
              'Free, and it takes a minute. Your car is added once the garage that services it confirms it is yours.',
            )}
          </p>

          {params.problem ? (
            <Alert tone="danger" className="mt-5">
              {t(params.problem)}
            </Alert>
          ) : null}

          <form action={submit} className="mt-6 grid gap-4">
            {onwards ? <input type="hidden" name="next" value={onwards} /> : null}
            <Field label={t('Your name')}>
              <Input
                name="name"
                defaultValue={params.name ?? ''}
                autoComplete="name"
                required
                // i18n-ignore
                placeholder="Maria Okafor"
              />
            </Field>

            <Field label={t('Email address')} hint={t('Where we send the confirmation link')}>
              <Input
                name="email"
                type="email"
                inputMode="email"
                defaultValue={params.email ?? ''}
                autoComplete="email"
                required
                // i18n-ignore
                placeholder="you@example.com"
              />
            </Field>

            <Field
              label={t('Password')}
              hint={t('At least {count} characters', { count: RESET_MIN_PASSWORD_LENGTH })}
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={RESET_MIN_PASSWORD_LENGTH}
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block className="mt-1">
              {t('Create my account')}
            </Button>
          </form>

          {/* Said before they sign up rather than after. Somebody who joins
              expecting to find their car waiting and finds an empty account
              has been misled, even if every individual sentence was true. */}
          <Card className="mt-6">
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">{t('Your account starts empty.')}</p>
              <p>
                {t(
                  'Anyone can read a number plate through a windscreen, so typing one in is not proof of anything and never opens a history on its own.',
                )}
              </p>
              <p>
                {t(
                  'Once you are in, you enter your registration and the garage that last worked on the car confirms it is yours. Usually a day or two. They may ring you first.',
                )}
              </p>
            </CardBody>
          </Card>

          <p className="mt-6 text-center text-[13px] text-(--text-soft)">
            {t('Already have an account?')}{' '}
            <Link href="/login" className="text-(--brand-text) underline underline-offset-2">
              {t('Sign in')}
            </Link>
          </p>

          <p className="mt-2 text-center text-[13px] text-(--text-faint) lg:hidden">
            {t('Run a workshop instead?')}{' '}
            <Link href="/signup" className="underline underline-offset-2">
              {t('Open a workshop account')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
