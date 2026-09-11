-- Actions a device recorded with no signal. Phase 14.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateTable
CREATE TABLE "synced_actions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synced_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "synced_actions_orgId_appliedAt_idx" ON "synced_actions"("orgId", "appliedAt");

-- CreateIndex
CREATE INDEX "synced_actions_subjectId_idx" ON "synced_actions"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "synced_actions_orgId_clientId_key" ON "synced_actions"("orgId", "clientId");

-- AddForeignKey
ALTER TABLE "synced_actions" ADD CONSTRAINT "synced_actions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synced_actions" ADD CONSTRAINT "synced_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- A device id is a device id.
--
-- The whole point of this table is that a retry is recognised. A blank or
-- trivially short id would collide with every other blank one and make an
-- unrelated action read as a duplicate, which loses work silently: the worst
-- possible failure for a feature whose promise is that nothing is lost.
-- ---------------------------------------------------------------------------

ALTER TABLE "synced_actions"
  ADD CONSTRAINT "synced_actions_have_a_device_id"
  CHECK (length(btrim("clientId")) >= 8 AND length(btrim("type")) > 0 AND length(btrim("subjectId")) > 0);

-- Recorded before it was applied, give or take a device clock running fast.
-- An action that claims to have happened after it arrived is a clock nobody
-- should be putting on a timesheet.
ALTER TABLE "synced_actions"
  ADD CONSTRAINT "synced_actions_recorded_before_applied"
  CHECK ("recordedAt" <= "appliedAt" + interval '1 hour');
