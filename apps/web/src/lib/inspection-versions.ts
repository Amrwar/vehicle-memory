import { didNotAsk, fingerprintOf, type ShapeItem, whatChanged } from '@carnet/core';
import { prisma } from '@carnet/db';

/**
 * Which sheet an inspection was taken on, and what that sheet did not ask.
 *
 * A version is found, not published. The shape of the live template is
 * fingerprinted; if a version with that fingerprint exists it is the one, and
 * if none does a new one is cut. Nobody presses anything, a workshop that
 * edits its sheet three times before anybody uses it produces one version, and
 * a sheet edited back to what it was lands on the version it already had.
 *
 * Phase 90.
 */

const SHAPE_SELECT = {
  sectionName: true,
  itemName: true,
  guidance: true,
  measurementType: true,
  position: true,
  sortOrder: true,
} as const;

/** The live template, as the rules want to see it. */
export async function shapeOfTemplate(templateId: string): Promise<ShapeItem[]> {
  // bounded: the sections of one inspection sheet, and the questions under
  // each. A thirty-point check is six sections of five; the longest sheet a
  // workshop would hand a technician is under two hundred questions, because
  // nobody fills in more than that in an afternoon.
  const sections = await prisma.inspectionTemplateSection.findMany({
    where: { templateId },
    orderBy: { sortOrder: 'asc' },
    select: {
      name: true,
      sortOrder: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
          guidance: true,
          measurementType: true,
          position: true,
          sortOrder: true,
        },
      },
    },
  });

  return sections.flatMap((section) =>
    section.items.map((item) => ({
      sectionName: section.name,
      itemName: item.name,
      guidance: item.guidance,
      measurementType: item.measurementType,
      position: item.position,
      sortOrder: section.sortOrder * 1000 + item.sortOrder,
    })),
  );
}

/** What one frozen version asked. */
export async function shapeOfVersion(versionId: string): Promise<ShapeItem[]> {
  // bounded: the questions on one inspection sheet. A thirty-point check is
  // thirty rows; the longest sheet a workshop would hand a technician is under
  // two hundred, and nobody fills in more than that in an afternoon.
  const items = await prisma.inspectionTemplateVersionItem.findMany({
    where: { versionId },
    orderBy: { sortOrder: 'asc' },
    select: SHAPE_SELECT,
  });

  return items;
}

/**
 * The version matching the template as it stands, cutting one if none does.
 *
 * The unique index on (templateId, fingerprint) is what makes this safe when
 * two inspections start in the same second: one insert wins, the other comes
 * back to find the row it wanted. Without it, two versions with one shape
 * would both be "the" version and half the inspections would cite each.
 */
export async function versionInUse(input: {
  templateId: string;
  userId?: string | null;
}): Promise<{ id: string; version: number; name: string; itemCount: number } | null> {
  const template = await prisma.inspectionTemplate.findUnique({
    where: { id: input.templateId },
    select: { id: true, name: true },
  });
  if (!template) return null;

  const shape = await shapeOfTemplate(template.id);
  const fingerprint = fingerprintOf(shape);

  const existing = await prisma.inspectionTemplateVersion.findUnique({
    where: { templateId_fingerprint: { templateId: template.id, fingerprint } },
    select: { id: true, version: true, name: true, itemCount: true },
  });
  if (existing) return existing;

  const highest = await prisma.inspectionTemplateVersion.findFirst({
    where: { templateId: template.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  try {
    return await prisma.inspectionTemplateVersion.create({
      data: {
        templateId: template.id,
        version: (highest?.version ?? 0) + 1,
        name: template.name,
        fingerprint,
        itemCount: shape.length,
        createdByUserId: input.userId ?? null,
        items: {
          create: shape.map((item) => ({
            sectionName: item.sectionName,
            itemName: item.itemName,
            guidance: item.guidance ?? null,
            measurementType: (item.measurementType ?? 'NONE') as never,
            position: (item.position ?? null) as never,
            sortOrder: item.sortOrder ?? 0,
          })),
        },
      },
      select: { id: true, version: true, name: true, itemCount: true },
    });
  } catch {
    // Somebody else cut it between the read and the write. The unique index
    // did its job; take theirs rather than making a second one with the same
    // shape, which would leave half the inspections citing each.
    return prisma.inspectionTemplateVersion.findUnique({
      where: { templateId_fingerprint: { templateId: template.id, fingerprint } },
      select: { id: true, version: true, name: true, itemCount: true },
    });
  }
}

export interface TakenOn {
  version: number;
  name: string;
  itemCount: number;
  firstUsedAt: Date;
  /**
   * Questions the sheet asks now and did not ask then.
   *
   * The sentence the whole phase exists for. Not "these are missing" -- they
   * are not missing, they did not exist -- but "this check did not include
   * them", which is a statement about the sheet rather than an accusation
   * about the technician.
   */
  didNotAsk: string[];
  /** Questions it asked that the sheet has since dropped. */
  noLongerAsked: string[];
  /** Whether the sheet has changed at all since. */
  sheetHasChanged: boolean;
}

/**
 * What sheet this inspection was taken on, and how it differs from today's.
 *
 * Null when the inspection carries no version, which is every inspection
 * recorded before Phase 90. That is said plainly rather than filled in with
 * today's sheet, because borrowing today's would be claiming to know something
 * nobody knows.
 */
export async function takenOn(orgId: string, inspectionId: string): Promise<TakenOn | null> {
  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, job: { orgId } },
    select: {
      templateId: true,
      templateVersion: {
        select: { id: true, version: true, name: true, itemCount: true, firstUsedAt: true },
      },
    },
  });

  if (!inspection?.templateVersion) return null;

  const then = await shapeOfVersion(inspection.templateVersion.id);
  const now = inspection.templateId ? await shapeOfTemplate(inspection.templateId) : then;
  const changed = whatChanged(then, now);

  return {
    version: inspection.templateVersion.version,
    name: inspection.templateVersion.name,
    itemCount: inspection.templateVersion.itemCount,
    firstUsedAt: inspection.templateVersion.firstUsedAt,
    didNotAsk: didNotAsk(then, now),
    noLongerAsked: changed.removed,
    sheetHasChanged: !changed.same,
  };
}

/** Every version of one template, newest first, for a settings screen. */
export async function versionsOf(orgId: string, templateId: string) {
  const template = await prisma.inspectionTemplate.findFirst({
    where: { id: templateId, orgId },
    select: { id: true, name: true },
  });
  if (!template) return [];

  // bounded: one row per shape the sheet has been used in. A workshop that
  // edits its sheet every month for a decade has a hundred and twenty.
  const versions = await prisma.inspectionTemplateVersion.findMany({
    where: { templateId: template.id },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      name: true,
      itemCount: true,
      firstUsedAt: true,
      createdBy: { select: { name: true } },
      _count: { select: { inspections: true } },
    },
  });

  return versions.map((one) => ({
    id: one.id,
    version: one.version,
    name: one.name,
    itemCount: one.itemCount,
    firstUsedAt: one.firstUsedAt,
    cutBy: one.createdBy?.name ?? null,
    inspections: one._count.inspections,
  }));
}
