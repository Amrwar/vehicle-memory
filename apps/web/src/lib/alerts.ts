import {
  type Alert,
  alertBody,
  alertSubject,
  decideAlerts,
  explained,
  type Remembered,
  runbookFor,
  type Signal,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { siteUrl } from './credentials';
import { systemHealth } from './health';
import { tellOperator } from './operator';

/**
 * Telling the operator before a workshop rings. Phase 57. NFR-805 to NFR-807.
 *
 * The health page has existed since Phase 50 and is exactly the right thing to
 * look at once you know something is wrong. This is the part that makes you
 * know — one message, to the one address, with the one thing to do in it.
 *
 * It runs on the hourly sweep rather than on a schedule of its own, because a
 * separate schedule is a second thing that can stop without anybody noticing,
 * and an alerting system that has quietly died is worse than none.
 */

/** Everything the health page says, and what has already been said about it. */
async function remembered(): Promise<Remembered[]> {
  const rows = await prisma.operatorAlert.findMany({
    // bounded: one row per signal the health page can report, which is a list
    // written in the runbook rather than a number that grows with use.
    select: { key: true, standing: true, sentAt: true },
  });

  return rows.map((row) => ({
    key: row.key,
    standing: row.standing as Remembered['standing'],
    sentAt: row.sentAt,
  }));
}

/**
 * Writes down what the health page currently says.
 *
 * Every signal that has gone wrong gets a row whether or not a message went,
 * so that "we knew and could not tell anybody" is distinguishable from "we
 * never knew". A signal that has recovered keeps its row, cleared, because the
 * next time it goes wrong the interesting question is whether this is the
 * fourth time this week.
 */
async function remember(signals: readonly Signal[], sent: readonly Alert[], now: Date) {
  const wentOut = new Set(sent.filter((one) => one.kind !== 'cleared').map((one) => one.key));

  for (const one of signals) {
    const entry = runbookFor(one.name);
    if (!entry) continue;

    const bad = one.standing === 'failed' || one.standing === 'degraded';
    const existing = await prisma.operatorAlert.findUnique({
      where: { key: one.name },
      select: { id: true, raisedAt: true, clearedAt: true },
    });

    if (!bad) {
      if (existing && !existing.clearedAt) {
        await prisma.operatorAlert.update({
          where: { key: one.name },
          data: { standing: one.standing, clearedAt: now, sentAt: null },
        });
      }
      continue;
    }

    // Still wrong, or wrong again. A row that was cleared and has come back is
    // raised afresh, because "since four this morning" is the useful fact and
    // "since a fortnight ago, on and off" is not.
    const raisedAt = existing && !existing.clearedAt ? existing.raisedAt : now;

    await prisma.operatorAlert.upsert({
      where: { key: one.name },
      create: {
        key: one.name,
        standing: one.standing,
        raisedAt: now,
        sentAt: wentOut.has(one.name) ? now : null,
      },
      update: {
        standing: one.standing,
        raisedAt,
        clearedAt: null,
        ...(wentOut.has(one.name) ? { sentAt: now } : {}),
      },
    });
  }
}

export interface Told {
  /** How many messages actually left. */
  sent: number;
  /** Signals that have gone wrong with nothing written about what to do. */
  unexplained: string[];
}

/**
 * Looks at how Carnet is, and says so if it is worth saying.
 *
 * Returns rather than throws. This runs inside the hourly job beside work that
 * matters to workshops, and an alerting failure must not take the reminders
 * and the timesheets down with it — which would be the one fault that stops
 * the thing that tells you about faults.
 */
export async function sweepAlerts(now = new Date()): Promise<Told> {
  try {
    const signals = await systemHealth(now);
    const { alerts, unexplained } = decideAlerts({ signals, remembered: await remembered(), now });

    const where = `Everything, on one page: ${siteUrl()}/admin/health`;

    // Which ones actually left, not how many. A message that did not go must
    // not be written down as sent, or the quiet period starts on a message
    // nobody received and the thing stays broken in silence for six hours.
    const wentOut: Alert[] = [];

    for (const alert of alerts) {
      const went = await tellOperator({
        subject: alertSubject(alert),
        body: alertBody(alert, where),
      });
      if (went) wentOut.push(alert);
    }

    await remember(signals, wentOut, now);

    // Said out loud in the job's own output as well as returned, because a
    // signal with no runbook entry is a gap somebody has to close and the
    // verification will refuse to pass until they do.
    if (unexplained.length > 0) {
      console.warn(
        `[alerts] no runbook entry, so nobody was told: ${unexplained.join(', ')}. ` +
          `Write one in packages/core/src/health/alerts.ts.`,
      );
    }

    return { sent: wentOut.length, unexplained };
  } catch (error) {
    console.error('[alerts] could not decide whether to tell anybody', error);
    return { sent: 0, unexplained: [] };
  }
}

/**
 * Every signal the health page can report that has no runbook entry.
 *
 * Read from the live health page rather than from a list, so a signal added
 * next month is caught the first time it is reported rather than the first
 * time it goes wrong — which would be the worst possible moment to discover
 * that nobody wrote down what to do.
 */
export async function withoutAnAction(now = new Date()): Promise<string[]> {
  const signals = await systemHealth(now);
  const known = new Set(explained());
  return signals
    .map((one) => one.name)
    .filter((name) => !known.has(name))
    .sort();
}

/** What the operator currently believes, for the verification and the page. */
export async function openAlerts() {
  return prisma.operatorAlert.findMany({
    // bounded: as above, one row per signal.
    where: { clearedAt: null },
    orderBy: { raisedAt: 'asc' },
  });
}
