import { describeSegment, lifetimeValue, type SegmentRule, toNumber } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
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
import { listCampaigns, previewSegment, retention } from '@/lib/automation';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

/**
 * Who is worth talking to, and whether you may. FR-2201 to FR-2204.
 *
 * Three questions, in the order a workshop asks them. Who has stopped coming.
 * Whether the ones you had are staying, which is the only retention figure
 * that means anything. And what a campaign would actually do if somebody
 * pressed send.
 *
 * The last of those is why the reachable count sits next to the segment count
 * everywhere on this page. A segment of 480 people where 90 never agreed to
 * marketing and 40 have no address is a list of 350, and the difference is
 * normally discovered after somebody has decided the campaign was worth doing.
 */

/** The cuts a workshop actually asks for, rather than a rule builder. */
const SEGMENTS: { key: string; rules: SegmentRule[] }[] = [
  { key: 'lapsed', rules: [{ kind: 'lapsed', days: 365 }] },
  { key: 'never-returned', rules: [{ kind: 'never-returned' }] },
  { key: 'best', rules: [{ kind: 'spent-over', minorUnits: 100_000 }] },
  { key: 'declined', rules: [{ kind: 'declined-work-since', days: 180 }] },
];

export default async function CrmPage() {
  const { orgId } = await requireSession('customer:read');

  const [segments, campaigns, cohortRows] = await Promise.all([
    Promise.all(
      SEGMENTS.map(async (segment) => ({
        ...segment,
        label: segment.rules.map(describeSegment).join(', '),
        ...(await previewSegment(orgId, segment.rules, 'EMAIL')),
      })),
    ),
    listCampaigns(orgId),
    retention(orgId, 12),
  ]);

  const lapsed = segments.find((segment) => segment.key === 'lapsed');
  const unreachableTotal = segments.reduce(
    (total, segment) => total + segment.segment.unreachable.length,
    0,
  );

  const widest = Math.max(0, ...cohortRows.map((row) => row.retention.length));

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Relationships"
        description="Who has stopped coming, who is staying, and who you are allowed to write to"
      />

      <StatRow className="mb-5">
        <StatTile
          label="Lapsed a year"
          value={lapsed?.segment.members.length ?? 0}
          tone={(lapsed?.segment.members.length ?? 0) > 0 ? 'warning' : 'neutral'}
          note="Not been in for 12 months"
        />
        <StatTile
          label="Reachable"
          value={lapsed?.segment.reachable.length ?? 0}
          note="Of those, by email"
        />
        <StatTile label="Cohorts" value={cohortRows.length} note="Months with a first visit" />
        <StatTile
          label="Campaigns sent"
          value={campaigns.filter((campaign) => campaign.status === 'SENT').length}
          note={`${campaigns.length} in total`}
        />
      </StatRow>

      {unreachableTotal > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {unreachableTotal} of the people below cannot be written to.
            </strong>{' '}
            Some never agreed to marketing and some have no address on file. They stay in the
            segment and out of the send, and the reason is kept against each one.
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="Segments"
          description="The count that matters is the second one: how many can actually be reached."
        />
        <TableWrap className="rounded-none border-0">
          <Table>
            <thead>
              <tr>
                <Th>Segment</Th>
                <Th numeric>In it</Th>
                <Th numeric>Reachable</Th>
                <Th numeric>Held back</Th>
                <Th numeric>Worth</Th>
                <Th>If you sent it</Th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <Tr key={segment.key}>
                  <Td className="font-medium">{segment.label}</Td>
                  <Td numeric>{segment.segment.members.length}</Td>
                  <Td numeric className="font-medium">
                    {segment.segment.reachable.length}
                  </Td>
                  <Td numeric className="text-(--text-soft)">
                    {segment.segment.unreachable.length}
                  </Td>
                  <Td numeric>
                    <Money amount={toNumber(segment.segment.totalValue)} />
                  </Td>
                  <Td className="text-[12px] text-(--text-soft)">
                    {segment.plan.warnings[0] ??
                      `${segment.plan.recipients} emails, nothing to pay.`}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title="Retention by cohort"
          description="Share of each month's new customers who came back, by months since. An overall rate would move with acquisition and tell you nothing."
        />
        {cohortRows.length === 0 ? (
          <EmptyState
            title="No completed visits yet"
            description="Cohorts appear once customers have a first visit to be counted from."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>First came in</Th>
                  <Th numeric>Size</Th>
                  <Th numeric>Worth each</Th>
                  {Array.from({ length: widest }, (_, month) => (
                    <Th key={month} numeric>
                      {month === 0 ? 'M0' : `+${month}`}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortRows.map((row) => (
                  <Tr key={row.cohort}>
                    <Td className="font-medium">{row.cohort}</Td>
                    <Td numeric>{row.size}</Td>
                    <Td numeric>
                      <Money amount={toNumber(lifetimeValue(row))} />
                    </Td>
                    {Array.from({ length: widest }, (_, month) => {
                      const share = row.retention[month];

                      return (
                        <Td key={month} numeric className="text-(--text-soft)">
                          {share === undefined ? (
                            // Not enough time has passed for this column to
                            // mean anything, and a zero here would read as a
                            // collapse rather than as an absence.
                            <span className="text-(--text-faint)">&mdash;</span>
                          ) : (
                            `${share}%`
                          )}
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Campaigns"
          description="Consent is rechecked for every recipient at the moment of sending, never taken from when the list was built."
        />
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns"
            description="A campaign is a segment and a message. It is the one thing here that cannot be undone."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Channel</Th>
                  <Th>State</Th>
                  <Th numeric>Sent</Th>
                  <Th numeric>Held back</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <Tr key={campaign.id}>
                    <Td className="font-medium">{campaign.name}</Td>
                    <Td className="text-(--text-soft)">{campaign.channel.toLowerCase()}</Td>
                    <Td>
                      <Badge
                        tone={
                          campaign.status === 'SENT'
                            ? 'success'
                            : campaign.status === 'CANCELLED'
                              ? 'neutral'
                              : 'brand'
                        }
                        size="sm"
                      >
                        {campaign.status.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td numeric>{campaign.plannedRecipients ?? '—'}</Td>
                    <Td numeric className="text-(--text-soft)">
                      {campaign.plannedSuppressed ?? '—'}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {campaign.sentAt
                        ? campaign.sentAt.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not sent'}
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
