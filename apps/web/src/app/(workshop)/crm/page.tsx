import {
  type Channel,
  describeSegment,
  lifetimeValue,
  type SegmentRule,
  toNumber,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Money,
  PageHeader,
  Select,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Textarea,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  CampaignError,
  draftCampaign,
  listCampaigns,
  previewSegment,
  retention,
  sendCampaign,
} from '@/lib/automation';
import { requireSession } from '@/lib/guard';

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

/**
 * Writes a campaign as a draft. Deliberately does not send it.
 *
 * Composing and sending are two steps because a campaign is the only thing in
 * this product that cannot be recalled. The draft row is what lets the page
 * say, before anybody commits, how many people will actually be written to
 * once consent has been rechecked.
 */
async function compose(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

  const chosen = SEGMENTS.find((segment) => segment.key === String(formData.get('segment') ?? ''));

  await draftCampaign({
    orgId,
    userId: user.userId,
    name: String(formData.get('name') ?? '').trim(),
    channel: String(formData.get('channel') ?? 'EMAIL') as Channel,
    segment: chosen?.rules ?? [],
    subject: String(formData.get('subject') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
  });

  redirect('/crm?drafted=1');
}

/**
 * Sends one. Consent is rechecked here, per person, at this moment.
 *
 * There is no undo, and the service layer refuses a second send rather than
 * relying on the button being pressed once.
 */
async function send(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

  try {
    const result = await sendCampaign({
      orgId,
      userId: user.userId,
      campaignId: String(formData.get('campaignId') ?? ''),
    });

    redirect(`/crm?sent=${result.sent}&held=${result.suppressed}`);
  } catch (error) {
    if (error instanceof CampaignError) {
      redirect(`/crm?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ drafted?: string; sent?: string; held?: string; error?: string }>;
}) {
  const { orgId, region } = await requireSession('customer:read');
  const { drafted, sent, held, error } = await searchParams;

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

      {error ? (
        <Alert tone="danger" className="mb-5" title="Nothing was sent">
          {error}
        </Alert>
      ) : null}

      {drafted ? (
        <Alert tone="info" className="mb-5" title="Saved as a draft">
          Nothing has gone out. The campaign below will say how many people it reaches before you
          commit to it.
        </Alert>
      ) : null}

      {sent ? (
        <Alert tone="success" className="mb-5" title="Sent">
          {sent} written to, {held ?? 0} held back. There is no way to call it back.
        </Alert>
      ) : null}

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
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={toNumber(segment.segment.totalValue)}
                    />
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
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={toNumber(lifetimeValue(row))}
                      />
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

      <Card className="mb-5">
        <CardHeader
          title="Write a campaign"
          description="Saving writes a draft and sends nothing. The audience is stored as its rules, so consent is rechecked against every person at the moment you send."
        />
        <CardBody>
          <form action={compose} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Call it" htmlFor="campaign-name" required>
                <Input id="campaign-name" name="name" required placeholder="Winter check offer" />
              </Field>

              <Field label="Who" htmlFor="segment">
                <Select id="segment" name="segment" defaultValue="lapsed">
                  {segments.map((segment) => (
                    <option key={segment.key} value={segment.key}>
                      {segment.label} ({segment.segment.reachable.length} reachable)
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="How"
                htmlFor="channel"
                hint="A text costs money to send. Email does not."
              >
                <Select id="channel" name="channel" defaultValue="EMAIL">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">Text</option>
                </Select>
              </Field>
            </div>

            <Field label="Subject" htmlFor="subject" hint="Email only.">
              <Input
                id="subject"
                name="subject"
                placeholder="A free winter check while the weather turns"
              />
            </Field>

            <Field label="What it says" htmlFor="body" required>
              <Textarea id="body" name="body" required rows={4} />
            </Field>

            <div>
              <Button type="submit" variant="secondary">
                Save as a draft
              </Button>
            </div>
          </form>
        </CardBody>
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
                  <Th>&nbsp;</Th>
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
                        ? campaign.sentAt.toLocaleDateString(region.locale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not sent'}
                    </Td>
                    <Td>
                      {campaign.status === 'DRAFT' ? (
                        <form action={send}>
                          <input type="hidden" name="campaignId" value={campaign.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Send it
                          </Button>
                        </form>
                      ) : null}
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
