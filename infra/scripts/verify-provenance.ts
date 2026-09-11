/**
 * Where a record came from, and whether a part belongs on a car.
 *
 *   npx tsx infra/scripts/verify-provenance.ts
 *
 * Two things this product is sold on meet here. A record whose history can be
 * read, and a warning that fires when the wrong part is about to go on a car.
 *
 * The unit tests prove both sets of rules against fixtures. What they cannot
 * prove is the part that actually leaks: that one workshop cannot read
 * another's history by guessing an id, and that a secret written into an audit
 * payload by some caller years from now does not reach a screen.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  checkFit,
  fitmentWarningsForJob,
  lifeFor,
  recordFitment,
  removeFitment,
} from '../../apps/web/src/lib/provenance';

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

async function refuses(label: string, constraint: string, sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
    failures += 1;
    console.error(`  FAIL   ${label}: the database accepted it`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(constraint)) {
      console.info(`  ok     ${label}: refused by ${constraint}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: refused, but not by ${constraint}. Got: ${message}`);
    }
  }
}

const PROBE = 'Verify provenance probe';

/**
 * Writes an audit row directly.
 *
 * Not through `audit()`, which reads request headers and swallows its own
 * failures so that a logging problem can never break somebody's action. That
 * is right in the application and useless in a script: outside a request it
 * fails silently and the probe would pass having written nothing.
 */
