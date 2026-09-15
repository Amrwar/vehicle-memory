import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Registration,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@carnet/db';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Recalls') };
}
export const dynamic = 'force-dynamic';

/**
 * Manufacturer recalls against the vehicles this workshop sees. FR-3205.
 *
 * The recalls themselves are not Carnet's to invent. A recall list built by
 * hand is a recall list that is quietly out of date, and a vehicle that shows
 * as clear because nobody updated a table is worse than one with no
 * information at all: the first is trusted.
 *
 * So what this screen does is match what is known against the vehicles on the
 * books, say plainly where the information came from, and say just as plainly
 * that it is not a substitute for the manufacturer's own check. The feed is a
 * Phase 11 integration; until it exists the page is honest about being a
 * record rather than a source.
 */
export default async function RecallsPage() {
  const { orgId, region } = await requireSession('vehicle:read');
  const t = await tFor();

  // Vehicles this workshop has actually seen, rather than every vehicle in the
  // network. A recall on a car that has never been here is somebody else's to
  // act on.
  const rows = await prisma.vehicleRecall.findMany({
    where: { vehicle: { jobs: { some: { orgId } } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      status: true,
      completedAt: true,
      recall: {
        select: {
          campaignRef: true,
          manufacturer: true,
          title: true,
          severity: true,
          issuedAt: true,
        },
      },
      vehicle: {
        select: { id: true, make: true, model: true, year: true, registration: true },
      },
    },
  });

  const open = rows.filter((row) => row.status === 'OPEN');
  const safety = open.filter((row) => row.recall.severity === 'SAFETY');

  return (
    <>
      <PageHeader
        eyebrow={t('Vehicles')}
        title={t('Recalls')}
        description={t('Manufacturer campaigns against the vehicles this workshop has seen')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Outstanding')}
          value={open.length}
          tone={open.length > 0 ? 'warning' : 'neutral'}
          note={t('Not recorded as done')}
        />
        <StatTile
          label={t('Safety')}
          value={safety.length}
          tone={safety.length > 0 ? 'danger' : 'neutral'}
          note={t('Of those, safety-related')}
        />
        <StatTile
          label={t('On record')}
          value={rows.length}
          note={t('Across every vehicle seen here')}
        />
      </StatRow>

      <Card className="mb-5">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          <strong className="font-semibold text-(--text)">
            {t('This is a record, not a source.')}
          </strong>{' '}
          {t(
            'It shows campaigns already recorded against these vehicles. It does not query the manufacturer, so a vehicle showing nothing here has not been checked and cleared: it has not been checked. Anything safety-related goes to a franchised dealer, who does the work free and has the authoritative list.',
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Campaigns')}
          description={t('Outstanding first, then everything already put right.')}
        />
        {rows.length === 0 ? (
          <EmptyState
            title={t('No recalls recorded')}
            description={t(
              'Campaigns appear here once they are recorded against a vehicle this workshop has seen.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Campaign')}</Th>
                  <Th>{t('Issued')}</Th>
                  <Th>{t('State')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/vehicles/${row.vehicle.id}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {[row.vehicle.year, row.vehicle.make, row.vehicle.model]
                          .filter(Boolean)
                          .join(' ')}
                      </Link>
                      {row.vehicle.registration ? (
                        <span className="ml-2 inline-block align-middle">
                          <Registration value={row.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-medium">{row.recall.title}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {row.recall.manufacturer} · {row.recall.campaignRef}
                      </span>
                    </Td>
                    <Td className="text-(--text-soft)">
                      {row.recall.issuedAt.toLocaleDateString(region.locale, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Td>
                    <Td>
                      {row.status === 'OPEN' ? (
                        <Badge tone={row.recall.severity === 'SAFETY' ? 'danger' : 'warning'} dot>
                          {row.recall.severity === 'SAFETY'
                            ? t('safety, outstanding')
                            : t('outstanding')}
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm">
                          {t('done')}{' '}
                          {row.completedAt ? row.completedAt.toLocaleDateString(region.locale) : ''}
                        </Badge>
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
