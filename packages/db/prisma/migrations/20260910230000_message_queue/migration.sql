-- The outbound message queue.
--
-- Rows were being written here and nothing ever moved them, so every
-- confirmation, reminder and quote link the product had "sent" was sitting in
-- this table. These two columns are what a queue needs that a log does not: a
-- count of how many times sending has been attempted, and the time it may next
-- be tried. The second carries both the retry backoff and the quiet-hours
-- hold, because from the sender's side those are the same instruction.
--
-- The trigram indexes are absent on purpose. They are raw SQL from an earlier
-- migration and invisible to the Prisma datamodel, so every diff proposes
-- dropping them; letting one through turns customer search back into a scan.

-- AlterTable
ALTER TABLE "message_logs" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "message_logs_status_availableAt_idx" ON "message_logs"("status", "availableAt");

