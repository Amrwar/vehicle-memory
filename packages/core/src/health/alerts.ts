/**
 * Telling somebody, before a workshop rings. Phase 57.
 *
 * Phase 50 put every signal on a page. A page is the right place to look when
 * you already know something is wrong, and it is no use at all at four in the
 * morning — which is when the queue backs up, the card provider stops
 * answering, and a workshop's Monday quietly stops working while the only
 * person who could fix it is asleep. NFR-806 has asked for alerts since the
 * first week and nothing sent one.
 *
 * Two rules shape everything here, and both come from NFR-807: every alert
 * must be actionable, and an alert with no action is deleted.
 *
 * The first means an alert carries its runbook entry in the message itself —
 * what is wrong, the first thing to do, and what it would mean to have fixed
 * it. A message saying "queue depth degraded" at four in the morning is a
 * message that makes somebody open a laptop to find out whether it matters.
 *
 * The second is enforced rather than promised. A signal with no runbook entry
 * cannot raise an alert at all: it is reported as needing one, and the
 * verification fails until somebody writes it. That is deliberately
 * uncomfortable. The alternative — a signal that fires into a mailbox with
 * nothing to do about it — is how a person learns to ignore the mailbox, and
 * an ignored alert is worse than none, because it looks like cover.
 */

import type { Signal, Standing } from './signals';

/* ---------------------------------------------------------------------------
   The runbook
   --------------------------------------------------------------------------- */

export interface Runbook {
  /** The signal's name, exactly as the health page reports it. */
  signal: string;
  /** What has actually gone wrong, for somebody who has just woken up. */
  meaning: string;
  /** The first thing to do. One thing, not a list. */
  first: string;
  /** What it would mean to have fixed it, so nobody stops halfway. */
  done: string;
  /**
   * How bad it has to be before anybody is woken.
   *
   * Most things are only worth a message when they have failed outright. A
   * handful matter while they are still merely degraded, because by the time
   * they fail a workshop has already had the morning.
   *
   * `never` is for a signal that reports a fact rather than a condition: how
   * old the oldest record is, or where the restore drill runs. Those cannot go
   * wrong and there is nothing to do about them, so they are written down as
   * deliberately silent rather than left out — an entry saying "this never
   * wakes anybody, and here is why" is a decision somebody made, and a missing
   * entry is a gap nobody has noticed. Nothing can tell the two apart unless
   * they are written differently.
   */
  wakeOn: 'failed' | 'degraded' | 'never';
}

/**
 * What to do about each thing that can go wrong.
 *
 * Written for a person at four in the morning who did not build this, so each
 * entry says what it means rather than what it is, and names one action rather
 * than describing the subsystem.
 */
