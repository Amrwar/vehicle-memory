-- What the car takes. Phase 88.
--
-- Fourteen numbers a technician needs before touching a car, and until now
-- every one of them lived in a handbook somebody was not holding. The cost of
-- getting one wrong runs from a warning light to a seized engine.
--
-- The obvious answer is a bought universal specification database. There is no
-- good cheap one, the good ones are licensed per lookup, and -- the part that
-- decides it -- a wrong oil grade is an engine. A sheet that fills in 5W-30
-- because it half-recognised the model is worse than a sheet that says
-- nothing, because a blank sends somebody to look it up and a wrong number
-- does not.
--
-- So the sheet is the workshop's own, and it is written once per model rather
-- than once per car. A car added from its VIN decodes to a make, model, year
-- and engine -- which is exactly the key below -- and inherits every number
-- the workshop has already written for that model. That is what "VIN to a
-- specification sheet" turns out to mean once you refuse to invent anything.
CREATE TABLE "vehicle_specifications" (
  "id"    TEXT NOT NULL,
  "orgId" TEXT NOT NULL,

  -- A sheet is for one car or for a model, never both and never neither.
  -- The car-specific one exists for the retrofitted engine, the non-standard
  -- tyres, the owner who insists on a heavier oil: facts about one vehicle
  -- that must not leak onto every other car of the same model.
  "vehicleId"  TEXT,
  "make"       TEXT,
  "model"      TEXT,
  "yearFrom"   INTEGER,
  "yearTo"     INTEGER,
  "engineCode" TEXT,

  -- The fourteen. Every one nullable, because a blank is a blank: a workshop
  -- that has never needed a coolant capacity should not be made to invent one
  -- to save the row, and a zero would read as an answer.
  "oilGrade"              TEXT,
  "oilCapacityL"          DECIMAL(6,2),
  "coolantType"           TEXT,
  "coolantCapacityL"      DECIMAL(6,2),
  "brakeFluid"            TEXT,
  "tyreFront"             TEXT,
  "tyreRear"              TEXT,
  "tyrePressureFrontBar"  DECIMAL(4,2),
  "tyrePressureRearBar"   DECIMAL(4,2),
  "batteryType"           TEXT,
  "batteryAh"             INTEGER,
  "batteryCca"            INTEGER,
  "serviceIntervalMonths" INTEGER,
  "serviceIntervalKm"     INTEGER,

  "note" TEXT,

  -- Present from the start so a specification provider can be wired in later
  -- without a migration, the way the fitment feed was in Phase 43. Null for a
  -- row somebody here typed, which is every row today.
  "feedName"  TEXT,
  "fetchedAt" TIMESTAMPTZ(3),

  "recordedByUserId" TEXT,
  "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vehicle_specifications_pkey" PRIMARY KEY ("id")
);

-- One or the other, and a model sheet with no make is a sheet that matches
-- every car ever made.
ALTER TABLE "vehicle_specifications"
  ADD CONSTRAINT "vehicle_specifications_is_a_car_or_a_model"
  CHECK (
    ("vehicleId" IS NOT NULL AND "make" IS NULL)
    OR ("vehicleId" IS NULL AND "make" IS NOT NULL)
  );

-- Years the wrong way round would silently match nothing, which is the worst
-- kind of wrong: a sheet that exists, looks filled in, and never applies.
ALTER TABLE "vehicle_specifications"
  ADD CONSTRAINT "vehicle_specifications_years_run_forwards"
  CHECK ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo");

-- Figures that cannot be true.
ALTER TABLE "vehicle_specifications"
  ADD CONSTRAINT "vehicle_specifications_figures_are_possible"
  CHECK (
    ("oilCapacityL" IS NULL OR "oilCapacityL" > 0)
    AND ("coolantCapacityL" IS NULL OR "coolantCapacityL" > 0)
    AND ("tyrePressureFrontBar" IS NULL OR "tyrePressureFrontBar" BETWEEN 0 AND 20)
    AND ("tyrePressureRearBar" IS NULL OR "tyrePressureRearBar" BETWEEN 0 AND 20)
    AND ("batteryAh" IS NULL OR "batteryAh" BETWEEN 0 AND 2000)
    AND ("batteryCca" IS NULL OR "batteryCca" BETWEEN 0 AND 5000)
    AND ("serviceIntervalMonths" IS NULL OR "serviceIntervalMonths" BETWEEN 1 AND 120)
    AND ("serviceIntervalKm" IS NULL OR "serviceIntervalKm" BETWEEN 100 AND 200000)
  );

-- One override per car. Two would be two answers, and the screen would have to
-- pick one to show.
CREATE UNIQUE INDEX "vehicle_specifications_one_per_vehicle"
  ON "vehicle_specifications" ("orgId", "vehicleId")
  WHERE "vehicleId" IS NOT NULL;

CREATE INDEX "vehicle_specifications_orgId_make_model_idx"
  ON "vehicle_specifications" ("orgId", "make", "model");

ALTER TABLE "vehicle_specifications" ADD CONSTRAINT "vehicle_specifications_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A specification sheet is the workshop's own working note about a car, not
-- part of the car's history, so it goes when the car goes from their books.
ALTER TABLE "vehicle_specifications" ADD CONSTRAINT "vehicle_specifications_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_specifications" ADD CONSTRAINT "vehicle_specifications_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
