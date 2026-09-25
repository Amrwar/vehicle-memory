# ADR-0015 — The status line and the loading screen

**Status.** Accepted, Phase 73 (24 September 2026).

**Context.**

`loading.tsx` draws a Suspense boundary over every route beneath it. A boundary
flushes: the status line, the headers and the loading screen go out as soon as
the page underneath suspends, and an async server component suspends on its
first `await`. By the time that page calls `notFound()` the response has begun,
and a response that has begun is a 200.

Next still swaps the body for the not-found page, which is why this went
unnoticed for months — every screen looked right. What was wrong was the thing
only a machine reads. A revoked passport share link, a used handover link, and
a car that was not yours each answered **200 OK** with a page saying the record
was not there. CI had an assertion for exactly this on one route, and it had
been failing.

There is no way to hold the status open once the shell has gone. `notFound()`
in `generateMetadata` does not help either: metadata streams too. The only fix
is structural — the decision has to happen before any boundary.

**Decision.**

A page that has to be able to say "there is nothing here" does not sit under a
loading boundary. It asks the cheap question first — one indexed read, in the
page itself, outside any boundary — and draws its own `<Suspense>` around the
slow half. The loading screen is unchanged for the reader; the status is
correct for everything else.

Where a whole segment used to have one boundary over it, the boundary moves
down to the routes that have nothing to decide. `portal/loading.tsx` became one
shared component re-exported by the nine portal routes that cannot 404, and a
route group for the customer's home page so that its address did not change.

**The exception, and its limit.**

Three segments keep a boundary above pages that call `notFound()`:

- `(workshop)`
- `shop`
- `admin`

All three are the signed-in application shell — the workshop's screens, the
technician's phone view of them, and the operator's. Reaching a bad id there means a
person, with a session, following a stale link inside the product, and what
they need is the page that says so — which they get. Nothing machine-readable
consumes those URLs: they are not shared, not crawled, not linked from outside.
One loading screen over a hundred screens is worth more there than a status
code with no audience.

That is a judgement about who is reading, not a general licence. Any other
segment that wants the same shelter has to be added to the list above, which is
the list `infra/scripts/verify-status.ts` reads — so widening the exception
means writing down why, here, where the reason can be argued with.

**Consequences.**

- Three public routes and two portal routes now answer 404, in the status as
  well as the words.
- `verify-status.ts` reads the route tree and fails if a page that can answer
  404 sits under a boundary outside the shelters named above. It needs neither
  a database nor a running application, because the route tree is the thing
  that decides.
- A new public route that can 404 will fail that check the day it is added,
  rather than the month somebody runs a link checker.
