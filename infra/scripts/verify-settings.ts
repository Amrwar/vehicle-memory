/**
 * The workshop configures itself, against a real database.
 *
 *   npx tsx infra/scripts/verify-settings.ts
 *
 * Phase 19 promises that a workshop can change its own details, site, bays,
 * tax rates and kinds of work without anybody at Carnet touching a database;
 * that a bad value is refused with its reason; that nothing is deleted and
 * the one default tax rate survives; and that every change is in the audit
 * log with what it was before. It also promises that accepting the day's
 * plan writes it into the diary once, and that the next proposal treats
 * those bookings as fixed.
 *
 * It cleans up after itself and puts every setting back as it found it.
 */

import 'dotenv/config';

import { PlanError, SettingsError } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import { acceptPlan, proposeDay } from '../../apps/web/src/lib/planning';
import {
  saveBay,
  saveJobType,
  saveTaxRate,
  setBayActive,
  setDefaultTaxRate,
  setJobTypeActive,
  setNumberingPrefix,
  setTaxRateActive,
  updateOrganisation,
  updateSite,
} from '../../apps/web/src/lib/settings';

const TAG = 'verify-settings probe';

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

async function refuses<E extends Error & { code: string }>(
  label: string,
  kind: new (...args: never[]) => E,
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
    check(label, 'allowed', `refused with ${code}`);
  } catch (error) {
    if (error instanceof kind) check(label, error.code, code);
    else throw error;
  }
}

