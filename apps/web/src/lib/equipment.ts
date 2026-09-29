import {
  certificateDueSoon,
  daysOfCertificateLeft,
  EQUIPMENT_STATE_SENTENCE,
  type EquipmentState,
  equipmentWorstFirst,
  jobCanRun,
  serviceDueAt,
  serviceOverdue,
  stateOf,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The machines, and whether the work can start on them.
 *
 * Nothing in the database says whether a machine is usable. It is derived
 * here, every time, from the certificate expiry and the clock — which is the
 * whole point of the phase: a lift whose statutory inspection lapsed at
 * midnight is unusable at nine, with nobody having pressed anything. A stored
 * flag would have stayed true until somebody remembered, and the day anybody
 * remembers is not the day it expired.
 *
 * "In use" is derived too, and from records that already exist: a job on the
 * bench whose type requires this machine. No second table, no start/stop
 * button somebody forgets to press, and nothing to go stale the first time a
 * technician goes home without clocking off.
 *
 * Phase 89.
 */

export class EquipmentError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'IN_USE_BY_A_JOB_TYPE' | 'NEEDS_A_REASON' | 'BAD_DATES',
    message: string,
  ) {
    super(message);
    this.name = 'EquipmentError';
  }
}

const SELECT = {
  id: true,
  name: true,
  code: true,
  serialNumber: true,
  notes: true,
  isActive: true,
  locationId: true,
  location: { select: { name: true } },
  outOfServiceSince: true,
  outOfServiceReason: true,
  certificateRef: true,
  certifiedAt: true,
  certificateExpiresAt: true,
  certifiedBy: true,
  serviceEveryMonths: true,
  servicedAt: true,
} as const;

type Row = {
  id: string;
  name: string;
  isActive: boolean;
  outOfServiceSince: Date | null;
  certificateExpiresAt: Date | null;
  serviceEveryMonths: number | null;
  servicedAt: Date | null;
};

/**
 * How many jobs on the bench need each machine.
 *
 * One query for all of them rather than one per machine, because an equipment
 * list is a screen an owner leaves open and a query per row is how a screen
 * gets slow enough to stop being left open.
 */
async function busyCounts(orgId: string): Promise<Map<string, number>> {
  const rows = await prisma.jobTypeEquipment.findMany({
    where: {
      equipment: { orgId },
      jobType: { jobs: { some: { job: { orgId, status: 'IN_PROGRESS' } } } },
    },
    select: {
      equipmentId: true,
      jobType: {
        select: {
          _count: { select: { jobs: { where: { job: { orgId, status: 'IN_PROGRESS' } } } } },
        },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.equipmentId, (counts.get(row.equipmentId) ?? 0) + row.jobType._count.jobs);
  }
  return counts;
}

function decorate(row: Row, busy: number, now: Date) {
  const facts = {
    retired: !row.isActive,
    outOfServiceSince: row.outOfServiceSince,
    certificateExpiresAt: row.certificateExpiresAt,
    inUseOnJobs: busy,
  };

  const state = stateOf(facts, now);

  return {
    state,
    stateSentence: EQUIPMENT_STATE_SENTENCE[state],
    daysLeft: daysOfCertificateLeft(facts, now),
    dueSoon: certificateDueSoon(facts, now),
    serviceOverdue: serviceOverdue(row, now),
    serviceDueAt: serviceDueAt(row),
    busyOn: busy,
  };
}

/** Every machine, worst first, each with what is most importantly true of it. */
export async function theMachines(orgId: string, now = new Date()) {
  const [rows, busy] = await Promise.all([
    prisma.equipment.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      select: { ...SELECT, jobTypes: { select: { jobType: { select: { name: true } } } } },
    }),
    busyCounts(orgId),
  ]);

  return equipmentWorstFirst(
    rows.map((row) => ({
      ...row,
      neededBy: row.jobTypes.map((one) => one.jobType.name),
      ...decorate(row, busy.get(row.id) ?? 0, now),
    })),
  );
}

/** One machine, for a screen that edits it. */
export async function oneMachine(orgId: string, equipmentId: string, now = new Date()) {
  const row = await prisma.equipment.findFirst({
    where: { id: equipmentId, orgId },
    select: { ...SELECT, jobTypes: { select: { jobType: { select: { id: true, name: true } } } } },
  });
  if (!row) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

  const busy = (await busyCounts(orgId)).get(row.id) ?? 0;
  return { ...row, neededBy: row.jobTypes.map((one) => one.jobType), ...decorate(row, busy, now) };
}

