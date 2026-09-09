-- The audit log must survive erasure without preventing it.
--
-- The immutability trigger refused every UPDATE, which is what it was for.
-- The consequence was not intended: both foreign keys on audit_logs are
-- declared ON DELETE SET NULL, and a SET NULL cascade is an UPDATE. The
-- trigger blocked it, so Postgres could not delete any organisation or any
-- user that had ever been audited. Every one of them is audited on creation,
-- so in practice nothing could ever be deleted.
--
-- That is a data protection problem, not a tidiness one. A person exercising
-- a right to erasure cannot be told the record of their own account creation
-- makes them permanently undeletable.
--
-- The rule that actually matters is that what happened cannot be rewritten.
-- Detaching a row from a deleted party does not rewrite what happened: the
-- action, the entity, the before and after, and the timestamp are all still
-- there. So the trigger now permits exactly one kind of update, the one a
-- cascade performs, and refuses everything else including DELETE.
--
-- This mirrors the vehicle_events trigger, which permits only supersededById
-- to be set and refuses every other change.

CREATE OR REPLACE FUNCTION carnet_audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'audit_logs is immutable: DELETE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Permitted: a foreign key being cleared because the party was deleted.
  -- Nothing else about the row may differ, and a key may only be cleared,
  -- never repointed at somebody else.
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
    (NEW."orgId"       IS NOT DISTINCT FROM OLD."orgId"       OR NEW."orgId"       IS NULL) AND
    (NEW."actorUserId" IS NOT DISTINCT FROM OLD."actorUserId" OR NEW."actorUserId" IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'audit_logs is immutable: only a deleted party''s reference may be cleared (row %)', OLD."id"
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
