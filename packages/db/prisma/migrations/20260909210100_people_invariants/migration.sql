-- Phase 4 invariants.
--
-- The rules below are the ones the application must not be the only thing
-- enforcing. Anything that decides what a person is paid, or where a box of
-- parts is, has to hold even when a script, a migration or a future bug goes
-- around the domain layer.

-- ---------------------------------------------------------------------------
-- Attendance: one open shift per person.
--
-- Two open records means the person is on site twice, and every hours figure
-- built on them double counts. Partial unique index rather than a trigger,
-- so the database refuses the insert rather than reporting it later.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "attendance_one_open_per_employee"
  ON "attendance_records" ("employeeId")
  WHERE "endedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- Pay rates: exactly one in force, and no two covering the same day.
--
-- The second constraint is the load-bearing one. Overlapping rates mean an
-- hour has two costs and whichever the query happens to return first becomes
-- the answer, which produces a number rather than a complaint. An exclusion
-- constraint over the date range is the only way to state this properly.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX "pay_rates_one_open_per_employee"
  ON "pay_rates" ("employeeId")
  WHERE "effectiveTo" IS NULL;

ALTER TABLE "pay_rates"
  ADD CONSTRAINT "pay_rates_no_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange(
      "effectiveFrom"::date,
      COALESCE("effectiveTo"::date, 'infinity'::date),
      '[)'
    ) WITH &&
  );

ALTER TABLE "pay_rates"
  ADD CONSTRAINT "pay_rates_forwards"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "pay_rates"
  ADD CONSTRAINT "pay_rates_not_negative"
  CHECK ("costPerHour" >= 0 AND "chargePerHour" >= 0);

-- ---------------------------------------------------------------------------
-- Timesheets: a paid one stops moving.
--
-- Payroll is the one place where "somebody edited it afterwards" is not a
-- recoverable situation. A correction is an adjustment on the next period.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carnet_timesheets_paid_are_final()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'PAID' THEN
    RAISE EXCEPTION
      'timesheet % has been paid: correct it with an adjustment on the next period, not by editing this one',
      OLD."id"
    USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timesheets_paid_are_final
  BEFORE UPDATE OR DELETE ON "timesheets"
  FOR EACH ROW
  EXECUTE FUNCTION carnet_timesheets_paid_are_final();

ALTER TABLE "timesheets"
  ADD CONSTRAINT "timesheets_period_forwards"
  CHECK ("periodEnd" > "periodStart");

ALTER TABLE "timesheets"
  ADD CONSTRAINT "timesheets_minutes_not_negative"
  CHECK ("ordinaryMinutes" >= 0 AND "overtimeMinutes" >= 0 AND "absenceMinutes" >= 0);

-- ---------------------------------------------------------------------------
-- Absence
-- ---------------------------------------------------------------------------

ALTER TABLE "absences"
  ADD CONSTRAINT "absences_forwards"
  CHECK ("endsOn" >= "startsOn");

ALTER TABLE "absences"
  ADD CONSTRAINT "absences_days_positive"
  CHECK ("days" > 0);

-- ---------------------------------------------------------------------------
-- Commission: a scheme can never take money back.
-- ---------------------------------------------------------------------------

ALTER TABLE "commission_bands"
  ADD CONSTRAINT "commission_bands_rate_not_negative"
  CHECK ("rate" >= 0);

ALTER TABLE "commission_schemes"
  ADD CONSTRAINT "commission_schemes_threshold_not_negative"
  CHECK ("threshold" >= 0 AND "guarantee" >= 0);

-- ---------------------------------------------------------------------------
-- Stock transfer
--
-- Over-receipt is refused at the table, not merely in the service layer.
-- Booking in more than was sent means the paperwork or the van is wrong, and
-- accepting the larger number destroys the evidence that something went
-- missing somewhere else.
-- ---------------------------------------------------------------------------

ALTER TABLE "stock_transfers"
  ADD CONSTRAINT "stock_transfers_two_sites"
  CHECK ("fromWarehouseId" <> "toWarehouseId");

ALTER TABLE "stock_transfer_lines"
  ADD CONSTRAINT "stock_transfer_lines_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "stock_transfer_lines"
  ADD CONSTRAINT "stock_transfer_lines_no_over_receipt"
  CHECK ("received" >= 0 AND "received" <= "quantity");

-- ---------------------------------------------------------------------------
-- A transfer that has left must record when.
--
-- Otherwise "in transit since when" has no answer, and a box that never
-- arrived is indistinguishable from one that left this morning.
-- ---------------------------------------------------------------------------

ALTER TABLE "stock_transfers"
  ADD CONSTRAINT "stock_transfers_dispatch_recorded"
  CHECK (
    "status" IN ('DRAFT', 'CANCELLED')
    OR "dispatchedAt" IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Employment
-- ---------------------------------------------------------------------------

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_employment_forwards"
  CHECK ("endedOn" IS NULL OR "endedOn" >= "startedOn");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_weekly_minutes_sane"
  CHECK ("weeklyMinutes" > 0 AND "weeklyMinutes" <= 10080);
