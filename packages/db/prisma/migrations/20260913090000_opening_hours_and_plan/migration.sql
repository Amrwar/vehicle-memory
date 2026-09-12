-- The workshop configures itself. Phase 19.
--
-- Opening hours on the site, so planning stops assuming eight to six, and a
-- booking source for work the accepted plan wrote into the diary. Trigram
-- indexes stripped as always.

-- AlterEnum
ALTER TYPE "BookingSource" ADD VALUE 'PLAN';

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "closesAtMinute" INTEGER NOT NULL DEFAULT 1080,
ADD COLUMN     "opensAtMinute" INTEGER NOT NULL DEFAULT 480;

-- A site opens before it closes, and both within the day.
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_open_before_close"
  CHECK ("opensAtMinute" >= 0 AND "closesAtMinute" <= 1440 AND "opensAtMinute" < "closesAtMinute");