export const RUNBOOK: readonly Runbook[] = [
  /* --- the machine -------------------------------------------------------- */
  {
    signal: 'Database',
    meaning: 'The application cannot reach the database, so nothing works for anybody.',
    first:
      'Check the database provider’s status page, then the connection string in the deployment.',
    done: 'The health page shows the database answering, and a workshop can open a job.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Migrations',
    meaning:
      'The database schema is not the one this build expects. Pages will fail in ways that look random.',
    first: 'Run prisma migrate deploy against the production database and read what it says.',
    done: 'Every migration is applied and the health page agrees.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Clock',
    meaning: 'The server’s clock has drifted, which makes every timestamp and every expiry wrong.',
    first: 'Check the host’s time synchronisation. Nothing in the product can correct this.',
    done: 'The clock is within a second of true.',
    wakeOn: 'failed',
  },
  {
    signal: 'Workshops',
    meaning: 'No workshop exists on this deployment, which on a live one means data is missing.',
    first: 'Confirm you are looking at the right database before touching anything.',
    done: 'The workshops that should be there are there.',
    wakeOn: 'failed',
  },

  /* --- the workers -------------------------------------------------------- */
  {
    signal: 'Events waiting',
    meaning:
      'The outbox is not being drained, so nothing that depends on it is happening: no messages, no passport events, no automation.',
    first: 'Check that the dispatch cron is still firing, then run it by hand and watch the count.',
    done: 'The oldest waiting event is under five minutes old.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Messages due and not gone',
    meaning:
      'Messages are due and have not left. Customers are not being told their cars are ready.',
    first: 'Look at one of them on the health page: it will say why it has not gone.',
    done: 'Nothing is due and unsent.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Messages that failed today',
    meaning:
      'Messages are being refused by the provider. Every one of them is a customer who heard nothing.',
    first: 'Search one recipient on the health page; the reason is on the message.',
    done: 'The failure count stops rising, and the ones that failed have been sent again or explained.',
    wakeOn: 'failed',
  },

  /* --- the outside world --------------------------------------------------- */
  {
    signal: 'Email',
    meaning:
      'Email is failing more often than it is succeeding. Every failure is a customer who was not told something.',
    first: 'Check the mail provider’s dashboard for the reason it is refusing.',
    done: 'Messages send again, and the ones that failed have been sent or explained.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Text messages',
    meaning:
      'Text messages are failing. Reminders and ready-for-collection notices are the ones that matter here.',
    first: 'Check the sending provider’s balance and its dashboard.',
    done: 'Texts send again.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Card payments',
    meaning: 'Card payments are not completing. Money a workshop has taken may not be recorded.',
    first:
      'Check the provider’s status, then look for attempts stuck at pending on the health page.',
    done: 'A test attempt completes and lands as a payment.',
    wakeOn: 'degraded',
  },
  {
    signal: 'File store',
    meaning:
      'Photographs are not reaching the store, so inspections are being done without evidence.',
    first: 'Check the store’s credentials and whether the bucket still exists.',
    done: 'verify-storage passes against the live deployment.',
    wakeOn: 'failed',
  },
  {
    signal: 'Vehicle lookup',
    meaning:
      'VIN decoding is unavailable. Work continues — a car can be booked in by hand — but every arrival is slower.',
    first: 'Check the provider. Nothing needs doing in the product; it degrades on purpose.',
    done: 'Lookups answer again.',
    wakeOn: 'failed',
  },
  {
    signal: 'Assistant',
    meaning: 'The assistant is unavailable. Nothing a workshop must do depends on it.',
    first: 'Check the provider key and quota. This can wait until morning.',
    done: 'The assistant answers again.',
    wakeOn: 'failed',
  },

  /* --- the records --------------------------------------------------------- */
  {
    signal: 'Passport chains',
    meaning:
      'A vehicle’s history does not verify. This is the product’s central claim and it is the most serious thing on this list.',
    first:
      'Do not write anything further. Run verify-integrity and find which vehicle and which event.',
    done: 'Every chain verifies, and there is a written account of what broke it.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Entries that balance',
    meaning: 'The ledger does not balance. Somebody’s books are wrong.',
    first: 'Run the books audit for the workshop concerned; it names the entry and the amount.',
    done: '/books is green and the difference is accounted for to the penny.',
    wakeOn: 'degraded',
  },
  {
    signal: 'Attachments',
    meaning: 'Records point at files that are not in the store, so evidence is missing.',
    first: 'Run the storage sweep to list what is referenced and missing.',
    done: 'Every reference resolves, or the ones that cannot are recorded as lost.',
    wakeOn: 'failed',
  },

  /* --- who can get in ------------------------------------------------------ */
  {
    signal: 'Sessions',
    meaning: 'An unusual number of sessions are live, which may be ordinary or may be an attack.',
    first: 'Look at the sign-in rate and the addresses behind it before revoking anything.',
    done: 'The figure is explained, or the sessions concerned have been ended.',
    wakeOn: 'failed',
  },
  {
    signal: 'API keys',
    meaning: 'Something is wrong with the keys other systems use to read passports.',
    first: 'Check which keys are live and when each was last used.',
    done: 'Every live key is one somebody meant to issue.',
    wakeOn: 'failed',
  },
  {
    signal: 'Addresses blocked today',
    meaning:
      'Addresses are being suppressed after bounces or complaints, which usually means a bad import or a provider problem.',
    first: 'Look at what was sent just before the bounces started.',
    done: 'The cause is known and the sending has stopped or been corrected.',
    wakeOn: 'failed',
  },
  {
    signal: 'Scheduled work',
    meaning:
      'The scheduled jobs are not behind a secret, so anybody on the internet can trigger them.',
    first:
      'Set CRON_SECRET in the deployment and redeploy. This is not something to leave until morning.',
    done: 'The health page says the schedule is behind a secret.',
    wakeOn: 'degraded',
  },

  /* --- facts rather than conditions, and deliberately silent ---------------- */
  {
    signal: 'Restore drill',
    meaning:
      'Whether a restore has been rehearsed. This page cannot see it; verify-recovery runs it on every push and would fail there.',
    first: 'Nothing here. If you want the answer now, read the last run of verify-recovery.',
    done: 'Not applicable: this says where the answer lives, rather than reporting a condition.',
    wakeOn: 'never',
  },
  {
    signal: 'Oldest record',
    meaning: 'How far back the history goes. A fact about the data, not a condition of the system.',
    first: 'Nothing here. It exists because an operator asked how much history there is.',
    done: 'Not applicable: it reports a date, and a date cannot be wrong in a way anybody can fix.',
    wakeOn: 'never',
  },
];

const BY_NAME = new Map(RUNBOOK.map((entry) => [entry.signal, entry]));

export function runbookFor(name: string): Runbook | null {
  return BY_NAME.get(name) ?? null;
}

/* ---------------------------------------------------------------------------
   What is worth sending
   --------------------------------------------------------------------------- */

export type AlertKind = 'raised' | 'worse' | 'cleared';

export interface Alert {
  /** The signal's name, which is also how it is remembered between runs. */
  key: string;
  kind: AlertKind;
  standing: Standing;
  runbook: Runbook;
  /** The signal's own sentence, in plain English. */
  sentence: string;
}

const RANK: Record<Standing, number> = { healthy: 0, unknown: 0, degraded: 1, failed: 2 };

