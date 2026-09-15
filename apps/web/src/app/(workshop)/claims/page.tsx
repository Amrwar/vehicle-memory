import { CHASE_AFTER_DAYS } from '@carnet/core';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ClaimError, claimsFor, decideClaim } from '@/lib/claims';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Vehicle requests') };
}
export const dynamic = 'force-dynamic';

/**
 * Customers asking for their own cars.
 *
 * This is the only screen in the product where a member of staff is the
 * security control. A registration is readable from across a car park, so
 * nothing about the request itself is evidence. What decides it is the name in
 * the right-hand column: the customer this workshop already holds against that
 * vehicle. If it matches, approve. If it does not, ring the number on record
 * before doing anything.
 *
 * So the screen shows them side by side and refuses to make the comparison
 * itself. Approving is one button; refusing requires a sentence, because the
 * customer is told the outcome either way and "no" on its own generates the
 * telephone call this feature exists to save.
 */

async function decide(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const approve = formData.get('approve') === '1';

  try {
    await decideClaim({
      orgId,
      userId: user.userId,
      claimId: String(formData.get('claimId') ?? ''),
      approve,
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof ClaimError)) throw error;
    redirect(`/claims?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/claims?done=${approve ? 'approved' : 'refused'}`);
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { orgId } = await requireSession('customer:read');
  const t = await tFor();
  const params = await searchParams;

  const claims = await claimsFor(orgId);

  const pending = claims.filter((claim) => claim.status === 'PENDING');
  const waiting = pending.filter(
    (claim) => Date.now() - claim.askedAt.getTime() >= CHASE_AFTER_DAYS * 86_400_000,
  );

  return (
    <>
      <PageHeader
        eyebrow={t('Customers')}
        title={t('Vehicle requests')}
        description={t('Drivers asking to have their own car put on their account')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Waiting on you')}
          value={pending.length}
          tone={pending.length > 0 ? 'warning' : 'neutral'}
          note={t('Nobody else can answer these')}
        />
        <StatTile
          label={t('Waiting a while')}
          value={waiting.length}
          tone={waiting.length > 0 ? 'danger' : 'neutral'}
          note={t('Asked more than {days} days ago', { days: CHASE_AFTER_DAYS })}
        />
        <StatTile
          label={t('Answered')}
          value={claims.length - pending.length}
          note={t('Approved, refused or withdrawn')}
        />
      </StatRow>

      {params.problem ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[14px] text-(--danger)">{t(params.problem)}</CardBody>
        </Card>
      ) : null}

      {params.done ? (
        <Card className="mb-5 border-(--success)">
          <CardBody className="text-[14px] text-(--success)">
            {params.done === 'approved'
              ? t('Approved. The vehicle is on their account and they have been emailed.')
              : t('Refused, and they have been told what you wrote.')}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          {t(
            'Nothing here is decided automatically, and nothing can be. A number plate is visible from the pavement, so the only thing that makes a request genuine is you recognising the person. Compare the name they signed up with against the customer you hold for that vehicle, and ring them if it does not match.',
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Requests')}
          description={t('Unanswered first, oldest first within them.')}
        />

        {claims.length === 0 ? (
          <EmptyState
            title={t('Nobody has asked')}
            description={t(
              'A driver who signs up and enters one of your customers’ registrations appears here for you to confirm.',
            )}
          />
        ) : (
          <ul className="divide-y divide-(--border)">
            {claims.map((claim) => {
              const days = Math.floor((Date.now() - claim.askedAt.getTime()) / 86_400_000);
              const matches =
                claim.onRecord?.displayName.trim().toLowerCase() ===
                claim.user.name.trim().toLowerCase();

              return (
                <li key={claim.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {claim.vehicle.registration ? (
                        <Registration value={claim.vehicle.registration} />
                      ) : null}
                      <Link
                        href={`/vehicles/${claim.vehicle.id}`}
                        className="font-display text-[16px] font-semibold hover:underline"
                      >
                        {[claim.vehicle.year, claim.vehicle.make, claim.vehicle.model]
                          .filter(Boolean)
                          .join(' ') || t('Vehicle')}
                      </Link>
                    </div>

                    <Badge
                      tone={
                        claim.status === 'APPROVED'
                          ? 'success'
                          : claim.status === 'REJECTED'
                            ? 'danger'
                            : claim.status === 'WITHDRAWN'
                              ? 'neutral'
                              : days >= CHASE_AFTER_DAYS
                                ? 'danger'
                                : 'warning'
                      }
                      dot
                    >
                      {claim.status === 'PENDING'
                        ? days === 1
                          ? t('Waiting 1 day')
                          : t('Waiting {days} days', { days })
                        : t(claim.status.toLowerCase())}
                    </Badge>
                  </div>

                  {/* The whole decision, side by side. */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-(--radius-md) bg-(--surface-sunk) p-3">
                      <p className="eyebrow">{t('Asking')}</p>
                      <p className="mt-1 text-[14px] font-medium">{claim.user.name}</p>
                      <p className="datum text-[13px] text-(--text-soft)">{claim.user.email}</p>
                      <p className="mt-1 text-[12px] text-(--text-faint)">
                        {claim.user.emailVerifiedAt
                          ? t('Email address confirmed')
                          : t('Email address not confirmed')}
                      </p>
                    </div>

                    <div className="rounded-(--radius-md) bg-(--surface-sunk) p-3">
                      <p className="eyebrow">{t('You have on record')}</p>
                      {claim.onRecord ? (
                        <>
                          <p className="mt-1 text-[14px] font-medium">
                            {claim.onRecord.displayName}
                          </p>
                          <p className="datum text-[13px] text-(--text-soft)">
                            {claim.onRecord.email ??
                              claim.onRecord.mobile ??
                              t('No contact details')}
                          </p>
                          <p
                            className={`mt-1 text-[12px] ${matches ? 'text-(--success)' : 'text-(--warning)'}`}
                          >
                            {matches ? t('Same name') : t('Different name — worth a phone call')}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] text-(--text-soft)">
                          {t('No customer of yours has that vehicle any more.')}
                        </p>
                      )}
                    </div>
                  </div>

                  {claim.note ? (
                    <p className="mt-3 rounded-(--radius-sm) border-s-2 border-(--border-strong) bg-(--surface-sunk) px-3 py-2 text-[13px] leading-relaxed text-(--text-soft)">
                      {claim.note}
                    </p>
                  ) : null}

                  {claim.status === 'PENDING' ? (
                    // One form, two submit buttons. Approving and refusing are
                    // the same decision seen from two sides, and splitting them
                    // into two forms would put the reason box out of reach of
                    // the button that needs it.
                    <form
                      action={decide}
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                    >
                      <input type="hidden" name="claimId" value={claim.id} />

                      <label className="grid gap-1">
                        <span className="eyebrow">{t('If you are refusing, say why')}</span>
                        <Input
                          name="reason"
                          placeholder={t('Rang the owner and it is not them.')}
                          maxLength={300}
                        />
                      </label>

                      <Button type="submit" name="approve" value="0" variant="ghost">
                        {t('Refuse')}
                      </Button>
                      <Button type="submit" name="approve" value="1" variant="primary">
                        {t('Approve')}
                      </Button>
                    </form>
                  ) : claim.reason ? (
                    <p className="mt-3 text-[13px] text-(--text-faint)">
                      {claim.decidedBy?.name ? `${claim.decidedBy.name}: ` : ''}
                      {claim.reason}
                    </p>
                  ) : claim.decidedBy?.name ? (
                    <p className="mt-3 text-[13px] text-(--text-faint)">
                      {t('Answered by {name}.', { name: claim.decidedBy.name })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
