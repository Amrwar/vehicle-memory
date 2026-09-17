import { landingPathFor } from '@carnet/core';
import { Alert, Button, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentUser, signIn } from '@/lib/auth';
import { Mark } from '@/components/marketing';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Sign in') };
}

/**
 * Where to go after signing in, when the link that sent somebody here said so.
 *
 * A path on this site and nothing else: a full address, or one beginning with
 * two slashes, is another site, and "sign in and we will send you on" is how
 * an open redirect is built. Phase 44, for a buyer arriving on a handover.
 */
function safeNext(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

async function attemptSignIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? '') || undefined);
  const back = (query: string) =>
    redirect(`/login?${query}${next ? `&next=${encodeURIComponent(next)}` : ''}`);

  if (!email || !password) {
    back('error=Enter+your+email+and+password');
  }

  const result = await signIn(email, password);

  if (!result.ok) {
    back(`error=${encodeURIComponent(result.error)}`);
    return;
  }

  redirect(next ?? landingPathFor(result.role));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; reset?: string }>;
}) {
  const t = await tFor();
  const { error, next, reset } = await searchParams;
  const onwards = safeNext(next);

  const user = await currentUser();
  if (user) redirect(onwards ?? landingPathFor(user.role));

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(26rem,32rem)]">
      {/* The pitch, shown on wide screens. Not decoration: a service advisor
          signing in on a shared machine should know which system this is. */}
      <section className="hidden flex-col justify-between bg-(--color-petrol-900) p-10 text-(--color-petrol-50) lg:flex">
        <div className="flex items-center gap-2.5">
          <Mark size={26} className="text-current" />
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-[38px] font-bold leading-[1.05] tracking-tight">
            {t('The history should belong to the car.')}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-(--color-petrol-200)">
            {t(
              'Every job you complete writes a verified, tamper-evident entry to the vehicle’s permanent record. When the car is sold, the history goes with it.',
            )}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-(--color-petrol-700) pt-6">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-(--color-petrol-400)">
              {t('Append only')}
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">
              {t('Nothing is rewritten')}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-(--color-petrol-400)">
              {t('Owner consent')}
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">
              {t('Scoped and revocable')}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-(--color-petrol-400)">
              {t('Portable')}
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">
              {t('Follows the vehicle')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Mark size={24} className="text-current" />
            <span className="font-display text-[17px] font-semibold">Carnet</span>
          </div>

          <h2 className="font-display text-[24px] font-semibold tracking-tight">{t('Sign in')}</h2>
          <p className="mt-1 text-[13px] text-(--text-faint)">
            {t('Use the account your workshop set up for you.')}
          </p>

          {reset ? (
            <Alert tone="success" className="mt-5">
              {t('Your password is set. Sign in with the new one.')}
            </Alert>
          ) : null}

          {error ? (
            <Alert tone="danger" className="mt-5">
              {t(error)}
            </Alert>
          ) : null}

          <form action={attemptSignIn} className="mt-6 grid gap-4">
            {onwards ? <input type="hidden" name="next" value={onwards} /> : null}
            <Field label={t('Email')} htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                // i18n-ignore
                placeholder="you@workshop.co.uk"
              />
            </Field>

            <Field label={t('Password')} htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block className="mt-1">
              {t('Sign in')}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px]">
            <Link href="/forgot" className="font-medium text-(--brand-text) hover:underline">
              {t('Forgotten your password?')}
            </Link>
          </p>

          {/* Both doors, named for who walks through them. A driver told only
              to "sign up" lands on a form asking for their workshop's VAT
              arrangements and concludes the product is not for them. */}
          <p className="mt-5 text-center text-[13px] leading-relaxed text-(--text-faint)">
            {t('No account yet? {driver} as a driver, or {workshop}.')
              .split(/(\{\w+\})/)
              .map((part, index) =>
                part === '{driver}' ? (
                  <Link
                    key={index}
                    href="/signup/customer"
                    className="text-(--brand-text) hover:underline"
                  >
                    {t('Keep your car’s history')}
                  </Link>
                ) : part === '{workshop}' ? (
                  <Link key={index} href="/signup" className="text-(--brand-text) hover:underline">
                    {t('open a workshop')}
                  </Link>
                ) : (
                  part
                ),
              )}
          </p>

          <div className="mt-8 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-3.5">
            <p className="eyebrow mb-2">{t('Demo accounts')}</p>
            <ul className="grid gap-1.5 text-[12px] text-(--text-soft)">
              <li>
                {/* i18n-ignore */}
                <span className="datum">ahmed@hillsidemotors.test</span>
                {t('— owner')}
              </li>
              <li>
                {/* i18n-ignore */}
                <span className="datum">sara@hillsidemotors.test</span>
                {t('— service advisor')}
              </li>
              <li>
                {/* i18n-ignore */}
                <span className="datum">john@hillsidemotors.test</span>
                {t('— technician')}
              </li>
              <li>
                {/* i18n-ignore */}
                <span className="datum">maria@example.test</span>
                {t('— customer portal')}
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-(--text-faint)">
              {t('Password for all:')}
              {/* i18n-ignore */}
              <span className="datum">carnet-demo-2026</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
