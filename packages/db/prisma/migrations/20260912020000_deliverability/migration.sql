-- Bounces, complaints and addresses nothing may be sent to. Phase 17.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateTable
CREATE TABLE "suppressed_addresses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "detail" TEXT,
    "liftedAt" TIMESTAMP(3),
    "liftedByUserId" TEXT,
    "liftedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressed_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "messageLogId" TEXT,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "providerRef" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppressed_addresses_orgId_createdAt_idx" ON "suppressed_addresses"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "delivery_events_messageLogId_occurredAt_idx" ON "delivery_events"("messageLogId", "occurredAt");

-- CreateIndex
CREATE INDEX "delivery_events_orgId_event_occurredAt_idx" ON "delivery_events"("orgId", "event", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_events_orgId_providerRef_key" ON "delivery_events"("orgId", "providerRef");

-- AddForeignKey
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppressed_addresses" ADD CONSTRAINT "suppressed_addresses_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "message_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- One live suppression per address per workshop.
--
-- Two rows for one address means the send path has to decide which is
-- authoritative, and it would decide differently depending on the order the
-- database returned them. Lifted rows are kept, so the history of why an
-- address was blocked survives being unblocked.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "suppressed_addresses_one_live_each"
  ON "suppressed_addresses" ("orgId", lower(btrim("address")))
  WHERE "liftedAt" IS NULL;

-- An address is an address.
ALTER TABLE "suppressed_addresses"
  ADD CONSTRAINT "suppressed_addresses_have_an_address"
  CHECK (length(btrim("address")) > 0);

-- Lifting a suppression says who did it and why. An address that came back
-- with nothing written against it is one nobody can account for later, and
-- these are the rows that explain why mail started going somewhere again.
ALTER TABLE "suppressed_addresses"
  ADD CONSTRAINT "suppressed_addresses_lift_is_explained"
  CHECK (
    "liftedAt" IS NULL OR
    ("liftedByUserId" IS NOT NULL AND "liftedNote" IS NOT NULL AND length(btrim("liftedNote")) > 0)
  );
