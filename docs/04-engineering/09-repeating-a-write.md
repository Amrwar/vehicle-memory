# Doing it twice

<!-- Written by `npm run verify:writes -- --write` from the markers in the code. Do not edit by hand. -->

Every write below can be asked for twice, and most of them eventually are.
A person on a slow connection presses the button again because nothing
happened. A page is refreshed mid-submit. Two workers overlap during a
deploy. A provider retries a webhook it never got an answer to. A process is
killed between doing the work and writing down that it did.

So each one says what the second time does. There are only three honest
answers, and the difference between the middle one and the last one is not a
judgement: a guard is a thing in the code or the database that another person
can read. "The user would not do that" is not a guard.

|                  |                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Harmless**     | The second one changes nothing.                                                                                    |
| **Guarded**      | The second one is stopped by something named here.                                                                 |
| **Would repeat** | The second one would do it again. Nothing may ship in this state, and the check refuses to pass while anything is. |

Today: **59** writes that move money or stock — 50 guarded,
9 harmless, 0 that would repeat.

The list is scoped deliberately. Not every write in the product is here: a
note saved twice is a note, and a register long enough to include it is one
nobody reads the important half of. What is here is everything that can cost
somebody money or take a part off a shelf.

This page is written from markers in the code by
`npm run verify:writes -- --write`, and the same check fails the build when a
function in one of these files writes without one. A document drifts and
nobody notices; a marker drifts and the next person to add a function finds
out immediately.

## Bills and the money against them

`money.ts`

| Write               | Twice   | What stops it                           | What the second one does                                                                                                                                                                            |
| ------------------- | ------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moveJob()`         | Guarded | `the lifecycle has no self-edge`        | Moving a job to the status it is already in is refused, so a second move does nothing and says why.                                                                                                 |
| `issueInvoice()`    | Guarded | `the job already has an invoice`        | The second attempt is refused with ALREADY_INVOICED rather than billing the customer twice for one job.                                                                                             |
| `recordPayment()`   | Guarded | `the form key its callers hand to once` | Two cash payments of the same amount on one bill are two real payments, so nothing inside this can tell them apart. The form that sent it can: the same press carries the same key and is absorbed. |
| `raiseCreditNote()` | Guarded | `the form key its callers hand to once` | A second note takes a fresh number and would reverse the revenue again, so the key the form carries is what stops one press doing it twice.                                                         |
| `recordRefund()`    | Guarded | `the form key its callers hand to once` | Held off locally by the form key; the money itself is held off at the provider too, which is sent an idempotency key built from the bill, the note and the amount.                                  |

## The counter

`counter.ts`

| Write            | Twice   | What stops it                           | What the second one does                                                                                                                                  |
| ---------------- | ------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completeSale()` | Guarded | `the form key its callers hand to once` | A second press would take the parts off the shelf again and charge again. A counter is where second presses actually happen, so the key is on the button. |
| `closeTill()`    | Guarded | `the session already has a closedAt`    | A till closed twice is not found the second time and answers that it is already closed.                                                                   |

## Coupons

`coupons.ts`

| Write            | Twice    | What stops it                                 | What the second one does                                                                                                                              |
| ---------------- | -------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveCoupon()`   | Guarded  | `coupons_orgId_code_key`                      | Saving the same new code twice makes one code: the second lands on the index and is refused with the sentence about two offers nobody can tell apart. |
| `retireCoupon()` | Harmless | `the state asked for, not the opposite of the |

- state found`| Retiring a retired code leaves it retired. |
|`redeemAgainstInvoice()`| Guarded |`coupon_redemptions_one_per_invoice`| The second one is refused by the database before any money moves, so a double-click cannot take the discount twice off one bill. |
|`recordCounterRedemption()`| Guarded |`coupon_redemptions_one_per_sale` | One code against one sale; the second is refused inside the transaction, which rolls the whole sale back rather than discounting it twice. |

## Gift cards

`giftcards.ts`

| Write               | Twice   | What stops it                           | What the second one does                                                                                                                                                  |
| ------------------- | ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sellGiftCard()`    | Guarded | `the form key its callers hand to once` | Each sale mints a new code, so a repeat does not collide with the first: it sells a second card and takes the money again. Only the form key can tell one press from two. |
| `redeemGiftCard()`  | Guarded | `the form key its callers hand to once` | Spending the card twice against one bill is stopped by the key; past that the bill itself refuses, because there is nothing left owing to spend against.                  |
| `redeemAtCounter()` | Guarded | `the sale it runs inside`               | Called only from within a counter sale’s own transaction, so it repeats exactly when that sale repeats, and the sale is held off by the key its form carries.             |
| `adjustGiftCard()`  | Guarded | `the form key its callers hand to once` | A correction applied twice is a different balance and a second posting, so the form key decides how many corrections one press is.                                        |
| `disableGiftCard()` | Guarded | `the card already has a disabledAt`     | Cancelling a cancelled card is refused rather than writing the balance off a second time.                                                                                 |

