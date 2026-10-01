import { howTheNightWent, type OvernightMove } from '@carnet/core';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { theNight, whatArrived, whoIsInToday } from '@/lib/start-of-day';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Opening up') };
}
export const dynamic = 'force-dynamic';

const TONE: Record<OvernightMove, 'danger' | 'warning' | 'neutral' | 'success'> = {
  NEW: 'danger',
  WORSE: 'danger',
  STILL_THERE: 'warning',
  BETTER: 'neutral',
  SETTLED: 'success',
};

const MOVE_WORD: Record<OvernightMove, string> = {
  NEW: 'New overnight',
  WORSE: 'Worse than last night',
  STILL_THERE: 'Still there',
  BETTER: 'Fewer than last night',
  SETTLED: 'Settled',
};

/**
 * What happened while we were shut.
 *
 * The plan gives this six words — "Start-of-day, the mirror of it" — and the
 * lazy reading would be ten more readings and a second record. `/morning`
 * already says what to do today and says it better.
 *
 * What only this screen can say is what arrived while nobody was here, and
 * whether what last night's close left is still true. The second half is
 * possible only because the close stored its figures rather than deriving
 * them: a close that recomputed itself could never be compared with anything.
 *
 * It records nothing. The mirror is in the ritual, not the mechanism.
 *
 * Phase 97.
 */
export default async function OpeningPage() {
  const { orgId, user, region } = await requireSession('job:read');
  const t = await tFor();

  const locationId = user.locationId;
  const now = new Date();

  const night = await theNight(orgId, locationId, region.currency, now);
  const since =
    night.since.kind === 'close' ? night.since.at : new Date(now.getTime() - 86_400_000);

  const [arrived, who] = await Promise.all([
    whatArrived(orgId, since, now),
    whoIsInToday(orgId, locationId, region.timezone, now),
  ]);

  const headline = howTheNightWent(night);
  const when = (at: Date) =>
    at.toLocaleString(region.locale, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: region.timezone,
    });

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Opening up')}
        description={t(
          'What came in while nobody was here, and whether what last night left is still true.',
        )}
      />

      <p className="mt-4 text-[13px] font-medium">{t(headline.key, headline.vars)}</p>
      {night.since.kind === 'close' ? (
        <p className="mt-1 text-[13px] text-(--text-faint)">
          {t('Measured against the close {name} took at {when}.', {
            name: night.since.by,
            when: when(night.since.at),
          })}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-(--text-faint)">
          {t('Closing the day is what gives this screen something to compare against.')}
        </p>
      )}

      {arrived.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('While nobody was here')}
            description={t('Things customers and the clock did without us.')}
          />
          <CardBody className="grid gap-1.5 p-3">
            {arrived.map((row) => (
              <Link
                key={row.kind}
                href={row.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-3 text-[13px] transition-colors hover:bg-(--surface-sunk) pointer-coarse:min-h-12"
              >
                <span className="datum tabular w-7 text-end font-semibold">{row.count}</span>
                <bdi className="min-w-0 flex-1">{t(row.what.key, row.what.vars)}</bdi>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {night.lines.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('What last night left')}
            description={t('Each one as the close recorded it, and as it stands now.')}
          />
          <CardBody className="grid gap-1.5 p-3">
            {night.lines.map((line) => (
              <Link
                key={line.kind}
                href={line.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-3 text-[13px] transition-colors hover:bg-(--surface-sunk) pointer-coarse:min-h-12"
              >
                <Badge tone={TONE[line.move]}>{t(MOVE_WORD[line.move])}</Badge>
                <bdi className="min-w-0 flex-1">{t(line.what.key, line.what.vars)}</bdi>
                {line.was !== line.is ? (
                  <span className="datum tabular text-[11px] text-(--text-faint)">
                    {t('{was} last night', { was: line.was })}
                  </span>
                ) : null}
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader
          title={t('Who is in')}
          description={t('The rota against the clock. Nobody is accused of anything.')}
        />
        <CardBody className="grid gap-3 p-4 text-[13px]">
          <p>
            {t('Clocked on: {here} of {expected} expected today.', {
              here: who.here.length,
              expected: who.expected.length,
            })}
          </p>

          {who.notYet.length > 0 ? (
            <p className="text-(--text-soft)">
              <span className="font-medium">{t('Not yet:')}</span>{' '}
              <bdi>{who.notYet.map((one) => one.name).join(', ')}</bdi>
            </p>
          ) : null}

          {who.unexpected.length > 0 ? (
            <p className="text-(--text-soft)">
              <span className="font-medium">{t('Here and not on the rota:')}</span>{' '}
              <bdi>{who.unexpected.map((one) => one.name).join(', ')}</bdi>
            </p>
          ) : null}

          {who.expected.length === 0 ? (
            <p className="text-(--text-faint)">
              {t('Nobody has a working pattern for today, so there is nothing to compare against.')}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
