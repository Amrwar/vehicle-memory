-- The first day. Phase 45.
--
-- Two flags and one deliberate exception. A workshop can put the setup list
-- away; a workshop and its vehicles can be marked as demonstration data; and
-- demonstration vehicles, alone in this database, can have their events
-- deleted, because made-up history is not evidence and a demonstration that
-- cannot be removed is a demonstration nobody dares create.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "setupHiddenAt" TIMESTAMP(3),
ADD COLUMN "isDemonstration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "isDemonstration" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "vehicles_isDemonstration_idx" ON "vehicles"("isDemonstration")
  WHERE "isDemonstration";

-- The append-only rule, with one exception written into it rather than left
-- to the application: a vehicle marked as demonstration data may have its
-- events deleted. Every other event, on every real vehicle, is as immutable
-- as it was.
CREATE OR REPLACE FUNCTION carnet_vehicle_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF EXISTS (
      SELECT 1 FROM "vehicles" WHERE "id" = OLD."vehicleId" AND "isDemonstration"
    ) THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION
      'vehicle_events is append-only: DELETE is not permitted (event %)', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Allow only the supersededById back-reference to be filled in, once.
    IF (OLD."supersededById" IS NOT NULL) THEN
      RAISE EXCEPTION
        'vehicle_events is append-only: event % is already superseded', OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF ( NEW."id"           IS DISTINCT FROM OLD."id"
      OR NEW."vehicleId"    IS DISTINCT FROM OLD."vehicleId"
      OR NEW."sequence"     IS DISTINCT FROM OLD."sequence"
      OR NEW."type"         IS DISTINCT FROM OLD."type"
      OR NEW."occurredAt"   IS DISTINCT FROM OLD."occurredAt"
      OR NEW."recordedAt"   IS DISTINCT FROM OLD."recordedAt"
      OR NEW."verification" IS DISTINCT FROM OLD."verification"
      OR NEW."title"        IS DISTINCT FROM OLD."title"
      OR NEW."summary"      IS DISTINCT FROM OLD."summary"
      OR NEW."payload"::text IS DISTINCT FROM OLD."payload"::text
      OR NEW."odometerKm"   IS DISTINCT FROM OLD."odometerKm"
      OR NEW."hash"         IS DISTINCT FROM OLD."hash"
      OR NEW."prevHash"     IS DISTINCT FROM OLD."prevHash"
      OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId"
    ) THEN
      RAISE EXCEPTION
        'vehicle_events is append-only: only supersededById may be set (event %)', OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A demonstration workshop is never anybody's real workshop, so it cannot be
-- the one paying: the subscription columns stay empty on it.
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_demonstration_check"
  CHECK (NOT "isDemonstration" OR "billingSubscriptionRef" IS NULL);

-- The same exception for consent, and for the same reason: a demonstration
-- customer never gave permission for anything, so the row proving they did is
-- not evidence of anything either. Every real customer's consent history is
-- as immutable as it was.
CREATE OR REPLACE FUNCTION carnet_consent_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF EXISTS (
      SELECT 1
      FROM "customers" c
      JOIN "organizations" o ON o."id" = c."orgId"
      WHERE c."id" = OLD."customerId" AND o."isDemonstration"
    ) THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'Consent history cannot be changed. It is the evidence.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
