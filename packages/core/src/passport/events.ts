import type { ChainableEvent } from './chain.js';

/**
 * Building passport events from workshop work.
 *
 * Completing a job is the moment the workshop's operational record becomes
 * part of the vehicle's permanent history (FR-408, story C3). This module
 * turns a completed job into the set of events that describes it.
 *
 * The events are deliberately written for a reader who is not a mechanic.
 * David (persona P5) reads them in a driveway with no context, so
 * "Front brake pads and discs replaced" beats "BRK-PAD-FRT x1, BRK-DSC-FRT x2".
 * The structured detail stays in the payload for machines; the title and
 * summary are for people.
 */

export type VehicleEventType =
  | 'OWNERSHIP_TRANSFER'
  | 'REGISTRATION_CHANGE'
  | 'MILEAGE_READING'
  | 'SERVICE'
  | 'REPAIR'
  | 'PART_FITTED'
  | 'INSPECTION'
  | 'TIRE'
  | 'ACCIDENT'
  | 'RECALL_NOTICE'
  | 'RECALL_PERFORMED'
  | 'MODIFICATION'
  | 'MAINTENANCE'
  | 'IMPORT'
  | 'WRITE_OFF'
  | 'NOTE';

export type VerificationLevel =
  | 'SELF_REPORTED'
  | 'WORKSHOP_RECORDED'
  | 'WORKSHOP_VERIFIED'
  | 'AUTHORITY';

export interface DraftEvent extends Omit<ChainableEvent, 'sequence'> {
  type: VehicleEventType;
  title: string;
  summary: string | null;
  verification: VerificationLevel;
  /**
   * Stable identity for this event derived from its cause, so replaying a
   * failed job-completion does not append the same fact twice. Story C3.
   */
  idempotencyKey: string;
}

export interface CompletedJobInput {
  jobId: string;
  jobNumber: number;
  vehicleId: string;
  orgId: string;
  orgName: string;
  completedAt: Date;
  shortDescription: string;
  diagnosis?: string | null;
  odometerKm?: number | null;
  jobTypeNames?: readonly string[];
  labour: readonly { description: string; hours: number }[];
  parts: readonly {
    id: string;
    description: string;
    partNumber?: string | null;
    quantity: number;
  }[];
  inspection?: {
    id: string;
    passCount: number;
    advisoryCount: number;
    criticalCount: number;
    performedBy?: string | null;
  } | null;
  hasPhotoEvidence?: boolean;
}

/**
 * The events a completed job contributes.
 *
 * Note the verification level: WORKSHOP_VERIFIED only when photographs back
 * the record. The distinction is the difference between "a garage typed this"
 * and "a garage typed this and here is the picture", and a buyer is entitled
 * to weigh those differently.
 */
export function eventsForCompletedJob(job: CompletedJobInput): DraftEvent[] {
  const events: DraftEvent[] = [];
  const verification: VerificationLevel = job.hasPhotoEvidence
    ? 'WORKSHOP_VERIFIED'
    : 'WORKSHOP_RECORDED';

  const base = {
    vehicleId: job.vehicleId,
    occurredAt: job.completedAt,
    odometerKm: job.odometerKm ?? null,
    recordedByOrgId: job.orgId,
    supersedesId: null,
  };

  // 1. The work itself. Service or repair, decided by the job types, because
  // "serviced" and "repaired" mean genuinely different things to a buyer.
  const isService = (job.jobTypeNames ?? []).some((name) => /service|maintenance/i.test(name));

  events.push({
    ...base,
    type: isService ? 'SERVICE' : 'REPAIR',
    title: job.shortDescription,
    summary: buildWorkSummary(job),
    verification,
    idempotencyKey: `job:${job.jobId}:work`,
    payload: {
      jobId: job.jobId,
      jobNumber: job.jobNumber,
      workshop: job.orgName,
      description: job.shortDescription,
      diagnosis: job.diagnosis ?? null,
      jobTypes: job.jobTypeNames ?? [],
      labour: job.labour.map((l) => ({ description: l.description, hours: l.hours })),
      totalHours: job.labour.reduce((total, l) => total + l.hours, 0),
    },
  });

  // 2. One event per part. Granular on purpose: "which brake pads went in, and
  // when" is the single most useful question a future mechanic can answer from
  // the history, and it is unanswerable if parts are bundled into prose.
  for (const part of job.parts) {
    events.push({
      ...base,
      type: 'PART_FITTED',
      title: `${part.description} fitted`,
      summary: part.partNumber ? `Part number ${part.partNumber}` : null,
      verification,
      idempotencyKey: `job:${job.jobId}:part:${part.id}`,
      payload: {
        jobId: job.jobId,
        description: part.description,
        partNumber: part.partNumber ?? null,
        quantity: part.quantity,
        workshop: job.orgName,
      },
    });
  }

  // 3. The inspection, with its counts, so a reader can see the vehicle was
  // actually examined rather than merely worked on.
  if (job.inspection) {
    const { passCount, advisoryCount, criticalCount } = job.inspection;
    events.push({
      ...base,
      type: 'INSPECTION',
      title: 'Vehicle inspection carried out',
      summary: `${passCount} passed, ${advisoryCount} advisory, ${criticalCount} critical`,
      verification,
      idempotencyKey: `job:${job.jobId}:inspection:${job.inspection.id}`,
      payload: {
        jobId: job.jobId,
        inspectionId: job.inspection.id,
        passCount,
        advisoryCount,
        criticalCount,
        performedBy: job.inspection.performedBy ?? null,
        workshop: job.orgName,
      },
    });
  }

  // 4. The odometer. Its own event rather than only an attribute, because
  // mileage continuity is what exposes odometer fraud, and that analysis
  // needs every reading as a first-class fact.
  if (job.odometerKm !== null && job.odometerKm !== undefined) {
    events.push({
      ...base,
      type: 'MILEAGE_READING',
      title: `${job.odometerKm.toLocaleString()} km recorded`,
      summary: `Read at ${job.orgName} during job ${job.jobNumber}`,
      verification,
      idempotencyKey: `job:${job.jobId}:odometer`,
      payload: { jobId: job.jobId, km: job.odometerKm, workshop: job.orgName },
    });
  }

  return events;
}

