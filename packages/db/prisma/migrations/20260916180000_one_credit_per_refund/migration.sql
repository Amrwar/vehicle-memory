-- One refund, one consequence. Phase 46.
--
-- A refund can end in two places besides the bank: kept on the customer's
-- account as credit, or put back onto the gift card that paid the bill.
-- Neither was tied to the refund that caused it, so a refund recorded twice —
-- a double-click, a retried request, a page refreshed mid-submit — loaded the
-- card twice or credited the account twice, and the second one looked exactly
-- like a real one to everybody reading it afterwards.
--
-- Both are now the refund's own, and the database says so.

ALTER TABLE "gift_card_entries" ADD COLUMN IF NOT EXISTS "refundId" TEXT;

ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "gift_card_entries_one_per_refund"
  ON "gift_card_entries" ("refundId")
  WHERE "refundId" IS NOT NULL;

-- A refund is kept as credit once. Partial, because a deposit that came from
-- somewhere other than a refund has no refund to be the only one of.
CREATE UNIQUE INDEX "deposits_one_credit_per_refund"
  ON "deposits" ("sourceRefundId")
  WHERE "sourceRefundId" IS NOT NULL;
