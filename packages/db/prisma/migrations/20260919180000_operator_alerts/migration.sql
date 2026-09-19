-- What the operator has already been told. Phase 57.
--
-- One row per signal, not one per alert. The question this table answers is
-- "does this still need saying?", and a table of every message ever sent
-- answers that question slowly and wrongly: a signal broken for a week would
-- be a hundred and sixty-eight rows to read through in order to learn one
-- thing about the present.
--
-- `sentAt` is when a message actually went, which is deliberately not the same
-- as when the row was written. A signal seen and recorded but never sent —
-- because the operator's mailbox was unreachable, or because nobody is the
-- operator on this deployment — must still send when it can, and the two
-- columns are what make that difference visible.

CREATE TABLE "operator_alerts" (
  "id"        TEXT PRIMARY KEY,
  -- The signal's name as the health page reports it, which is also how the
  -- runbook is found. Unique: one row per thing that can go wrong.
  "key"       TEXT        NOT NULL,
  "standing"  TEXT        NOT NULL,
  -- When it first went wrong, kept across repeats so a message can say how
  -- long this has been going on.
  "raisedAt"  TIMESTAMPTZ NOT NULL,
  "sentAt"    TIMESTAMPTZ,
  "clearedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "operator_alerts_key" ON "operator_alerts"("key");
