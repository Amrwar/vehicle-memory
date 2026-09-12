/**
 * The vehicle's paperwork.
 *
 * A car comes with paper: the registration certificate, the MOT certificate,
 * the insurance schedule, the receipts for the work, and the photographs
 * somebody took of the dent before it was repaired. Until Phase 20 none of it
 * had anywhere to live in the passport, so it lived in a glovebox.
 *
 * Documents belong to the car, on the same rule as events: a workshop that
 * may read the vehicle may read its paperwork, and so may the owner. What
 * differs from events is that a document can be removed, because a scan of
 * the wrong car is not history, it is a mistake; a removed document keeps its
 * row and its reason, so the removal is history.
 */

export type DocumentKind =
  | 'PHOTO'
  | 'REGISTRATION_CERTIFICATE'
  | 'MOT_CERTIFICATE'
  | 'INSURANCE'
  | 'SERVICE_RECORD'
  | 'PURCHASE_INVOICE'
  | 'OTHER';

export const DOCUMENT_KINDS: readonly { kind: DocumentKind; label: string; expires: boolean }[] = [
  { kind: 'PHOTO', label: 'Photograph', expires: false },
  { kind: 'REGISTRATION_CERTIFICATE', label: 'Registration certificate', expires: false },
  { kind: 'MOT_CERTIFICATE', label: 'MOT certificate', expires: true },
  { kind: 'INSURANCE', label: 'Insurance', expires: true },
  { kind: 'SERVICE_RECORD', label: 'Service record', expires: false },
  { kind: 'PURCHASE_INVOICE', label: 'Purchase invoice', expires: false },
  { kind: 'OTHER', label: 'Other', expires: false },
];

export function documentKindLabel(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((entry) => entry.kind === kind)?.label ?? 'Document';
}

export const IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];
export const DOCUMENT_TYPES: readonly string[] = [...IMAGE_TYPES, 'application/pdf'];
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

