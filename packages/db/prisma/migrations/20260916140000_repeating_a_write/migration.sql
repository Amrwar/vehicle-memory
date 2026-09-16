-- Doing it twice. Phase 46.
--
-- Two places in the product said a thing happened once and were relying on
-- having looked first. Looking first is not a guarantee: two requests that
-- look at the same moment both see nothing, and both go ahead. It is the
-- commonest way a customer ends up with double points, and it only happens
-- under the load that makes it hardest to reproduce.
--
-- The key says what an entry is the one-and-only of. Entries that may
-- honestly repeat — points spent, points lapsing, an adjustment somebody made
-- twice on purpose — carry no key and are not constrained.

ALTER TABLE "loyalty_entries" ADD COLUMN IF NOT EXISTS "once" TEXT;

-- Partial, so the column is a guarantee where it is filled in and silent
-- where it is not.
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_entries_once_key"
  ON "loyalty_entries" ("orgId", "once")
  WHERE "once" IS NOT NULL;

-- Whatever is already there gets its key, so the guarantee covers the rows
-- written before it existed rather than only the ones written after.
UPDATE "loyalty_entries" e
SET "once" = 'invoice:' || i."id" || ':paid'
FROM "invoices" i
WHERE e."orgId" = i."orgId"
  AND e."reason" = 'Invoice ' || i."number" || ' paid'
  AND e."once" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "loyalty_entries" x
    WHERE x."orgId" = e."orgId"
      AND x."once" = 'invoice:' || i."id" || ':paid'
  );
