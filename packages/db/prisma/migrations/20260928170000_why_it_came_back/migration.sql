-- Why it came back. Phase 86.
--
-- The product has counted comebacks since Phase 26 and linked each to the job
-- it came back from. That answers "how often", which is the number an owner
-- quotes and the least useful thing about it. Twelve comebacks tells you
-- nothing you can act on; four of them being the same part tells you
-- everything.
--
-- Seven causes, because they are the seven different things a workshop would
-- do about it: retrain, claim from the supplier, look at the workmanship, mend
-- the checklist, say plainly that it was not our doing, note it was a
-- different fault, or admit nobody established it.
--
-- Nullable, and stays nullable. A comeback is recorded the moment somebody
-- notices, with nothing filled in, because a form that demands a cause before
-- it will save is a form that gets abandoned -- and then the comeback is not
-- recorded at all, which is the only outcome worse than an unclassified one.
CREATE TYPE "ComebackCause" AS ENUM (
  'INCORRECT_DIAGNOSIS',
  'DEFECTIVE_PART',
  'INSTALLATION',
  'MISSED_IN_INSPECTION',
  'CUSTOMER_MISUSE',
  'UNRELATED',
  'UNKNOWN'
);

ALTER TABLE "jobs" ADD COLUMN "comebackCause" "ComebackCause";

-- A cause on a job that is not a comeback is a cause for nothing. The column
-- and the link stand or fall together.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_comeback_cause_needs_a_comeback"
  CHECK ("comebackCause" IS NULL OR "comebackOfJobId" IS NOT NULL);
