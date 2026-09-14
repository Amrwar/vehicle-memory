# Business Model

## 1. Two revenue lines

|              | Carnet Workshop                 | Carnet Passport                       |
| ------------ | ------------------------------- | ------------------------------------- |
| **Who pays** | Workshops                       | Vehicle buyers, dealers, insurers     |
| **What for** | Running the business            | Verified history at the point of sale |
| **Model**    | Subscription, per bay per month | Per report, or per-seat for trade     |
| **Starts**   | Month 5                         | Month 18                              |
| **Role**     | Funds the company               | Makes the company valuable            |

The relationship between them is the whole strategy: **line one generates the
inventory that line two sells, at zero marginal data-entry cost.**

## 2. Workshop pricing

Per bay per month, billed annually or monthly. Bays, not users, because bays
correlate with capacity and revenue while user count punishes workshops for
giving staff access, which is exactly the opposite of what we want.

| Tier         | Price / bay / month | Includes                                                                                                                     |
| ------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Core**     | £39                 | Diary, jobs, customers, vehicles, inspections, estimates, invoicing, technician interface, customer portal, passport writing |
| **Complete** | £69                 | Core plus inventory, purchasing, suppliers, general ledger, financial statements, job profitability                          |
| **Group**    | £99                 | Complete plus multi-location, consolidated reporting, stock transfer, commissions, priority support                          |

Rationale for the shape:

- **Nothing important is behind a paywall in Core.** The customer portal and
  passport writing are in the cheapest tier deliberately. Restricting them
  would throttle the network we are trying to grow, to protect revenue we have
  not earned.
- **The upsell is the ERP**, which is where our build cost is and where the
  value to a growing workshop is obvious.
- A 6-bay workshop pays £234/month on Core, £414 on Complete. That is
  defensible against the value of knowing which jobs are profitable.

**Free tier:** none for workshops. Free workshop tiers attract customers who
will never pay and generate support load. Instead, a 14-day trial with full
functionality, a card taken before it starts and charged when it ends unless
the workshop cancels first (Phase 32.6). The charge is stated on the sign-up
form, in the terms, in a reminder three days before, and on the billing page:
a trial that turns into a charge quietly is a refund and a chargeback, not
revenue.

**These figures are enforced, not described.** The table above is transcribed
into `packages/core/src/billing/plans.ts`, which is what the pricing page
renders and what the application checks when a workshop reaches a limit. The
two are asserted equal by `billing.test.ts`: a six-bay workshop pays £234 on
Core and £414 on Complete, and the test fails if either figure moves without
this document moving with it. A price list maintained separately from the
limits it describes drifts within a month, and the first person to notice is a
customer who was promised something the system refuses to do.

## 3. Passport pricing

**Free forever for the vehicle owner.** Always. An owner reading and sharing
their own vehicle's history is the mechanism by which the network becomes
valuable. Charging for it would be charging for our own distribution.

| Product                           | Price         | Buyer                             |
| --------------------------------- | ------------- | --------------------------------- |
| Owner access to own vehicles      | Free          | Every owner                       |
| Share link to a prospective buyer | Free          | Seller                            |
| **Verified Buyer Report**         | £14.99        | Private buyer                     |
| Trade seat, unlimited reports     | £99/month     | Used-car dealers                  |
| API access                        | Volume-priced | Insurers, auction houses, finance |

The Verified Buyer Report is a formal document with the tamper-evidence proof,
mileage consistency analysis, service-interval adherence, outstanding recalls
and a named-workshop attribution for every event. It is what the free share
link is not: portable, dated, and defensible in a dispute.

## 4. The revenue share

This is the mechanism that makes contribution rational rather than altruistic.

**When a Verified Buyer Report is sold, 30% of net revenue is distributed among
the workshops whose verified events populate that vehicle's timeline**,
weighted by event count and recency.

```
   Verified Buyer Report sold                    £14.99
        |
        +--- payment processing + tax           -£1.20
        |
        v
   Net revenue                                   £13.79
        |
        +--- 70% Carnet                           £9.65
        |
        +--- 30% contributor pool                 £4.14
                    |
                    +-- Workshop A (11 events, recent)   £2.40
                    +-- Workshop B (5 events)            £1.09
                    +-- Workshop C (2 events, old)       £0.65
```

Why this matters more than the money involved:

1. It reframes the ask. We are not asking a workshop to give away data. We are
   offering them a second revenue line for work they already do.
2. It answers the competitive objection directly. "Why would I help the garage
   down the road?" Because you get paid, and because the report names you as
   the workshop that looked after the car well.
3. It is a commitment device. Publishing the share rate makes it costly for us
   to change later, which is precisely what makes it credible now.

Amounts per report are small. The signal is not.

## 5. Unit economics

Modelled on a 6-bay workshop on Complete at £414/month.

| Line         | Value                   | Note                                                         |
| ------------ | ----------------------- | ------------------------------------------------------------ |
| ARPA         | £414/month, £4,968/year |                                                              |
| Gross margin | ~82%                    | Hosting, storage, SMS, email, payment fees                   |
| CAC          | £1,400                  | Assumes inside sales plus onboarding effort                  |
| Payback      | ~4.1 months             | On gross profit                                              |
| Annual churn | 12% assumed             | Workshop software is sticky once the diary is in it          |
| Lifetime     | ~8.3 years              |                                                              |
| **LTV**      | **~£33,800**            |                                                              |
| **LTV:CAC**  | **~24:1**               | High because churn is low; sensitive to the churn assumption |

The churn assumption is the fragile one. A workshop that has put its diary,
its history and its ledger into a system does not casually leave, but this is
an assumption until we have measured it. It is on the
[risk register](../05-project/04-risk-register.md).

## 6. Go to market

**Phase A, months 1–6. Design partners.** Two workshops, free, in exchange for
access and honesty. We are buying product truth, not revenue.

**Phase B, months 5–12. Local density.** Sell within one geography until we
have enough workshops that vehicles start arriving with existing history. That
moment, when a workshop opens a car it has never seen and finds three years of
records already there, is the product demonstrating itself. Density beats
breadth, and a national scatter of isolated workshops would never produce it.

**Phase C, months 12–24. The owner pull.** Once passports have content, market
to owners. An owner who values their vehicle's history asks their workshop for
it, and that converts workshops at a far lower cost than outbound sales.

**Phase D, months 24+. The trade.** Dealers, auctions, insurers and finance
providers. They pay the most and require the least support, but only once
coverage is real. Selling to them earlier would burn the relationship on a
product that cannot yet deliver.

## 7. What would make this wrong

Held honestly, because a business model document that only argues for itself is
worthless.

| Assumption                                                              | If false                                                                     | Detected by                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| Workshops will pay a premium over incumbents for accounting integration | Compress to a single £45 tier and compete on the passport alone              | Design-partner pricing validation, week 20   |
| Local density is achievable at reasonable CAC                           | The network effect never ignites; we are a workshop SaaS with a nice feature | CAC and density tracking through months 5–12 |
| Buyers will pay for a report when free share links exist                | Passport revenue never materialises; the moat is defensive only              | First paid-report cohort, month 18           |
| Churn is near 12%                                                       | LTV drops sharply and the CAC budget must shrink                             | Cohort retention from month 12               |
| Workshops are not actively hostile to data portability                  | Adoption stalls on principle rather than product                             | Design-partner interviews, week 6            |

The last one is the one to watch early. It is a belief about attitude, not
about software, and it is cheap to test in conversation long before it is
expensive to discover in the market.

---

_Next: [Functional requirements](../01-requirements/01-functional-requirements.md)._
