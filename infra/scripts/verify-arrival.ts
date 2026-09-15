/**
 * Arrival and departure, against a real database. Phase 35.
 *
 *   npx tsx infra/scripts/verify-arrival.ts [baseUrl]
 *
 * A car is checked in with the customer standing there, the keys move
 * between the hook and a technician, the work is done and paid, and the
 * car is handed back signed for. Every refusal that protects the record
 * refuses: a second check-in, a mileage that goes backwards, an empty pad
 * offered as a signature, a car leaving before the work is done, a car
 * leaving owing money with no reason given. An approval given across the
 * counter carries its signature. With a server on the base URL the two
 * screens are read for the one button each needs.
 *
 * Runs against the seeded hillside-motors organisation. Cleans up after
 * itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { money } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  ArrivalError,
  arrivalFor,
  checkIn,
  checkOut,
  moveKeys,
  recordSignature,
  signatureFor,
} from '../../apps/web/src/lib/arrival';
import { approveInPerson } from '../../apps/web/src/lib/estimates';
import { createJob } from '../../apps/web/src/lib/jobs';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify arrival probe';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof ArrivalError && actual === code)
      console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const scrawl = {
  width: 400,
  height: 150,
  strokes: [
    [
      [20, 80],
      [60, 40],
      [100, 90],
      [140, 30],
      [180, 100],
    ],
    [
      [200, 70],
      [240, 60],
      [280, 95],
      [320, 40],
    ],
  ] as [number, number][][],
};

const dot = {
  width: 400,
  height: 150,
  strokes: [
    [
      [10, 10],
      [11, 11],
    ],
  ] as [number, number][][],
};

async function main() {
  console.info(`\n  Arrival and departure\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true, name: true },
  });
  const technician = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'TECHNICIAN' } } },
    select: { id: true, name: true },
  });
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, portalUserId: maria.id },
    select: { id: true, displayName: true },
  });
  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true },
  });
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await forget(org.id);

  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: { id: seeded.vehicleId },
    select: { lastOdometerKm: true },
  });
  const lastKm = vehicle.lastOdometerKm ?? 0;

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
    technicianUserId: technician.id,
  });
  const cookie = await sessionFor(staff.id, org.id);

  /* ------------------------------------------------------------------
     Check-in
     ------------------------------------------------------------------ */

  console.info('\n  Check-in\n');

  await screenHas(
    'the job page offers to check the car in',
    `/jobs/${job.id}`,
    cookie,
    'Check the car in',
  );
  await screenHas(
    'the check-in page has the one button',
    `/jobs/${job.id}/check-in`,
    cookie,
    'Save the check-in',
  );

  await refuses('a mileage below the last reading is refused', 'MILEAGE_BACK', () =>
    checkIn({ orgId: org.id, userId: staff.id, jobId: job.id, odometerKm: lastKm - 1 }),
  );
  await refuses('a dot is not a signature', 'NO_SIGNATURE', () =>
    checkIn({
      orgId: org.id,
      userId: staff.id,
      jobId: job.id,
      signature: { ...dot, name: customer.displayName },
    }),
  );
  await refuses('a signature needs a name', 'NO_NAME', () =>
    checkIn({
      orgId: org.id,
      userId: staff.id,
      jobId: job.id,
      signature: { ...scrawl, name: ' ' },
    }),
  );
  await refuses('fuel is in eighths', 'BAD_FUEL', () =>
    checkIn({ orgId: org.id, userId: staff.id, jobId: job.id, fuelEighths: 9 }),
  );

  const kmIn = lastKm + 40;
  const { checkId } = await checkIn({
    orgId: org.id,
    userId: staff.id,
    jobId: job.id,
    odometerKm: kmIn,
    fuelEighths: 3,
    damage: [
      { area: 'Front bumper', note: 'scuff, nearside' },
      { area: 'Driver side', note: 'door ding' },
    ],
    belongings: 'Child seat, sat nav',
    keysHook: '12',
    signature: { ...scrawl, name: customer.displayName },
    ip: '203.0.113.9',
    userAgent: 'verify-arrival',
  });
  check('checked in', typeof checkId, 'string');

  const after = await arrivalFor(org.id, job.id);
  check(
    'the record has what was noted',
    {
      km: after?.in?.odometerKm,
      fuel: after?.in?.fuelEighths,
      marks: after?.in?.damage.length,
      hook: after?.in?.keysHook,
      signed: after?.in?.signedBy,
    },
    { km: kmIn, fuel: 3, marks: 2, hook: '12', signed: customer.displayName },
  );
  check('the keys are on the hook', after?.keys, {
    ...after?.keys,
    where: 'hook',
    hook: '12',
    sentence: 'Keys on hook 12.',
  });

  const jobRow = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { odometerInKm: true, receivedAt: true, vehicle: { select: { lastOdometerKm: true } } },
  });
  check(
    'the mileage is on the job and the vehicle',
    [jobRow.odometerInKm, jobRow.vehicle.lastOdometerKm],
    [kmIn, kmIn],
  );
  check('the job is marked received', jobRow.receivedAt !== null, true);

  const signed = await signatureFor(org.id, after!.in!.signatureId!);
  check(
    'the signature is its own record',
    {
      purpose: signed?.purpose,
      name: signed?.signedByName,
      strokes: Array.isArray(signed?.strokes) ? (signed!.strokes as unknown[]).length : 0,
      by: signed?.capturedBy?.name,
    },
    { purpose: 'CHECK_IN', name: customer.displayName, strokes: 2, by: staff.name },
  );

  await refuses('a car is checked in once', 'ALREADY_IN', () =>
    checkIn({ orgId: org.id, userId: staff.id, jobId: job.id }),
  );

  /* ------------------------------------------------------------------
     Keys
     ------------------------------------------------------------------ */

  console.info('\n  Keys\n');

  const taken = await moveKeys({
    orgId: org.id,
    userId: technician.id,
    jobId: job.id,
    action: 'TAKEN',
  });
  check(
    'the technician has the keys',
    [taken.where, taken.holder, taken.hook],
    ['with', technician.name, '12'],
  );
  const back = await moveKeys({
    orgId: org.id,
    userId: technician.id,
    jobId: job.id,
    action: 'RETURNED',
  });
  check('and puts them back on the same hook', [back.where, back.hook], ['hook', '12']);
  const moved = await moveKeys({
    orgId: org.id,
    userId: staff.id,
    jobId: job.id,
    action: 'HUNG',
    hook: '3',
  });
  check('or the desk moves them to another', moved.sentence, 'Keys on hook 3.');

  /* ------------------------------------------------------------------
     Approval with a signature
     ------------------------------------------------------------------ */

  console.info('\n  Approval across the counter\n');

  const estimate = await prisma.estimate.create({
    data: {
      orgId: org.id,
      jobId: job.id,
      version: 1,
      status: 'DRAFT',
      currency: 'GBP',
      subtotal: 100,
      taxTotal: 20,
      total: 120,
      lines: {
        create: [
          {
            kind: 'LABOUR',
            description: 'Probe labour',
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            taxRateId: vat?.id ?? null,
          },
        ],
      },
    },
    select: { id: true },
  });
  const signatureId = await recordSignature({
    orgId: org.id,
    purpose: 'ESTIMATE_APPROVAL',
    jobId: job.id,
    capturedByUserId: staff.id,
    signature: { ...scrawl, name: customer.displayName },
  });
  await approveInPerson({ orgId: org.id, userId: staff.id, estimateId: estimate.id, signatureId });
  const approval = await prisma.estimateApproval.findFirstOrThrow({
    where: { estimateId: estimate.id },
    select: { signatureId: true, approvedByName: true, signature: { select: { purpose: true } } },
  });
  check(
    'the approval points at the signature',
    [approval.signatureId === signatureId, approval.signature?.purpose],
    [true, 'ESTIMATE_APPROVAL'],
  );
  await refuses('an approval signature needs a real signature', 'NO_SIGNATURE', () =>
    recordSignature({
      orgId: org.id,
      purpose: 'ESTIMATE_APPROVAL',
      signature: { ...dot, name: customer.displayName },
    }),
  );

  /* ------------------------------------------------------------------
     Check-out
     ------------------------------------------------------------------ */

  console.info('\n  Check-out\n');

  await refuses('the car cannot leave before the work is done', 'NOT_DONE', () =>
    checkOut({ orgId: org.id, userId: staff.id, jobId: job.id }),
  );

  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
  const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId: job.id });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true, currency: true },
  });

  await screenHas(
    'the job page offers to hand the car back',
    `/jobs/${job.id}`,
    cookie,
    'Hand the car back',
  );
  await screenHas(
    'the check-out page says money is owing',
    `/jobs/${job.id}/check-out`,
    cookie,
    'Take the payment first',
  );

  await refuses('the car cannot leave owing money without a reason', 'OWING', () =>
    checkOut({ orgId: org.id, userId: staff.id, jobId: job.id, odometerKm: kmIn + 5 }),
  );
  await refuses('nor with fewer kilometres than it arrived with', 'MILEAGE_BACK', () =>
    checkOut({
      orgId: org.id,
      userId: staff.id,
      jobId: job.id,
      odometerKm: kmIn - 5,
      letGoOwingReason: 'account',
    }),
  );

  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: money(Math.round(Number(invoice.total) * 100), invoice.currency as 'GBP'),
    method: 'CARD',
  });

  const out = await checkOut({
    orgId: org.id,
    userId: staff.id,
    jobId: job.id,
    odometerKm: kmIn + 5,
    fuelEighths: 3,
    documents: ['Keys', 'Invoice', 'Old parts'],
    notes: 'Advisory on rear tyres explained.',
    signature: { ...scrawl, name: customer.displayName },
  });
  check('handed back with nothing owing', out.outstandingMinor, 0);

  const gone = await arrivalFor(org.id, job.id);
  check(
    'the hand-back record',
    {
      km: gone?.out?.odometerKm,
      docs: gone?.out?.documents,
      signed: gone?.out?.signedBy,
      owing: gone?.out?.letGoOwingReason,
    },
    {
      km: kmIn + 5,
      docs: ['Keys', 'Invoice', 'Old parts'],
      signed: customer.displayName,
      owing: null,
    },
  );
  check('the keys went with the customer', gone?.keys.where, 'customer');
  const closed = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: { collectedAt: true, odometerOutKm: true, status: true },
  });
  check(
    'the job says when it was collected and at what mileage',
    [closed.collectedAt !== null, closed.odometerOutKm, closed.status],
    [true, kmIn + 5, 'PAID'],
  );

  await refuses('a car is handed back once', 'ALREADY_OUT', () =>
    checkOut({ orgId: org.id, userId: staff.id, jobId: job.id }),
  );
  await refuses('keys cannot be taken once they are with the customer', 'NOT_IN', () =>
    moveKeys({ orgId: org.id, userId: technician.id, jobId: job.id, action: 'TAKEN' }),
  );

  /* --- leaving owing, with a reason --------------------------------- */

  const second = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobLabourLine.create({
    data: {
      jobId: second.id,
      description: 'Probe labour',
      hours: 1,
      rate: 50,
      taxRateId: vat?.id ?? null,
    },
  });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: second.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: second.id, to: 'COMPLETED' });
  await issueInvoice({ orgId: org.id, userId: staff.id, jobId: second.id });
  const owing = await checkOut({
    orgId: org.id,
    userId: staff.id,
    jobId: second.id,
    letGoOwingReason: 'Fleet account, invoiced monthly',
  });
  check('a car can leave owing money when somebody says why', owing.outstandingMinor > 0, true);
  const owingRecord = await arrivalFor(org.id, second.id);
  check(
    'and the reason is on the record',
    owingRecord?.out?.letGoOwingReason,
    'Fleet account, invoiced monthly',
  );

  await forget(org.id);
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function screenHas(label: string, path: string, cookie: string, text: string) {
  try {
    const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    const body = await response.text();
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${label}: ${path} answered ${response.status}`);
      return;
    }
    check(label, body.includes(text), true);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${label}: no server at ${BASE} (${String(error)})`);
  }
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true, vehicleId: true },
  });
  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length === 0) return;
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
  ];
  for (const source of sources)
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedId: { in: [...invoiceIds, ...payments.map((p) => p.id)] } },
  });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: {
      orgId,
      type: { in: ['job.completed', 'invoice.issued', 'payment.received'] },
      processedAt: null,
    },
  });
  // Signatures are set null on the job by the cascade; remove the probe's own.
  await prisma.signature.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  // The probe's odometer readings, so the seeded vehicle's mileage is as it was.
  await prisma.odometerReading.deleteMany({
    where: { vehicleId: { in: jobs.map((j) => j.vehicleId) }, recordedByOrgId: orgId },
  });
  for (const vehicleId of new Set(jobs.map((j) => j.vehicleId))) {
    const latest = await prisma.odometerReading.findFirst({
      where: { vehicleId },
      orderBy: { readAt: 'desc' },
      select: { km: true },
    });
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { lastOdometerKm: latest?.km ?? null },
    });
  }
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