## Refunds onto a card

`giftcard-refunds.ts`

| Write              | Twice   | What stops it                      | What the second one does                                                                                                        |
| ------------------ | ------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `refundOntoCard()` | Guarded | `gift_card_entries_one_per_refund` | One refund puts money on the card once. A retried refund lands on the index and is absorbed rather than loading the card again. |

## Money held for a customer

`deposits.ts`

| Write           | Twice   | What stops it                           | What the second one does                                                                                                                                          |
| --------------- | ------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `takeDeposit()` | Guarded | `the form key its callers hand to once` | Two deposits of the same amount from one customer are legitimate, so the form the press came from is the only thing that can tell a repeat from a second deposit. |
| `applyHeld()`   | Guarded | `the form key its callers hand to once` | Applied twice, the same held money would come off the bill twice; the key stops the press, and the bill refuses anything beyond what is owed.                     |
| `returnHeld()`  | Guarded | `the form key its callers hand to once` | Returning money twice is the workshop paying it back twice, and a part-return is legitimate on its own, so the key is what separates the two.                     |

## Credit kept from a refund

`deposit-credits.ts`

| Write            | Twice   | What stops it                    | What the second one does                                                                   |
| ---------------- | ------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `keepAsCredit()` | Guarded | `deposits_one_credit_per_refund` | One refund becomes credit once. A second attempt reads back the credit the first one made. |

## Paying by card

`card-payments.ts`

| Write                | Twice   | What stops it                                    | What the second one does |
| -------------------- | ------- | ------------------------------------------------ | ------------------------ |
| `startCardPayment()` | Guarded | `an open checkout for the same amount within the |

- hour`| The same request is handed the checkout it already opened. Two arriving in the same instant can open two, of which only one can be paid: the bill refuses the second as an overpayment. |
|`settleAttempt()`| Guarded |`the PENDING claim taken before the payment is
- recorded`| A provider that sends the same answer twice, or sends it while a recheck is running, moves the attempt once; the loser is told nothing changed. |
|`checkAttempt()`| Guarded |`the same PENDING claim, taken inside settleAttempt` | Asking the provider again is free; only the moment the answer changes writes anything, and that moment is claimed. |

## Stock

`inventory.ts`

| Write                   | Twice    | What stops it                                  | What the second one does                                                                                             |
| ----------------------- | -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `lockLevel()`           | Guarded  | `stock_levels_productId_warehouseId_key`       | A shelf row is made once per part and warehouse; the second call reads back the row the first one made.              |
| `reserveForJobLine()`   | Guarded  | `the line is no longer waiting to be reserved` | Reserving again is refused by the line having moved on, and no page offers a button that reserves a line twice.      |
| `releaseForJobLine()`   | Guarded  | `the reservations already have a releasedAt`   | The second call finds nothing still reserved and releases nothing.                                                   |
| `consumeForJob()`       | Guarded  | `the part lines are already fitted`            | The second call matches no lines, so the stock leaves the shelf once however many times a job completion is retried. |
| `defaultWarehouseFor()` | Harmless | `the workshop’s first warehouse, made only if  |

- it has none`| Asking twice gives the same warehouse back. |
|`receiveGoods()`| Guarded |`the order lines have already been received`| A second receipt is refused as an over-receipt, naming the line, before anything is written. |
|`adjustStock()`| Guarded |`the form key its callers hand to once`| The same adjustment made twice moves the shelf twice, and two identical adjustments are something somebody might genuinely do, so only the form can tell them apart. |
|`recordStocktake()`| Harmless |`onHand set to the number counted` | A stocktake is a set rather than a change: counted again at the same number, the variance is nothing and no movement is written. |

## What the workshop owes

`payables.ts`

