import {
  assertDecidable,
  confirmationFor,
  type DecidableLine,
  decide,
  DecisionError,
  type EstimateState,
  toNumber,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { createHash, randomBytes } from 'node:crypto';

import { audit } from './guard';
import { defaultWarehouseFor, reserveForJobLine } from './inventory';

/**
 * The customer's own side, against the database.
 *
 * Everything here is scoped by who is asking rather than by which workshop
 * owns the row. That is the whole point of the model: the history belongs to
 * the vehicle and to the person who owns it, not to one garage's address book,
 * and a customer with cars serviced at three different places sees all three.
 *
 * The scoping is done by a join back to the signed-in user on every query, not
 * by trusting an id in a URL. A portal user guessing another customer's job id
 * gets nothing, because the query never had a row to return.
 */

export { DecisionError };

/* ---------------------------------------------------------------------------
   Ownership checks
   --------------------------------------------------------------------------- */

/** Whether this user actually owns this vehicle, right now. */
async function ownsVehicle(userId: string, vehicleId: string): Promise<boolean> {
  const ownership = await prisma.vehicleOwnership.findFirst({
    where: { ownerUserId: userId, vehicleId, endedAt: null },
    select: { id: true },
  });

  return Boolean(ownership);
}

/* ---------------------------------------------------------------------------
   A vehicle's history, from the owner's side
   --------------------------------------------------------------------------- */

/**
 * Everything recorded about one vehicle the customer owns.
 *
 * The same underlying record as the public passport, read by the person it
 * belongs to. They get more than a stranger does: what each visit cost, and
 * which workshop did it.
 */
export async function vehicleHistory(userId: string, vehicleId: string) {
  if (!(await ownsVehicle(userId, vehicleId))) return null;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      vin: true,
      registration: true,
      make: true,
      model: true,
      year: true,
      colour: true,
      fuelType: true,
      lastOdometerKm: true,
      lastOdometerAt: true,
      eventCount: true,
      recalls: {
        where: { status: 'OPEN' },
        select: { id: true, recall: { select: { title: true, description: true } } },
      },
      serviceSchedules: {
        where: { isActive: true },
        orderBy: { dueAt: 'asc' },
        select: { id: true, name: true, dueAt: true, dueKm: true },
      },
      jobs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          shortDescription: true,
          completedAt: true,
          createdAt: true,
          odometerInKm: true,
          org: { select: { name: true } },
          invoices: {
            select: { id: true, number: true, total: true, currency: true, status: true },
          },
          // The car as it was handed over and handed back, because "that
          // scratch was already there" is the customer's record too. Phase 35.
          checks: {
            orderBy: { createdAt: 'asc' },
            select: {
              kind: true,
              createdAt: true,
              odometerKm: true,
              fuelEighths: true,
              damage: true,
              signature: { select: { signedByName: true } },
              _count: { select: { photos: true } },
            },
          },
        },
      },
    },
  });

  return vehicle;
}

/**
 * A share link a customer creates themselves, to show a buyer.
 *
 * The token is random and only its digest is stored, so a leaked database does
 * not hand over a working link. The customer sees the token exactly once,
 * here, because there is nowhere to read it back from afterwards.
 */
export async function shareVehicle(input: {
  userId: string;
  vehicleId: string;
  days?: number;
}): Promise<string | null> {
  if (!(await ownsVehicle(input.userId, input.vehicleId))) return null;

  const token = randomBytes(32).toString('base64url');
  const days = Math.min(90, Math.max(1, input.days ?? 30));

  await prisma.passportShare.create({
    data: {
      vehicleId: input.vehicleId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      label: 'Shared by the owner',
      createdByUserId: input.userId,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });

  await audit({
    actorUserId: input.userId,
    action: 'passport.shared',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: { days },
  });

  return token;
}

export async function revokeShare(input: { userId: string; shareId: string }) {
  const share = await prisma.passportShare.findFirst({
    where: { id: input.shareId, createdByUserId: input.userId, revokedAt: null },
    select: { id: true, vehicleId: true },
  });

  if (!share) return;

  await prisma.passportShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });

  await audit({
    actorUserId: input.userId,
    action: 'passport.share.revoked',
    entityType: 'Vehicle',
    entityId: share.vehicleId,
  });
}