/** Whether a signal is bad enough, given what its runbook says would wake somebody. */
export function badEnough(standing: Standing, wakeOn: Runbook['wakeOn']): boolean {
  if (wakeOn === 'never') return false;
  return RANK[standing] >= (wakeOn === 'degraded' ? 1 : 2);
}

/**
 * What a signal was, last time anybody looked.
 *
 * `null` for a signal nobody has ever alerted on. `sentAt` is when a message
 * actually went, not when the state was written: a state that was recorded but
 * never sent must still send.
 */
export interface Remembered {
  key: string;
  standing: Standing;
  sentAt: Date | null;
}

/**
 * How long a raised alert stays quiet before saying the same thing again.
 *
 * Six hours, which is a judgement rather than a measurement: long enough that
 * a thing broken overnight produces one message and not six, short enough that
 * a thing still broken at lunchtime says so again. The exception is a signal
 * that gets worse, which sends immediately whatever the clock says, because
 * "degraded" and "failed" are different news.
 */
export const QUIET_FOR_MS = 6 * 60 * 60 * 1000;

export interface AlertDecision {
  alerts: Alert[];
  /**
   * Signals that have gone wrong and have no runbook entry.
   *
   * Not sent, on purpose. NFR-807 says an alert with no action is deleted, and
   * the honest reading of that is that a signal nobody can act on must not
   * become a message — it must become an entry somebody writes.
   */
  unexplained: string[];
}

/**
 * Which signals are worth a message now.
 *
 * Takes what the health page currently says and what was remembered from last
 * time, and returns only the differences worth waking somebody for.
 */
export function decideAlerts(input: {
  signals: readonly Signal[];
  remembered: readonly Remembered[];
  now: Date;
  quietForMs?: number;
}): AlertDecision {
  const quiet = input.quietForMs ?? QUIET_FOR_MS;
  const before = new Map(input.remembered.map((one) => [one.key, one]));
  const alerts: Alert[] = [];
  const unexplained: string[] = [];

  for (const one of input.signals) {
    const entry = runbookFor(one.name);
    const was = before.get(one.name) ?? null;

    // Something a person can do nothing about is not an alert. It is a gap in
    // the runbook, and it is reported as one.
    if (!entry) {
      if (badEnough(one.standing, 'failed')) unexplained.push(one.name);
      continue;
    }

    const bad = badEnough(one.standing, entry.wakeOn);
    const wasBad = was ? badEnough(was.standing, entry.wakeOn) : false;

    if (!bad) {
      // Back to normal, and only once: a signal that was never announced has
      // nothing to announce the end of.
      if (wasBad && was?.sentAt) {
        alerts.push({
          key: one.name,
          kind: 'cleared',
          standing: one.standing,
          runbook: entry,
          sentence: one.sentence,
        });
      }
      continue;
    }

    // Worse than it was. Sent whatever the quiet period says, because
    // "degraded" and "failed" are different news about the same thing.
    if (was && RANK[one.standing] > RANK[was.standing]) {
      alerts.push({
        key: one.name,
        kind: 'worse',
        standing: one.standing,
        runbook: entry,
        sentence: one.sentence,
      });
      continue;
    }

    const quietUntil = was?.sentAt ? was.sentAt.getTime() + quiet : 0;
    if (input.now.getTime() < quietUntil) continue;

    alerts.push({
      key: one.name,
      kind: 'raised',
      standing: one.standing,
      runbook: entry,
      sentence: one.sentence,
    });
  }

  return { alerts, unexplained: unexplained.sort() };
}

/* ---------------------------------------------------------------------------
   What it says
   --------------------------------------------------------------------------- */

/** The subject line, which is the part read on a telephone at four in the morning. */
export function alertSubject(alert: Alert): string {
  if (alert.kind === 'cleared') return `Carnet recovered: ${alert.key}`;
  const how = alert.standing === 'failed' ? 'failed' : 'degraded';
  return `Carnet ${how}: ${alert.key}`;
}

/**
 * The message.
 *
 * Deliberately in this order: what is wrong, what it means, the one thing to
 * do, and what done looks like. Somebody reading it on a telephone in the dark
 * should be able to act on the first three lines and never open the laptop if
 * the answer is "this can wait".
 */
export function alertBody(alert: Alert, where: string): string {
  if (alert.kind === 'cleared') {
    return [
      `${alert.key} is back to normal.`,
      '',
      alert.sentence,
      '',
      `Nothing to do. ${where}`,
      '',
      'Carnet',
    ].join('\n');
  }

  return [
    `${alert.key} is ${alert.standing}.`,
    '',
    alert.sentence,
    '',
    `What it means:  ${alert.runbook.meaning}`,
    `First thing:    ${alert.runbook.first}`,
    `Fixed when:     ${alert.runbook.done}`,
    '',
    where,
    '',
    'Carnet',
  ].join('\n');
}

/** Every signal name the runbook has an entry for. */
export function explained(): string[] {
  return RUNBOOK.map((entry) => entry.signal).sort();
}
