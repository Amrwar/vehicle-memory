import {
  Badge,
  Card,
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
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';
import { passportsForOrg } from '@/lib/passports';

export const metadata: Metadata = { title: 'Passports' };
export const dynamic = 'force-dynamic';

/**
 * Every passport this workshop has a hand in, side by side. Phase 27.
 *
 * The figure to lead with is not how many there are but how many are
 * sound: a chain that does not verify is the one thing on this page that
 * needs somebody today. Then how many other workshops have written to
 * them, because that number is the network, and the network is the point.
 */
export default async function PassportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgId, region } = await requireSession('vehicle:read');
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const { rows, summary } = await passportsForOrg(orgId, query);

  const date = (value: Date | null) =>
    value ? value.toLocaleDateString(region.locale, { month: 'short', year: 'numeric' }) : '—';

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Passports"
        description="The record that belongs to each car. One line per vehicle; open any to read it as the next owner will."
      />

      <StatRow className="mb-5">
        <StatTile
          label="Passports"
          value={summary.passports}
          note="Vehicles this workshop has written to"
        />
        <StatTile
          label="Entries"
          value={summary.entries.toLocaleString(region.locale)}
          note="Across all of them"
        />
        <StatTile
          label="Chains sound"
          value={summary.intact}
          tone={summary.broken > 0 ? 'danger' : 'success'}
          note={
            summary.broken > 0
              ? `${summary.broken} do not verify`
              : 'Every entry hashes to the one before'
          }
        />
        <StatTile
          label="Shared with other workshops"
          value={summary.sharedWithOthers}
          tone="brand"
          note="Written to by more than one garage"
        />
      </StatRow>

      <form className="mb-4" action="/passports">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Registration, VIN, make or model"
          aria-label="Search passports"
          className="h-9 w-full max-w-sm rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px] placeholder:text-(--text-faint)"
        />
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title="No passports yet"
            description="A passport appears here the first time a job is completed on a vehicle, or when one is found on the network."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th>Registration</Th>
                  <Th>VIN</Th>
                  <Th numeric>Entries</Th>
                  <Th numeric>Workshops</Th>
                  <Th>Recorded</Th>
                  <Th>Chain</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/vehicles/${row.id}/passport`}
                        className="font-medium hover:underline"
                      >
                        {row.year} {row.make} {row.model}
                      </Link>
                      {row.openRecalls > 0 ? (
                        <Badge tone="danger" size="sm" className="ml-2">
                          Recall
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      {row.registration ? (
                        <Registration value={row.registration} />
                      ) : (
                        <span className="text-(--text-faint)">—</span>
                      )}
                    </Td>
                    <Td>
                      <Vin value={row.vin} grouped={false} className="text-[12px]" />
                    </Td>
                    <Td numeric className="tabular-nums">
                      {row.entries}
                    </Td>
                    <Td numeric className="tabular-nums">
                      {row.workshops}
                      {row.fromElsewhere ? (
                        <span className="ml-1 text-[11px] text-(--text-faint)">
                          · {row.fromElsewhere} from elsewhere
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {row.entries === 0
                        ? '—'
                        : date(row.firstRecorded) === date(row.lastRecorded)
                          ? date(row.firstRecorded)
                          : `${date(row.firstRecorded)} to ${date(row.lastRecorded)}`}
                    </Td>
                    <Td>
                      {row.entries === 0 ? (
                        <span className="text-(--text-faint)">Empty</span>
                      ) : row.intact ? (
                        <Badge tone="success" size="sm" dot>
                          Verifies
                        </Badge>
                      ) : (
                        <Badge tone="danger" size="sm" dot>
                          Does not verify
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
