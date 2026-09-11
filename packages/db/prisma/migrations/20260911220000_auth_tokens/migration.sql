-- One-time links for verification and password reset. Phase 16.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_purpose_createdAt_idx" ON "auth_tokens"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "auth_tokens_expiresAt_idx" ON "auth_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- A token expires, and expires after it was issued.
--
-- A row with the two the wrong way round is a link that was dead before it was
-- sent, which reads to the person holding it as the product being broken.
-- ---------------------------------------------------------------------------

ALTER TABLE "auth_tokens"
  ADD CONSTRAINT "auth_tokens_expire_after_issue"
  CHECK ("expiresAt" > "createdAt");

-- Used means used at a real moment, not before the token existed.
ALTER TABLE "auth_tokens"
  ADD CONSTRAINT "auth_tokens_used_after_issue"
  CHECK ("usedAt" IS NULL OR "usedAt" >= "createdAt");

-- ---------------------------------------------------------------------------
-- One live token per person per purpose.
--
-- Issuing a new link has to retire the old one. Without this every link ever
-- sent stays valid until it expires on its own, and the window is no longer
-- the hour it claims to be: it is the whole history of requests.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "auth_tokens_one_live_per_purpose"
  ON "auth_tokens" ("userId", "purpose")
  WHERE "usedAt" IS NULL;
