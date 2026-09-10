import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';

import { requireSession } from '@/lib/guard';
import { quotingAssessments, stockDivergences } from '@/lib/insights';

export const metadata: Metadata = { title: 'Insights' };
export const dynamic = 'force-dynamic';

/**
 * What the workshop's own history is willing to say. FR-2600.
 *
 * Two questions, both answered from what actually happened rather than from a
 * setting somebody typed once: how much of each part to keep, and whether each
 * kind of work is sold for what it costs to do.
 *
 * Nothing here is a prediction in the impressive sense. There is no model,
 * because a workshop has months of history rather than years, and a part that
 * moved four times cannot support anything cleverer than an average. What it
 * can support is an average, a measure of how much that average moves about,
 * and a refusal to answer when there is not enough to go on.
 *
 * The refusal is the point. A reorder figure derived from two movements looks
 * exactly like one derived from two hundred, and whoever reads it has no way
 * to tell. So this page says how many parts it could not assess, next to the
 * ones it could.
 */
function hours(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)} min`;

  return `${(minutes / 60).toFixed(1)} hrs`;
}

export default async function InsightsPage() {
  const { orgId } = await requireSession('report:operational');

  const [stock, quoting] = await Promise.all([stockDivergences(orgId), quotingAssessments(orgId)]);

  const tooLow = stock.divergences.filter((entry) => entry.direction === 'TOO_LOW');
  const underquoted = quoting.worst.filter((entry) => entry.verdict === 'UNDERQUOTED');

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Insights"
        description="What your own history supports saying, and what it does not"
      />

      <StatRow className="mb-5">
        <StatTile
          label="Settings to change"
          value={stock.divergences.length}
          tone={stock.divergences.length > 0 ? 'brand' : 'neutral'}
          note={`Of ${stock.assessed} parts with enough history`}
        />
        <StatTile
          label="Risk running out"
          value={tooLow.length}
          tone={tooLow.length > 0 ? 'warning' : 'neutral'}
          note="Reorder point below real usage"
        />
        <StatTile
          label="Underquoted work"
          value={underquoted.length}
          tone={underquoted.length > 0 ? 'danger' : 'neutral'}
          note="Takes longer than it is sold for"
        />
        <StatTile
          label="Typical wait"
          value={`${stock.leadTimeDays}d`}
          note="Order to delivery, from your own orders"
        />
      </StatRow>

      {stock.total > stock.assessed ? (
        <Card className="mb-5">
          <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
            <strong className="font-semibold text-(--text)">
              {stock.total - stock.assessed} of {stock.total} parts could not be assessed.
            </strong>{' '}
            They have moved too rarely for an average to mean anything. A figure produced from two
            movements looks exactly like one produced from two hundred, so none is offered.
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="Stock levels worth changing"
          description={`Based on what left the shelf, and on orders taking about ${stock.leadTimeDays} days to arrive.`}
        />
        {stock.divergences.length === 0 ? (
          <EmptyState
            title="Nothing worth changing"
            description="Every part with enough history is set within a sensible distance of what its usage justifies."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Part</Th>
                  <Th numeric>Set to</Th>
                  <Th numeric>Should be</Th>
                  <Th>Which way</Th>
                  <Th>Why</Th>
                </tr>
              </thead>
              <tbody>
                {stock.divergences.map((entry) => (
                  <Tr key={entry.productId}>
                    <Td className="font-medium">{entry.name}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.current}
                    </Td>
                    <Td numeric className="font-medium">
                      {entry.suggested}
                    </Td>
                    <Td>
                      <Badge tone={entry.direction === 'TOO_LOW' ? 'warning' : 'neutral'} size="sm">
                        {entry.direction === 'TOO_LOW' ? 'runs out' : 'cash on a shelf'}
                      </Badge>
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">{entry.reason}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Work sold for the wrong time"
          description="Ranked by what it costs across all the jobs of that kind, not by the gap on one."
        />
        {quoting.worst.length === 0 ? (
          <EmptyState
            title={
              quoting.measured === 0
                ? 'Not enough completed work yet'
                : 'Every kind of work is booked about right'
            }
            description={
              quoting.measured === 0
                ? 'This needs several completed jobs of the same kind, with time booked against them, before it can say anything.'
                : `Measured across ${quoting.measured} of ${quoting.total} job types.`
            }
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Work</Th>
                  <Th numeric>Booked at</Th>
                  <Th numeric>Usually takes</Th>
                  <Th numeric>Jobs</Th>
                  <Th>What it means</Th>
                </tr>
              </thead>
              <tbody>
                {quoting.worst.map((entry) => (
                  <Tr key={entry.jobType}>
                    <Td className="font-medium">
                      {entry.jobType}
                      <span className="ml-2 inline-block align-middle">
                        <Badge
                          tone={entry.verdict === 'UNDERQUOTED' ? 'danger' : 'neutral'}
                          size="sm"
                        >
                          {entry.verdict === 'UNDERQUOTED' ? 'runs over' : 'over-booked'}
                        </Badge>
                      </span>
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.booked ? hours(entry.booked) : '—'}
                    </Td>
                    <Td numeric className="font-medium">
                      {entry.estimate.known ? hours(entry.estimate.median) : '—'}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {entry.estimate.known ? entry.estimate.samples : '—'}
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">{entry.note}</Td>
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
