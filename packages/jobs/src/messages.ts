import {
  afterFailure,
  type Channel,
  classifyFailure,
  normaliseFor,
  quietHours,
  redact,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { log } from './log';
import { configureTransports, transportFor } from './transport/configure';
import { TransportError } from './transport/index';

/**
 * The only place in the product that hands a message to a provider.
 *
 * Everything upstream writes a row to `message_logs` and stops. Confirmations,
 * service reminders, quote links, automation actions and campaigns all arrive
 * here as rows, and this drains them.
 *
 * Kept out of the worker's entry point so it can be run once, deliberately,
 * against a real database by `verify-messaging.ts`. Importing the entry point
 * would start the worker.
 */

const BATCH_SIZE = Number(process.env.WORKER_BATCH ?? 25);

export const TRANSPORTS = configureTransports();

/**
 * Hands every message that is due to whichever provider carries its channel.
 *
 * The queue is claimed one row at a time and updated immediately, so a second
 * worker on the same database cannot pick up a message this one is already
 * sending. Sending twice is worse than sending late: the customer sees it,
 * and there is no way to take it back.
 *
 * The address is normalised here rather than where it was written, because a
 * customer record can be edited between queueing and sending, and the address
 * that matters is the one that is true now.
 *
 * Failures are handed to the domain layer, which decides between never again,
 * later, and later for the last time. Nothing in this function decides that.
 */
export async function sendQueuedMessages(): Promise<number> {
  const due = await prisma.messageLog.findMany({
    where: { status: 'QUEUED', availableAt: { lte: new Date() } },
    orderBy: { availableAt: 'asc' },
    take: BATCH_SIZE,
    include: { org: { select: { slug: true } } },
  });

  // Suppressed addresses are read once for the batch rather than per message.
  // A morning's reminders are mostly to different people, and one query for
  // the whole list beats sixty asking the same question.
  const suppressed = new Set(
    (
      await prisma.suppressedAddress.findMany({
        where: {
          liftedAt: null,
          orgId: { in: [...new Set(due.map((message) => message.orgId))] },
        },
        select: { address: true },
      })
    ).map((row) => row.address),
  );

  let sent = 0;

  for (const message of due) {
    const now = new Date();

    // PORTAL messages are read in the app and never leave the building.
    if (message.channel === 'PORTAL') {
      await prisma.messageLog.update({
        where: { id: message.id },
        data: { status: 'DELIVERED', sentAt: now, provider: 'portal' },
      });
      sent += 1;
      continue;
    }

    const channel = message.channel as Channel;

    const hold = quietHours({ channel, now });

    if (!hold.send && hold.holdUntil) {
      await prisma.messageLog.update({
        where: { id: message.id },
        data: { availableAt: hold.holdUntil, error: hold.reason },
      });
      continue;
    }

    const to = normaliseFor(channel, message.toAddress);

    // Checked here rather than when the message was written, because a
    // suppression can arrive in between: a reminder queued on Monday night and
    // sent on Tuesday morning has to respect a bounce recorded overnight.
    if (to && suppressed.has(to.trim().toLowerCase())) {
      await prisma.messageLog.update({
        where: { id: message.id },
        data: {
          status: 'SUPPRESSED',
          error:
            'Not sent: that address is suppressed after a permanent bounce or a spam complaint.',
        },
      });

      log('message.suppressed', { id: message.id, to });
      continue;
    }

    if (!to) {
      // Not a failure to retry. The address will not become valid on its own,
      // and six attempts against it delay everything queued behind it.
      await prisma.messageLog.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          attempts: message.attempts + 1,
          error: `Will not be retried: "${message.toAddress}" is not a usable ${
            channel === 'EMAIL' ? 'email address' : 'mobile number'
          }.`,
        },
      });

      log('message.unsendable', { id: message.id, channel });
      continue;
    }

    // Claimed before the attempt, not after. A crash mid-send leaves a row
    // that says it was tried, which is true, rather than one that looks
    // untouched and gets sent again by the next worker.
    await prisma.messageLog.update({
      where: { id: message.id },
      data: { attempts: message.attempts + 1, availableAt: new Date(now.getTime() + 60_000) },
    });

    const transport = transportFor(TRANSPORTS, channel);

    try {
      const result = await transport.send({
        channel,
        to,
        subject: message.subject,
        body: message.body,
        // Replies reach the workshop that sent it rather than the one address
        // the domain is verified for. The left-hand side is the workshop's own
        // slug, which is what the inbound endpoint reads to file the reply.
        replyTo:
          channel === 'EMAIL' && process.env.REPLY_DOMAIN
            ? `${message.org.slug}@${process.env.REPLY_DOMAIN}`
            : null,
      });

      await prisma.messageLog.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          provider: result.provider,
          providerRef: result.reference,
          error: null,
        },
      });

      sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      const kind = classifyFailure({
        message: detail,
        code: error instanceof TransportError ? error.code : null,
        protocol: error instanceof TransportError ? error.protocol : undefined,
      });

      const next = afterFailure({
        attempts: message.attempts,
        kind,
        message: detail,
        now: new Date(),
      });

      await prisma.messageLog.update({
        where: { id: message.id },
        data: {
          status: next.status,
          attempts: next.attempts,
          error: next.reason,
          ...(next.availableAt ? { availableAt: next.availableAt } : {}),
        },
      });

      log('message.failed', {
        id: message.id,
        channel,
        to: redact(to),
        attempts: next.attempts,
        kind,
        giveUp: next.status === 'FAILED',
        error: detail,
      });
    }
  }

  if (sent > 0) log('messages.sent', { count: sent });
  return sent;
}
