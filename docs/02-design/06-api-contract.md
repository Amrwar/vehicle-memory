# API Contract

## 0. What exists today

Phase 18 shipped the first three endpoints, read-only, authenticated by an
organisation API key. Everything below §0 remains the contract for the surface
that does not exist yet, and where the two disagree, this section is what is
running.

| Method | Path                     | Returns                                                                                           |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/jobs`           | The organisation's jobs updated since a date, newest first, with customer, vehicle, invoices      |
| GET    | `/api/v1/invoices`       | The organisation's invoices updated since a date, with lines and payments, amounts as strings     |
| GET    | `/api/v1/vehicles/{vin}` | A vehicle's passport as the organisation is entitled to read it, other workshops' detail withheld |

**Authentication.** `Authorization: Bearer cn_…`. A key is minted on the
Settings page, shown once, stored as a SHA-256 digest, and belongs to one
organisation. Tenancy comes from the key and is never a parameter. A missing
header is `401`; an unknown or revoked key is `403` with `{ "error":
"REVOKED" }` or `{ "error": "UNKNOWN" }`. Every use stamps `lastUsedAt` on
the key so the list on the Settings page shows which keys are alive.

**Windows.** `since=YYYY-MM-DD` on the collections, defaulting to thirty days
back and capped at a year back, with at most two hundred rows per call. An
integration that wants more moves `since` forward. This is deliberately
simpler than the cursor pagination in §2 and will be replaced by it when a
consumer needs the stability cursors give.

**Entitlement.** The vehicle endpoint returns what a signed-in member of the
same organisation sees on the vehicle's page and nothing more. A vehicle the
organisation has no grant on is `404`, not `403`, so the endpoint does not
confirm which VINs are on the network. Entries recorded by another workshop
have `jobId`, `jobNumber`, `performedBy` and `inspectionId` removed from
their `detail` (`WITHHELD_KEYS` in `@carnet/core`); what was fitted, when,
at what mileage and how it was verified is never withheld. Each entry carries
`recordedBy` (the workshop's name) and `recordedHere`.

**Money.** Amounts are decimal strings (`"1509.00"`), never floats.

**Write access.** None, deliberately. The first integration that needs to
write will name what it needs to write, and that is the moment to design it.

`npm run verify:network` exercises all three endpoints against a database,
including the rate limit: a thousand calls an hour per key, then `429` with
`Retry-After` and `{ "error": "RATE_LIMITED" }` until the window resets.

## 1. Scope

Phase 1 has no public API. The application uses server components and server
actions, so there is no network hop between the page and its data, and no
client to keep in step.

This document defines the API for when there is one: the technician mobile app
(Phase 5), accounting integrations (Phase 3.5), and passport access for
insurers and dealers (Phase 4). Writing it now means the internal boundaries
are shaped by it rather than retrofitted to it.

## 2. Conventions

| Aspect      | Rule                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| Base        | `/api/v1`                                                               |
| Format      | JSON, UTF-8                                                             |
| Auth        | `Authorization: Bearer <token>`                                         |
| Tenancy     | Derived from the token. Never a parameter, so it cannot be forged.      |
| Times       | ISO 8601, UTC. `2026-09-09T15:30:00Z`                                   |
| Money       | `{ "amount": "1509.00", "currency": "GBP" }` as a string, never a float |
| Ids         | Opaque strings. Clients must not parse them.                            |
| Casing      | `camelCase`                                                             |
| Idempotency | `Idempotency-Key` header on POST; a repeat returns the original result  |

### Pagination

Cursor-based. Offset pagination skips or repeats rows when the underlying set
changes, which it constantly does in a live diary.

```
GET /api/v1/jobs?limit=50&cursor=eyJpZCI6ImNr...

