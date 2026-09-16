-- Coupons. Phase 45.5.
--
-- The last thing on the feature map. A code carries its promises as columns —
-- when it starts, when it ends, what the bill has to reach, how many uses in
-- total and how many by one person — and every use is a row, so what the
-- offers gave away is read rather than estimated.
--
-- A coupon never rewrites an invoice. It settles against the bill the way
-- loyalty points do, through a payment method of its own that posts to what
-- the offers cost rather than to the bank.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'COUPON';

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL DEFAULT 'PERCENT',
    "percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minSpend" DECIMAL(12,2),
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "perCustomer" INTEGER NOT NULL DEFAULT 1,
    "redeemed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
    -- A code is letters and digits, in capitals: the same code however it was
    -- written on the postcard it came from.
    CONSTRAINT "coupons_code_check" CHECK ("code" ~ '^[A-Z0-9]{3,24}$'),
    CONSTRAINT "coupons_percent_check" CHECK ("percent" >= 0 AND "percent" <= 100),
    CONSTRAINT "coupons_amount_check" CHECK ("amount" >= 0 AND "amount" <= 1000000),
    -- A percentage code is a percentage; an amount code is an amount. Neither
    -- is both, because a coupon worth two things is a coupon nobody can check.
    CONSTRAINT "coupons_worth_check" CHECK (
      ("kind" = 'PERCENT' AND "percent" > 0 AND "amount" = 0)
      OR ("kind" = 'AMOUNT' AND "amount" > 0 AND "percent" = 0)
    ),
    CONSTRAINT "coupons_window_check" CHECK ("startsOn" IS NULL OR "endsOn" IS NULL OR "startsOn" <= "endsOn"),
    CONSTRAINT "coupons_limits_check" CHECK (
      ("maxRedemptions" IS NULL OR "maxRedemptions" >= 1) AND "perCustomer" >= 1 AND "redeemed" >= 0
    )
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceId" TEXT,
    "counterSaleId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "billed" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupon_redemptions_amount_check" CHECK ("amount" > 0 AND "amount" <= "billed")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_orgId_code_key" ON "coupons"("orgId", "code");
CREATE INDEX "coupons_orgId_isActive_idx" ON "coupons"("orgId", "isActive");
CREATE INDEX "coupon_redemptions_couponId_redeemedAt_idx" ON "coupon_redemptions"("couponId", "redeemedAt");
CREATE INDEX "coupon_redemptions_orgId_redeemedAt_idx" ON "coupon_redemptions"("orgId", "redeemedAt");

-- One code, one bill. A second use against the same invoice is a double
-- discount somebody would notice only when the accounts were read.
CREATE UNIQUE INDEX "coupon_redemptions_one_per_invoice" ON "coupon_redemptions"("couponId", "invoiceId")
  WHERE "invoiceId" IS NOT NULL;
CREATE UNIQUE INDEX "coupon_redemptions_one_per_sale" ON "coupon_redemptions"("couponId", "counterSaleId")
  WHERE "counterSaleId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_counterSaleId_fkey" FOREIGN KEY ("counterSaleId") REFERENCES "counter_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The account the redemptions post to, for workshops whose chart is already
-- written. ensureChartOfAccounts adds it to new ones.
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type", "isActive")
SELECT
  'acc_' || substr(md5(random()::text || o."id"), 1, 22),
  o."id",
  '6410',
  'Coupons',
  'EXPENSE',
  true
FROM "organizations" o
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a."orgId" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."orgId" = o."id" AND a."code" = '6410');
