# ADR-0006: First-party session authentication

**Status:** Accepted
**Date:** 2026-09-09

## Context

Four audiences authenticate: workshop staff, technicians on shared tablets,
portal customers, and anonymous readers holding a share link. The last is not
authentication at all but capability-bearing URLs, and it has to coexist with
the rest.

## Decision

A first-party session implementation:

- Password hashing with bcrypt at cost 12. Verification runs even when the
  account does not exist, so response time does not disclose whether an email
  is registered.
- Session token is 32 random bytes. Only its SHA-256 digest is stored, so a
  database disclosure does not hand over live sessions.
- Cookie is httpOnly, Secure in production, SameSite=Lax, with a server-side
  expiry that can be revoked.
- Rate limiting on both email and source address, recorded in
  `login_attempts`.
- Share links are separate: random tokens, stored hashed, scoped to one
  vehicle or one estimate, with an expiry and a revocation flag.

## Alternatives considered

| Option                                                | Why not                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth.js / NextAuth**                                | The obvious choice, and a good library. Rejected for this shape: credentials plus a database adapter is the combination it handles worst, credentials force JWT sessions which we do not want (we need server-side revocation), and the customisation needed for share links would leave us maintaining most of this anyway, with less clarity about what it does. |
| **A hosted identity provider (Auth0, Clerk, WorkOS)** | Strong option, and where we expect to end up. Rejected for launch because per-user pricing is hostile to a model where a workshop should be encouraged to give every technician an account, and because portal customers would multiply seats.                                                                                                                     |
| **JWT with no server-side session**                   | Cannot revoke. A technician leaves a shared tablet signed in and the token stays valid until expiry. Unacceptable on a shop floor.                                                                                                                                                                                                                                 |

## Migration path

This is a deliberate trade-off with a planned exit, not a permanent position.
The session interface (`currentUser`, `signIn`, `signOut`) is the only surface
the application touches. Moving to OpenID Connect in Phase 4 (FR-112) replaces
the implementations behind that interface without changing a single page.

## Consequences

- The surface is small, understood, and testable, and its behaviour under
  attack is ours to define.
- We own the responsibility for it. Password reset, email verification, and
  two-factor authentication are not free, and each is scoped work.
- Security review of this module before general availability is mandatory, not
  optional (NFR-413).
