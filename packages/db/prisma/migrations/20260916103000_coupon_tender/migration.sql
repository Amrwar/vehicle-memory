-- A coupon at the counter. Phase 45.5.
--
-- The counter settles a coupon the way it settles a gift card: as a tender of
-- its own kind. The sale keeps the total it was billed at, and what the code
-- took off posts to what the offers cost rather than into the drawer, so a
-- day's takings still reconcile against what is actually in the till.

ALTER TYPE "TenderKind" ADD VALUE IF NOT EXISTS 'COUPON';