export class DocumentError extends Error {
  constructor(
    readonly code:
      'NO_TITLE' | 'BAD_TYPE' | 'TOO_LARGE' | 'BAD_DATES' | 'NOT_ALLOWED' | 'NO_REASON' | 'GONE',
    message: string,
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

export interface DocumentDraft {
  kind: DocumentKind;
  title: string;
  mimeType: string;
  sizeBytes: number;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
}

export function assertDocumentAcceptable(draft: DocumentDraft): void {
  if (!draft.title.trim()) {
    throw new DocumentError(
      'NO_TITLE',
      'Give the document a title somebody will recognise in a list: "MOT 2026", "Front bumper before repair".',
    );
  }

  const allowed = draft.kind === 'PHOTO' ? IMAGE_TYPES : DOCUMENT_TYPES;
  if (!allowed.includes(draft.mimeType)) {
    throw new DocumentError(
      'BAD_TYPE',
      draft.kind === 'PHOTO'
        ? 'A photograph is a picture from the camera: JPEG, PNG, WebP or HEIC.'
        : 'A document is a PDF or a picture of the paper: JPEG, PNG, WebP or HEIC.',
    );
  }

  if (!Number.isFinite(draft.sizeBytes) || draft.sizeBytes <= 0) {
    throw new DocumentError('TOO_LARGE', 'That file is empty.');
  }

  if (draft.sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new DocumentError(
      'TOO_LARGE',
      `That file is ${Math.round(draft.sizeBytes / 1024 / 1024)}MB. The limit is ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`,
    );
  }

  if (draft.issuedAt && draft.expiresAt && draft.expiresAt < draft.issuedAt) {
    throw new DocumentError('BAD_DATES', 'A document does not expire before it was issued.');
  }
}

export type ExpiryState = 'NONE' | 'OK' | 'SOON' | 'EXPIRED';

/** Within thirty days is "soon": long enough to book a test, short enough to mean it. */
export const SOON_DAYS = 30;

export function expiryState(expiresAt: Date | null | undefined, now = new Date()): ExpiryState {
  if (!expiresAt) return 'NONE';
  const days = (expiresAt.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 'EXPIRED';
  if (days <= SOON_DAYS) return 'SOON';
  return 'OK';
}

export function describeExpiry(expiresAt: Date | null | undefined, now = new Date()): string {
  const state = expiryState(expiresAt, now);
  if (state === 'NONE' || !expiresAt) return 'No expiry';
  const when = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (state === 'EXPIRED') return `Expired ${when}`;
  if (state === 'SOON') return `Runs out ${when}`;
  return `Valid until ${when}`;
}

export interface PaperworkItem {
  kind: DocumentKind;
  expiresAt: Date | null;
  removedAt: Date | null;
}

export interface PaperworkSummary {
  /** Live documents, by kind. */
  counts: Partial<Record<DocumentKind, number>>;
  motExpiresAt: Date | null;
  insuranceExpiresAt: Date | null;
  mot: ExpiryState;
  insurance: ExpiryState;
  /** One line for the top of the page. */
  statement: string;
}

/**
 * The latest live certificate of each kind decides the vehicle's cover. An
 * older MOT certificate under a newer one is history, not a lapse.
 */
export function paperworkSummary(
  documents: readonly PaperworkItem[],
  now = new Date(),
): PaperworkSummary {
  const live = documents.filter((document) => document.removedAt === null);

  const counts: Partial<Record<DocumentKind, number>> = {};
  for (const document of live) counts[document.kind] = (counts[document.kind] ?? 0) + 1;

  const latest = (kind: DocumentKind): Date | null =>
    live
      .filter((document) => document.kind === kind && document.expiresAt)
      .map((document) => document.expiresAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const motExpiresAt = latest('MOT_CERTIFICATE');
  const insuranceExpiresAt = latest('INSURANCE');
  const mot = expiryState(motExpiresAt, now);
  const insurance = expiryState(insuranceExpiresAt, now);

  const parts: string[] = [];
  if (live.length === 0) {
    parts.push('No paperwork on this vehicle yet.');
  } else {
    parts.push(`${live.length} document${live.length === 1 ? '' : 's'} on file.`);
  }
  if (mot === 'EXPIRED') parts.push('The MOT has expired.');
  else if (mot === 'SOON')
    parts.push(
      `The MOT runs out on ${motExpiresAt!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
    );
  if (insurance === 'EXPIRED') parts.push('The insurance has expired.');
  else if (insurance === 'SOON')
    parts.push(
      `The insurance runs out on ${insuranceExpiresAt!.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
    );

  return { counts, motExpiresAt, insuranceExpiresAt, mot, insurance, statement: parts.join(' ') };
}

export interface DocumentActor {
  orgId: string | null;
  userId: string;
  /** Whether the person currently owns the vehicle. */
  ownsVehicle: boolean;
}

/**
 * Who may remove a document: the workshop that added it, or the vehicle's
 * current owner. Not another workshop, however much access it has to read.
 */
export function mayRemoveDocument(
  document: { uploadedByOrgId: string | null; uploadedByUserId: string | null },
  actor: DocumentActor,
): boolean {
  if (actor.ownsVehicle) return true;
  if (actor.orgId && document.uploadedByOrgId === actor.orgId) return true;
  return document.uploadedByUserId !== null && document.uploadedByUserId === actor.userId;
}

export function assertRemovable(
  document: {
    uploadedByOrgId: string | null;
    uploadedByUserId: string | null;
    removedAt: Date | null;
  },
  actor: DocumentActor,
  reason: string,
): void {
  if (document.removedAt) throw new DocumentError('GONE', 'That document was already removed.');
  if (!mayRemoveDocument(document, actor)) {
    throw new DocumentError(
      'NOT_ALLOWED',
      'Only the workshop that added a document, or the vehicle’s owner, can remove it.',
    );
  }
  if (!reason.trim()) {
    throw new DocumentError(
      'NO_REASON',
      'Say why it is being removed. The removal stays on the record; the reason is what makes it readable later.',
    );
  }
}
