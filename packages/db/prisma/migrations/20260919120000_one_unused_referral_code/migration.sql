-- One UNUSED referral code per customer. Phase 55.
--
-- Phase 46 wanted to stop a customer ending up with two codes because two
-- pages asked for one at the same moment, and wrote a unique index on
-- (orgId, referrerCustomerId). That is stronger than what it meant, and the
-- difference was not visible until somebody actually referred a friend.
--
-- A code in this product is one introduction: it names who handed it out and
-- who arrived with it, and once it has brought somebody in the referrer is
-- given a fresh one. So a customer who has successfully referred anybody has
-- one used row, and asking for their code tries to write a second — which the
-- index refuses. The referral card threw a constraint violation for every
-- customer who had ever brought a friend in, which is precisely the customer
-- a workshop most wants to look at.
--
-- The fix is the index the intent describes: at most one code waiting to be
-- used. Introductions already made accumulate beside it, because they are the
-- history of what the customer has brought in.
--
-- Nothing caught this for nine phases because verify-referrals.ts was never
-- run by anything. It is in the workflow from this phase on.

DROP INDEX IF EXISTS "referrals_one_per_customer";

-- Tidy first, in case two unused codes survived from before Phase 46: keep the
-- oldest, which is the one most likely to have been handed out.
DELETE FROM "referrals" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "orgId", "referrerCustomerId"
      ORDER BY "createdAt" ASC
    ) AS seen
    FROM "referrals"
    WHERE "referredCustomerId" IS NULL
  ) ranked WHERE ranked.seen > 1
);

CREATE UNIQUE INDEX "referrals_one_unused_per_customer"
  ON "referrals" ("orgId", "referrerCustomerId")
  WHERE "referredCustomerId" IS NULL;
