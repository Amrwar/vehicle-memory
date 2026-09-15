-- Providers. Phase 43.
--
-- A VIN decoder, a fitment feed and a review site behind seams; bonuses and
-- deductions on a timesheet; the overtime multiplier and the payroll file a
-- workshop hands over, as settings rather than constants.

-- CreateEnum
CREATE TYPE "PayAdjustmentKind" AS ENUM ('BONUS', 'DEDUCTION');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "overtimeMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
ADD COLUMN "payrollExportFormat" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN "googlePlaceId" TEXT;

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_overtime_multiplier_check"
  CHECK ("overtimeMultiplier" >= 1 AND "overtimeMultiplier" <= 3);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_payroll_export_format_check"
  CHECK ("payrollExportFormat" IN ('standard', 'hours', 'elements'));
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_google_place_id_check"
  CHECK ("googlePlaceId" IS NULL OR "googlePlaceId" ~ '^[A-Za-z0-9_-]{16,255}$');

-- AlterTable
ALTER TABLE "part_fitments" ADD COLUMN "feedName" TEXT,
ADD COLUMN "fetchedAt" TIMESTAMP(3);

-- A row a feed wrote says when it was fetched; a row somebody typed does not.
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_feed_check"
  CHECK (("feedName" IS NULL) = ("fetchedAt" IS NULL));

-- CreateTable
CREATE TABLE "pay_adjustments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "kind" "PayAdjustmentKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_adjustments_amount_check" CHECK ("amount" > 0 AND "amount" <= 100000),
    CONSTRAINT "pay_adjustments_label_check" CHECK (length(btrim("label")) BETWEEN 2 AND 80)
);

-- CreateTable
CREATE TABLE "vin_decodes" (
    "vin" TEXT NOT NULL,
    "decoder" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "engine" TEXT,
    "fuel" TEXT,
    "body" TEXT,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vin_decodes_pkey" PRIMARY KEY ("vin"),
    CONSTRAINT "vin_decodes_vin_check" CHECK ("vin" ~ '^[A-HJ-NPR-Z0-9]{17}$')
);

-- CreateIndex
CREATE INDEX "pay_adjustments_timesheetId_idx" ON "pay_adjustments"("timesheetId");
CREATE INDEX "pay_adjustments_orgId_idx" ON "pay_adjustments"("orgId");

-- AddForeignKey
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Once a run has taken a sheet, its bonuses and deductions are in a file that
-- has left the building. Changing them here would be a figure payroll never saw.
CREATE OR REPLACE FUNCTION pay_adjustments_locked() RETURNS trigger AS $$
DECLARE
  sheet_id TEXT := COALESCE(NEW."timesheetId", OLD."timesheetId");
BEGIN
  IF EXISTS (
    SELECT 1 FROM "timesheets"
    WHERE "id" = sheet_id AND ("payrollRunId" IS NOT NULL OR "status" IN ('OPEN', 'PAID'))
  ) THEN
    RAISE EXCEPTION 'pay_adjustments: the timesheet has been handed to payroll';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pay_adjustments_lock BEFORE INSERT OR UPDATE OR DELETE ON "pay_adjustments"
  FOR EACH ROW EXECUTE FUNCTION pay_adjustments_locked();

-- A timesheet that has not been paid can be deleted. The trigger that keeps a
-- paid one final returned NEW on a delete, which is null, so every delete was
-- silently skipped, including the cascade when a workshop is removed.
CREATE OR REPLACE FUNCTION carnet_timesheets_paid_are_final()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'PAID' THEN
    RAISE EXCEPTION
      'timesheet % has been paid: correct it with an adjustment on the next period, not by editing this one',
      OLD."id"
    USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
