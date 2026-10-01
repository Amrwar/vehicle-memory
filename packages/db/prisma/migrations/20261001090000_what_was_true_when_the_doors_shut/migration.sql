-- What was true when the doors shut. Phase 96.
--
-- The product can already answer every question an end-of-day close asks. It
-- knows the till was never counted, that Marek is still clocked on, that two
-- sets of keys are in somebody's pocket, that four cars are on the forecourt.
-- What it cannot say is whether anybody looked, and what they saw.
--
-- That is the whole of this table. Not a new fact about the workshop -- a fact
-- about an act: at 18:04 on 1 October, Ahmed closed the day, and these were
-- the answers at that moment.
--
-- Which forces the one decision worth arguing about. ADR-0011 says totals are
-- derived and never stored, and every screen in this product obeys it. A close
-- does not, and ADR-0020 is why: a close is testimony about a moment, like a
-- passport entry, not a running total. An invoice paid at twenty to seven must
-- not quietly rewrite what was true at four minutes past. A derived close
-- would say something different every time it was read, and would therefore be
-- evidence of nothing -- while still looking exactly like evidence, which is
-- the dangerous part.
--
-- So the figures are copied in, and then nothing may touch them. The triggers
-- at the bottom are not belt and braces; they are the only thing that makes
-- the record worth keeping.

-- The ten readings, as the database knows them.
--
-- An enum rather than free text, because the close must be complete to mean
-- anything -- all ten answered or none -- and a typo'd kind would make a close
-- that looks whole and has a hole in it. The names are the ones the rules
-- module uses, so a reading cannot be renamed on one side only.
CREATE TYPE "CloseReading" AS ENUM (
  'TILL',
  'CLOCKED_ON',
  'KEYS',
  'CARS_ON_SITE',
  'OPEN_JOBS',
  'UNPAID_INVOICES',
  'ESTIMATES_WAITING',
  'PARTS_LATE',
  'BANK_UNMATCHED',
  'FOLLOW_UPS_DUE'
);

CREATE TABLE "day_closes" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,

  -- The site, because a group closes each of its workshops separately and a
  -- close that covered all of them would say nothing true about any of them.
  "locationId" TEXT NOT NULL,

  -- The workshop's own calendar date, as a DATE and not a timestamp.
  --
  -- A date because that is what is being claimed: the day is closed, not an
  -- instant. The instant is `closedAt` below, and the two genuinely differ --
  -- a garage locking up at one in the morning is closing the day that ended,
  -- which is the rule `businessDay()` holds and this column records the
  -- result of.
  "on"         DATE NOT NULL,

  -- When somebody actually pressed it, and who. Both required: a close with no
  -- name on it is an assertion nobody made, and the value of the record is
  -- precisely that a person made it.
  "closedAt"       TIMESTAMPTZ(3) NOT NULL,
  "closedByUserId" TEXT NOT NULL,

  -- What they wanted said about the night. Optional, and most nights empty --
  -- but the one night the keys were with the valeter rather than lost is the
  -- night somebody needs to have been able to write it down.
  "note"       TEXT,

  CONSTRAINT "day_closes_pkey" PRIMARY KEY ("id")
);

-- One close per site per day.
--
-- Not an arbitrary tidiness. Two closes for one day make the record ambiguous
-- in the worst possible way -- a reader cannot tell which one was the day's
-- real state -- and the interesting case, somebody closing too early, is
-- better served by a refusal that names who closed it and when than by a
-- second row quietly overwriting the first.
CREATE UNIQUE INDEX "day_closes_orgId_locationId_on_key"
  ON "day_closes" ("orgId", "locationId", "on");

CREATE INDEX "day_closes_orgId_on_idx" ON "day_closes" ("orgId", "on" DESC);

ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT on both: a close names a site and a person, and deleting either
-- would leave testimony signed by nobody about nowhere. A workshop that closes
-- a site keeps its history -- that is what Phase 60 settled for the passport
-- and the same argument holds here.
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A note is a note or it is absent. An empty string is somebody's finger on
-- the keyboard, and it reads later as "they wrote something and it is gone".
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_note_says_something"
  CHECK ("note" IS NULL OR length(btrim("note")) >= 2);

CREATE TABLE "day_close_readings" (
  "id"      TEXT NOT NULL,
  "closeId" TEXT NOT NULL,
  "kind"    "CloseReading" NOT NULL,

  -- How many, as the figure stood. Nought is a real answer and the commonest
  -- one worth having: "the till was counted and balanced" is a different fact
  -- from "nobody asked about the till", and only a stored nought can tell them
  -- apart afterwards.
  "count"   INTEGER NOT NULL,

  -- Whether this was one of the three that should not be left overnight, as
  -- judged on the night.
  --
  -- Stored rather than derived from `kind`, because the judgement may change.
  -- If a later phase decides a car left on site overnight is worth waking
  -- somebody for, every close ever taken would silently change its mind about
  -- nights nobody can revisit. What the workshop was told at the time is part
  -- of what happened.
  "leftOvernight" BOOLEAN NOT NULL,

  CONSTRAINT "day_close_readings_pkey" PRIMARY KEY ("id")
);

-- Each reading answered once per close.
CREATE UNIQUE INDEX "day_close_readings_closeId_kind_key"
  ON "day_close_readings" ("closeId", "kind");

ALTER TABLE "day_close_readings" ADD CONSTRAINT "day_close_readings_closeId_fkey"
  FOREIGN KEY ("closeId") REFERENCES "day_closes" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A count is a count of things.
ALTER TABLE "day_close_readings" ADD CONSTRAINT "day_close_readings_count_is_a_count"
  CHECK ("count" >= 0);

-- A close is testimony, so it cannot be edited.
--
-- Everything above is a rule about writing one well. This is the rule that
-- makes it worth anything: a record somebody can go back and tidy is a record
-- of what they wished had been true. `audit_logs` has been immutable since
-- Phase 0.9 for the same reason, and this follows it exactly rather than
-- inventing a softer version.
--
-- There is deliberately no exception for the note. A close written in haste
-- with the wrong note is a close with the wrong note, and the honest remedy is
-- that tomorrow's close says so -- not that last night's quietly becomes
-- something else.
CREATE OR REPLACE FUNCTION carnet_day_closes_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'day_closes is a record of a moment: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "day_closes_immutable"
  BEFORE UPDATE OR DELETE ON "day_closes"
  FOR EACH ROW EXECUTE FUNCTION carnet_day_closes_immutable();

-- The readings are the testimony. They go the same way.
--
-- DELETE is permitted for exactly one reason and it is not a loophole: the
-- foreign key above cascades from `day_closes`, and `day_closes` can never be
-- deleted, so the only cascade that can ever fire is the one from dropping an
-- organisation entirely -- which takes the whole workshop with it and is the
-- erasure path Phase 31 built deliberately.
CREATE OR REPLACE FUNCTION carnet_day_close_readings_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'day_close_readings is a record of a moment: UPDATE is not permitted'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "day_close_readings_immutable"
  BEFORE UPDATE ON "day_close_readings"
  FOR EACH ROW EXECUTE FUNCTION carnet_day_close_readings_immutable();
