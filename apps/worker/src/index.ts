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
 *   4. Drive automation: turn a service falling due into a reminder somebody
 *      can act on, and carry out the actions rules have already queued.
 *   5. Send. Everything upstream writes a row to `message_logs`; this is the
 *      only thing in the product that hands one to a provider.
 *
 * The fourth is the one that acts without a person in the room, so it is
 * written the most defensively. Nothing here decides whether a rule should
 * fire; that lives in the domain layer and is tested there. This file only
 * carries out decisions already made, and records what it did.
 */

import 'dotenv/config';

import {
  type Action,
  type ConsentState,
  evaluate,
  mayNotify,
  projectServiceDue,
  type Rule,
  schedule as scheduleActions,
  verifyChain,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { sendQueuedMessages, TRANSPORTS } from './messages';

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
    include: {
      vehicle: {
        select: {
          lastOdometerKm: true,
          // The most recent job is how a vehicle reaches a customer: a vehicle
          // belongs to a VIN, not to any one workshop's address book.
          jobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              customer: {
                select: {
                  id: true,
                  email: true,
                  mobile: true,
                  marketingEmailConsent: true,
                  marketingSmsConsent: true,
                },
              },
            },
          },
        },
      },
    },
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

    // The reminder has to reach somebody, and it has to give them somewhere to
    // go. A message saying a service is due that offers no way to book it puts
    // the work back on the customer to ring during opening hours, which is
    // exactly where the appointment gets lost.
    const owner = schedule.vehicle.jobs[0]?.customer ?? null;

    if (owner && schedule.orgId) {
      // Transactional: it is about their own vehicle, so marketing consent
      // does not gate it. Only the absence of an address does.
      const decision = mayNotify({ channel: 'EMAIL', consent: consentOf(owner) });

      if (decision.allowed) {
        await prisma.messageLog.create({
          data: {
            orgId: schedule.orgId,
            channel: 'EMAIL',
            toAddress: owner.email ?? '',
            subject: schedule.name + ' is due on your vehicle',
            body:
              schedule.name +
              ' is coming due. Pick a time that suits you at /portal/book and we will have the parts ready.',
            status: 'QUEUED',
            relatedType: 'ServiceSchedule',
            relatedId: schedule.id,
          },
        });
      }

      await fireEvent({
        orgId: schedule.orgId,
        event: 'service.due',
        subjectType: 'ServiceSchedule',
        subjectId: schedule.id,
        customerId: owner.id,
        facts: { 'vehicle.mileage': schedule.vehicle.lastOdometerKm ?? 0 },
      });
    }

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
   Automation
   --------------------------------------------------------------------------- */

function consentOf(customer: {
  email: string | null;
  mobile: string | null;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
}): ConsentState {
  return {
    email: customer.marketingEmailConsent,
    sms: customer.marketingSmsConsent,
    hasEmail: Boolean(customer.email),
    hasMobile: Boolean(customer.mobile),
  };
}

/**
 * Runs one event past every rule listening for it, and queues what fires.
 *
 * Written against Prisma here rather than shared with the web application,
 * which is the convention this worker already follows: the domain layer holds
 * every decision and each caller does its own recording. The two call sites
 * genuinely differ, because the web one writes an audit entry against the
 * person who caused the event and there is no person here.
 */
