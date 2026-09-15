-- Finding anything. Phase 39.
--
-- Notifications for staff, one row per person, each opening the record it
-- is about; and the indexes a search by plate and by telephone number uses.

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_notifications_userId_orgId_readAt_createdAt_idx" ON "staff_notifications"("userId", "orgId", "readAt", "createdAt");

-- Search by plate however it was typed, and by telephone digits. Expression
-- indexes Prisma does not model; they are here so a search stays quick on a
-- workshop with years of customers.
CREATE INDEX "vehicles_registration_compact_idx" ON "vehicles" (upper(regexp_replace(coalesce("registration", ''), '[^A-Za-z0-9]', '', 'g')));
CREATE INDEX "customers_mobile_digits_idx" ON "customers" ("orgId", regexp_replace(coalesce("mobile", ''), '\D', '', 'g'));

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
