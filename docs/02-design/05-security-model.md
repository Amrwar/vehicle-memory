# Security Model

## 1. What we are protecting

| Asset               | If compromised                                  |
| ------------------- | ----------------------------------------------- |
| Cross-tenant data   | Reportable breach. Ends the business.           |
| The passport ledger | The product's central claim becomes false.      |
| Personal data       | Regulatory exposure, loss of customer trust.    |
| Financial records   | Fraud, and an unauditable ledger.               |
| Session tokens      | Account takeover on a shared shop-floor tablet. |

## 2. Authentication

Implemented in `apps/web/src/lib/auth.ts`, rationale in
[ADR-0006](../03-adr/0006-first-party-session-auth.md).

| Control             | Implementation                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Password storage    | bcrypt, cost 12, per-password salt                                                                           |
| Account enumeration | A hash comparison runs even when the account does not exist, so response time does not disclose registration |
| Session token       | 32 random bytes; only its SHA-256 digest is stored                                                           |
| Cookie              | httpOnly, Secure in production, SameSite=Lax                                                                 |
| Revocation          | Server-side. A session can be killed without waiting for expiry                                              |
| Idle expiry         | Configurable per organisation, 12 hours by default                                                           |
| Rate limiting       | 5 failures per 15 minutes, keyed on both email and source address                                            |

The shared-tablet case drove the revocation requirement. A technician who
leaves a tablet signed in must be removable, which a stateless JWT cannot do.

## 3. Authorisation

Two independent layers. Both must pass.

**Layer 1, permission.** `can(role, permission)`, deny by default. A permission
not explicitly granted is refused, so adding a capability cannot widen anyone's
access by accident.

**Layer 2, scope.** Holding a permission is necessary, never sufficient. A
customer with `passport:read` reads _their_ vehicles. The scoped query decides
which rows, and it is applied in the data-access layer rather than by the
caller.

```
  Request
    -> authenticated?          no -> 302 /login
    -> workshop read-only, and this writes?
                               yes -> /settings/subscription, with the reason
    -> role has permission?    no -> own surface, with the reason; audited
    -> plan allows it?         no -> refused where the thing is made, naming the plan
    -> row in scope?           no -> 404, never 403
```

The last line matters: a cross-tenant request by id returns **404**, so
existence is not disclosed.

**Layer 3, the plan and the subscription (Phase 31).** Holding the
permission and the row is still not enough if the workshop's plan does not
include the feature or has no room for one more of the thing. `assertPlanAllows`
and `assertWithinLimit` sit inside the function that creates or does it,
never only on the page, and the refusal carries the number and the plan that
would allow it. A workshop whose trial has lapsed past its fortnight of
grace, or that has cancelled, is read-only: every permission that writes is
turned away at the guard to the subscription page, and everything that reads
or exports still works. Nothing is deleted in any state.

**Tried, not trusted.** `infra/scripts/verify-authz.ts` reads every workshop
page from disk with the permission its page function asks for, mints a
session for every role, and opens every page as every role, expecting the
answer the table gives. It then reads every server action on every page and
fails on one that writes behind a reading permission, which is the mistake
it was written after finding twice. It runs against a built server before
each phase ships.

## 4. Tenant isolation

The most severe defect this system could have.
[ADR-0010](../03-adr/0010-tenant-isolation-in-data-layer.md) covers the
mechanism. Summary:

- `forOrg(orgId)` adds the tenant predicate to reads and stamps it on creates.
- `findUnique` is rewritten to `findFirst` with the predicate, so an id lookup
  cannot escape the tenant.
- The route guard hands back the scoped client, so there is no ergonomic path
  to an unscoped one.
- Cross-tenant isolation tests exist per entity; adding a model without one is
  a review failure.
- The authorisation probe asks for another organisation's customer, supplier
  and receipt by id as an owner, over HTTP, and expects not found.

