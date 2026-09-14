import { createHash, randomBytes } from 'node:crypto';

import {
  assertQuoteSendable,
  QUOTE_LINK_DAYS,
  quoteChannelFor,
  QuoteError,
  quoteMessage,
  type QuoteStatus,
  safeLocale,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { siteUrl } from './credentials';
import { audit } from './guard';
import { pushNow } from './outbound';

/**
 * Sending a quote, against the database.
 *
 * The link is a capability: whoever holds it can approve work, so the token is
 * random and only its digest is stored, the same as a session or a passport
 * share. It is queued as a message and then pushed straight out, because the
 * customer is usually standing at the counter or waiting by the phone.
 */

export { QuoteError };

/** Sends the current draft to the job's customer. Returns the share id. */
export async function sendEstimate(input: {
  orgId: string;
  userId: string;
  estimateId: string;
}): Promise<string> {
  const estimate = await prisma.estimate.findFirstOrThrow({
    where: { id: input.estimateId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      total: true,
      currency: true,
      jobId: true,
      _count: { select: { lines: true } },
      org: { select: { name: true, locale: true } },
      job: {
        select: {
          number: true,
          customer: { select: { id: true, displayName: true, email: true, mobile: true } },
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
    },
  });

  const channel = quoteChannelFor(estimate.job.customer);

  assertQuoteSendable({
    status: estimate.status as QuoteStatus,
    lineCount: estimate._count.lines,
    total: Number(estimate.total),
    reachable: channel !== null,
  });

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const to = (channel === 'EMAIL' ? estimate.job.customer.email : estimate.job.customer.mobile)!;

  const vehicle =
    [estimate.job.vehicle.make, estimate.job.vehicle.model].filter(Boolean).join(' ') ||
    estimate.job.vehicle.registration ||
    'vehicle';

  const total = new Intl.NumberFormat(safeLocale(estimate.org.locale), {
    style: 'currency',
    currency: estimate.currency,
  }).format(Number(estimate.total));

  const message = quoteMessage({
    customerName: estimate.job.customer.displayName,
    workshopName: estimate.org.name,
    vehicle,
    jobNumber: estimate.job.number,
    total,
    link: `${siteUrl()}/e/${token}`,
    channel: channel!,
  });

  const { shareId, messageId } = await prisma.$transaction(async (tx) => {
    const share = await tx.estimateShare.create({
      data: {
        estimateId: estimate.id,
        tokenHash,
        channel: channel!,
        sentTo: to,
        expiresAt: new Date(Date.now() + QUOTE_LINK_DAYS * 86_400_000),
      },
      select: { id: true },
    });

    await tx.estimate.update({
      where: { id: estimate.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    // The job is waiting on the customer from this moment. The status the
    // dashboard counts, the portal shows and the approvals badge is built on.
    await tx.job.update({
      where: { id: estimate.jobId },
      data: { status: 'AWAITING_APPROVAL' },
    });

    const queued = await tx.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: channel!,
        toAddress: to,
        subject: message.subject,
        body: message.body,
        status: 'QUEUED',
        relatedType: 'Estimate',
        relatedId: estimate.id,
      },
      select: { id: true },
    });

    return { shareId: share.id, messageId: queued.id };
  });

  await pushNow(messageId);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'estimate.sent',
    entityType: 'Estimate',
    entityId: estimate.id,
    after: { channel, to, total: Number(estimate.total), shareId },
  });

  return shareId;
}

/** Withdraws a link before it expires. The quote itself is untouched. */
export async function revokeEstimateShare(input: {
  orgId: string;
  userId: string;
  shareId: string;
}): Promise<void> {
  const share = await prisma.estimateShare.findFirst({
    where: { id: input.shareId, estimate: { orgId: input.orgId }, revokedAt: null },
    select: { id: true, estimateId: true },
  });

  if (!share) return;

  await prisma.estimateShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'estimate.link_withdrawn',
    entityType: 'Estimate',
    entityId: share.estimateId,
    after: { shareId: share.id },
  });
}
