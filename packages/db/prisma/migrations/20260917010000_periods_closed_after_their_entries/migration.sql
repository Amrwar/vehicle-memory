-- A period cannot have been closed before the rows inside it were written. Phase 47.
--
-- The seed stamped `closedAt` with the end of the quarter while creating every
-- row in that quarter today, which reads — correctly — as somebody posting into
-- books that had already been reported on. The books audit says so on sight,
-- and it is right to: an entry created after the close is exactly the thing
-- that check exists to find.
--
-- The honest repair is not to hide the entries but to date the close properly.
-- A workshop writes its books and then signs them off, so the earliest a period
-- can have been closed is the moment its last entry was written. Any period
-- whose rows all pre-date its close is left exactly as it is.

UPDATE "fiscal_periods" p
SET "closedAt" = latest."writtenAt"
FROM (
  SELECT
    fp."id" AS "periodId",
    MAX(je."createdAt") AS "writtenAt"
  FROM "fiscal_periods" fp
  JOIN "journal_entries" je
    ON je."orgId" = fp."orgId"
   AND je."postedAt" >= fp."startsAt"
   AND je."postedAt" <= fp."endsAt"
  WHERE fp."isClosed" = true
    AND fp."closedAt" IS NOT NULL
    AND je."createdAt" > fp."closedAt"
  GROUP BY fp."id"
) AS latest
WHERE p."id" = latest."periodId";
