-- The audit log's second permitted mutation. Phase 62. FR-209, NFR-503.
--
-- `audit_logs` has refused every UPDATE and every DELETE since the first
-- month, and that refusal is most of what makes it worth having: an account of
-- who did what, to which record, when and from where, that nobody can tidy
-- afterwards.
--
-- It also keeps a copy of the values that were written, and for a customer
-- those values are their name, their email address and their telephone number.
-- When that person asks to be forgotten, the product has to be able to let go
-- of the copy without letting go of the account.
--
-- So the trigger gains exactly one further permitted mutation, in the same
-- shape as the one `vehicle_events` has carried since the beginning: emptying
-- `before` and `after`, and nothing else. Every other column must be
-- identical, and DELETE is still refused outright.
--
-- What survives a redaction is the whole of the audit trail's purpose: the
-- action, the actor, the record it touched, the moment, the address it came
-- from and the trace it belonged to. What goes is the copy of somebody's name.
--
-- The first permitted mutation is kept, and keeping it is the point of writing
-- this migration twice. `20260909230000_audit_permits_erasure` allows a
-- deleted party's foreign key to be cleared, because both keys here are
-- declared ON DELETE SET NULL and a SET NULL cascade is an UPDATE. A version
-- of this function that permitted only the redaction was written first, and
-- `verify-erasure` refused it: it would have made every audited organisation
-- and user permanently undeletable again, which is the exact fault that
-- migration was written to fix. Two permissions, then, and a function that
-- states both rather than the newer one alone.
--
-- Both clauses also gain `traceId`, which did not exist when the first was
-- written: Phase 59 added the column and nothing taught the trigger about it,
-- so until now the one row of the audit log that could be changed could have
-- been made to point at somebody else's request.

CREATE OR REPLACE FUNCTION carnet_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'audit_logs is immutable: DELETE is not permitted (record %)', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Permitted, as before: a foreign key being cleared because the party was
  -- deleted. Nothing else about the row may differ, and a key may only be
  -- cleared, never repointed at somebody else.
  IF (
    NEW."id"          IS NOT DISTINCT FROM OLD."id"          AND
    NEW."action"      IS NOT DISTINCT FROM OLD."action"      AND
    NEW."entityType"  IS NOT DISTINCT FROM OLD."entityType"  AND
    NEW."entityId"    IS NOT DISTINCT FROM OLD."entityId"    AND
    NEW."before"      IS NOT DISTINCT FROM OLD."before"      AND
    NEW."after"       IS NOT DISTINCT FROM OLD."after"       AND
    NEW."ip"          IS NOT DISTINCT FROM OLD."ip"          AND
    NEW."userAgent"   IS NOT DISTINCT FROM OLD."userAgent"   AND
    NEW."createdAt"   IS NOT DISTINCT FROM OLD."createdAt"   AND
    NEW."traceId"     IS NOT DISTINCT FROM OLD."traceId"     AND
    (NEW."orgId"       IS NOT DISTINCT FROM OLD."orgId"       OR NEW."orgId"       IS NULL) AND
    (NEW."actorUserId" IS NOT DISTINCT FROM OLD."actorUserId" OR NEW."actorUserId" IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  -- Permitted, newly: a redaction. The copy of the values goes, in that
  -- direction only, and every other column stays exactly as it was.
  IF (
    NEW."before"      IS NULL                                AND
    NEW."after"       IS NULL                                AND
    NEW."id"          IS NOT DISTINCT FROM OLD."id"          AND
    NEW."orgId"       IS NOT DISTINCT FROM OLD."orgId"       AND
    NEW."actorUserId" IS NOT DISTINCT FROM OLD."actorUserId" AND
    NEW."action"      IS NOT DISTINCT FROM OLD."action"      AND
    NEW."entityType"  IS NOT DISTINCT FROM OLD."entityType"  AND
    NEW."entityId"    IS NOT DISTINCT FROM OLD."entityId"    AND
    NEW."ip"          IS NOT DISTINCT FROM OLD."ip"          AND
    NEW."userAgent"   IS NOT DISTINCT FROM OLD."userAgent"   AND
    NEW."traceId"     IS NOT DISTINCT FROM OLD."traceId"     AND
    NEW."createdAt"   IS NOT DISTINCT FROM OLD."createdAt"
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'audit_logs is immutable: only a deleted party''s reference may be cleared, or a name redacted (row %)',
    OLD."id"
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
