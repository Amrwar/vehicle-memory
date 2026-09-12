-- Before general availability. Phase 21.
--
-- A fixed-window counter on each API key, so one integration cannot take
-- the database down for every other. Trigram indexes stripped as always.

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "windowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "windowStartedAt" TIMESTAMP(3);
