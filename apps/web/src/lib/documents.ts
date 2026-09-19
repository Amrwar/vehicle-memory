import {
  assertDocumentAcceptable,
  assertRemovable,
  type DocumentActor,
  DocumentError,
  type DocumentKind,
  expiryState,
  paperworkSummary,
  SOON_DAYS,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { orgCanReadVehicle } from './passport';
import { readUrlFor } from './storage';

/**
 * The vehicle's paperwork, against the database. Phase 20.
 *
 * Two kinds of caller: a workshop with access to the vehicle, and the person
 * who owns it, from the portal. Both see the same list. Removal is for the
 * workshop that added a document or the owner, and keeps the row.
 */

export { DocumentError };

const SELECT = {
  id: true,
  kind: true,
  title: true,
  reference: true,
  issuedAt: true,
  expiresAt: true,
  fileKey: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  note: true,
  uploadedByOrgId: true,
  uploadedByUserId: true,
  removedAt: true,
  removedReason: true,
  createdAt: true,
  uploadedByOrg: { select: { name: true } },
} as const;

/** Whether this person currently owns the vehicle. */
export async function ownsVehicle(userId: string, vehicleId: string): Promise<boolean> {
  const ownership = await prisma.vehicleOwnership.findFirst({
    where: { vehicleId, ownerUserId: userId, endedAt: null },
    select: { id: true },
  });
  return ownership !== null;
}

/**
 * May this caller see, and add to, the vehicle's paperwork? A workshop with
 * read access, or the owner. Anybody else gets nothing rather than a refusal
 * that confirms the vehicle exists.
 */
export async function mayHandleDocuments(actor: {
  orgId: string | null;
  userId: string;
  vehicleId: string;
}): Promise<DocumentActor | null> {
  const owns = await ownsVehicle(actor.userId, actor.vehicleId);
  if (owns) return { orgId: actor.orgId, userId: actor.userId, ownsVehicle: true };

  if (actor.orgId && (await orgCanReadVehicle(actor.orgId, actor.vehicleId))) {
    return { orgId: actor.orgId, userId: actor.userId, ownsVehicle: false };
  }

  return null;
}

export async function addDocument(input: {
  actor: DocumentActor;
  vehicleId: string;
  kind: DocumentKind;
  title: string;
  reference?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  fileKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  note?: string | null;
}): Promise<string> {
  assertDocumentAcceptable(input);

  const document = await prisma.vehicleDocument.create({
    data: {
      vehicleId: input.vehicleId,
      kind: input.kind,
      title: input.title.trim().slice(0, 120),
      reference: input.reference?.trim() || null,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      fileKey: input.fileKey,
      filename: input.filename.slice(0, 200),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      note: input.note?.trim() || null,
      // The owner adds as themselves; a workshop adds as the workshop, with
      // the person recorded too.
      uploadedByOrgId: input.actor.ownsVehicle ? null : input.actor.orgId,
      uploadedByUserId: input.actor.userId,
    },
    select: { id: true },
  });

  await audit({
    orgId: input.actor.ownsVehicle ? null : input.actor.orgId,
    actorUserId: input.actor.userId,
    action: 'vehicle.document.added',
    entityType: 'Vehicle',
    entityId: input.vehicleId,
    after: {
      documentId: document.id,
      kind: input.kind,
      title: input.title.trim(),
      bytes: input.sizeBytes,
    },
  });

  return document.id;
}

export async function removeDocument(input: {
  actor: DocumentActor;
  documentId: string;
  reason: string;
}): Promise<void> {
  const document = await prisma.vehicleDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      vehicleId: true,
      title: true,
      uploadedByOrgId: true,
      uploadedByUserId: true,
      removedAt: true,
    },
  });
  if (!document) throw new DocumentError('GONE', 'That document is not on record.');

  assertRemovable(document, input.actor, input.reason);

  await prisma.vehicleDocument.update({
    where: { id: document.id },
    data: { removedAt: new Date(), removedReason: input.reason.trim() },
  });

  await audit({
    orgId: input.actor.ownsVehicle ? null : input.actor.orgId,
    actorUserId: input.actor.userId,
    action: 'vehicle.document.removed',
    entityType: 'Vehicle',
    entityId: document.vehicleId,
    before: { documentId: document.id, title: document.title },
    after: { reason: input.reason.trim() },
  });
}

