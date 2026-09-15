-- The workflow, as one thing. Phase 34.
--
-- An estimate can be supplementary: extra work found mid-job, quoted and
-- approved without stopping the work already agreed. A part line on an
-- estimate can name the stock item behind it, so the customer's approval
-- reserves the part in the same breath.

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "supplementary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "estimate_lines" ADD COLUMN "productId" TEXT;

-- CreateIndex
CREATE INDEX "estimate_lines_productId_idx" ON "estimate_lines"("productId");

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
