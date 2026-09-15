import { humaniseRole, msg, type Role, statusOf } from '@carnet/core';
import { Alert, Button, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Mark } from '@/components/marketing';
import { StrandedCar } from '@/components/stranded-car';
import { startSession } from '@/lib/auth';
import { tFor } from '@/lib/i18n';
import { acceptInvitation, invitationByToken } from '@/lib/team';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Join a workshop'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

/**
 * Accepting an invitation. FR-1902.
 *
 * The link is the credential, so there is nothing to look up and nothing to
 * type. What the page has to do is tell somebody which workshop they are
 * joining and in what role, before they commit, because "you have been added
 * to an organisation" with no name is how people end up in the wrong one.
 */

async function accept(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');

  const result = await acceptInvitation({
    token,
    name: String(formData.get('name') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!result.ok) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.error ?? 'That did not work.')}`);
  }

  await startSession(result.userId!);
  redirect('/dashboard');
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await tFor();
  const { token } = await params;
  const { error } = await searchParams;

  const invitation = await invitationByToken(token);

  if (!invitation || statusOf(invitation) !== 'PENDING') {
    return (
      <main id="main" className="grid min-h-dvh place-items-center bg-(--ground) px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto max-w-xs">
            <StrandedCar />
          </div>

          <h1 className="mt-6 font-display text-[22px] font-semibold tracking-tight">
            {t(reasonTitle(invitation ? statusOf(invitation) : 'MISSING'))}
          </h1>
          <p className="mx-auto mt-2.5 max-w-sm text-[14px] leading-relaxed text-(--text-soft)">
            {t(reasonBody(invitation ? statusOf(invitation) : 'MISSING'))}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button variant="primary">{t('Sign in')}</Button>
            </Link>
            <Link href="/">
              <Button>{t('About Carnet')}</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const role = t(humaniseRole(invitation.role as Role).toLowerCase());

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_minmax(26rem,32rem)]">
      <section className="hidden flex-col justify-between bg-(--color-petrol-900) p-10 text-(--color-petrol-50) lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-(--color-brass-300)">
            <Mark size={26} />
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </Link>

        <div className="max-w-md">
          <p className="eyebrow mb-3 text-(--color-brass-300)">{t('You have been invited')}</p>
          <h2 className="font-display text-[32px] font-bold leading-[1.1] tracking-tight">
            {invitation.org.name}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-(--color-petrol-100)">
            {invitation.invitedBy?.name
              ? t('{name} has invited you to join as {role}.', {
                  name: invitation.invitedBy.name,
                  role,
                })
              : t('You have been invited to join as {role}.', { role })}
          </p>

          {invitation.message ? (
            <p className="mt-5 border-s-2 border-(--color-brass-400) ps-4 text-[14px] italic leading-relaxed text-(--color-petrol-100)">
              {invitation.message}
            </p>
          ) : null}
        </div>

        <p className="text-[12px] text-(--color-petrol-200)">
          {t(
            'Your account belongs to you. The workshop decides what you can see, not who you are.',
          )}
        </p>
      </section>

      <section className="flex flex-col justify-center bg-(--surface) px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-7 flex items-center gap-2.5 lg:hidden">
            <Mark size={22} />
            <span className="font-display text-[16px] font-semibold">Carnet</span>
          </Link>

          <p className="eyebrow mb-2">{t('Join {workshop}', { workshop: invitation.org.name })}</p>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">
            {t('Set up your account')}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
            {t('You are joining as {role}, using {email}.', { role, email: invitation.email })}
          </p>

          {error ? (
            <Alert tone="danger" className="mt-5">
              {t(error)}
            </Alert>
          ) : null}

          <form action={accept} className="mt-6 grid gap-4">
            <input type="hidden" name="token" value={token} />

            <Field label={t('Your name')}>
              <Input
                name="name"
                autoComplete="name"
                required
                // i18n-ignore
                placeholder="Priya Raman"
              />
            </Field>

            <Field label={t('Choose a password')} hint={t('At least 10 characters')}>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block className="mt-1">
              {t('Join {workshop}', { workshop: invitation.org.name })}
            </Button>

            <p className="text-center text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Already have a Carnet account on this address? Use the same password and this invitation attaches the workshop to it.',
              )}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function reasonTitle(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return msg('This invitation has been used');
    case 'REVOKED':
      return msg('This invitation was withdrawn');
    case 'EXPIRED':
      return msg('This invitation has run out');
    default:
      return msg('We did not issue this link');
  }
}

function reasonBody(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return msg('The account already exists. Sign in with the address it was sent to.');
    case 'REVOKED':
      return msg('Whoever sent it has withdrawn it. Ask them for a new one.');
    case 'EXPIRED':
      return msg('Invitations last seven days. Ask whoever sent it to send another.');
    default:
      return msg(
        'Check the link is complete. If it was copied out of an email, part of it may have been left behind.',
      );
  }
}
