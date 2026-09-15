import {
  ArrivalError,
  assertCheckInAllowed,
  assertCheckOutAllowed,
  assertKeyMove,
  assertSigned,
  type DamageMark,
  type KeyAction,
  keyState,
  type KeyState,
  type SignatureStrokes,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { readUrlFor } from './storage';

/**
 * Arrival and departure, against the database. Phase 35.
 *
 * Two records and a set of key movements. Each check is written in one
 * transaction with its signature, the key event it implies and the
 * mileage it read, because a check-in with no signature behind it, or a
 * signature pointing at nothing, is the record that loses the argument it
 * was written to win.
 */

export { ArrivalError };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface SignatureInput extends SignatureStrokes {
  name: string;
}

async function writeSignature(
  tx: Tx,
  input: {
    orgId: string;
    purpose: 'CHECK_IN' | 'CHECK_OUT' | 'ESTIMATE_APPROVAL' | 'TERMS' | 'WARRANTY';
    jobId?: string | null;
    customerId?: string | null;
    capturedByUserId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    signature: SignatureInput;
  },
): Promise<string> {
  const row = await tx.signature.create({
    data: {
      orgId: input.orgId,
      purpose: input.purpose,
      signedByName: input.signature.name.trim(),
      strokes: input.signature.strokes as unknown as object,
      width: input.signature.width,
      height: input.signature.height,
      jobId: input.jobId ?? null,
      customerId: input.customerId ?? null,
      capturedByUserId: input.capturedByUserId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * A signature written on its own, for a record that is not a check: an
 * approval given across the counter, the terms, a warranty. Returns the
 * row's id for the record to point at.
 */
export async function recordSignature(input: {
  orgId: string;
  purpose: 'ESTIMATE_APPROVAL' | 'TERMS' | 'WARRANTY';
  jobId?: string | null;
  customerId?: string | null;
  capturedByUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  signature: SignatureInput;
}): Promise<string> {
  assertSigned({ signature: input.signature, name: input.signature.name });
  return prisma.$transaction((tx) => writeSignature(tx, input));
}

/* ---------------------------------------------------------------------------
   Check-in
   --------------------------------------------------------------------------- */

export async function checkIn(input: {
  orgId: string;
  userId: string;
  jobId: string;
  odometerKm?: number | null;
  fuelEighths?: number | null;
  damage?: DamageMark[];
  belongings?: string | null;
  notes?: string | null;
  keysHook?: string | null;
  signature?: SignatureInput | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ checkId: string }> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      customerId: true,
      vehicleId: true,
      receivedAt: true,
      odometerInKm: true,
      vehicle: { select: { lastOdometerKm: true } },
      checks: { where: { kind: 'IN' }, select: { id: true } },
    },
  });
  if (!job) throw new ArrivalError('CLOSED', 'That job is not here.');

  const odometerKm = input.odometerKm ?? null;
  assertCheckInAllowed({
    jobStatus: job.status,
    alreadyIn: job.checks.length > 0,
    odometerKm,
    lastOdometerKm: job.vehicle.lastOdometerKm,
    fuelEighths: input.fuelEighths,
  });
  if (input.signature) assertSigned({ signature: input.signature, name: input.signature.name });

  const damage = (input.damage ?? []).filter((mark) => mark.area?.trim());
  const hook = input.keysHook?.trim() || null;

  const checkId = await prisma.$transaction(async (tx) => {
    const signatureId = input.signature
      ? await writeSignature(tx, {
          orgId: input.orgId,
          purpose: 'CHECK_IN',
          jobId: job.id,
          customerId: job.customerId,
          capturedByUserId: input.userId,
          ip: input.ip,
          userAgent: input.userAgent,
          signature: input.signature,
        })
      : null;

    const check = await tx.vehicleCheck.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        kind: 'IN',
        odometerKm,
        fuelEighths: input.fuelEighths ?? null,
        damage: damage as unknown as object,
        belongings: input.belongings?.trim() || null,
        notes: input.notes?.trim() || null,
        keysHook: hook,
        signatureId,
        performedByUserId: input.userId,
      },
      select: { id: true },
    });

    if (hook) {
      await tx.keyEvent.create({
        data: { orgId: input.orgId, jobId: job.id, action: 'HUNG', hook, byUserId: input.userId },
      });
    }

    await tx.job.update({
      where: { id: job.id },
      data: {
        receivedAt: job.receivedAt ?? new Date(),
        odometerInKm: odometerKm ?? job.odometerInKm,
      },
    });

    if (odometerKm !== null) {
      await tx.odometerReading.create({
        data: {
          vehicleId: job.vehicleId,
          km: odometerKm,
          readAt: new Date(),
          source: 'WORKSHOP',
          recordedByOrgId: input.orgId,
        },
      });
      await tx.vehicle.update({
        where: { id: job.vehicleId },
        data: { lastOdometerKm: odometerKm },
      });
    }

    return check.id;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.checked_in',
    entityType: 'Job',
    entityId: job.id,
    after: {
      checkId,
      odometerKm,
      fuelEighths: input.fuelEighths ?? null,
      marks: damage.length,
      keysHook: hook,
      signed: Boolean(input.signature),
    },
  });

  return { checkId };
}

