-- Ownership, warranty and sites. Phase 44.
--
-- A sale the buyer accepts rather than one a workshop types; what a warranty
-- claim actually cost and what came back; and an hourly rate and a part price
-- that can belong to one site.

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "handover_invitations" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "orgId" TEXT,
    "fromOwnershipId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toName" TEXT NOT NULL,
    "toKind" "OwnerKind" NOT NULL DEFAULT 'PRIVATE',
    "toEmail" TEXT,
    "toPhone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "soldOn" TIMESTAMP(3) NOT NULL,
    "odometerKm" INTEGER,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "startedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "handover_invitations_name_check" CHECK (length(btrim("toName")) >= 2),
    CONSTRAINT "handover_invitations_window_check" CHECK ("expiresAt" > "createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "handover_invitations_tokenHash_key" ON "handover_invitations"("tokenHash");
CREATE INDEX "handover_invitations_vehicleId_status_idx" ON "handover_invitations"("vehicleId", "status");
CREATE INDEX "handover_invitations_orgId_status_idx" ON "handover_invitations"("orgId", "status");

-- A car cannot be promised to two people at once.
CREATE UNIQUE INDEX "handover_invitations_one_pending" ON "handover_invitations"("vehicleId")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "handover_invitations" ADD CONSTRAINT "handover_invitations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handover_invitations" ADD CONSTRAINT "handover_invitations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "handover_invitations" ADD CONSTRAINT "handover_invitations_fromOwnershipId_fkey" FOREIGN KEY ("fromOwnershipId") REFERENCES "vehicle_ownerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handover_invitations" ADD CONSTRAINT "handover_invitations_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "handover_invitations" ADD CONSTRAINT "handover_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: what a claim cost and what came back, as against what was expected.
ALTER TABLE "warranty_claims" ADD COLUMN "partsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "labourCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "recovered" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "settledByUserId" TEXT;

ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_cost_check"
  CHECK ("partsCost" >= 0 AND "labourCost" >= 0 AND "recovered" >= 0);
-- Never more back than it cost: that is a credit belonging to another claim.
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_recovery_check"
  CHECK ("recovered" <= "partsCost" + "labourCost");

ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "labour_rates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "perHour" DECIMAL(10,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labour_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "labour_rates_name_check" CHECK (length(btrim("name")) >= 2),
    CONSTRAINT "labour_rates_per_hour_check" CHECK ("perHour" > 0 AND "perHour" <= 100000)
);

CREATE INDEX "labour_rates_orgId_locationId_idx" ON "labour_rates"("orgId", "locationId");

-- One name per scope, and one rate that new lines take in each scope. A
-- nullable column in a unique index does not constrain rows where it is null,
-- so the workshop's own rates get their own index.
CREATE UNIQUE INDEX "labour_rates_site_name" ON "labour_rates"("orgId", "locationId", "name")
  WHERE "locationId" IS NOT NULL;
CREATE UNIQUE INDEX "labour_rates_org_name" ON "labour_rates"("orgId", "name")
  WHERE "locationId" IS NULL;
CREATE UNIQUE INDEX "labour_rates_one_site_default" ON "labour_rates"("orgId", "locationId")
  WHERE "isDefault" AND "locationId" IS NOT NULL;
CREATE UNIQUE INDEX "labour_rates_one_org_default" ON "labour_rates"("orgId")
  WHERE "isDefault" AND "locationId" IS NULL;

ALTER TABLE "labour_rates" ADD CONSTRAINT "labour_rates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labour_rates" ADD CONSTRAINT "labour_rates_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "product_site_prices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sellPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_site_prices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_site_prices_price_check" CHECK ("sellPrice" >= 0 AND "sellPrice" <= 1000000)
);

CREATE UNIQUE INDEX "product_site_prices_productId_locationId_key" ON "product_site_prices"("productId", "locationId");
CREATE INDEX "product_site_prices_orgId_locationId_idx" ON "product_site_prices"("orgId", "locationId");

ALTER TABLE "product_site_prices" ADD CONSTRAINT "product_site_prices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_site_prices" ADD CONSTRAINT "product_site_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_site_prices" ADD CONSTRAINT "product_site_prices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every workshop that already prices work gets its rate written down rather
-- than left in whoever's head: the commonest labour rate on its own quotes,
-- or ninety-five where there is nothing to read.
INSERT INTO "labour_rates" ("id", "orgId", "locationId", "name", "perHour", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'lr_' || substr(md5(random()::text || o."id"), 1, 22),
  o."id",
  NULL,
  'Standard',
  COALESCE((
    SELECT l."rate"
    FROM "job_labour_lines" l
    JOIN "jobs" j ON j."id" = l."jobId"
    WHERE j."orgId" = o."id" AND l."rate" > 0
    GROUP BY l."rate"
    ORDER BY count(*) DESC, l."rate" DESC
    LIMIT 1
  ), 95),
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o;
