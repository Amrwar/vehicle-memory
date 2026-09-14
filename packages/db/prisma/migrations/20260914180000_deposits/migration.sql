-- Money held for a customer. Phase 30.
--
-- A deposit taken before the work, or a credit kept on account after a
-- refund. A liability until it goes against an invoice or back to the
-- customer. Applying it is a payment of its own kind, DEPOSIT, which
-- releases the liability rather than touching the bank a second time.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'DEPOSIT';

-- CreateEnum
CREATE TYPE "DepositKind" AS ENUM ('DEPOSIT', 'CREDIT');

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jobId" TEXT,
    "kind" "DepositKind" NOT NULL DEFAULT 'DEPOSIT',
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "reference" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenByUserId" TEXT,
    "sourceRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_movements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deposits_orgId_customerId_idx" ON "deposits"("orgId", "customerId");
CREATE INDEX "deposits_orgId_receivedAt_idx" ON "deposits"("orgId", "receivedAt");
CREATE INDEX "deposit_movements_depositId_createdAt_idx" ON "deposit_movements"("depositId", "createdAt");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_sourceRefundId_fkey" FOREIGN KEY ("sourceRefundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposit_movements" ADD CONSTRAINT "deposit_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Money held is never negative, and never more goes out than came in.
-- ---------------------------------------------------------------------------

ALTER TABLE "deposits"
  ADD CONSTRAINT "deposits_taken_for_something"
  CHECK ("amount" > 0);

ALTER TABLE "deposits"
  ADD CONSTRAINT "deposits_never_overdrawn"
  CHECK ("appliedAmount" >= 0 AND "refundedAmount" >= 0 AND "appliedAmount" + "refundedAmount" <= "amount");

ALTER TABLE "deposit_movements"
  ADD CONSTRAINT "deposit_movements_move_something"
  CHECK ("amount" <> 0 AND length(btrim("reason")) > 0);
