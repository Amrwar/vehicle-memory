-- The corpus, not the guess. Phase 81.
--
-- ADR-0013 point 4 said fault suggestion was not built, and gave the reason:
-- a service adviser that proposes where to look needs a corpus of symptoms
-- against confirmed causes, that corpus did not exist, and a confident wrong
-- suggestion on a braking fault is not a small error.
--
-- The reason still holds. What changes is the answer to it: build the corpus,
-- out of what technicians actually find, and say nothing until it is large
-- enough to be worth saying. Four tables, and the fourth is the whole point --
-- one row per cause considered on one job, with what the person who had the
-- car in front of them found it to be.
--
-- Nothing here is a model. Everything the product will say about a symptom is
-- a count of `diagnosis_causes` rows, in the workshop reading it, checkable
-- against the jobs it names. ADR-0016.

CREATE TYPE "CauseOutcome" AS ENUM ('CONFIRMED', 'REJECTED', 'UNDETERMINED');

-- A complaint the workshop recognises, in its own words.
--
-- Controlled vocabulary, or nothing ever aggregates: "brake judder", "judder
-- on braking" and "vibrates when I stop" are one symptom written three ways,
-- and counted separately they teach nothing.
CREATE TABLE "symptom_codes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "symptom_codes_pkey" PRIMARY KEY ("id")
);

-- Something a symptom turned out to be. A cause is only meaningful against the
-- complaint it explains: rotor runout answers a judder, not a misfire.
CREATE TABLE "cause_codes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cause_codes_pkey" PRIMARY KEY ("id")
);

-- One job's diagnosis: where it started, and whether it ever settled.
CREATE TABLE "job_diagnoses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "job_diagnoses_pkey" PRIMARY KEY ("id")
);

-- The corpus itself.
--
-- `outcome` is nullable while the diagnosis is still running: a cause on the
-- list nobody has ruled on yet. It counts for nothing until somebody decides,
-- which is the difference between a corpus of findings and a corpus of
-- guesses.
CREATE TABLE "diagnosis_causes" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,
    "outcome" "CauseOutcome",
    "note" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosis_causes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "symptom_codes_orgId_code_key" ON "symptom_codes"("orgId", "code");
CREATE INDEX "cause_codes_symptomId_idx" ON "cause_codes"("symptomId");
CREATE UNIQUE INDEX "cause_codes_orgId_code_key" ON "cause_codes"("orgId", "code");
-- One diagnosis per complaint. A car can arrive with a judder and a warm
-- air conditioner, and those are two diagnoses; what cannot happen is the
-- same complaint diagnosed twice on one visit.
CREATE UNIQUE INDEX "job_diagnoses_jobId_symptomId_key" ON "job_diagnoses"("jobId", "symptomId");
CREATE INDEX "job_diagnoses_orgId_symptomId_idx" ON "job_diagnoses"("orgId", "symptomId");
CREATE INDEX "diagnosis_causes_causeId_outcome_idx" ON "diagnosis_causes"("causeId", "outcome");
CREATE UNIQUE INDEX "diagnosis_causes_diagnosisId_causeId_key" ON "diagnosis_causes"("diagnosisId", "causeId");

ALTER TABLE "symptom_codes" ADD CONSTRAINT "symptom_codes_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cause_codes" ADD CONSTRAINT "cause_codes_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cause_codes" ADD CONSTRAINT "cause_codes_symptomId_fkey"
  FOREIGN KEY ("symptomId") REFERENCES "symptom_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_diagnoses" ADD CONSTRAINT "job_diagnoses_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_diagnoses" ADD CONSTRAINT "job_diagnoses_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A symptom somebody has diagnosed against cannot be deleted, and neither can
-- a cause somebody has ruled on. The catalogue is retired by `isActive`
-- instead. Deleting one would not remove the history -- it would remove the
-- word for it, leaving counts nobody can read. The same lesson as Phase 72,
-- where deleting a workshop silently rewrote every passport entry it wrote.
ALTER TABLE "job_diagnoses" ADD CONSTRAINT "job_diagnoses_symptomId_fkey"
  FOREIGN KEY ("symptomId") REFERENCES "symptom_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diagnosis_causes" ADD CONSTRAINT "diagnosis_causes_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "job_diagnoses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnosis_causes" ADD CONSTRAINT "diagnosis_causes_causeId_fkey"
  FOREIGN KEY ("causeId") REFERENCES "cause_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Who decided, kept as a soft link. A person who leaves the trade does not
-- take the finding with them: the count is the workshop's, not theirs.
ALTER TABLE "diagnosis_causes" ADD CONSTRAINT "diagnosis_causes_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A verdict has a time and a person, or it has neither. A row that says
-- CONFIRMED with nobody against it is a finding nobody made.
ALTER TABLE "diagnosis_causes" ADD CONSTRAINT "diagnosis_causes_verdict_is_witnessed"
  CHECK (("outcome" IS NULL) = ("decidedAt" IS NULL));