| Write           | Twice    | What stops it                                | What the second one does                                                                                                                                     |
| --------------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bookBill()`    | Guarded  | `supplier_bills_orgId_reference_key`         | A supplier’s reference is booked once; the second attempt is refused with the reference named.                                                               |
| `approveBill()` | Guarded  | `the bill is no longer awaiting or disputed` | An approved bill is not approved again, so it is not posted twice.                                                                                           |
| `disputeBill()` | Harmless | `the status set to disputed`                 | Disputing a disputed bill leaves it exactly as it was.                                                                                                       |
| `paySupplier()` | Guarded  | `the form key its callers hand to once`      | A second run would pay the same bills again and send a second remittance; paying a supplier twice in a day is legitimate, so the key is what separates them. |

## Paying people

`payroll.ts`

| Write                   | Twice    | What stops it                                  | What the second one does                                                                                                                |
| ----------------------- | -------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `submitTimesheet()`     | Guarded  | `the sheet is no longer open`                  | A sheet that has been submitted, approved or paid refuses to be submitted again.                                                        |
| `approveTimesheet()`    | Guarded  | `approved has no self-edge`                    | Approving an approved sheet is refused rather than approved a second time.                                                              |
| `runPayroll()`          | Guarded  | `payroll_runs_orgId_periodStart_periodEnd_key` | A period is run once. The same timesheets cannot be handed over twice.                                                                  |
| `addPayAdjustment()`    | Guarded  | `the form key its callers hand to once`        | The same bonus is a legitimate thing to add twice, so nothing in the adjustment itself says which it is; the key the form carries does. |
| `removePayAdjustment()` | Guarded  | `the adjustment is already gone`               | Removing it again is refused with a sentence rather than silently doing nothing.                                                        |
| `savePayrollSettings()` | Harmless | `the two settings set to what was chosen`      | Saved twice, the overtime rate and the export format are what they were.                                                                |
| `markPayrollPaid()`     | Guarded  | `the run is already paid`                      | A paid run refuses to be paid again, and its sheets refuse the move as well.                                                            |

## The bank and the books

`banking.ts`

| Write              | Twice    | What stops it                                 | What the second one does                                                                                                                                                            |
| ------------------ | -------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordExpense()`  | Guarded  | `the form key its callers hand to once`       | Numbered from the workshop’s own counter rather than by counting what is already there, so two claims at once get two numbers; the same claim pressed twice is held off by the key. |
| `approveExpense()` | Guarded  | `approved has no self-edge`                   | An approved claim is not approved again, so the cost is posted once.                                                                                                                |
| `acceptMatch()`    | Guarded  | `the line already names the entry it matched` | A matched line refuses a second match, and an entry can only be claimed by one line.                                                                                                |
| `closePeriod()`    | Harmless | `the period marked closed`                    | Closing a closed period leaves it closed; nothing in the books moves either time.                                                                                                   |

## The ledger

`accounting.ts`

| Write                     | Twice    | What stops it                               | What the second one does                                                                                                                                                            |
| ------------------------- | -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureChartOfAccounts()` | Harmless | `only the accounts the workshop is missing` | The second call finds nothing missing and writes nothing.                                                                                                                           |
| `postEntry()`             | Guarded  | `journal_entries_one_per_document`          | One posting per source document. Every money function posts outside the transaction that wrote its document so a ledger failure cannot undo it; this is what makes that retry free. |

## Points and referrals

`retention.ts`

| Write              | Twice    | What stops it                                  | What the second one does                                                                                                                                                           |
| ------------------ | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `askAbout()`       | Guarded  | `review_requests_jobId_key`                    | A job is asked about once. Asking again is refused by the database rather than sending the customer a second request about the same visit.                                         |
| `recordRating()`   | Guarded  | `the request already carries a rating`         | Answering twice returns that it was already answered and leaves the first answer alone, which is the one the customer meant.                                                       |
| `resolveReview()`  | Harmless | `the note and the moment it was resolved`      | Resolving a resolved review writes the same words again and changes nothing anybody reads.                                                                                         |
| `awardPoints()`    | Guarded  | `loyalty_entries_once_key`                     | An award that says what it is the one-and-only of lands once however many times it is asked for. Points granted by hand carry no key, because a second grant is a second decision. |
| `redeemPoints()`   | Guarded  | `the form key its callers hand to once`        | Spending the same points twice is stopped by the key; past that the balance refuses, but only once the first spend has already gone through.                                       |
| `referralFor()`    | Guarded  | `referrals_one_per_customer`                   | A customer has one code per workshop. Two pages asking at once no longer end with two codes, of which the one they hand out is the wrong one half the time.                        |
| `useReferral()`    | Guarded  | `the code already names who it brought in`     | A code used twice is refused with the sentence saying so, rather than paying out on the same introduction again.                                                                   |
| `creditReferral()` | Guarded  | `the referral claimed while still uncredited`  | Two bills paid a millisecond apart both pass the check above; the claim decides between them, and the loser credits nobody.                                                        |
| `receiveInbound()` | Guarded  | `inbound_messages_orgId_providerRef_key`       | A webhook retried by the provider is one message rather than a customer appearing to write in twice.                                                                               |
| `handleInbound()`  | Harmless | `where the message is filed and who dealt with |

- it` | Filing it against the same job twice leaves it filed against that job. |

## Proved, not asserted

`npm run verify:repeat` runs the awkward moments against a real database: a
button pressed twice, two presses landing in the same instant, four awards of
the same points at once, two workers reaching for one queue, a sale taken
twice, and a claim whose process died holding it. A declaration that nothing
tests is a comment.

---

_Back to the [documentation index](../README.md)._
