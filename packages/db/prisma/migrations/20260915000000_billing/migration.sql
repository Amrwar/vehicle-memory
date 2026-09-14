-- The subscription, billed. Phase 32.6.
--
-- A card before the trial, the trial charged to it when it ends unless
-- cancelled, and the provider's references kept on the organisation so the
-- billing page can show the card, the next charge and the invoices.

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "billingProvider" TEXT,
  ADD COLUMN "billingCustomerRef" TEXT,
  ADD COLUMN "billingSubscriptionRef" TEXT,
  ADD COLUMN "billingCheckoutRef" TEXT,
  ADD COLUMN "billingStatus" TEXT,
  ADD COLUMN "billingCardBrand" TEXT,
  ADD COLUMN "billingCardLast4" TEXT,
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "billingPayload" JSONB,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "trialReminderSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "organizations_billingSubscriptionRef_key" ON "organizations"("billingSubscriptionRef");
CREATE UNIQUE INDEX "organizations_billingCheckoutRef_key" ON "organizations"("billingCheckoutRef");
CREATE INDEX "organizations_billingCustomerRef_idx" ON "organizations"("billingCustomerRef");

-- Workshops that started a trial before a card was asked for are the pilot.
-- They are treated as on a plan rather than refused for our earlier silence;
-- new sign-ups add a card before the trial starts.
UPDATE "organizations"
SET "subscribedAt" = COALESCE("subscribedAt", "createdAt")
WHERE "trialEndsAt" IS NOT NULL AND "subscribedAt" IS NULL AND "cancelledAt" IS NULL;
