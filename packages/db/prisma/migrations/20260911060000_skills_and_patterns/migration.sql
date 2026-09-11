-- Skills, and when people are actually here. Phase 12.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('LEARNING', 'COMPETENT', 'EXPERT');

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL DEFAULT 'COMPETENT',
    "assessedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_type_skills" (
    "id" TEXT NOT NULL,
    "jobTypeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "minimumLevel" "SkillLevel" NOT NULL DEFAULT 'COMPETENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_type_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_patterns" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "working_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skills_orgId_isActive_idx" ON "skills"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "skills_orgId_name_key" ON "skills"("orgId", "name");

-- CreateIndex
CREATE INDEX "employee_skills_skillId_level_idx" ON "employee_skills"("skillId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_employeeId_skillId_key" ON "employee_skills"("employeeId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "job_type_skills_jobTypeId_skillId_key" ON "job_type_skills"("jobTypeId", "skillId");

-- CreateIndex
CREATE INDEX "working_patterns_orgId_weekday_idx" ON "working_patterns"("orgId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "working_patterns_employeeId_weekday_key" ON "working_patterns"("employeeId", "weekday");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_type_skills" ADD CONSTRAINT "job_type_skills_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "job_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_type_skills" ADD CONSTRAINT "job_type_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_patterns" ADD CONSTRAINT "working_patterns_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_patterns" ADD CONSTRAINT "working_patterns_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

