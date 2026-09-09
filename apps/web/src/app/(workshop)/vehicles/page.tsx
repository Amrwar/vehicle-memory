import { prisma } from '@carnet/db';
import {
  Badge,
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

export const metadata: Metadata = { title: 'Vehicles' };
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
  const { orgId } = await requireSession('vehicle:read');
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

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
        eyebrow="Workshop"
        title="Vehicles"
        description="Vehicles this workshop has serviced or been granted access to."
      />

      <form className="mb-4" action="/vehicles">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Registration, VIN, make or model"
          aria-label="Search vehicles"
          className="h-9 w-full max-w-sm rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
      </form>

      <Card className="overflow-hidden">
        {vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles yet"
            description="A vehicle appears here the first time you create a job for it."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th>Registration</Th>
                  <Th>VIN</Th>
                  <Th>Owner</Th>
                  <Th numeric>Odometer</Th>
                  <Th numeric>History</Th>
                  <Th>Flags</Th>
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
                        <span className="text-(--text-faint)">Unknown</span>
                      )}
                    </Td>
                    <Td numeric>
                      <Mileage km={vehicle.lastOdometerKm} />
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {vehicle._count.events} entries
                    </Td>
                    <Td>
                      {vehicle.recalls.length > 0 ? (
                        <Badge tone="danger" size="sm">
                          {vehicle.recalls.length} recall
                          {vehicle.recalls.length === 1 ? '' : 's'}
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
