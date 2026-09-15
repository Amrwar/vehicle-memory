import { createHash, randomBytes } from 'node:crypto';

import {
  assertQuoteSendable,
  calculateTotals,
  type Currency,
  type PriceableLine,
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
import { recordDecision } from './portal';
import { regionFor } from './region';

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
      supplementary: true,
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
    //
    // Unless the quote is for extra work found mid-job: the work already
    // approved carries on while the customer decides, so the job stays where
    // it is and the answer, when it comes, adds to it. Phase 34.
    if (!estimate.supplementary) {
      await tx.job.update({
        where: { id: estimate.jobId },
        data: { status: 'AWAITING_APPROVAL' },
      });
    }

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

/* ---------------------------------------------------------------------------
   Totals
   --------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Writes the totals an estimate's lines add up to, onto the lines and the
 * estimate. Phase 34.
 *
 * Until this existed an estimate raised from an inspection carried a zero
 * total and zero on every line, and "Send the quote" refused it with "the
 * total is zero" however carefully the technician had priced the findings.
 * Called wherever lines are written.
 */
export async function retotalEstimate(tx: Tx, estimateId: string): Promise<void> {
  const estimate = await tx.estimate.findUniqueOrThrow({
    where: { id: estimateId },
    select: {
      currency: true,
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          kind: true,
          quantity: true,
          unitPrice: true,
          unitCost: true,
          discountPct: true,
          taxRate: { select: { rate: true } },
        },
      },
    },
  });

  const priceable: PriceableLine[] = estimate.lines.map((line) => ({
    kind: line.kind,
    quantity: Number(line.quantity),
    unitPrice: String(line.unitPrice),
    unitCost: String(line.unitCost),
    discountPct: Number(line.discountPct),
    taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
  }));

  const totals = calculateTotals(priceable, estimate.currency as Currency);

  for (const [index, line] of estimate.lines.entries()) {
    await tx.estimateLine.update({
      where: { id: line.id },
      data: { lineTotal: totals.lines[index]!.net.minor / 100 },
    });
  }

  await tx.estimate.update({
    where: { id: estimateId },
    data: {
      subtotal: totals.subtotal.minor / 100,
      discountTotal: totals.discountTotal.minor / 100,
      taxTotal: totals.taxTotal.minor / 100,
      total: totals.total.minor / 100,
    },
  });
}

/* ---------------------------------------------------------------------------
   Extra work, mid-job
   --------------------------------------------------------------------------- */

const OPEN_FOR_EXTRA: readonly string[] = [
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
];

/**
 * Something found with the car up on the ramp, quoted without leaving the
 * job. Phase 34.
 *
 * One line at a time, onto a supplementary estimate that is the job's next
 * version: opened if there is a draft supplementary one, created if not. A
 * part named by its number brings its stock item, cost and price with it,
 * so the approval can reserve it. With `send`, the quote goes to the
 * customer in the same press; without, it waits on the job for more lines.
 *
 * The work already approved does not stop. That is the whole point: before
 * this a new estimate meant a new version from another page, and sending it
 * put the job back to "awaiting approval" so the technician clocked off a
 * car that was half done.
 */
