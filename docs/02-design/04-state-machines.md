# State Machines

Four objects have a lifecycle worth drawing. Each is enforced in the domain
layer, not in the interface, so an API client or a background job cannot make a
transition a person could not.

## 1. Job

Implemented in `packages/core/src/job/lifecycle.ts`, 40 tests.

```
                          +-------+
                          | DRAFT |
                          +---+---+
                              |
              +---------------+---------------+
              v                               v
          +--------+                     +----------+
          | BOOKED |-------------------->| RECEIVED |
          +--------+                     +----+-----+
                                              |
                        +---------------------+------------------+
                        v                     v                  v
                 +------------+        +-----------+      +-------------+
                 | INSPECTING |------->| DIAGNOSED |----->| IN_PROGRESS |
                 +-----+------+        +-----+-----+      +------+------+
                       |                     |                   ^
                       +------> +-----------+ <------------------+
                                | ESTIMATED |
                                +-----+-----+
                                      |
                          +-----------+-----------+
                          v                       v
               +-------------------+        +----------+
               | AWAITING_APPROVAL |------->| APPROVED |
               +-------------------+        +----+-----+
                                                 |
                                                 v
                                          +-------------+
                                          | IN_PROGRESS |
                                          +------+------+
                                                 |
                                                 v
                                        +---------------+
                                        | QUALITY_CHECK |
                                        +-------+-------+
                                                |
                                                v
                                          +-----------+
                                          | COMPLETED |
                                          +-----+-----+
                                                |
                                                v
                                          +----------+     +------+
                                          | INVOICED |---->| PAID |
                                          +----------+     +------+

  CANCELLED is reachable from every status before COMPLETED, and from none
  after: once an invoice exists the correction is a credit note.
```

### Two properties worth defending

**Backwards transitions are legal.** A technician who starts work and finds a
second fault can return the job to `DIAGNOSED`. Workshops are not assembly
lines, and a state machine that only moves forward gets worked around by never
advancing it, after which the status field means nothing.

**Guards explain themselves.** A refused transition returns a code and a
message naming what is missing, so the interface can say "this job type
requires a quality check" rather than merely disabling a button.

| Guard                    | Rule                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `QUALITY_CHECK_REQUIRED` | `COMPLETED` refused when the job type demands a check and none passed |
| `APPROVAL_REQUIRED`      | `IN_PROGRESS` refused from `AWAITING_APPROVAL` without approval       |
| `NOTHING_TO_INVOICE`     | `INVOICED` refused with no chargeable lines                           |
| `TERMINAL_STATUS`        | Nothing leaves `PAID` or `CANCELLED`                                  |

## 2. Estimate

```
   +-------+   send    +------+
   | DRAFT |---------->| SENT |
   +---+---+           +--+---+
       |                  |
       |     +------------+------------+-------------+
       |     v            v            v             v
       |  +----------+ +--------------------+ +----------+ +---------+
       |  | APPROVED | | PARTIALLY_APPROVED | | DECLINED | | EXPIRED |
       |  +----------+ +--------------------+ +----------+ +---------+
       |
       |  revise
       +---------> a NEW estimate at version + 1;
                   the previous becomes SUPERSEDED and stays visible
```

A sent estimate is never edited. Revision creates a version, and both remain
readable, because "what exactly did we send them, and when" is the question
that ends a dispute at the collection desk.

Approval records a snapshot: the exact total agreed, the timestamp, the source
address, and the name given. That snapshot does not move if a price list is
edited afterwards.

## 3. Invoice

```
   +-------+  issue   +--------+  part payment  +-----------+
   | DRAFT |--------->| ISSUED |--------------->| PART_PAID |
   +-------+          +---+----+                +-----+-----+
                          |                           |
                          |  full payment             | balance cleared
                          +------------+  +-----------+
                                       v  v
                                     +------+
                                     | PAID |
                                     +------+

   ISSUED --(error found)--> VOID, corrected by a CreditNote.
   An issued invoice is never edited.
```

`PAID` is derived from the sum of payments, not set directly. A status that can
be set independently of the payments behind it will eventually disagree with
them.

## 4. Stock reservation (Phase 2)

```
   part added to job
          |
          v
     +----------+   stock available    +----------+
     | REQUESTED|--------------------->| RESERVED |
     +----+-----+                      +----+-----+
          |                                 |
          | short                           | job completed
          v                                 v
     +----------+   received           +--------+
     | ON_ORDER |--------------------->| FITTED |
     +----------+                      +--------+
                                            |
                                            | returned
                                            v
                                       +----------+
                                       | RETURNED |
                                       +----------+
```

Reservation happens under a row lock, because available stock is on-hand minus
reserved and two jobs must not both reserve the last set of pads.

## 5. Payroll run (Phase 16)

```
   approved timesheets, one period
              |
              v
        +-----------+   file produced   +----------+   marked paid   +------+
        |   DRAFT   |------------------>| EXPORTED |---------------->| PAID |
        +-----------+                   +----------+                 +------+
```

A run cannot be marked paid until its file has been produced, because paying
against a file nobody has seen is how a person is paid twice. Marking it paid
marks every sheet on it paid and posts gross wages against the bank; a paid
sheet is then final, and the database refuses to change it.

## 6. A document's life (Phase 20)

```
   file stored on a signed ticket
              |
              v  row recorded only once the bytes are confirmed
        +-----------+   removed, with a reason    +-----------+
        |   LIVE    |---------------------------->|  REMOVED  |
        +-----------+                             +-----------+
```

There is no way back. A removed document keeps its row, its reason and its
audit entry; a corrected scan is a new document. Only the workshop that added
it or the vehicle's owner may remove it.

## 7. Why these are in the domain layer

Every one of these could have been expressed as conditional rendering. Putting
them in `packages/core` buys three things:

1. They are tested without a database or a browser, in milliseconds.
2. The worker and the web tier cannot disagree about what is legal.
3. A refusal carries a reason, which is what lets the interface be helpful
   rather than merely restrictive.

---

_Next: [Security model](05-security-model.md)._
