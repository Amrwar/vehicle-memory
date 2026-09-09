# Personas

Six people use this system. They have almost nothing in common, and designing
one interface for all of them is the single most common way workshop software
fails.

The governing rule: **do not make technicians use the ERP, and do not make the
accountant learn the shop floor.** Same data, different surfaces.

---

## P1 — Ahmed, Workshop Owner

**45. Owns a 6-bay independent workshop. Was a mechanic for 18 years before he
bought the business.**

He opens the laptop at 7:40am and again at 6:15pm. In between he is on the
floor. He is not going to learn an accounting package.

|                                   |                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**                         | To know, without asking anyone, whether today is going well and whether this month is profitable.                                                             |
| **Actually does**                 | Checks what is booked, chases the three jobs waiting on customer approval, worries about the two technicians who are idle, signs off purchase orders.         |
| **Frustrations**                  | "I know my revenue. I do not know my profit until my accountant tells me in March." Parts markup guessed rather than measured. No idea which jobs lose money. |
| **Success looks like**            | Job-level profitability visible the day the job closes. Knowing which technician, which job type and which part line actually makes money.                    |
| **Where he lives in the product** | Workshop dashboard, approvals queue, financial overview                                                                                                       |
| **Design implication**            | The dashboard must be **action-oriented, not a wall of charts.** Every number is a link to the thing he can do about it.                                      |

---

## P2 — John, Technician

**32. Ten years on the tools. Hands are dirty, gloves are on, phone is in a
locker. Uses a wall-mounted tablet.**

He is the single most important user in the system, because he generates the
data everything else depends on, and he is the least willing to fight software
for it.

|                        |                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**              | To be told which car is his, do the work, and record it in under a minute.                                                                                                                                 |
| **Actually does**      | Reads the job, inspects, finds three things wrong, tells the service advisor verbally, does the work, writes nothing down.                                                                                 |
| **Frustrations**       | Typing on a greasy touchscreen. Forms with 20 fields. Being asked for information the office already has. Losing work when the tablet sleeps.                                                              |
| **Success looks like** | Big touch targets, three taps to log an inspection item, photo capture in one tap, no mandatory typing.                                                                                                    |
| **Where he lives**     | Technician interface: my jobs, job tasks, inspection, add photo, request part, complete                                                                                                                    |
| **Design implication** | **Minimum 48px touch targets. No modal that can lose work. Offline-tolerant. Voice-to-text on every note field.** If it takes 30 seconds it will not be done, and if it is not done the passport is empty. |

---

## P3 — Sara, Service Advisor

**29. Front desk. On the phone constantly. The bottleneck of the entire
workflow, and the person incumbent software serves worst.**

|                        |                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**              | To turn an inspection finding into an approved estimate without playing telephone tag for two hours.                                                                                         |
| **Actually does**      | Takes bookings, checks cars in, rings customers to explain findings, chases approvals, explains the invoice, books the next visit.                                                           |
| **Frustrations**       | Customers who do not answer. Re-typing inspection findings into a quote. No record of what was agreed verbally, then arguing about it at collection.                                         |
| **Success looks like** | Inspection findings become estimate lines in one click. Estimate goes out by SMS. Customer taps approve. The job moves itself.                                                               |
| **Where she lives**    | Diary, job list, job detail, estimate builder, customer communication                                                                                                                        |
| **Design implication** | **The inspection-to-estimate-to-approval path is the highest-value flow in the product.** It must be fast, and every approval must leave an audit trail that ends collection-desk arguments. |

---

## P4 — Maria, Vehicle Owner

**38. Two cars, one of them her partner's. Knows nothing about cars and does
not want to.**

|                        |                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**              | To not be ripped off. To understand why £1,280 is being asked of her.                                                                                                                 |
| **Actually does**      | Receives a phone call full of terms she does not understand, says yes because she has no basis to say no, feels uneasy.                                                               |
| **Frustrations**       | Cannot see what is wrong with the car. Cannot compare. No record of what was done last time. Loses receipts.                                                                          |
| **Success looks like** | A photograph of her own brake pads next to a photograph of a good one. A clear price. A button. A history she can actually read.                                                      |
| **Where she lives**    | Customer portal, estimate approval, vehicle passport                                                                                                                                  |
| **Design implication** | **Photographic evidence is the trust mechanism.** No jargon without a plain-language explanation. The approval screen must work on a phone, in a supermarket car park, in 30 seconds. |

---

## P5 — David, Used-Car Buyer

**Buying a private-sale car for £14,000. Standing in a stranger's driveway with
his phone out. He is not a customer of any workshop — he is the reason the
passport has value.**

|                        |                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**              | To know whether this specific car has been looked after.                                                                                                                                                                                  |
| **Actually does**      | Looks at a service book that may be forged, an advert that says "full service history", and takes a guess.                                                                                                                                |
| **Frustrations**       | Mileage he cannot verify. Accident damage he cannot see. "Full service history" that means four stamps and no detail.                                                                                                                     |
| **Success looks like** | A link. A timeline. Twenty years of dated, attributed, tamper-evident events, including the mileage at each one.                                                                                                                          |
| **Where he lives**     | Shared vehicle passport, read-only, time-limited                                                                                                                                                                                          |
| **Design implication** | **He arrives with no account and leaves within minutes.** The passport must be comprehensible cold, on a phone, with no onboarding, and must make its own trustworthiness legible: who recorded this, when, and can it have been altered. |

---

## P6 — Fatima, Bookkeeper

**Part-time, two days a week, possibly external. Cares about exactly one thing:
whether the numbers are right.**

|                        |                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants**              | A ledger that balances and a trial balance she can hand to an accountant.                                                                                        |
| **Actually does**      | Exports invoices to a spreadsheet, re-keys them into accounting software, reconciles the bank, chases debtors.                                                   |
| **Frustrations**       | Double entry of the same facts. Stock value that never matches the accounts. Being unable to explain a figure.                                                   |
| **Success looks like** | Every operational event already posted correctly. Her job becomes review and exception handling, not data entry.                                                 |
| **Where she lives**    | Ledger, AR and AP, bank reconciliation, financial statements                                                                                                     |
| **Design implication** | **Every posted figure must be traceable to the operational event that caused it, in one click.** An unexplainable number is a defect, not a rounding difference. |

---

## Interface segregation

```
                      SHARED DATA CORE
                            |
    +---------------+-------+--------+----------------+
    |               |                |                |
 SHOP FLOOR      FRONT DESK      BACK OFFICE      PUBLIC
 (tablet)        (desktop)       (desktop)        (phone)

 John            Sara            Ahmed            Maria
                                 Fatima           David

 My jobs         Diary           Dashboard        My vehicles
 Tasks           Job detail      Approvals        Estimate approval
 Inspection      Estimates       Reports          Invoices + pay
 Photos          Invoices        Ledger           Vehicle passport
 Request part    Customers       Purchasing       Book service
 Complete        Portal comms    Payroll          Share history

 Large touch     Dense,          Dense,           Zero-training,
 targets,        keyboard-       analytical,      mobile-first,
 gloves on       driven          exportable       no account for David
```

Four distinct interface characters. One schema. This separation is a hard
architectural constraint, recorded in
[ADR-0009](../03-adr/0009-role-segregated-interfaces.md).

---

_Next: [MVP definition](05-mvp-definition.md)._
