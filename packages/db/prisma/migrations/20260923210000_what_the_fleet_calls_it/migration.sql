-- What the fleet calls it. Phase 69. FR-303.
--
-- A company running forty vans paints a number on each door. When their driver
-- rings, he says "van 17 is making a noise" — not a registration, which he has
-- never looked at. The workshop needs to find the van by the only name the
-- caller knows.
--
-- FR-303 says "a vehicle record MUST capture fleet number", and this is not on
-- the vehicle record. The requirement was written before ADR-0004 had been
-- worked all the way through, and a vehicle is global: one row, shared by every
-- workshop and every owner it will ever have. "Van 17" is not a fact about a
-- Transit. It is Northgate Leasing's name for it, and putting it on the vehicle
-- would mean the number followed the van when Northgate sold it, and showed to
-- every other workshop that ever touched it. The passport made the same mistake
-- with owners' names in Phase 62 and the answer was the same: the fact belongs
-- where the relationship is, not on the thing.
--
-- So: one organisation, one customer, one vehicle, one number. There is
-- deliberately no other column. A fleet's vehicles are still the distinct ones
-- it has brought in, read off the job history, exactly as `fleet.ts` has
-- always done it — this is not a register of who owns what, and a row here for
-- a van the fleet has not brought in yet is harmless rather than a second
-- answer to a question already answered.

CREATE TABLE "fleet_numbers" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "vehicleId"  TEXT NOT NULL,
  "number"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fleet_numbers_pkey" PRIMARY KEY ("id")
);

-- One number per van, for this customer at this workshop.
CREATE UNIQUE INDEX "fleet_numbers_one_per_vehicle"
  ON "fleet_numbers"("orgId", "customerId", "vehicleId");

-- And one van per number. A fleet with two Van 17s cannot be rung about, which
-- is the entire point of the number, so the database refuses rather than
-- letting the search return two answers and the counter pick one.
CREATE UNIQUE INDEX "fleet_numbers_one_per_number"
  ON "fleet_numbers"("orgId", "customerId", upper(btrim("number")));

CREATE INDEX "fleet_numbers_vehicleId_idx" ON "fleet_numbers"("vehicleId");

-- Searching for it is the whole feature: a number nobody can look up is a
-- column somebody typed into. This is what the search box reaches for.
CREATE INDEX "fleet_numbers_lookup_idx"
  ON "fleet_numbers"("orgId", upper(btrim("number")));

ALTER TABLE "fleet_numbers"
  ADD CONSTRAINT "fleet_numbers_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fleet_numbers"
  ADD CONSTRAINT "fleet_numbers_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fleet_numbers"
  ADD CONSTRAINT "fleet_numbers_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A number that is blank is not a number.
ALTER TABLE "fleet_numbers"
  ADD CONSTRAINT "fleet_numbers_says_something"
  CHECK (length(btrim("number")) > 0);
