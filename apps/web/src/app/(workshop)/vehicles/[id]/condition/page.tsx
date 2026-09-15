import { msg, type Translator } from '@carnet/core';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { HealthDial } from '@/components/health-dial';
import { conditionOf } from '@/lib/condition';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { orgCanReadVehicle } from '@/lib/passport';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Condition') };
}
export const dynamic = 'force-dynamic';

/**
 * The condition of one vehicle, and the working behind it. FR-3101, FR-3103.
 *
 * The score is at the top and everything below it is why. That order is
 * deliberate: a number nobody can take apart is a number people either ignore
 * or misquote, and this one is meant to survive being shown to a buyer.
 *
 * The factors that could not be scored are shown as prominently as the ones
 * that could. A vehicle with no inspection on record has not failed an
 * inspection, and a page that quietly left the gap out would be saying it had.
 */
const CONDITION_TONE = {
  NEW: 'success',
  GOOD: 'success',
  AGEING: 'brand',
  DUE: 'warning',
  OVERDUE: 'danger',
  UNKNOWN: 'neutral',
} as const;

function date(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function away(t: Translator, km: number | null, days: number, locale: string): string {
  if (km != null) {
    return km < 0
      ? t('{km} km past', { km: Math.abs(km).toLocaleString(locale) })
      : t('in about {km} km', { km: km.toLocaleString(locale) });
  }
  return days < 0
    ? t('{days} days past', { days: Math.abs(days) })
    : t('in about {months} months', { months: Math.round(days / 30) });
}

const CONFIDENCE = {
  HIGH: msg('Confidence high.'),
  MEDIUM: msg('Confidence medium.'),
  LOW: msg('Confidence low.'),
} as const;

export default async function ConditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId, region } = await requireSession('vehicle:read');
  const { id } = await params;
  const t = await tFor();

  const permitted = await orgCanReadVehicle(orgId, id);
  if (!permitted) notFound();

  const [vehicle, condition] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      select: { make: true, model: true, year: true, registration: true, lastOdometerKm: true },
    }),
    conditionOf(orgId, id),
  ]);

  if (!vehicle) notFound();

  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const { health } = condition;

  return (
    <>
      <div className="mb-3">
        <BackLink href={`/vehicles/${id}`}>{t('Back to the vehicle')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Condition')}
        title={name}
        description={t('What this vehicle is in, and every figure that says so')}
      />

      <Card className="mb-5">
        <CardBody className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <HealthDial score={health.score} band={health.band} />

          <div>
            <p className="text-[15px] leading-relaxed">{t(health.summary)}</p>
            <p className="mt-2 text-[12px] text-(--text-faint)">
              {t(
                'Built from {count} of 6 measures, covering {percent}% of the weight. The score belongs to the vehicle, not to this workshop: nothing in it measures what was spent here or how recently the car visited.',
                { count: health.factors.length, percent: Math.round(health.coverage * 100) },
              )}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('What makes up the score')}
              description={t('Worst first. Every one of these is checkable against the record.')}
            />
            {health.factors.length === 0 ? (
              <EmptyState
                title={t('Nothing to score')}
                description={t(
                  'No visit, inspection, part or schedule is on record for this vehicle.',
                )}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {health.factors.map((factor) => (
                  <li key={factor.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{t(factor.label)}</span>
                      <span className="datum text-[13px] font-semibold">{factor.score}</span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--surface-sunken)"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-(--brand)"
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-(--text-soft)">{t(factor.why)}</p>
                    <p className="text-[11px] text-(--text-faint)">
                      {t('Counts for {percent}% of the score.', {
                        percent: Math.round(factor.weight * 100),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {health.unknown.length > 0 ? (
            <Card>
              <CardHeader
                title={t('What could not be scored')}
                description={t('Left out of the total rather than counted as a pass or a fail.')}
              />
              <ul className="divide-y divide-(--border)">
                {health.unknown.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5 text-[13px]">
                    <span className="font-medium">{t(entry.label)}</span>
                    <p className="text-[12px] text-(--text-faint)">{t(entry.why)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Likely due')}
              description={
                condition.kmPerDay
                  ? t('From this vehicle’s own mileage, about {km} km a day.', {
                      km: Math.round(condition.kmPerDay),
                    })
                  : t('Not enough odometer history to work from distance, so these are from age.')
              }
            />
            {condition.soon.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                {t('Nothing is due inside the next four months.')}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {condition.soon.map((prediction) => (
                  <li key={prediction.component} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{t(prediction.label)}</span>
                      <span
                        className={`datum text-[13px] ${prediction.overdue ? 'font-semibold text-(--danger)' : ''}`}
                      >
                        {away(t, prediction.kmAway, prediction.daysAway, region.locale)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-(--text-faint)">
                      {t(prediction.why)} {t(CONFIDENCE[prediction.confidence])}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title={t('Components')}
              description={t(
                'What is on this vehicle, how old it is, and how far through its life.',
              )}
            />
            {condition.components.length === 0 ? (
              <EmptyState
                title={t('No parts on record')}
                description={t('Components appear here as parts are fitted on a job.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {condition.components.map((component) => (
                  <li key={component.component} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{t(component.label)}</span>
                      <Badge tone={CONDITION_TONE[component.condition]} size="sm">
                        {t(component.condition.toLowerCase())}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-(--text-soft)">
                      {t(component.summary)}{' '}
                      {component.brand
                        ? t('Fitted {date}, {brand}.', {
                            date: date(component.fittedOn, region.locale),
                            brand: component.brand,
                          })
                        : t('Fitted {date}.', { date: date(component.fittedOn, region.locale) })}
                    </p>
                    <p className="text-[11px] text-(--text-faint)">
                      {component.drivenBy === 'DISTANCE'
                        ? t('{percent}% through its usual life, on distance.', {
                            percent: Math.round(component.usedUp * 100),
                          })
                        : t('{percent}% through its usual life, on age.', {
                            percent: Math.round(component.usedUp * 100),
                          })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
              <strong className="font-semibold text-(--text-soft)">
                {t('{count} components have no record here.', {
                  count: condition.missing.length,
                })}
              </strong>{' '}
              {t('That is not the same as them being new.')}{' '}
              {t(
                'This vehicle has {mileage} on it and {visits} recorded visits, and anything fitted before those visits, or elsewhere, is not in this list.',
                {
                  mileage:
                    vehicle.lastOdometerKm != null
                      ? `${vehicle.lastOdometerKm.toLocaleString(region.locale)} km`
                      : t('Not recorded'),
                  visits: condition.visits,
                },
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
