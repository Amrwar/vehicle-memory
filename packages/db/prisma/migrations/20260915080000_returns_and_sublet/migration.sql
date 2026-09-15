-- Parts back, work out. Phase 38.
--
-- Parts sent back to a supplier (faulty, wrong, not needed, or a core) from
-- the delivery to the credit note; the credit set against the bills the
-- supplier is owed; and work bought from another business and sold on a job.

-- CreateEnum
CREATE TYPE "SupplierReturnReason" AS ENUM ('DEFECTIVE', 'WRONG_PART', 'SURPLUS', 'CORE');
CREATE TYPE "SupplierReturnStatus" AS ENUM ('SENT', 'CREDITED', 'REFUSED');
CREATE TYPE "SubletStatus" AS ENUM ('ORDERED', 'DONE', 'BILLED');

-- CreateTable
CREATE TABLE "supplier_returns" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderId" TEXT,
    "number" TEXT NOT NULL,
    "reason" "SupplierReturnReason" NOT NULL,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'SENT',
    "notes" TEXT,
    "heldCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditReference" TEXT,
    "creditNet" DECIMAL(12,2),
    "creditTax" DECIMAL(12,2),
    "creditUnapplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditedAt" TIMESTAMP(3),
    "refusedReason" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "productId" TEXT,
    "warehouseId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_return_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_credit_applications" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "supplier_credit_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_sublets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "SubletStatus" NOT NULL DEFAULT 'ORDERED',
    "partLineId" TEXT NOT NULL,
    "billId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_sublets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_returns_orgId_number_key" ON "supplier_returns"("orgId", "number");
CREATE INDEX "supplier_returns_orgId_status_idx" ON "supplier_returns"("orgId", "status");
CREATE INDEX "supplier_return_lines_returnId_idx" ON "supplier_return_lines"("returnId");
CREATE INDEX "supplier_return_lines_orderLineId_idx" ON "supplier_return_lines"("orderLineId");
CREATE UNIQUE INDEX "supplier_credit_applications_returnId_billId_key" ON "supplier_credit_applications"("returnId", "billId");
CREATE INDEX "supplier_credit_applications_billId_idx" ON "supplier_credit_applications"("billId");
CREATE UNIQUE INDEX "job_sublets_partLineId_key" ON "job_sublets"("partLineId");
CREATE UNIQUE INDEX "job_sublets_billId_key" ON "job_sublets"("billId");
CREATE INDEX "job_sublets_jobId_idx" ON "job_sublets"("jobId");
CREATE INDEX "job_sublets_orgId_status_idx" ON "job_sublets"("orgId", "status");

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_billId_fkey" FOREIGN KEY ("billId") REFERENCES "supplier_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_sublets" ADD CONSTRAINT "job_sublets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sublets" ADD CONSTRAINT "job_sublets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sublets" ADD CONSTRAINT "job_sublets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_sublets" ADD CONSTRAINT "job_sublets_partLineId_fkey" FOREIGN KEY ("partLineId") REFERENCES "job_part_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_sublets" ADD CONSTRAINT "job_sublets_billId_fkey" FOREIGN KEY ("billId") REFERENCES "supplier_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