/**
 * The machines one job's kinds of work require, and the state of each.
 *
 * This is what the transition gate reads. A job whose types require nothing
 * gets an empty list, which is every job in every workshop that has not
 * declared a requirement — the gate cannot be reached by anybody with no way
 * to satisfy it, which is the lesson FR-612 took eighty-four phases to teach.
 */
export async function machinesFor(orgId: string, jobId: string, now = new Date()) {
  // bounded: the machines required by one job's kinds of work. A job carries a
  // handful of kinds of work and each names the machines it cannot be done
  // without, so this is single figures in any workshop that could physically
  // hold the equipment.
  const rows = await prisma.jobTypeEquipment.findMany({
    where: {
      equipment: { orgId },
      jobType: { jobs: { some: { jobId } } },
    },
    select: { equipment: { select: SELECT } },
  });

  if (rows.length === 0) return jobCanRun([]);

  const busy = await busyCounts(orgId);

  // One machine may be required by two of a job's kinds of work. It is still
  // one machine, and naming it twice in a refusal reads as two problems.
  const seen = new Map<string, { equipmentId: string; name: string; state: EquipmentState }>();
  for (const row of rows) {
    const machine = row.equipment;
    if (seen.has(machine.id)) continue;
    seen.set(machine.id, {
      equipmentId: machine.id,
      name: machine.name,
      state: decorate(machine, busy.get(machine.id) ?? 0, now).state,
    });
  }

  return jobCanRun([...seen.values()]);
}

/** Record a machine, or change one. */
export async function saveMachine(input: {
  orgId: string;
  userId: string;
  equipmentId?: string | null;
  name: string;
  code: string;
  locationId?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  certificateRef?: string | null;
  certifiedAt?: Date | null;
  certificateExpiresAt?: Date | null;
  certifiedBy?: string | null;
  serviceEveryMonths?: number | null;
  servicedAt?: Date | null;
}): Promise<string> {
  const name = input.name.trim();
  const code = input.code.trim();
  if (!name || !code) {
    throw new EquipmentError('NOT_FOUND', 'A machine needs a name and a code.');
  }

  // The database says this too, and says it second. A certificate that
  // expires before it was issued either grounds a machine that is fine or
  // passes one that is not.
  if (
    input.certifiedAt &&
    input.certificateExpiresAt &&
    input.certifiedAt.getTime() > input.certificateExpiresAt.getTime()
  ) {
    throw new EquipmentError('BAD_DATES', 'A certificate cannot expire before it was issued.');
  }

  const data = {
    name,
    code,
    locationId: input.locationId || null,
    serialNumber: input.serialNumber?.trim() || null,
    notes: input.notes?.trim() || null,
    certificateRef: input.certificateRef?.trim() || null,
    certifiedAt: input.certifiedAt ?? null,
    certificateExpiresAt: input.certificateExpiresAt ?? null,
    certifiedBy: input.certifiedBy?.trim() || null,
    serviceEveryMonths: input.serviceEveryMonths ?? null,
    servicedAt: input.servicedAt ?? null,
  };

  if (input.equipmentId) {
    const existing = await prisma.equipment.findFirst({
      where: { id: input.equipmentId, orgId: input.orgId },
      select: { id: true },
    });
    if (!existing) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

    await prisma.equipment.update({ where: { id: existing.id }, data });
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'equipment.update',
      entityType: 'Equipment',
      entityId: existing.id,
      before: null,
      after: data,
    });
    return existing.id;
  }

  const created = await prisma.equipment.create({
    data: { orgId: input.orgId, ...data },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'equipment.create',
    entityType: 'Equipment',
    entityId: created.id,
    before: null,
    after: data,
  });

  return created.id;
}

/**
 * Take a machine out of service, or put it back.
 *
 * A reason is required to take one out and the database insists on it too: a
 * machine out of service with no reason is a machine nobody can put back,
 * because nobody knows what was wrong with it.
 */
export async function setOutOfService(input: {
  orgId: string;
  userId: string;
  equipmentId: string;
  out: boolean;
  reason?: string | null;
}): Promise<void> {
  const machine = await prisma.equipment.findFirst({
    where: { id: input.equipmentId, orgId: input.orgId },
    select: { id: true, outOfServiceSince: true, outOfServiceReason: true },
  });
  if (!machine) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

  const reason = input.reason?.trim() ?? '';
  if (input.out && reason.length < 3) {
    throw new EquipmentError(
      'NEEDS_A_REASON',
      'Say what is wrong with it, so somebody can fix it.',
    );
  }

  await prisma.equipment.update({
    where: { id: machine.id },
    data: input.out
      ? { outOfServiceSince: new Date(), outOfServiceReason: reason }
      : { outOfServiceSince: null, outOfServiceReason: null },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.out ? 'equipment.out-of-service' : 'equipment.back-in-service',
    entityType: 'Equipment',
    entityId: machine.id,
    before: { reason: machine.outOfServiceReason },
    after: input.out ? { reason } : null,
  });
}

