import { businessDay, CloseOfDayError, howTheCloseLooks, shouldNotBeLeft } from '@carnet/core';
import { Badge, Button, Card, CardBody, CardHeader, Field, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { closeFor, closeTheDay, recentCloses, theEndOfTheDay } from '@/lib/close-of-day';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Closing the day') };
}
export const dynamic = 'force-dynamic';

/**
 * What was true when the doors shut.
 *
 * The morning list asks what to do about today. This asks, at the other end of
 * it, what is being left — and records that somebody looked.
 *
 * Three things decide what this screen is.
 *
 * **It changes nothing.** Every row links to the page where the thing is
 * actually done. Pressing the button writes one record and touches nothing
 * else, because a close that could tidy would be used to tidy, and the record
 * of what was outstanding would become a record of what somebody made
 * disappear.
 *
 * **It never refuses.** A workshop at six with three cars on the forecourt
 * locks up anyway. The close records what was left rather than arguing about
 * it; a screen that blocked would be worked around by not opening it.
 *
 * **Three of the ten are a different kind of thing** — keys nobody can place,
 * a till that disagrees, somebody still clocked on — and they are said first
 * and separately. Saying them in the same voice as "four jobs open" would
 * teach people to read the whole list in that voice.
 *
 * Phase 96.
 */
export default async function ClosePage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; closed?: string }>;
}) {
  const { orgId, user, region } = await requireSession('close:write');
  const t = await tFor();
  const params = await searchParams;

  const now = new Date();
  const on = businessDay(now, region.timezone);
  const locationId = user.locationId;

  const [close, already, history] = await Promise.all([
    theEndOfTheDay(orgId, locationId, region.currency, now),
    locationId ? closeFor(orgId, locationId, on) : Promise.resolve(null),
    recentCloses(orgId, 7),
  ]);

  const headline = howTheCloseLooks(close);

  async function close_(formData: FormData) {
    'use server';
    const session = await requireSession('close:write');
    if (!session.user.locationId) redirect('/close?problem=no-site');

    try {
      await closeTheDay({
        orgId: session.orgId,
        locationId: session.user.locationId,
        userId: session.user.userId,
        timezone: session.region.timezone,
        currency: session.region.currency,
        note: String(formData.get('note') ?? ''),
      });
    } catch (error) {
      if (error instanceof CloseOfDayError) redirect(`/close?problem=${error.code}`);
      throw error;
    }
    redirect('/close?closed=1');
  }

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Closing the day')}
        description={t(
          'What is being left overnight, and the record that somebody looked. Nothing on this screen changes anything.',
        )}
      />

      {params.problem === 'ALREADY_CLOSED' ? (
        <Card className="mt-4 border-(--warning)">
          <CardBody className="text-[13px]">
            {t('That day has already been closed. A day is closed once.')}
          </CardBody>
        </Card>
      ) : null}
      {params.problem === 'no-site' ? (
        <Card className="mt-4 border-(--warning)">
          <CardBody className="text-[13px]">
            {t('A close belongs to a site, and this account is not at one.')}
          </CardBody>
        </Card>
      ) : null}

      <p className="mt-4 text-[13px] font-medium">{t(headline.key, headline.vars)}</p>

      {close.leftOvernight.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('Not to be left overnight')}
            description={t('Keys, cash and anybody still here. The rest can wait until morning.')}
          />
          <CardBody className="grid gap-1.5 p-3">
            {close.leftOvernight.map((reading) => (
              <Link
                key={reading.kind}
                href={reading.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--danger-soft) bg-(--danger-soft)/30 p-3 text-[13px] transition-colors hover:bg-(--danger-soft)/50 pointer-coarse:min-h-12"
              >
                <Badge tone="danger">{t('Deal with it now')}</Badge>
                <bdi className="min-w-0 flex-1">{t(reading.what.key, reading.what.vars)}</bdi>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader
          title={t('Everything the close looks at')}
          description={t('All ten, whatever they say. A nought is an answer too.')}
        />
        <CardBody className="grid gap-1.5 p-3">
          {close.readings.map((reading) => (
            <Link
              key={reading.kind}
              href={reading.href}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-3 text-[13px] transition-colors hover:bg-(--surface-sunk) pointer-coarse:min-h-12"
            >
              <Badge
                tone={
                  reading.count === 0
                    ? 'success'
                    : shouldNotBeLeft(reading.kind)
                      ? 'danger'
                      : 'neutral'
                }
              >
                {reading.count === 0
                  ? t('Settled')
                  : shouldNotBeLeft(reading.kind)
                    ? t('Deal with it now')
                    : t('Outstanding')}
              </Badge>
              <bdi className="min-w-0 flex-1">{t(reading.what.key, reading.what.vars)}</bdi>
            </Link>
          ))}
        </CardBody>
      </Card>

      {already ? (
        <Card className="mt-5">
          <CardBody className="text-[13px]">
            <p className="font-medium">
              {t('Closed by {name} at {when}.', {
                name: already.closedBy.name,
                when: already.closedAt.toLocaleTimeString(region.locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
            {already.note ? (
              <p className="mt-2 text-(--text-soft)">
                <bdi>{already.note}</bdi>
              </p>
            ) : null}
            <p className="mt-2 text-(--text-faint)">
              {t('A close is a record of a moment, so it cannot be edited afterwards.')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardHeader
            title={t('Close the day')}
            description={t(
              'This records what is above, as it stands now, with your name on it. It changes nothing else.',
            )}
          />
          <CardBody>
            <form action={close_} className="grid gap-3">
              <Field
                label={t('Anything worth saying about tonight')}
                hint={t(
                  'Optional. The night the keys were with the valeter is the night to say so.',
                )}
              >
                <input
                  name="note"
                  type="text"
                  maxLength={300}
                  className="w-full rounded-(--radius-md) border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
                />
              </Field>
              <div>
                <Button type="submit">{t('Close the day')}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {history.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('Lately')}
            description={t('The last week of closes, as they were recorded.')}
          />
          <CardBody className="grid gap-1.5 p-3">
            {history.map((record) => {
              const left = record.readings.filter((one) => one.leftOvernight).length;
              return (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--border) p-3 text-[13px]"
                >
                  <span className="datum">
                    {record.on.toLocaleDateString(region.locale, { timeZone: 'UTC' })}
                  </span>
                  <bdi className="min-w-0 flex-1 text-(--text-soft)">{record.closedBy.name}</bdi>
                  <Badge tone={left === 0 ? 'success' : 'warning'}>
                    {left === 0 ? t('Nothing left') : t('{count} left overnight', { count: left })}
                  </Badge>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
