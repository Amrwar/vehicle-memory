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

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { recentInspections } from '@/lib/inspections';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Inspections') };
}
export const dynamic = 'force-dynamic';

/**
 * Every inspection carried out, and the ones still open. FR-2705.
 *
 * The useful reading is not the completed ones. It is the drafts: an
 * inspection somebody started on Tuesday and never finished is a car that was
 * looked at, findings that were written down, and a customer who was never
 * asked. That is work the workshop has already done and is not being paid for,
 * and there was nowhere in the product it could be seen.
 */
function when(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function InspectionsPage() {
  const { orgId, region } = await requireSession('job:read');
  const t = await tFor();

  const inspections = await recentInspections(orgId);

  const open = inspections.filter((row) => row.status === 'DRAFT');
  const found = inspections.filter((row) => row.criticalCount > 0);

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Inspections')}
        description={t('What was looked at, what was found, and what never got sent')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Carried out')}
          value={inspections.length}
          note={t('Most recent first')}
        />
        <StatTile
          label={t('Left open')}
          value={open.length}
          tone={open.length > 0 ? 'warning' : 'neutral'}
          note={t('Started and never sent')}
        />
        <StatTile
          label={t('Found something urgent')}
          value={found.length}
          tone={found.length > 0 ? 'danger' : 'neutral'}
          note={t('At least one red')}
        />
        <StatTile
          label={t('Items flagged')}
          value={inspections.reduce(
            (total, row) => total + row.criticalCount + row.advisoryCount,
            0,
          )}
          note={t('Red and amber together')}
        />
      </StatRow>

      {open.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {open.length === 1
                ? t('1 inspection started and never sent.')
                : t('{count} inspections started and never sent.', { count: open.length })}
            </strong>{' '}
            {t(
              'Each one is a car that was looked at and a customer who was never asked. The work is already done; nobody is being paid for it.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Every inspection')}
          description={t(
            'Open one to see what was recorded, or to carry on where somebody stopped.',
          )}
        />
        {inspections.length === 0 ? (
          <EmptyState
            title={t('None yet')}
            description={t(
              'A technician starts one from their own screen, and it appears here the moment they do.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Job')}</Th>
                  <Th>{t('Started')}</Th>
                  <Th>{t('By')}</Th>
                  <Th numeric>{t('Found')}</Th>
                  <Th>{t('State')}</Th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/shop/inspect/${row.id}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {row.job.vehicle.make} {row.job.vehicle.model}
                      </Link>
                      {row.job.vehicle.registration ? (
                        <span className="ml-2 inline-block align-middle">
                          <Registration value={row.job.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Link
                        href={`/jobs/${row.job.id}`}
                        className="text-(--text-soft) hover:text-(--brand-text) hover:underline"
                      >
                        {row.job.number}
                      </Link>
                    </Td>
                    <Td className="text-(--text-soft)">{when(row.startedAt, region.locale)}</Td>
                    <Td className="text-(--text-soft)">{row.performedBy?.name ?? '—'}</Td>
                    <Td numeric>
                      {row.criticalCount > 0 ? (
                        <Badge tone="danger" size="sm">
                          {t('{count} red', { count: row.criticalCount })}
                        </Badge>
                      ) : row.advisoryCount > 0 ? (
                        <Badge tone="warning" size="sm">
                          {t('{count} amber', { count: row.advisoryCount })}
                        </Badge>
                      ) : (
                        <span className="text-(--text-faint)">{t('nothing')}</span>
                      )}
                    </Td>
                    <Td>
                      {row.status === 'COMPLETED' ? (
                        <Badge tone="success" size="sm">
                          {t('sent')}
                        </Badge>
                      ) : (
                        <Badge tone="warning" size="sm">
                          {t('still open')}
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
