# The pilot

Four weeks in one workshop, which is what the [MVP
definition](../00-product/05-mvp-definition.md) has asked for since its first
page. Everything before this phase was evidence of effort. This is the first
evidence of fit, and it is the only kind that counts.

Nothing in this document is a prediction. It is what will be measured, who by,
and what would end the pilot early — written before it starts, because a
success criterion agreed afterwards is not a criterion.

---

## 1. What the pilot is not

It is not a demonstration, a trial, or a sales conversation. The workshop runs
its actual business on this for four weeks: real cars, real customers, real
money. If the answer to "what happens if it breaks on Tuesday" is not written
down here, the pilot is not ready to start.

It is also not a test of whether they like it. Liking it is pleasant and tells
you almost nothing. What is being tested is whether the work goes through it
faster than it went through whatever they used before, and whether the figures
at the end of the month are ones they trust.

## 2. Who

One workshop. Two to six people. Somewhere the owner is on the floor rather
than in an office, because the owner is the person who will notice what the
product costs them and the person who can decide to stop.

Not a friend. A friend will forgive things, and forgiveness is the one thing
this exercise cannot use.

## 3. Before the first morning

| What                            | Who      | Done when                                                    |
| ------------------------------- | -------- | ------------------------------------------------------------ |
| `npm run verify:pilot` passes   | Operator | Fifteen checks green: the four lists all have a source       |
| Their data is in                | Operator | Customers and vehicles imported; they have seen it and agree |
| Settings match the workshop     | Together | Sites, bays, hours, tax rates, job types, document numbering |
| Everyone has an account         | Owner    | Each person signs in as themselves — not one shared login    |
| `OPERATOR_EMAIL` is set         | Operator | An account opening sends mail; `/admin/health` is reachable  |
| The clock baseline is recorded  | Operator | `npm run verify:clock --record` on their data, on day zero   |
| They know how to reach a person | Together | A telephone number, not a form                               |

The last one matters more than the rest. A workshop that hits something at
half past eight on a Monday and cannot reach anybody will go back to paper by
half past nine, and will be right to.

## 4. What is measured, and from where

The exit asks for four lists. Each has a source that exists, and none of them
depends on anybody remembering.

| The list             | Where it comes from                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **What broke**       | `/admin/health` — errors, queues, every integration, and why any single message did not arrive      |
| **What was slow**    | `npm run verify:performance` for the screens; `/reports/clock` for the work itself                  |
| **What was missing** | The workshop, in their own words, at the weekly call — and the feature map for what was never built |
| **What nobody used** | `/reports/uptake`, counted from the audit log                                                       |

**The limit of the fourth, stated here so nobody is surprised by it.** Uptake
counts writing, not looking. A workshop that opens a vehicle's history forty
times a week and never adds to it reads as never having used it. Nothing
records who looked at what, deliberately: a record of that is a record of
being watched, and this product is not going to keep one.

## 5. The shape of the four weeks

**Week one — sit with them.** Not remote. Somebody watches the first ten jobs
go through and writes down every place a person hesitated. Hesitation is the
signal; complaints come later and are about the wrong things.

**Week two — leave them alone.** No visits, no prompting. The product either
holds up or it does not, and a week of being helped through it tells you
nothing about the fifth week.

**Week three — the awkward ones.** Deliberately walk through the cases from
[Phase 53](../00-product/06-roadmap.md): a customer who pays too much, a job
cancelled after the parts arrived, a car sold off the ramp. Each has a decided
behaviour; this is where it is found out whether the decision was the right
one for a person standing at a counter.

**Week four — the books.** The owner closes the month on it. `/books` says
whether the figures agree with themselves; the owner says whether they believe
them. Those are different questions and both have to be answered yes.

Weekly, thirty minutes, the same three questions: what did you have to work
around, what did you stop using, what did you do outside the product?

## 6. What would end it early

Written now, so that stopping is a decision rather than an argument.

- **Any loss of a workshop's data that a restore does not fully recover.**
  Phase 49 measured a recovery; this is the case where the measurement was
  wrong.
- **Any workshop seeing another workshop's records.** Phase 48 exists to make
  this impossible. If it happens, everything stops until it is understood.
- **The books not agreeing, and nobody able to say why.** A figure that is
  wrong is a bug. A figure that is wrong and unexplained is a product nobody
  should be running a business on.
- **The workshop going back to paper for a whole day.** Not a complaint — a
  verdict.

## 7. What success is

Not "they liked it". Three things, all measurable:

1. **The clock moved, or did not get worse.** The stretches recorded on day
   zero, measured again at the end, on the same window. `verify-clock
--against` compares them and refuses to compare figures taken from too
   little work.
2. **The books closed, and the owner believed them.** `/books` green, and the
   owner able to explain their own month from the figures without a
   spreadsheet beside them.
3. **They want to keep it.** Asked plainly, at the end, with the cost named,
   and with going back made easy — their data exported and theirs, whatever
   they decide. A yes given under friction is not a yes.

## 8. What happens to the findings

The four lists become the next roadmap, in that order: what broke first, what
was slow second, what was missing third, and what nobody used last — because
the last one is usually a question about whether it should have been built at
all, and that is a slower conversation than the other three.

---

_Previous: [Glossary](05-glossary.md)._
