# Glossary

The ubiquitous language. Terms are used in code exactly as defined here. Where
the trade uses a word loosely, we pick one meaning and hold it.

| Term | Definition |
| --- | --- |
| **Advisory** | An inspection finding that needs attention but is not unsafe. Presented to the customer as an optional line. |
| **Approval** | A recorded customer decision on an estimate, with timestamp, source address and the exact total agreed. |
| **Bay** | A physical work position. Constrains scheduling. Not a location. |
| **Booking** | A reserved future slot. Becomes a Job on arrival. |
| **Chain** | The hash-linked sequence of a vehicle's events. Verifiable, append-only. |
| **Chain head** | The hash of a vehicle's most recent event. Shown as a short fingerprint. |
| **Critical** | An inspection finding that makes the vehicle unsafe or illegal. |
| **Customer** | A party in a commercial relationship with one workshop. Not necessarily the owner. |
| **Diagnosis** | The technician's conclusion about a fault. Distinct from an inspection. |
| **Estimate** | A priced proposal requiring customer approval. Immutable once sent. |
| **Event** | One immutable fact about a vehicle at a point in time. |
| **Finding** | One inspection item result requiring action. |
| **Idempotency key** | A stable identifier derived from an event's cause, so a retry cannot duplicate history. |
| **Inspection** | A structured assessment producing per-item results. Distinct from a diagnosis. |
| **Job** | One visit's work on one vehicle. The central aggregate. |
| **Job type** | A category of work, carrying default hours and whether quality control is required. |
| **Labour line** | Time to be **charged**, at a rate. Distinct from a time entry. |
| **Location** | A physical site within an organisation. |
| **Minor units** | Integer pence or cents. How money is represented everywhere. |
| **Organisation** | The tenant. One business. |
| **Outbox** | The table domain events are written to in the same transaction as the state change. |
| **Owner** | The party holding the vehicle during a period. May not be a customer of anyone. |
| **Part line** | A part to be charged on a job. Distinct from a stock movement. |
| **Passport** | The complete, append-only event history of one vehicle. |
| **Reservation** | Stock committed to a job but not yet consumed. |
| **Severity** | Pass, Advisory, Critical or Not checked. |
| **Superseding event** | A correction. Appended, referencing the original, which remains visible. |
| **Time entry** | Actual clocked time, used for **cost**. Distinct from a labour line. |
| **Verification level** | How well evidenced an event is: self-reported, workshop-recorded, workshop-verified, or authority. |
| **VIN** | Vehicle Identification Number. 17 characters. The primary identity of a vehicle, globally. |

## Two distinctions worth the ink

**Labour line versus time entry.** The customer is charged 3.5 hours because
that is the book time. The technician actually took 4.2. Both are true and both
are needed: the first is revenue, the second is cost. Conflating them makes
profitability unmeasurable, which is exactly the failure of the incumbent
systems.

**Customer versus owner.** A fleet operator is the customer; the driver may be
the registered keeper; a finance company may be the legal owner. The passport
tracks ownership. The workshop tracks who pays.

---

*Back to the [documentation index](../README.md).*
