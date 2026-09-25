import { Alert, Button, Card, CardBody, CardHeader, KeyValue, Registration } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LoadingCar } from '@/components/loading-car';
import { currentUser } from '@/lib/auth';
import { acceptHandover, declineHandover, handoverByToken, OwnershipError } from '@/lib/handover';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('A vehicle is being handed to you'), robots: { index: false, follow: false } };
}

/**
 * The buyer's side of a sale. FR-7501.
 *
 * Somebody has bought a car and the seller has offered them its history. This
 * page shows what they are being given — the car, how many hands it has been
 * through, how much history it carries — and asks them to accept it. Not one
 * word about the seller, because the person selling is not part of what is
 * being handed over.
 *
 * Accepting needs a login, and that is the only place this page insists on
 * anything: a vehicle handed to nobody in particular is a vehicle nobody can
 * be shown to own.
 */
async function accept(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const user = await currentUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/handover/${token}`)}`);

  try {
    await acceptHandover({ token, userId: user.userId });
  } catch (error) {
    if (error instanceof OwnershipError) {
      redirect(`/handover/${token}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect('/portal?handover=accepted');
}

async function decline(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const user = await currentUser();

  try {
    await declineHandover({ token, userId: user?.userId ?? null });
  } catch (error) {
    if (error instanceof OwnershipError) {
      redirect(`/handover/${token}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/handover/${token}?done=declined`);
}

/**
 * The status comes first, and so does the question of whether this link is
 * real. Phase 73.
 *
 * `loading.tsx` in this segment wrapped the page in a Suspense boundary, so
 * the 200 had gone out before the token was looked up. A handover link that
 * had been used, withdrawn or never existed answered 200 all the same. The
 * gate is a single indexed read on a hash, and the page waits for it; the
 * rest streams behind this page's own fallback.
 */
export default async function HandoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const t = await tFor();
  const { token } = await params;

  const handover = await handoverByToken(token);
  if (!handover) notFound();

  return (
    <Suspense fallback={<LoadingCar label={t('Opening this vehicle’s history')} />}>
      <Handover token={token} searchParams={searchParams} />
    </Suspense>
  );
}

async function Handover({
  token,
  searchParams,
}: {
  token: string;
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const t = await tFor();
  const { problem, done } = await searchParams;

  const handover = await handoverByToken(token);
  if (!handover) notFound();

  const user = await currentUser();
  const closed = handover.state !== 'PENDING';

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">
        {t('A vehicle is being handed to you')}
      </p>

      <h1 className="font-display text-[24px] leading-tight font-semibold text-balance">
        <bdi>{handover.preview.vehicle}</bdi>
      </h1>

      {handover.preview.registration ? (
        <Registration value={handover.preview.registration} />
      ) : null}

      {problem ? <Alert tone="danger">{t(problem)}</Alert> : null}

      {done === 'declined' ? (
        <Alert tone="info">
          {t('Turned down. The seller keeps the vehicle and nothing has changed.')}
        </Alert>
      ) : null}

      {handover.state === 'ACCEPTED' ? (
        <Alert tone="success">
          {t('This has been accepted already. The vehicle is on the buyer’s account.')}
        </Alert>
      ) : null}

      {handover.state === 'EXPIRED' ? (
        <Alert tone="warning">
          {t('This handover has run out. Ask the seller to start it again.')}
        </Alert>
      ) : null}

      {handover.state === 'CANCELLED' || handover.state === 'DECLINED' ? (
        <Alert tone="info">{t('This handover is closed.')}</Alert>
      ) : null}

      <Card>
        <CardHeader
          title={t('What comes with it')}
          description={t('The history belongs to the car, not to whoever owned it.')}
        />
        <CardBody className="grid gap-3">
          <p className="text-[15px] leading-relaxed">{t(handover.summary)}</p>
          <KeyValue
            t={t}
            columns={2}
            items={[
              {
                label: t('Entries in its history'),
                value: String(handover.preview.entries),
              },
              { label: t('Owners on record'), value: String(handover.preview.owners) },
              {
                label: t('Changed hands'),
                value: handover.preview.on.toLocaleDateString('en-GB'),
              },
              ...(handover.preview.odometerKm
                ? [
                    {
                      label: t('Reading at the sale'),
                      value: `${handover.preview.odometerKm.toLocaleString('en-GB')} km`,
                    },
                  ]
                : []),
            ]}
          />
          <p className="text-[12px] leading-relaxed text-(--text-faint)">
            {t(
              'You are not shown who owned it before you, and they will not be shown anything about you. What you get is the car’s record: its services, parts, inspections and mileage.',
            )}
          </p>
        </CardBody>
      </Card>

      {!closed ? (
        <Card>
          <CardBody className="grid gap-3">
            {user ? (
              <>
                <p className="text-[13px] text-(--text-soft)">
                  {t('Accepting puts the vehicle on your account, signed in as {email}.', {
                    email: user.email,
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={accept}>
                    <input type="hidden" name="token" value={token} />
                    <Button type="submit" variant="primary">
                      {t('Accept the vehicle')}
                    </Button>
                  </form>
                  <form action={decline}>
                    <input type="hidden" name="token" value={token} />
                    <Button type="submit" variant="ghost">
                      {t('It is not mine')}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-(--text-soft)">
                  {t(
                    'Sign in, or make an account, and the vehicle lands on it. The history is kept for the car; the account is how you read it.',
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/login?next=${encodeURIComponent(`/handover/${token}`)}`}>
                    <Button variant="primary">{t('Sign in to accept')}</Button>
                  </Link>
                  {/* A person being handed a car is a customer, not a
                      garage. This pointed at the workshop sign-up, which would
                      have asked a private buyer to open a business and put a
                      card down before they could accept their own vehicle. */}
                  <Link href={`/signup/customer?next=${encodeURIComponent(`/handover/${token}`)}`}>
                    <Button variant="secondary">{t('Make an account')}</Button>
                  </Link>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      ) : null}

      <p className="text-[12px] leading-relaxed text-(--text-faint)">
        {handover.workshop
          ? t('{workshop} started this handover on the seller’s behalf.', {
              workshop: handover.workshop,
            })
          : t('The seller started this handover themselves.')}
      </p>
    </main>
  );
}