export async function quoteExtraWork(input: {
  orgId: string;
  userId: string;
  jobId: string;
  kind: 'LABOUR' | 'PART' | 'FEE';
  description: string;
  quantity: number;
  unitPrice?: number | null;
  partNumber?: string | null;
  send?: boolean;
}): Promise<{ estimateId: string; version: number; shareId: string | null }> {
  const description = input.description.trim();
  const partNumber = input.partNumber?.trim() || null;
  if (!description && !partNumber) throw new QuoteError('EMPTY', 'Say what the extra work is.');
  if (!(input.quantity > 0)) throw new QuoteError('EMPTY', 'Say how many, or how many hours.');

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      estimates: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { id: true, version: true, status: true, supplementary: true },
      },
    },
  });
  if (!job) throw new QuoteError('NOT_DRAFT', 'That job is not here.');
  if (!OPEN_FOR_EXTRA.includes(job.status)) {
    throw new QuoteError(
      'NOT_DRAFT',
      'This job is closed, so extra work goes on a new job for the same car.',
    );
  }

  const region = await regionFor(input.orgId);

  const [product, defaultTax] = await Promise.all([
    partNumber
      ? prisma.product.findFirst({
          where: { orgId: input.orgId, partNumber },
          select: { id: true, name: true, partNumber: true, sellPrice: true, costPrice: true },
        })
      : null,
    prisma.taxRate.findFirst({
      where: { orgId: input.orgId, isDefault: true },
      select: { id: true },
    }),
  ]);

  if (partNumber && !product) {
    throw new QuoteError(
      'EMPTY',
      `No part ${partNumber} on your books. Leave the part number blank to quote it as a line, or add the part first.`,
    );
  }

  const unitPrice =
    input.unitPrice !== null && input.unitPrice !== undefined
      ? input.unitPrice
      : product
        ? Number(product.sellPrice)
        : 0;

  const latest = job.estimates[0];
  const reuse = latest && latest.status === 'DRAFT' && latest.supplementary ? latest : null;

  const { estimateId, version } = await prisma.$transaction(async (tx) => {
    const estimate = reuse
      ? { id: reuse.id, version: reuse.version }
      : await tx.estimate.create({
          data: {
            orgId: input.orgId,
            jobId: job.id,
            version: (latest?.version ?? 0) + 1,
            status: 'DRAFT',
            supplementary: true,
            currency: region.currency,
            createdByUserId: input.userId,
            notes: 'Extra work found while the car was with us.',
          },
          select: { id: true, version: true },
        });

    const count = await tx.estimateLine.count({ where: { estimateId: estimate.id } });

    await tx.estimateLine.create({
      data: {
        estimateId: estimate.id,
        kind: input.kind,
        description: description || product!.name,
        detail: product ? `${product.name} · ${product.partNumber}` : null,
        quantity: input.quantity,
        unitPrice,
        unitCost: product ? product.costPrice : 0,
        taxRateId: defaultTax?.id ?? null,
        productId: product?.id ?? null,
        isOptional: false,
        sortOrder: count,
      },
    });

    await retotalEstimate(tx, estimate.id);
    return { estimateId: estimate.id, version: estimate.version };
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'estimate.extra_work',
    entityType: 'Estimate',
    entityId: estimateId,
    after: {
      jobId: job.id,
      kind: input.kind,
      description: description || product?.name,
      quantity: input.quantity,
      unitPrice,
      partNumber: product?.partNumber ?? null,
    },
  });

  let shareId: string | null = null;
  if (input.send) {
    shareId = await sendEstimate({ orgId: input.orgId, userId: input.userId, estimateId });
  }

  return { estimateId, version, shareId };
}

/* ---------------------------------------------------------------------------
   Approved at the counter
   --------------------------------------------------------------------------- */

/**
 * The customer said yes in person, or on the telephone, and the desk records
 * it. Phase 34.
 *
 * The same decision the customer's own page records, with the same evidence:
 * who approved, when, and that it was taken by a member of staff on their
 * behalf. Every line is approved, because a customer standing at the counter
 * who wanted to leave something off has said so and the line has been
 * removed already. A draft is marked sent at the same moment, since a quote
 * agreed across a counter was, in every sense that matters, presented.
 */
export async function approveInPerson(input: {
  orgId: string;
  userId: string;
  estimateId: string;
  approvedByName?: string | null;
  /** A signature already recorded, when the customer signed the pad. Phase 35. */
  signatureId?: string | null;
}) {
  const estimate = await prisma.estimate.findFirstOrThrow({
    where: { id: input.estimateId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      total: true,
      supplementary: true,
      jobId: true,
      lines: { select: { id: true } },
      job: { select: { customer: { select: { displayName: true } } } },
    },
  });

  if (estimate.lines.length === 0) {
    throw new QuoteError('EMPTY', 'There is nothing on this quote yet. Add the work first.');
  }
  if (Number(estimate.total) <= 0) {
    throw new QuoteError(
      'ZERO',
      'The total is zero. Price the lines before recording an approval.',
    );
  }
  if (estimate.status !== 'DRAFT' && estimate.status !== 'SENT') {
    throw new QuoteError(
      'NOT_DRAFT',
      `This quote is ${estimate.status.toLowerCase().replace('_', ' ')}; it cannot be approved again.`,
    );
  }

  const staff = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { name: true },
  });

  if (estimate.status === 'DRAFT') {
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  const result = await recordDecision({
    estimateId: estimate.id,
    approvedLineIds: estimate.lines.map((line) => line.id),
    approvedByName: input.approvedByName?.trim() || estimate.job.customer.displayName,
    note: `Approved in person, recorded by ${staff.name}.`,
    userId: input.userId,
    signatureId: input.signatureId ?? null,
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'estimate.approved_in_person',
    entityType: 'Estimate',
    entityId: estimate.id,
    after: { approvedMinor: result.outcome.approved.minor, parts: result.parts },
  });

  return result;
}
