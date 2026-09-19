-- One identifier, from the press to the inbox. Phase 59. NFR-803.
--
-- A workshop rings and says a customer never got their message. Since Phase 50
-- the health page can answer that for the message itself. What it cannot do is
-- go the other way: somebody pressed a button, and nothing happened — was the
-- action recorded, did it reach the outbox, did the outbox reach a message, or
-- did the whole thing fall over before any of it?
--
-- Four records, one identifier. Minted once per request and carried into
-- everything that request causes, including the background work it enqueues,
-- which is what NFR-803 has asked for since the first week.
--
-- Nullable everywhere, and it has to be. Every row written before this
-- migration has no trace and never will, and a great deal written after it is
-- caused by a schedule rather than by a person: a reminder queued at four in
-- the morning was nobody's press. A column that pretended otherwise would make
-- "no trace" indistinguishable from "we lost it".

ALTER TABLE "audit_logs"     ADD COLUMN "traceId" TEXT;
ALTER TABLE "outbox_events"  ADD COLUMN "traceId" TEXT;
ALTER TABLE "message_logs"   ADD COLUMN "traceId" TEXT;
ALTER TABLE "staff_notifications" ADD COLUMN "traceId" TEXT;

-- Looked up by trace and by nothing else: this is the index behind one search
-- box on the operator's page. Partial, because the overwhelming majority of
-- rows have no trace and there is no reason to carry them in it.
CREATE INDEX "audit_logs_traceId" ON "audit_logs"("traceId") WHERE "traceId" IS NOT NULL;
CREATE INDEX "outbox_events_traceId" ON "outbox_events"("traceId") WHERE "traceId" IS NOT NULL;
CREATE INDEX "message_logs_traceId" ON "message_logs"("traceId") WHERE "traceId" IS NOT NULL;
CREATE INDEX "staff_notifications_traceId" ON "staff_notifications"("traceId") WHERE "traceId" IS NOT NULL;
