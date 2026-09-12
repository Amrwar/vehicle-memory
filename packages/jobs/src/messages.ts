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
          orgId: {
            in: [
              ...new Set(due.map((message) => message.orgId).filter((id): id is string => !!id)),
            ],
          },
        },
        select: { address: true },
      })
    ).map((row) => row.address),
  );

  let sent = 0;

  for (const message of due) {
    if (await deliver(message, suppressed)) sent += 1;
  }

  if (sent > 0) log('messages.sent', { count: sent });
  return sent;
}

/**
 * Sends one message that has just been written, without waiting for the sweep.
 *
 * The queue is drained by a scheduled job, and on the hosting plan this runs on
 * that job fires once a day. For a service reminder that is fine. For a
 * password reset, an email confirmation or an invitation it is useless: a link
 * that arrives tomorrow morning has already failed the person waiting for it,
 * and they will have concluded the product is broken long before it turns up.
 *
 * So anything somebody is actively waiting on is queued and then pushed
 * straight out. The row is still the record and still the retry path. This only
 * removes the wait, and a failure here is deliberately silent: the message
 * stays QUEUED and the sweep picks it up exactly as it would have done.
 */
export async function sendMessageNow(messageId: string): Promise<boolean> {
  try {
    const message = await prisma.messageLog.findUnique({
      where: { id: messageId },
      include: { org: { select: { slug: true } } },
    });

    if (!message || message.status !== 'QUEUED') return false;

    const suppressed = new Set(
      message.orgId
        ? (
            await prisma.suppressedAddress.findMany({
              where: { liftedAt: null, orgId: message.orgId },
              select: { address: true },
            })
          ).map((row) => row.address)
        : [],
    );

    return await deliver(message, suppressed);
  } catch (error) {
    // Never the caller's problem. Somebody has just signed up, reset a
    // password or invited a colleague; whether the provider was reachable in
    // that same second must not decide whether their account exists.
    log('message.immediate.failed', {
      id: messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

type Queued = Awaited<ReturnType<typeof prisma.messageLog.findMany>>[number] & {
  org: { slug: string } | null;
};

/** One message, from the queue to a provider. Shared by the sweep and the nudge. */
async function deliver(message: Queued, suppressed: Set<string>): Promise<boolean> {
  const now = new Date();

  // PORTAL messages are read in the app and never leave the building.
  if (message.channel === 'PORTAL') {
    await prisma.messageLog.update({
      where: { id: message.id },
      data: { status: 'DELIVERED', sentAt: now, provider: 'portal' },
    });
    return true;
  }

  const channel = message.channel as Channel;

  const hold = quietHours({ channel, now });

  if (!hold.send && hold.holdUntil) {
    await prisma.messageLog.update({
      where: { id: message.id },
      data: { availableAt: hold.holdUntil, error: hold.reason },
    });
    return false;
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
        error: 'Not sent: that address is suppressed after a permanent bounce or a spam complaint.',
      },
    });

    log('message.suppressed', { id: message.id, to });
    return false;
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
    return false;
  }

  // Claimed before the attempt, not after. A crash mid-send leaves a row that
  // says it was tried, which is true, rather than one that looks untouched and
  // gets sent again by the next worker.
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
      // Replies reach the workshop that sent it rather than the one address the
      // domain is verified for. The left-hand side is the workshop's own slug,
      // which is what the inbound endpoint reads to file the reply. A message
      // with no workshop behind it is the platform speaking for itself: a
      // password reset for somebody not yet attached to anybody. There is no
      // workshop for a reply to reach, so none is offered.
      replyTo:
        channel === 'EMAIL' && process.env.REPLY_DOMAIN && message.org
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

    return true;
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

    return false;
  }
}
