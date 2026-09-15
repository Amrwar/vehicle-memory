-- Packages and templates. Phase 37.
--
-- A piece of work priced and described as one thing: labour, parts, a
-- checklist, a duration, a price and an interval. A job or a booking made
-- from one starts with all of it on it.

-- CreateTable
CREATE TABLE "service_packages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jobTypeId" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "price" DECIMAL(12,2),
    "intervalMonths" INTEGER,
    "intervalKm" INTEGER,
    "bookable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_lines" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL DEFAULT 'LABOUR',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_package_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_checks" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_package_checks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "packageId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "packageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "service_packages_orgId_code_key" ON "service_packages"("orgId", "code");
CREATE INDEX "service_packages_orgId_sortOrder_idx" ON "service_packages"("orgId", "sortOrder");
CREATE INDEX "service_package_lines_packageId_sortOrder_idx" ON "service_package_lines"("packageId", "sortOrder");
CREATE INDEX "service_package_checks_packageId_sortOrder_idx" ON "service_package_checks"("packageId", "sortOrder");
CREATE INDEX "jobs_packageId_idx" ON "jobs"("packageId");
CREATE INDEX "bookings_packageId_idx" ON "bookings"("packageId");

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "job_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_package_lines" ADD CONSTRAINT "service_package_lines_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_package_lines" ADD CONSTRAINT "service_package_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_package_checks" ADD CONSTRAINT "service_package_checks_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
