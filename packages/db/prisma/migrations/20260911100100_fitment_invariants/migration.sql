-- Phase 13 invariants.
--
-- A fitment row is read to decide whether a part goes on a car. A nonsense
-- row there does not produce an error on a screen; it produces either a
-- warning nobody can act on, or silence where there should have been one.

-- ---------------------------------------------------------------------------
-- A fitment names a make.
--
-- The make is the only field every match starts from. A row with a blank one
-- can never match anything and can never be excluded by anything, so it sits
-- in the table forever making the part look as though somebody has recorded
-- its fitment.
-- ---------------------------------------------------------------------------

ALTER TABLE "part_fitments"
  ADD CONSTRAINT "part_fitments_name_a_make"
  CHECK (length(btrim("make")) > 0);

-- ---------------------------------------------------------------------------
-- A year range runs forwards, and inside the years cars have existed.
--
-- A range with its ends the wrong way round excludes every vehicle silently,
-- which reads on the page as "does not fit" for a part that does.
-- ---------------------------------------------------------------------------

ALTER TABLE "part_fitments"
  ADD CONSTRAINT "part_fitments_years_run_forwards"
  CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1885 AND 2200) AND
    ("yearTo" IS NULL OR "yearTo" BETWEEN 1885 AND 2200) AND
    ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  );

-- ---------------------------------------------------------------------------
-- One claim per part per vehicle description.
--
-- Two rows saying the same thing are harmless until they disagree, and then
-- which one answers depends on the order the database happens to return them.
-- Nulls are distinct in a plain unique index, so this is expressed over
-- coalesced values: a row with no model and a row with a model are different
-- claims, but two rows with no model are the same one.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "part_fitments_one_claim_each"
  ON "part_fitments" (
    "productId",
    lower(btrim("make")),
    lower(btrim(coalesce("model", ''))),
    coalesce("yearFrom", -1),
    coalesce("yearTo", -1),
    lower(btrim(coalesce("engineCode", '')))
  );
