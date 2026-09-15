import {
  assertCompletable,
  assertResultSound,
  bySection,
  describeCompletion,
  type Finding,
  findingsToEstimateLines,
  InspectionError,
  progressOf,
  type RecordedResult,
  summarise,
  type TemplateItem,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';
import { readUrlFor } from './storage';
import { regionFor } from './region';
import { retotalEstimate } from './estimates';
import { defaultTaxRateId } from './tax';

/**
 * Inspections, against the database.
 *
 * The six tables have existed since Phase 1 and nothing could write to them
 * except the seed, which is why an inspection was marked partial in the
 * feature map for months. This is the layer that lets a technician actually
 * carry one out.
 *
 * Two things are deliberate. Results are written one at a time as the
 * technician moves around the car, because a form that saves everything at the
 * end loses an hour of work when a tablet sleeps in a cold workshop. And
 * completing an inspection is a separate act from recording the last item, so
 * nothing reaches the customer until somebody decides it should.
 */

export { InspectionError };

/* ---------------------------------------------------------------------------
   Templates
   --------------------------------------------------------------------------- */

export async function templatesFor(orgId: string) {
  return prisma.inspectionTemplate.findMany({
    where: { orgId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      isDefault: true,
      _count: { select: { sections: true } },
    },
  });
}

async function itemsOf(templateId: string): Promise<TemplateItem[]> {
  const sections = await prisma.inspectionTemplateSection.findMany({
    where: { templateId },
    orderBy: { sortOrder: 'asc' },
    select: {
      name: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          guidance: true,
          measurementType: true,
          position: true,
        },
      },
    },
  });

  return sections.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      sectionName: section.name,
      name: item.name,
      guidance: item.guidance,
      measurementType: item.measurementType as TemplateItem['measurementType'],
      position: item.position,
    })),
  );
}

/* ---------------------------------------------------------------------------
   Carrying one out
   --------------------------------------------------------------------------- */

/**
 * Opens an inspection on a job, or returns the one already open.
 *
 * Idempotent on purpose. A technician who taps the button twice, or comes back
 * to a job the next morning, should reach the inspection they started rather
 * than a second empty one beside it.
 */
export async function startInspection(input: {
  orgId: string;
  userId: string;
  jobId: string;
  templateId?: string;
}) {
  const existing = await prisma.inspection.findFirst({
    where: { jobId: input.jobId, status: 'DRAFT' },
    select: { id: true },
  });

  if (existing) return existing.id;

  const template = input.templateId
    ? await prisma.inspectionTemplate.findFirstOrThrow({
        where: { id: input.templateId, orgId: input.orgId },
        select: { id: true },
      })
    : await prisma.inspectionTemplate.findFirstOrThrow({
        where: { orgId: input.orgId, isActive: true },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
      });

  const inspection = await prisma.inspection.create({
    data: {
      jobId: input.jobId,
      templateId: template.id,
      status: 'DRAFT',
      performedByUserId: input.userId,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'inspection.started',
    entityType: 'Inspection',
    entityId: inspection.id,
  });

  return inspection.id;
}

/** The inspection, its template's items, and what has been recorded so far. */
export async function inspectionFor(orgId: string, inspectionId: string) {
  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, job: { orgId } },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      notes: true,
      templateId: true,
      job: {
        select: {
          id: true,
          number: true,
          shortDescription: true,
          locationId: true,
          customer: { select: { displayName: true } },
          vehicle: {
            select: { id: true, make: true, model: true, year: true, registration: true },
          },
        },
      },
      performedBy: { select: { name: true } },
      results: {
        select: {
          id: true,
          templateItemId: true,
          sectionName: true,
          itemName: true,
          severity: true,
          note: true,
          measurementValue: true,
          measurementType: true,
          position: true,
          recommendedAction: true,
          estimatedCost: true,
          _count: { select: { photos: true } },
        },
      },
    },
  });

  if (!inspection || !inspection.templateId) return null;

  const items = await itemsOf(inspection.templateId);

  const results: (RecordedResult & { resultId: string })[] = inspection.results.map((row) => ({
    resultId: row.id,
    templateItemId: row.templateItemId ?? '',
    severity: row.severity as RecordedResult['severity'],
    note: row.note,
    measurementValue: row.measurementValue === null ? null : Number(row.measurementValue),
    recommendedAction: row.recommendedAction,
    estimatedCost: row.estimatedCost === null ? null : Number(row.estimatedCost),
    photoCount: row._count.photos,
  }));

  return {
    inspection,
    items,
    sections: bySection(items),
    results,
    byItem: new Map(results.map((result) => [result.templateItemId, result])),
    progress: progressOf(items, results),
  };
}

