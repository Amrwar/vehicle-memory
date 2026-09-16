-- One posting per source document. Phase 46.
--
-- Every money function in this product posts to the ledger outside the
-- transaction that wrote the thing it describes. That is deliberate and it is
-- right: a ledger having a bad second must not undo a payment somebody has
-- already handed over, and the comment above each of those calls says so —
-- "the ledger is idempotent on the source document, so a retry cannot
-- double-post".
--
-- It was not. The check was a read followed by a write with a gap between
-- them, and the retries that make the design safe are exactly the thing that
-- arrives twice at once: a worker restarted after a crash, a scheduler firing
-- while the last run is still going, a deploy landing mid-batch. Both reads
-- find nothing and both post, and the accounts are then wrong by exactly one
-- invoice in a way nobody notices until a period is reconciled.
--
-- This is the sentence, enforced.

-- Any duplicates already posted are collapsed before the index goes on, newest
-- first, so the entry that survives is the one the rest of the books point at.
DELETE FROM "journal_lines" WHERE "entryId" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "orgId", "sourceType", "sourceId", "reference"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS seen
    FROM "journal_entries"
  ) ranked WHERE ranked.seen > 1
);

DELETE FROM "journal_entries" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "orgId", "sourceType", "sourceId", "reference"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS seen
    FROM "journal_entries"
  ) ranked WHERE ranked.seen > 1
);

CREATE UNIQUE INDEX "journal_entries_one_per_document"
  ON "journal_entries" ("orgId", "sourceType", "sourceId", "reference");
