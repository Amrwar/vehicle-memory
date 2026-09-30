import { decideScan, looseKey, type ScanKind, type ScanOutcome, whatItCouldBe } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * What was scanned, resolved against this workshop's records.
 *
 * Every lookup here is scoped to the org. A scanner is a keyboard, and a
 * keyboard can be given anything -- a code off a label that belongs to another
 * workshop entirely, a number somebody made up. Nothing is found that this
 * workshop could not already open by other means.
 *
 * The candidates come from the rules, which are generous on purpose: the shape
 * of a string is not evidence, so `10482` is offered as a job, a part and a
 * bin, and what actually exists decides. Two survivors is a question, never a
 * guess -- because opening the wrong job is the one outcome that looks exactly
 * like the right one.
 *
 * Phase 92.
 */

type Match = { kind: ScanKind; id: string; label: string };

async function vehiclesMatching(orgId: string, value: string): Promise<Match[]> {
  // "BV19 FLM", "bv19flm" and "BV19-FLM" are one plate. Somebody reading it
  // off a windscreen types what they see, and what they see has a space in it.
  // The first draft compared the column exactly and found nothing, which meant
  // the most obvious thing in a workshop to point a scanner at -- a windscreen
  // -- resolved to nothing at all.
  //
  // Matched the way `search.ts` matches it, against the same expression index
  // the schema carries for exactly this: the registration with spacing and
  // punctuation stripped. A second way of comparing plates would be a second
  // way to be wrong about one.
  //
  // A vehicle carries no orgId -- the passport outlives the workshop -- so the
  // join to `jobs` is what scopes it.
  const compact = looseKey(value);

  const rows = await prisma.$queryRaw<
    { id: string; registration: string | null; make: string | null; model: string | null }[]
  >`
    SELECT DISTINCT v."id", v."registration", v."make", v."model"
      FROM "vehicles" v
     WHERE EXISTS (SELECT 1 FROM "jobs" j WHERE j."vehicleId" = v."id" AND j."orgId" = ${orgId})
       AND (
            v."id" = ${value}
         OR upper(v."vin") = ${value.toUpperCase()}
         OR upper(regexp_replace(coalesce(v."registration", ''), '[^A-Za-z0-9]', '', 'g')) = ${compact}
       )
     LIMIT 5`;

  return rows.map((row) => ({
    kind: 'vehicle' as const,
    id: row.id,
    label: [row.registration, row.make, row.model].filter(Boolean).join(' \u00b7 '),
  }));
}

async function jobsMatching(orgId: string, value: string): Promise<Match[]> {
  const asNumber = Number(value);
  const rows = await prisma.job.findMany({
    where: {
      orgId,
      OR: [
        { id: value },
        ...(Number.isSafeInteger(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
      ],
    },
    select: { id: true, number: true, shortDescription: true },
    take: 5,
  });

  return rows.map((row) => ({
    kind: 'job' as const,
    id: row.id,
    label: `#${row.number} · ${row.shortDescription}`,
  }));
}

async function partsMatching(orgId: string, value: string): Promise<Match[]> {
  const rows = await prisma.product.findMany({
    where: {
      orgId,
      OR: [
        { id: value },
        { partNumber: { equals: value, mode: 'insensitive' } },
        { barcode: { equals: value, mode: 'insensitive' } },
      ],
    },
    select: { id: true, partNumber: true, name: true },
    take: 5,
  });

  return rows.map((row) => ({
    kind: 'part' as const,
    id: row.id,
    label: `${row.name} · ${row.partNumber}`,
  }));
}

async function binsMatching(orgId: string, value: string): Promise<Match[]> {
  // A bin is not a record: it is a label written on a shelf and typed onto a
  // stock level. So the match is "some stock says it lives here", and the
  // destination is the parts on it rather than a page that does not exist.
  const rows = await prisma.stockLevel.findMany({
    where: {
      product: { orgId },
      binLocation: { equals: value, mode: 'insensitive' },
    },
    select: { binLocation: true },
    take: 1,
  });

  return rows
    .filter((row) => row.binLocation)
    .map((row) => ({ kind: 'bin' as const, id: row.binLocation!, label: row.binLocation! }));
}

async function inspectionsMatching(orgId: string, value: string): Promise<Match[]> {
  const rows = await prisma.inspection.findMany({
    where: { id: value, job: { orgId } },
    select: { id: true, job: { select: { number: true } } },
    take: 1,
  });

  return rows.map((row) => ({
    kind: 'inspection' as const,
    id: row.id,
    label: `Inspection on #${row.job.number}`,
  }));
}

async function equipmentMatching(orgId: string, value: string): Promise<Match[]> {
  const rows = await prisma.equipment.findMany({
    where: { orgId, OR: [{ id: value }, { code: { equals: value, mode: 'insensitive' } }] },
    select: { id: true, name: true, code: true },
    take: 5,
  });

  return rows.map((row) => ({
    kind: 'equipment' as const,
    id: row.id,
    label: `${row.name} · ${row.code}`,
  }));
}

const LOOKUPS: Record<ScanKind, (orgId: string, value: string) => Promise<Match[]>> = {
  vehicle: vehiclesMatching,
  job: jobsMatching,
  part: partsMatching,
  bin: binsMatching,
  inspection: inspectionsMatching,
  equipment: equipmentMatching,
};

/**
 * What a scanned or typed string turns out to be.
 *
 * The lookups run together rather than in turn, which is not only faster: a
 * loop that stopped at the first hit is exactly the thing that would open the
 * wrong record, and running them all is what makes an ambiguity visible at
 * all.
 */
export async function resolveScan(orgId: string, text: string): Promise<ScanOutcome> {
  const candidates = whatItCouldBe(text);
  if (candidates.length === 0) return { found: 'none' };

  const found = await Promise.all(
    candidates.map((candidate) => LOOKUPS[candidate.kind](orgId, candidate.value)),
  );

  return decideScan(found.flat());
}

/** Why each candidate was considered, so a refusal can explain itself. */
export function whyThoseWereTried(text: string) {
  return whatItCouldBe(text).map((one) => ({ kind: one.kind, because: one.because }));
}
