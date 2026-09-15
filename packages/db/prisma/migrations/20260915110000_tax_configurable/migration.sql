-- Tax, configurable. Phase 41.
--
-- A rate is one or more taxes; a workshop prices with tax in or before tax;
-- a customer can be exempt on the strength of a certificate; a site can have
-- its own rate; and every document writes what each tax came to, so the
-- report per tax reads what was issued and not what the rates say today.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "taxExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxExemptReference" TEXT;

-- An exemption rests on a certificate, or it is a discount nobody can defend.
ALTER TABLE "customers" ADD CONSTRAINT "customers_tax_exempt_reference_check"
  CHECK (NOT "taxExempt" OR length(btrim(coalesce("taxExemptReference", ''))) >= 3);

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "taxRateId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxExemptReference" TEXT;

-- CreateTable
CREATE TABLE "tax_components" (
    "id" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "compound" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tax_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_components_rate_check" CHECK ("rate" >= 0 AND "rate" <= 100)
);

-- CreateTable
CREATE TABLE "tax_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePct" DECIMAL(6,3) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_entries_source_check" CHECK ("sourceType" IN ('INVOICE', 'CREDIT_NOTE', 'COUNTER_SALE'))
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_components_taxRateId_name_key" ON "tax_components"("taxRateId", "name");
CREATE INDEX "tax_components_taxRateId_sortOrder_idx" ON "tax_components"("taxRateId", "sortOrder");
CREATE UNIQUE INDEX "tax_entries_sourceType_sourceId_name_ratePct_key" ON "tax_entries"("sourceType", "sourceId", "name", "ratePct");
CREATE INDEX "tax_entries_orgId_occurredAt_idx" ON "tax_entries"("orgId", "occurredAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_components" ADD CONSTRAINT "tax_components_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_entries" ADD CONSTRAINT "tax_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_entries" ADD CONSTRAINT "tax_entries_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What was declared is never rewritten.
CREATE OR REPLACE FUNCTION tax_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tax_entries is append-only: % is not permitted', TG_OP USING ERRCODE = '23001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_entries_no_update BEFORE UPDATE ON "tax_entries"
  FOR EACH ROW EXECUTE FUNCTION tax_entries_immutable();

-- Every existing rate becomes a rate of one tax, named as the rate is, so
-- documents already priced keep reading the way they were.
INSERT INTO "tax_components" ("id", "taxRateId", "name", "rate", "compound", "sortOrder")
SELECT 'tc_' || "id", "id", "name", "rate", false, 0 FROM "tax_rates";

-- Every invoice already issued writes what its tax came to, by rate, so the
-- report per tax covers the past as well as what comes next.
INSERT INTO "tax_entries" ("id", "orgId", "locationId", "sourceType", "sourceId", "reference", "name", "ratePct", "net", "tax", "currency", "occurredAt")
SELECT
  'te_' || md5(i."id" || coalesce(r."id", 'none')),
  i."orgId",
  j."locationId",
  'INVOICE',
  i."id",
  i."number",
  coalesce(r."name", 'No tax'),
  coalesce(r."rate", 0),
  -- A line's total is written with its tax by the product and without it by
  -- older imports; the invoice's own total says which, so the net is right
  -- either way.
  CASE WHEN abs(t."linesTotal" - i."total") < 0.05
    THEN sum(l."lineTotal" - l."taxAmount")
    ELSE sum(l."lineTotal") END,
  sum(l."taxAmount"),
  i."currency",
  coalesce(i."issuedAt", i."createdAt")
FROM "invoices" i
JOIN "invoice_lines" l ON l."invoiceId" = i."id"
LEFT JOIN "tax_rates" r ON r."id" = l."taxRateId"
LEFT JOIN "jobs" j ON j."id" = i."jobId"
JOIN (SELECT "invoiceId", sum("lineTotal") AS "linesTotal" FROM "invoice_lines" GROUP BY "invoiceId") t ON t."invoiceId" = i."id"
WHERE i."status" <> 'DRAFT' AND i."status" <> 'VOID'
GROUP BY i."id", i."orgId", j."locationId", i."number", r."id", r."name", r."rate", i."currency", i."issuedAt", i."createdAt", i."total", t."linesTotal";
