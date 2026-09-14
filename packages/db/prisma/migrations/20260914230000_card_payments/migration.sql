-- Card payment through a provider. Phase 32.
--
-- An attempt is one try at paying some of an invoice through a provider:
-- pending, then succeeded, failed or cancelled, once. A succeeded attempt
-- produces the Payment and the posting exactly once. The provider's own
-- record is kept beside ours so the two can be compared.

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "failureReason" TEXT,
    "checkoutUrl" TEXT,
    "returnUrl" TEXT NOT NULL,
    "cancelUrl" TEXT NOT NULL,
    "paymentId" TEXT,
    "settledAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "providerPayload" JSONB,
    "startedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_providerRef_key" ON "payment_attempts"("providerRef");
CREATE UNIQUE INDEX "payment_attempts_paymentId_key" ON "payment_attempts"("paymentId");
CREATE INDEX "payment_attempts_orgId_createdAt_idx" ON "payment_attempts"("orgId", "createdAt");
CREATE INDEX "payment_attempts_invoiceId_idx" ON "payment_attempts"("invoiceId");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A refund sent back through the provider remembers which attempt it went back to.
ALTER TABLE "refunds"
  ADD COLUMN "attemptId" TEXT,
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "providerStatus" TEXT;

CREATE INDEX "refunds_attemptId_idx" ON "refunds"("attemptId");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
