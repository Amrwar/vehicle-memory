# API Contract

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

## 5. Versioning

The version is in the path. Additive changes (new fields, new endpoints) do not
bump it. Removals and semantic changes do, and a deprecated version is
supported for twelve months with `Sunset` headers.

## 6. OpenAPI

`docs/02-design/openapi.yaml` is the machine-readable contract and is generated
from the route handlers, so it cannot drift from the implementation (NFR-705).
It does not yet exist because the endpoints do not; it lands with Phase 3.5.

---

_Next: [Accounting model](07-accounting-model.md)._