function buildWorkSummary(job: CompletedJobInput): string | null {
  const pieces: string[] = [];

  if (job.diagnosis?.trim()) {
    pieces.push(job.diagnosis.trim());
  }

  if (job.parts.length > 0) {
    const names = job.parts.slice(0, 3).map((p) => p.description);
    const extra = job.parts.length - names.length;
    pieces.push(
      `Parts fitted: ${names.join(', ')}${extra > 0 ? ` and ${extra} more` : ''}.`,
    );
  }

  const hours = job.labour.reduce((total, l) => total + l.hours, 0);
  if (hours > 0) {
    pieces.push(`${round1(hours)} hours of labour.`);
  }

  return pieces.length > 0 ? pieces.join(' ') : null;
}

export function ownershipTransferEvent(input: {
  vehicleId: string;
  occurredAt: Date;
  fromOwnerName: string | null;
  toOwnerName: string;
  odometerKm?: number | null;
  recordedByOrgId?: string | null;
  transferId: string;
}): DraftEvent {
  return {
    vehicleId: input.vehicleId,
    type: 'OWNERSHIP_TRANSFER',
    occurredAt: input.occurredAt,
    odometerKm: input.odometerKm ?? null,
    recordedByOrgId: input.recordedByOrgId ?? null,
    supersedesId: null,
    title: 'Ownership transferred',
    summary: input.fromOwnerName
      ? `From ${input.fromOwnerName} to ${input.toOwnerName}`
      : `To ${input.toOwnerName}`,
    // The owner asserts the transfer. It becomes AUTHORITY only when a
    // registry confirms it, which we do not have a feed for yet.
    verification: 'SELF_REPORTED',
    idempotencyKey: `transfer:${input.transferId}`,
    payload: {
      from: input.fromOwnerName,
      to: input.toOwnerName,
      transferId: input.transferId,
    },
  };
}

export function mileageEvent(input: {
  vehicleId: string;
  km: number;
  readAt: Date;
  source: string;
  recordedByOrgId?: string | null;
  readingId: string;
  anomaly?: 'NONE' | 'DECREASE' | 'IMPLAUSIBLE_RATE';
}): DraftEvent {
  const flagged = input.anomaly && input.anomaly !== 'NONE';

  return {
    vehicleId: input.vehicleId,
    type: 'MILEAGE_READING',
    occurredAt: input.readAt,
    odometerKm: input.km,
    recordedByOrgId: input.recordedByOrgId ?? null,
    supersedesId: null,
    title: `${input.km.toLocaleString()} km recorded`,
    summary: flagged ? `Flagged: ${describeAnomaly(input.anomaly)}` : null,
    verification: input.recordedByOrgId ? 'WORKSHOP_RECORDED' : 'SELF_REPORTED',
    idempotencyKey: `odometer:${input.readingId}`,
    payload: { km: input.km, source: input.source, anomaly: input.anomaly ?? 'NONE' },
  };
}

function describeAnomaly(anomaly?: string): string {
  switch (anomaly) {
    case 'DECREASE':
      return 'lower than a previous reading';
    case 'IMPLAUSIBLE_RATE':
      return 'implies an unusually high daily distance';
    default:
      return 'anomaly';
  }
}

/** Human label for a type, used on the timeline. */
export function humaniseEventType(type: VehicleEventType): string {
  const labels: Record<VehicleEventType, string> = {
    OWNERSHIP_TRANSFER: 'Ownership',
    REGISTRATION_CHANGE: 'Registration',
    MILEAGE_READING: 'Mileage',
    SERVICE: 'Service',
    REPAIR: 'Repair',
    PART_FITTED: 'Part',
    INSPECTION: 'Inspection',
    TIRE: 'Tires',
    ACCIDENT: 'Accident',
    RECALL_NOTICE: 'Recall issued',
    RECALL_PERFORMED: 'Recall done',
    MODIFICATION: 'Modification',
    MAINTENANCE: 'Maintenance',
    IMPORT: 'Import',
    WRITE_OFF: 'Write-off',
    NOTE: 'Note',
  };
  return labels[type];
}

export function describeVerification(level: VerificationLevel): string {
  switch (level) {
    case 'SELF_REPORTED':
      return 'Reported by the owner';
    case 'WORKSHOP_RECORDED':
      return 'Recorded by a workshop';
    case 'WORKSHOP_VERIFIED':
      return 'Recorded by a workshop with photographic evidence';
    case 'AUTHORITY':
      return 'Supplied by an official source';
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