export interface DocumentView {
  id: string;
  kind: DocumentKind;
  title: string;
  reference: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  expiry: ReturnType<typeof expiryState>;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  addedBy: string;
  createdAt: Date;
  url: string | null;
  mayRemove: boolean;
}

/** The live paperwork on a vehicle, with links that can be opened, as this actor sees it. */
export async function documentsFor(
  vehicleId: string,
  actor: DocumentActor,
): Promise<DocumentView[]> {
  // bounded: the paperwork on one car.
  const rows = await prisma.vehicleDocument.findMany({
    where: { vehicleId, removedAt: null },
    orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    select: SELECT,
  });

  const now = new Date();

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      reference: row.reference,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      expiry: expiryState(row.expiresAt, now),
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      note: row.note,
      addedBy: row.uploadedByOrg?.name ?? 'The owner',
      createdAt: row.createdAt,
      url: await readUrlFor(row.fileKey),
      mayRemove:
        actor.ownsVehicle ||
        (actor.orgId !== null && row.uploadedByOrgId === actor.orgId) ||
        row.uploadedByUserId === actor.userId,
    })),
  );
}

/** The one line and the two dates for the top of a vehicle page. */
export async function paperworkFor(vehicleId: string) {
  // bounded: the paperwork on one car, including what has been taken off it.
  const rows = await prisma.vehicleDocument.findMany({
    where: { vehicleId },
    select: { kind: true, expiresAt: true, removedAt: true },
  });
  return paperworkSummary(rows);
}

/**
 * Paperwork running out on the vehicles this workshop looks after: the
 * latest live MOT or insurance on each, expiring within the window or already
 * gone. For the reminders page, next to the services due.
 */
export async function paperworkDue(orgId: string, withinDays = SOON_DAYS) {
  const horizon = new Date(Date.now() + withinDays * 86_400_000);

  const rows = await prisma.vehicleDocument.findMany({
    where: {
      removedAt: null,
      kind: { in: ['MOT_CERTIFICATE', 'INSURANCE'] },
      expiresAt: { lte: horizon },
      vehicle: { jobs: { some: { orgId } } },
    },
    orderBy: { expiresAt: 'asc' },
    take: 200,
    select: {
      id: true,
      kind: true,
      expiresAt: true,
      vehicle: {
        select: {
          id: true,
          registration: true,
          make: true,
          model: true,
          jobs: {
            where: { orgId },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { customer: { select: { id: true, displayName: true } } },
          },
        },
      },
    },
  });

  // Only the latest certificate of each kind per vehicle counts: an old MOT
  // under a newer one is history, not a lapse. A newer one that expires after
  // the horizon means the vehicle is covered and is not listed at all.
  const latest = await prisma.vehicleDocument.groupBy({
    by: ['vehicleId', 'kind'],
    where: {
      removedAt: null,
      kind: { in: ['MOT_CERTIFICATE', 'INSURANCE'] },
      vehicleId: { in: rows.map((row) => row.vehicle.id) },
    },
    _max: { expiresAt: true },
  });
  const newest = new Map(
    latest.map((entry) => [`${entry.vehicleId}:${entry.kind}`, entry._max.expiresAt]),
  );

  const now = new Date();

  return rows
    .filter(
      (row) => newest.get(`${row.vehicle.id}:${row.kind}`)?.getTime() === row.expiresAt?.getTime(),
    )
    .map((row) => ({
      documentId: row.id,
      kind: row.kind as DocumentKind,
      expiresAt: row.expiresAt!,
      state: expiryState(row.expiresAt, now),
      vehicleId: row.vehicle.id,
      vehicle: [row.vehicle.make, row.vehicle.model].filter(Boolean).join(' ') || 'Vehicle',
      registration: row.vehicle.registration,
      customer: row.vehicle.jobs[0]?.customer ?? null,
    }));
}
