-- One request, once. Phase 46.
--
-- Some writes cannot be recognised as repeats by what they contain, and the
-- most important one is taking money: two cash payments of fifty pounds
-- against the same bill on the same afternoon are two real payments, so the
-- amount and the invoice cannot be the key. What separates them is that they
-- were two decisions, made at two different moments, on two separately drawn
-- forms.
--
-- So the form carries the key. Every drawing of a button mints one, every
-- press of that button sends it, and the second press of the same button
-- lands here instead of on a second payment. Pressing it again tomorrow is a
-- new form, a new key, and a payment that goes through — which is right,
-- because that is somebody deciding to take another fifty pounds.

CREATE TABLE "once_requests" (
    "id"        TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "doneAt"    TIMESTAMP(3),
    "resultRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "once_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "once_requests_key_check" CHECK (length("key") BETWEEN 3 AND 200)
);

-- The guard itself. Everything else in this table is bookkeeping.
CREATE UNIQUE INDEX "once_requests_orgId_key_key" ON "once_requests"("orgId", "key");
CREATE INDEX "once_requests_expiresAt_idx" ON "once_requests"("expiresAt");

ALTER TABLE "once_requests" ADD CONSTRAINT "once_requests_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
