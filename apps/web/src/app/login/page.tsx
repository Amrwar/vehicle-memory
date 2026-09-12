import { landingPathFor } from '@carnet/core';
import { Alert, Button, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentUser, signIn } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

async function attemptSignIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/login?error=Enter+your+email+and+password');
  }

  const result = await signIn(email, password);

  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.error)}`);
  }

  redirect(landingPathFor(result.role));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect(landingPathFor(user.role));

  const { error } = await searchParams;

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(26rem,32rem)]">
      {/* The pitch, shown on wide screens. Not decoration: a service advisor
          signing in on a shared machine should know which system this is. */}
      <section className="hidden flex-col justify-between bg-(--color-petrol-900) p-10 text-(--color-petrol-50) lg:flex">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 4.6v5.4l3.4 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-[38px] font-bold leading-[1.05] tracking-tight">
            The history should belong to the car.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-(--color-petrol-200)">
            Every job you complete writes a verified, tamper-evident entry to the vehicle&rsquo;s
            permanent record. When the car is sold, the history goes with it.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-(--color-petrol-700) pt-6">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-(--color-petrol-400)">
              Append only
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">Nothing is rewritten</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-(--color-petrol-400)">
              Owner consent
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">Scoped and revocable</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-(--color-petrol-400)">
              Portable
            </dt>
            <dd className="mt-1 text-[13px] text-(--color-petrol-100)">Follows the vehicle</dd>
          </div>
        </dl>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 4.6v5.4l3.4 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-[17px] font-semibold">Carnet</span>
          </div>

          <h2 className="font-display text-[24px] font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-[13px] text-(--text-faint)">
            Use the account your workshop set up for you.
          </p>

          {error ? (
            <Alert tone="danger" className="mt-5">
              {error}
            </Alert>
          ) : null}

          <form action={attemptSignIn} className="mt-6 grid gap-4">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                placeholder="you@workshop.co.uk"
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block className="mt-1">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px]">
            <Link href="/forgot" className="font-medium text-(--brand-text) hover:underline">
              Forgotten your password?
            </Link>
          </p>

          {/* Both doors, named for who walks through them. A driver told only
              to "sign up" lands on a form asking for their workshop's VAT
              arrangements and concludes the product is not for them. */}
          <p className="mt-5 text-center text-[13px] leading-relaxed text-(--text-faint)">
            No account yet?{' '}
            <Link href="/signup/customer" className="text-(--brand-text) hover:underline">
              Keep your car&rsquo;s history
            </Link>{' '}
            as a driver, or{' '}
            <Link href="/signup" className="text-(--brand-text) hover:underline">
              open a workshop
            </Link>
            .
          </p>

          <div className="mt-8 rounded-(--radius-md) border border-(--border) bg-(--surface-sunk) p-3.5">
            <p className="eyebrow mb-2">Demo accounts</p>
            <ul className="grid gap-1.5 text-[12px] text-(--text-soft)">
              <li>
                <span className="datum">ahmed@hillsidemotors.test</span> — owner
              </li>
              <li>
                <span className="datum">sara@hillsidemotors.test</span> — service advisor
              </li>
              <li>
                <span className="datum">john@hillsidemotors.test</span> — technician
              </li>
              <li>
                <span className="datum">maria@example.test</span> — customer portal
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-(--text-faint)">
              Password for all: <span className="datum">carnet-demo-2026</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