/**
 * Records one item.
 *
 * Written immediately rather than collected and saved at the end, because a
 * tablet that sleeps in a cold workshop would otherwise lose the hour somebody
 * just spent under a car.
 *
 * Upserted on the template item, so going back to change an answer corrects
 * the record rather than adding a second opinion beside the first.
 */
export async function recordResult(input: {
  orgId: string;
  userId: string;
  inspectionId: string;
  templateItemId: string;
  severity: RecordedResult['severity'];
  note?: string | null;
  measurementValue?: number | null;
  recommendedAction?: string | null;
  estimatedCost?: number | null;
}) {
  const inspection = await prisma.inspection.findFirstOrThrow({
    where: { id: input.inspectionId, job: { orgId: input.orgId } },
    select: { id: true, status: true, templateId: true },
  });

  if (inspection.status === 'COMPLETED') {
    throw new InspectionError(
      'ALREADY_COMPLETE',
      'This inspection has been sent to the customer and cannot be changed. Start a new one.',
    );
  }

  // Refused before it is written, so an amber with nothing behind it never
  // reaches a customer as an alarming colour the workshop cannot explain.
  assertResultSound(input);

  const item = await prisma.inspectionTemplateItem.findFirstOrThrow({
    where: { id: input.templateItemId, section: { templateId: inspection.templateId ?? '' } },
    select: {
      id: true,
      name: true,
      measurementType: true,
      position: true,
      section: { select: { name: true } },
    },
  });

  const existing = await prisma.inspectionResult.findFirst({
    where: { inspectionId: inspection.id, templateItemId: item.id },
    select: { id: true },
  });

  const data = {
    severity: input.severity,
    note: input.note?.trim() || null,
    measurementValue: input.measurementValue ?? null,
    measurementType: item.measurementType,
    position: item.position,
    recommendedAction: input.recommendedAction?.trim() || null,
    estimatedCost: input.estimatedCost ?? null,
  };

  if (existing) {
    await prisma.inspectionResult.update({ where: { id: existing.id }, data });
  } else {
    await prisma.inspectionResult.create({
      data: {
        ...data,
        inspectionId: inspection.id,
        templateItemId: item.id,
        sectionName: item.section.name,
        itemName: item.name,
      },
    });
  }

  await refreshCounts(inspection.id);
}

/** Keeps the denormalised counts on the inspection true after every change. */
async function refreshCounts(inspectionId: string) {
  const results = await prisma.inspectionResult.findMany({
    where: { inspectionId },
    select: { severity: true },
  });

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      passCount: results.filter((row) => row.severity === 'PASS').length,
      advisoryCount: results.filter((row) => row.severity === 'ADVISORY').length,
      criticalCount: results.filter((row) => row.severity === 'CRITICAL').length,
    },
  });
}

/**
 * Hands the inspection to the customer, and turns what was found into a quote.
 *
 * One transaction. A completed inspection whose recommendations did not become
 * estimate lines is the failure this prevents: the technician believes the
 * customer has been asked, the customer has been asked nothing, and the work
 * is found again at the next service.
 */
