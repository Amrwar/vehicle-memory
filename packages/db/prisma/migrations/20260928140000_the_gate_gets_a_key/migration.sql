-- The gate gets a key. Phase 85.
--
-- `assertTransition` has refused to complete a job since Phase 1 when its job
-- type asks for a quality check and no passed check exists:
--
--   FR-612: completion is gated on quality control where the job type wants it.
--
-- The default job types a new workshop is given -- Major Service, Repair,
-- Service -- all ask for one. And nothing anywhere in the product has ever
-- written a `quality_checks` row. The job page renders them; no code path
-- creates one.
--
-- So a workshop signing up and booking in a service could never finish it. The
-- message it got was correct and complete -- "This job type requires a passed
-- quality check before it can be completed" -- and there was no way to record
-- one. A gate with no key, standing for eighty-four phases, behind a rule that
-- reads as careful.
--
-- These two tables are the key: what a workshop asks before a car goes back,
-- and what somebody answered.

CREATE TYPE "QualityItemKind" AS ENUM ('CONFIRM', 'VALUE');

-- The catalogue. Every workshop's sign-off sheet is different and every one is
-- short, so it is theirs to write rather than a fixed list in the code.
CREATE TABLE "quality_check_items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "QualityItemKind" NOT NULL DEFAULT 'CONFIRM',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quality_check_items_pkey" PRIMARY KEY ("id")
);

-- One answer to one line. A tick, or a figure: a road test result and a final
-- mileage are not ticks, and a sheet that made them ticks would be a sheet
-- somebody ticked.
CREATE TABLE "quality_check_answers" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "confirmed" BOOLEAN,
    "value" TEXT,

    CONSTRAINT "quality_check_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quality_check_items_orgId_label_key" ON "quality_check_items"("orgId", "label");
CREATE INDEX "quality_check_answers_itemId_idx" ON "quality_check_answers"("itemId");
CREATE UNIQUE INDEX "quality_check_answers_checkId_itemId_key" ON "quality_check_answers"("checkId", "itemId");

ALTER TABLE "quality_check_items" ADD CONSTRAINT "quality_check_items_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_check_answers" ADD CONSTRAINT "quality_check_answers_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "quality_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A line somebody has answered cannot be deleted, only retired. Deleting it
-- would not remove the answer; it would remove the question, leaving a tick
-- against nothing on a sheet that says a car was safe to give back. The same
-- reasoning as Phase 81's causes and Phase 72's workshops.
ALTER TABLE "quality_check_answers" ADD CONSTRAINT "quality_check_answers_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "quality_check_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An answer is a tick or a figure, never both and never neither. A row with
-- both empty is a line somebody skipped while appearing to have answered it.
ALTER TABLE "quality_check_answers" ADD CONSTRAINT "quality_check_answers_is_one_or_the_other"
  CHECK (("confirmed" IS NULL) <> ("value" IS NULL));
