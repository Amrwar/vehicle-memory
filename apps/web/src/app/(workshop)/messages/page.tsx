import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
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
import { redirect } from 'next/navigation';

import { deliverability, lift, suppressions } from '@/lib/deliverability';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { outbound, outboundSummary } from '@/lib/messages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Messages') };
}
export const dynamic = 'force-dynamic';

/**
 * Everything the product has said to a customer. FR-2401.
 *
 * The reason this page exists is the reason the reminders page exists: a
 * machine that writes to customers on its own, with no screen showing what it
 * wrote, is indistinguishable from one that stopped three weeks ago. The first
 * anybody notices is a quiet month.
 *
 * The distinction the page is built around is between failed, held and stuck.
 * A failure needs somebody to fix an address. Something held is working
 * exactly as intended and needs nobody. Something queued whose time has passed
 * means the worker is not running, and that is the one worth interrupting a
 * morning for, because nothing at all is going out.
 */
function when(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Lets an address be used again. FR-4004.
 *
 * A person, and a reason. An address that starts working is usually one
 * somebody corrected, and correcting it is the moment to say so; a suppression
 * that lifted itself would put the workshop straight back to bouncing off the
 * same mailbox and losing more reputation doing it.
 */
async function unsuppress(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  const note = String(formData.get('note') ?? '').trim();

  if (!note) {
    // The sentence stays English in the address; the page translates it.
    // i18n-ignore
    redirect('/messages?error=' + encodeURIComponent('Say why it is safe to send there again.'));
  }

  await lift({
    orgId,
    userId: user.userId,
    suppressionId: String(formData.get('suppressionId') ?? ''),
    note,
  });

  redirect('/messages');
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const notice = await searchParams;
  const { orgId, region } = await requireSession('settings:read');
  const t = await tFor();

  const [messages, summary, health, blocked] = await Promise.all([
    outbound(orgId),
    outboundSummary(orgId),
    deliverability(orgId),
    suppressions(orgId),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('Admin')}
        title={t('Messages')}
        description={t('Everything sent to a customer, and everything that did not go')}
      />

      <StatRow className="mb-5">
        <StatTile label={t('Sent')} value={summary.sent} note={t('Handed to a provider')} />
        <StatTile
          label={t('Failed')}
          value={summary.failed}
          tone={summary.failed > 0 ? 'danger' : 'neutral'}
          note={t('Nobody received these')}
        />
        <StatTile
          label={t('Waiting')}
          value={summary.waiting}
          note={t('Held on purpose, until later')}
        />
        <StatTile
          label={t('Stuck')}
          value={summary.stuck}
          tone={summary.stuck > 0 ? 'warning' : 'neutral'}
          note={t('Due and not gone')}
        />
      </StatRow>

      {summary.stuck > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {summary.stuck === 1
                ? t('1 message is due and has not gone.')
                : t('{count} messages are due and have not gone.', { count: summary.stuck })}
            </strong>{' '}
            {t(
              'That usually means the background worker is not running. Nothing is lost, and everything here will go out as soon as it starts, but until then no customer is hearing from you.',
            )}
          </CardBody>
        </Card>
      ) : null}

      {summary.failed > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {summary.failed === 1
                ? t('1 message will never arrive.')
                : t('{count} messages will never arrive.', { count: summary.failed })}
            </strong>{' '}
            {t(
              'Most of these are a wrong address rather than a fault. They are not retried, because an address with a typo in it does not start working on the fourth attempt.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Outbound')}
          description={t('Newest first. Addresses are shortened; this screen is open all day.')}
        />
        {messages.length === 0 ? (
          <EmptyState
            title={t('Nothing has been sent')}
            description={t(
              'Confirmations, reminders and quote links appear here the moment they are written, and again when they go.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('When')}</Th>
                  <Th>{t('To')}</Th>
                  <Th>{t('About')}</Th>
                  <Th>{t('State')}</Th>
                  <Th>{t('Detail')}</Th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <Tr key={message.id}>
                    <Td className="text-(--text-soft)">
                      {when(message.sentAt ?? message.createdAt, region.locale)}
                    </Td>
                    <Td>
                      <span className="font-medium">{message.to}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {t(message.channel.toLowerCase())}
                        {message.segments && message.segments > 1
                          ? ` · ${t('{count} segments', { count: message.segments })}`
                          : ''}
                      </span>
                    </Td>
                    <Td className="text-(--text-soft)">
                      {message.subject ?? message.body.slice(0, 60)}
                    </Td>
                    <Td>
                      {message.status === 'FAILED' ? (
                        <Badge tone="danger" size="sm">
                          {t('failed')}
                        </Badge>
                      ) : message.overdue ? (
                        <Badge tone="warning" size="sm">
                          {t('stuck')}
                        </Badge>
                      ) : message.holdingUntil ? (
                        <Badge tone="neutral" size="sm">
                          {t('waiting')}
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm">
                          {t('sent')}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">
                      {message.error
                        ? t(message.error)
                        : message.provider
                          ? t('via {provider}', { provider: message.provider })
                          : t('Not yet attempted.')}
                      {message.attempts > 1
                        ? ` · ${t('{count} attempts', { count: message.attempts })}`
                        : ''}
                      {message.holdingUntil
                        ? ` · ${t('until {date}', { date: when(message.holdingUntil, region.locale) })}`
                        : ''}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('Addresses nothing is sent to')}
          description={t(
            "A mailbox that does not exist today will not exist tomorrow, and carrying on is how a sender's reputation goes.",
          )}
        />

        {notice.error ? (
          <CardBody className="border-b border-(--border) text-[13px] text-(--danger)">
            {t(notice.error)}
          </CardBody>
        ) : null}

        <CardBody className="border-b border-(--border) text-[13px] leading-relaxed text-(--text-soft)">
          {t(health.summary)}
        </CardBody>

        {blocked.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            {t(
              'Nothing is suppressed. Addresses appear here after a permanent bounce or a spam complaint.',
            )}
          </CardBody>
        ) : (
          <ul className="divide-y divide-(--border)">
            {blocked.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="datum text-[13px] font-medium">{row.address}</span>
                  <Badge tone={row.reason === 'COMPLAINT' ? 'danger' : 'warning'} size="sm">
                    {row.reason === 'COMPLAINT' ? t('marked as spam') : t('permanent bounce')}
                  </Badge>
                  <span className="ml-auto text-[11px] text-(--text-faint)">
                    {row.createdAt.toLocaleDateString(region.locale)}
                  </span>
                </div>

                {row.detail ? (
                  <p className="mt-0.5 text-[12px] text-(--text-faint)">{row.detail}</p>
                ) : null}

                <form action={unsuppress} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="suppressionId" value={row.id} />
                  <Field label={t('Why it is safe again')} className="min-w-[16rem] flex-1">
                    <Input
                      name="note"
                      required
                      placeholder={t('Corrected the address with them')}
                    />
                  </Field>
                  <Button type="submit" size="sm" variant="secondary">
                    {t('Send there again')}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