export async function completeInspection(input: {
  orgId: string;
  userId: string;
  inspectionId: string;
  notes?: string | null;
}) {
  const region = await regionFor(input.orgId);
  const loaded = await inspectionFor(input.orgId, input.inspectionId);

  if (!loaded) throw new InspectionError('UNKNOWN_ITEM', 'That inspection does not exist.');

  assertCompletable({
    status: loaded.inspection.status as 'DRAFT' | 'COMPLETED',
    progress: loaded.progress,
  });

  const findings: Finding[] = loaded.inspection.results.map((row) => ({
    id: row.id,
    sectionName: row.sectionName,
    itemName: row.itemName,
    severity: row.severity as Finding['severity'],
    note: row.note,
    recommendedAction: row.recommendedAction,
    estimatedCost: row.estimatedCost === null ? null : Number(row.estimatedCost),
    measurementValue: row.measurementValue === null ? null : Number(row.measurementValue),
    measurementType: row.measurementType as Finding['measurementType'],
    position: row.position,
    photoCount: row._count.photos,
  }));

  const lines = findingsToEstimateLines(findings);

  await prisma.$transaction(async (tx) => {
    await tx.inspection.update({
      where: { id: loaded.inspection.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: input.notes?.trim() || null,
      },
    });

    if (lines.length === 0) return;

    const job = loaded.inspection.job;

    const latest = await tx.estimate.findFirst({
      where: { jobId: job.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const estimate = await tx.estimate.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        currency: region.currency,
        createdByUserId: input.userId,
      },
    });

    // The quote's lines take the site's rate. Before Phase 41 they carried no
    // rate at all, so a quote raised from an inspection was priced without tax.
    const taxRateId = await defaultTaxRateId(input.orgId, job.locationId, tx);

    await tx.estimateLine.createMany({
      data: lines.map((line, index) => ({
        estimateId: estimate.id,
        taxRateId,
        kind: line.kind,
        description: line.description,
        detail: line.detail ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        // The mapper's own decision, not a blanket one. A worn brake is not an
        // optional extra even though the customer may still decline it; the
        // decision screen lets any line be left, whatever this flag says.
        isOptional: line.isOptional ?? false,
        sortOrder: index,
        // Links the quote line back to the exact thing the technician found,
        // so the customer reading it can see the measurement behind it.
        inspectionResultId: line.sourceFindingId,
      })),
    });

    // Priced as it is raised. A quote with a zero total cannot be sent, and
    // this is where the total comes from. Phase 34.
    await retotalEstimate(tx, estimate.id);

    // The job is waiting on the customer from this moment, not from whenever
    // somebody remembers to change it.
    await tx.job.update({
      where: { id: job.id },
      data: { status: 'ESTIMATED' },
    });
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'inspection.completed',
    entityType: 'Inspection',
    entityId: loaded.inspection.id,
    after: {
      checked: loaded.progress.checked,
      notChecked: loaded.progress.remaining,
      critical: loaded.progress.critical,
      advisory: loaded.progress.advisory,
      estimateLines: lines.length,
    },
  });

  return {
    lines: lines.length,
    summary: describeCompletion(loaded.progress),
  };
}

/* ---------------------------------------------------------------------------
   Photographs
   --------------------------------------------------------------------------- */

/**
 * Records a photograph that has already been uploaded.
 *
 * The file went straight from the browser to the store; nothing of it passed
 * through here. This writes the row that says where it is and what it belongs
 * to, and it is the only step that touches the database.
 *
 * A photograph is what turns "your brake pads are worn" into something a
 * customer can see for themselves, which is the difference between a quote
 * that gets approved and one that gets a second opinion.
 */
export async function attachPhoto(input: {
  orgId: string;
  userId: string;
  resultId: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
}) {
  const result = await prisma.inspectionResult.findFirstOrThrow({
    where: { id: input.resultId, inspection: { job: { orgId: input.orgId } } },
    select: { id: true, inspection: { select: { id: true, status: true } } },
  });

  if (result.inspection.status === 'COMPLETED') {
    throw new InspectionError(
      'ALREADY_COMPLETE',
      'This inspection has gone to the customer, so nothing more can be added to it.',
    );
  }

  const photo = await prisma.inspectionPhoto.create({
    data: {
      resultId: result.id,
      url: input.key,
      filename: input.filename.slice(0, 200),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      caption: input.caption?.trim() || null,
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'inspection.photo.added',
    entityType: 'Inspection',
    entityId: result.inspection.id,
    after: { resultId: result.id, bytes: input.sizeBytes },
  });

  return photo.id;
}

/** The photographs on one inspection, with links that can actually be opened. */
export async function photosFor(orgId: string, inspectionId: string) {
  const rows = await prisma.inspectionPhoto.findMany({
    where: { result: { inspectionId, inspection: { job: { orgId } } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, resultId: true, url: true, caption: true },
  });

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      resultId: row.resultId,
      caption: row.caption,
      src: await readUrlFor(row.url),
    })),
  );
}

/* ---------------------------------------------------------------------------
   Reading them
   --------------------------------------------------------------------------- */

/** Every inspection in the workshop, newest first. */
export async function recentInspections(orgId: string, limit = 40) {
  const rows = await prisma.inspection.findMany({
    where: { job: { orgId } },
    orderBy: [{ startedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      passCount: true,
      advisoryCount: true,
      criticalCount: true,
      performedBy: { select: { name: true } },
      job: {
        select: {
          id: true,
          number: true,
          shortDescription: true,
          vehicle: { select: { make: true, model: true, registration: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    ...row,
    headline: summarise(
      [
        ...Array.from({ length: row.criticalCount }, () => ({ severity: 'CRITICAL' as const })),
        ...Array.from({ length: row.advisoryCount }, () => ({ severity: 'ADVISORY' as const })),
        ...Array.from({ length: row.passCount }, () => ({ severity: 'PASS' as const })),
      ].map((entry, index) => ({
        id: String(index),
        sectionName: '',
        itemName: '',
        severity: entry.severity,
      })),
    ).headline,
  }));
}
