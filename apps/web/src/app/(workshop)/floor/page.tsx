import {
  Badge,
  Button,
  Card,
  CardBody,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Translator } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { floorNow } from '@/lib/diary';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('The floor') };
}
export const dynamic = 'force-dynamic';

/**
 * Where every car is, right now. FR-2905.
 *
 * A workshop's own answer to "where is that car" is to walk out and look, and
 * the screen version is only worth having if it says the same thing. So this
 * is what is in each bay at this minute, not what is booked into it today.
 * The diary already answers the second question and answers it better.
 *
 * Laid out as the bays are laid out, in a row, because that is how somebody
 * standing at the counter pictures the building.
 */
function until(end: Date, now: Date, t: Translator): string {
  const minutes = Math.round((end.getTime() - now.getTime()) / 60_000);

  if (minutes <= 0) return t('over its time');
  if (minutes < 60) return t('{minutes} min left', { minutes });

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0
    ? t('{hours}h left', { hours })
    : t('{hours}h {minutes}m left', { hours, minutes: rest });
}

export default async function FloorPage() {
  const { orgId, region } = await requireSession('diary:read');
  const t = await tFor();

  const now = new Date();
  const floor = await floorNow(orgId, now);

  const busy = floor.filter((bay) => bay.occupant);
  const overrunning = busy.filter((bay) => bay.occupant!.endAt <= now);

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('The floor')}
        description={t('As at {time}', {
          time: now.toLocaleTimeString(region.locale, { hour: '2-digit', minute: '2-digit' }),
        })}
        actions={
          <Link href="/diary">
            <Button size="sm" variant="secondary">
              {t('The diary')}
            </Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile label={t('Bays')} value={floor.length} note={t('In this workshop')} />
        <StatTile
          label={t('Occupied')}
          value={busy.length}
          tone={busy.length === floor.length && floor.length > 0 ? 'warning' : 'brand'}
          note={
            busy.length === floor.length && floor.length > 0 ? t('Nothing free') : t('Cars in bays')
          }
        />
        <StatTile
          label={t('Over their time')}
          value={overrunning.length}
          tone={overrunning.length > 0 ? 'danger' : 'neutral'}
          note={t('Still in the bay past the slot')}
        />
        <StatTile
          label={t('Free')}
          value={floor.length - busy.length}
          note={t('Ready for the next one')}
        />
      </StatRow>

      {floor.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="font-display text-[17px] font-semibold">{t('No bays set up')}</p>
            <p className="mt-1.5 text-[13px] text-(--text-soft)">
              {t('Add bays in settings and the floor appears here.')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {floor.map((bay) => {
            const car = bay.occupant;
            const late = Boolean(car && car.endAt <= now);

            return (
              <Card
                key={bay.bayId}
                className={
                  late ? 'border-(--danger)' : car ? 'border-(--brand)' : 'border-(--border)'
                }
              >
                <CardBody className="grid min-h-44 gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-[15px] font-semibold">{bay.name}</h2>
                    {car ? (
                      <Badge tone={late ? 'danger' : 'brand'} size="sm" dot>
                        {late ? t('over') : t('in use')}
                      </Badge>
                    ) : (
                      <Badge tone="success" size="sm">
                        {t('free')}
                      </Badge>
                    )}
                  </div>

                  {car ? (
                    <div className="grid gap-1.5">
                      <Link
                        href={`/bookings/${car.id}`}
                        className="font-display text-[16px] font-semibold leading-snug hover:text-(--brand-text) hover:underline"
                      >
                        {car.title}
                      </Link>

                      {car.registration ? <Registration value={car.registration} /> : null}

                      <p className="text-[12px] text-(--text-soft)">{car.subtitle}</p>

                      <p
                        className={
                          late
                            ? 'text-[12px] font-medium text-(--danger)'
                            : 'text-[12px] text-(--text-faint)'
                        }
                      >
                        {until(car.endAt, now, t)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-(--text-faint)">{t('Empty.')}</p>
                  )}

                  {bay.upcoming.length > 0 ? (
                    <div className="mt-auto border-t border-(--border) pt-2">
                      <p className="text-[11px] text-(--text-faint)">
                        {bay.upcoming.length > 1
                          ? t('Next: {time} {title} and {more} more', {
                              time: bay.upcoming[0]!.startAt.toLocaleTimeString(region.locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                              title: bay.upcoming[0]!.title,
                              more: bay.upcoming.length - 1,
                            })
                          : t('Next: {time} {title}', {
                              time: bay.upcoming[0]!.startAt.toLocaleTimeString(region.locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                              title: bay.upcoming[0]!.title,
                            })}
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
