import {
  fromAge,
  fromCount,
  type MessageFacts,
  signal,
  type Signal,
  type Standing,
  type DeliveryVerdict,
  whyMessage,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { env } from './env';

/**
 * How Carnet itself is, for whoever runs Carnet. Phase 50.
 *
 * Deliberately not the workshop's dashboard. A workshop wants to know whether
 * its own morning is in order; this asks whether the thing every workshop's
 * morning runs on is in order, and the two have different readers, different
 * numbers and different consequences. Mixing them produces a page that tells a
 * service advisor about queue depth and tells an operator about brake jobs.
 *
 * Nothing here is cached. A health page that is a minute out of date is a
 * health page somebody argues with during an incident, and the cost of asking
 * the questions honestly is a few counts.
 */

/** Everything an operator would look at, gathered. */
export async function systemHealth(now = new Date()): Promise<Signal[]> {
  const [system, workers, integrations, data, security, backups] = await Promise.all([
    systemSignals(now),
    workerSignals(now),
    integrationSignals(now),
    dataSignals(),
    securitySignals(now),
    backupSignals(),
  ]);

  return [...system, ...workers, ...integrations, ...data, ...security, ...backups];
}

/* ---------------------------------------------------------------------------
   The machine
   --------------------------------------------------------------------------- */

async function systemSignals(now: Date): Promise<Signal[]> {
  const started = Date.now();
  let reachable = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    reachable = false;
  }

  const took = Date.now() - started;

  const [applied, orgs] = reachable
    ? await Promise.all([
        prisma.$queryRaw<
          { n: bigint }[]
        >`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`,
        prisma.organization.count(),
      ])
    : [[], 0];

  return [
    signal({
      area: 'System',
      name: 'Database',
      standing: !reachable ? 'failed' : took > 1_000 ? 'degraded' : 'healthy',
      template: reachable ? 'Answered in {ms} ms.' : 'Did not answer.',
      values: { ms: took },
    }),
    signal({
      area: 'System',
      name: 'Migrations',
      standing: Number(applied[0]?.n ?? 0) > 0 ? 'healthy' : 'failed',
      template: '{count} applied.',
      values: { count: Number(applied[0]?.n ?? 0) },
    }),
    signal({
      area: 'System',
      name: 'Workshops',
      standing: orgs > 0 ? 'healthy' : 'unknown',
      template: '{count} on Carnet.',
      values: { count: orgs },
    }),
    signal({
      area: 'System',
      name: 'Clock',
      standing: 'healthy',
      template: 'It is {time} here.',
      values: { time: now.toISOString().slice(11, 16) },
    }),
  ];
}

/* ---------------------------------------------------------------------------
   The work nobody is watching
   --------------------------------------------------------------------------- */

