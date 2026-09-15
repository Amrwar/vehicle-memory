import { Button, Card, CardBody, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { canSendMail, requestReset, RESET_REQUESTED_MESSAGE } from '@/lib/credentials';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

/**
 * Asking for a way back in. FR-3901.
 *
 * The page answers the same way whether or not the address has an account, and
 * it says so on the page rather than pretending. A form that replies "no such
 * account" is how somebody enumerates a customer list, and it takes about an
 * hour; being open about the behaviour costs nothing and stops the honest
 * person wondering whether they typed it wrongly.
 */
async function ask(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Nothing thrown, nothing returned. Whatever happened inside, the person at
  // the form is told the same thing.
  await requestReset(email, ip);

  redirect('/forgot?sent=1');
}

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const t = await tFor();
  const { sent } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>

      <h1 className="font-display text-[24px] leading-tight font-semibold">
        {t('Set a new password')}
      </h1>

      {sent ? (
        <>
          <Card>
            <CardBody className="text-[15px] leading-relaxed">{RESET_REQUESTED_MESSAGE}</CardBody>
          </Card>

          <p className="text-[13px] leading-relaxed text-(--text-faint)">
            {t(
              'Nothing has changed on your account yet. Your current password still works until you open the link and set a new one.',
            )}
          </p>

          <Link
            href="/login"
            className="text-[14px] font-medium text-(--brand-text) hover:underline"
          >
            {t('Back to signing in')}
          </Link>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-(--text-soft)">
            {t(
              'Give us the address you sign in with and we will send a link. It lasts an hour, and asking again replaces whatever was sent before.',
            )}
          </p>

          <Card>
            <form action={ask}>
              <CardBody className="grid gap-4">
                <Field label={t('Email address')}>
                  <Input
                    type="email"
                    name="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@yourworkshop.com"
                  />
                </Field>

                <Button type="submit" variant="primary">
                  {t('Send the link')}
                </Button>
              </CardBody>
            </form>
          </Card>

          {canSendMail() ? null : (
            <p className="text-[13px] leading-relaxed text-(--warning)">
              {t(
                'This deployment has no mail transport configured, so the link will be written to the server log rather than sent. Whoever runs it can read it there.',
              )}
            </p>
          )}

          <p className="text-[13px] leading-relaxed text-(--text-faint)">
            {t(
              'We answer the same way whether or not that address has an account. Otherwise this form would be a way for anybody to find out who does.',
            )}
          </p>

          <Link
            href="/login"
            className="text-[14px] font-medium text-(--brand-text) hover:underline"
          >
            {t('Back to signing in')}
          </Link>
        </>
      )}
    </main>
  );
}
