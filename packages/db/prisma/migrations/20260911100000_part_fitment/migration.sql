-- Which vehicles a part fits. Phase 13.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "FitmentSource" AS ENUM ('MANUFACTURER', 'SUPPLIER', 'WORKSHOP', 'OBSERVED');

-- CreateTable
CREATE TABLE "part_fitments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "engineCode" TEXT,
    "source" "FitmentSource" NOT NULL DEFAULT 'WORKSHOP',
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_fitments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_fitments_productId_idx" ON "part_fitments"("productId");

-- CreateIndex
CREATE INDEX "part_fitments_orgId_make_model_idx" ON "part_fitments"("orgId", "make", "model");

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

