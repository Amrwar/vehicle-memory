import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Mileage,
  Money,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { fleetDetail } from '@/lib/fleet';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Fleet' };
export const dynamic = 'force-dynamic';

/**
 * One fleet, vehicle by vehicle. FR-3011.
 *
 * Ordered by what is wrong rather than by registration: waiting on the
 * customer first, then in the workshop, then overdue, then due soon, then
 * everything healthy. A fleet manager opens this to find out what needs
 * deciding, not to admire the vans that are fine.
 */
function date(value: Date | null): string {
  return value
    ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

export default async function FleetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await requireSession('customer:read');
  const { id } = await params;

  const fleet = await fleetDetail(orgId, id);
  if (!fleet) notFound();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/fleet">All fleets</BackLink>
      </div>

      <PageHeader
        eyebrow="Fleet"
        title={fleet.customer.displayName}
        description={`${fleet.totals.vehicles} vehicles on the books`}
        actions={
          <Link href={`/customers/${fleet.customer.id}`}>
            <Button size="sm" variant="secondary">
              The account
            </Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile label="Vehicles" value={fleet.totals.vehicles} note="Seen at least once" />
        <StatTile
          label="Off the road"
          value={fleet.totals.offTheRoad}
          tone={fleet.totals.offTheRoad > 0 ? 'warning' : 'neutral'}
          note="In the workshop now"
        />
        <StatTile
          label="Waiting on them"
          value={fleet.totals.awaiting}
          tone={fleet.totals.awaiting > 0 ? 'danger' : 'neutral'}
          note="Quotes nobody has answered"
        />
        <StatTile
          label="Spent with you"
          value={<Money amount={fleet.totals.spend} />}
          note="Across every vehicle"
        />
      </StatRow>

      {fleet.totals.awaiting > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {fleet.totals.awaiting} vehicle{fleet.totals.awaiting === 1 ? '' : 's'} waiting on a
              decision.
            </strong>{' '}
            A fleet quote usually sits with one person who has forty other things on. Nothing
            happens until they answer, and the van is off the road the whole time.
          </CardBody>
        </Card>
      ) : null}

      {fleet.vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Vehicles appear here once this company has brought one in."
        />
      ) : (
        <div className="grid gap-3">
          {fleet.vehicles.map((row) => (
            <Card
              key={row.vehicle.id}
              className={
                row.awaiting ? 'border-(--danger)' : row.openJob ? 'border-(--warning)' : undefined
              }
            >
              <CardBody className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/vehicles/${row.vehicle.id}`}
                      className="font-display text-[15px] font-semibold hover:text-(--brand-text) hover:underline"
                    >
                      {[row.vehicle.year, row.vehicle.make, row.vehicle.model]
                        .filter(Boolean)
                        .join(' ')}
                    </Link>
                    {row.vehicle.registration ? (
                      <Registration value={row.vehicle.registration} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] text-(--text-faint)">
                    <Mileage km={row.vehicle.lastOdometerKm} /> · last in {date(row.lastVisit)}
                  </p>
                </div>

                <div className="text-[13px]">
                  {row.awaiting ? (
                    <Link href={`/jobs/${row.awaiting.id}`}>
                      <Badge tone="danger" dot>
                        Waiting on a decision
                      </Badge>
                    </Link>
                  ) : row.openJob ? (
                    <Link href={`/jobs/${row.openJob.id}`}>
                      <Badge tone="warning" dot>
                        In the workshop
                      </Badge>
                    </Link>
                  ) : row.overdue ? (
                    <Badge tone="warning" size="sm">
                      service overdue
                    </Badge>
                  ) : row.dueSoon ? (
                    <Badge tone="brand" size="sm">
                      due {date(row.dueAt)}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      nothing due
                    </Badge>
                  )}
                </div>

                <div className="text-[13px] sm:text-right">
                  <span className="text-(--text-faint)">Spent </span>
                  <Money amount={row.spend} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
