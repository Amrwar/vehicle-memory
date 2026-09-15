-- Arrival and departure. Phase 35.
--
-- The car as it was when it changed hands, in both directions; a signature
-- as a record of its own; and where the keys went each time they moved.

-- CreateEnum
CREATE TYPE "SignaturePurpose" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'ESTIMATE_APPROVAL', 'TERMS', 'WARRANTY');

-- CreateEnum
CREATE TYPE "CheckKind" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "KeyAction" AS ENUM ('HUNG', 'TAKEN', 'RETURNED', 'HANDED_TO_CUSTOMER');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "collectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_attachments" ADD COLUMN "checkId" TEXT;

-- AlterTable
ALTER TABLE "estimate_approvals" ADD COLUMN "signatureId" TEXT;

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "purpose" "SignaturePurpose" NOT NULL,
    "signedByName" TEXT NOT NULL,
    "strokes" JSONB NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT,
    "capturedByUserId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_checks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "CheckKind" NOT NULL,
    "odometerKm" INTEGER,
    "fuelEighths" INTEGER,
    "damage" JSONB,
    "belongings" TEXT,
    "documents" JSONB,
    "notes" TEXT,
    "keysHook" TEXT,
    "letGoOwingReason" TEXT,
    "signatureId" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "action" "KeyAction" NOT NULL,
    "hook" TEXT,
    "byUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signatures_orgId_signedAt_idx" ON "signatures"("orgId", "signedAt");
CREATE INDEX "signatures_jobId_idx" ON "signatures"("jobId");
CREATE UNIQUE INDEX "vehicle_checks_signatureId_key" ON "vehicle_checks"("signatureId");
CREATE UNIQUE INDEX "vehicle_checks_jobId_kind_key" ON "vehicle_checks"("jobId", "kind");
CREATE INDEX "vehicle_checks_orgId_createdAt_idx" ON "vehicle_checks"("orgId", "createdAt");
CREATE INDEX "key_events_jobId_at_idx" ON "key_events"("jobId", "at");
CREATE INDEX "job_attachments_checkId_idx" ON "job_attachments"("checkId");
CREATE UNIQUE INDEX "estimate_approvals_signatureId_key" ON "estimate_approvals"("signatureId");

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_checks" ADD CONSTRAINT "vehicle_checks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_checks" ADD CONSTRAINT "vehicle_checks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_checks" ADD CONSTRAINT "vehicle_checks_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_checks" ADD CONSTRAINT "vehicle_checks_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_events" ADD CONSTRAINT "key_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_events" ADD CONSTRAINT "key_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_events" ADD CONSTRAINT "key_events_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_attachments" ADD CONSTRAINT "job_attachments_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "vehicle_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estimate_approvals" ADD CONSTRAINT "estimate_approvals_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
