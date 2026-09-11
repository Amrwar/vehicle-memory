import { Badge, Card, CardBody, CardHeader, EmptyState, Mileage, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { HealthDial } from '@/components/health-dial';
import { conditionOf } from '@/lib/condition';
import { requireSession } from '@/lib/guard';
import { orgCanReadVehicle } from '@/lib/passport';

export const metadata: Metadata = { title: 'Condition' };
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

function date(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function away(km: number | null, days: number): string {
  if (km != null) {
    return km < 0
      ? `${Math.abs(km).toLocaleString('en-GB')} km past`
      : `in about ${km.toLocaleString('en-GB')} km`;
  }
  return days < 0 ? `${Math.abs(days)} days past` : `in about ${Math.round(days / 30)} months`;
}

export default async function ConditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await requireSession('vehicle:read');
  const { id } = await params;

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
        <BackLink href={`/vehicles/${id}`}>Back to the vehicle</BackLink>
      </div>

      <PageHeader
        eyebrow="Condition"
        title={name}
        description="What this vehicle is in, and every figure that says so"
      />

      <Card className="mb-5">
        <CardBody className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <HealthDial score={health.score} band={health.band} />

          <div>
            <p className="text-[15px] leading-relaxed">{health.summary}</p>
            <p className="mt-2 text-[12px] text-(--text-faint)">
              Built from {health.factors.length} of 6 measures, covering{' '}
              {Math.round(health.coverage * 100)}% of the weight. The score belongs to the vehicle,
              not to this workshop: nothing in it measures what was spent here or how recently the
              car visited.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="What makes up the score"
              description="Worst first. Every one of these is checkable against the record."
            />
            {health.factors.length === 0 ? (
              <EmptyState
                title="Nothing to score"
                description="No visit, inspection, part or schedule is on record for this vehicle."
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {health.factors.map((factor) => (
                  <li key={factor.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{factor.label}</span>
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
                    <p className="mt-1.5 text-[12px] text-(--text-soft)">{factor.why}</p>
                    <p className="text-[11px] text-(--text-faint)">
                      Counts for {Math.round(factor.weight * 100)}% of the score.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {health.unknown.length > 0 ? (
            <Card>
              <CardHeader
                title="What could not be scored"
                description="Left out of the total rather than counted as a pass or a fail."
              />
              <ul className="divide-y divide-(--border)">
                {health.unknown.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5 text-[13px]">
                    <span className="font-medium">{entry.label}</span>
                    <p className="text-[12px] text-(--text-faint)">{entry.why}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title="Likely due"
              description={
                condition.kmPerDay
                  ? `From this vehicle's own mileage, about ${Math.round(condition.kmPerDay)} km a day.`
                  : 'Not enough odometer history to work from distance, so these are from age.'
              }
            />
            {condition.soon.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-soft)">
                Nothing is due inside the next four months.
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {condition.soon.map((prediction) => (
                  <li key={prediction.component} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{prediction.label}</span>
                      <span
                        className={`datum text-[13px] ${prediction.overdue ? 'font-semibold text-(--danger)' : ''}`}
                      >
                        {away(prediction.kmAway, prediction.daysAway)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-(--text-faint)">
                      {prediction.why} Confidence {prediction.confidence.toLowerCase()}.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Components"
              description="What is on this vehicle, how old it is, and how far through its life."
            />
            {condition.components.length === 0 ? (
              <EmptyState
                title="No parts on record"
                description="Components appear here as parts are fitted on a job."
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {condition.components.map((component) => (
                  <li key={component.component} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{component.label}</span>
                      <Badge tone={CONDITION_TONE[component.condition]} size="sm">
                        {component.condition.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-(--text-soft)">
                      {component.summary} Fitted {date(component.fittedOn)}
                      {component.brand ? `, ${component.brand}` : ''}.
                    </p>
                    <p className="text-[11px] text-(--text-faint)">
                      {Math.round(component.usedUp * 100)}% through its usual life, on{' '}
                      {component.drivenBy === 'DISTANCE' ? 'distance' : 'age'}.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardBody className="text-[12px] leading-relaxed text-(--text-faint)">
              <strong className="font-semibold text-(--text-soft)">
                {condition.missing.length} components have no record here.
              </strong>{' '}
              That is not the same as them being new. This vehicle has{' '}
              <Mileage km={vehicle.lastOdometerKm} /> on it and {condition.visits} recorded visits,
              and anything fitted before those visits, or elsewhere, is not in this list.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
