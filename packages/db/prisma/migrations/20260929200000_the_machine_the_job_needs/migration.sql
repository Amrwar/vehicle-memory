-- The machine the job needs. Phase 89.
--
-- A workshop's lifts, scan tools, torque wrenches and alignment rigs decide
-- what work it can take, and the product knew nothing about any of them.
-- `bays.capability` was a free-text hint typed once and read by nobody, and
-- `job_type_skills` covered the people.
--
-- Nothing here stores a state. Whether a machine is usable is derived from
-- these columns against the clock, which is the point of the phase: an expired
-- certificate takes the machine out of service on the right morning even
-- though every person who could have noticed was on holiday. A stored
-- `isAvailable` flag would have stayed true until somebody remembered, and the
-- day anybody remembers is not the day it expired.
CREATE TABLE "equipment" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "locationId" TEXT,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "serialNumber" TEXT,
  "notes"      TEXT,

  -- Retired, not deleted. Old jobs must keep reading the way they did, and a
  -- workshop that sold a lift still needs to know which jobs it did.
  "isActive"   BOOLEAN NOT NULL DEFAULT true,

  -- Taken out by a person, with a reason. The two stand or fall together: a
  -- machine out of service with no reason is a machine nobody can put back,
  -- because nobody knows what was wrong with it.
  "outOfServiceSince"  TIMESTAMPTZ(3),
  "outOfServiceReason" TEXT,

  -- The calibration or statutory inspection certificate.
  --
  -- Null expiry means the machine does not carry one -- a trolley jack, a
  -- bench vice -- which is a different thing from one whose certificate has
  -- lapsed, and the two must never collapse into the same state.
  "certificateRef"       TEXT,
  "certifiedAt"          TIMESTAMPTZ(3),
  "certificateExpiresAt" TIMESTAMPTZ(3),
  "certifiedBy"          TEXT,

  -- The machine's own servicing, which warns and never blocks. A lift a month
  -- late for its service is a risk a workshop may knowingly carry for a week;
  -- one whose inspection has lapsed is one it may not use at all. Flattening
  -- the two either grounds a workshop for a missed service or keeps it working
  -- on an uninspected lift, and the second is how somebody gets hurt.
  "serviceEveryMonths" INTEGER,
  "servicedAt"         TIMESTAMPTZ(3),

  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_orgId_code_key" ON "equipment" ("orgId", "code");
CREATE INDEX "equipment_orgId_isActive_idx" ON "equipment" ("orgId", "isActive");
CREATE INDEX "equipment_locationId_idx" ON "equipment" ("locationId");

-- The `IS NOT NULL` on the reason is load-bearing and was missing on the first
-- draft. `length(btrim(NULL)) >= 3` is NULL, not false, and a CHECK passes on
-- NULL -- so the one state this exists to forbid, a machine out of service
-- with no reason, was the one state it allowed. verify-equipment caught it.
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_out_of_service_says_why"
  CHECK (
    ("outOfServiceSince" IS NULL AND "outOfServiceReason" IS NULL)
    OR (
      "outOfServiceSince" IS NOT NULL
      AND "outOfServiceReason" IS NOT NULL
      AND length(btrim("outOfServiceReason")) >= 3
    )
  );

-- A certificate that expires before it was issued is a typo, and a typo here
-- either grounds a machine that is fine or passes one that is not.
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_certificate_runs_forwards"
  CHECK (
    "certifiedAt" IS NULL
    OR "certificateExpiresAt" IS NULL
    OR "certifiedAt" <= "certificateExpiresAt"
  );

ALTER TABLE "equipment" ADD CONSTRAINT "equipment_service_interval_is_possible"
  CHECK ("serviceEveryMonths" IS NULL OR "serviceEveryMonths" BETWEEN 1 AND 120);

ALTER TABLE "equipment" ADD CONSTRAINT "equipment_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment" ADD CONSTRAINT "equipment_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What a kind of work needs, exactly as `job_type_skills` says what it needs
-- from a person.
CREATE TABLE "job_type_equipment" (
  "id"          TEXT NOT NULL,
  "jobTypeId"   TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "job_type_equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_type_equipment_jobTypeId_equipmentId_key"
  ON "job_type_equipment" ("jobTypeId", "equipmentId");

CREATE INDEX "job_type_equipment_equipmentId_idx" ON "job_type_equipment" ("equipmentId");

ALTER TABLE "job_type_equipment" ADD CONSTRAINT "job_type_equipment_jobTypeId_fkey"
  FOREIGN KEY ("jobTypeId") REFERENCES "job_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE. Deleting a machine that a kind of work depends on
-- would quietly make that work startable again with nothing to do it on. The
-- machine is retired instead, and the requirement stays visible.
ALTER TABLE "job_type_equipment" ADD CONSTRAINT "job_type_equipment_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