/** Links this customer has handed out, so they can take them back. */
export async function sharesFor(userId: string, vehicleId: string) {
  return prisma.passportShare.findMany({
    where: { vehicleId, createdByUserId: userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, expiresAt: true, openCount: true, lastOpenedAt: true },
  });
}

/* ---------------------------------------------------------------------------
   Estimates
   --------------------------------------------------------------------------- */

function toDecidable(line: {
  id: string;
  description: string;
  lineTotal: unknown;
  isOptional: boolean;
  decision: string;
  inspectionResult: { severity: string } | null;
}): DecidableLine {
  return {
    id: line.id,
    description: line.description,
    totalMinor: Math.round(Number(line.lineTotal) * 100),
    isOptional: line.isOptional,
    isSafetyCritical: line.inspectionResult?.severity === 'CRITICAL',
    decision: line.decision as DecidableLine['decision'],
  };
}

const ESTIMATE_SELECT = {
  id: true,
  status: true,
  version: true,
  currency: true,
  subtotal: true,
  taxTotal: true,
  total: true,
  notes: true,
  validUntil: true,
  job: {
    select: {
      id: true,
      shortDescription: true,
      org: { select: { name: true, phone: true } },
      vehicle: { select: { id: true, make: true, model: true, year: true, registration: true } },
    },
  },
  lines: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      kind: true,
      description: true,
      detail: true,
      quantity: true,
      lineTotal: true,
      isOptional: true,
      decision: true,
      inspectionResult: { select: { severity: true, note: true } },
    },
  },
};

/** An estimate the signed-in customer is entitled to see. */
export async function estimateForCustomer(userId: string, estimateId: string) {
  const estimate = await prisma.estimate.findFirst({
    where: {
      id: estimateId,
      job: {
        OR: [
          { customer: { portalUserId: userId } },
          { vehicle: { ownerships: { some: { ownerUserId: userId, endedAt: null } } } },
        ],
      },
    },
    select: ESTIMATE_SELECT,
  });

  return estimate;
}

/**
 * An estimate reached by the link that was emailed or texted.
 *
 * Looked up by digest, never by the token itself, and the token is not stored
 * anywhere. A revoked or expired share stops working without anything else
 * having to change.
 */
export async function estimateByToken(token: string) {
  const share = await prisma.estimateShare.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    select: { id: true, estimateId: true, revokedAt: true, expiresAt: true },
  });

  if (!share || share.revokedAt || share.expiresAt < new Date()) return null;

  const estimate = await prisma.estimate.findUnique({
    where: { id: share.estimateId },
    select: ESTIMATE_SELECT,
  });

  if (!estimate) return null;

  await prisma.estimateShare.update({
    where: { id: share.id },
    data: {
      openCount: { increment: 1 },
      openedAt: new Date(),
    },
  });

  return estimate;
}

export interface DecisionPreview {
  lines: DecidableLine[];
  blockedReason: string | null;
}

/** The lines, and why the quote cannot be answered if it cannot. */
export function decisionPreview(estimate: {
  status: string;
  validUntil: Date | null;
  lines: Parameters<typeof toDecidable>[0][];
}): DecisionPreview {
  const lines = estimate.lines.map(toDecidable);

  try {
    assertDecidable({
      status: estimate.status as EstimateState,
      validUntil: estimate.validUntil,
    });
  } catch (error) {
    return {
      lines,
      blockedReason: error instanceof Error ? error.message : 'This quote is closed.',
    };
  }

  return { lines, blockedReason: null };
}

/**
 * Records the customer's answer.
 *
 * Written in one transaction with the per-line decisions, the estimate status
 * and the job status, because a half-recorded approval is worse than none: the
 * workshop would see approved lines on a job still waiting for an answer and
 * would have no way of telling which was true.
 *
 * The approval row keeps the address and the device it came from. That is not
 * analytics; it is the evidence that somebody agreed to spend the money, and
 * the one time it is needed is the time somebody says they never did.
 */
