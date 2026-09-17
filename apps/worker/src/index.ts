/**
 * Carnet background worker, for development.
 *
 *   npm run worker
 *
 * A loop around `@carnet/jobs`. It holds no logic of its own: everything it
 * calls is the same code the scheduled requests call in production, because
 * the alternative is two implementations of the same work and only one of them
 * getting fixed.
 *
 * This exists because a five-second poll is what you want while building.
 * Production runs the same functions on a schedule instead, since the
 * application is hosted somewhere that cannot hold a loop open and a second
 * server existing only to hold one would be a second thing to deploy, pay for
 * and watch.
 */

import 'dotenv/config';

import {
  auditChains,
  closeAbandonedTimeEntries,
  dispatchOutbox,
  log,
  queueServiceReminders,
  remindTrialsEnding,
  runDueAutomationActions,
  sendQueuedMessages,
  TRANSPORTS,
} from '@carnet/jobs';
import { prisma } from '@carnet/db';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS ?? 5_000);

let running = true;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One pass.
 *
 * The cadences are the same ones the production schedule uses, so a job that
 * misbehaves at one frequency misbehaves the same way in both places.
 */
async function tick(iteration: number): Promise<void> {
  await dispatchOutbox();
  await runDueAutomationActions();

  // Straight after, in the same pass, so a message written this second goes
  // out this second rather than on the next one.
  await sendQueuedMessages();

  // Every minute at the default interval.
  if (iteration % 12 === 0) {
    await closeAbandonedTimeEntries();
    await auditChains();
  }

  // Every hour.
  //
  // Not the whole hourly job. Two pieces of it — catching up the consequences
  // of a payment that a crash interrupted, and the automation triggers that
  // are conditions rather than events — live in the web application, because
  // they are written against its own libraries, and this process cannot
  // import them. In production both run: the scheduler calls
  // /api/cron/hourly, which runs everything. In development, reach that route
  // to exercise them.
  if (iteration % 720 === 0) {
    await queueServiceReminders();
    await remindTrialsEnding();
  }
}

async function main(): Promise<void> {
  // The transports are named on start-up because "console" in production is
  // the difference between a workshop's reminders going out and being written
  // to a log nobody reads, and it is otherwise invisible.
  log('worker.started', {
    pollMs: POLL_INTERVAL_MS,
    mail: TRANSPORTS.EMAIL.name,
    whatsapp: TRANSPORTS.WHATSAPP.name,
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
      // A failed pass must not stop the loop. Whatever went wrong will still
      // be there next time, and everything in the package is safe to retry.
      log('worker.tick.failed', {
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    iteration += 1;
    await sleep(POLL_INTERVAL_MS);
  }

  await prisma.$disconnect();
  log('worker.stopped', { iterations: iteration });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
