import { prisma } from '@carnet/db';
import { Button, Card, CardBody } from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { canSendMail, requestVerification } from '@/lib/credentials';
import { requireUser } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Confirm your email'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

/**
 * The page a workshop sees until its address is proven.
 *
 * Everything inside the workshop sends things in the workshop's name: quotes,
 * invoices, reminders. An address nobody has proven is how a stranger opens a
 * business in somebody else's name and starts emailing their customers from
 * it. So the workshop is not entered until the link has been opened.
 *
 * The page does three things and no more: says where the link went, offers to
 * send it again, and offers a way out for somebody who typed the wrong
 * address. It does not lecture.
 */

async function resend() {
  'use server';

  const user = await requireUser();

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  await requestVerification(user.userId, ip);

  redirect('/confirm-email?sent=1');
}

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const { sent } = await searchParams;

  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true, emailVerifiedAt: true },
  });

  // Already proven, so there is nothing to wait for.
  if (row?.emailVerifiedAt) redirect('/dashboard');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>

      <h1 className="font-display text-[24px] leading-tight font-semibold">
        {t('One more step: confirm your email')}
      </h1>

      <p className="text-[15px] leading-relaxed text-(--text-soft)">
        {t(
          'We have sent a link to {email}. Open it and the workshop is yours. Until then, everything the workshop would send goes out in your name from an address nobody has checked, so we wait.',
        )
          .split('{email}')
          .flatMap((part, index) =>
            index === 0
              ? [part]
              : [
                  <span key={index} className="datum">
                    {row?.email}
                  </span>,
                  part,
                ],
          )}
      </p>

      {sent ? (
        <Card className="border-(--success)">
          <CardBody className="text-[14px] leading-relaxed text-(--success)">
            {t(
              'Sent again. The newest link is the one that works; earlier ones have been retired.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="grid gap-3">
          <p className="text-[13px] leading-relaxed text-(--text-soft)">
            {t(
              'Nothing in your inbox? Check the spam folder first. Some providers hold a first message from a new sender for a few minutes.',
            )}
          </p>
          <form action={resend}>
            <Button type="submit" variant="primary">
              {t('Send the link again')}
            </Button>
          </form>
        </CardBody>
      </Card>

      {canSendMail() ? null : (
        <p className="text-[13px] leading-relaxed text-(--warning)">
          {t(
            'This deployment has no mail transport configured, so the link is written to the server log rather than sent. Whoever runs it can read it there.',
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-relaxed text-(--text-faint)">
        {t(
          'Typed the wrong address? {signOut} and sign up again with the right one. This account will simply never be confirmed, and nothing has been sent from it.',
        )
          .split('{signOut}')
          .flatMap((part, index) => [
            index === 0 ? null : (
              <form key={`form-${index}`} action="/api/sign-out" method="post" className="inline">
                <button type="submit" className="underline underline-offset-2">
                  {t('Sign out')}
                </button>
              </form>
            ),
            part.trim() ? <span key={`text-${index}`}>{part.trim()}</span> : null,
          ])}
      </div>
    </main>
  );
}