async function record(input: {
  orgId: string;
  actorUserId: string;
  action: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: 'Job',
      entityId: input.entityId,
      before: (input.before ?? undefined) as never,
      after: (input.after ?? undefined) as never,
      ip: '203.0.113.7',
      userAgent: input.userAgent ?? 'probe',
    },
  });
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true, name: true },
  });

  await prisma.partFitment.deleteMany({ where: { note: PROBE } });

  // A synthetic id belonging to no real record. The audit log is immutable by
  // design, so anything written here can never be tidied away, and writing
  // fabricated history against a real job would leave it on that job forever.
  const subject = `vfy-prov-${Date.now()}`;

  console.info('\nA record read as its own history');

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, vehicleId: true, number: true },
  });

  // Three actions in order, the middle one a change rather than a milestone.
  await record({
    orgId: org.id,
    actorUserId: user.id,
    action: 'job.created',
    entityId: subject,
    after: { number: job.number, status: 'RECEIVED' },
  });

  await record({
    orgId: org.id,
    actorUserId: user.id,
    action: 'job.note.updated',
    entityId: subject,
    before: { note: 'Original note', estimatedHours: 2 },
    after: { note: 'Corrected note', estimatedHours: 2 },
  });

  await record({
    orgId: org.id,
    actorUserId: user.id,
    action: 'job.completed',
    entityId: subject,
    after: { status: 'COMPLETED' },
  });

  const life = await lifeFor(org.id, 'Job', subject);

  check('it exists', life !== null, true);
  check('it reads from the beginning', life!.events[0]!.title, 'Created job');
  check(
    'it separates a milestone from a detail',
    [life!.events[0]!.milestone, life!.events[1]!.milestone],
    [true, false],
  );
  check(
    'it shows only what actually changed',
    life!.events[1]!.changes.map((change) => change.field),
    ['Note'],
  );
  check('and names who did it', life!.events[0]!.actorName, user.name);

  console.info('\nWhat never reaches a screen');

  // The failure mode this exists to prevent: some caller years from now
  // includes a token in an audit payload, and the page publishes it.
  await record({
    orgId: org.id,
    actorUserId: user.id,
    action: 'integration.updated',
    entityId: subject,
    before: { apiKey: 'sk-old-000', config: { smtpSecret: 'hunter2' }, host: 'a' },
    after: { apiKey: 'sk-new-111', config: { smtpSecret: 'hunter3' }, host: 'b' },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  });

  const withSecret = await lifeFor(org.id, 'Job', subject);
  const rendered = JSON.stringify(withSecret!.events);

  check('no key reaches the page', rendered.includes('sk-new-111'), false);
  check('no nested secret reaches it either', rendered.includes('hunter3'), false);
  check('while the ordinary field beside them still does', rendered.includes('Host'), true);

  console.info('\nWhat one workshop cannot read');

  const other = await prisma.organization.findFirst({ where: { NOT: { id: org.id } } });

  if (other) {
    const foreign = await lifeFor(other.id, 'Job', subject);
    check('another workshop sees no history for this job', foreign!.events.length, 0);
  } else {
    console.info('  --     only one organisation here, so nothing to isolate from');
  }

  const unknown = await lifeFor(org.id, 'Session', subject);
  check('a type nobody vetted is refused outright', unknown, null);

  console.info('\nWhether a part fits');

  const pads = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: '34116794300' },
    select: { id: true },
  });

  const bmw = await prisma.vehicle.findFirstOrThrow({
    where: { make: 'BMW' },
    select: { id: true },
  });

  const corolla = await prisma.vehicle.findFirstOrThrow({
    where: { make: 'Toyota' },
    select: { id: true },
  });

  const onBmw = await checkFit(org.id, pads.id, bmw.id);
  const onToyota = await checkFit(org.id, pads.id, corolla.id);

  check('BMW pads fit the BMW', onBmw.verdict, 'FITS');
  check('and do not fit the Toyota', onToyota.verdict, 'DOES_NOT_FIT');

  const noData = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id, partNumber: 'BRK-FLUID-1L' },
    select: { id: true },
  });

  // The state every workshop is in on its first day. Silence must not read as
  // approval, and it must not read as a fault either.
  const quiet = await checkFit(org.id, noData.id, bmw.id);
  check('a part with nothing recorded is unknown, not fitting', quiet.verdict, 'UNKNOWN');
  check('and carries no confidence at all', quiet.confidence, 'NONE');

  console.info('\nWhat a job warns about');

  const warnings = await fitmentWarningsForJob(org.id, job.id);
  check(
    'nothing that fits is raised',
    warnings.every((entry) => entry.result.verdict !== 'FITS'),
    true,
  );

  console.info('\nRecording and removing a claim');

  const recorded = await recordFitment({
    orgId: org.id,
    userId: user.id,
    productId: noData.id,
    make: 'Probe',
    model: 'Fitment',
    yearFrom: 2018,
    yearTo: 2022,
    note: PROBE,
  });

  let backwards = 'accepted';
  try {
    await recordFitment({
      orgId: org.id,
      userId: user.id,
      productId: noData.id,
      make: 'Probe',
      yearFrom: 2022,
      yearTo: 2018,
      note: PROBE,
    });
  } catch (error) {
    backwards = error instanceof Error ? error.message.slice(0, 20) : 'refused';
  }
  check('a backwards year range is refused with a sentence', backwards !== 'accepted', true);

  await removeFitment({ orgId: org.id, userId: user.id, fitmentId: recorded });

  const gone = await prisma.partFitment.count({ where: { id: recorded } });
  check('removing it takes the row away', gone, 0);

  console.info('\nThe database, underneath it');

  await refuses(
    'a fitment with no make',
    'part_fitments_name_a_make',
    `INSERT INTO "part_fitments" ("id","orgId","productId","make","updatedAt")
     VALUES ('vfy-prov-1','${org.id}','${noData.id}','   ',NOW())`,
  );

  await refuses(
    'a year range the wrong way round',
    'part_fitments_years_run_forwards',
    `INSERT INTO "part_fitments" ("id","orgId","productId","make","yearFrom","yearTo","updatedAt")
     VALUES ('vfy-prov-2','${org.id}','${noData.id}','Probe',2022,2018,NOW())`,
  );

  await refuses(
    'a year before cars existed',
    'part_fitments_years_run_forwards',
    `INSERT INTO "part_fitments" ("id","orgId","productId","make","yearFrom","updatedAt")
     VALUES ('vfy-prov-3','${org.id}','${noData.id}','Probe',1200,NOW())`,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "part_fitments" ("id","orgId","productId","make","model","note","updatedAt")
     VALUES ('vfy-prov-4','${org.id}','${noData.id}','Probe','Duplicate','${PROBE}',NOW())`,
  );

  await refuses(
    'the same claim twice, whatever the capitals',
    'part_fitments_one_claim_each',
    `INSERT INTO "part_fitments" ("id","orgId","productId","make","model","note","updatedAt")
     VALUES ('vfy-prov-5','${org.id}','${noData.id}','  probe ','DUPLICATE','${PROBE}',NOW())`,
  );

  console.info('\nWhat cannot be tidied away');

  // Not a cleanup failure. The audit log is immutable, and that is the point:
  // a trail somebody can delete a row from is a trail nobody should have
  // trusted. The probe's own rows stay, recording that it ran.
  try {
    await prisma.auditLog.deleteMany({ where: { entityId: subject } });
    failures += 1;
    console.error('  FAIL   an audit row was deleted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('immutable') || message.includes('Foreign key')) {
      console.info('  ok     the audit log refuses to let a row be deleted');
    } else {
      failures += 1;
      console.error(`  FAIL   refused for the wrong reason: ${message}`);
    }
  }

  await prisma.partFitment.deleteMany({ where: { note: PROBE } });

  const left = await prisma.partFitment.count({ where: { note: PROBE } });
  check('every fitment the probe wrote is gone', left, 0);

  console.info(
    failures === 0
      ? '\nProvenance and fitment behaved correctly.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
