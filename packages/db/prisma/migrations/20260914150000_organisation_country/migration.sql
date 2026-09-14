-- Country and currency per workshop. Phase 29.
--
-- The organisation already carried a base currency, a locale and a
-- timezone. It now carries the country they follow from, chosen at sign-up.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'GB';