/* ---------------------------------------------------------------------------
   Check-out
   --------------------------------------------------------------------------- */

/** What is still owed across the job's live invoices, in minor units. */
export async function outstandingOn(jobId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { jobId, status: { not: 'VOID' } },
    select: { total: true, amountPaid: true },
  });
  return invoices.reduce(
    (total, invoice) =>
      total + Math.max(0, Math.round((Number(invoice.total) - Number(invoice.amountPaid)) * 100)),
    0,
  );
}

export async function checkOut(input: {
  orgId: string;
  userId: string;
  jobId: string;
  odometerKm?: number | null;
  fuelEighths?: number | null;
  damage?: DamageMark[];
  documents?: string[];
  notes?: string | null;
  letGoOwingReason?: string | null;
  signature?: SignatureInput | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ checkId: string; outstandingMinor: number }> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      customerId: true,
      vehicleId: true,
      odometerInKm: true,
      checks: { select: { kind: true } },
    },
  });
  if (!job) throw new ArrivalError('CLOSED', 'That job is not here.');

  const outstandingMinor = await outstandingOn(job.id);
  const odometerKm = input.odometerKm ?? null;
  assertCheckOutAllowed({
    jobStatus: job.status,
    checkedIn: job.checks.some((c) => c.kind === 'IN'),
    alreadyOut: job.checks.some((c) => c.kind === 'OUT'),
    outstandingMinor,
    letGoOwingReason: input.letGoOwingReason,
    odometerKm,
    odometerInKm: job.odometerInKm,
    fuelEighths: input.fuelEighths,
  });
  if (input.signature) assertSigned({ signature: input.signature, name: input.signature.name });

  const damage = (input.damage ?? []).filter((mark) => mark.area?.trim());
  const documents = (input.documents ?? []).map((d) => d.trim()).filter(Boolean);

  const checkId = await prisma.$transaction(async (tx) => {
    const signatureId = input.signature
      ? await writeSignature(tx, {
          orgId: input.orgId,
          purpose: 'CHECK_OUT',
          jobId: job.id,
          customerId: job.customerId,
          capturedByUserId: input.userId,
          ip: input.ip,
          userAgent: input.userAgent,
          signature: input.signature,
        })
      : null;

    const check = await tx.vehicleCheck.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        kind: 'OUT',
        odometerKm,
        fuelEighths: input.fuelEighths ?? null,
        damage: damage as unknown as object,
        documents: documents as unknown as object,
        notes: input.notes?.trim() || null,
        letGoOwingReason: outstandingMinor > 0 ? input.letGoOwingReason?.trim() || null : null,
        signatureId,
        performedByUserId: input.userId,
      },
      select: { id: true },
    });

    await tx.keyEvent.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        action: 'HANDED_TO_CUSTOMER',
        byUserId: input.userId,
      },
    });

    await tx.job.update({
      where: { id: job.id },
      data: { collectedAt: new Date(), odometerOutKm: odometerKm ?? undefined },
    });

    if (odometerKm !== null) {
      await tx.odometerReading.create({
        data: {
          vehicleId: job.vehicleId,
          km: odometerKm,
          readAt: new Date(),
          source: 'WORKSHOP',
          recordedByOrgId: input.orgId,
        },
      });
      await tx.vehicle.update({
        where: { id: job.vehicleId },
        data: { lastOdometerKm: odometerKm },
      });
    }

    return check.id;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'job.checked_out',
    entityType: 'Job',
    entityId: job.id,
    after: {
      checkId,
      odometerKm,
      outstandingMinor,
      letGoOwingReason: outstandingMinor > 0 ? input.letGoOwingReason?.trim() || null : null,
      documents,
      signed: Boolean(input.signature),
    },
  });

  return { checkId, outstandingMinor };
}

/* ---------------------------------------------------------------------------
   Keys
   --------------------------------------------------------------------------- */

export async function moveKeys(input: {
  orgId: string;
  userId: string;
  jobId: string;
  action: KeyAction;
  hook?: string | null;
}): Promise<KeyState> {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, orgId: input.orgId },
    select: {
      id: true,
      keyEvents: {
        orderBy: { at: 'asc' },
        select: { action: true, hook: true, at: true, by: { select: { name: true } } },
      },
    },
  });
  if (!job) throw new ArrivalError('CLOSED', 'That job is not here.');

  const current = keyState(
    job.keyEvents.map((e) => ({
      action: e.action,
      hook: e.hook,
      byName: e.by?.name ?? null,
      at: e.at,
    })),
  );
  assertKeyMove({ action: input.action, hook: input.hook, current });

  const hook =
    input.action === 'HUNG' || input.action === 'RETURNED'
      ? input.hook?.trim() || current.hook
      : null;

  const event = await prisma.keyEvent.create({
    data: { orgId: input.orgId, jobId: job.id, action: input.action, hook, byUserId: input.userId },
    select: { action: true, hook: true, at: true, by: { select: { name: true } } },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: `keys.${input.action.toLowerCase()}`,
    entityType: 'Job',
    entityId: job.id,
    after: { hook },
  });

  return keyState([
    ...job.keyEvents.map((e) => ({
      action: e.action,
      hook: e.hook,
      byName: e.by?.name ?? null,
      at: e.at,
    })),
    { action: event.action, hook: event.hook, byName: event.by?.name ?? null, at: event.at },
  ]);
}

