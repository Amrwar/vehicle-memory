-- The sheet it was taken on. Phase 90.
--
-- `inspection_results` has snapshotted the section and item names since Phase
-- 1, so a completed inspection keeps the words it was written with. That was
-- right and it was not enough: it preserves what was asked and answered, and
-- says nothing about what the sheet asked that day -- so nothing about what it
-- did NOT ask.
--
-- A workshop adds "brake fluid condition" in June. A customer opens an
-- inspection from March. There is no brake fluid line on it, and every reading
-- of that silence is wrong in a different way: an omission, a pass, somebody
-- forgetting. The truth -- it was not on the sheet in March -- was the one
-- thing the record could not say.
CREATE TABLE "inspection_template_versions" (
  "id"         TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version"    INTEGER NOT NULL,

  -- The template's name as it stood. A workshop that renames its sheet has not
  -- changed a question, and an old report must still say what it was called
  -- when it was taken.
  "name" TEXT NOT NULL,

  -- What makes one sheet a different sheet, computed from the ordered
  -- questions rather than from their ids: a workshop that deletes an item and
  -- retypes it identically has not changed what it asks. A version is found by
  -- this, and cut only when nothing matches -- so versions mark sheets that
  -- were used, not keystrokes, and a sheet edited back to what it was lands on
  -- the earlier version again.
  "fingerprint" TEXT NOT NULL,

  "itemCount"        INTEGER NOT NULL,
  "firstUsedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId"  TEXT,

  CONSTRAINT "inspection_template_versions_pkey" PRIMARY KEY ("id")
);

-- One version per shape per template, which is what makes "find or cut" safe
-- under two inspections starting at the same moment.
CREATE UNIQUE INDEX "inspection_template_versions_templateId_fingerprint_key"
  ON "inspection_template_versions" ("templateId", "fingerprint");

CREATE UNIQUE INDEX "inspection_template_versions_templateId_version_key"
  ON "inspection_template_versions" ("templateId", "version");

ALTER TABLE "inspection_template_versions"
  ADD CONSTRAINT "inspection_template_versions_count_is_real"
  CHECK ("itemCount" >= 0 AND "version" >= 1);

ALTER TABLE "inspection_template_versions"
  ADD CONSTRAINT "inspection_template_versions_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "inspection_templates" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_template_versions"
  ADD CONSTRAINT "inspection_template_versions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The questions that version asked, frozen.
--
-- Rows rather than a JSON column, because "what did this sheet ask?" is a
-- question somebody will want to ask of the database, and because the whole
-- point is that these never change: nothing in the product updates a row here
-- after it is written. Editing the template writes a new version instead.
CREATE TABLE "inspection_template_version_items" (
  "id"              TEXT NOT NULL,
  "versionId"       TEXT NOT NULL,
  "sectionName"     TEXT NOT NULL,
  "itemName"        TEXT NOT NULL,
  "guidance"        TEXT,
  "measurementType" "MeasurementType" NOT NULL DEFAULT 'NONE',
  "position"        "WheelPosition",
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "inspection_template_version_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_template_version_items_versionId_idx"
  ON "inspection_template_version_items" ("versionId", "sortOrder");

ALTER TABLE "inspection_template_version_items"
  ADD CONSTRAINT "inspection_template_version_items_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "inspection_template_versions" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Which sheet this inspection was taken on.
--
-- Nullable, because every inspection recorded before this phase was taken on a
-- sheet nobody wrote down, and inventing one for them would be claiming to
-- know something nobody knows. An inspection with no version says so, rather
-- than borrowing today's.
ALTER TABLE "inspections" ADD COLUMN "templateVersionId" TEXT;

-- RESTRICT: a version an inspection was taken on is part of that inspection's
-- meaning. Deleting it would leave the report claiming a sheet nobody can
-- produce, which is worse than having no version at all -- at least a null
-- says plainly that it is not known.
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_templateVersionId_fkey"
  FOREIGN KEY ("templateVersionId") REFERENCES "inspection_template_versions" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "inspections_templateVersionId_idx" ON "inspections" ("templateVersionId");
