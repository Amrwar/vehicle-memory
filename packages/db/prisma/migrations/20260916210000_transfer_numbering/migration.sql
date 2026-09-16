-- Transfers get a counter of their own.
--
-- The stock transfer cycle was written end to end and had no beginning: a
-- workshop could be shown which parts one site was short of and another was
-- holding spare, and had no way to start moving them. Sending, receiving and
-- cancelling were all implemented and unreachable.
--
-- Numbered from the workshop's own counter like every other document it
-- issues, so two people starting a transfer at once get two numbers rather
-- than colliding on one.

ALTER TYPE "SequenceKind" ADD VALUE IF NOT EXISTS 'TRANSFER';