**Known gap, stated rather than hidden:** `update` and `delete` by id are not
narrowed by the extension, because their `where` must address a unique row. The
convention is to load through the scoped client first. Row-level security in
Postgres is the intended successor and closes this.

## 5. The passport exception

Passport tables are deliberately not tenant-scoped
([ADR-0004](../03-adr/0004-vehicle-is-global.md)), which means they cannot rely
on the mechanism above. Access is explicit:

| Reader            | Basis                                                                   | Scope                                                   |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Workshop          | Has serviced the vehicle, has written to its passport, or holds a grant | Full history, subject to owner disclosure settings      |
| Current owner     | Ownership row                                                           | Full history, plus the access log                       |
| Previous owner    | Ownership row with an end date                                          | Read-only, limited to the period they owned it          |
| Share-link holder | Unguessable token                                                       | Read-only, no personal details, time-limited, revocable |
| Anyone else       | —                                                                       | Nothing                                                 |

Every share-link read is logged and visible to the owner (FR-410).

## 6. Public links

Estimate approval and passport sharing both hand a capability to someone with
no account. The token _is_ the credential, so:

- 32 random bytes, well beyond the 128 bits NFR-410 requires.
- Stored hashed. A database disclosure does not yield working links.
- Scoped to exactly one estimate or one vehicle.
- Expiring, with an explicit date shown to the reader.
- Revocable, taking effect immediately.
- Rate limited, so a token cannot be brute-forced.
- Never indexed: `robots: noindex` on every public page.

## 7. Organisation API keys and the network

Two things since Phase 18 let somebody read records without a signed-in person.

**API keys.** `Authorization: Bearer cn_…` on `/api/v1/*`. A key belongs to one
organisation, is minted on the Settings page by somebody with `settings:write`,
is shown exactly once, and only its SHA-256 digest is stored, so a database
disclosure does not yield working keys. Tenancy comes from the key and is never
a parameter. A missing header is 401; an unknown or revoked key is 403 and says
which. Every use stamps the key, so the list on Settings shows which are alive.
The surface is read-only by design; the first integration that needs to write
will name what it needs to write.

**The network.** A workshop that has never seen a vehicle may find it by plate
or VIN and is told that history exists, how much and who kept it, but not the
entries. Taking the car on grants read access on the grounds it is to be
serviced; opening a job widens that to write; both are audited. What it then
reads is the vehicle's history with the other workshop's commercial detail
withheld: job identifiers, internal job numbers, named staff and inspection
ids (`WITHHELD_KEYS` in `@carnet/core`). Nothing about the car is withheld.
A vehicle outside an organisation's entitlement is 404, not 403, on the API and
on the page, so neither confirms which VINs exist.

**Paperwork.** A vehicle's documents are readable and addable by any workshop
entitled to read the vehicle and by its current owner, and invisible to anybody
else. Removal is for the workshop that added a document or the owner, needs a
reason, and keeps the row. Files are stored on a short-lived signed ticket and
read back through signed URLs that expire in an hour.

### 7.1 The payment provider's webhook (Phase 32)

