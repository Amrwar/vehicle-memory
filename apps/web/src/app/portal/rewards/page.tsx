import { Card, CardBody, CardHeader, EmptyState, Money } from '@carnet/ui';
import type { Metadata } from 'next';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { pointsForPortalUser } from '@/lib/loyalty';
import { referralsForPortalUser } from '@/lib/referrals';
import { regionForUser } from '@/lib/region';
import { tFor } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Rewards' };
export const dynamic = 'force-dynamic';

/**
 * Points and referral codes, on a page of their own. Phase 32.5.
 *
 * They used to sit on the home page between the vehicles and the recent
 * work, where they read as an advertisement in the middle of somebody's
 * records. Here they are the whole subject: what each workshop's points are
 * worth, when they lapse, and the code that brings a friend.
 */
export default async function PortalRewardsPage() {
  const t = await tFor();
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const [points, referrals] = await Promise.all([
    pointsForPortalUser(user.userId),
    referralsForPortalUser(user.userId),
  ]);

  return (
    <PortalShell active="rewards">
      <h1 className="font-display text-[24px] font-semibold leading-tight">{t('Rewards')}</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {t('Points from the workshops you use, and a code that brings a friend.')}
      </p>

      {points.length === 0 && referrals.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title={t('Nothing here yet')}
          description={t(
            'When a workshop you use runs a loyalty scheme, your points and your referral code appear here.',
          )}
        />
      ) : null}

      {points.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-[17px] font-semibold">{t('Your points')}</h2>
          <ul className="mt-3 grid gap-3">
            {points.map((card) => (
              <li key={card.customerId}>
                <Card>
                  <CardHeader
                    title={card.workshop}
                    description={t(
                      'Ask at the counter to use them, or they come off your next bill there.',
                    )}
                    action={
                      <p className="font-display text-[26px] font-semibold tabular-nums leading-none">
                        {card.balance.toLocaleString(region.locale)}
                        <span className="ml-1 text-[12px] font-normal text-(--text-faint)">
                          {t('points')}
                        </span>
                      </p>
                    }
                  />
                  <CardBody className="text-[13px] text-(--text-soft)">
                    Worth{' '}
                    <span className="font-medium text-(--text)">
                      <Money
                        amount={card.valueMinor / 100}
                        currency={card.currency}
                        locale={card.locale}
                      />
                    </span>{' '}
                    off your next bill.
                    {card.expiring.points > 0 && card.expiring.on ? (
                      <span className="mt-1 block text-(--warning)">
                        {card.expiring.points.toLocaleString(region.locale)} expire on{' '}
                        {card.expiring.on.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        .
                      </span>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {referrals.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-[17px] font-semibold">{t('Bring a friend')}</h2>
          <p className="mt-1 text-[13px] text-(--text-soft)">
            {t(
              'Give the code to somebody who has not been to that workshop. It pays once they have had work done, not for signing up.',
            )}
          </p>
          <ul className="mt-3 grid gap-3">
            {referrals.map((card) => (
              <li key={card.customerId}>
                <Card>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{card.workshop}</p>
                      <p className="text-[12px] text-(--text-faint)">
                        After{' '}
                        <Money
                          amount={card.minimumMinor / 100}
                          currency={card.currency}
                          locale={card.locale}
                        />{' '}
                        of work, you both get {card.pointsEachSide} points.
                      </p>
                    </div>
                    <p className="datum rounded-(--radius-md) border border-dashed border-(--border-strong) bg-(--surface-sunk) px-3 py-1.5 text-[18px] font-semibold tracking-[0.2em]">
                      {card.code}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PortalShell>
  );
}
