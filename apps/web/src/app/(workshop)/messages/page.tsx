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
import { outbound, outboundSummary } from '@/lib/messages';

export const metadata: Metadata = { title: 'Messages' };
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
function when(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function MessagesPage() {
  const { orgId } = await requireSession('settings:read');

  const [messages, summary] = await Promise.all([outbound(orgId), outboundSummary(orgId)]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Messages"
        description="Everything sent to a customer, and everything that did not go"
      />

      <StatRow className="mb-5">
        <StatTile label="Sent" value={summary.sent} note="Handed to a provider" />
        <StatTile
          label="Failed"
          value={summary.failed}
          tone={summary.failed > 0 ? 'danger' : 'neutral'}
          note="Nobody received these"
        />
        <StatTile label="Waiting" value={summary.waiting} note="Held on purpose, until later" />
        <StatTile
          label="Stuck"
          value={summary.stuck}
          tone={summary.stuck > 0 ? 'warning' : 'neutral'}
          note="Due and not gone"
        />
      </StatRow>

      {summary.stuck > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {summary.stuck} message{summary.stuck === 1 ? ' is' : 's are'} due and{' '}
              {summary.stuck === 1 ? 'has' : 'have'} not gone.
            </strong>{' '}
            That usually means the background worker is not running. Nothing is lost, and everything
            here will go out as soon as it starts, but until then no customer is hearing from you.
          </CardBody>
        </Card>
      ) : null}

      {summary.failed > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {summary.failed} message{summary.failed === 1 ? '' : 's'} will never arrive.
            </strong>{' '}
            Most of these are a wrong address rather than a fault. They are not retried, because an
            address with a typo in it does not start working on the fourth attempt.
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Outbound"
          description="Newest first. Addresses are shortened; this screen is open all day."
        />
        {messages.length === 0 ? (
          <EmptyState
            title="Nothing has been sent"
            description="Confirmations, reminders and quote links appear here the moment they are written, and again when they go."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>To</Th>
                  <Th>About</Th>
                  <Th>State</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <Tr key={message.id}>
                    <Td className="text-(--text-soft)">
                      {when(message.sentAt ?? message.createdAt)}
                    </Td>
                    <Td>
                      <span className="font-medium">{message.to}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {message.channel.toLowerCase()}
                        {message.segments && message.segments > 1
                          ? ` · ${message.segments} segments`
                          : ''}
                      </span>
                    </Td>
                    <Td className="text-(--text-soft)">
                      {message.subject ?? message.body.slice(0, 60)}
                    </Td>
                    <Td>
                      {message.status === 'FAILED' ? (
                        <Badge tone="danger" size="sm">
                          failed
                        </Badge>
                      ) : message.overdue ? (
                        <Badge tone="warning" size="sm">
                          stuck
                        </Badge>
                      ) : message.holdingUntil ? (
                        <Badge tone="neutral" size="sm">
                          waiting
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm">
                          sent
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">
                      {message.error ??
                        (message.provider ? `via ${message.provider}` : 'Not yet attempted.')}
                      {message.attempts > 1 ? ` · ${message.attempts} attempts` : ''}
                      {message.holdingUntil ? ` · until ${when(message.holdingUntil)}` : ''}
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
