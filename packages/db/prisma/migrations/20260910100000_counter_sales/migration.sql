-- Counter sales. Phase 4.7.
--
-- The trigram index drops a generated diff always proposes are left out, for
-- the reason in 20260909210000: Prisma cannot express a GIN index with an
-- operator class, so every diff wants to remove them and applying that turns
-- search into a sequential scan with no symptom but a slower page.

-- CreateEnum
CREATE TYPE "CounterSaleStatus" AS ENUM ('OPEN', 'PAID', 'REFUNDED', 'VOID');

-- CreateEnum
CREATE TYPE "TenderKind" AS ENUM ('CASH', 'CARD', 'ACCOUNT');

-- CreateTable
CREATE TABLE "counter_sales" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "customerId" TEXT,
    "reference" TEXT NOT NULL,
    "status" "CounterSaleStatus" NOT NULL DEFAULT 'OPEN',
    "soldByUserId" TEXT,
    "tillSessionId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "changeGiven" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundsSaleId" TEXT,
    "note" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counter_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_sale_lines" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "kind" "LineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counter_sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_sale_tenders" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" "TenderKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counter_sale_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "till_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "openedByUserId" TEXT,
    "openingFloat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCash" DECIMAL(12,2),
    "paidOut" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "till_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counter_sales_orgId_status_idx" ON "counter_sales"("orgId", "status");

-- CreateIndex
CREATE INDEX "counter_sales_orgId_soldAt_idx" ON "counter_sales"("orgId", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "counter_sales_orgId_reference_key" ON "counter_sales"("orgId", "reference");

-- CreateIndex
CREATE INDEX "counter_sale_lines_saleId_idx" ON "counter_sale_lines"("saleId");

-- CreateIndex
CREATE INDEX "counter_sale_lines_productId_idx" ON "counter_sale_lines"("productId");

-- CreateIndex
CREATE INDEX "counter_sale_tenders_saleId_idx" ON "counter_sale_tenders"("saleId");

-- CreateIndex
CREATE INDEX "till_sessions_orgId_openedAt_idx" ON "till_sessions"("orgId", "openedAt");

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_tillSessionId_fkey" FOREIGN KEY ("tillSessionId") REFERENCES "till_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sales" ADD CONSTRAINT "counter_sales_refundsSaleId_fkey" FOREIGN KEY ("refundsSaleId") REFERENCES "counter_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sale_lines" ADD CONSTRAINT "counter_sale_lines_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "counter_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sale_lines" ADD CONSTRAINT "counter_sale_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sale_lines" ADD CONSTRAINT "counter_sale_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_sale_tenders" ADD CONSTRAINT "counter_sale_tenders_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "counter_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- A counter sale is money and stock, so the arithmetic is guarded here as
-- well as in the service layer.
-- ---------------------------------------------------------------------------

ALTER TABLE "counter_sale_lines"
  ADD CONSTRAINT "counter_sale_lines_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "counter_sale_lines"
  ADD CONSTRAINT "counter_sale_lines_discount_sane"
  CHECK ("discountPct" >= 0 AND "discountPct" <= 100);

ALTER TABLE "counter_sale_tenders"
  ADD CONSTRAINT "counter_sale_tenders_positive"
  CHECK ("amount" > 0);

-- A refund can never take back more than was sold. Without this a mistyped
-- refund is indistinguishable from cash going missing.
ALTER TABLE "counter_sales"
  ADD CONSTRAINT "counter_sales_refund_within_total"
  CHECK ("refundedTotal" >= 0 AND "refundedTotal" <= "total");

ALTER TABLE "counter_sales"
  ADD CONSTRAINT "counter_sales_change_not_negative"
  CHECK ("changeGiven" >= 0);

-- A sale that has been paid for must record when. "Sold today" with no time
-- makes a till session impossible to reconcile.
ALTER TABLE "counter_sales"
  ADD CONSTRAINT "counter_sales_sold_recorded"
  CHECK ("status" = 'OPEN' OR "status" = 'VOID' OR "soldAt" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- One open till per location.
--
-- Two open sessions means the day's takings are split across both and neither
-- reconciles, which reads as a shortfall in one and a surplus in the other.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "till_sessions_one_open_per_location"
  ON "till_sessions" ("orgId", COALESCE("locationId", ''))
  WHERE "closedAt" IS NULL;
