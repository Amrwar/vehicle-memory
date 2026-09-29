-- Where to buy it, and what was fitted instead. Phase 87.
--
-- Until now a Product and a Supplier were not connected by anything. A part
-- had one cost price -- whatever it happened to cost the last time -- and
-- buying it meant somebody remembering who sells it and roughly what for.
-- That memory lives in one person, goes on holiday, and quotes customers a
-- figure from two years ago.
--
-- So: one row per supplier per part, holding the four things a buyer actually
-- asks. What does it cost, have they got it, when does it get here, and how
-- long do they stand behind it. Every one of them nullable except the price,
-- because "nobody has said" is the honest state of most of this list most of
-- the time and a zero would read as free, in stock tomorrow, with no warranty.
CREATE TABLE "supplier_parts" (
  "id"                 TEXT NOT NULL,
  "orgId"              TEXT NOT NULL,
  "supplierId"         TEXT NOT NULL,
  "productId"          TEXT NOT NULL,
  "supplierPartNumber" TEXT,
  "brand"              TEXT,
  "price"              DECIMAL(12,4) NOT NULL,
  "leadTimeDays"       INTEGER,
  "inStock"            BOOLEAN,
  "warrantyMonths"     INTEGER,
  "note"               TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  -- When a person last stood over this row and said it was still true. Not
  -- updatedAt: an edit to the note is not a confirmation of the price, and a
  -- staleness warning driven by updatedAt would be cleared by tidying.
  "confirmedAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedByUserId"  TEXT,
  "createdAt"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_parts_pkey" PRIMARY KEY ("id")
);

-- One answer per supplier per part. Two rows would be two prices, and the
-- screen would have to pick one to show.
CREATE UNIQUE INDEX "supplier_parts_supplierId_productId_key"
  ON "supplier_parts" ("supplierId", "productId");

CREATE INDEX "supplier_parts_orgId_productId_idx" ON "supplier_parts" ("orgId", "productId");
CREATE INDEX "supplier_parts_orgId_supplierId_idx" ON "supplier_parts" ("orgId", "supplierId");

-- Figures that cannot be true.
ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_figures_are_possible"
  CHECK (
    "price" >= 0
    AND ("leadTimeDays" IS NULL OR "leadTimeDays" BETWEEN 0 AND 365)
    AND ("warrantyMonths" IS NULL OR "warrantyMonths" BETWEEN 0 AND 600)
  );

ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The substitution.
--
-- Six things can be true about a part being an equivalent, each of them a
-- fact already in this database rather than a number somebody invented. The
-- enum is ordered strongest first.
--
-- The first two are different in kind from the last four, and the difference
-- is the whole feature. They say *these two parts are the same thing*: we
-- have made this exact swap before and somebody confirmed it, or a supplier
-- lists both under one number. The last four say only *this part suits that
-- car* -- which is not the same claim, and treating it as one is how a screen
-- offers a brake disc as an alternative to a set of brake pads.
CREATE TYPE "FitEvidence" AS ENUM (
  'SUBSTITUTED_BEFORE',
  'SAME_PART_NUMBER',
  'FITTED_TO_THIS_CAR',
  'FITTED_TO_THIS_MODEL',
  'RECORDED_HERE',
  'CATALOGUE'
);

ALTER TABLE "job_part_lines" ADD COLUMN "substitutedForProductId" TEXT;
ALTER TABLE "job_part_lines" ADD COLUMN "substitutionEvidence" "FitEvidence";
ALTER TABLE "job_part_lines" ADD COLUMN "substitutionConfirmedByUserId" TEXT;
ALTER TABLE "job_part_lines" ADD COLUMN "substitutionConfirmedAt" TIMESTAMPTZ(3);

ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_substitutedForProductId_fkey"
  FOREIGN KEY ("substitutedForProductId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_substitutionConfirmedByUserId_fkey"
  FOREIGN KEY ("substitutionConfirmedByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The whole point of the feature, in one constraint.
--
-- A different part than the one quoted may go on a customer's car, and there
-- is nothing wrong with that -- but not silently, and not by the system's own
-- decision. A substitution exists only together with the moment somebody
-- confirmed it and the evidence they confirmed it on. Either all three are
-- there or none of them are, and no code path can leave it half-written.
--
-- The person is deliberately not in the constraint: a user row can be erased
-- under the retention rules, and a confirmation that vanishes because somebody
-- left the company would take the substitution record with it.
ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_substitution_is_confirmed"
  CHECK (
    ("substitutedForProductId" IS NULL AND "substitutionEvidence" IS NULL AND "substitutionConfirmedAt" IS NULL)
    OR ("substitutedForProductId" IS NOT NULL AND "substitutionEvidence" IS NOT NULL AND "substitutionConfirmedAt" IS NOT NULL)
  );

-- And a part cannot be an equivalent for itself.
ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_substitution_is_a_different_part"
  CHECK ("substitutedForProductId" IS NULL OR "substitutedForProductId" <> "productId");

CREATE INDEX "job_part_lines_substitutedForProductId_idx"
  ON "job_part_lines" ("substitutedForProductId");
