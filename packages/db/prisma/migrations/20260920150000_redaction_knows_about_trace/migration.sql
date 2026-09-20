-- The redaction learns about traceId. Phase 62. FR-9706.
--
-- This exists because of a mistake worth leaving visible. The function in
-- 20260920140000 was written, applied to both databases, and then edited in
-- place to add `traceId` to its two permitted mutations. An applied migration
-- never runs again, so the edit reached the file and neither database: the
-- column Phase 59 added was still the one thing about an audit row that the
-- single permitted change could have altered without the trigger objecting.
--
-- The rule is that a migration is immutable once it has run anywhere, and the
-- fix for a migration that was wrong is another migration. The body below is
-- the finished function, and `CREATE OR REPLACE` makes it idempotent: on a
-- fresh database it replaces an identical definition and changes nothing; on
-- the two that already ran the first version, it adds the clauses that were
-- missing.

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
