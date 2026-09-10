/**
 * Proves that carrying out an inspection produces a quote the customer can answer.
 *
 *   npx tsx infra/scripts/verify-inspection.ts
 *
 * The six inspection tables existed from Phase 1 and nothing but the seed
 * could write to them, so the feature was marked built on the strength of a
 * schema for months. This walks the whole path instead: open an inspection on
 * a real job, record findings the way a technician would, complete it, and
 * check that what was found became estimate lines linked back to the exact
 * measurement behind them.
 *
 * Everything written is removed afterwards, so it can run against a populated
 * database without leaving anything behind.
 */

import 'dotenv/config';

import {
  completeInspection,
  inspectionFor,
  recordResult,
  startInspection,
} from '../../apps/web/src/lib/inspections';
import { prisma } from '@carnet/db';

let failures = 0;
let checked = 0;

function ok(what: string, detail = '') {
  checked += 1;
  console.info(`  ok    ${what}${detail ? `  ${detail}` : ''}`);
}

function fail(what: string, detail: string) {
  checked += 1;
  failures += 1;
  console.info(`  FAIL  ${what}  ${detail}`);
}

async function mustRefuse(what: string, attempt: () => Promise<unknown>) {
  try {
    await attempt();
    fail(what, 'it was allowed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ok(what, message.slice(0, 62));
  }
}

async function main() {
  console.info('\n  Inspections\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  const user = await prisma.user.findFirstOrThrow({
    where: { email: 'john@hillsidemotors.test' },
    select: { id: true },
  });

  // A job with no inspection on it, so the probe does not disturb the demo.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, inspections: { none: {} } },
    select: { id: true, number: true, status: true },
    orderBy: { createdAt: 'desc' },
  });

  console.info(`  Measuring ${org.name}, on job ${job.number}.\n`);

  const originalStatus = job.status;
  let inspectionId = '';
  const estimatesBefore = await prisma.estimate.count({ where: { jobId: job.id } });

  try {
    inspectionId = await startInspection({ orgId: org.id, userId: user.id, jobId: job.id });
    ok('an inspection can be started from a job');

    // Tapping twice, or coming back the next morning, must not open a second.
    const again = await startInspection({ orgId: org.id, userId: user.id, jobId: job.id });

    if (again !== inspectionId) fail('starting twice reopens the same one', 'it made a second');
    else ok('starting twice reopens the same one');

    const loaded = await inspectionFor(org.id, inspectionId);

    if (!loaded || loaded.items.length === 0) {
      fail('the template has items to work through', 'none found');
      return;
    }

    ok('the template has items to work through', `${loaded.items.length} items`);

    /* --- an item with no reason behind it ------------------------------ */

    const first = loaded.items[0]!;

    await mustRefuse('a red with no reason is refused', () =>
      recordResult({
        orgId: org.id,
        userId: user.id,
        inspectionId,
        templateItemId: first.id,
        severity: 'CRITICAL',
      }),
    );

    /* --- an inspection with nothing checked ----------------------------- */

    await mustRefuse('an inspection with nothing checked cannot be sent', () =>
      completeInspection({ orgId: org.id, userId: user.id, inspectionId }),
    );

    /* --- record as a technician would ----------------------------------- */

    await recordResult({
      orgId: org.id,
      userId: user.id,
      inspectionId,
      templateItemId: first.id,
      severity: 'PASS',
    });

    const tyre = loaded.items.find((item) => item.measurementType === 'TREAD_DEPTH_MM');

    if (tyre) {
      await recordResult({
        orgId: org.id,
        userId: user.id,
        inspectionId,
        templateItemId: tyre.id,
        severity: 'CRITICAL',
        measurementValue: 1.4,
        recommendedAction: 'Replace nearside front tyre',
        estimatedCost: 92,
      });

      ok('a measurement can be recorded against an item');
    }

    const other = loaded.items.find((item) => item.id !== first.id && item.id !== tyre?.id);

    if (other) {
      await recordResult({
        orgId: org.id,
        userId: user.id,
        inspectionId,
        templateItemId: other.id,
        severity: 'ADVISORY',
        note: 'Slight weep from the hose, worth watching',
        recommendedAction: 'Replace coolant hose',
        estimatedCost: 48,
      });
    }

    /* --- changing an answer --------------------------------------------- */

    await recordResult({
      orgId: org.id,
      userId: user.id,
      inspectionId,
      templateItemId: first.id,
      severity: 'ADVISORY',
      note: 'Second look: light scuffing',
    });

    const afterChange = await inspectionFor(org.id, inspectionId);
    const changed = afterChange?.results.filter((r) => r.templateItemId === first.id) ?? [];

    if (changed.length !== 1) {
      fail('changing an answer corrects it', `${changed.length} answers for one item`);
    } else if (changed[0]?.severity !== 'ADVISORY') {
      fail('changing an answer corrects it', `still ${changed[0]?.severity}`);
    } else {
      ok('changing an answer corrects it rather than adding a second opinion');
    }

    // And back again, so the item ends green. This leaves exactly two findings
    // and proves a pass never becomes something to charge for.
    await recordResult({
      orgId: org.id,
      userId: user.id,
      inspectionId,
      templateItemId: first.id,
      severity: 'PASS',
    });

    /* --- progress counts what was looked at ----------------------------- */

    const progress = afterChange?.progress;

    if (progress?.checked !== 3) {
      fail('progress counts what was checked', `checked reads ${progress?.checked}`);
    } else {
      ok('progress counts what was checked', `${progress.checked} of ${progress.total}`);
    }

    /* --- completing it -------------------------------------------------- */

    const result = await completeInspection({ orgId: org.id, userId: user.id, inspectionId });

    // Three items were looked at and one of them is fine, so two lines. A pass
    // must never become a quote line: nobody charges for a part that is good.
    if (result.lines !== 2) {
      fail('what was found becomes quote lines', `${result.lines} lines from 2 findings`);
    } else {
      ok('what was found becomes quote lines', '2 findings, 2 lines');
    }

    if (!result.summary.includes('were not checked')) {
      fail('the customer is told what was not checked', result.summary);
    } else {
      ok('the customer is told what was not checked');
    }

    const estimate = await prisma.estimate.findFirst({
      where: { jobId: job.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        status: true,
        lines: {
          select: {
            description: true,
            unitPrice: true,
            isOptional: true,
            inspectionResultId: true,
          },
        },
      },
    });

    if (!estimate) {
      fail('an estimate was created', 'none found');
    } else {
      ok('an estimate was created', `${estimate.lines.length} lines, ${estimate.status}`);

      // The link back is what lets the customer see the measurement behind
      // the price rather than a bare line item.
      const linked = estimate.lines.filter((line) => line.inspectionResultId).length;

      if (linked !== estimate.lines.length) {
        fail('every line links back to what was found', `${linked} of ${estimate.lines.length}`);
      } else {
        ok('every line links back to what was found');
      }

      // A worn brake is not an optional extra, even though the customer may
      // still decline it on the approval screen.
      const critical = estimate.lines.find((line) => line.description.includes('tyre'));

      if (critical && critical.isOptional) {
        fail('a safety item is not marked as an optional extra', 'it was');
      } else {
        ok('a safety item is not marked as an optional extra');
      }
    }

    const after = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
      select: { status: true },
    });

    if (after.status !== 'ESTIMATED') {
      fail('the job moves to waiting on the customer', `it is ${after.status}`);
    } else {
      ok('the job moves to waiting on the customer');
    }

    /* --- a completed inspection is closed -------------------------------- */

    await mustRefuse('a completed inspection cannot be edited', () =>
      recordResult({
        orgId: org.id,
        userId: user.id,
        inspectionId,
        templateItemId: first.id,
        severity: 'PASS',
      }),
    );

    await mustRefuse('a completed inspection cannot be completed again', () =>
      completeInspection({ orgId: org.id, userId: user.id, inspectionId }),
    );
  } finally {
    if (inspectionId) {
      await prisma.inspectionResult.deleteMany({ where: { inspectionId } });
      await prisma.inspection.deleteMany({ where: { id: inspectionId } });
    }

    const extra = await prisma.estimate.findMany({
      where: { jobId: job.id },
      orderBy: { version: 'desc' },
      take: Math.max(
        0,
        (await prisma.estimate.count({ where: { jobId: job.id } })) - estimatesBefore,
      ),
      select: { id: true },
    });

    for (const row of extra) {
      await prisma.estimateLine.deleteMany({ where: { estimateId: row.id } });
      await prisma.estimate.delete({ where: { id: row.id } });
    }

    await prisma.job.update({ where: { id: job.id }, data: { status: originalStatus } });

    ok('the probe cleaned up after itself');
  }

  console.info(
    `\n  ${checked} checks. ${failures === 0 ? 'An inspection becomes a quote.' : `${failures} failed.`}\n`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
