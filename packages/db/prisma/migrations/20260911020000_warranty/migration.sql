-- Warranty and claims.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "CoverKind" AS ENUM ('PART', 'LABOUR');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'SETTLED');

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "CoverKind" NOT NULL,
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "startedOn" TIMESTAMP(3) NOT NULL,
    "months" INTEGER NOT NULL,
    "km" INTEGER,
    "startedAtKm" INTEGER,
    "partsValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labourValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "supplierMonths" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "voidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "complaint" TEXT NOT NULL,
    "goodwillReason" TEXT,
    "outsideCover" BOOLEAN NOT NULL DEFAULT false,
    "exposure" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recoverable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplierRef" TEXT,
    "outcome" TEXT,
    "raisedByUserId" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "remedyJobId" TEXT,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warranties_orgId_startedOn_idx" ON "warranties"("orgId", "startedOn");

-- CreateIndex
CREATE INDEX "warranties_vehicleId_idx" ON "warranties"("vehicleId");

-- CreateIndex
CREATE INDEX "warranties_jobId_idx" ON "warranties"("jobId");

-- CreateIndex
CREATE INDEX "warranty_claims_warrantyId_raisedAt_idx" ON "warranty_claims"("warrantyId", "raisedAt");

-- CreateIndex
CREATE INDEX "warranty_claims_status_idx" ON "warranty_claims"("status");

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_remedyJobId_fkey" FOREIGN KEY ("remedyJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

