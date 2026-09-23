-- Follow-up flags, made usable. Phase 66. FR-617.
--
-- `job_follow_ups` has been in the schema since the first migration and no
-- code has ever read from it or written to it. Building the feature on it
-- turned up three things the table needed before it could carry one.
--
-- An index on the job. Every other child of a job has one; this table has an
-- index on (dueAt, completedAt) and nothing else, so the query a job's own
-- page makes — give me this job's follow-ups — was a sequential scan of every
-- follow-up in the database. It has never been slow because there have never
-- been any.
--
-- An index on the assignee. "What am I supposed to be chasing" is the second
-- question anybody asks of this feature, and the answer is a filter on a
-- column with nothing behind it.
--
-- And who ticked it off. The table recorded that something was done and not
-- who did it, which is the one question a workshop asks when a customer says
-- nobody rang them. `completedAt` without `completedByUserId` is an assertion
-- with nobody behind it.

CREATE INDEX "job_follow_ups_jobId_idx" ON "job_follow_ups"("jobId");

CREATE INDEX "job_follow_ups_assignedToUserId_completedAt_idx"
  ON "job_follow_ups"("assignedToUserId", "completedAt");

ALTER TABLE "job_follow_ups" ADD COLUMN "completedByUserId" TEXT;

ALTER TABLE "job_follow_ups"
  ADD CONSTRAINT "job_follow_ups_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Done, or not done. A row saying it was completed by nobody at no time is
-- half a record, and a row naming somebody who completed nothing is worse:
-- it is evidence of a call that was never made.
ALTER TABLE "job_follow_ups"
  ADD CONSTRAINT "job_follow_ups_done_is_whole"
  CHECK (
    ("completedAt" IS NULL AND "completedByUserId" IS NULL)
    OR ("completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL)
  );
