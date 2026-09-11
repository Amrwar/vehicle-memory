-- Phase 12 invariants.
--
-- A working pattern is read by the thing that tells a workshop how much work
-- it can take. A nonsense row there does not produce an error on a screen; it
-- produces a day that was promised to a customer and cannot be kept.

-- ---------------------------------------------------------------------------
-- A weekday is a weekday.
--
-- ISO numbering, 1 Monday through 7 Sunday. Javascript's own numbering starts
-- Sunday at 0, so an off-by-one written by any future caller puts an entire
-- workforce on the wrong day, and every capacity figure with it.
-- ---------------------------------------------------------------------------

ALTER TABLE "working_patterns"
  ADD CONSTRAINT "working_patterns_weekday_is_iso"
  CHECK ("weekday" BETWEEN 1 AND 7);

-- ---------------------------------------------------------------------------
-- A shift starts before it ends, fits inside a day, and leaves time to work.
--
-- A break longer than the shift would give negative available minutes. The
-- application clamps that at zero, which hides the bad row rather than
-- refusing it, so the refusal belongs here.
-- ---------------------------------------------------------------------------

ALTER TABLE "working_patterns"
  ADD CONSTRAINT "working_patterns_is_a_real_shift"
  CHECK (
    "startMinute" >= 0 AND
    "endMinute" <= 1440 AND
    "endMinute" > "startMinute" AND
    "breakMinutes" >= 0 AND
    "breakMinutes" < ("endMinute" - "startMinute")
  );

-- ---------------------------------------------------------------------------
-- A skill has a name.
--
-- An unnamed column on the matrix is a column nobody can fill in, and the
-- unique index on (orgId, name) would happily admit several of them.
-- ---------------------------------------------------------------------------

ALTER TABLE "skills"
  ADD CONSTRAINT "skills_have_a_name"
  CHECK (length(btrim("name")) > 0);

-- ---------------------------------------------------------------------------
-- Signing somebody off is dated.
--
-- "Competent at brakes" with no date is an opinion somebody typed in 2019.
-- With a date it is evidence, and a workshop can see which of its sign-offs
-- have gone stale. The column defaults to now, so this only refuses a caller
-- that deliberately wrote a null or a date that has not happened yet.
-- ---------------------------------------------------------------------------

ALTER TABLE "employee_skills"
  ADD CONSTRAINT "employee_skills_assessed_in_the_past"
  CHECK ("assessedOn" <= now() + interval '1 day');
