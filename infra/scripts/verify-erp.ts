/**
 * Paying suppliers, handing hours to payroll, and one invoice a month for a fleet.
 *
 *   npx tsx infra/scripts/verify-erp.ts
 *
 * The second half of Phase 16, against a real database. A supplier is billed,
 * approved and paid across two bills with a remittance advice; a period of
 * approved timesheets is handed to payroll as a file and then marked paid; a
 * fleet's month is invoiced as one document at the agreed discount. After each
 * the ledger is checked, and every refusal that protects a figure is exercised.
 *
 * It cleans up after itself, except for the passport events a completed job
 * contributes, which are append-only by design.
 */

import 'dotenv/config';

import { FleetError, money, PayablesError, PayrollError, trialBalance } from '@carnet/core';
import { prisma } from '@carnet/db';

import { ALL_TIME, postedLines } from '../../apps/web/src/lib/accounting';
import { createPurchaseOrder } from '../../apps/web/src/lib/catalogue';
import { consolidateMonth, saveFleetAgreement } from '../../apps/web/src/lib/fleet';
import { createJob } from '../../apps/web/src/lib/jobs';
import { moveJob } from '../../apps/web/src/lib/money';
import { approveBill, bookBill, disputeBill, paySupplier } from '../../apps/web/src/lib/payables';
import { markPayrollPaid, payrollFile, runPayroll } from '../../apps/web/src/lib/payroll';

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
    if (error instanceof kind && actual === code) {
      console.info(`  ok     ${label}: ${code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');
const TAG = 'Verify ERP probe';
const SUPPLIER = 'Verify ERP Supplier';
const SUPPLIER_EMAIL = 'vfy-erp-supplier@example.test';

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  await forget(org.id);

  const before = trialBalance(await postedLines(org.id, ALL_TIME));
  check('the ledger balances before anything happens', before.balanced, true);

  /* ------------------------------------------------------------------------
     Suppliers
     ------------------------------------------------------------------------ */

  console.info('\nA supplier is billed and paid');

  const supplier = await prisma.supplier.create({
    data: { orgId: org.id, name: SUPPLIER, email: SUPPLIER_EMAIL, paymentTermsDays: 30 },
    select: { id: true },
  });

  const orderId = await createPurchaseOrder({
    orgId: org.id,
    userId: staff.id,
    supplierId: supplier.id,
    notes: TAG,
    lines: [{ description: 'Probe wiper blades', quantity: 10, unitCost: 10 }],
  });

  const billOne = await bookBill({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reference: 'VFY-BILL-1',
    subtotal: 100,
    taxTotal: 20,
    billedAt: new Date(Date.now() - 20 * 86_400_000),
  });

  const booked = await prisma.supplierBill.findUniqueOrThrow({
    where: { id: billOne },
    select: { status: true, total: true, dueAt: true },
  });
  check('the bill is booked awaiting approval', booked.status, 'AWAITING');
  check('for the net plus tax', Number(booked.total), 120);
  check('with a due date from the supplier’s terms', booked.dueAt !== null, true);

  const billPosting = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'SupplierBill', sourceId: billOne },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'the debt is in the books',
    Number(billPosting?.lines.find((l) => l.account.code === '2000')?.credit),
    120,
  );
  check(
    'with the input tax reclaimable',
    Number(billPosting?.lines.find((l) => l.account.code === '2110')?.debit),
    20,
  );

  await refuses('booking the same reference twice', PayablesError, 'OVER_ALLOCATED', () =>
    bookBill({
      orgId: org.id,
      userId: staff.id,
      orderId,
      reference: 'VFY-BILL-1',
      subtotal: 1,
      taxTotal: 0,
      billedAt: new Date(),
    }),
  );

  // Paying a bill nobody has checked is how a wrong delivery gets paid for.
  await refuses('paying before anybody has approved', PayablesError, 'NOTHING_OWED', () =>
    paySupplier({
      orgId: org.id,
      userId: staff.id,
      supplierId: supplier.id,
      amount: gbp(50),
      method: 'BANK_TRANSFER',
    }),
  );

  await approveBill({ orgId: org.id, userId: staff.id, billId: billOne });

  const billTwo = await bookBill({
    orgId: org.id,
    userId: staff.id,
    orderId,
    reference: 'VFY-BILL-2',
    subtotal: 50,
    taxTotal: 10,
    billedAt: new Date(Date.now() - 5 * 86_400_000),
  });
  await approveBill({ orgId: org.id, userId: staff.id, billId: billTwo });

  const paymentOne = await paySupplier({
    orgId: org.id,
    userId: staff.id,
    supplierId: supplier.id,
    amount: gbp(100),
    method: 'BANK_TRANSFER',
    reference: 'FP-PROBE-1',
  });

  const afterFirst = await prisma.supplierBill.findMany({
    where: { id: { in: [billOne, billTwo] } },
    orderBy: { reference: 'asc' },
    select: { reference: true, status: true, amountPaid: true },
  });
  check('the oldest bill was paid first, in part', afterFirst[0]?.status, 'PART_PAID');
  check('with the whole payment', Number(afterFirst[0]?.amountPaid), 100);
  check('and the newer bill untouched', Number(afterFirst[1]?.amountPaid), 0);

  await refuses('paying more than the approved bills owe', PayablesError, 'UNALLOCATED', () =>
    paySupplier({
      orgId: org.id,
      userId: staff.id,
      supplierId: supplier.id,
      amount: gbp(200),
      method: 'BANK_TRANSFER',
    }),
  );

  const paymentTwo = await paySupplier({
    orgId: org.id,
    userId: staff.id,
    supplierId: supplier.id,
    amount: gbp(80),
    method: 'CASH',
  });

  const settled = await prisma.supplierBill.findMany({
    where: { id: { in: [billOne, billTwo] } },
    select: { status: true },
  });
  check(
    'the balance settles both bills',
    settled.every((b) => b.status === 'PAID'),
    true,
  );

  const allocations = await prisma.supplierPaymentAllocation.findMany({
    where: { paymentId: paymentTwo },
    include: { bill: { select: { reference: true } } },
    orderBy: { bill: { reference: 'asc' } },
  });
  check(
    'the second payment was split across both bills',
    allocations.map((a) => [a.bill.reference, Number(a.amount)]),
    [
      ['VFY-BILL-1', 20],
      ['VFY-BILL-2', 60],
    ],
  );

  const payPostings = await prisma.journalEntry.findMany({
    where: {
      orgId: org.id,
      sourceType: 'SupplierPayment',
      sourceId: { in: [paymentOne, paymentTwo] },
    },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  const payableDown = payPostings
    .flatMap((e) => e.lines)
    .filter((l) => l.account.code === '2000')
    .reduce((t, l) => t + Number(l.debit), 0);
  check('payable came down by everything paid', payableDown, 180);
  check(
    'the cash payment came out of the till',
    payPostings.some((e) =>
      e.lines.some((l) => l.account.code === '1010' && Number(l.credit) === 80),
    ),
    true,
  );

  const remittances = await prisma.messageLog.findMany({
    where: { orgId: org.id, toAddress: SUPPLIER_EMAIL, relatedType: 'SupplierPayment' },
    select: { body: true, status: true },
  });
  check('the supplier was sent a remittance advice for each payment', remittances.length, 2);
  check(
    'naming both bills on the split one',
    remittances.some((m) => m.body.includes('VFY-BILL-1') && m.body.includes('VFY-BILL-2')),
    true,
  );
  check(
    'and it did not wait for the sweep',
    remittances.every((m) => m.status !== 'QUEUED'),
    true,
  );

  await refuses('disputing a bill that has been paid', PayablesError, 'DISPUTED', () =>
    disputeBill({ orgId: org.id, userId: staff.id, billId: billOne, reason: 'Too late' }),
  );

  /* ------------------------------------------------------------------------
     Payroll
     ------------------------------------------------------------------------ */

  console.info('\nHours are handed to payroll');

  // A person of the probe's own, so nothing seeded is paid. A paid timesheet
  // is immutable by design and would otherwise stay paid after the probe.
  const stamp = Date.now().toString(36).toUpperCase();
  const employee = await prisma.employee.create({
    data: {
      orgId: org.id,
      reference: `VFY-${stamp}`,
      displayName: `Probe Payroll ${stamp}`,
      startedOn: new Date('2026-01-05'),
      weeklyMinutes: 2400,
      payRates: {
        create: {
          orgId: org.id,
          costPerHour: 20,
          chargePerHour: 60,
          effectiveFrom: new Date('2026-01-05'),
        },
      },
    },
    select: { id: true },
  });

  // A period no seeded sheet uses, so the run is unambiguous.
  const periodStart = new Date(Date.UTC(2025, 0, 6 + (Date.now() % 1000)));
  const periodEnd = new Date(periodStart.getTime() + 6 * 86_400_000 + 86_399_000);

  const sheet = await prisma.timesheet.create({
    data: {
      orgId: org.id,
      employeeId: employee.id,
      periodStart,
      periodEnd,
      status: 'SUBMITTED',
      ordinaryMinutes: 2400,
      overtimeMinutes: 60,
      absenceMinutes: 0,
      ordinaryPay: 800,
      overtimePay: 30,
      gross: 830,
      submittedAt: new Date(),
    },
    select: { id: true },
  });

  await refuses('running hours nobody has approved', PayrollError, 'EMPTY', () =>
    runPayroll({ orgId: org.id, userId: staff.id, periodStart, periodEnd }),
  );

  await prisma.timesheet.update({
    where: { id: sheet.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: staff.id },
  });

  const runId = await runPayroll({ orgId: org.id, userId: staff.id, periodStart, periodEnd });

  const run = await prisma.payrollRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true, employeeCount: true, gross: true, exportedAt: true },
  });
  check('the run took the approved sheet', run.employeeCount, 1);
  check('and carries its gross', Number(run.gross), 830);
  check('it is exported, with a time', run.status === 'EXPORTED' && run.exportedAt !== null, true);

  const file = await payrollFile(org.id, runId);
  check('the file has one row per person', file?.rows.length, 1);
  check('with hours, not minutes', file?.rows[0]?.ordinaryHours, 40);
  check('and the overtime hour', file?.rows[0]?.overtimeHours, 1);

  // The sheet is still approved, not paid, so the refusal names the person
  // rather than saying there is nothing to run.
  await refuses('handing the same hours over twice', PayrollError, 'ALREADY_RUN', () =>
    runPayroll({ orgId: org.id, userId: staff.id, periodStart, periodEnd }),
  );

  await markPayrollPaid({ orgId: org.id, userId: staff.id, runId });

  const paid = await prisma.payrollRun.findUniqueOrThrow({
    where: { id: runId },
    select: { status: true, paidAt: true, timesheets: { select: { status: true } } },
  });
  check('the run is paid', paid.status, 'PAID');
  check(
    'and so is the sheet on it',
    paid.timesheets.every((t) => t.status === 'PAID'),
    true,
  );

  const wages = await prisma.journalEntry.findFirst({
    where: { orgId: org.id, sourceType: 'PayrollRun', sourceId: runId },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check(
    'gross wages posted as an expense',
    Number(wages?.lines.find((l) => l.account.code === '6000')?.debit),
    830,
  );
  check(
    'and out of the bank',
    Number(wages?.lines.find((l) => l.account.code === '1000')?.credit),
    830,
  );

  await refuses('marking a paid run paid again', PayrollError, 'ALREADY_PAID', () =>
    markPayrollPaid({ orgId: org.id, userId: staff.id, runId }),
  );

  // Not a cleanup failure. A paid timesheet is the evidence of what somebody
  // was paid for, and the database refuses to let it change or vanish.
  let untouchable = 'changed';
  try {
    await prisma.timesheet.delete({ where: { id: sheet.id } });
  } catch (error) {
    untouchable = /paid|restrict/i.test(String(error)) ? 'refused' : 'refused for another reason';
  }
  check('a paid timesheet cannot be deleted', untouchable, 'refused');

  // What can be tidied is: the person leaves, and the run stays as the record.
  await prisma.employee.update({
    where: { id: employee.id },
    data: { isActive: false, endedOn: new Date() },
  });

  console.info('\nA fleet gets one invoice for the month');

  const fleet = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, kind: 'COMPANY', email: { not: null }, jobs: { some: {} } },
    select: { id: true, displayName: true, email: true, fleetAgreement: { select: { id: true } } },
  });
  const hadAgreement = fleet.fleetAgreement !== null;

  const vehicleId = (
    await prisma.job.findFirstOrThrow({
      where: { customerId: fleet.id },
      select: { vehicleId: true },
    })
  ).vehicleId;
  const vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, isDefault: true } });

  await refuses('invoicing a month before any terms exist', FleetError, 'NOTHING_TO_INVOICE', () =>
    consolidateMonth({
      orgId: org.id,
      userId: staff.id,
      customerId: fleet.id,
      year: 2020,
      month: 1,
    }),
  );

  await saveFleetAgreement({
    orgId: org.id,
    userId: staff.id,
    customerId: fleet.id,
    agreement: {
      labourDiscountPct: 10,
      partsDiscountPct: 0,
      paymentTermsDays: 30,
      consolidateMonthly: true,
      purchaseOrderRequired: false,
    },
  });

  const jobIds: string[] = [];
  for (const description of [`${TAG} A`, `${TAG} B`]) {
    const job = await createJob({
      orgId: org.id,
      userId: staff.id,
      locationId: null,
      customerId: fleet.id,
      vehicleId,
      shortDescription: description,
    });
    await prisma.jobLabourLine.create({
      data: {
        jobId: job.id,
        description: 'Probe labour',
        hours: 1,
        rate: 100,
        taxRateId: vat?.id ?? null,
      },
    });
    await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'IN_PROGRESS' });
    await moveJob({ orgId: org.id, userId: staff.id, jobId: job.id, to: 'COMPLETED' });
    jobIds.push(job.id);
  }

  const now = new Date();
  const invoiceId = await consolidateMonth({
    orgId: org.id,
    userId: staff.id,
    customerId: fleet.id,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      number: true,
      jobId: true,
      subtotal: true,
      total: true,
      lines: { select: { jobId: true, discountPct: true } },
    },
  });
  check('one invoice, with no single job behind it', invoice.jobId, null);
  check(
    'every line names the job it came from',
    invoice.lines.every((l) => l.jobId !== null),
    true,
  );
  check('across both jobs', new Set(invoice.lines.map((l) => l.jobId)).size, 2);
  check(
    'the agreed discount was applied',
    invoice.lines.every((l) => Number(l.discountPct) === 10),
    true,
  );
  // Two hours at 100 less 10% is 180 net.
  check('so the net is list less ten percent', Number(invoice.subtotal), 180);

  const moved = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    select: { status: true },
  });
  check(
    'both jobs moved to invoiced together',
    moved.every((j) => j.status === 'INVOICED'),
    true,
  );

  const told = await prisma.messageLog.findFirst({
    where: { orgId: org.id, relatedType: 'Invoice', relatedId: invoiceId },
    select: { toAddress: true, body: true },
  });
  check('the fleet was told, at its address', told?.toAddress, fleet.email);
  check('and told what the agreement saved them', told?.body.includes('off list'), true);

  await refuses('invoicing the same month twice', FleetError, 'NOTHING_TO_INVOICE', () =>
    consolidateMonth({
      orgId: org.id,
      userId: staff.id,
      customerId: fleet.id,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    }),
  );

  // Their accounts department will refuse an invoice with no PO on it, so the
  // product refuses first and names the job.
  await saveFleetAgreement({
    orgId: org.id,
    userId: staff.id,
    customerId: fleet.id,
    agreement: {
      labourDiscountPct: 10,
      partsDiscountPct: 0,
      paymentTermsDays: 30,
      consolidateMonthly: true,
      purchaseOrderRequired: true,
    },
  });

  const third = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: fleet.id,
    vehicleId,
    shortDescription: `${TAG} C`,
  });
  await prisma.jobLabourLine.create({
    data: {
      jobId: third.id,
      description: 'Probe labour',
      hours: 1,
      rate: 100,
      taxRateId: vat?.id ?? null,
    },
  });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: third.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: third.id, to: 'COMPLETED' });
  jobIds.push(third.id);

  await refuses(
    'a job with no purchase order number when the fleet requires one',
    FleetError,
    'PO_REQUIRED',
    () =>
      consolidateMonth({
        orgId: org.id,
        userId: staff.id,
        customerId: fleet.id,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      }),
  );

  console.info('\nThe ledger, afterwards');

  const after = trialBalance(await postedLines(org.id, ALL_TIME));
  check('still balances', after.balanced, true);

  console.info('\nThe database, underneath it');

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "supplier_payments" SET "amount" = 0 WHERE "id" = '${paymentOne}'`,
    );
    failures += 1;
    console.error('  FAIL   a payment of nothing was accepted');
  } catch (error) {
    check(
      'a supplier payment of nothing',
      String(error).includes('supplier_payments_amount_is_positive'),
      true,
    );
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payroll_runs" ("id","orgId","periodStart","periodEnd","status","exportedAt") VALUES ('vfy-run-raw','${org.id}',NOW(),NOW() + interval '1 day','PAID',NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a paid run with no time was accepted');
  } catch (error) {
    check(
      'a paid payroll run with no time on it',
      String(error).includes('payroll_runs_paid_has_a_time'),
      true,
    );
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "fleet_agreements" SET "labourDiscountPct" = 101 WHERE "customerId" = '${fleet.id}'`,
    );
    failures += 1;
    console.error('  FAIL   a discount over one hundred percent was accepted');
  } catch (error) {
    check(
      'a discount that is not a percentage',
      String(error).includes('fleet_agreements_discounts_are_percentages'),
      true,
    );
  }

  console.info('\nClearing up');

  if (!hadAgreement) await prisma.fleetAgreement.deleteMany({ where: { customerId: fleet.id } });
  await forget(org.id);

  const left = await prisma.supplier.count({ where: { orgId: org.id, name: SUPPLIER } });
  check('the probe left nothing behind', left, 0);

  console.info(
    failures === 0
      ? '\nSuppliers are paid, wages are handed over, and the fleet gets one invoice.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

async function forget(orgId: string) {
  // Fleet
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: { startsWith: TAG } },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const lineInvoices = await prisma.invoiceLine.findMany({
    where: { jobId: { in: jobIds } },
    select: { invoiceId: true },
  });
  const invoiceIds = [...new Set(lineInvoices.map((l) => l.invoiceId))];

  for (const id of invoiceIds) {
    await prisma.journalEntry.deleteMany({ where: { orgId, sourceType: 'Invoice', sourceId: id } });
  }
  for (const id of jobIds) {
    await prisma.journalEntry.deleteMany({ where: { orgId, sourceType: 'Job', sourceId: id } });
  }
  await prisma.messageLog.deleteMany({
    where: { orgId, relatedType: 'Invoice', relatedId: { in: invoiceIds } },
  });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId, type: 'job.completed', processedAt: null },
  });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });

  // Suppliers
  const supplier = await prisma.supplier.findFirst({
    where: { orgId, name: SUPPLIER },
    select: { id: true },
  });
  if (supplier) {
    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId: supplier.id },
      select: { id: true },
    });
    const bills = await prisma.supplierBill.findMany({
      where: { supplierId: supplier.id },
      select: { id: true },
    });
    for (const p of payments)
      await prisma.journalEntry.deleteMany({
        where: { orgId, sourceType: 'SupplierPayment', sourceId: p.id },
      });
    for (const b of bills)
      await prisma.journalEntry.deleteMany({
        where: { orgId, sourceType: 'SupplierBill', sourceId: b.id },
      });
    await prisma.messageLog.deleteMany({ where: { orgId, toAddress: SUPPLIER_EMAIL } });
    await prisma.supplierPaymentAllocation.deleteMany({
      where: { payment: { supplierId: supplier.id } },
    });
    await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.supplierBill.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.purchaseOrder.deleteMany({ where: { supplierId: supplier.id } });
    await prisma.supplier.delete({ where: { id: supplier.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
