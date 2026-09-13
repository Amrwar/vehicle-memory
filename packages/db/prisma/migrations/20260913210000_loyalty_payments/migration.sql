-- Points, and the public face. Phase 24.
--
-- Loyalty points redeemed against a bill are a payment method that posts to
-- marketing rather than to the bank.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'LOYALTY';
