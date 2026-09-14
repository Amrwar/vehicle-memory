-- Consent changed by the customer, recorded as theirs. Phase 32.7.
--
-- The trigger that writes consent history assumed staff made every change.
-- Now the application may say who and how for the transaction it is in,
-- with set_config('carnet.consent_source', 'PORTAL', true) and
-- set_config('carnet.consent_actor', <user id>, true); the trigger reads
-- them and falls back to the old rule when they are unset. The history
-- stays immutable; this only makes it truer.

CREATE OR REPLACE FUNCTION carnet_record_consent_change()
RETURNS TRIGGER AS $$
DECLARE
  v_source text := NULLIF(current_setting('carnet.consent_source', true), '');
  v_actor  text := NULLIF(current_setting('carnet.consent_actor', true), '');
  v_note   text := NULLIF(current_setting('carnet.consent_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."marketingEmailConsent" THEN
      INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "actorId", "note", "changedAt")
      VALUES (gen_random_uuid()::text, NEW."id", 'EMAIL'::"MessageChannel", true,
              COALESCE(v_source, 'STAFF')::"ConsentSource", v_actor, v_note, now());
    END IF;

    IF NEW."marketingSmsConsent" THEN
      INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "actorId", "note", "changedAt")
      VALUES (gen_random_uuid()::text, NEW."id", 'SMS'::"MessageChannel", true,
              COALESCE(v_source, 'STAFF')::"ConsentSource", v_actor, v_note, now());
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."marketingEmailConsent" IS DISTINCT FROM OLD."marketingEmailConsent" THEN
    INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "actorId", "note", "changedAt")
    VALUES (
      gen_random_uuid()::text, NEW."id", 'EMAIL'::"MessageChannel", NEW."marketingEmailConsent",
      COALESCE(v_source, CASE WHEN NEW."marketingEmailConsent" THEN 'STAFF' ELSE 'UNSUBSCRIBE' END)::"ConsentSource",
      v_actor, v_note, now()
    );
  END IF;

  IF NEW."marketingSmsConsent" IS DISTINCT FROM OLD."marketingSmsConsent" THEN
    INSERT INTO "consent_changes" ("id", "customerId", "channel", "granted", "source", "actorId", "note", "changedAt")
    VALUES (
      gen_random_uuid()::text, NEW."id", 'SMS'::"MessageChannel", NEW."marketingSmsConsent",
      COALESCE(v_source, CASE WHEN NEW."marketingSmsConsent" THEN 'STAFF' ELSE 'UNSUBSCRIBE' END)::"ConsentSource",
      v_actor, v_note, now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
