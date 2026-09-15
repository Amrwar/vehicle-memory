import { Badge, Card, CardBody, EmptyState, PageHeader, StatRow, StatTile } from '@carnet/ui';
import { msg } from '@carnet/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { capacityAhead } from '@/lib/planning';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Capacity') };
}
export const dynamic = 'force-dynamic';

/**
 * What the workshop can actually take, day by day. FR-3301.
 *
 * The product has carried a figure called daily capacity on every site since
 * Phase 1. It is a number somebody typed once. It does not know that two
 * people are on holiday on Thursday, that one works mornings, or that the
 * apprentice is at college on Fridays, and every promise made against it
 * inherits all three mistakes.
 *
 * The three numbers are kept apart deliberately. A workshop short of people
 * on Tuesday and short of ramps on Wednesday is short for two different
 * reasons, and only one of them is fixed by ringing somebody up.
 */
const DAY_NAMES = [
  '',
  msg('Monday'),
  msg('Tuesday'),
  msg('Wednesday'),
  msg('Thursday'),
  msg('Friday'),
  msg('Saturday'),
  msg('Sunday'),
];

function hours(minutes: number): string {
  const value = minutes / 60;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export default async function CapacityPage() {
  const { orgId, user, region } = await requireSession('diary:read');
  const t = await tFor();

  const days = await capacityAhead(orgId, user.locationId, new Date(), 7);

  const overbooked = days.filter((day) => day.overbookedMinutes > 0);
  const totalSpare = days.reduce(
    (total, day) => total + Math.max(0, day.effectiveMinutes - day.bookedMinutes),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={t('Planning')}
        title={t('Capacity')}
        description={t('What the next week can take, from the people who will actually be here')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Overbooked days')}
          value={overbooked.length}
          tone={overbooked.length > 0 ? 'danger' : 'neutral'}
          note={t('In the next seven')}
        />
        <StatTile
          label={t('Spare')}
          value={t('{hours}h', { hours: hours(totalSpare) })}
          note={t('Across the week')}
        />
        <StatTile
          label={t('Today')}
          value={t('{hours}h', { hours: hours(days[0]?.bookedMinutes ?? 0) })}
          note={t('of {hours}h', { hours: hours(days[0]?.effectiveMinutes ?? 0) })}
        />
        <StatTile
          label={t('Bays')}
          value={days[0]?.bays ?? 0}
          note={days[0]?.locationName ?? t('Group')}
        />
      </StatRow>

      {overbooked.length > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {overbooked.length === 1
                ? t('1 day promised more work than can be done.')
                : t('{count} days promised more work than can be done.', {
                    count: overbooked.length,
                  })}
            </strong>{' '}
            {t(
              'Nothing here is wrong yet. It becomes wrong at five o’clock, when somebody rings to say their car is not ready and nobody saw it coming this morning.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {days.map((day) => {
          const spare = day.effectiveMinutes - day.bookedMinutes;
          const share =
            day.effectiveMinutes === 0
              ? 0
              : Math.min(150, (day.bookedMinutes / day.effectiveMinutes) * 100);

          return (
            <Card
              key={day.date.toISOString()}
              className={day.overbookedMinutes > 0 ? 'border-(--danger)' : undefined}
            >
              <CardBody>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-display text-[15px] font-semibold">
                      {t(DAY_NAMES[day.weekday] ?? '')}
                    </span>
                    <span className="ml-2 text-[12px] text-(--text-faint)">
                      {day.date.toLocaleDateString(region.locale, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>

                  {day.overbookedMinutes > 0 ? (
                    <Badge tone="danger" dot>
                      {t('over by {hours}h', { hours: hours(day.overbookedMinutes) })}
                    </Badge>
                  ) : day.peopleMinutes === 0 ? (
                    <Badge tone="neutral" size="sm">
                      {t('closed')}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      {t('{hours}h spare', { hours: hours(spare) })}
                    </Badge>
                  )}
                </div>

                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-(--surface-sunken)"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${
                      day.overbookedMinutes > 0 ? 'bg-(--danger)' : 'bg-(--brand)'
                    }`}
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>

                <p className="mt-2 text-[13px] text-(--text-soft)">{t(day.summary)}</p>

                <p className="mt-1 text-[12px] text-(--text-faint)">
                  {t('People {people}h · bays {bays}h · promised {booked}h', {
                    people: hours(day.peopleMinutes),
                    bays: hours(day.bayMinutes),
                    booked: hours(day.bookedMinutes),
                  })}
                  {day.constrainedBy
                    ? ` · ${day.constrainedBy === 'BAYS' ? t('the bays bind') : t('the people bind')}`
                    : ''}
                </p>

                {day.people.some((person) => person.availableMinutes > 0) ? (
                  <ul className="mt-3 grid gap-1.5">
                    {day.people
                      .filter((person) => person.availableMinutes > 0 || person.absent)
                      .map((person) => (
                        <li
                          key={person.employeeId}
                          className="flex items-center justify-between gap-3 text-[12px]"
                        >
                          <span className={person.absent ? 'text-(--text-faint)' : ''}>
                            {person.name}
                            {person.absent ? ` · ${t('away')}` : ''}
                          </span>
                          <span className="datum text-(--text-soft)">
                            {person.absent
                              ? '—'
                              : t('{booked} of {available}h', {
                                  booked: hours(person.bookedMinutes),
                                  available: hours(person.availableMinutes),
                                })}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {days.every((day) => day.peopleMinutes === 0) ? (
        <EmptyState
          className="mt-5"
          title={t('Nobody has working hours recorded')}
          description={t(
            'Capacity is worked out from when people are contracted to be here. Set that up on the working patterns screen and this fills in.',
          )}
          action={
            <Link
              href="/patterns"
              className="text-[13px] font-medium text-(--brand-text) hover:underline"
            >
              {t('Set working hours')}
            </Link>
          }
        />
      ) : null}
    </>
  );
}
