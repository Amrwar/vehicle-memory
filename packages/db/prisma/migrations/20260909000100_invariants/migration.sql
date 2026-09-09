-- ---------------------------------------------------------------------------
-- Domain invariants that the Prisma schema language cannot express.
--
-- These are enforced in the database rather than only in application code,
-- because an invariant that lives solely in the application is an invariant
-- that a future migration script, a support query or a second service will
-- eventually violate.
--
-- Referenced from docs/02-design/01-domain-model.md section 3.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- V5: a vehicle has at most one open ownership at a time.
-- Prisma cannot express a partial unique index.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "vehicle_ownerships_one_open_per_vehicle"
  ON "vehicle_ownerships" ("vehicleId")
  WHERE "endedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- J5: a technician has at most one open time entry across all jobs.
-- Without this, a tablet left logged in double-counts labour cost.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "time_entries_one_open_per_user"
  ON "time_entries" ("userId")
  WHERE "endedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- V2: vehicle events are append-only. No UPDATE, no DELETE, ever.
--
-- This is the guarantee the whole passport rests on. If it can be quietly
-- edited it is not evidence, and a buyer cannot rely on it. Enforcing it with
-- a trigger means it holds even for a direct psql session.
--
-- The one permitted mutation is setting supersededById on an existing event
-- when a correction is appended, because the correction has to point both
-- ways. Everything else is refused.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION carnet_vehicle_events_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION
      'vehicle_events is append-only: DELETE is not permitted (event %)', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Allow only the supersededById back-reference to be filled in, once.
    IF (OLD."supersededById" IS NOT NULL) THEN
      RAISE EXCEPTION
        'vehicle_events is append-only: event % is already superseded', OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF ( NEW."id"           IS DISTINCT FROM OLD."id"
      OR NEW."vehicleId"    IS DISTINCT FROM OLD."vehicleId"
      OR NEW."sequence"     IS DISTINCT FROM OLD."sequence"
      OR NEW."type"         IS DISTINCT FROM OLD."type"
      OR NEW."occurredAt"   IS DISTINCT FROM OLD."occurredAt"
      OR NEW."recordedAt"   IS DISTINCT FROM OLD."recordedAt"
      OR NEW."verification" IS DISTINCT FROM OLD."verification"
      OR NEW."title"        IS DISTINCT FROM OLD."title"
      OR NEW."summary"      IS DISTINCT FROM OLD."summary"
      OR NEW."payload"::text IS DISTINCT FROM OLD."payload"::text
      OR NEW."odometerKm"   IS DISTINCT FROM OLD."odometerKm"
      OR NEW."hash"         IS DISTINCT FROM OLD."hash"
      OR NEW."prevHash"     IS DISTINCT FROM OLD."prevHash"
      OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId"
    ) THEN
      RAISE EXCEPTION
        'vehicle_events is append-only: only supersededById may be set (event %)', OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "vehicle_events_append_only"
  BEFORE UPDATE OR DELETE ON "vehicle_events"
  FOR EACH ROW EXECUTE FUNCTION carnet_vehicle_events_append_only();

-- ---------------------------------------------------------------------------
-- The audit log is likewise immutable. FR-109.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION carnet_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION carnet_audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- I3: payments may never exceed the invoice total.
-- Enforced with a constraint trigger so it is checked at statement end,
-- allowing multi-row inserts within one transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION carnet_payments_within_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_total   NUMERIC(12,2);
  v_paid    NUMERIC(12,2);
BEGIN
  IF (NEW."invoiceId" IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT "total" INTO v_total FROM "invoices" WHERE "id" = NEW."invoiceId";
  SELECT COALESCE(SUM("amount"), 0) INTO v_paid
    FROM "payments" WHERE "invoiceId" = NEW."invoiceId";

  IF (v_paid > v_total) THEN
    RAISE EXCEPTION
      'payments (%) exceed invoice total (%) for invoice %', v_paid, v_total, NEW."invoiceId"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "payments_within_invoice_total"
  AFTER INSERT OR UPDATE ON "payments"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION carnet_payments_within_invoice_total();

-- ---------------------------------------------------------------------------
-- FR-1202: a journal entry must balance. Checked at commit, because the lines
-- are inserted one at a time and only the completed set can balance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION carnet_journal_entry_balances()
RETURNS TRIGGER AS $$
DECLARE
  v_debit  NUMERIC(14,2);
  v_credit NUMERIC(14,2);
  v_entry  TEXT;
BEGIN
  v_entry := COALESCE(NEW."entryId", OLD."entryId");

  SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0)
    INTO v_debit, v_credit
    FROM "journal_lines" WHERE "entryId" = v_entry;

  IF (v_debit <> v_credit) THEN
    RAISE EXCEPTION
      'journal entry % does not balance: debits % <> credits %', v_entry, v_debit, v_credit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "journal_lines_balance"
  AFTER INSERT OR UPDATE OR DELETE ON "journal_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION carnet_journal_entry_balances();

-- A journal line is a debit or a credit, never both and never neither.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_debit_xor_credit"
  CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));

-- ---------------------------------------------------------------------------
-- Value constraints that stop nonsense at the door.
-- ---------------------------------------------------------------------------
ALTER TABLE "odometer_readings"
  ADD CONSTRAINT "odometer_readings_km_nonnegative" CHECK ("km" >= 0);

ALTER TABLE "vehicle_events"
  ADD CONSTRAINT "vehicle_events_sequence_positive" CHECK ("sequence" >= 1);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_end_after_start" CHECK ("endAt" > "startAt");

ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_end_after_start"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "stock_levels"
  ADD CONSTRAINT "stock_levels_reserved_nonnegative" CHECK ("reserved" >= 0);

ALTER TABLE "fiscal_periods"
  ADD CONSTRAINT "fiscal_periods_end_after_start" CHECK ("endsAt" > "startsAt");

-- ---------------------------------------------------------------------------
-- Search support. Customers are looked up by name and phone constantly, and
-- a service advisor is on the phone while they do it (NFR-102).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "customers_display_name_trgm"
  ON "customers" USING gin ("displayName" gin_trgm_ops);

CREATE INDEX "vehicles_registration_trgm"
  ON "vehicles" USING gin ("registration" gin_trgm_ops);

CREATE INDEX "vehicles_vin_trgm"
  ON "vehicles" USING gin ("vin" gin_trgm_ops);
