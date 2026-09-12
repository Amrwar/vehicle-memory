-- Supplier payments, payroll runs and fleet agreements. Phase 16, part two.
--
-- Also lets an invoice line say which job it came from, for an invoice that
-- covers a month of a fleet's work. Trigram indexes stripped as always.

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'EXPORTED', 'PAID');

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "payrollRunId" TEXT;

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "exportedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_agreements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "labourDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "partsDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "consolidateMonthly" BOOLEAN NOT NULL DEFAULT true,
    "purchaseOrderRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payments_orgId_paidAt_idx" ON "supplier_payments"("orgId", "paidAt");

-- CreateIndex
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_billId_idx" ON "supplier_payment_allocations"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payment_allocations_paymentId_billId_key" ON "supplier_payment_allocations"("paymentId", "billId");

-- CreateIndex
CREATE INDEX "payroll_runs_orgId_status_idx" ON "payroll_runs"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_orgId_periodStart_periodEnd_key" ON "payroll_runs"("orgId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_agreements_customerId_key" ON "fleet_agreements"("customerId");

-- CreateIndex
CREATE INDEX "fleet_agreements_orgId_idx" ON "fleet_agreements"("orgId");

-- CreateIndex
CREATE INDEX "invoice_lines_jobId_idx" ON "invoice_lines"("jobId");

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_billId_fkey" FOREIGN KEY ("billId") REFERENCES "supplier_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_agreements" ADD CONSTRAINT "fleet_agreements_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_agreements" ADD CONSTRAINT "fleet_agreements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Money that leaves has to be for something, and add up.
-- ---------------------------------------------------------------------------

ALTER TABLE "supplier_payments"
  ADD CONSTRAINT "supplier_payments_amount_is_positive" CHECK ("amount" > 0);

ALTER TABLE "supplier_payment_allocations"
  ADD CONSTRAINT "supplier_payment_allocations_amount_is_positive" CHECK ("amount" > 0);

-- A run that has been paid says when, and one that has not does not.
ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_paid_has_a_time"
  CHECK (("status" = 'PAID') = ("paidAt" IS NOT NULL));

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_exported_has_a_time"
  CHECK ("status" = 'DRAFT' OR "exportedAt" IS NOT NULL);

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_period_is_ordered" CHECK ("periodEnd" > "periodStart");

-- A discount is a percentage. A hundred and one percent is a typo.
ALTER TABLE "fleet_agreements"
  ADD CONSTRAINT "fleet_agreements_discounts_are_percentages"
  CHECK (
    "labourDiscountPct" >= 0 AND "labourDiscountPct" <= 100 AND
    "partsDiscountPct" >= 0 AND "partsDiscountPct" <= 100
  );
