import {
  bounceKind,
  describeDeliverability,
  eventOf,
  maySendTo,
  reactTo,
  type SuppressionReason,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * What happens after a message leaves.
 *
 * The queue has recorded messages as SENT since Phase 5, and SENT only ever
 * meant a provider took it at the door. Whether it arrived, bounced off a
 * mailbox that no longer exists, or was marked as spam has been invisible, and
 * the banner on the dashboard promises a workshop we will tell them when one
 * of their customers cannot be reached. This is the part that makes that true.
 */

/** Records one event a provider reported, and acts on it. */
export async function recordDeliveryEvent(input: {
  orgId: string;
  type: string;
  providerRef?: string | null;
  /** The provider's own id for the message, used to find the row it concerns. */
  messageRef?: string | null;
  toAddress?: string | null;
  detail?: string | null;
  bounceKind?: string | null;
  occurredAt?: Date;
}) {
  const event = eventOf(input.type);

  if (event === 'UNKNOWN') return { applied: false, reason: 'Not an event we act on.' };

  // A webhook that retries must not produce a second row. Every provider
  // retries, and a duplicate bounce would suppress an address twice and read
  // as two customers failing rather than one.
  if (input.providerRef) {
    const seen = await prisma.deliveryEvent.findFirst({
      where: { orgId: input.orgId, providerRef: input.providerRef },
      select: { id: true },
    });

    if (seen) return { applied: false, reason: 'Already recorded.' };
  }

  // Matched on the provider's reference where there is one, and otherwise on
  // the address and the most recent message sent to it. The second is a guess
  // and is only used because some providers omit the reference on complaints.
  const message = input.messageRef
    ? await prisma.messageLog.findFirst({
        where: { orgId: input.orgId, providerRef: input.messageRef },
        select: { id: true, status: true, toAddress: true },
      })
    : input.toAddress
      ? await prisma.messageLog.findFirst({
          where: {
            orgId: input.orgId,
            toAddress: input.toAddress,
            status: { in: ['SENT', 'DELIVERED'] },
          },
          orderBy: { sentAt: 'desc' },
          select: { id: true, status: true, toAddress: true },
        })
      : null;

  const address = (input.toAddress ?? message?.toAddress ?? '').trim().toLowerCase();

  const reaction = reactTo({
    event,
    bounce: { kind: input.bounceKind, message: input.detail },
    currentStatus: message?.status,
  });

  await prisma.deliveryEvent.create({
    data: {
      orgId: input.orgId,
      messageLogId: message?.id ?? null,
      event,
      detail: input.detail ?? null,
      providerRef: input.providerRef ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  if (message && reaction.status) {
    await prisma.messageLog.update({
      where: { id: message.id },
      data: { status: reaction.status, error: reaction.note },
    });
  }

  if (reaction.suppress && address) {
    await suppress({
      orgId: input.orgId,
      address,
      reason: event === 'COMPLAINED' ? 'COMPLAINT' : 'HARD_BOUNCE',
      detail: input.detail ?? null,
    });
  }

  if (reaction.withdrawConsent && address) {
    // A spam complaint is somebody asking to be left alone in the only way the
    // interface gives them. Suppressing the address without withdrawing
    // consent would keep asking the question they have just answered.
    await prisma.customer.updateMany({
      where: { orgId: input.orgId, OR: [{ email: address }, { mobile: address }] },
      data: { marketingEmailConsent: false, marketingSmsConsent: false },
    });
  }

  return { applied: true, event, note: reaction.note };
}

/** Stops anything being sent to an address. */
export async function suppress(input: {
  orgId: string;
  address: string;
  reason: SuppressionReason;
  detail?: string | null;
  userId?: string | null;
}) {
  const address = input.address.trim().toLowerCase();
  if (!address) return;

  const existing = await prisma.suppressedAddress.findFirst({
    where: { orgId: input.orgId, address, liftedAt: null },
    select: { id: true },
  });

  if (existing) return;

  await prisma.suppressedAddress.create({
    data: {
      orgId: input.orgId,
      address,
      reason: input.reason,
      detail: input.detail?.slice(0, 500) ?? null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId ?? null,
    action: 'address.suppressed',
    entityType: 'Organization',
    entityId: input.orgId,
    after: { address, reason: input.reason },
  });
}

/**
 * Lets an address be used again.
 *
 * Only by a person, and only with a reason. An address that starts working
 * again is usually one somebody corrected, and correcting it is the moment to
 * say so; a suppression that lifted itself would put the workshop straight
 * back to bouncing off the same mailbox.
 */
export async function lift(input: {
  orgId: string;
  userId: string;
  suppressionId: string;
  note: string;
}) {
  const note = input.note.trim();

  if (!note) {
    throw new Error('Say why it is safe to send there again. The database will refuse it blank.');
  }

  await prisma.suppressedAddress.update({
    where: { id: input.suppressionId, orgId: input.orgId },
    data: { liftedAt: new Date(), liftedByUserId: input.userId, liftedNote: note },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'address.unsuppressed',
    entityType: 'Organization',
    entityId: input.orgId,
    after: { note },
  });
}

/** Every address currently blocked, and what blocked it. */
export async function suppressions(orgId: string, includeLifted = false) {
  return prisma.suppressedAddress.findMany({
    where: { orgId, ...(includeLifted ? {} : { liftedAt: null }) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      address: true,
      reason: true,
      detail: true,
      createdAt: true,
      liftedAt: true,
      liftedNote: true,
      liftedBy: { select: { name: true } },
    },
  });
}

/** Whether a message may go to an address, read at the moment of sending. */
export async function sendableTo(orgId: string, address: string) {
  const blocked = await prisma.suppressedAddress.findFirst({
    where: { orgId, address: address.trim().toLowerCase(), liftedAt: null },
    select: { id: true },
  });

  return maySendTo({
    address,
    suppressed: blocked ? new Set([address.trim().toLowerCase()]) : new Set(),
  });
}

/** The deliverability picture, in the terms providers themselves use. */
export async function deliverability(orgId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);

  const [sent, delivered, bounced, complained, blocked, recent] = await Promise.all([
    prisma.messageLog.count({
      where: { orgId, sentAt: { gte: since }, status: { in: ['SENT', 'DELIVERED', 'FAILED'] } },
    }),
    prisma.deliveryEvent.count({
      where: { orgId, event: 'DELIVERED', occurredAt: { gte: since } },
    }),
    prisma.deliveryEvent.count({ where: { orgId, event: 'BOUNCED', occurredAt: { gte: since } } }),
    prisma.deliveryEvent.count({
      where: { orgId, event: 'COMPLAINED', occurredAt: { gte: since } },
    }),
    prisma.suppressedAddress.count({ where: { orgId, liftedAt: null } }),
    prisma.deliveryEvent.findMany({
      where: { orgId, event: { in: ['BOUNCED', 'COMPLAINED'] }, occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: 40,
      select: {
        id: true,
        event: true,
        detail: true,
        occurredAt: true,
        messageLog: { select: { toAddress: true, subject: true } },
      },
    }),
  ]);

  return {
    sent,
    delivered,
    bounced,
    complained,
    suppressed: blocked,
    recent,
    summary: describeDeliverability({ sent, delivered, bounced, complained, suppressed: blocked }),
  };
}

/** Reads a provider's payload without trusting its shape. */
export function readDeliveryPayload(payload: Record<string, unknown>) {
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const recipients = Array.isArray(data.to) ? data.to.map(String) : [String(data.to ?? '')];

  const bounce = (data.bounce ?? {}) as Record<string, unknown>;

  return {
    type: String(payload.type ?? data.type ?? ''),
    providerRef: String(payload.id ?? data.id ?? '') || null,
    messageRef: String(data.email_id ?? data.message_id ?? data.id ?? '') || null,
    toAddress: (/<([^>]+)>/.exec(recipients[0] ?? '')?.[1] ?? recipients[0] ?? '') || null,
    detail:
      String(bounce.message ?? data.reason ?? data.detail ?? '') ||
      (bounce.subType ? String(bounce.subType) : null),
    bounceKind: bounce.type ? String(bounce.type) : null,
    occurredAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
  };
}

export { bounceKind };
