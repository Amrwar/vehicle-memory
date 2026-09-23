-- The courtesy car. Phase 67. FR-512.
--
-- Two tables and one constraint, and the constraint is the reason for the
-- phase.
--
-- `courtesy_vehicles` says which cars a workshop lends. It does not invent a
-- second place a vehicle can belong: the vehicle stays global (ADR-0004) and
-- this is one organisation's statement about it, the same shape as a
-- VehicleAccessGrant. The workshop's own paperwork about its own fleet lives
-- on the vehicle's documents, where every other expiry in this product lives.
--
-- `courtesy_loans` is a car promised to somebody between two moments.
--
-- And then the load-bearing line. Two loans of the same car over the same days
-- means a customer standing at the counter on Tuesday morning while the car
-- they were promised is in Leeds with somebody else. Nothing recovers from
-- that: the work cannot start, and the workshop finds out from the customer at
-- the worst possible moment.
--
-- The capacity module treats a bay clash as advisory on purpose — "workshops
-- genuinely do squeeze a job in, and software that forbids it gets worked
-- around" — and that reasoning does not carry here. A bay can be squeezed. A
-- second car cannot be conjured. So this one is refused, and refused by the
-- database: an application check reads, decides, and writes, and two people
-- booking at once both read before either writes. The only way to state
-- "never, whatever the timing" is a constraint.
--
-- Same shape as `pay_rates_no_overlap` (September 2026), for the same reason
-- written down there: overlapping rows mean whichever the query happens to
-- return first becomes the answer, which produces a promise rather than a
-- complaint. `btree_gist` has been installed since then.
--
-- `tsrange` rather than `tstzrange`: these columns are `timestamp without time
-- zone`, so a timestamptz range would depend on the session's TimeZone setting
-- and Postgres refuses to index a function that is not immutable. The moment a
-- car goes out is the same moment whoever reads the row is standing in.
--
-- The range runs to when the car actually came back, where it has: an early
-- return frees the afternoon, and a late one keeps blocking, which is exactly
-- what the next customer needs. Cancelled loans are outside the constraint,
-- because a cancelled promise is not a promise.

CREATE TABLE "courtesy_vehicles" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "vehicleId"   TEXT NOT NULL,
  "name"        TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "retiredAt"   TIMESTAMP(3),
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "courtesy_vehicles_pkey" PRIMARY KEY ("id")
);

-- One workshop does not lend the same car twice over.
CREATE UNIQUE INDEX "courtesy_vehicles_one_per_org" ON "courtesy_vehicles"("orgId", "vehicleId");
CREATE INDEX "courtesy_vehicles_orgId_isActive_idx" ON "courtesy_vehicles"("orgId", "isActive");

ALTER TABLE "courtesy_vehicles"
  ADD CONSTRAINT "courtesy_vehicles_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courtesy_vehicles"
  ADD CONSTRAINT "courtesy_vehicles_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Retired, or not. A car taken out of service with no date is half a record.
ALTER TABLE "courtesy_vehicles"
  ADD CONSTRAINT "courtesy_vehicles_retirement_is_whole"
  CHECK (("isActive" = true AND "retiredAt" IS NULL) OR ("isActive" = false AND "retiredAt" IS NOT NULL));

CREATE TABLE "courtesy_loans" (
  "id"                 TEXT NOT NULL,
  "orgId"              TEXT NOT NULL,
  "courtesyVehicleId"  TEXT NOT NULL,
  "vehicleId"          TEXT NOT NULL,
  "customerId"         TEXT NOT NULL,
  "jobId"              TEXT,
  "bookingId"          TEXT,
  "startAt"            TIMESTAMP(3) NOT NULL,
  "dueBackAt"          TIMESTAMP(3) NOT NULL,
  "returnedAt"         TIMESTAMP(3),
  "odometerOutKm"      INTEGER,
  "odometerInKm"       INTEGER,
  "cancelledAt"        TIMESTAMP(3),
  "cancelReason"       TEXT,
  "handedOverByUserId" TEXT,
  "takenBackByUserId"  TEXT,
  "note"               TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "courtesy_loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "courtesy_loans_orgId_startAt_idx" ON "courtesy_loans"("orgId", "startAt");
CREATE INDEX "courtesy_loans_vehicleId_startAt_idx" ON "courtesy_loans"("vehicleId", "startAt");
CREATE INDEX "courtesy_loans_customerId_idx" ON "courtesy_loans"("customerId");
CREATE INDEX "courtesy_loans_jobId_idx" ON "courtesy_loans"("jobId");
-- What is still out, which is the question the day starts with.
CREATE INDEX "courtesy_loans_open_idx" ON "courtesy_loans"("orgId", "dueBackAt") WHERE "returnedAt" IS NULL AND "cancelledAt" IS NULL;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_courtesyVehicleId_fkey"
  FOREIGN KEY ("courtesyVehicleId") REFERENCES "courtesy_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_handedOverByUserId_fkey"
  FOREIGN KEY ("handedOverByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_takenBackByUserId_fkey"
  FOREIGN KEY ("takenBackByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_forwards"
  CHECK ("dueBackAt" > "startAt");

-- Back, or not. A return with no time is a car somebody thinks is in the yard.
ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_return_is_not_before_it_left"
  CHECK ("returnedAt" IS NULL OR "returnedAt" >= "startAt");

-- Cancelled, and why. Same reasoning as every other cancellation here.
ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_cancellation_is_explained"
  CHECK ("cancelledAt" IS NULL OR ("cancelReason" IS NOT NULL AND length(btrim("cancelReason")) > 0));

-- A car cannot be given back and cancelled.
ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_back_or_cancelled_not_both"
  CHECK ("returnedAt" IS NULL OR "cancelledAt" IS NULL);

-- The one that matters.
ALTER TABLE "courtesy_loans"
  ADD CONSTRAINT "courtesy_loans_no_overlap"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tsrange("startAt", COALESCE("returnedAt", "dueBackAt"), '[)') WITH &&
  )
  WHERE ("cancelledAt" IS NULL);