export async function recordDecision(input: {
  estimateId: string;
  approvedLineIds: string[];
  approvedByName: string;
  note?: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Set when a signed-in customer decided; absent for a share link. */
  userId?: string | null;
  /** Signed on a pad in front of somebody. Phase 35. */
  signatureId?: string | null;
}) {
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id: input.estimateId },
    select: {
      id: true,
      status: true,
      validUntil: true,
      currency: true,
      jobId: true,
      orgId: true,
      supplementary: true,
      lines: {
        select: {
          id: true,
          kind: true,
          description: true,
          detail: true,
          quantity: true,
          unitPrice: true,
          unitCost: true,
          discountPct: true,
          taxRateId: true,
          lineTotal: true,
          isOptional: true,
          decision: true,
          sortOrder: true,
          productId: true,
          product: { select: { partNumber: true } },
          inspectionResult: { select: { severity: true } },
        },
      },
      job: {
        select: {
          status: true,
          _count: { select: { labourLines: true, partLines: true, feeLines: true } },
        },
      },
    },
  });

  assertDecidable({
    status: estimate.status as EstimateState,
    validUntil: estimate.validUntil,
  });

  const outcome = decide(estimate.lines.map(toDecidable), input.approvedLineIds, estimate.currency);

  // Part lines written onto the job that name a stock item, reserved once
  // the transaction has committed. Phase 34.
  const toReserve: { jobPartLineId: string; productId: string; quantity: number }[] = [];

  await prisma.$transaction(async (tx) => {
    if (outcome.approvedIds.length > 0) {
      await tx.estimateLine.updateMany({
        where: { id: { in: outcome.approvedIds } },
        data: { decision: 'APPROVED' },
      });
    }

    if (outcome.declinedIds.length > 0) {
      await tx.estimateLine.updateMany({
        where: { id: { in: outcome.declinedIds } },
        data: { decision: 'DECLINED' },
      });
    }

    await tx.estimate.update({
      where: { id: estimate.id },
      data: { status: outcome.status, decidedAt: new Date() },
    });

    await tx.estimateApproval.create({
      data: {
        estimateId: estimate.id,
        decision: outcome.status === 'DECLINED' ? 'DECLINED' : 'APPROVED',
        approvedTotal: toNumber(outcome.approved),
        declinedTotal: toNumber(outcome.declined),
        approvedByName: input.approvedByName || null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        note: input.note || null,
        signatureId: input.signatureId ?? null,
      },
    });

    // A declined quote leaves the job waiting rather than moving it on. The
    // conversation that follows is a person's, not the system's.
    //
    // A supplementary quote, for extra work found mid-job, moves the job
    // nowhere at all: the work already approved carried on while the
    // customer decided, and an answer either way adds to the job or does
    // not. Phase 34.
    if (!estimate.supplementary) {
      await tx.job.update({
        where: { id: estimate.jobId },
        data: { status: outcome.status === 'DECLINED' ? 'ESTIMATED' : 'APPROVED' },
      });
    }

    // What the customer approved becomes the work on the job.
    //
    // Until this existed, an approved estimate changed the job's status and
    // nothing else: the job still had no labour, parts or fees on it, so the
    // profitability card read zero and there was nothing to invoice. The lines
    // are copied once, only when the job has none, so a job priced by hand at
    // the counter is never overwritten by a later approval.
    //
    // A supplementary quote is the exception: its approved lines are extra
    // work by definition, so they join whatever is on the job already, after
    // it. Phase 34.
    const existing =
      estimate.job._count.labourLines +
      estimate.job._count.partLines +
      estimate.job._count.feeLines;
    const alreadyLined = existing > 0;

    if ((!alreadyLined || estimate.supplementary) && outcome.approvedIds.length > 0) {
      const approved = estimate.lines
        .filter((line) => outcome.approvedIds.includes(line.id))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (const [offset, line] of approved.entries()) {
        const index = existing + offset;
        const description = line.detail ? `${line.description} (${line.detail})` : line.description;

        if (line.kind === 'LABOUR') {
          await tx.jobLabourLine.create({
            data: {
              jobId: estimate.jobId,
              description,
              hours: line.quantity,
              rate: line.unitPrice,
              discountPct: line.discountPct,
              taxRateId: line.taxRateId,
              sortOrder: index,
            },
          });
        } else if (line.kind === 'PART') {
          const partLine = await tx.jobPartLine.create({
            data: {
              jobId: estimate.jobId,
              productId: line.productId,
              partNumber: line.product?.partNumber ?? null,
              description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              discountPct: line.discountPct,
              taxRateId: line.taxRateId,
              status: 'REQUESTED',
              sortOrder: index,
            },
            select: { id: true },
          });
          if (line.productId) {
            toReserve.push({
              jobPartLineId: partLine.id,
              productId: line.productId,
              quantity: Number(line.quantity),
            });
          }
        } else if (line.kind === 'FEE') {
          await tx.jobFeeLine.create({
            data: {
              jobId: estimate.jobId,
              description,
              amount: Number(line.unitPrice) * Number(line.quantity),
              taxRateId: line.taxRateId,
              sortOrder: index,
            },
          });
        }
      }
    }
  });

  // The parts, reserved. Each reservation is its own transaction against
  // the stock level, the same one the parts page uses; a shortfall raises
  // the purchase request there and then, so the approval that needs a part
  // ordered is the thing that orders it. Nothing here can undo the
  // approval: a stock problem is a stock problem, not a reason the customer
  // did not say yes.
  const parts = { reserved: 0, ordered: 0 };
  if (toReserve.length > 0) {
    const warehouseId = await defaultWarehouseFor(estimate.orgId);
    if (warehouseId) {
      for (const entry of toReserve) {
        const result = await reserveForJobLine({
          orgId: estimate.orgId,
          jobPartLineId: entry.jobPartLineId,
          productId: entry.productId,
          warehouseId,
          quantity: entry.quantity,
          requestedByUserId: input.userId ?? null,
        });
        if (result.reserved > 0) parts.reserved += 1;
        if (result.purchaseRequestId) parts.ordered += 1;
        await prisma.jobPartLine.update({
          where: { id: entry.jobPartLineId },
          data: { status: result.shortfall > 0 ? 'ON_ORDER' : 'RESERVED' },
        });
      }
    }
  }

  await audit({
    orgId: estimate.orgId,
    actorUserId: input.userId ?? null,
    action: 'estimate.decided',
    entityType: 'Estimate',
    entityId: estimate.id,
    after: {
      status: outcome.status,
      approvedMinor: outcome.approved.minor,
      declinedMinor: outcome.declined.minor,
      declinedSafetyCritical: outcome.declinedSafetyCritical.map((line) => line.description),
      supplementary: estimate.supplementary,
      jobStatus: estimate.supplementary ? estimate.job.status : undefined,
      parts,
    },
  });

  return { outcome, confirmation: confirmationFor(outcome), parts };
}

