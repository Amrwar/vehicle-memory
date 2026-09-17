-- Working on a car is recorded as access to it, not inferred. Phase 51.
--
-- Every page that lists vehicles asked the same question two ways: has this
-- workshop a job on this vehicle, OR a grant for it. Postgres answers an OR of
-- two correlated subqueries by scanning every vehicle and running both for
-- each one, which is a second on a hundred and fifty thousand vehicles and
-- gets worse from there.
--
-- The answer to "may this workshop see this car" belongs in one place, and
-- there already is one: the grant. A workshop that has a job on a vehicle
-- could always see it, so writing the grant widens nothing — it records what
-- was already true, and turns a scan into an index lookup.
--
-- Backfills every job that came before the change. Idempotent: the unique
-- index on (vehicleId, orgId) means a second run adds nothing.

INSERT INTO "vehicle_access_grants" ("id", "vehicleId", "orgId", "scope", "reason", "grantedAt")
SELECT
  -- Deterministic, so re-running produces the same rows rather than duplicates
  -- under a different id if the unique index were ever dropped.
  'bf' || substr(md5(j."vehicleId" || ':' || j."orgId"), 1, 23),
  j."vehicleId",
  j."orgId",
  'READ',
  'SERVICED',
  min(j."createdAt")
FROM "jobs" j
WHERE NOT EXISTS (
  SELECT 1 FROM "vehicle_access_grants" g
  WHERE g."vehicleId" = j."vehicleId" AND g."orgId" = j."orgId"
)
GROUP BY j."vehicleId", j."orgId"
ON CONFLICT DO NOTHING;

-- A list of vehicles is read newest-first, and until now there was nothing to
-- read it from: the sort was over every row the filter let through.
CREATE INDEX IF NOT EXISTS "vehicles_updatedAt_idx" ON "vehicles" ("updatedAt" DESC);
