-- One referral code per customer. Phase 46.
--
-- A customer's code was made the first time anybody asked for it, and the
-- "first time" was decided by looking. Two pages opened at once — the portal
-- and the workshop's own customer page, say — both look, both find nothing,
-- and the customer ends up with two codes. Whichever one they hand out, half
-- the time the workshop is looking at the other.

DELETE FROM "referrals" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "orgId", "referrerCustomerId"
      ORDER BY ("referredCustomerId" IS NOT NULL) DESC, "createdAt" ASC
    ) AS seen
    FROM "referrals"
  ) ranked WHERE ranked.seen > 1
);

CREATE UNIQUE INDEX "referrals_one_per_customer"
  ON "referrals" ("orgId", "referrerCustomerId");