/* ---------------------------------------------------------------------------
   Invoices and history
   --------------------------------------------------------------------------- */

/**
 * Every invoice this customer has, across every workshop that uses Carnet.
 *
 * Ordered newest first, and never filtered to one organisation. A person with
 * cars serviced in two towns has one history, and splitting it by whoever
 * happened to do the work is the workshop's convenience, not theirs.
 */
export async function invoicesFor(userId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { customer: { portalUserId: userId } },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      total: true,
      amountPaid: true,
      issuedAt: true,
      dueAt: true,
      org: { select: { name: true } },
      job: {
        select: {
          shortDescription: true,
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
      payments: {
        orderBy: { receivedAt: 'desc' },
        select: { id: true, amount: true, method: true, receivedAt: true },
      },
    },
  });

  return invoices.map((invoice) => ({
    ...invoice,
    totalNumber: Number(invoice.total),
    paidNumber: Number(invoice.amountPaid),
    outstanding: Number(invoice.total) - Number(invoice.amountPaid),
  }));
}

/**
 * What has happened lately, across every vehicle the customer owns.
 *
 * The answer to "what is going on with my car", which is the question the
 * portal exists for and the one a status badge on a card does not answer.
 */
export async function updatesFor(userId: string, limit = 25) {
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { customer: { portalUserId: userId } },
        { vehicle: { ownerships: { some: { ownerUserId: userId, endedAt: null } } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      number: true,
      status: true,
      shortDescription: true,
      updatedAt: true,
      promisedAt: true,
      org: { select: { name: true, phone: true } },
      vehicle: { select: { id: true, make: true, model: true, registration: true } },
      estimates: {
        where: { status: 'SENT' },
        orderBy: { version: 'desc' },
        take: 1,
        select: { id: true, total: true, currency: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, number: true, status: true, total: true, currency: true },
      },
      statusEvents: {
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, toStatus: true, createdAt: true, note: true },
      },
    },
  });

  return jobs;
}