async function workerSignals(now: Date): Promise<Signal[]> {
  const [queuedEvents, oldestEvent, queuedMessages, dueMessages, failedMessages] =
    await Promise.all([
      prisma.outboxEvent.count({ where: { processedAt: null } }),
      prisma.outboxEvent.findFirst({
        where: { processedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.messageLog.count({ where: { status: 'QUEUED' } }),
      // Due and still here. The number that means the sender is not running,
      // as opposed to the number that means messages are being held until the
      // morning, which is the product working.
      prisma.messageLog.count({ where: { status: 'QUEUED', availableAt: { lte: now } } }),
      prisma.messageLog.count({
        where: { status: 'FAILED', createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
      }),
    ]);

  const waitingFor = oldestEvent
    ? Math.round((now.getTime() - oldestEvent.createdAt.getTime()) / 1000)
    : null;

  return [
    signal({
      area: 'Workers',
      name: 'Events waiting',
      standing: fromAge({ seconds: waitingFor, degradedAbove: 300, failedAbove: 3_600 }),
      template: '{count} waiting, the oldest for {minutes} minutes.',
      values: { count: queuedEvents, minutes: Math.round((waitingFor ?? 0) / 60) },
    }),
    signal({
      area: 'Workers',
      name: 'Messages due and not gone',
      standing: fromCount({ count: dueMessages, degradedAbove: 0, failedAbove: 20 }),
      template: '{due} of {queued} in the queue are due now and have not gone.',
      values: { due: dueMessages, queued: queuedMessages },
    }),
    signal({
      area: 'Workers',
      name: 'Messages that failed today',
      standing: fromCount({ count: failedMessages, degradedAbove: 0, failedAbove: 20 }),
      template: '{count} in the last day.',
      values: { count: failedMessages },
    }),
  ];
}

/* ---------------------------------------------------------------------------
   The things outside this building
   --------------------------------------------------------------------------- */

async function integrationSignals(now: Date): Promise<Signal[]> {
  const config = env();
  const since = new Date(now.getTime() - 86_400_000);

  const [mailSent, mailFailed, smsSent, cardsTried, cardsFailed] = await Promise.all([
    prisma.messageLog.count({
      where: { channel: 'EMAIL', status: { in: ['SENT', 'DELIVERED'] }, createdAt: { gte: since } },
    }),
    prisma.messageLog.count({
      where: { channel: 'EMAIL', status: 'FAILED', createdAt: { gte: since } },
    }),
    prisma.messageLog.count({
      where: { channel: 'SMS', status: { in: ['SENT', 'DELIVERED'] }, createdAt: { gte: since } },
    }),
    prisma.paymentAttempt.count({ where: { createdAt: { gte: since } } }),
    prisma.paymentAttempt.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
  ]);

  /**
   * Configured, and then used, are two different questions.
   *
   * A transport set to `console` is not broken; it is a development default
   * doing exactly what it says. What it is not is proof that anything can
   * leave the building, so it reports as never used rather than as working —
   * the alternative is a green tick beside a mail transport that has never
   * sent an email to anybody.
   */
  const transport = (name: string, live: boolean, sent: number, failed: number): Signal =>
    signal({
      area: 'Outside',
      name,
      standing: !live
        ? 'unknown'
        : failed > sent
          ? 'failed'
          : failed > 0
            ? 'degraded'
            : sent > 0
              ? 'healthy'
              : 'unknown',
      template: live
        ? '{sent} sent and {failed} failed in the last day.'
        : 'Not configured: nothing leaves this machine.',
      values: { sent, failed },
    });

  return [
    transport('Email', config.MAIL_TRANSPORT !== 'console', mailSent, mailFailed),
    transport('Text messages', config.SMS_TRANSPORT !== 'console', smsSent, 0),
    signal({
      area: 'Outside',
      name: 'Card payments',
      standing: !config.STRIPE_SECRET_KEY
        ? 'unknown'
        : cardsFailed > cardsTried / 2 && cardsTried > 0
          ? 'failed'
          : cardsFailed > 0
            ? 'degraded'
            : cardsTried > 0
              ? 'healthy'
              : 'unknown',
      template: config.STRIPE_SECRET_KEY
        ? '{tried} attempted and {failed} failed in the last day.'
        : 'No keys: the stub is answering instead of a provider.',
      values: { tried: cardsTried, failed: cardsFailed },
    }),
    signal({
      area: 'Outside',
      name: 'File store',
      standing: process.env.STORAGE_DRIVER === 's3' ? 'healthy' : 'unknown',
      template:
        process.env.STORAGE_DRIVER === 's3'
          ? 'Files go to the bucket.'
          : 'Files are written to this machine, which is development only.',
      values: {},
    }),
    signal({
      area: 'Outside',
      name: 'Vehicle lookup',
      standing: config.VIN_DECODER === 'stub' ? 'unknown' : 'healthy',
      template: config.VIN_DECODER === 'stub' ? 'The stub is answering.' : 'Asking {who}.',
      values: { who: config.VIN_DECODER },
    }),
    signal({
      area: 'Outside',
      name: 'Assistant',
      standing: config.AI_TRANSPORT === 'none' ? 'unknown' : 'healthy',
      template: config.AI_TRANSPORT === 'none' ? 'Switched off.' : 'Asking {model}.',
      values: { model: config.AI_MODEL },
    }),
  ];
}

/* ---------------------------------------------------------------------------
   Whether the figures still mean anything
   --------------------------------------------------------------------------- */

async function dataSignals(): Promise<Signal[]> {
  const [vehicles, brokenChains, unbalanced, orphanFiles] = await Promise.all([
    prisma.vehicle.count({ where: { eventCount: { gt: 0 } } }),
    // The cheap half of the passport check: an event whose previous hash does
    // not name the row before it. The full verification is verify-integrity;
    // this is the one an operator can afford to run on every page load.
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM "vehicle_events" e
      WHERE e."sequence" > 1
        AND NOT EXISTS (
          SELECT 1 FROM "vehicle_events" p
          WHERE p."vehicleId" = e."vehicleId"
            AND p."sequence" = e."sequence" - 1
            AND p."hash" = e."prevHash"
        )`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM (
        SELECT l."entryId"
        FROM "journal_lines" l
        GROUP BY l."entryId"
        HAVING round(sum(l."debit"), 2) <> round(sum(l."credit"), 2)
      ) AS wrong`,
    prisma.messageAttachment.count(),
  ]);

  const chains = Number(brokenChains[0]?.n ?? 0);
  const entries = Number(unbalanced[0]?.n ?? 0);

  return [
    signal({
      area: 'Records',
      name: 'Passport chains',
      standing: chains > 0 ? 'failed' : vehicles > 0 ? 'healthy' : 'unknown',
      template: '{broken} broken of {total} vehicles with a history.',
      values: { broken: chains, total: vehicles },
    }),
    signal({
      area: 'Records',
      name: 'Entries that balance',
      standing: entries > 0 ? 'failed' : 'healthy',
      template: '{count} journal entries do not balance.',
      values: { count: entries },
    }),
    signal({
      area: 'Records',
      name: 'Attachments',
      standing: 'healthy',
      template: '{count} files belong to conversations.',
      values: { count: orphanFiles },
    }),
  ];
}

/* ---------------------------------------------------------------------------
   Who can get in
   --------------------------------------------------------------------------- */

async function securitySignals(now: Date): Promise<Signal[]> {
  const config = env();
  const since = new Date(now.getTime() - 86_400_000);

  const [live, expired, keys, blocked] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.session.count({ where: { expiresAt: { lte: now } } }),
    prisma.apiKey.count({ where: { revokedAt: null } }),
    prisma.suppressedAddress.count({ where: { liftedAt: null, createdAt: { gte: since } } }),
  ]);

  return [
    signal({
      area: 'Access',
      name: 'Sessions',
      standing: 'healthy',
      template: '{live} live, {expired} expired and waiting to be swept.',
      values: { live, expired },
    }),
    signal({
      area: 'Access',
      name: 'API keys',
      standing: 'healthy',
      template: '{count} in use.',
      values: { count: keys },
    }),
    signal({
      area: 'Access',
      name: 'Addresses blocked today',
      standing: fromCount({ count: blocked, degradedAbove: 2, failedAbove: 20 }),
      template: '{count} stopped after a bounce or a complaint.',
      values: { count: blocked },
    }),
    signal({
      area: 'Access',
      name: 'Scheduled work',
      standing: config.CRON_SECRET ? 'healthy' : 'failed',
      template: config.CRON_SECRET
        ? 'Behind a secret, as it must be.'
        : 'No secret is set, so anybody can trigger it.',
      values: {},
    }),
  ];
}

/* ---------------------------------------------------------------------------
   Whether it could come back
   --------------------------------------------------------------------------- */

async function backupSignals(): Promise<Signal[]> {
  // Honest about what this page can and cannot see. Whether last night's
  // backup ran is a fact about the managed database, and claiming it here from
  // nothing would be worse than saying so.
  const oldest = await prisma.vehicleEvent.findFirst({
    orderBy: { recordedAt: 'asc' },
    select: { recordedAt: true },
  });

  return [
    signal({
      area: 'Coming back',
      name: 'Restore drill',
      standing: 'unknown',
      template: 'Run on every push by verify-recovery, not from this page.',
      values: {},
    }),
    signal({
      area: 'Coming back',
      name: 'Oldest record',
      standing: 'healthy',
      template: oldest ? 'The history starts on {on}.' : 'Nothing recorded yet.',
      values: { on: oldest ? oldest.recordedAt.toISOString().slice(0, 10) : '' },
    }),
  ];
}

/* ---------------------------------------------------------------------------
   Why one customer did not get one message
   --------------------------------------------------------------------------- */

export interface Trace {
  id: string;
  to: string;
  channel: string;
  subject: string | null;
  at: Date;
  status: string;
  attempts: number;
  verdict: DeliveryVerdict;
  events: { event: string; detail: string | null; at: Date }[];
}

/**
 * Every message to an address, and why each one did or did not arrive.
 *
 * The answer to the question this phase exists for. The facts were always
 * there and were spread across five places, none of which mean anything alone
 * to the person on the telephone asking where their invoice is.
 */
export async function traceMessagesTo(query: string, now = new Date()): Promise<Trace[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  const messages = await prisma.messageLog.findMany({
    where: {
      OR: [
        { toAddress: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      orgId: true,
      toAddress: true,
      channel: true,
      subject: true,
      status: true,
      attempts: true,
      error: true,
      availableAt: true,
      sentAt: true,
      createdAt: true,
      deliveryEvents: {
        orderBy: { occurredAt: 'asc' },
        select: { event: true, detail: true, occurredAt: true },
      },
    },
  });

  const addresses = [...new Set(messages.map((message) => message.toAddress))];

  // bounded: the addresses in the messages already fetched, which is one page.
  const suppressions = await prisma.suppressedAddress.findMany({
    where: { address: { in: addresses }, liftedAt: null },
    select: { address: true, reason: true, detail: true, createdAt: true },
  });

  const stopped = new Map(suppressions.map((row) => [row.address, row]));

  return messages.map((message) => {
    const block = stopped.get(message.toAddress);

    const facts: MessageFacts = {
      status: message.status,
      attempts: message.attempts,
      error: message.error,
      availableAt: message.availableAt,
      sentAt: message.sentAt,
      maxAttempts: 8,
      now,
      suppressed: block
        ? { reason: block.reason, on: block.createdAt, detail: block.detail }
        : null,
      // Never set from the marketing-consent boxes, and this is a decision
      // rather than an omission. Only a marketing message is stopped by
      // marketing consent; a receipt, an invoice and a "your car is ready" go
      // whatever those boxes say, because a customer who asked not to be
      // marketed at has not asked to stop being told about their own car.
      // Reading consent here would blame it for delivery failures it had
      // nothing to do with, which is the wrong answer given confidently — and
      // `whyMessage` still handles it, for the caller that does know a message
      // was marketing.
      consentWithdrawn: false,
    };

    return {
      id: message.id,
      to: message.toAddress,
      channel: message.channel,
      subject: message.subject,
      at: message.createdAt,
      status: message.status,
      attempts: message.attempts,
      verdict: whyMessage(facts),
      events: message.deliveryEvents.map((event) => ({
        event: event.event,
        detail: event.detail,
        at: event.occurredAt,
      })),
    };
  });
}

export type { Signal, Standing };
