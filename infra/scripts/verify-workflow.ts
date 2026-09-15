/**
 * A job walked from booking to pickup the way a front desk would. Phase 34.
 *
 *   npx tsx infra/scripts/verify-workflow.ts [baseUrl]
 *
 * Every step is one of the hand-offs written down in the core workflow
 * table, with the presses it cost and the screen it happened on. The walk
 * fails on any step that costs more presses than the table says, or that
 * needs a screen the table does not name: that is the whole test. Along the
 * way it checks the things each press is supposed to have done: a booking
 * that became a job with everything on it, an estimate priced as it was
 * raised, an approval that put the lines on the job and reserved the parts,
 * extra work quoted without stopping the job, and a bill paid.
 *
 * With a server on the base URL it also reads the three screens the desk
 * uses and fails if the one button each needs is not on it.
 *
 * Runs against the seeded hillside-motors organisation. Cleans up after
 * itself, including the stock it reserved and fitted.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import {
  checkWalk,
  money,
  pressesBefore,
  pressesFor,
  WORKFLOWS,
  type WalkedStep,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { BookingError, createBooking, startJobFromBooking } from '../../apps/web/src/lib/bookings';
import { approveInPerson, QuoteError, quoteExtraWork } from '../../apps/web/src/lib/estimates';
import {
  completeInspection,
  inspectionFor,
  recordResult,
  startInspection,
} from '../../apps/web/src/lib/inspections';
import { issueInvoice, moveJob, recordPayment } from '../../apps/web/src/lib/money';
import { recordDecision } from '../../apps/web/src/lib/portal';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify workflow probe';

let failures = 0;
const steps: WalkedStep[] = [];

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

async function refuses(
  label: string,
  kind: new (...args: never[]) => Error,
  code: string,
  run: () => Promise<unknown>,
) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof kind && actual === code) console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

/** One hand-off, walked: what it cost and where it happened. */
function press(handoff: string, screen: WalkedStep['screen'], presses: number) {
  steps.push({ handoff, screen, presses });
  console.info(`  press  ${handoff}: ${presses} on the ${screen}`);
}

