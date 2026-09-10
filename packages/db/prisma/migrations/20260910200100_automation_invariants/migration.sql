-- Phase 5 invariants.
--
-- Automation fails in one direction. It does not stop working quietly; it
-- works forty times, to one person, at three in the morning, and nobody finds
-- out until they reply. Every rule below exists because the application layer
-- being the only thing holding the line is not good enough for something that
-- sends messages to customers on its own.

-- ---------------------------------------------------------------------------
-- A rule must have a cooldown, and it must be at least an hour.
--
-- The floor is checked here as well as in the domain layer because a rule row
-- can be written by an import, a fixture or a future migration, and a rule
-- with a zero cooldown is a rule that can act on the same person in a loop.
-- ---------------------------------------------------------------------------

ALTER TABLE "automation_rules"
  ADD CONSTRAINT "automation_rules_cooldown_floor"
  CHECK ("cooldownHours" >= 1);

-- A rule with no actions does nothing, and a workshop that builds one and
-- sees no effect concludes the feature is broken. Refused at the point it is
-- written rather than shrugged at when it runs.
ALTER TABLE "automation_rules"
  ADD CONSTRAINT "automation_rules_has_actions"
  CHECK (jsonb_array_length("actions") BETWEEN 1 AND 5);

-- ---------------------------------------------------------------------------
-- The cooldown itself.
--
-- The one guarantee worth having in this whole phase: the same rule cannot act
-- on the same subject twice inside its own window. It cannot be expressed as a
-- unique index because the window is a duration, not a value, so it is a
-- trigger. Only runs that actually fired count: a blocked run is a record of a
-- decision not to act and must not start a cooldown of its own.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carnet_automation_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  window_hours integer;
  previous timestamp(3);
BEGIN
  IF NEW."blockedBy" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT "cooldownHours" INTO window_hours
  FROM "automation_rules" WHERE "id" = NEW."ruleId";

  SELECT MAX("firedAt") INTO previous
  FROM "automation_runs"
  WHERE "ruleId" = NEW."ruleId"
    AND "subjectType" = NEW."subjectType"
    AND "subjectId" = NEW."subjectId"
    AND "blockedBy" IS NULL
    AND "id" <> NEW."id";

  IF previous IS NOT NULL
     AND NEW."firedAt" < previous + make_interval(hours => window_hours) THEN
    RAISE EXCEPTION
      'Rule % already acted on % % at %, and its cooldown is % hours.',
      NEW."ruleId", NEW."subjectType", NEW."subjectId", previous, window_hours
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "automation_runs_respect_cooldown"
  BEFORE INSERT ON "automation_runs"
  FOR EACH ROW EXECUTE FUNCTION carnet_automation_cooldown();

-- ---------------------------------------------------------------------------
-- A queued action tells the truth about itself.
--
-- A row that says PENDING while carrying a completion time, or says DONE
-- without one, makes the queue unreadable: the sweeper cannot tell what is
-- still owed and either sends twice or never sends at all.
-- ---------------------------------------------------------------------------

ALTER TABLE "automation_actions"
  ADD CONSTRAINT "automation_actions_status_coherent"
  CHECK (
    ("status" = 'PENDING'   AND "doneAt" IS NULL) OR
    ("status" = 'CANCELLED' AND "doneAt" IS NULL) OR
    ("status" = 'DONE'      AND "doneAt" IS NOT NULL) OR
    ("status" = 'FAILED'    AND "error"  IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- A campaign that claims to have been sent has a time it was sent.
--
-- And a draft has not. A campaign is the one thing in this product that cannot
-- be undone, so its status is the record of whether four hundred people have
-- already been written to.
-- ---------------------------------------------------------------------------

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_sent_has_time"
  CHECK (
    ("status" = 'SENT'  AND "sentAt" IS NOT NULL) OR
    ("status" = 'DRAFT' AND "sentAt" IS NULL) OR
    ("status" IN ('SENDING', 'CANCELLED'))
  );

-- A suppressed recipient carries the reason it was held back. The gap between
-- the list and the send is the number worth knowing, and it is worthless
-- without the reasons behind it.
ALTER TABLE "campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_explain_suppression"
  CHECK (
    ("status" = 'SENT'       AND "sentAt" IS NOT NULL) OR
    ("status" = 'SUPPRESSED' AND "reason" IS NOT NULL) OR
    ("status" = 'QUEUED')
  );

-- ---------------------------------------------------------------------------
-- Consent leaves a trail, whatever route it was changed by.
--
-- A boolean on a customer row proves nothing. It shows the current state and
-- no history, and the one occasion it matters is the occasion somebody asks
-- how you came to have permission. Written by the database rather than the
-- application so that an import, a bulk update or a hand-written statement
-- cannot flip a flag without leaving the record behind.
-- ---------------------------------------------------------------------------

-- The casts are load-bearing. A bare literal inside a plpgsql INSERT arrives
-- as text, and Postgres will not coerce text into an enum column on its own,
-- so without them every single consent change fails at the trigger.
CREATE OR REPLACE FUNCTION carnet_record_consent_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."marketingEmailConsent" THEN
      INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "changedAt")
      VALUES (gen_random_uuid()::text, NEW."id", 'EMAIL'::"MessageChannel", true, 'STAFF'::"ConsentSource", now());
    END IF;

    IF NEW."marketingSmsConsent" THEN
      INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "changedAt")
      VALUES (gen_random_uuid()::text, NEW."id", 'SMS'::"MessageChannel", true, 'STAFF'::"ConsentSource", now());
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."marketingEmailConsent" IS DISTINCT FROM OLD."marketingEmailConsent" THEN
    INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "changedAt")
    VALUES (
      gen_random_uuid()::text, NEW."id", 'EMAIL'::"MessageChannel", NEW."marketingEmailConsent",
      (CASE WHEN NEW."marketingEmailConsent" THEN 'STAFF' ELSE 'UNSUBSCRIBE' END)::"ConsentSource",
      now()
    );
  END IF;

  IF NEW."marketingSmsConsent" IS DISTINCT FROM OLD."marketingSmsConsent" THEN
    INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "changedAt")
    VALUES (
      gen_random_uuid()::text, NEW."id", 'SMS'::"MessageChannel", NEW."marketingSmsConsent",
      (CASE WHEN NEW."marketingSmsConsent" THEN 'STAFF' ELSE 'UNSUBSCRIBE' END)::"ConsentSource",
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "customers_record_consent_change"
  AFTER INSERT OR UPDATE OF "marketingEmailConsent", "marketingSmsConsent"
  ON "customers"
  FOR EACH ROW EXECUTE FUNCTION carnet_record_consent_change();

-- ---------------------------------------------------------------------------
-- Consent history cannot be edited or deleted.
--
-- Somebody tidying up this table would be destroying the only evidence that
-- permission was ever given, which is the whole reason for keeping it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carnet_consent_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Consent history cannot be changed. It is the evidence.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "consent_changes_immutable"
  BEFORE UPDATE OR DELETE ON "consent_changes"
  FOR EACH ROW EXECUTE FUNCTION carnet_consent_is_immutable();