/** The next Tuesday at nine, so the day under test is never a weekend or gone. */
function nextTuesday(): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
  return date;
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER', isActive: true } } },
    select: { id: true },
  });
  const site = await prisma.location.findFirstOrThrow({
    where: { orgId: org.id, isDefault: true },
  });

  await forget(org.id, site.id);

  const startedAt = new Date();

  console.info('\nThe organisation');

  const orgBefore = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
    select: {
      name: true,
      legalName: true,
      taxNumber: true,
      email: true,
      phone: true,
      website: true,
      reapprovalThresholdPct: true,
    },
  });

  await updateOrganisation({
    orgId: org.id,
    userId: owner.id,
    ...orgBefore,
    phone: '0113 496 0000',
    reapprovalThresholdPct: 12.5,
  });
  const orgAfter = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
    select: { phone: true, reapprovalThresholdPct: true, name: true },
  });
  check('the telephone number changed', orgAfter.phone, '0113 496 0000');
  check('and the threshold', Number(orgAfter.reapprovalThresholdPct), 12.5);
  check('but not the name', orgAfter.name, orgBefore.name);

  const orgAudit = await prisma.auditLog.findFirst({
    where: { orgId: org.id, action: 'settings.organisation', createdAt: { gte: startedAt } },
    orderBy: { createdAt: 'desc' },
    select: { before: true, after: true },
  });
  check(
    'the change is audited with what it was',
    (orgAudit?.before as { phone: string | null })?.phone,
    orgBefore.phone,
  );
  check('  and what it became', (orgAudit?.after as { phone: string })?.phone, '0113 496 0000');

  await refuses('a threshold over 100 is refused', SettingsError, 'BAD_THRESHOLD', () =>
    updateOrganisation({
      orgId: org.id,
      userId: owner.id,
      ...orgBefore,
      reapprovalThresholdPct: 150,
    }),
  );
  await refuses('so is a non-address', SettingsError, 'BAD_EMAIL', () =>
    updateOrganisation({
      orgId: org.id,
      userId: owner.id,
      ...orgBefore,
      reapprovalThresholdPct: 10,
      email: 'front desk',
    }),
  );
  await refuses('and a blank name', SettingsError, 'NO_NAME', () =>
    updateOrganisation({
      orgId: org.id,
      userId: owner.id,
      ...orgBefore,
      reapprovalThresholdPct: 10,
      name: ' ',
    }),
  );

  // Back as it was.
  await updateOrganisation({
    orgId: org.id,
    userId: owner.id,
    ...orgBefore,
    reapprovalThresholdPct: Number(orgBefore.reapprovalThresholdPct),
  });

  console.info('\nNumbering');

  const invoiceSequence = await prisma.documentSequence.findFirstOrThrow({
    where: { orgId: org.id, kind: 'INVOICE' },
  });
  await setNumberingPrefix({
    orgId: org.id,
    userId: owner.id,
    sequenceId: invoiceSequence.id,
    prefix: 'prb-',
  });
  const renumbered = await prisma.documentSequence.findUniqueOrThrow({
    where: { id: invoiceSequence.id },
  });
  check('the prefix is stored upper case', renumbered.prefix, 'PRB-');
  check('and the counter is untouched', renumbered.next, invoiceSequence.next);
  await refuses('a long prefix is refused', SettingsError, 'BAD_PREFIX', () =>
    setNumberingPrefix({
      orgId: org.id,
      userId: owner.id,
      sequenceId: invoiceSequence.id,
      prefix: 'INVOICE-2026',
    }),
  );
  await setNumberingPrefix({
    orgId: org.id,
    userId: owner.id,
    sequenceId: invoiceSequence.id,
    prefix: invoiceSequence.prefix,
  });

  console.info('\nThe site');

  const siteFields = {
    name: site.name,
    code: site.code,
    addressLine1: site.addressLine1,
    addressLine2: site.addressLine2,
    locality: site.locality,
    region: site.region,
    postcode: site.postcode,
    phone: site.phone,
    dailyCapacityHours: Number(site.dailyCapacityHours),
  };

  await updateSite({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    ...siteFields,
    opensAtMinute: 7 * 60,
    closesAtMinute: 19 * 60,
  });
  const tuesday = nextTuesday();
  const longDay = await proposeDay(org.id, site.id, tuesday);
  check(
    'the planner reads the new opening hours',
    [longDay.openMinute, longDay.closeMinute],
    [420, 1140],
  );

  await refuses('a site that closes before it opens is refused', SettingsError, 'BAD_HOURS', () =>
    updateSite({
      orgId: org.id,
      userId: owner.id,
      locationId: site.id,
      ...siteFields,
      opensAtMinute: 1080,
      closesAtMinute: 480,
    }),
  );
  await refuses('so is a blank code', SettingsError, 'BAD_CODE', () =>
    updateSite({
      orgId: org.id,
      userId: owner.id,
      locationId: site.id,
      ...siteFields,
      code: '  ',
      opensAtMinute: 480,
      closesAtMinute: 1080,
    }),
  );

  await updateSite({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    ...siteFields,
    opensAtMinute: site.opensAtMinute,
    closesAtMinute: site.closesAtMinute,
  });

  console.info('\nBays');

  const bayId = await saveBay({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    name: TAG,
    code: 'prb 9',
    capability: ' scan tool ',
  });
  const bay = await prisma.bay.findUniqueOrThrow({ where: { id: bayId } });
  check('the code is normalised', bay.code, 'PRB9');
  check('and the capability tidied', bay.capability, 'scan tool');
  await refuses('a second bay with the same code is refused', SettingsError, 'DUPLICATE', () =>
    saveBay({
      orgId: org.id,
      userId: owner.id,
      locationId: site.id,
      name: `${TAG} twin`,
      code: 'PRB9',
    }),
  );
  await saveBay({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    bayId,
    name: `${TAG} renamed`,
    code: 'PRB9',
  });
  check(
    'renaming keeps the row',
    (await prisma.bay.findUniqueOrThrow({ where: { id: bayId } })).name,
    `${TAG} renamed`,
  );
  await setBayActive({ orgId: org.id, userId: owner.id, bayId, active: false });
  check(
    'retiring hides it without deleting it',
    (await prisma.bay.findUniqueOrThrow({ where: { id: bayId } })).isActive,
    false,
  );
  await setBayActive({ orgId: org.id, userId: owner.id, bayId, active: true });

  console.info('\nTax rates');

  const defaultBefore = await prisma.taxRate.findFirstOrThrow({
    where: { orgId: org.id, isDefault: true },
  });
  const rateId = await saveTaxRate({ orgId: org.id, userId: owner.id, name: TAG, rate: 7.5 });
  await setDefaultTaxRate({ orgId: org.id, userId: owner.id, taxRateId: rateId });
  const defaults = await prisma.taxRate.findMany({
    where: { orgId: org.id, isDefault: true },
    select: { id: true },
  });
  check(
    'exactly one default, and it is the new one',
    defaults.map((row) => row.id),
    [rateId],
  );
  await refuses('the default cannot be retired', SettingsError, 'LAST_ONE', () =>
    setTaxRateActive({ orgId: org.id, userId: owner.id, taxRateId: rateId, active: false }),
  );
  await setDefaultTaxRate({ orgId: org.id, userId: owner.id, taxRateId: defaultBefore.id });
  check(
    'the old default is back',
    (await prisma.taxRate.findUniqueOrThrow({ where: { id: defaultBefore.id } })).isDefault,
    true,
  );

  const used = await prisma.taxRate.findFirst({
    where: { orgId: org.id, invoiceLines: { some: {} } },
    select: { id: true, name: true, rate: true },
  });
  if (used) {
    await refuses(
      'a rate that has been invoiced keeps its percentage',
      SettingsError,
      'BAD_RATE',
      () =>
        saveTaxRate({
          orgId: org.id,
          userId: owner.id,
          taxRateId: used.id,
          name: used.name,
          rate: Number(used.rate) + 1,
        }),
    );
  }
  await refuses('a percentage over 100 is refused', SettingsError, 'BAD_RATE', () =>
    saveTaxRate({ orgId: org.id, userId: owner.id, name: `${TAG} odd`, rate: 120 }),
  );
  await setTaxRateActive({ orgId: org.id, userId: owner.id, taxRateId: rateId, active: false });
  check(
    'a spare rate can be retired',
    (await prisma.taxRate.findUniqueOrThrow({ where: { id: rateId } })).isActive,
    false,
  );

  console.info('\nKinds of work');

  const typeId = await saveJobType({
    orgId: org.id,
    userId: owner.id,
    name: TAG,
    colour: '#123ABC',
    defaultHours: 1.5,
    requiresQualityCheck: true,
  });
  const type = await prisma.jobType.findUniqueOrThrow({ where: { id: typeId } });
  check('the colour is stored lower case', type.colour, '#123abc');
  check(
    'with its hours and its check',
    [Number(type.defaultHours), type.requiresQualityCheck],
    [1.5, true],
  );
  await refuses('a colour that is not hex is refused', SettingsError, 'BAD_COLOUR', () =>
    saveJobType({
      orgId: org.id,
      userId: owner.id,
      jobTypeId: typeId,
      name: TAG,
      colour: 'blue',
      defaultHours: 1,
      requiresQualityCheck: false,
    }),
  );
  await refuses('and a duplicate name', SettingsError, 'DUPLICATE', () =>
    saveJobType({
      orgId: org.id,
      userId: owner.id,
      name: TAG,
      colour: '#000000',
      defaultHours: null,
      requiresQualityCheck: false,
    }),
  );
  await setJobTypeActive({ orgId: org.id, userId: owner.id, jobTypeId: typeId, active: false });
  check(
    'retiring keeps it',
    (await prisma.jobType.findUniqueOrThrow({ where: { id: typeId } })).isActive,
    false,
  );

  const audited = await prisma.auditLog.count({
    where: { orgId: org.id, action: { startsWith: 'settings.' }, createdAt: { gte: startedAt } },
  });
  check('every change so far is in the audit log', audited >= 14, true);

  console.info('\nAccepting the plan');

  const previous = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { createdAt: 'desc' },
    select: { customerId: true, vehicleId: true },
  });

  // The bays the live jobs sit on now, so they can be put back: acceptance
  // moves jobs onto the bays the plan chose.
  const baysBefore = await prisma.job.findMany({
    where: {
      orgId: org.id,
      status: { in: ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'QUALITY_CHECK'] },
    },
    select: { id: true, bayId: true },
  });

  const probeJob = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    customerId: previous.customerId,
    vehicleId: previous.vehicleId,
    shortDescription: TAG,
  });

  const proposal = await proposeDay(org.id, site.id, tuesday);
  const placed = proposal.assignments.find((assignment) => assignment.itemId === probeJob.id);
  check('the probe job is placed', placed !== undefined, true);

  await refuses('a day that has gone cannot be written', PlanError, 'IN_THE_PAST', () =>
    acceptPlan({
      orgId: org.id,
      userId: owner.id,
      locationId: site.id,
      date: new Date(2020, 0, 6),
    }),
  );

  const accepted = await acceptPlan({
    orgId: org.id,
    userId: owner.id,
    locationId: site.id,
    date: tuesday,
  });
  check('every placement was written', accepted.written, proposal.assignments.length);
  check(
    'and the banner says so',
    /placements? written into the diary/.test(accepted.message),
    true,
  );

  const booking = await prisma.booking.findUnique({
    where: { jobId: probeJob.id },
    select: {
      id: true,
      source: true,
      status: true,
      startAt: true,
      endAt: true,
      bayId: true,
      technicianId: true,
    },
  });
  check('the probe job has a booking', booking !== null, true);
  check('  from the plan', booking?.source, 'PLAN');
  check('  scheduled', booking?.status, 'SCHEDULED');
  check('  on the day', booking?.startAt.toDateString(), tuesday.toDateString());
  check(
    '  at the time the plan chose',
    booking ? booking.startAt.getHours() * 60 + booking.startAt.getMinutes() : null,
    placed?.startMinute ?? null,
  );
  check('  on the bay the plan chose', booking?.bayId ?? null, placed?.bayId ?? null);

  const movedJob = await prisma.job.findUniqueOrThrow({
    where: { id: probeJob.id },
    select: { bayId: true },
  });
  check('and the job sits on that bay', movedJob.bayId, placed?.bayId ?? null);

  const again = await proposeDay(org.id, site.id, tuesday);
  check(
    'the next proposal treats what was written as fixed',
    again.alreadyInDiary,
    accepted.written,
  );
  check(
    '  and does not place the probe job twice',
    again.assignments.some((row) => row.itemId === probeJob.id),
    false,
  );
  check(
    '  nor list it as left over',
    again.unplaced.some((row) => row.itemId === probeJob.id),
    false,
  );

  await refuses(
    'accepting an empty day is refused rather than writing nothing',
    PlanError,
    'NOTHING_PLACED',
    () => acceptPlan({ orgId: org.id, userId: owner.id, locationId: site.id, date: tuesday }),
  );

  const bookingsForJob = await prisma.booking.count({ where: { jobId: probeJob.id } });
  check('one booking per job, however many times the plan runs', bookingsForJob, 1);

  const planAudit = await prisma.auditLog.count({
    where: { orgId: org.id, action: 'plan.accepted', createdAt: { gte: startedAt } },
  });
  check('the acceptance is audited', planAudit >= 1, true);

  console.info('\nClearing up');

  await prisma.booking.deleteMany({ where: { id: { in: accepted.bookingIds } } });
  for (const row of baysBefore) {
    await prisma.job.update({ where: { id: row.id }, data: { bayId: row.bayId } });
  }
  await forget(org.id, site.id);

  console.info(
    failures === 0
      ? '\nverify-settings: all checks passed'
      : `\nverify-settings: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

/** Everything a run wrote that can be removed. */
async function forget(orgId: string, locationId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((job) => job.id);
  await prisma.booking.deleteMany({
    where: {
      OR: [{ jobId: { in: jobIds } }, { orgId, source: 'PLAN', description: { contains: TAG } }],
    },
  });
  await prisma.outboxEvent.deleteMany({ where: { orgId, type: 'job.created', processedAt: null } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });

  await prisma.bay.deleteMany({ where: { locationId, name: { startsWith: TAG } } });
  await prisma.taxRate.deleteMany({ where: { orgId, name: { startsWith: TAG } } });
  await prisma.jobType.deleteMany({ where: { orgId, name: { startsWith: TAG } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
