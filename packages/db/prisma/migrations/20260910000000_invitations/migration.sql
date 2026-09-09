-- Invitations. Phase 4.6.
--
-- The trigram indexes a generated diff always proposes dropping are left out,
-- for the reason given in 20260909210000: Prisma cannot express a GIN index
-- with an operator class, so every diff wants to remove them, and applying
-- that turns customer and vehicle search into a sequential scan with no
-- symptom other than a page that got slower.

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locationId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_orgId_acceptedAt_idx" ON "invitations"("orgId", "acceptedAt");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- One open invitation per address per workshop.
--
-- Two live invitations to the same person is not a harmless duplicate: each
-- carries its own role, so accepting the older one silently gives somebody
-- different access from the one whoever sent the newer one intended.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "invitations_one_open_per_email"
  ON "invitations" ("orgId", lower("email"))
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- An invitation that has expired before it was created cannot be accepted by
-- anyone, and is almost always a clock or timezone mistake worth catching.
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");
