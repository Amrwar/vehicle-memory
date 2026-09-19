import { prisma } from '@carnet/db';

/**
 * Everything one press caused. Phase 59. NFR-803.
 *
 * The health page could already answer "why did this customer not get their
 * message" — consent, suppression, status, held or stuck. It could not answer
 * the question a workshop asks more often, which is the same question pointed
 * the other way: *I pressed the button and nothing happened.*
 *
 * That one needs the chain rather than the last link. Was the action recorded
 * at all? Did it reach the outbox? Did the outbox turn into a message? Did
 * anybody on the floor get told? Four records, one identifier, in the order
 * they happened — and where it stops is where it went wrong.
 *
 * Deliberately not joined into one query. These are four different tables with
 * four different shapes, nothing meaningful to join on but the trace itself,
 * and a union would lose the columns that make each row worth reading.
 */

export type Step = 'recorded' | 'queued' | 'told' | 'sent';

export interface Moment {
  step: Step;
  at: Date;
  /** What it was, in the product's own words. */
  what: string;
  /** How it went, where that is a thing that can go wrong. */
  outcome: string | null;
  /** Where to look at the record itself. */
  href: string | null;
}

export interface Followed {
  trace: string;
  moments: Moment[];
}

/**
 * The bound is generous and still a bound.
 *
 * One press usually causes a handful of records; a campaign send causes one
 * per customer. Two hundred is more than anybody reads and less than a
 * workshop's whole mailing list, and the count of what was left out is
 * reported rather than hidden.
 */
const MOST = 200;

export async function follow(trace: string): Promise<Followed> {
  const term = trace.trim();
  if (term.length < 4) return { trace: term, moments: [] };

  const [audits, events, messages, notifications] = await Promise.all([
    prisma.auditLog.findMany({
      where: { traceId: term },
      orderBy: { createdAt: 'asc' },
      take: MOST,
      select: { action: true, entityType: true, entityId: true, createdAt: true },
    }),
    prisma.outboxEvent.findMany({
      where: { traceId: term },
      orderBy: { createdAt: 'asc' },
      take: MOST,
      select: {
        type: true,
        createdAt: true,
        processedAt: true,
        attempts: true,
        lastError: true,
      },
    }),
    prisma.messageLog.findMany({
      where: { traceId: term },
      orderBy: { createdAt: 'asc' },
      take: MOST,
      select: {
        id: true,
        channel: true,
        toAddress: true,
        subject: true,
        status: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.staffNotification.findMany({
      where: { traceId: term },
      orderBy: { createdAt: 'asc' },
      take: MOST,
      select: { kind: true, title: true, createdAt: true, href: true },
    }),
  ]);

  const moments: Moment[] = [
    ...audits.map((row): Moment => ({
      step: 'recorded',
      at: row.createdAt,
      what: row.action,
      outcome: null,
      href: `/audit/${row.entityType}/${row.entityId}`,
    })),
    ...events.map((row): Moment => ({
      step: 'queued',
      at: row.createdAt,
      what: row.type,
      outcome: row.processedAt
        ? 'handled'
        : row.lastError
          ? `failed after ${row.attempts}: ${row.lastError.slice(0, 120)}`
          : 'waiting',
      href: null,
    })),
    ...messages.map((row): Moment => ({
      step: 'sent',
      at: row.createdAt,
      what: `${row.channel.toLowerCase()} to ${row.toAddress}${row.subject ? ` — ${row.subject}` : ''}`,
      outcome: row.error
        ? `${row.status.toLowerCase()}: ${row.error.slice(0, 120)}`
        : row.status.toLowerCase(),
      href: null,
    })),
    ...notifications.map((row): Moment => ({
      step: 'told',
      at: row.createdAt,
      what: row.title,
      outcome: row.kind,
      href: row.href,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { trace: term, moments };
}
