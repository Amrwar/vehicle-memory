import { prisma } from '@carnet/db';

import { claimOutbox } from './claim';
import { log } from './log';

/**
 * The work that happens without anybody asking for it.
 *
 * A package rather than part of the worker, because there are two ways to run
 * this and both have to run exactly the same code. Locally it is a process
 * polling every few seconds, which is what you want while building. In
 * production it is a scheduled request, because the application is hosted
 * somewhere that cannot hold a loop open, and a second server existing only to
 * hold one is a second thing to deploy, pay for and watch.
 *
 * Every function here is safe to call concurrently and safe to call again. The
 * two drivers can overlap, a schedule can fire twice, and a deploy can land
 * mid-batch. Each one claims what it is working on before it works on it —
 * see claim.ts, which is where that sentence became true rather than
 * aspirational. Phase 46.
 */

const BATCH_SIZE = Number(process.env.WORKER_BATCH ?? 25);
const MAX_ATTEMPTS = 8;

/* ---------------------------------------------------------------------------
   Outbox
   --------------------------------------------------------------------------- */

type Handler = (payload: Record<string, unknown>) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  'job.completed': async (payload) => {
    // The passport write happens in the same transaction as job completion,
    // so by the time this runs the events already exist. What remains is the
    // customer-facing consequence.
    log('job.completed.handled', { jobId: payload.jobId });
  },

  'estimate.sent': async (payload) => {
    log('estimate.sent.handled', { estimateId: payload.estimateId });
  },

  'estimate.decided': async (payload) => {
    log('estimate.decided.handled', {
      estimateId: payload.estimateId,
      decision: payload.decision,
    });
  },

  'invoice.issued': async (payload) => {
    log('invoice.issued.handled', { invoiceId: payload.invoiceId });
  },

  'payment.received': async (payload) => {
    log('payment.received.handled', { paymentId: payload.paymentId });
  },
};

export async function dispatchOutbox(): Promise<number> {
  // Claimed before it is read, so an overlapping worker steps over these
  // rows rather than handling them a second time. The claim also counts the
  // attempt: an event that takes the process down with it runs out of tries
  // like any other, instead of being retried for ever by whoever restarts.
  const claimed = await claimOutbox(BATCH_SIZE);
  if (claimed.length === 0) return 0;

  const due = await prisma.outboxEvent.findMany({
    where: { id: { in: claimed } },
    orderBy: { createdAt: 'asc' },
  });

  let handled = 0;

  for (const event of due) {
    const handler = HANDLERS[event.type];

    if (!handler) {
      // An unknown type is a deployment skew, not data corruption. Park it
      // rather than retrying forever.
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          processedAt: new Date(),
          lastError: `No handler registered for "${event.type}"`,
        },
      });
      log('outbox.unhandled', { id: event.id, type: event.type });
      continue;
    }

    try {
      await handler((event.payload ?? {}) as Record<string, unknown>);
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      handled += 1;
    } catch (error) {
      // Already counted at the claim; this is what that attempt came to.
      const attempts = event.attempts;
      const message = error instanceof Error ? error.message : String(error);

      // Exponential backoff, capped. A poison message eventually stops
      // competing for the batch with events that can succeed.
      const backoffMs = Math.min(2 ** attempts * 1_000, 15 * 60_000);

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          lastError: message,
          availableAt: new Date(Date.now() + backoffMs),
          ...(attempts >= MAX_ATTEMPTS ? { processedAt: new Date() } : {}),
        },
      });

      log('outbox.failed', {
        id: event.id,
        type: event.type,
        attempts,
        exhausted: attempts >= MAX_ATTEMPTS,
        error: message,
      });
    }
  }

  return handled;
}
