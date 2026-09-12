-- The vehicle's paperwork, and the customer's preferred technician. Phase 20.
--
-- Documents belong to the car. A workshop with read access sees them, the
-- owner sees them, and nothing is deleted: a removed document keeps its row
-- and its reason. Trigram indexes stripped as always.

-- CreateEnum
CREATE TYPE "VehicleDocumentKind" AS ENUM ('PHOTO', 'REGISTRATION_CERTIFICATE', 'MOT_CERTIFICATE', 'INSURANCE', 'SERVICE_RECORD', 'PURCHASE_INVOICE', 'OTHER');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "preferredTechnicianUserId" TEXT;

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "VehicleDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "uploadedByOrgId" TEXT,
    "uploadedByUserId" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_kind_idx" ON "vehicle_documents"("vehicleId", "kind");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_expiresAt_idx" ON "vehicle_documents"("vehicleId", "expiresAt");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_preferredTechnicianUserId_fkey" FOREIGN KEY ("preferredTechnicianUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploadedByOrgId_fkey" FOREIGN KEY ("uploadedByOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A document is named, has bytes, and does not expire before it was issued.
ALTER TABLE "vehicle_documents"
  ADD CONSTRAINT "vehicle_documents_are_named" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "vehicle_documents_have_bytes" CHECK ("sizeBytes" > 0),
  ADD CONSTRAINT "vehicle_documents_expire_after_issue" CHECK ("issuedAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" >= "issuedAt"),
  ADD CONSTRAINT "vehicle_documents_removal_is_explained" CHECK ("removedAt" IS NULL OR length(btrim(coalesce("removedReason", ''))) > 0);
