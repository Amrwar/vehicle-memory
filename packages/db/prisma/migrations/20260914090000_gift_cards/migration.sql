-- Gift cards. Phase 26.
--
-- A card is money taken in advance for work not yet chosen: a liability from
-- the day it is sold until the day it is spent. Redeeming one is a payment
-- method of its own that releases the liability rather than touching the
-- bank a second time. The balance is the sum of the entries.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'GIFT_CARD';

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "buyerCustomerId" TEXT,
    "recipientName" TEXT,
    "note" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_orgId_code_key" ON "gift_cards"("orgId", "code");

-- CreateIndex
CREATE INDEX "gift_cards_orgId_soldAt_idx" ON "gift_cards"("orgId", "soldAt");

-- CreateIndex
CREATE INDEX "gift_card_entries_giftCardId_createdAt_idx" ON "gift_card_entries"("giftCardId", "createdAt");

-- CreateIndex
CREATE INDEX "gift_card_entries_orgId_createdAt_idx" ON "gift_card_entries"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_buyerCustomerId_fkey" FOREIGN KEY ("buyerCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_entries" ADD CONSTRAINT "gift_card_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- A card is sold for something, and an entry moves something.
-- ---------------------------------------------------------------------------

ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_sold_for_something"
  CHECK ("amount" > 0);

ALTER TABLE "gift_card_entries"
  ADD CONSTRAINT "gift_card_entries_move_something"
  CHECK ("amount" <> 0 AND length(btrim("reason")) > 0);
