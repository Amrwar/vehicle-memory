/**
 * Work recorded with no signal, applied against a real database.
 *
 *   npx tsx infra/scripts/verify-offline.ts
 *
 * The unit tests prove the reconciling rules. What they cannot prove is the
 * thing that actually loses somebody's morning: that a flush interrupted
 * halfway and retried writes each action once, not twice, and that the second
 * attempt is recognised by the row the first one left behind.
 *
 * Everything here runs the real write path, which is the same path the online
 * screens use. A second implementation for offline work would be a second set
 * of rules to keep in step, and the first to drift would be whichever one
 * nobody tested.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { type QueuedAction } from '@carnet/core';
import { prisma } from '@carnet/db';

import { briefcaseFor, flush, readActions } from '../../apps/web/src/lib/sync';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const PROBE = 'Verify offline probe';

function id(suffix: string): string {
  return `vfy-offline-${suffix}-${Date.now()}`;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const technician = await prisma.user.findFirstOrThrow({
    where: { email: 'john@hillsidemotors.test' },
    select: { id: true },
  });

  await prisma.syncedAction.deleteMany({ where: { clientId: { startsWith: 'vfy-offline-' } } });
  await prisma.jobNote.deleteMany({ where: { body: { startsWith: PROBE } } });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: { in: ['IN_PROGRESS', 'RECEIVED', 'DIAGNOSED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, vehicleId: true },
  });

  console.info('\nWhat a device sends');

  const note = (suffix: string, text: string): QueuedAction => ({
    clientId: id(suffix),
    type: 'job.note',
    at: new Date(Date.now() - 60_000),
    subjectId: job.id,
    payload: { text: `${PROBE}: ${text}` },
  });

  const first = note('note-a', 'from under the car');

  const once = await flush({ orgId: org.id, userId: technician.id, actions: [first] });

  check('it applied', once.applied, 1);

  const written = await prisma.jobNote.count({ where: { body: { startsWith: PROBE } } });
  check('and the note is actually there', written, 1);

  console.info('\nA flush that was interrupted and retried');

  // The failure this whole mechanism exists to prevent. Without the device id,
  // a retry writes the entire morning again.
  const twice = await flush({ orgId: org.id, userId: technician.id, actions: [first] });

  check('the retry is recognised', twice.duplicates, 1);
  check('and nothing applied a second time', twice.applied, 0);

  const stillOne = await prisma.jobNote.count({ where: { body: { startsWith: PROBE } } });
  check('so the note is still there once', stillOne, 1);

  console.info('\nTwo devices, two notes, neither lost');

  const both = await flush({
    orgId: org.id,
    userId: technician.id,
    actions: [note('note-b', 'from the ramp'), note('note-c', 'from the office')],
  });

  check('both applied', both.applied, 2);
  check(
    'and both are on the job',
    await prisma.jobNote.count({ where: { body: { startsWith: PROBE } } }),
    3,
  );

  console.info('\nA note keeps when it was written');

  const earliest = await prisma.jobNote.findFirstOrThrow({
    where: { body: { startsWith: PROBE } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  // Not the moment it arrived. A note that arrived at five and was written at
  // nine belongs at nine, or the job reads as though nothing happened all day.
  check(
    'by the device clock, not the arrival',
    earliest.createdAt < new Date(Date.now() - 30_000),
    true,
  );

  console.info('\nWhat a device is refused');

  const billed = await prisma.job.findFirst({
    where: { orgId: org.id, status: { in: ['INVOICED', 'PAID'] } },
    select: { id: true },
  });

  if (billed) {
    const onBilled = await flush({
      orgId: org.id,
      userId: technician.id,
      actions: [
        {
          clientId: id('billed'),
          type: 'job.note',
          at: new Date(),
          subjectId: billed.id,
          payload: { text: `${PROBE}: too late` },
        },
      ],
    });

    check('nothing lands on a job that was invoiced meanwhile', onBilled.conflicts, 1);
    check(
      'and it is not written',
      await prisma.jobNote.count({ where: { jobId: billed.id, body: { startsWith: PROBE } } }),
      0,
    );
  } else {
    console.info('  --     no invoiced job on this database to try against');
  }

  const illegal = await flush({
    orgId: org.id,
    userId: technician.id,
    actions: [
      {
        clientId: id('illegal'),
        type: 'job.status',
        at: new Date(),
        subjectId: job.id,
        payload: { status: 'INVOICED' },
      },
    ],
  });

  check('a technician device cannot invoice anything', illegal.conflicts, 1);

  const tampered = await flush({
    orgId: org.id,
    userId: technician.id,
    actions: [
      {
        clientId: id('tampered'),
        type: 'invoice.issue' as never,
        at: new Date(),
        subjectId: job.id,
        payload: {},
      },
    ],
  });

  check('an action nobody put on the list is refused', tampered.conflicts, 1);

  console.info('\nWhat the device is given to work with');

  const briefcase = await briefcaseFor(org.id, technician.id);

  check('it carries the jobs assigned to that person', Array.isArray(briefcase.jobs), true);

  const leaked = JSON.stringify(briefcase).toLowerCase();
  // A device that leaves the building holds what the person carrying it needs
  // and nothing else.
  check('and nothing about money', leaked.includes('"total"') || leaked.includes('invoice'), false);
  check('or anybody address', leaked.includes('addressline'), false);

  console.info('\nWhat arrives from a browser is not trusted');

  check('a body that is not a batch reads as nothing', readActions({ hello: 'world' }).length, 0);
  check(
    'an unreadable date is dropped rather than written',
    readActions({ actions: [{ clientId: 'x'.repeat(12), type: 'job.note', at: 'not a date' }] })
      .length,
    0,
  );
  check(
    'and a batch is capped',
    readActions({
      actions: Array.from({ length: 900 }, () => ({
        clientId: 'y'.repeat(12),
        type: 'job.note',
        at: new Date().toISOString(),
        subjectId: 'job',
      })),
    }).length,
    500,
  );

  console.info('\nThe database, underneath it');

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "synced_actions" ("id","orgId","clientId","type","subjectId","recordedAt")
       VALUES ('vfy-offline-raw','${org.id}','short','job.note','${job.id}',NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a trivially short device id was accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'a device id too short to be unique is refused',
      message.includes('synced_actions_have_a_device_id'),
      true,
    );
  }

  await prisma.jobNote.deleteMany({ where: { body: { startsWith: PROBE } } });
  await prisma.syncedAction.deleteMany({ where: { clientId: { startsWith: 'vfy-offline-' } } });

  const left = await prisma.jobNote.count({ where: { body: { startsWith: PROBE } } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0 ? '\nOffline work reconciled correctly.' : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
