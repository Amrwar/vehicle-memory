-- Expenses and banking. Phase 4.8.
--
-- Trigram index drops omitted, as in every migration since 20260909210000:
-- Prisma cannot express a GIN index with an operator class, so each diff
-- proposes removing them and applying that silently turns search into a
-- sequential scan.

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PREMISES', 'UTILITIES', 'INSURANCE', 'VEHICLE', 'EQUIPMENT', 'CONSUMABLES', 'MARKETING', 'PROFESSIONAL', 'TRAINING', 'SUBSCRIPTIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaidFrom" AS ENUM ('BANK', 'CASH', 'PERSONAL', 'CARD');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "reference" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier" TEXT NOT NULL,
    "description" TEXT,
    "net" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "paidFrom" "PaidFrom" NOT NULL DEFAULT 'BANK',
    "receiptUrl" TEXT,
    "claimedByEmployeeId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last4" TEXT,
    "sortCode" TEXT,
    "accountCode" TEXT NOT NULL DEFAULT '1000',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "closingBalance" DECIMAL(14,2) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "postedOn" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "matchedEntryId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchReason" TEXT,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_orgId_status_idx" ON "expenses"("orgId", "status");

-- CreateIndex
CREATE INDEX "expenses_orgId_incurredAt_idx" ON "expenses"("orgId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_orgId_reference_key" ON "expenses"("orgId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_orgId_name_key" ON "bank_accounts"("orgId", "name");

-- CreateIndex
CREATE INDEX "bank_statements_bankAccountId_startsOn_idx" ON "bank_statements"("bankAccountId", "startsOn");

-- CreateIndex
CREATE INDEX "bank_statement_lines_statementId_postedOn_idx" ON "bank_statement_lines"("statementId", "postedOn");

-- CreateIndex
CREATE INDEX "bank_statement_lines_matchedEntryId_idx" ON "bank_statement_lines"("matchedEntryId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_claimedByEmployeeId_fkey" FOREIGN KEY ("claimedByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Expenses are money out, so the arithmetic is guarded at the table.
-- ---------------------------------------------------------------------------

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive"
  CHECK ("net" > 0 AND "tax" >= 0);

-- Tax larger than the amount is somebody reading the wrong box on a receipt,
-- and it inflates the reclaim rather than the cost, so it is worth catching.
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_tax_within_net"
  CHECK ("tax" <= "net");

-- An approved expense records who approved it and when. Without both, "who
-- signed this off" has no answer, which is the only question an approval
-- workflow exists to answer.
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_approval_recorded"
  CHECK (
    "status" IN ('DRAFT', 'SUBMITTED', 'REJECTED')
    OR ("approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Nobody approves their own claim.
--
-- Enforced here as well as in the domain, because an approval control that
-- lives only in one code path is a control until somebody adds a second path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION carnet_expenses_no_self_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_claimant_user TEXT;
BEGIN
  IF (NEW."approvedByUserId" IS NULL OR NEW."claimedByEmployeeId" IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT "userId" INTO v_claimant_user
    FROM "employees" WHERE "id" = NEW."claimedByEmployeeId";

  IF (v_claimant_user IS NOT NULL AND v_claimant_user = NEW."approvedByUserId") THEN
    RAISE EXCEPTION 'expense %: nobody may approve their own claim', NEW."reference"
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_no_self_approval
  BEFORE INSERT OR UPDATE ON "expenses"
  FOR EACH ROW
  EXECUTE FUNCTION carnet_expenses_no_self_approval();

-- ---------------------------------------------------------------------------
-- Bank statements
-- ---------------------------------------------------------------------------

ALTER TABLE "bank_statements"
  ADD CONSTRAINT "bank_statements_period_forwards"
  CHECK ("endsOn" >= "startsOn");

-- A zero line is not a transaction. It usually means an import read a header
-- row as data, and it pollutes every reconciliation afterwards.
ALTER TABLE "bank_statement_lines"
  ADD CONSTRAINT "bank_statement_lines_not_zero"
  CHECK ("amount" <> 0);

-- A matched line records what it was matched to. A tick with no reference
-- behind it cannot be checked, undone or explained.
ALTER TABLE "bank_statement_lines"
  ADD CONSTRAINT "bank_statement_lines_match_recorded"
  CHECK (
    ("matchedEntryId" IS NULL AND "matchedAt" IS NULL)
    OR ("matchedEntryId" IS NOT NULL AND "matchedAt" IS NOT NULL)
  );

-- One ledger entry cannot settle two statement lines.
CREATE UNIQUE INDEX "bank_statement_lines_one_match_per_entry"
  ON "bank_statement_lines" ("matchedEntryId")
  WHERE "matchedEntryId" IS NOT NULL;
