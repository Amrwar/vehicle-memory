import {
  auditChains,
  closeAbandonedTimeEntries,
  dispatchOutbox,
  log,
  queueServiceReminders,
  runDueAutomationActions,
  sendQueuedMessages,
} from '@carnet/jobs';
import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * The background work, driven by a schedule instead of a loop.
 *
 * The application is hosted somewhere that cannot hold a process open, so
 * there is nowhere for a five-second poll to live. A second server existing
 * only to hold one would be a second thing to deploy, pay for and watch, for a
 * product whose slowest job runs hourly and whose fastest needs to be prompt
 * rather than instant.
 *
 * This calls exactly the same functions the development worker calls. There is
 * one implementation of every job and two ways of triggering it, because two
 * implementations means one of them quietly stops matching the other.
 *
 * Overlap is fine and is expected. A schedule can fire while the previous run
 * is still going, a deploy can land mid-batch, and a retry can arrive twice.
 * Every job claims what it is working on before it works on it, which is why
 * the sweeper marks a message as attempted before handing it to a provider
 * rather than after.
 */

// Node, not edge: these jobs open a database connection and, for SMTP, a
// socket. Neither is available in the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Long enough for a full batch, short enough to be killed if it hangs. */
export const maxDuration = 60;

type Job = 'dispatch' | 'hourly';

const JOBS: Record<Job, () => Promise<Record<string, number>>> = {
  /**
   * Everything that should feel prompt.
   *
   * The order matters. Automation queues actions, actions become messages, and
   * messages are sent, so running them in sequence means work created in this
   * pass goes out in this pass rather than waiting for the next one.
   */
  dispatch: async () => {
    const outbox = await dispatchOutbox();
    const actions = await runDueAutomationActions();
    const messages = await sendQueuedMessages();

    return { outbox, actions, messages };
  },

  /**
   * Everything that only needs doing occasionally.
   *
   * Reminders look a fortnight ahead, so the hour they are queued in does not
   * matter. The chain audit is deliberately a sample: it covers the whole
   * database over days rather than reading all of it at once.
   */
  hourly: async () => {
    const shifts = await closeAbandonedTimeEntries();
    await auditChains();
    const reminders = await queueServiceReminders();

    return { shifts, reminders };
  },
};

/**
 * Whether this request is really from the scheduler.
 *
 * These routes send messages to customers and close people's timesheets, so an
 * open URL would let anybody on the internet trigger both. The comparison is
 * constant-time because the alternative leaks the secret one character at a
 * time to anybody willing to measure.
 */
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // No secret set is a refusal, not a free pass. A misconfigured deployment
  // must fail closed.
  if (!secret) return false;

  const offered = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(offered);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest, context: { params: Promise<{ job: string }> }) {
  const { job } = await context.params;

  if (!authorised(request)) {
    // Deliberately says nothing about whether the job exists. An unauthorised
    // caller learns only that they are unauthorised.
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const run = JOBS[job as Job];

  if (!run) {
    return NextResponse.json(
      { error: `There is no "${job}" job. There is ${Object.keys(JOBS).join(' and ')}.` },
      { status: 404 },
    );
  }

  const started = Date.now();

  try {
    const counts = await run();
    const ms = Date.now() - started;

    log('cron.ran', { job, ms, ...counts });

    return NextResponse.json({ job, ms, ...counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    log('cron.failed', { job, ms: Date.now() - started, error: message });

    // A 500 so the platform records the failure and shows it in the dashboard.
    // A job that fails silently is how a queue stops draining for a week.
    return NextResponse.json({ job, error: message }, { status: 500 });
  }
}