/**
 * Record a fresh certificate.
 *
 * Its own action rather than a field on the edit form, because this is the one
 * that puts a grounded machine back to work and it should be one press with
 * the reference in front of you, not a trip through a form of fourteen boxes.
 */
export async function recordCertificate(input: {
  orgId: string;
  userId: string;
  equipmentId: string;
  reference: string;
  certifiedAt: Date;
  expiresAt: Date;
  by?: string | null;
}): Promise<void> {
  const machine = await prisma.equipment.findFirst({
    where: { id: input.equipmentId, orgId: input.orgId },
    select: { id: true, certificateRef: true, certificateExpiresAt: true },
  });
  if (!machine) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

  if (input.certifiedAt.getTime() > input.expiresAt.getTime()) {
    throw new EquipmentError('BAD_DATES', 'A certificate cannot expire before it was issued.');
  }

  await prisma.equipment.update({
    where: { id: machine.id },
    data: {
      certificateRef: input.reference.trim() || null,
      certifiedAt: input.certifiedAt,
      certificateExpiresAt: input.expiresAt,
      certifiedBy: input.by?.trim() || null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'equipment.certified',
    entityType: 'Equipment',
    entityId: machine.id,
    before: { ref: machine.certificateRef, expires: machine.certificateExpiresAt },
    after: { ref: input.reference, expires: input.expiresAt },
  });
}

/** Record that the machine itself has been serviced. */
export async function recordServiced(input: {
  orgId: string;
  userId: string;
  equipmentId: string;
  at: Date;
}): Promise<void> {
  const machine = await prisma.equipment.findFirst({
    where: { id: input.equipmentId, orgId: input.orgId },
    select: { id: true, servicedAt: true },
  });
  if (!machine) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

  await prisma.equipment.update({ where: { id: machine.id }, data: { servicedAt: input.at } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'equipment.serviced',
    entityType: 'Equipment',
    entityId: machine.id,
    before: { at: machine.servicedAt },
    after: { at: input.at },
  });
}

/**
 * Retire a machine, or bring it back.
 *
 * Never a delete. Old jobs must keep reading the way they did, a workshop that
 * sold a lift still needs to know which work it did, and the database refuses
 * the delete anyway where a kind of work depends on it.
 */
export async function setRetired(input: {
  orgId: string;
  userId: string;
  equipmentId: string;
  retired: boolean;
}): Promise<void> {
  const machine = await prisma.equipment.findFirst({
    where: { id: input.equipmentId, orgId: input.orgId },
    select: { id: true, isActive: true },
  });
  if (!machine) throw new EquipmentError('NOT_FOUND', 'That machine was not found.');

  await prisma.equipment.update({
    where: { id: machine.id },
    data: { isActive: !input.retired },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.retired ? 'equipment.retire' : 'equipment.unretire',
    entityType: 'Equipment',
    entityId: machine.id,
    before: { isActive: machine.isActive },
    after: { isActive: !input.retired },
  });
}

/** Say that a kind of work needs a machine, or that it no longer does. */
export async function setJobTypeNeeds(input: {
  orgId: string;
  userId: string;
  jobTypeId: string;
  equipmentId: string;
  needs: boolean;
}): Promise<void> {
  const [jobType, machine] = await Promise.all([
    prisma.jobType.findFirst({
      where: { id: input.jobTypeId, orgId: input.orgId },
      select: { id: true, name: true },
    }),
    prisma.equipment.findFirst({
      where: { id: input.equipmentId, orgId: input.orgId },
      select: { id: true, name: true },
    }),
  ]);

  if (!jobType || !machine) {
    throw new EquipmentError('NOT_FOUND', 'That kind of work or machine was not found.');
  }

  if (input.needs) {
    await prisma.jobTypeEquipment.upsert({
      where: {
        jobTypeId_equipmentId: { jobTypeId: jobType.id, equipmentId: machine.id },
      },
      create: { jobTypeId: jobType.id, equipmentId: machine.id },
      update: {},
    });
  } else {
    await prisma.jobTypeEquipment.deleteMany({
      where: { jobTypeId: jobType.id, equipmentId: machine.id },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.needs ? 'job-type.needs-equipment' : 'job-type.no-longer-needs-equipment',
    entityType: 'JobType',
    entityId: jobType.id,
    before: null,
    after: { equipment: machine.name },
  });
}
