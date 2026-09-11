import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
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
import { warrantyBook } from '@/lib/warranty';

export const metadata: Metadata = { title: 'Warranty' };
export const dynamic = 'force-dynamic';

/**
 * What the workshop is standing behind. FR-3001.
 *
 * The thing this page exists to stop is quiet and expensive. A workshop
 * replaces a part under its own warranty while the supplier's warranty on the
 * same part is still running, absorbs the cost, and never claims it back.
 * Nothing in an ordinary system points that out, because nothing holds both
 * dates in one place.
 *
 * So the figure at the top is not the value of the claims. It is the part of
 * them nobody else will cover, which is the only number that comes out of the
 * workshop's own pocket.
 */
function date(value: Date): string {
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function WarrantyPage() {
  const { orgId } = await requireSession('job:read');

  const book = await warrantyBook(orgId);

  return (
    <>
      <PageHeader
        eyebrow="Workshop"
        title="Warranty"
        description="What is still covered, what is running out, and who should be paying"
      />

      <StatRow className="mb-5">
        <StatTile
          label="Under cover"
          value={book.active.length}
          note={`${book.all.length} on record`}
        />
        <StatTile
          label="Running out"
          value={book.expiring.length}
          tone={book.expiring.length > 0 ? 'warning' : 'neutral'}
          note="Inside the next month"
        />
        <StatTile
          label="Open claims"
          value={book.openClaims.length}
          tone={book.openClaims.length > 0 ? 'brand' : 'neutral'}
          note="Not yet settled"
        />
        <StatTile
          label="Carrying"
          value={<Money amount={book.exposure} />}
          tone={book.exposure > 0 ? 'danger' : 'neutral'}
          note="What nobody else will cover"
        />
      </StatRow>

      {book.expiring.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {book.expiring.length} warrant{book.expiring.length === 1 ? 'y runs' : 'ies run'} out
              within a month.
            </strong>{' '}
            A vehicle whose cover is about to lapse is a reason to get it in while the workshop is
            still the one who would put it right.
          </CardBody>
        </Card>
      ) : null}

      {book.openClaims.length > 0 ? (
        <Card className="mb-5 overflow-hidden">
          <CardHeader
            title="Claims nobody has settled"
            description="Each one is money sitting with a supplier who has not been chased, or a cost the workshop has already absorbed."
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>What failed</Th>
                  <Th>Vehicle</Th>
                  <Th>Complaint</Th>
                  <Th numeric>Recoverable</Th>
                  <Th numeric>On us</Th>
                </tr>
              </thead>
              <tbody>
                {book.openClaims.map((entry) => {
                  const claim = entry.row.claims.find((row) => row.status === 'OPEN')!;

                  return (
                    <Tr key={claim.id}>
                      <Td className="font-medium">{entry.row.description}</Td>
                      <Td>
                        <Link
                          href={`/vehicles/${entry.row.vehicle.id}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {entry.row.vehicle.make} {entry.row.vehicle.model}
                        </Link>
                      </Td>
                      <Td className="text-[12px] text-(--text-soft)">
                        {claim.complaint}
                        {claim.outsideCover ? (
                          <Badge tone="warning" size="sm" className="ml-2">
                            goodwill
                          </Badge>
                        ) : null}
                      </Td>
                      <Td numeric className="text-(--success)">
                        <Money amount={Number(claim.recoverable)} />
                      </Td>
                      <Td numeric className="font-medium">
                        <Money amount={Number(claim.exposure)} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Everything covered"
          description="Cover runs from the day the work was done, and ends on time or on mileage, whichever comes first."
        />
        {book.all.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Cover is recorded as a job closes, and appears here with the date and mileage it runs to."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>What</Th>
                  <Th>Vehicle</Th>
                  <Th>From</Th>
                  <Th>State</Th>
                  <Th>Behind it</Th>
                </tr>
              </thead>
              <tbody>
                {book.all.map((entry) => (
                  <Tr key={entry.row.id}>
                    <Td>
                      <span className="font-medium">{entry.row.description}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {entry.row.kind === 'PART' ? 'Part' : 'Labour'} · job {entry.row.job.number}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/vehicles/${entry.row.vehicle.id}`}
                        className="hover:text-(--brand-text) hover:underline"
                      >
                        {entry.row.vehicle.make} {entry.row.vehicle.model}
                      </Link>
                      {entry.row.vehicle.registration ? (
                        <span className="ml-2 inline-block align-middle">
                          <Registration value={entry.row.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">{date(entry.row.startedOn)}</Td>
                    <Td>
                      <Badge
                        tone={
                          entry.status.active
                            ? entry.status.daysLeft <= 30
                              ? 'warning'
                              : 'success'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {entry.status.active ? `${entry.status.daysLeft}d left` : 'expired'}
                      </Badge>
                      <span className="block text-[11px] text-(--text-faint)">
                        {entry.status.summary}
                      </span>
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">
                      {entry.cover.supplierName
                        ? `${entry.cover.supplierName}, ${entry.cover.supplierMonths ?? '—'} months`
                        : 'Nobody. All of it falls on the workshop.'}
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
