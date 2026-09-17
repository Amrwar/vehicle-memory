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
  segmentMembers,
  retention,
  sendCampaign,
} from '@/lib/automation';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Customers') };
}
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
  const t = await tFor();

  // Read once, previewed six times. Each preview applies its rules to the same
  // people in memory, so fetching them per segment was the same heavy read six
  // times over — enough to exhaust the connection pool and take the rest of
  // the page down with it. Phase 51.
  const members = await segmentMembers(orgId);

  const [segments, campaigns, cohortRows] = await Promise.all([
    Promise.all(
      SEGMENTS.map(async (segment) => ({
        ...segment,
        label: segment.rules.map((rule) => t(describeSegment(rule))).join(', '),
        ...(await previewSegment(orgId, segment.rules, 'EMAIL', new Date(), members)),
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
        eyebrow={t('Customers')}
        title={t('Relationships')}
        description={t(
          'Who has stopped coming, who is staying, and who you are allowed to write to',
        )}
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title={t('Nothing was sent')}>
          {t(error)}
        </Alert>
      ) : null}

      {drafted ? (
        <Alert tone="info" className="mb-5" title={t('Saved as a draft')}>
          {t(
            'Nothing has gone out. The campaign below will say how many people it reaches before you commit to it.',
          )}
        </Alert>
      ) : null}

      {sent ? (
        <Alert tone="success" className="mb-5" title={t('Sent')}>
          {t('{sent} written to, {held} held back. There is no way to call it back.', {
            sent,
            held: held ?? 0,
          })}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Lapsed a year')}
          value={lapsed?.segment.members.length ?? 0}
          tone={(lapsed?.segment.members.length ?? 0) > 0 ? 'warning' : 'neutral'}
          note={t('Not been in for 12 months')}
        />
        <StatTile
          label={t('Reachable')}
          value={lapsed?.segment.reachable.length ?? 0}
          note={t('Of those, by email')}
        />
        <StatTile
          label={t('Cohorts')}
          value={cohortRows.length}
          note={t('Months with a first visit')}
        />
        <StatTile
          label={t('Campaigns sent')}
          value={campaigns.filter((campaign) => campaign.status === 'SENT').length}
          note={t('{count} in total', { count: campaigns.length })}
        />
      </StatRow>

      {unreachableTotal > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {t('{count} of the people below cannot be written to.', {
                count: unreachableTotal,
              })}
            </strong>{' '}
            {t(
              'Some never agreed to marketing and some have no address on file. They stay in the segment and out of the send, and the reason is kept against each one.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Segments')}
          description={t(
            'The count that matters is the second one: how many can actually be reached.',
          )}
        />
        <TableWrap className="rounded-none border-0">
          <Table>
            <thead>
              <tr>
                <Th>{t('Segment')}</Th>
                <Th numeric>{t('In it')}</Th>
                <Th numeric>{t('Reachable')}</Th>
                <Th numeric>{t('Held back')}</Th>
                <Th numeric>{t('Worth')}</Th>
                <Th>{t('If you sent it')}</Th>
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
                    {segment.plan.warnings[0]
                      ? t(segment.plan.warnings[0])
                      : t('{count} emails, nothing to pay.', {
                          count: segment.plan.recipients,
                        })}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader
          title={t('Retention by cohort')}
          description={t(
            'Share of each month’s new customers who came back, by months since. An overall rate would move with acquisition and tell you nothing.',
          )}
        />
        {cohortRows.length === 0 ? (
          <EmptyState
            title={t('No completed visits yet')}
            description={t('Cohorts appear once customers have a first visit to be counted from.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('First came in')}</Th>
                  <Th numeric>{t('Size')}</Th>
                  <Th numeric>{t('Worth each')}</Th>
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
          title={t('Write a campaign')}
          description={t(
            'Saving writes a draft and sends nothing. The audience is stored as its rules, so consent is rechecked against every person at the moment you send.',
          )}
        />
        <CardBody>
          <form action={compose} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('Call it')} htmlFor="campaign-name" required>
                <Input
                  id="campaign-name"
                  name="name"
                  required
                  placeholder={t('Winter check offer')}
                />
              </Field>

              <Field label={t('Who')} htmlFor="segment">
                <Select id="segment" name="segment" defaultValue="lapsed">
                  {segments.map((segment) => (
                    <option key={segment.key} value={segment.key}>
                      {t('{segment} ({count} reachable)', {
                        segment: segment.label,
                        count: segment.segment.reachable.length,
                      })}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('How')}
                htmlFor="channel"
                hint={t('A text costs money to send. Email does not.')}
              >
                <Select id="channel" name="channel" defaultValue="EMAIL">
                  <option value="EMAIL">{t('Email')}</option>
                  <option value="SMS">{t('Text')}</option>
                </Select>
              </Field>
            </div>

            <Field label={t('Subject')} htmlFor="subject" hint={t('Email only.')}>
              <Input
                id="subject"
                name="subject"
                placeholder={t('A free winter check while the weather turns')}
              />
            </Field>

            <Field label={t('What it says')} htmlFor="body" required>
              <Textarea id="body" name="body" required rows={4} />
            </Field>

            <div>
              <Button type="submit" variant="secondary">
                {t('Save as a draft')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Campaigns')}
          description={t(
            'Consent is rechecked for every recipient at the moment of sending, never taken from when the list was built.',
          )}
        />
        {campaigns.length === 0 ? (
          <EmptyState
            title={t('No campaigns')}
            description={t(
              'A campaign is a segment and a message. It is the one thing here that cannot be undone.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Campaign')}</Th>
                  <Th>{t('Channel')}</Th>
                  <Th>{t('State')}</Th>
                  <Th numeric>{t('Sent')}</Th>
                  <Th numeric>{t('Held back')}</Th>
                  <Th>{t('When')}</Th>
                  <Th>&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <Tr key={campaign.id}>
                    <Td className="font-medium">{campaign.name}</Td>
                    <Td className="text-(--text-soft)">{t(campaign.channel.toLowerCase())}</Td>
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
                        {t(campaign.status.toLowerCase())}
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
                        : t('Not sent')}
                    </Td>
                    <Td>
                      {campaign.status === 'DRAFT' ? (
                        <form action={send}>
                          <input type="hidden" name="campaignId" value={campaign.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {t('Send it')}
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
