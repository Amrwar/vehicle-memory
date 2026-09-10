import { redact, segmentsFor } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * What has gone out, what has not, and why.
 *
 * Read-only. Nothing on this side sends: the web application writes rows and
 * the worker drains them, so a page that offered a "send now" button would be
 * lying about where the work happens.
 *
 * Addresses are redacted here rather than in the page, so no caller can
 * accidentally render a full one. A workshop screen is open all day in a room
 * people walk through.
 */
export async function outbound(orgId: string, limit = 60) {
  const rows = await prisma.messageLog.findMany({
    where: { orgId },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      channel: true,
      toAddress: true,
      subject: true,
      body: true,
      status: true,
      provider: true,
      error: true,
      attempts: true,
      availableAt: true,
      sentAt: true,
      createdAt: true,
      relatedType: true,
    },
  });

  const now = new Date();

  return rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    to: redact(row.toAddress),
    subject: row.subject,
    body: row.body,
    status: row.status,
    provider: row.provider,
    error: row.error,
    attempts: row.attempts,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    relatedType: row.relatedType,
    /** Queued and its time has passed: the worker is behind, or is not running. */
    overdue: row.status === 'QUEUED' && row.availableAt <= now,
    /** Queued for later on purpose, which is a different thing from stuck. */
    holdingUntil: row.status === 'QUEUED' && row.availableAt > now ? row.availableAt : null,
    segments: row.channel === 'SMS' ? segmentsFor(row.body).segments : null,
  }));
}

/**
 * The four numbers worth putting at the top of the page.
 *
 * Failures are counted separately from things merely waiting, because they
 * need different responses: a failure needs somebody to fix an address, and a
 * backlog needs somebody to check the worker is running.
 */
export async function outboundSummary(orgId: string) {
  const now = new Date();

  const [sent, failed, waiting, stuck] = await Promise.all([
    prisma.messageLog.count({ where: { orgId, status: { in: ['SENT', 'DELIVERED'] } } }),
    prisma.messageLog.count({ where: { orgId, status: 'FAILED' } }),
    prisma.messageLog.count({ where: { orgId, status: 'QUEUED', availableAt: { gt: now } } }),
    prisma.messageLog.count({ where: { orgId, status: 'QUEUED', availableAt: { lte: now } } }),
  ]);

  return { sent, failed, waiting, stuck };
}