/* ---------------------------------------------------------------------------
   Reading it back
   --------------------------------------------------------------------------- */

export interface CheckView {
  id: string;
  kind: 'IN' | 'OUT';
  at: Date;
  by: string | null;
  odometerKm: number | null;
  fuelEighths: number | null;
  damage: DamageMark[];
  belongings: string | null;
  documents: string[];
  notes: string | null;
  keysHook: string | null;
  letGoOwingReason: string | null;
  signedBy: string | null;
  signatureId: string | null;
  photos: { id: string; src: string | null; caption: string | null }[];
}

/** Both checks, the key state and the movements, for the job page. */
export async function arrivalFor(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: {
      collectedAt: true,
      checks: {
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: { select: { name: true } },
          signature: { select: { id: true, signedByName: true } },
          photos: { orderBy: { createdAt: 'asc' }, select: { id: true, url: true, caption: true } },
        },
      },
      keyEvents: {
        orderBy: { at: 'asc' },
        select: { id: true, action: true, hook: true, at: true, by: { select: { name: true } } },
      },
    },
  });
  if (!job) return null;

  const checks: CheckView[] = [];
  for (const check of job.checks) {
    checks.push({
      id: check.id,
      kind: check.kind,
      at: check.createdAt,
      by: check.performedBy?.name ?? null,
      odometerKm: check.odometerKm,
      fuelEighths: check.fuelEighths,
      damage: Array.isArray(check.damage) ? (check.damage as unknown as DamageMark[]) : [],
      belongings: check.belongings,
      documents: Array.isArray(check.documents) ? (check.documents as string[]) : [],
      notes: check.notes,
      keysHook: check.keysHook,
      letGoOwingReason: check.letGoOwingReason,
      signedBy: check.signature?.signedByName ?? null,
      signatureId: check.signature?.id ?? null,
      photos: await Promise.all(
        check.photos.map(async (p) => ({
          id: p.id,
          src: await readUrlFor(p.url),
          caption: p.caption,
        })),
      ),
    });
  }

  const events = job.keyEvents.map((e) => ({
    id: e.id,
    action: e.action,
    hook: e.hook,
    byName: e.by?.name ?? null,
    at: e.at,
  }));

  return {
    in: checks.find((c) => c.kind === 'IN') ?? null,
    out: checks.find((c) => c.kind === 'OUT') ?? null,
    collectedAt: job.collectedAt,
    keys: keyState(events),
    keyEvents: events,
  };
}

/** The strokes of one signature, for drawing it. Scoped to the workshop. */
export async function signatureFor(orgId: string, signatureId: string) {
  return prisma.signature.findFirst({
    where: { id: signatureId, orgId },
    select: {
      id: true,
      purpose: true,
      signedByName: true,
      strokes: true,
      width: true,
      height: true,
      signedAt: true,
      capturedBy: { select: { name: true } },
    },
  });
}

/**
 * Records a photograph taken at a check, once the store has confirmed it.
 * Same shape as an inspection photograph: the bytes went straight to the
 * store; this writes the row.
 */
export async function attachCheckPhoto(input: {
  orgId: string;
  userId: string;
  checkId: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
}): Promise<string> {
  const check = await prisma.vehicleCheck.findFirst({
    where: { id: input.checkId, orgId: input.orgId },
    select: { id: true, jobId: true },
  });
  if (!check) throw new ArrivalError('NOT_IN', 'No such check on this job.');

  const photo = await prisma.jobAttachment.create({
    data: {
      jobId: check.jobId,
      checkId: check.id,
      kind: 'PHOTO',
      url: input.key,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      caption: input.caption ?? null,
      isCustomerVisible: true,
      uploadedByUserId: input.userId,
    },
    select: { id: true },
  });
  return photo.id;
}

/** Reads a form's signature fields into the shape the rules check. */
export function signatureFromForm(formData: FormData): SignatureInput | null {
  const raw = String(formData.get('signature') ?? '').trim();
  const name = String(formData.get('signedByName') ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { strokes?: unknown; width?: unknown; height?: unknown };
    if (!Array.isArray(parsed.strokes)) return null;
    return {
      name,
      strokes: parsed.strokes as SignatureStrokes['strokes'],
      width: Number(parsed.width ?? 0),
      height: Number(parsed.height ?? 0),
    };
  } catch {
    return null;
  }
}