{
  "data": [ ... ],
  "pagination": { "nextCursor": "eyJpZCI6...", "hasMore": true }
}
```

No endpoint returns an unbounded collection (NFR-111).

### Errors

RFC 9457 problem details, with a machine-readable code:

```json
{
  "type": "https://carnet.dev/errors/illegal-transition",
  "title": "Illegal job status transition",
  "status": 409,
  "code": "ILLEGAL_TRANSITION",
  "detail": "A job cannot move from Draft to Invoice. Permitted next steps: Booked, Vehicle received, Cancelled.",
  "instance": "/api/v1/jobs/ck7.../status"
}
```

The `detail` names what _is_ permitted. An error that only says no forces the
client to guess.

| Status | Meaning                                                                |
| ------ | ---------------------------------------------------------------------- |
| 400    | Malformed request                                                      |
| 401    | Missing or invalid token                                               |
| 403    | Authenticated, but the role lacks the permission                       |
| 404    | Not found, **or** outside your tenant. Deliberately indistinguishable. |
| 409    | Conflict: illegal transition, version mismatch                         |
| 422    | Validation failed. `errors[]` names each field.                        |
| 429    | Rate limited. `Retry-After` present.                                   |

## 3. Surface

### Jobs

| Method | Path                      | Permission        |
| ------ | ------------------------- | ----------------- |
| GET    | `/jobs`                   | `job:read`        |
| POST   | `/jobs`                   | `job:write`       |
| GET    | `/jobs/{id}`              | `job:read`        |
| PATCH  | `/jobs/{id}`              | `job:write`       |
| POST   | `/jobs/{id}/status`       | `job:write`       |
| GET    | `/jobs/{id}/timeline`     | `job:read`        |
| POST   | `/jobs/{id}/labour`       | `job:write`       |
| POST   | `/jobs/{id}/parts`        | `job:write`       |
| POST   | `/jobs/{id}/time-entries` | `timeentry:write` |

Status changes go through their own endpoint rather than `PATCH`, because a
transition is a domain operation with guards, not a field assignment.

```
POST /api/v1/jobs/{id}/status
{ "to": "COMPLETED", "note": "Road tested" }
```

### Vehicles and passport

| Method | Path                              | Permission                       |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/vehicles/{id}`                  | `vehicle:read` + vehicle access  |
| GET    | `/vehicles/by-vin/{vin}`          | `vehicle:read`                   |
| GET    | `/vehicles/{id}/passport`         | `passport:read` + vehicle access |
| GET    | `/vehicles/{id}/passport/verify`  | `passport:read`                  |
| POST   | `/vehicles/{id}/odometer`         | `vehicle:write`                  |
| POST   | `/vehicles/{id}/shares`           | `passport:share` (owner only)    |
| DELETE | `/vehicles/{id}/shares/{shareId}` | `passport:share`                 |

There is deliberately **no** endpoint that updates or deletes a passport event.
The API surface enforces the same append-only rule as the database.

### Inspections and estimates

| Method | Path                                   | Permission         |
| ------ | -------------------------------------- | ------------------ |
| POST   | `/jobs/{id}/inspections`               | `inspection:write` |
| PATCH  | `/inspections/{id}/results/{resultId}` | `inspection:write` |
| POST   | `/inspections/{id}/complete`           | `inspection:write` |
| POST   | `/inspections/{id}/to-estimate`        | `estimate:write`   |
| POST   | `/estimates/{id}/send`                 | `estimate:send`    |

### Public, token-authenticated

| Method | Path                                 | Auth           |
| ------ | ------------------------------------ | -------------- |
| GET    | `/public/passport/{token}`           | Share token    |
| GET    | `/public/estimates/{token}`          | Estimate token |
| POST   | `/public/estimates/{token}/decision` | Estimate token |

These are separate from the authenticated surface, rate limited harder, and
return a narrower projection with no personal details.

## 4. Webhooks

For integrations, signed with HMAC-SHA256 over the raw body, timestamped to
prevent replay.

| Event                     | When                             |
| ------------------------- | -------------------------------- |
| `job.completed`           | A job reaches COMPLETED          |
| `estimate.decided`        | A customer approves or declines  |
| `invoice.issued`          | An invoice is issued             |
| `payment.received`        | A payment is recorded            |
| `passport.event.appended` | An event is written to a vehicle |

Delivery is at-least-once with exponential backoff, so consumers must be
idempotent. `X-Carnet-Delivery-Id` is stable across retries.

### Inbound: the payment provider (Phase 32)

`POST /api/payments/webhook` is where the payment provider reports what became
of a checkout. It is verified by the provider behind the seam (Stripe's
`Stripe-Signature`; the stub's `X-Carnet-Signature`, an HMAC-SHA256 of the
body with `PAYMENT_WEBHOOK_SECRET`) and fails closed: 401 when unsigned or
unconfigured, 400 when signed and unreadable, 200 with `{ outcome }` otherwise,
where the outcome is `recorded`, `moved`, `unchanged` or `unknown`. Applying
an event is idempotent. Since Phase 32.6 the same endpoint reads the provider's
subscription events (`customer.subscription.*`, and a subscription-mode
`checkout.session.completed`) and its invoice events (`invoice.paid`,
`invoice.payment_failed`) for the workshop's own subscription; a subscription
event is followed by asking the provider for the whole record.

## 5. Versioning

The version is in the path. Additive changes (new fields, new endpoints) do not
bump it. Removals and semantic changes do, and a deprecated version is
supported for twelve months with `Sunset` headers.

## 6. OpenAPI

`docs/02-design/openapi.yaml` is the machine-readable contract and is generated
from the route handlers, so it cannot drift from the implementation (NFR-705).
Since Phase 21 it exists as `docs/02-design/openapi.json`, generated by
`npm run docs:openapi` from a registry beside the handlers
(`apps/web/src/lib/openapi.ts`) and served by the API itself at
`/api/v1/openapi.json`. CI runs `docs:openapi:check`, which fails when a route
file under `api/v1` has no entry in the registry or the committed copy is
behind it, so the document cannot drift from the implementation (NFR-705).

---

_Next: [Accounting model](07-accounting-model.md)._
