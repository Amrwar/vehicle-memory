import { unverifiedWarning } from '@carnet/core';
import { prisma } from '@carnet/db';
import { Button, Card, CardBody } from '@carnet/ui';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import * as React from 'react';

import { requestVerification } from '@/lib/credentials';
import { requireUser } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

/**
 * The strip that appears until an address is proven. FR-3904.
 *
 * It says what is actually lost rather than threatening anybody. Locking a
 * workshop out of the product they signed up for because a message is sitting
 * in a spam folder loses the customer; telling them they cannot hear about
 * bounces is true, specific, and enough reason to press the button.
 *
 * Nothing at all on the first day. Somebody who signed up an hour ago has not
 * ignored anything yet.
 */
async function resend() {
  'use server';

  const user = await requireUser();

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  await requestVerification(user.userId, ip);

  redirect('/dashboard?verification=sent');
}

export async function VerifyBanner({ sent }: { sent?: boolean }) {
  const user = await requireUser();
  const t = await tFor();

  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { emailVerifiedAt: true, createdAt: true, email: true },
  });

  if (!row || row.emailVerifiedAt) return null;

  const days = Math.floor((Date.now() - row.createdAt.getTime()) / 86_400_000);
  const warning = unverifiedWarning(days);

  if (!warning && !sent) return null;

  if (sent) {
    return (
      <Card className="mb-5 border-(--success)">
        <CardBody className="text-[13px] leading-relaxed text-(--success)">
          {t('A confirmation link is on its way to {email}. It lasts three days.')
            .split('{email}')
            .map((part, index) =>
              index === 0 ? (
                part
              ) : (
                <React.Fragment key={index}>
                  <span className="datum">{row.email}</span>
                  {part}
                </React.Fragment>
              ),
            )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mb-5 border-(--warning)">
      <CardBody className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-(--warning)">
          {warning ? t(warning) : null}
        </p>

        <form action={resend}>
          <Button type="submit" size="sm" variant="secondary">
            {t('Send the link')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