async function main() {
  console.info(`\n  The workflow, as one thing\n  ${BASE}\n`);

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
    select: { id: true, displayName: true, email: true },
  });
  const seededJob = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true, locationId: true },
  });
  const level = await prisma.stockLevel.findFirstOrThrow({
    where: { product: { orgId: org.id }, onHand: { gte: 2 } },
    select: {
      productId: true,
      warehouseId: true,
      onHand: true,
      reserved: true,
      product: { select: { partNumber: true, name: true, sellPrice: true } },
    },
  });
  // Read after the clean-up, so a walk that failed last time does not
  // leave its stock as this walk's starting point.
  await forget(org.id);
  const before = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: level.productId, warehouseId: level.warehouseId },
    },
    select: { onHand: true, reserved: true },
  });
  const onHand = Number(before.onHand);
  const reservedBefore = Number(before.reserved);

  /* ------------------------------------------------------------------
     The customer arrives
     ------------------------------------------------------------------ */

  console.info('\n  The customer arrives\n');

  const startAt = new Date();
  startAt.setHours(9, 0, 0, 0);
  const bookingId = await createBooking({
    orgId: org.id,
    userId: staff.id,
    locationId: seededJob.locationId,
    customerId: customer.id,
    vehicleId: seededJob.vehicleId,
    startAt,
    estimatedHours: 2,
    description: TAG,
    technicianId: technician.id,
    notes: 'Customer mentions a squeal from the rear.',
  });

  const cookie = await sessionFor(staff.id, org.id);
  await screenHas(
    'the booking page offers one press to start the job',
    `/bookings/${bookingId}`,
    cookie,
    'Car is here, start the job',
  );

  const { jobId } = await startJobFromBooking({ orgId: org.id, userId: staff.id, bookingId });
  press('Booking to job, at the desk', 'booking', 1);

  const opened = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      status: true,
      shortDescription: true,
      details: true,
      customerId: true,
      vehicleId: true,
      promisedAt: true,
      technicians: { select: { userId: true } },
    },
  });
  check('the job is received', opened.status, 'RECEIVED');
  check('with the description from the booking', opened.shortDescription, TAG);
  check('and the notes', opened.details, 'Customer mentions a squeal from the rear.');
  check(
    'and the customer and car',
    [opened.customerId, opened.vehicleId],
    [customer.id, seededJob.vehicleId],
  );
  check(
    'and the technician',
    opened.technicians.map((t) => t.userId),
    [technician.id],
  );
  check(
    'promised for the end of the slot',
    opened.promisedAt?.getTime(),
    startAt.getTime() + 7_200_000,
  );

  const converted = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { status: true, jobId: true },
  });
  check('the booking says so', [converted.status, converted.jobId === jobId], ['CONVERTED', true]);
  await refuses('a booking is a job once', BookingError, 'ALREADY_CONVERTED', () =>
    startJobFromBooking({ orgId: org.id, userId: staff.id, bookingId }),
  );

  /* ------------------------------------------------------------------
     The vehicle needs work
     ------------------------------------------------------------------ */

  console.info('\n  The vehicle needs work\n');

  const inspectionId = await startInspection({ orgId: org.id, userId: technician.id, jobId });
  press('Technician opens the inspection', 'tablet', 1);

  const loaded = await inspectionFor(org.id, inspectionId);
  const [first, second] = loaded.items;
  await recordResult({
    orgId: org.id,
    userId: technician.id,
    inspectionId,
    templateItemId: first!.id,
    severity: 'CRITICAL',
    note: 'Rear pads at 2 mm',
    recommendedAction: 'Replace rear brake pads',
    estimatedCost: 120,
  });
  await recordResult({
    orgId: org.id,
    userId: technician.id,
    inspectionId,
    templateItemId: second!.id,
    severity: 'PASS',
  });
  await completeInspection({ orgId: org.id, userId: technician.id, inspectionId });
  press('Inspection to estimate', 'tablet', 1);

  const raised = await prisma.estimate.findFirstOrThrow({
    where: { jobId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      status: true,
      total: true,
      supplementary: true,
      lines: true,
    },
  });
  check('an estimate is raised from the findings', [raised.version, raised.status], [1, 'DRAFT']);
  check('priced as it is raised, not zero', Number(raised.total) > 0, true);
  check('the line carries its total', Number(raised.lines[0]!.lineTotal), 120);
  check('the job is waiting to be quoted', await jobStatus(jobId), 'ESTIMATED');

  await screenHas(
    'the job page offers to record an approval given in person',
    `/jobs/${jobId}`,
    cookie,
    'Customer approved in person',
  );

  const approved = await approveInPerson({
    orgId: org.id,
    userId: staff.id,
    estimateId: raised.id,
  });
  press('Customer answers at the counter', 'job', 1);
  press('Approval to a job with the work on it', 'job', 0);

  check('the approval is recorded', approved.outcome.status, 'APPROVED');
  const approval = await prisma.estimateApproval.findFirstOrThrow({
    where: { estimateId: raised.id },
    select: { approvedByName: true, note: true },
  });
  check('under the customer name', approval.approvedByName, customer.displayName);
  check('and who took it', approval.note, `Approved in person, recorded by ${staff.name}.`);
  check('the job is approved', await jobStatus(jobId), 'APPROVED');
  const lined = await prisma.jobPartLine.findMany({
    where: { jobId },
    select: { description: true },
  });
  check('with the approved work on it', lined.length, 1);
  await refuses('an approval is recorded once', QuoteError, 'NOT_DRAFT', () =>
    approveInPerson({ orgId: org.id, userId: staff.id, estimateId: raised.id }),
  );

  await moveJob({ orgId: org.id, userId: staff.id, jobId, to: 'IN_PROGRESS' });
  press('Job to the technician', 'job', 1);
  check('the work is under way', await jobStatus(jobId), 'IN_PROGRESS');

  await screenHas(
    'the job page quotes extra work without leaving it',
    `/jobs/${jobId}`,
    cookie,
    'Quote it now',
  );

  /* --- extra work, mid-job -------------------------------------------- */

  await refuses('extra work with nothing said is refused', QuoteError, 'EMPTY', () =>
    quoteExtraWork({
      orgId: org.id,
      userId: staff.id,
      jobId,
      kind: 'LABOUR',
      description: '   ',
      quantity: 1,
    }),
  );
  await refuses('a part not on the books is named', QuoteError, 'EMPTY', () =>
    quoteExtraWork({
      orgId: org.id,
      userId: staff.id,
      jobId,
      kind: 'PART',
      description: 'Mystery part',
      quantity: 1,
      partNumber: 'NO-SUCH-PART-0000',
    }),
  );

  const added = await quoteExtraWork({
    orgId: org.id,
    userId: staff.id,
    jobId,
    kind: 'PART',
    description: '',
    quantity: 1,
    partNumber: level.product.partNumber,
  });
  press('Extra work found mid-job', 'job', 1);
  check('a supplementary quote is the next version', added.version, 2);

  const extra = await quoteExtraWork({
    orgId: org.id,
    userId: staff.id,
    jobId,
    kind: 'PART',
    description: 'Same part, more than we hold',
    quantity: onHand + 5,
    partNumber: level.product.partNumber,
    unitPrice: 10,
    send: true,
  });
  press('Extra work found mid-job', 'job', 1);
  check('the second line joins the same quote', extra.estimateId === added.estimateId, true);
  check('and sending it makes a link', typeof extra.shareId, 'string');

  const supplementary = await prisma.estimate.findUniqueOrThrow({
    where: { id: extra.estimateId },
    select: {
      status: true,
      supplementary: true,
      total: true,
      lines: {
        orderBy: { sortOrder: 'asc' },
        select: { productId: true, unitPrice: true, id: true },
      },
    },
  });
  check(
    'the quote is sent and marked as extra work',
    [supplementary.status, supplementary.supplementary],
    ['SENT', true],
  );
  check(
    'the part came with its price',
    Number(supplementary.lines[0]!.unitPrice),
    Number(level.product.sellPrice),
  );
  check('and its stock item', supplementary.lines[0]!.productId, level.productId);
  check('the job did not stop for it', await jobStatus(jobId), 'IN_PROGRESS');
  const queued = await prisma.messageLog.count({
    where: { orgId: org.id, relatedType: 'Estimate', relatedId: extra.estimateId },
  });
  check('the customer was messaged', queued, 1);

  const decided = await recordDecision({
    estimateId: extra.estimateId,
    approvedLineIds: supplementary.lines.map((l) => l.id),
    approvedByName: customer.displayName,
    userId: maria.id,
  });
  press('Customer answers the extra work', 'customer phone', 2);

  check('the extra work is approved', decided.outcome.status, 'APPROVED');
  check('both parts drew on stock, one is also on order', decided.parts, {
    reserved: 2,
    ordered: 1,
  });
  check('the job is still under way', await jobStatus(jobId), 'IN_PROGRESS');

  const partLines = await prisma.jobPartLine.findMany({
    where: { jobId },
    orderBy: { sortOrder: 'asc' },
    select: {
      productId: true,
      status: true,
      partNumber: true,
      reservations: { select: { quantity: true } },
    },
  });
  check('the extra lines joined the work already on the job', partLines.length, 3);
  check(
    'the first extra part is reserved',
    [partLines[1]!.status, partLines[1]!.partNumber],
    ['RESERVED', level.product.partNumber],
  );
  check('by one', Number(partLines[1]!.reservations[0]?.quantity), 1);
  check('the second is on order', partLines[2]!.status, 'ON_ORDER');
  const requests = await prisma.purchaseRequest.count({ where: { orgId: org.id, jobId } });
  check('with a purchase request raised for the shortfall', requests, 1);
  const stock = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: level.productId, warehouseId: level.warehouseId },
    },
    select: { reserved: true },
  });
  check('every unit on the shelf is now reserved', Number(stock.reserved), onHand);

  /* ------------------------------------------------------------------
     The work is completed
     ------------------------------------------------------------------ */

  console.info('\n  The work is completed\n');

  await moveJob({ orgId: org.id, userId: technician.id, jobId, to: 'COMPLETED' });
  press('Technician to quality check or completed', 'job', 1);
  check('completed', await jobStatus(jobId), 'COMPLETED');

  const invoiceId = await issueInvoice({ orgId: org.id, userId: staff.id, jobId });
  press('Completed to invoice', 'job', 1);
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true, status: true, currency: true },
  });
  check('the invoice is issued', invoice.status, 'ISSUED');
  check('for the work on the job, extra included', Number(invoice.total) > 120, true);

  await recordPayment({
    orgId: org.id,
    userId: staff.id,
    invoiceId,
    amount: money(Math.round(Number(invoice.total) * 100), invoice.currency as 'GBP'),
    method: 'CARD',
  });
  press('Invoice to payment', 'invoice', 2);
  press('Payment to pickup', 'invoice', 0);
  check('paid, and the job with it', await jobStatus(jobId), 'PAID');

  /* ------------------------------------------------------------------
     The count
     ------------------------------------------------------------------ */

  console.info('\n  The count\n');

  const breaches = checkWalk(steps);
  check('every step kept to its budget and its screen', breaches, []);
  for (const breach of breaches)
    console.error(`         ${breach.handoff}: ${breach.reason}, ${breach.detail}`);

  const walked = steps.reduce((total, step) => total + step.presses, 0);
  console.info(`  presses from booking to paid: ${walked}`);
  for (const workflow of WORKFLOWS) {
    console.info(
      `  ${workflow.title}: ${pressesBefore(workflow)} before, ${pressesFor(workflow)} now`,
    );
  }

  await forget(org.id);
  const restored = await prisma.stockLevel.findUniqueOrThrow({
    where: {
      productId_warehouseId: { productId: level.productId, warehouseId: level.warehouseId },
    },
    select: { onHand: true, reserved: true },
  });
  check(
    'stock put back as it was',
    [Number(restored.onHand), Number(restored.reserved)],
    [onHand, reservedBefore],
  );

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function jobStatus(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    select: { status: true },
  });
  return job.status;
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

