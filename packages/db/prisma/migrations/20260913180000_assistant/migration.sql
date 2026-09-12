-- The assistant inside the workflow. Phase 22.
--
-- Every exchange recorded with what it cost, and a monthly token budget per
-- organisation. Trigram indexes stripped as always.

-- CreateEnum
CREATE TYPE "AssistantKind" AS ENUM ('QUESTION', 'DRAFT', 'EXPLAIN');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "assistantTokenBudget" INTEGER NOT NULL DEFAULT 1000000;

-- CreateTable
CREATE TABLE "assistant_exchanges" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "AssistantKind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "polished" BOOLEAN NOT NULL DEFAULT false,
    "rejected" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "sentMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_exchanges_orgId_createdAt_idx" ON "assistant_exchanges"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "assistant_exchanges" ADD CONSTRAINT "assistant_exchanges_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_exchanges" ADD CONSTRAINT "assistant_exchanges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An exchange has a prompt and a reply, and tokens are never negative.
ALTER TABLE "assistant_exchanges"
  ADD CONSTRAINT "assistant_exchanges_have_words" CHECK (length(btrim("prompt")) > 0 AND length(btrim("reply")) > 0),
  ADD CONSTRAINT "assistant_exchanges_tokens_positive" CHECK ("inputTokens" >= 0 AND "outputTokens" >= 0);
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_assistant_budget_positive" CHECK ("assistantTokenBudget" >= 0);
