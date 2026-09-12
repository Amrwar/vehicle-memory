-- Refunds. Phase 16.
--
-- Money going back to a customer, as its own record with the credit note that
-- justifies it. Trigram indexes stripped as always.

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refunds_orgId_refundedAt_idx" ON "refunds"("orgId", "refundedAt");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- A refund is for something, and says why.
-- ---------------------------------------------------------------------------

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_is_positive" CHECK ("amount" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_reason_is_given" CHECK (length(btrim("reason")) > 0);
