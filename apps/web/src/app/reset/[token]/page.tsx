import { RESET_MIN_PASSWORD_LENGTH } from '@carnet/core';
import { Button, Card, CardBody, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { redeemReset, TokenError } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

/**
 * Setting the new password. FR-3902.
 *
 * The token is not checked when the page loads, only when the form is sent.
 * Checking on load would mark a link as visited by anything that follows it,
 * and mail scanners follow every link in every message before a person sees
 * it. Somebody would arrive to find their own link already spent.
 */
async function set(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const again = String(formData.get('again') ?? '');

  const back = (message: string) =>
    redirect(`/reset/${token}?error=${encodeURIComponent(message)}`);

  if (password !== again) back('Those two do not match.');

  try {
    await redeemReset({ token, password });
  } catch (error) {
    if (error instanceof TokenError) back(error.message);
    throw error;
  }

  redirect('/login?reset=1');
}

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>

      <h1 className="font-display text-[24px] leading-tight font-semibold">
        Choose a new password
      </h1>

      {error ? (
        <Card className="border-(--danger)">
          <CardBody className="text-[14px] leading-relaxed text-(--danger)">{error}</CardBody>
        </Card>
      ) : null}

      <Card>
        <form action={set}>
          <input type="hidden" name="token" value={token} />

          <CardBody className="grid gap-4">
            <Field
              label="New password"
              hint={`At least ${RESET_MIN_PASSWORD_LENGTH} characters. A short phrase you will remember beats a short word with a number after it.`}
            >
              <Input
                type="password"
                name="password"
                required
                autoFocus
                minLength={RESET_MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </Field>

            <Field label="And again">
              <Input
                type="password"
                name="again"
                required
                minLength={RESET_MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </Field>

            <Button type="submit" variant="primary">
              Set it and sign in
            </Button>
          </CardBody>
        </form>
      </Card>

      <p className="text-[13px] leading-relaxed text-(--text-faint)">
        Setting a new password signs you out everywhere else. If you are doing this because you
        think somebody else has your password, that is the part that matters.
      </p>

      <Link href="/forgot" className="text-[14px] font-medium text-(--brand-text) hover:underline">
        Ask for a new link
      </Link>
    </main>
  );
}
