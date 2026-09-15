import { prisma } from '@carnet/db';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Mileage,
  PageHeader,
  Registration,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Vehicles') };
}
export const dynamic = 'force-dynamic';

/**
 * Vehicles this workshop has access to.
 *
 * The scoping is deliberately indirect: a vehicle is global, and this
 * workshop sees the ones it has serviced or been granted. Listing every
 * vehicle on the platform would be a data breach, not a feature.
 */
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgId, region } = await requireSession('vehicle:read');
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const t = await tFor();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      AND: [
        {
          OR: [
            { jobs: { some: { orgId } } },
            { accessGrants: { some: { orgId, revokedAt: null } } },
          ],
        },
        query
          ? {
              OR: [
                { registration: { contains: query, mode: 'insensitive' } },
                { vin: { contains: query, mode: 'insensitive' } },
                { make: { contains: query, mode: 'insensitive' } },
                { model: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      ownerships: { where: { endedAt: null }, take: 1 },
      recalls: { where: { status: 'OPEN' }, select: { id: true } },
      _count: { select: { events: true, jobs: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Vehicles')}
        description={t('Vehicles this workshop has serviced or been granted access to.')}
        actions={
          <Link href="/vehicles/find">
            <Button variant="primary">{t('Find or add a vehicle')}</Button>
          </Link>
        }
      />

      <form className="mb-4" action="/vehicles">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t('Registration, VIN, make or model')}
          aria-label={t('Search vehicles')}
          className="h-9 w-full max-w-sm rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
      </form>

      <Card className="overflow-hidden">
        {vehicles.length === 0 ? (
          <EmptyState
            title={t('No vehicles yet')}
            description={t(
              'A vehicle appears here once it is found on the network or added, or the first time you open a job for it.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Registration')}</Th>
                  <Th>{t('VIN')}</Th>
                  <Th>{t('Owner')}</Th>
                  <Th numeric>{t('Odometer')}</Th>
                  <Th numeric>{t('History')}</Th>
                  <Th>{t('Flags')}</Th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <Tr key={vehicle.id}>
                    <Td>
                      <Link
                        href={`/vehicles/${vehicle.id}`}
                        className="font-medium hover:underline"
                      >
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Link>
                    </Td>
                    <Td>
                      {vehicle.registration ? (
                        <Registration value={vehicle.registration} />
                      ) : (
                        <span className="text-(--text-faint)">—</span>
                      )}
                    </Td>
                    <Td>
                      <Vin value={vehicle.vin} grouped={false} className="text-[12px]" />
                    </Td>
                    <Td className="text-(--text-soft)">
                      {vehicle.ownerships[0]?.ownerName ?? (
                        <span className="text-(--text-faint)">{t('Unknown')}</span>
                      )}
                    </Td>
                    <Td numeric>
                      <Mileage t={t} locale={region.locale} km={vehicle.lastOdometerKm} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {vehicle._count.events === 1
                        ? t('1 entry')
                        : t('{count} entries', { count: vehicle._count.events })}
                    </Td>
                    <Td>
                      {vehicle.recalls.length > 0 ? (
                        <Badge tone="danger" size="sm">
                          {vehicle.recalls.length === 1
                            ? t('1 recall')
                            : t('{count} recalls', { count: vehicle.recalls.length })}
                        </Badge>
                      ) : (
                        <span className="text-(--text-faint)">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
