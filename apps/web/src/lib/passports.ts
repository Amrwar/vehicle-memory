import { prisma } from '@carnet/db';

import { verifyVehicleChain } from './passport';

/**
 * Passports as a list. Phase 27.
 *
 * A passport per vehicle has existed since Phase 1 and been a document since
 * Phase 23. What nobody could do was see them side by side: an owner asking
 * "how many cars have we written to, and are the chains all sound" had to
 * open each one. This is that page's data, for the workshop and for the
 * customer, in one shape.
 *
 * The chain is verified per vehicle, which is one query each. The list is
 * bounded at a hundred vehicles, so that is a hundred small queries on a
 * page an owner opens now and then, and the alternative, a cached verdict,
 * would be a stored truth about a chain whose whole point is that nothing
 * about it is stored.
 */

export interface PassportRow {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  registration: string | null;
  vin: string;
  ownerName: string | null;
  entries: number;
  /** Workshops that have written to it, this one included. */
  workshops: number;
  /** Written by somebody other than the workshop looking. Null for an owner. */
  fromElsewhere: number | null;
  firstRecorded: Date | null;
  lastRecorded: Date | null;
  intact: boolean;
  openRecalls: number;
}

const SELECT = {
  id: true,
  year: true,
  make: true,
  model: true,
  registration: true,
  vin: true,
  ownerships: { where: { endedAt: null }, take: 1, select: { ownerName: true } },
  recalls: { where: { status: 'OPEN' as const }, select: { id: true } },
  events: {
    orderBy: { sequence: 'asc' as const },
    select: { occurredAt: true, recordedByOrgId: true },
  },
};

type Row = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  registration: string | null;
  vin: string;
  ownerships: { ownerName: string | null }[];
  recalls: { id: string }[];
  events: { occurredAt: Date; recordedByOrgId: string | null }[];
};

async function shape(rows: Row[], lookingFrom: string | null): Promise<PassportRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const verification = await verifyVehicleChain(row.id);
      const orgs = new Set(row.events.map((e) => e.recordedByOrgId).filter(Boolean));
      return {
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        registration: row.registration,
        vin: row.vin,
        ownerName: row.ownerships[0]?.ownerName ?? null,
        entries: row.events.length,
        workshops: orgs.size,
        fromElsewhere: lookingFrom
          ? row.events.filter((e) => e.recordedByOrgId && e.recordedByOrgId !== lookingFrom).length
          : null,
        firstRecorded: row.events[0]?.occurredAt ?? null,
        lastRecorded: row.events[row.events.length - 1]?.occurredAt ?? null,
        intact: verification.valid,
        openRecalls: row.recalls.length,
      };
    }),
  );
}

function summarise(rows: PassportRow[]) {
  return {
    passports: rows.length,
    entries: rows.reduce((total, row) => total + row.entries, 0),
    intact: rows.filter((row) => row.intact).length,
    broken: rows.filter((row) => !row.intact).length,
    sharedWithOthers: rows.filter((row) => row.workshops > 1).length,
  };
}

/** Every passport this workshop has written to or been granted, newest first. */
export async function passportsForOrg(orgId: string, query = '') {
  const q = query.trim();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      AND: [
        {
          OR: [
            { events: { some: { recordedByOrgId: orgId } } },
            { jobs: { some: { orgId } } },
            { accessGrants: { some: { orgId, revokedAt: null } } },
          ],
        },
        q
          ? {
              OR: [
                { registration: { contains: q, mode: 'insensitive' } },
                { vin: { contains: q, mode: 'insensitive' } },
                { make: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: SELECT,
  });

  const rows = await shape(vehicles, orgId);
  return { rows, summary: summarise(rows) };
}

/** The passports of the vehicles this person owns now. */
export async function passportsForOwner(userId: string) {
  const ownerships = await prisma.vehicleOwnership.findMany({
    where: { ownerUserId: userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { vehicle: { select: SELECT } },
  });

  const rows = await shape(
    ownerships.map((o) => o.vehicle),
    null,
  );
  return { rows, summary: summarise(rows) };
}
