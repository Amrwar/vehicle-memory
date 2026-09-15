import { CHASE_AFTER_DAYS, MAX_OPEN_CLAIMS } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Registration,
  Textarea,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { ClaimError, claimVehicle, myClaims, withdrawClaim } from '@/lib/claims';
import { requireUser } from '@/lib/guard';
import { ThemeToggle } from '@/components/theme-toggle';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Add your car'),
    robots: { index: false, follow: false },
  };
}
export const dynamic = 'force-dynamic';

/**
 * A customer asking for their own car.
 *
 * Everything about this page is shaped by one fact: the box on it takes a
 * number anybody can read off a parked car. So the box grants nothing. It
 * starts a conversation with the garage that last worked on the vehicle, and a
 * person there decides.
 *
 * The page says that plainly rather than presenting a lookup that appears to
 * work and then silently does nothing, which is how somebody ends up refreshing
 * for a week.
 */

async function ask(formData: FormData) {
  'use server';

  const user = await requireUser();
  const identifier = String(formData.get('identifier') ?? '');

  try {
    await claimVehicle({
      userId: user.userId,
      identifier,
      note: String(formData.get('note') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof ClaimError)) throw error;

    redirect(
      `/portal/claim?${new URLSearchParams({ problem: error.message, identifier }).toString()}`,
    );
  }

  revalidatePath('/portal/claim');
  redirect('/portal/claim?asked=1');
}

async function withdraw(formData: FormData) {
  'use server';

  const user = await requireUser();
  await withdrawClaim(user.userId, String(formData.get('claimId') ?? ''));

  revalidatePath('/portal/claim');
  redirect('/portal/claim');
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await tFor();
  const user = await requireUser();
  const params = await searchParams;

  const [claims, verified, vehicleCount] = await Promise.all([
    myClaims(user.userId),
    prisma.user
      .findUnique({ where: { id: user.userId }, select: { emailVerifiedAt: true } })
      .then((row) => row?.emailVerifiedAt !== null && row?.emailVerifiedAt !== undefined),
    prisma.vehicleOwnership.count({ where: { ownerUserId: user.userId, endedAt: null } }),
  ]);

  const open = claims.filter((claim) => claim.status === 'PENDING');
  const atLimit = open.length >= MAX_OPEN_CLAIMS;

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
          <Link href="/portal" className="text-[13px] text-(--text-faint) hover:underline">
            {t('← My vehicles')}
          </Link>
          <ThemeToggle className="w-[6.5rem]" />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        {params.welcome ? (
          <Alert tone="success" className="mb-5">
            {t(
              'Your account is ready. Check your email for the confirmation link, then add your car below.',
            )}
          </Alert>
        ) : null}

        <h1 className="font-display text-[24px] leading-tight font-semibold">
          {t('Add your car')}
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-(--text-soft)">
          {t(
            'Enter the registration. We pass the request to the garage that last worked on it, and somebody there confirms the car is yours.',
          )}
        </p>

        {!verified ? (
          // Checked here as well as in the service layer, so the person is
          // told before they fill the form in rather than after.
          <Alert tone="warning" className="mt-5">
            {t(
              'Confirm your email address first. A garage is being asked to hand over a vehicle history, and they should at least know the address is real. The link is in your inbox.',
            )}
          </Alert>
        ) : null}

        {params.problem ? (
          <Alert tone="danger" className="mt-5">
            {t(params.problem)}
          </Alert>
        ) : null}

        {params.asked ? (
          <Alert tone="success" className="mt-5">
            {t(
              'Sent. The garage will see it on their next visit to Carnet, and you will get an email either way.',
            )}
          </Alert>
        ) : null}

        {atLimit ? (
          <Alert tone="warning" className="mt-5">
            {t(
              'You have {count} requests waiting. Wait for one to be answered before asking about another.',
              { count: open.length },
            )}
          </Alert>
        ) : (
          <Card className="mt-5">
            <form action={ask}>
              <CardBody className="grid gap-4">
                <Field
                  label={t('Registration')}
                  hint={t('Or the 17-character VIN, if you have a private plate')}
                >
                  <Input
                    name="identifier"
                    defaultValue={params.identifier ?? ''}
                    required
                    autoFocus
                    autoCapitalize="characters"
                    spellCheck={false}
                    // i18n-ignore
                    placeholder="AB12 CDE"
                    className="font-mono tracking-[0.08em] uppercase"
                  />
                </Field>

                <Field
                  label={t('Anything that helps them recognise you')}
                  hint={t('Optional. A phone number or the date of your last visit saves a call.')}
                >
                  <Textarea
                    name="note"
                    rows={2}
                    placeholder={t('Serviced with you in March, under the name Maria Okafor.')}
                  />
                </Field>

                <Button type="submit" variant="primary" size="lg" disabled={!verified}>
                  {t('Ask the workshop that last worked on it')}
                </Button>
              </CardBody>
            </form>
          </Card>
        )}

        <section className="mt-8">
          <h2 className="font-display text-[17px] font-semibold">{t('Your requests')}</h2>

          {claims.length === 0 ? (
            <EmptyState
              className="mt-3 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
              title={t('Nothing asked for yet')}
              description={t('Requests you make appear here, with whatever the garage said.')}
            />
          ) : (
            <ul className="mt-3 grid gap-3">
              {claims.map((claim) => {
                const waited = Math.floor((Date.now() - claim.askedAt.getTime()) / 86_400_000);

                return (
                  <li key={claim.id}>
                    <Card>
                      <CardBody className="grid gap-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {claim.vehicle.registration ? (
                              <Registration value={claim.vehicle.registration} />
                            ) : null}
                            <span className="text-[14px] text-(--text-soft)">
                              {[claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(' ')}
                            </span>
                          </div>

                          <Badge
                            tone={
                              claim.status === 'APPROVED'
                                ? 'success'
                                : claim.status === 'REJECTED'
                                  ? 'danger'
                                  : claim.status === 'WITHDRAWN'
                                    ? 'neutral'
                                    : waited >= CHASE_AFTER_DAYS
                                      ? 'warning'
                                      : 'info'
                            }
                            dot
                          >
                            {claim.status === 'PENDING'
                              ? t('Waiting')
                              : t(claim.status.toLowerCase())}
                          </Badge>
                        </div>

                        <p className="text-[14px] leading-relaxed text-(--text-soft)">
                          {t(claim.summary)}
                        </p>

                        {claim.status === 'PENDING' ? (
                          <form action={withdraw}>
                            <input type="hidden" name="claimId" value={claim.id} />
                            <button
                              type="submit"
                              className="text-left text-[13px] text-(--text-faint) underline underline-offset-2"
                            >
                              {t('Withdraw this request')}
                            </button>
                          </form>
                        ) : null}
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {vehicleCount > 0 ? (
          <p className="mt-6 text-[13px] text-(--text-faint)">
            <Link href="/portal" className="underline underline-offset-2">
              {vehicleCount === 1
                ? t('One vehicle is already on your account.')
                : t('{count} vehicles are already on your account.', { count: vehicleCount })}
            </Link>
          </p>
        ) : null}

        {/* The honest version of what this page can and cannot do. */}
        <Card className="mt-8">
          <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
            <p className="font-medium text-(--text)">{t('Why a person has to approve this')}</p>
            <p>
              {t(
                'A registration is painted on the outside of the car and a VIN is visible through the windscreen. If either opened a service history, anybody walking through a car park could read a stranger’s.',
              )}
            </p>
            <p>
              {t(
                'So the garage decides. They know you, and they are the only ones who can say the car is yours. If nothing has happened after {days} days, ringing them is usually quicker than waiting.',
                { days: CHASE_AFTER_DAYS },
              )}
            </p>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
