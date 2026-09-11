-- Reviews, loyalty, referrals and the inbox. Phase 15.
--
-- Trigram indexes stripped as always: they are raw SQL from an earlier
-- migration, invisible to the datamodel, and every diff proposes dropping
-- them.

-- CreateEnum
CREATE TYPE "ReviewRouting" AS ENUM ('PENDING', 'PUBLIC_INVITE', 'THANKS_ONLY', 'PRIVATE_CONVERSATION');

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3),
    "routing" "ReviewRouting" NOT NULL DEFAULT 'PENDING',
    "publicOpenedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "jobId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referredCustomerId" TEXT,
    "referredJobId" TEXT,
    "usedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerRef" TEXT,
    "customerId" TEXT,
    "jobId" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'NONE',
    "matchNote" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_jobId_key" ON "review_requests"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_tokenHash_key" ON "review_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "review_requests_orgId_sentAt_idx" ON "review_requests"("orgId", "sentAt");

-- CreateIndex
CREATE INDEX "review_requests_orgId_routing_idx" ON "review_requests"("orgId", "routing");

-- CreateIndex
CREATE INDEX "review_requests_customerId_sentAt_idx" ON "review_requests"("customerId", "sentAt");

-- CreateIndex
CREATE INDEX "loyalty_entries_orgId_customerId_createdAt_idx" ON "loyalty_entries"("orgId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_entries_expiresAt_idx" ON "loyalty_entries"("expiresAt");

-- CreateIndex
CREATE INDEX "referrals_orgId_creditedAt_idx" ON "referrals"("orgId", "creditedAt");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_orgId_code_key" ON "referrals"("orgId", "code");

-- CreateIndex
CREATE INDEX "inbound_messages_orgId_receivedAt_idx" ON "inbound_messages"("orgId", "receivedAt");

-- CreateIndex
CREATE INDEX "inbound_messages_orgId_handledAt_idx" ON "inbound_messages"("orgId", "handledAt");

-- CreateIndex
CREATE INDEX "inbound_messages_jobId_idx" ON "inbound_messages"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_orgId_providerRef_key" ON "inbound_messages"("orgId", "providerRef");

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredCustomerId_fkey" FOREIGN KEY ("referredCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredJobId_fkey" FOREIGN KEY ("referredJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- A rating is one to five.
--
-- Every figure on the satisfaction screen is an average of this column. A
-- nought or a seven does not show up as an error: it shows up as a number
-- somebody quotes in a meeting.
-- ---------------------------------------------------------------------------

ALTER TABLE "review_requests"
  ADD CONSTRAINT "review_requests_rating_is_one_to_five"
  CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- A rating and the moment it was given travel together. One without the other
-- is a response nobody can place in time, or a time with nothing in it.
ALTER TABLE "review_requests"
  ADD CONSTRAINT "review_requests_answer_has_a_time"
  CHECK (("rating" IS NULL) = ("respondedAt" IS NULL));

-- Resolving a conversation says who did it and what happened. "Resolved" with
-- nothing against it means nothing to whoever reads it next.
ALTER TABLE "review_requests"
  ADD CONSTRAINT "review_requests_resolution_is_recorded"
  CHECK (
    "resolvedAt" IS NULL OR
    ("resolutionNote" IS NOT NULL AND length(btrim("resolutionNote")) > 0)
  );

-- ---------------------------------------------------------------------------
-- A points movement moves points, and says what for.
--
-- A zero entry is a row that changes nothing and still appears in somebody's
-- history as though it did.
-- ---------------------------------------------------------------------------

ALTER TABLE "loyalty_entries"
  ADD CONSTRAINT "loyalty_entries_move_something"
  CHECK ("points" <> 0 AND length(btrim("reason")) > 0);

-- Awards lapse; spends never do. An expiry on a negative entry would hand back
-- points a customer has already spent.
ALTER TABLE "loyalty_entries"
  ADD CONSTRAINT "loyalty_entries_only_awards_expire"
  CHECK ("expiresAt" IS NULL OR "points" > 0);

-- ---------------------------------------------------------------------------
-- A referral pays once, to two different people.
-- ---------------------------------------------------------------------------

ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_are_between_two_people"
  CHECK ("referredCustomerId" IS NULL OR "referredCustomerId" <> "referrerCustomerId");

-- Credited means used. Paying a referral nobody has redeemed is paying for an
-- address.
ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_credit_follows_use"
  CHECK ("creditedAt" IS NULL OR "referredCustomerId" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- An inbound message came from somewhere and says something.
-- ---------------------------------------------------------------------------

ALTER TABLE "inbound_messages"
  ADD CONSTRAINT "inbound_messages_have_a_sender"
  CHECK (length(btrim("fromAddress")) > 0 AND length(btrim("body")) > 0);

-- A message filed against a job is filed against a customer too. A job with no
-- customer beside it is a reply somebody cannot answer.
ALTER TABLE "inbound_messages"
  ADD CONSTRAINT "inbound_messages_job_implies_customer"
  CHECK ("jobId" IS NULL OR "customerId" IS NOT NULL);