`/api/payments/webhook` records money, so it fails closed. The provider
behind the seam verifies its own signature scheme (Stripe's `t=…,v1=…` HMAC
over the timestamp and the raw body, with a five-minute tolerance against
replay; the stub's HMAC over the body with `PAYMENT_WEBHOOK_SECRET`), and with
no secret configured nothing is accepted. Unsigned or wrongly signed is 401.
An event for a checkout we do not know is acknowledged with 200 and ignored,
so the provider stops sending it and learns nothing. Applying an event is
idempotent: the attempt moves once, and a replay changes nothing. The
provider's key is read from the environment and never stored; the
customer's card never touches this system, because the checkout is the
provider's page.

### 7.2 The subscription, and consent to the charge (Phase 32.6)

The workshop's own card never touches Carnet: the provider's checkout takes
it, and Carnet stores the provider's references, the brand and the last
four digits. What Carnet does store, deliberately, is consent: the version
of the terms accepted at sign-up and when, because the sentence "the card is
charged when the trial ends unless you cancel" is the one a dispute turns
on. The same sentence appears on the form beside the button, on the terms
page, in the welcome email, in a reminder three days before, and on the
billing page, and the reminder is sent once and recorded. A provider's
subscription event is followed by asking the provider for the whole
record; a partial event never sets a card or a date on its own.

### 7.3 Data in, data out (Phase 33)

An import is the largest write a workshop ever makes and it goes through
the smallest door: every row is validated in core before anything is
written, and every row that passes is written through the same function
the page uses, so tenant scoping, duplicate refusal and the plan's limits
apply to an imported row exactly as to a typed one. The file is kept on the
organisation's own row, never on disk, and a batch cannot run twice.
Exports need only `settings:read`, which a read-only or cancelled workshop
keeps, because leaving with everything is a promise the terms make.

### 7.4 Signatures as evidence (Phase 35)

A signature is kept as the strokes that made it, not as a picture: a list
of points cannot be a pasted image of somebody else's signature, and it is
drawn back at any size. With it go the name given, the purpose, the member
of staff who captured it, the address and the device, the same evidence an
approval by link keeps. A dot, a stray touch or an empty pad is refused in
core before anything is written. Photographs at a check go to the store on
a short-lived ticket whose key names the organisation and the check, and
the row is written only once the store confirms the bytes, so a record
never points at a picture that is not there.

### 7.5 Search and notifications (Phase 39)

The search box is scoped to the workshop like every page: customers, jobs,
invoices, parts and suppliers by `orgId`, and a vehicle, which is global,
only when the workshop has a job on it or an unrevoked access grant, so a
plate typed into the box cannot read a car another workshop serviced. The
raw queries bind every value as a parameter. A notification is one person's
row; opening another person's returns nothing, and its path is refused
unless it is a path on this site.

### 7.6 Printed documents and PDFs (Phase 42)

A printed document is read through `readerFor`, which finds the document's
workshop first and then asks whether this person may read it: a member of
that workshop whose role holds the permission for the kind, a technician on
the job for its work order or key tag, or a customer whose portal login is on
the document for an invoice, quote or inspection report. Anybody else gets
not found. The PDF route asks the same question before a browser is started,
then renders the print page with only the reader's own session and language
cookies, on the site's own origin; a document the reader could not see as a
page cannot be made into a file. QR codes carry links to pages that require
their own sign-in; nothing is readable from the code alone.

### 7.7 Providers outside the product (Phase 43)

Three seams reach outside, and each is chosen by an environment variable with
a default that reaches nowhere. The VIN decoder built in and the sample
fitment feed answer from data inside the product. Named as `nhtsa`, the
decoder sends one VIN, and nothing else, to the US registry's public decoder
over TLS with a four-second timeout; a VIN is not personal data on its own,
nothing about the workshop, the owner or the job goes with it, and the answer
is cached against the VIN alone. What a decoder says fills a form and is
saved only when a person saves it, so a wrong answer cannot become a car's
history by itself.

A feed writes rows against a part and can never overwrite what somebody here
recorded; every row it writes is marked with the feed's name, so what a
catalogue claimed is always distinguishable from what a person claimed, and
the next fetch removes only its own. Rows that are not well formed are
dropped, and a run is capped per part, so a hostile or broken feed costs a
fetch rather than a catalogue.

The review site is a link, not an integration: no key, no account, nothing
sent. The workshop's Google place ID is checked against the shape of a place
ID in the product and again in the database, and the redirect refuses any
address that is not the review site's own, so a stored value cannot be turned
into an open redirect. Only an answer routed to a public invitation is sent,
and what the product learns is that the customer went, never what they wrote.

## 8. Input and output

| Control          | Implementation                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation | Zod schemas at every boundary. Client-side validation is a convenience, never a control.                                                                                                                                                |
| SQL injection    | Parameterised queries only. Raw SQL uses tagged templates.                                                                                                                                                                              |
| XSS              | React escapes by default. `dangerouslySetInnerHTML` is not used anywhere.                                                                                                                                                               |
| CSRF             | SameSite=Lax plus origin checking on state-changing requests.                                                                                                                                                                           |
| File upload      | Content-type and size validated, stored outside the web root, served through an authorising handler. Paperwork and photographs go straight to object storage on a five-minute signed ticket and are read through hour-long signed URLs. |
| Headers          | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.                                                                                                                                                                 |

## 9. Threat model

| #   | Threat                             | Mitigation                                                                    | Residual                                                                                          |
| --- | ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| T1  | Credential stuffing                | Rate limiting, bcrypt, no enumeration, breached-password check                | Weak passwords that have not leaked yet.                                                          |
| T2  | Cross-tenant access via id         | Data-layer scoping, 404 not 403                                               | The update/delete gap in section 4.                                                               |
| T3  | Session theft on a shared tablet   | Short idle expiry, server-side revocation                                     | Physical access to an unlocked tablet.                                                            |
| T4  | Share-link leakage                 | Expiry, revocation, no personal details                                       | A forwarded link works until it expires. Accepted: it is what sharing means.                      |
| T5  | Ledger tampering by an insider     | Append-only trigger, hash chain, salt                                         | Someone with both database write access and the salt. Mitigated by external anchoring in Phase 5. |
| T6  | Malicious file upload              | Type and size validation, served through a handler                            | Content-level malware. Add scanning before general availability.                                  |
| T7  | VIN collision merging two vehicles | Format and check-digit validation, duplicate warning                          | A determined mistype. On the risk register.                                                       |
| T8  | Denial of service                  | Rate limiting, pagination on every list, a thousand API calls an hour per key | Volumetric attack. Handled at the edge.                                                           |

## 10. Privacy: erasure and the vehicle

The subtle case, and the one most likely to be got wrong.

When Maria sells her car and asks to be forgotten, two things are true at once:
her personal data must go, and the fact that the brake discs were replaced at
82,430 km must remain, because that belongs to the vehicle.

| Data                                         | On erasure                                                       |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Name, email, phone, address                  | Removed                                                          |
| Customer record                              | Anonymised, commercial history retained for the statutory period |
| `VehicleOwnership.ownerName`                 | Replaced with "Previous owner"                                   |
| `VehicleOwnership` dates                     | Retained. Ownership duration is the vehicle's record.            |
| Passport events                              | Retained in full. They describe the vehicle, not the person.     |
| Photographs of components                    | Retained                                                         |
| Photographs incidentally containing a person | Reviewed and removed on request                                  |

The passport ledger is append-only, so erasure cannot delete events. It
supersedes those carrying personal identifiers with redacted versions, which
keeps the chain intact and the fact preserved.

## 11. Before general availability

- [ ] Penetration test, high findings resolved (NFR-413)
- [x] Dependency scanning blocking on critical (NFR-409): `npm audit --audit-level=critical` in CI
- [x] Secret scanning in CI: the committed-secrets check in the audit job
- [ ] Security review of `lib/auth.ts` by someone who did not write it
- [x] Backup restoration tested end to end: `verify-backup.ts`, on every push (Phase 21)
- [ ] Incident response runbook exercised
- [x] Content Security Policy with per-request nonces on every page (Phase 21)
- [x] Breached-password check at every point a password is set (Phase 21)
- [x] Rate limit on organisation API keys (Phase 21)

The threat model's residuals move accordingly: T1's "add a breached-password
check" is done; T8 gains a per-key limit; T6, content scanning of uploads,
still waits on a provider.

---

_Next: [API contract](06-api-contract.md)._
