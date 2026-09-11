-- Phase 9 invariants.
--
-- A warranty is a promise the workshop will be held to months after everyone
-- has forgotten making it, so the rules below sit in the database rather than
-- only in the code that happens to write these rows.

-- ---------------------------------------------------------------------------
-- Cover has to last some time.
--
-- A zero-month warranty is not a warranty, and it reads on every screen as
-- though the customer has one.
-- ---------------------------------------------------------------------------

ALTER TABLE "warranties"
  ADD CONSTRAINT "warranties_positive_term"
  CHECK ("months" >= 1 AND ("km" IS NULL OR "km" > 0));

-- A mileage allowance means nothing without the reading it counts from.
-- Storing one without the other produces a warranty that silently never
-- expires on distance.
ALTER TABLE "warranties"
  ADD CONSTRAINT "warranties_distance_needs_a_start"
  CHECK ("km" IS NULL OR "startedAtKm" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Voiding says who, when and why.
--
-- A warranty that stopped applying for no stated reason is indistinguishable
-- from one somebody cancelled to avoid a claim, and the person it was made to
-- is the last to find out.
-- ---------------------------------------------------------------------------

ALTER TABLE "warranties"
  ADD CONSTRAINT "warranties_void_is_explained"
  CHECK (
    ("voidedAt" IS NULL AND "voidedReason" IS NULL) OR
    ("voidedAt" IS NOT NULL AND "voidedReason" IS NOT NULL AND length(btrim("voidedReason")) > 0)
  );

-- ---------------------------------------------------------------------------
-- A goodwill claim says why it is goodwill.
--
-- The workshop settles these, and should. What it must not do is settle them
-- invisibly: the reason is what a manager reads when the goodwill adds up to a
-- month's profit.
-- ---------------------------------------------------------------------------

ALTER TABLE "warranty_claims"
  ADD CONSTRAINT "warranty_claims_goodwill_is_explained"
  CHECK (
    "outsideCover" = false OR
    ("goodwillReason" IS NOT NULL AND length(btrim("goodwillReason")) > 0)
  );

-- A settled claim has a time and an outcome. Without both, "settled" means
-- nothing to whoever reads it next.
ALTER TABLE "warranty_claims"
  ADD CONSTRAINT "warranty_claims_settled_is_recorded"
  CHECK (
    "status" <> 'SETTLED' OR
    ("settledAt" IS NOT NULL AND "outcome" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- One open claim at a time.
--
-- Two open claims on one warranty means two people chasing the same supplier
-- about the same part, and the second one is how a workshop gets told it has
-- already been dealt with.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "warranty_claims_one_open_per_warranty"
  ON "warranty_claims" ("warrantyId")
  WHERE "status" = 'OPEN';
