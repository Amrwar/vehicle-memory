-- Gift cards, deepened. Phase 28.
--
-- Every movement on a card is typed, so a balance can be explained. A card
-- may expire, may be good at one site only, and may be cancelled with the
-- reason kept. A card is a tender at the counter.

-- CreateEnum
CREATE TYPE "GiftCardEntryKind" AS ENUM ('ISSUE', 'REDEEM', 'REFUND', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "TenderKind" ADD VALUE 'GIFT_CARD';

-- AlterTable: the card
ALTER TABLE "gift_cards" RENAME COLUMN "voidedAt" TO "disabledAt";
ALTER TABLE "gift_cards"
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "locationId" TEXT;

-- AlterTable: the entries, typed. What exists is loads and spends.
ALTER TABLE "gift_card_entries"
  ADD COLUMN "kind" "GiftCardEntryKind" NOT NULL DEFAULT 'ISSUE',
  ADD COLUMN "counterSaleId" TEXT;
UPDATE "gift_card_entries" SET "kind" = 'REDEEM' WHERE "amount" < 0;
ALTER TABLE "gift_card_entries" ALTER COLUMN "kind" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_counterSaleId_fkey" FOREIGN KEY ("counterSaleId") REFERENCES "counter_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- The kind and the sign agree, and a cancellation says why.
-- ---------------------------------------------------------------------------

ALTER TABLE "gift_card_entries"
  ADD CONSTRAINT "gift_card_entries_kind_matches_sign"
  CHECK (
    ("kind" IN ('ISSUE', 'REFUND') AND "amount" > 0)
    OR ("kind" = 'REDEEM' AND "amount" < 0)
    OR ("kind" = 'ADJUSTMENT')
  );

ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_cancelled_with_a_reason"
  CHECK ("disabledAt" IS NULL OR length(btrim(coalesce("disabledReason", ''))) > 0);
