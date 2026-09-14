-- Where a workshop stands with us. Phase 31.
--
-- Four dates, and a state read from them: trial, grace, active, suspended,
-- cancelled. Nothing is deleted in any state. A workshop from before trials
-- were recorded is treated as on a plan from the day it was created.

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "subscribedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "organizations" SET "subscribedAt" = "createdAt" WHERE "subscribedAt" IS NULL;
