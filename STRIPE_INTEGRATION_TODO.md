# Stripe integration: what is left to do

Carnet already had a Stripe Checkout integration behind its payment-provider
seam (`apps/web/src/lib/payments/stripe.ts`). This pass applied the
parameters configured in Stripe's Checkout Studio to that one call and
touched nothing else. This file is the single source of truth for the
remaining steps.

## Values to Replace

None of the `sample_only` parameters are placeholders: the existing call
already carries real values, and they were kept.

**Files containing these parameters:**

- [apps/web/src/lib/payments/stripe.ts](apps/web/src/lib/payments/stripe.ts)

| Field              | Current value                                                        | What to set                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| mode               | `payment`                                                            | Correct: each checkout is a one-off payment of one invoice. Subscriptions for workshop plans are a later phase and will use `subscription`.   |
| success_url        | `${APP_URL}/portal/invoices?paid=<attemptId>`                        | Already real. The portal page reads the attempt and asks Stripe for the outcome if the webhook has not arrived. No change needed.             |
| cancel_url         | `${APP_URL}/portal/invoices?cancelled=<attemptId>`                   | Already real. No change needed.                                                                                                               |
| line_items[].price | inline `price_data` for the invoice amount, currency and description | Deliberate: an invoice is not a catalogue product, so no Stripe Price ID is used. The "Carnet Core" product you created is for subscriptions. |

## Configured Parameters

These parameters were configured in Checkout Studio and are now set on the
call.

**Files containing these parameters:**

- [apps/web/src/lib/payments/stripe.ts](apps/web/src/lib/payments/stripe.ts)

| Parameter                        | Value             |
| -------------------------------- | ----------------- |
| ui_mode                          | `hosted_page`     |
| billing_address_collection       | `auto`            |
| phone_number_collection[enabled] | `false`           |
| automatic_tax[enabled]           | `false`           |
| allow_promotion_codes            | `false`           |
| submit_type                      | `auto`            |
| origin_context                   | `web`             |
| metadata[integration_identifier] | `hosted_web_0001` |

Not set, on purpose: `payment_method_collection` only applies when `mode` is
`subscription`. `integration_identifier` is not a Checkout Session API
parameter, so it is carried as metadata rather than sent at the top level,
where Stripe would refuse the request as an unknown parameter.

Kept, although Checkout Studio does not configure them, because the
integration needs them: `client_reference_id` and `metadata[attemptId]` (how a
session is matched to Carnet's payment attempt) and `customer_email` (so Stripe
sends its own receipt to the right address).

### The `ui_mode` value depends on the API version

Carnet calls the Checkout API over HTTP with no Stripe SDK and no pinned API
version, so requests run at the account's default API version. Accounts
created recently use `hosted_page`; older API versions call the same thing
`hosted`. If the first "Pay now" fails with a message naming `ui_mode`, change
the value to `hosted` in the file above, or omit the parameter entirely (hosted
is the default either way).

## Setup

1. Environment variables, in Vercel (Production) and in `apps/web/.env` for
   local runs. They already exist in `apps/web/src/lib/env.ts` and
   `.env.example`; no new names were introduced:

   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_test_...        # Dashboard -> Developers -> API keys
   STRIPE_WEBHOOK_SECRET=whsec_...      # Dashboard -> Developers -> Webhooks, after step 2
   ```

   No publishable key is needed: the customer is redirected to Stripe's
   hosted page, so no Stripe JavaScript runs in Carnet.

2. Webhook. In the Stripe Dashboard add an endpoint at
   `https://<your production host>/api/payments/webhook` listening to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`

   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. The endpoint verifies
   the `Stripe-Signature` header itself and fails closed without the secret.

3. Redeploy (Vercel redeploys on push; a changed environment variable needs a
   redeploy from the dashboard).

4. No dependencies to install. The integration uses `fetch` against
   `https://api.stripe.com/v1`.

## How it works

1. A customer signs in to the portal, opens Invoices, and presses "Pay now" on
   an outstanding invoice.
2. `startCardPayment()` (`apps/web/src/lib/card-payments.ts`) opens a
   `PaymentAttempt` row and asks the provider for a checkout. With
   `PAYMENT_PROVIDER=stripe`, `stripeProvider.createCheckout()` creates the
   Checkout Session with the parameters above and returns its URL.
3. The customer pays on Stripe's hosted page and is sent back to
   `/portal/invoices?paid=<attemptId>`.
4. Stripe's webhook, or the portal page asking Stripe when it lands, settles
   the attempt once: `settleAttempt()` claims the move from pending, records
   the payment with method `ONLINE` and the session id as reference, posts it
   to the ledger, and sends the receipt. A declined card becomes a failed
   attempt with Stripe's reason; the customer sees it and can try again.
5. Refunds by card from the invoice page go back through Stripe
   (`stripeProvider.refund()`), and `/payments/card` in the workshop can ask
   Stripe about any attempt and reconcile the last ninety days.

Nothing new was added: the endpoint, the webhook route
(`apps/web/src/app/api/payments/webhook/route.ts`), the environment schema
and the stub provider for local runs were already in place.

## Testing

With a test-mode secret key, use Stripe's test cards on the hosted page:

| Card number         | Result                                    |
| ------------------- | ----------------------------------------- |
| 4242 4242 4242 4242 | Paid                                      |
| 4000 0000 0000 9995 | Declined, insufficient funds              |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) first |

Any future expiry, any CVC, any postcode. Without keys at all,
`PAYMENT_PROVIDER=stub` (the default) runs the same flow against a checkout
page of Carnet's own at `/pay/<attempt>`, and
`npm run verify:payments` exercises the whole cycle against it.

## Next steps

- Turn on live mode: swap the test secret key and webhook secret for the live
  ones and redeploy.
- Fees and payouts: the bank is debited for the gross amount the customer
  paid; Stripe's fee arrives on its statement and is matched as an expense
  from the bank feed (see `docs/02-design/07-accounting-model.md`, 3.18).
- Per-workshop payouts: today one Stripe account receives every workshop's
  card takings. For many workshops, Stripe Connect (a connected account per
  organisation, checkouts created on that account) is the next phase; the seam
  was written for it.
- Subscriptions: the "Carnet Core" product and its monthly price in your
  dashboard are not read by the code yet. Charging workshops for their plan
  is a later phase and will use `mode: subscription` with
  `payment_method_collection: always`.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/payments/checkout
