-- Data in. Phase 33.
--
-- A file somebody brought from another system, kept as it arrived so the
-- column mapping can be changed and the preview re-run, and a report of
-- what went in and what did not, row by row.

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'MAPPED', 'IMPORTED');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "mapping" JSONB,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "report" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_orgId_createdAt_idx" ON "import_batches"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
