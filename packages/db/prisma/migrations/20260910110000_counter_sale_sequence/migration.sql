-- Counter sales get their own gapless numbering.
--
-- Reusing the invoice sequence would interleave two documents in one run of
-- numbers, and a gap in an invoice sequence is the first thing an auditor
-- asks about. A till receipt and an invoice are different documents to
-- different people.

ALTER TYPE "SequenceKind" ADD VALUE IF NOT EXISTS 'COUNTER_SALE';
