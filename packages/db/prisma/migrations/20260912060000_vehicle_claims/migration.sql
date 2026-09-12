-- Customers asking for their own vehicles. Phase 18.
--
-- Also makes a message's organisation optional, so a password reset can reach
-- somebody who has signed up and is not yet attached to any workshop.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "VehicleClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "message_logs" ALTER COLUMN "orgId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "vehicle_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "VehicleClaimStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "reason" TEXT,

    CONSTRAINT "vehicle_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_claims_orgId_status_askedAt_idx" ON "vehicle_claims"("orgId", "status", "askedAt");

-- CreateIndex
CREATE INDEX "vehicle_claims_userId_askedAt_idx" ON "vehicle_claims"("userId", "askedAt");

-- CreateIndex
CREATE INDEX "vehicle_claims_vehicleId_idx" ON "vehicle_claims"("vehicleId");

-- AddForeignKey
ALTER TABLE "vehicle_claims" ADD CONSTRAINT "vehicle_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_claims" ADD CONSTRAINT "vehicle_claims_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_claims" ADD CONSTRAINT "vehicle_claims_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_claims" ADD CONSTRAINT "vehicle_claims_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- One open request per person per vehicle.
--
-- Asking twice about the same car gives a workshop two rows saying the same
-- thing, and answering one leaves the customer still apparently waiting.
-- Answered requests are kept, so the history of who asked survives.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "vehicle_claims_one_open_each"
  ON "vehicle_claims" ("userId", "vehicleId")
  WHERE "status" = 'PENDING';

-- ---------------------------------------------------------------------------
-- A refusal says why.
--
-- The customer is told the outcome either way. "No" with nothing behind it
-- produces the telephone call this feature exists to save.
-- ---------------------------------------------------------------------------

ALTER TABLE "vehicle_claims"
  ADD CONSTRAINT "vehicle_claims_refusal_is_explained"
  CHECK (
    "status" <> 'REJECTED' OR
    ("reason" IS NOT NULL AND length(btrim("reason")) > 0)
  );

-- An answered request has a time on it, and one still pending does not.
ALTER TABLE "vehicle_claims"
  ADD CONSTRAINT "vehicle_claims_decision_has_a_time"
  CHECK (("status" = 'PENDING') = ("decidedAt" IS NULL));

-- ---------------------------------------------------------------------------
-- Finding a vehicle by the plate as somebody types it.
--
-- People write a registration with spaces, with a hyphen, in lower case, or
-- however it is painted on the car. The stored value is whatever the workshop
-- entered. Comparing the two means normalising both, and normalising the
-- stored side inside a WHERE clause reads the whole table on every attempt.
--
-- This is the expression the lookup uses, so the lookup is an index seek. Not
-- unique: two workshops can legitimately hold the same plate, most often the
-- same car after it moved garages.
-- ---------------------------------------------------------------------------

CREATE INDEX "vehicles_registration_normalised"
  ON "vehicles" (upper(replace(replace("registration", ' ', ''), '-', '')))
  WHERE "registration" IS NOT NULL;
