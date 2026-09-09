# Estimation and Plan

## Sizing

Modified Fibonacci: 1, 2, 3, 5, 8, 13. Anything above 13 is split before it
enters a sprint.

| Points | Shape                                       |
| ------ | ------------------------------------------- |
| 1      | Trivial, understood, under an hour          |
| 2      | Small, one file, clear                      |
| 3      | Straightforward, a few files, known pattern |
| 5      | Moderate, some design needed                |
| 8      | Substantial, real design, several files     |
| 13     | Large. Split it if you can.                 |

Points are relative complexity, not hours. They are useful for the team's own
forecasting and useless for comparing teams.

## Velocity assumption

30 points per two-week sprint for the Phase 1 team of three engineers. This is
an assumption until three sprints have been measured; nothing downstream should
depend on it before then.

## Phase 1 plan

| Sprint | Weeks | Goal                                   | Stories           | Pts |
| ------ | ----- | -------------------------------------- | ----------------- | --- |
| 1      | 1–2   | Foundation and a walking skeleton      | A1 A2 A3 A4       | 23  |
| 2      | 3–4   | Customers, vehicles, and the ledger    | B1 B2 B3 B4 C1    | 31  |
| 3      | 5–6   | Passport integrity, sharing, transfer  | C2 C3 C4 C5       | 37  |
| 4      | 7–8   | Diary and the job engine               | D1 D2 D3 E1 E2 E3 | 47  |
| 5      | 9     | Inspection and estimate                | F1 F2 F3 G1 G2 G3 | 47  |
| 6      | 10    | Technician, invoice, portal, dashboard | H1 H2 I1 I2 J1 J2 | 42  |

Sprints 4 to 6 are deliberately heavier because the third engineer joins in
week 5 and the patterns are established by then. Sprint 3 is the risk: the
chain and its verification are the most novel work in the phase.

## Critical path

```
  Tenancy -> Vehicle -> Passport ledger -> Job -> Inspection -> Estimate
                                            |         |
                                            v         v
                                        Technician  Approval
                                            |         |
                                            +----+----+
                                                 v
                                              Invoice -> Payment
```

Nothing on this path can be parallelised away. The diary, the dashboard and the
portal can float; the chain cannot.

## Estimate confidence

| Area                  | Confidence | Why                                                                                                      |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Foundation, CRUD      | High       | Well-understood work                                                                                     |
| Diary                 | Medium     | Drag interaction is fiddly to get right                                                                  |
| Passport chain        | **Low**    | Novel. Concurrency and canonical serialisation are where the surprises live.                             |
| Inspection tablet UX  | **Low**    | Will need iteration against real technicians, and that is a feature of the plan rather than a flaw in it |
| Estimate and approval | Medium     | Clear, but the public-link security needs care                                                           |

The 15% contingency in the [proposal](../00-product/02-proposal.md) is held
against those two low-confidence areas specifically, and released on evidence
rather than on request.

## Tracking

Burndown per sprint, velocity trend across sprints. Both are for the team's own
forecasting.

Neither is a performance measure. The moment points are used to judge people,
they get inflated, and the team loses its only forecasting instrument.

---

_Next: [Risk register](04-risk-register.md)._
