/**
 * The sheet it was taken on. Phase 90.
 *
 *   npx tsx infra/scripts/verify-versions.ts
 *
 * The failure this exists to prevent is a silence that reads as approval.
 *
 * A workshop adds "brake fluid condition" to its sheet in June. A customer
 * opens an inspection from March, and there is no brake fluid line on it.
 * Every reading of that is wrong in a different way: an omission, a pass,
 * somebody forgetting. The truth -- it was not on the sheet in March -- is
 * what the record could not say until this phase.
 *
 * So what is checked here is that an inspection remembers its sheet, that the
 * sheet is frozen against every later edit, and that the report can name what
 * it did not ask. And the other half: that a version is *found* rather than
 * published, so editing a sheet three times before anybody uses it makes one
 * version rather than three, and editing it back lands on the one it had.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { fingerprintOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  shapeOfTemplate,
  shapeOfVersion,
  takenOn,
  versionInUse,
  versionsOf,
} from '../../apps/web/src/lib/inspection-versions';

let failures = 0;

const TAG = 'VERIFY-VERSION-PROBE';

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main() {
  console.info('\n  The sheet it was taken on\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  const template = await prisma.inspectionTemplate.findFirstOrThrow({
    where: { orgId: org.id, isActive: true },
    orderBy: { isDefault: 'desc' },
    select: { id: true, name: true },
  });

  // Anything a run that threw before its clean-up left behind.
  await prisma.inspectionTemplateItem.deleteMany({
    where: { section: { templateId: template.id }, name: TAG },
  });

  /* --- a version is found, not published ---------------------------------- */

  const first = await versionInUse({ templateId: template.id, userId: owner.id });
  check('the sheet as it stands has a version', Boolean(first), true);

  const again = await versionInUse({ templateId: template.id, userId: owner.id });
  check('asking twice does not cut a second one', again?.id, first?.id);

  const shape = await shapeOfTemplate(template.id);
  check('and it holds every question on the sheet', first?.itemCount, shape.length);

  const frozen = await shapeOfVersion(first!.id);
  check(
    'the frozen copy has the same fingerprint as the live sheet',
    fingerprintOf(frozen),
    fingerprintOf(shape),
  );

  /* --- an inspection remembers it ----------------------------------------- */

  console.info('\n  An inspection remembers its sheet');

  const inspection = await prisma.inspection.findFirst({
    where: { job: { orgId: org.id }, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true, templateVersionId: true },
  });

  if (!inspection) {
    failures += 1;
    console.error('  FAIL   no completed inspection in the seed. Reseed.');
  } else {
    check('a seeded inspection carries a version', Boolean(inspection.templateVersionId), true);

    const before = await takenOn(org.id, inspection.id);
    check('and the report can name it', Boolean(before), true);
    check('with nothing it failed to ask, yet', before?.didNotAsk, []);
    check('and the sheet unchanged since', before?.sheetHasChanged, false);

    /* --- the sheet changes underneath it ---------------------------------- */

    console.info('\n  Then the sheet changes');

    const section = await prisma.inspectionTemplateSection.findFirstOrThrow({
      where: { templateId: template.id },
      select: { id: true, name: true },
    });

    await prisma.inspectionTemplateItem.create({
      data: { sectionId: section.id, name: TAG, measurementType: 'NONE', sortOrder: 999 },
    });

    const after = await takenOn(org.id, inspection.id);

    check('the old inspection still cites the old version', after?.version, before?.version);
    check('and its item count has not moved', after?.itemCount, before?.itemCount);
    check('but it now says what it did not ask', after?.didNotAsk, [`${section.name} · ${TAG}`]);
    check('and that the sheet has changed', after?.sheetHasChanged, true);

    // The frozen copy is frozen.
    check(
      'the version’s own questions are untouched by the edit',
      (await shapeOfVersion(inspection.templateVersionId!)).length,
      before?.itemCount,
    );

    /* --- a new shape is a new version ------------------------------------- */

    const second = await versionInUse({ templateId: template.id, userId: owner.id });
    check('the changed sheet gets a version of its own', second?.id !== first?.id, true);
    check('numbered after the first', (second?.version ?? 0) > (first?.version ?? 0), true);
    check('with one more question on it', second?.itemCount, (first?.itemCount ?? 0) + 1);

    /* --- and changing it back lands on the one it had ---------------------- */

    console.info('\n  And back again');

    await prisma.inspectionTemplateItem.deleteMany({
      where: { section: { templateId: template.id }, name: TAG },
    });

    const back = await versionInUse({ templateId: template.id, userId: owner.id });
    check('a sheet edited back to what it was is the version it was', back?.id, first?.id);
    check(
      'rather than a third with the same questions on it',
      (await versionsOf(org.id, template.id)).filter((one) => one.itemCount === first?.itemCount)
        .length,
      1,
    );

    const restored = await takenOn(org.id, inspection.id);
    check('and the old report has nothing to explain again', restored?.didNotAsk, []);
  }

  /* --- what the database refuses ------------------------------------------ */

  console.info('\n  What the database refuses');

  const used = await prisma.inspectionTemplateVersion.findFirst({
    where: { templateId: template.id, inspections: { some: {} } },
    select: { id: true },
  });

  if (!used) {
    failures += 1;
    console.error('  FAIL   no version with an inspection on it, so the restrict is untested.');
  } else {
    let deleted = false;
    try {
      await prisma.inspectionTemplateVersion.delete({ where: { id: used.id } });
      deleted = true;
    } catch {
      // ON DELETE RESTRICT. A report claiming a sheet nobody can produce is
      // worse than one that says plainly it does not know.
    }
    check('a version an inspection was taken on cannot be deleted', deleted, false);
  }

  let twice = false;
  try {
    const one = await prisma.inspectionTemplateVersion.findFirstOrThrow({
      where: { templateId: template.id },
      select: { fingerprint: true },
    });
    await prisma.inspectionTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 9_999,
        name: TAG,
        fingerprint: one.fingerprint,
        itemCount: 0,
      },
    });
    twice = true;
  } catch {
    // The unique index on (templateId, fingerprint) is what makes "find or
    // cut" safe when two inspections start in the same second.
  }
  check('and two versions of one template cannot share a shape', twice, false);

  /* --- clean up ------------------------------------------------------------ */

  await prisma.inspectionTemplateItem.deleteMany({
    where: { section: { templateId: template.id }, name: TAG },
  });
  await prisma.inspectionTemplateVersion.deleteMany({
    where: { templateId: template.id, name: TAG },
  });

  check(
    'the probe leaves no questions of its own on the sheet',
    await prisma.inspectionTemplateItem.count({
      where: { section: { templateId: template.id }, name: TAG },
    }),
    0,
  );

  console.info(
    failures === 0
      ? '\n  An old report says what its sheet did not ask.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