async function fireEvent(input: {
  orgId: string;
  event: Rule['trigger'];
  subjectType: string;
  subjectId: string;
  customerId?: string | null;
  facts: Record<string, number>;
}): Promise<number> {
  const now = new Date();

  const rows = await prisma.automationRule.findMany({
    where: { orgId: input.orgId, trigger: input.event, isActive: true },
  });

  let fired = 0;

  for (const row of rows) {
    const rule: Rule = {
      id: row.id,
      name: row.name,
      trigger: row.trigger as Rule['trigger'],
      conditions: (row.conditions ?? []) as unknown as Rule['conditions'],
      actions: (row.actions ?? []) as unknown as Action[],
      isActive: row.isActive,
      cooldownHours: row.cooldownHours,
    };

    const previous = await prisma.automationRun.findFirst({
      where: {
        ruleId: rule.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        blockedBy: null,
      },
      orderBy: { firedAt: 'desc' },
      select: { firedAt: true },
    });

    const decision = evaluate(rule, input.facts, {
      event: input.event,
      now,
      lastRunAt: previous?.firedAt ?? null,
    });

    // The run is written either way. A rule that has been quietly failing a
    // condition for a fortnight looks identical, from outside, to one nobody
    // has triggered, and the two need completely different responses.
    const run = await prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        customerId: input.customerId ?? null,
        firedAt: now,
        blockedBy: decision.fires ? null : (decision.blockedBy?.field ?? 'rule'),
        reason: decision.fires ? null : decision.reason,
      },
    });

    if (!decision.fires) continue;

    await prisma.automationAction.createMany({
      data: scheduleActions(decision.actions, now).map((planned) => ({
        runId: run.id,
        kind: planned.action.kind,
        target: planned.action.target,
        dueAt: planned.dueAt,
      })),
    });

    fired += 1;
  }

  return fired;
}

/**
 * Carries out the actions rules queued once their delay has passed.
 *
 * Every message written here is transactional: it concerns work on the
 * customer's own vehicle, so it goes to the address they gave rather than
 * being gated on marketing consent. That distinction belongs to the domain
 * layer, which is why mayNotify is asked rather than a flag being read.
 *
 * A failure marks the row FAILED with its reason and moves on. Retrying a
 * message forever is how one bad address becomes forty sends.
 */
async function runDueAutomationActions(): Promise<number> {
  const due = await prisma.automationAction.findMany({
    where: { status: 'PENDING', dueAt: { lte: new Date() } },
    orderBy: { dueAt: 'asc' },
    take: BATCH_SIZE,
    include: { run: { include: { rule: { select: { orgId: true, name: true } } } } },
  });

  let done = 0;

  for (const action of due) {
    try {
      const customer = action.run.customerId
        ? await prisma.customer.findUnique({
            where: { id: action.run.customerId },
            select: {
              email: true,
              mobile: true,
              marketingEmailConsent: true,
              marketingSmsConsent: true,
            },
          })
        : null;

      if (action.kind !== 'send.email' && action.kind !== 'send.sms') {
        // Tasks and tags stay inside the building, so there is nothing that
        // can fail on the way out.
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'DONE', doneAt: new Date() },
        });
        done += 1;
        continue;
      }

      const channel = action.kind === 'send.email' ? 'EMAIL' : 'SMS';

      if (!customer) {
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'FAILED', error: 'The rule fired about nobody in particular.' },
        });
        continue;
      }

      const decision = mayNotify({ channel, consent: consentOf(customer) });

      if (!decision.allowed) {
        await prisma.automationAction.update({
          where: { id: action.id },
          data: { status: 'FAILED', error: decision.reason },
        });
        continue;
      }

      const message = await prisma.messageLog.create({
        data: {
          orgId: action.run.rule.orgId,
          channel,
          toAddress: (channel === 'EMAIL' ? customer.email : customer.mobile) ?? '',
          subject: action.target,
          body: action.target,
          status: 'QUEUED',
          relatedType: 'AutomationAction',
          relatedId: action.id,
        },
      });

      await prisma.automationAction.update({
        where: { id: action.id },
        data: { status: 'DONE', doneAt: new Date(), messageId: message.id },
      });

      done += 1;
    } catch (error) {
      await prisma.automationAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (done > 0) log('automation.actions.done', { count: done });
  return done;
}

/* ---------------------------------------------------------------------------
   Loop
   --------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tick(iteration: number): Promise<void> {
  await dispatchOutbox();

  // Every poll. A queued action is already late once its delay has passed, and
  // that delay was somebody's deliberate choice.
  await runDueAutomationActions();

  // Then send whatever that produced, in the same tick, so a message written
  // this second goes out this second rather than on the next pass.
  await sendQueuedMessages();

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
  // The transports are named on start-up because "console" in production is
  // the difference between a workshop's reminders going out and being written
  // to a log nobody reads, and it is otherwise invisible.
  log('worker.started', {
    pollMs: POLL_INTERVAL_MS,
    batch: BATCH_SIZE,
    mail: TRANSPORTS.EMAIL.name,
    sms: TRANSPORTS.SMS.name,
  });

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
