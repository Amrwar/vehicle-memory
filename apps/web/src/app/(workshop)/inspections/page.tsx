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
import { recentInspections } from '@/lib/inspections';

export const metadata: Metadata = { title: 'Inspections' };
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

  const inspections = await recentInspections(orgId);

  const open = inspections.filter((row) => row.status === 'DRAFT');
  const found = inspections.filter((row) => row.criticalCount > 0);

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Inspections"
        description="What was looked at, what was found, and what never got sent"
      />

      <StatRow className="mb-5">
        <StatTile label="Carried out" value={inspections.length} note="Most recent first" />
        <StatTile
          label="Left open"
          value={open.length}
          tone={open.length > 0 ? 'warning' : 'neutral'}
          note="Started and never sent"
        />
        <StatTile
          label="Found something urgent"
          value={found.length}
          tone={found.length > 0 ? 'danger' : 'neutral'}
          note="At least one red"
        />
        <StatTile
          label="Items flagged"
          value={inspections.reduce(
            (total, row) => total + row.criticalCount + row.advisoryCount,
            0,
          )}
          note="Red and amber together"
        />
      </StatRow>

      {open.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {open.length} inspection{open.length === 1 ? '' : 's'} started and never sent.
            </strong>{' '}
            Each one is a car that was looked at and a customer who was never asked. The work is
            already done; nobody is being paid for it.
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Every inspection"
          description="Open one to see what was recorded, or to carry on where somebody stopped."
        />
        {inspections.length === 0 ? (
          <EmptyState
            title="None yet"
            description="A technician starts one from their own screen, and it appears here the moment they do."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th>Job</Th>
                  <Th>Started</Th>
                  <Th>By</Th>
                  <Th numeric>Found</Th>
                  <Th>State</Th>
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
                          {row.criticalCount} red
                        </Badge>
                      ) : row.advisoryCount > 0 ? (
                        <Badge tone="warning" size="sm">
                          {row.advisoryCount} amber
                        </Badge>
                      ) : (
                        <span className="text-(--text-faint)">nothing</span>
                      )}
                    </Td>
                    <Td>
                      {row.status === 'COMPLETED' ? (
                        <Badge tone="success" size="sm">
                          sent
                        </Badge>
                      ) : (
                        <Badge tone="warning" size="sm">
                          still open
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
