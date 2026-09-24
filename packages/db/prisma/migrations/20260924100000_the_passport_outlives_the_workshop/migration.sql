-- The passport outlives the workshop. Phase 72.
--
-- A passport event's hash covers, among other things, the id of the workshop
-- that recorded it: recordedByOrgId. That is deliberate. "Who did this work"
-- is half of what the entry claims, and an entry whose author could be
-- changed afterwards is not evidence of anything.
--
-- The foreign key said ON DELETE SET NULL, and the append-only trigger --
-- which lists every column of an event that may not be changed -- did not
-- list recordedByOrgId. The one column the hash covers was the one column
-- nothing defended.
--
-- So deleting a workshop silently rewrote every passport entry it had ever
-- written, to a value the hash was not computed over. The rows kept their
-- stored hashes. Verification recomputed them from the rewritten rows, got
-- different hashes, and reported exactly what it saw: the passport no longer
-- verifies. It was right. Every vehicle that workshop had ever touched lost
-- its history, permanently, and nothing anywhere said so.
--
-- Two changes, either of which alone would have prevented it.

-- 1. A workshop that has written to a passport cannot be deleted.
--
-- It is retired instead: renamed, deactivated, its people moved on. This is
-- what the product has always said happens -- the comment in verify-region
-- says it, ADR-0014 assumes it -- and now the database is the thing that
-- says it, rather than a sentence in a file somebody has to have read.
ALTER TABLE "vehicle_events" DROP CONSTRAINT "vehicle_events_recordedByOrgId_fkey";
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_recordedByOrgId_fkey"
  FOREIGN KEY ("recordedByOrgId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The same reasoning for the supersession link, which the hash also covers.
-- NO ACTION rather than RESTRICT so that deleting a demonstration vehicle's
-- whole chain in one statement still works: by the end of the statement both
-- rows are gone and there is nothing left to point at.
ALTER TABLE "vehicle_events" DROP CONSTRAINT "vehicle_events_supersedesId_fkey";
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "vehicle_events"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- 2. And the column joins the list of things an event does not allow to be
-- changed, so that a future cascade, a migration, or a hand-typed UPDATE is
-- refused rather than believed.
--
-- recordedByUserId is deliberately absent from that list and stays ON DELETE
-- SET NULL: the hash does not cover it, because a person who leaves the trade
-- must not be able to break the history of every car they ever worked on.
-- ADR-0014 -- the passport carries no name.
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
      OR NEW."recordedByOrgId" IS DISTINCT FROM OLD."recordedByOrgId"
      OR NEW."jobRef"       IS DISTINCT FROM OLD."jobRef"
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
