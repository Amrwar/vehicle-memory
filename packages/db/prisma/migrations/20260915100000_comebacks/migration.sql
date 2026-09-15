-- The owner's day, sharpened. Phase 40.
--
-- A job recorded as earlier work on the same car coming back: which job,
-- what came back, who said so and when. The comeback rate is read from
-- these; the reason is required, and a job cannot be its own comeback.

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "comebackOfJobId" TEXT,
ADD COLUMN "comebackReason" TEXT,
ADD COLUMN "comebackMarkedAt" TIMESTAMP(3),
ADD COLUMN "comebackMarkedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "jobs_comebackOfJobId_idx" ON "jobs"("comebackOfJobId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_comebackOfJobId_fkey" FOREIGN KEY ("comebackOfJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_comebackMarkedByUserId_fkey" FOREIGN KEY ("comebackMarkedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A comeback says what came back, and is never the job itself.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_comeback_reason_check"
  CHECK ("comebackOfJobId" IS NULL OR (length(btrim(coalesce("comebackReason", ''))) >= 3 AND "comebackOfJobId" <> "id"));
