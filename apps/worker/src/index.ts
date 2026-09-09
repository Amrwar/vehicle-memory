/**
 * Carnet background worker.
 *
 *   npm run worker
 *
 * Three responsibilities, all of which exist so that nothing downstream can
 * block the shop floor:
 *
 *   1. Dispatch the transactional outbox (ADR-0007). At-least-once, so every
 *      handler must be idempotent.
 *   2. Close time entries left open past the end of a shift, so a tablet left
 *      logged in does not book fourteen hours of labour cost.
 *   3. Audit vehicle chains on a rolling basis, so tampering is detected
 *      rather than waited for.
 */

import 'dotenv/config';

import { projectServiceDue, verifyChain } from '@carnet/core';
import { prisma } from '@carnet/db';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS ?? 5_000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH ?? 25);
const MAX_ATTEMPTS = 8;
const SHIFT_END_HOUR = Number(process.env.WORKER_SHIFT_END_HOUR ?? 19);
const SALT = process.env.LEDGER_CHAIN_SALT ?? '';

let running = true;

function log(event: string, detail: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...detail }));
}

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

async function dispatchOutbox(): Promise<number> {
  const due = await prisma.outboxEvent.findMany({
    where: { processedAt: null, availableAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
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
        data: { processedAt: new Date(), attempts: event.attempts + 1 },
      });
      handled += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);

      // Exponential backoff, capped. A poison message eventually stops
      // competing for the batch with events that can succeed.
      const backoffMs = Math.min(2 ** attempts * 1_000, 15 * 60_000);

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts,
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

/* ---------------------------------------------------------------------------
   Open time entries
   --------------------------------------------------------------------------- */

async function closeAbandonedTimeEntries(): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(SHIFT_END_HOUR, 0, 0, 0);

  if (new Date() < cutoff) return 0;

  const open = await prisma.timeEntry.findMany({
    where: { endedAt: null, startedAt: { lt: cutoff } },
    select: { id: true, startedAt: true },
  });

  for (const entry of open) {
    const minutes = Math.max(
      0,
      Math.round((cutoff.getTime() - entry.startedAt.getTime()) / 60_000),
    );

    // Flagged rather than silently accepted: an auto-closed entry is a guess
    // about how long the work took, and a manager should see that.
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt: cutoff, minutes, autoClosed: true },
    });
  }

  if (open.length > 0) log('timeentries.autoclosed', { count: open.length });
  return open.length;
}

/* ---------------------------------------------------------------------------
   Chain audit
   --------------------------------------------------------------------------- */

let auditCursor = 0;

async function auditChains(sample = 20): Promise<void> {
  if (!SALT) return;

  const vehicles = await prisma.vehicle.findMany({
    where: { eventCount: { gt: 0 } },
    orderBy: { id: 'asc' },
    skip: auditCursor,
    take: sample,
    select: { id: true, vin: true },
  });

  if (vehicles.length === 0) {
    auditCursor = 0;
    return;
  }

  auditCursor += vehicles.length;

  for (const vehicle of vehicles) {
    const events = await prisma.vehicleEvent.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { sequence: 'asc' },
    });

    const result = verifyChain(events as never, SALT);

    if (!result.valid) {
      // Critical. See the runbook: do not repair the chain.
      console.error(
        JSON.stringify({
          time: new Date().toISOString(),
          level: 'error',
          event: 'chain.verification.failed',
          vin: vehicle.vin,
          vehicleId: vehicle.id,
          failedAt: result.failedAt,
        }),
      );
    }
  }
}

/* ---------------------------------------------------------------------------
   Service reminders
   --------------------------------------------------------------------------- */

async function queueServiceReminders(): Promise<number> {
  const horizon = new Date(Date.now() + 14 * 86_400_000);

  const due = await prisma.serviceSchedule.findMany({
    where: {
      isActive: true,
      reminderSentAt: null,
      OR: [{ dueAt: { lte: horizon } }, { dueKm: { not: null } }],
    },
    include: { vehicle: { select: { lastOdometerKm: true } } },
    take: 50,
  });

  let queued = 0;

  for (const schedule of due) {
    const projection = projectServiceDue({
      lastPerformedAt: schedule.lastPerformedAt,
      lastPerformedKm: schedule.lastPerformedKm,
      intervalMonths: schedule.intervalMonths,
      intervalKm: schedule.intervalKm,
      currentKm: schedule.vehicle.lastOdometerKm,
      kmPerDay: null,
    });

    if (!projection.projectedDueAt || projection.projectedDueAt > horizon) continue;

    await prisma.serviceSchedule.update({
      where: { id: schedule.id },
      data: { reminderSentAt: new Date() },
    });
    queued += 1;
  }

  if (queued > 0) log('reminders.queued', { count: queued });
  return queued;
}

/* ---------------------------------------------------------------------------
   Loop
   --------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tick(iteration: number): Promise<void> {
  await dispatchOutbox();

  // Every minute at the default interval.
  if (iteration % 12 === 0) {
    await closeAbandonedTimeEntries();
    await auditChains();
  }

  // Every hour.
  if (iteration % 720 === 0) {
    await queueServiceReminders();
  }
}

async function main(): Promise<void> {
  log('worker.started', { pollMs: POLL_INTERVAL_MS, batch: BATCH_SIZE });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      log('worker.stopping', { signal });
      running = false;
    });
  }

  let iteration = 0;

  while (running) {
    try {
      await tick(iteration);
    } catch (error) {
      // A failed tick must never kill the worker. The next one retries.
      console.error(
        JSON.stringify({
          time: new Date().toISOString(),
          level: 'error',
          event: 'worker.tick.failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    iteration += 1;
    await sleep(POLL_INTERVAL_MS);
  }

  await prisma.$disconnect();
  log('worker.stopped');
}

main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