/** The screen, as the desk sees it, has the one button the hand-off needs. */
async function screenHas(label: string, path: string, cookie: string, text: string) {
  let body: string;
  try {
    const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    body = await response.text();
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${label}: ${path} answered ${response.status}`);
      return;
    }
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${label}: no server at ${BASE} (${String(error)})`);
    return;
  }
  check(label, body.includes(text), true);
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const bookings = await prisma.booking.findMany({
    where: { orgId, description: TAG },
    select: { id: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const payments = await prisma.payment.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { id: true },
  });
  const estimates = await prisma.estimate.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const partLines = await prisma.jobPartLine.findMany({
    where: { jobId: { in: jobIds } },
    select: {
      id: true,
      productId: true,
      reservations: { where: { releasedAt: null }, select: { warehouseId: true, quantity: true } },
    },
  });

  // Stock first: what was reserved is released, what was fitted is put
  // back, so the seeded shelf reads as it did before the walk.
  for (const line of partLines) {
    for (const reservation of line.reservations) {
      if (!line.productId) continue;
      await prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: line.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      });
    }
  }
  const movements = await prisma.stockMovement.findMany({
    where: { orgId, referenceType: 'Job', referenceId: { in: jobIds } },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });
  for (const movement of movements) {
    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: { productId: movement.productId, warehouseId: movement.warehouseId },
      },
      data: { onHand: { increment: Math.abs(Number(movement.quantity)) } },
    });
  }
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements.map((m) => m.id) } } });
  await prisma.stockReservation.deleteMany({
    where: { jobPartLineId: { in: partLines.map((l) => l.id) } },
  });
  await prisma.purchaseRequest.deleteMany({ where: { orgId, jobId: { in: jobIds } } });

  const sources = [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoiceIds.map((id) => ({ sourceType: 'Invoice', sourceId: id })),
    ...payments.map((p) => ({ sourceType: 'Payment', sourceId: p.id })),
  ];
  for (const source of sources)
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  await prisma.messageLog.deleteMany({
    where: {
      orgId,
      relatedId: {
        in: [...invoiceIds, ...payments.map((p) => p.id), ...estimates.map((e) => e.id)],
      },
    },
  });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: {
      orgId,
      type: { in: ['job.completed', 'invoice.issued', 'payment.received', 'estimate.sent'] },
      processedAt: null,
    },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookings.map((b) => b.id) } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
