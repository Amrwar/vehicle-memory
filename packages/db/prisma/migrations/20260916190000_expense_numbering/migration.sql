-- Expenses get a counter of their own. Phase 46.
--
-- An expense's reference was worked out by counting the expenses already
-- there and adding one. That is wrong twice over. Two people recording a
-- receipt at the same moment count the same number and collide outright, so
-- one of them is told the claim failed for no reason they can see. And a
-- single person recording the same receipt twice gets a *different* number
-- the second time — because the count has moved — so the unique index that
-- exists to catch exactly that never fires.
--
-- A sequence is what every other numbered document here uses, and it is
-- taken inside the transaction that writes the row.

ALTER TYPE "SequenceKind" ADD VALUE IF NOT EXISTS 'EXPENSE';
