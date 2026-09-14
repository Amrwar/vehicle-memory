# Accounting Model

**Phase 3.** The schema exists from the first migration; the posting logic
lands in Phase 3. This document specifies exactly what each operational event
posts, so the implementation is transcription rather than invention, and so an
external accountant can review the design before the code exists.

## 1. The principle

**Every operational act posts its financial consequence automatically.** No
parallel bookkeeping, no month-end re-entry of facts the system already holds.
This is the second differentiator after the passport: incumbents produce an
invoice, we post the ledger behind it.

Two rules are absolute:

1. **Every entry balances.** Enforced by a deferred constraint trigger. An
   unbalanced entry cannot be committed, whatever the application does.
2. **Every posted entry references the operational document that caused it.**
   `sourceType` and `sourceId` are not optional. A figure a bookkeeper cannot
   trace back in one click is a defect (persona P6).

## 2. Chart of accounts

Seeded per organisation, editable.

| Code | Account                   | Type      |
| ---- | ------------------------- | --------- |
| 1000 | Bank                      | Asset     |
| 1010 | Cash                      | Asset     |
| 1100 | Accounts receivable       | Asset     |
| 1200 | Stock on hand             | Asset     |
| 1500 | Work in progress          | Asset     |
| 2000 | Accounts payable          | Liability |
| 2100 | Tax payable (output)      | Liability |
| 2110 | Tax receivable (input)    | Asset     |
| 2200 | Customer deposits         | Liability |
| 2300 | Gift cards outstanding    | Liability |
| 3000 | Retained earnings         | Equity    |
| 4000 | Labour revenue            | Revenue   |
| 4010 | Parts revenue             | Revenue   |
| 4020 | Fees and sundry revenue   | Revenue   |
| 5000 | Cost of goods sold, parts | Expense   |
| 5010 | Cost of labour            | Expense   |
| 6000 | Wages                     | Expense   |
| 6100 | Premises                  | Expense   |
| 6200 | Stock adjustments         | Expense   |
| 6400 | Loyalty rewards           | Expense   |

## 3. Postings

Worked with the brake job used throughout the documentation: labour 427.50,
parts 830.00, VAT at 20%, parts cost 498.00.

### 3.1 Invoice issued

```
  Dr  1100 Accounts receivable        1,509.00
      Cr  4000 Labour revenue                      427.50
      Cr  4010 Parts revenue                       830.00
      Cr  2100 Tax payable                         251.50

  source: Invoice INV-1043
```

Revenue is split by line kind, not lumped, because parts margin and labour
margin are different questions and the owner needs both.

### 3.2 Parts consumed on the job

Posted when the job completes, at weighted average cost:

```
  Dr  5000 Cost of goods sold, parts     498.00
      Cr  1200 Stock on hand                       498.00

  source: Job 10482
```

### 3.3 Payment received

```
  Dr  1000 Bank                        1,509.00
      Cr  1100 Accounts receivable                1,509.00

  source: Payment pay_...
```

### 3.4 Goods received from a supplier

```
  Dr  1200 Stock on hand                 498.00
  Dr  2110 Tax receivable                 99.60
      Cr  2000 Accounts payable                    597.60

  source: GoodsReceipt gr_...
```

Stock is debited on receipt, not on invoice, so stock value reflects what is
physically on the shelf.

### 3.5 Supplier bill paid

```
  Dr  2000 Accounts payable              597.60
      Cr  1000 Bank                                597.60
```

### 3.6 Customer deposit

```
  Dr  1000 Bank                          500.00
      Cr  2200 Customer deposits                   500.00
```

A deposit is a liability until the work is invoiced, at which point it offsets
receivable. Treating it as revenue on receipt is the classic error.

### 3.7 Stock adjustment

```
  Dr  6200 Stock adjustments              42.00
      Cr  1200 Stock on hand                        42.00

  source: StockMovement sm_..., reason mandatory
```

### 3.8 Credit note

An issued invoice is never edited. A credit note reverses proportionally:

```
  Dr  4010 Parts revenue                 410.00
  Dr  2100 Tax payable                    82.00
      Cr  1100 Accounts receivable                 492.00
```

### 3.9 Refund

The credit note has already taken the sale out of revenue and reduced what the
customer owed. If they had paid, that leaves a credit balance on receivable.
The refund clears it and nothing else:

```
  Dr  1100 Accounts receivable            24.00
      Cr  1000 Bank                                 24.00

  source: Refund rf_..., against CreditNote cn_..., reason carried from it
```

Revenue is not touched here, because the credit note already reversed it.
Touching it twice is how a refund is double-counted, and a refund without a
credit note behind it is refused by the application and by the schema.

### 3.10 Supplier bill booked

The debt enters the books when the supplier's invoice is booked against the
order. Stock and reclaimable input tax go up; payable goes up by the total:

```
  Dr  1200 Stock on hand                 100.00
  Dr  2110 Tax receivable                 20.00
      Cr  2000 Accounts payable                   120.00

  source: SupplierBill sb_..., reference is the supplier's own invoice number
```

This is a deliberate departure from 3.4, which has stock debited when the
goods arrive. The receipt path does not yet post, so the bill carries both
sides for now. When receipt-time posting lands, booking the bill posts only the
variance between what arrived and what was billed. Named here so it is a known
gap rather than a surprise.

### 3.11 Supplier paid

One payment usually settles several bills. The allocation to each is stored,
and the remittance advice sent to the supplier is that list:

```
  Dr  2000 Accounts payable              180.00
      Cr  1000 Bank                                180.00

  source: SupplierPayment sp_..., allocations to sb_... and sb_...
```

Cash comes out of 1010 rather than 1000.

### 3.12 Wages

Gross pay, when the payroll run is marked paid. The deductions between gross
and net and the employer's own contributions belong to the payroll software's
own journal and are posted from its report, not guessed at here:

```
  Dr  6000 Wages                        1591.25
      Cr  1000 Bank                               1591.25

  source: PayrollRun pr_..., one entry per run
```

### 3.13 Points redeemed (Phase 24)

Points are not money in. They are the cost of the loyalty programme, so the
debit is marketing and the customer's debt still comes down:

```
  Dr  6400 Loyalty rewards                  3.00
      Cr  1100 Accounts receivable                     3.00

  source: Payment pay_..., method LOYALTY
```

A bill settled partly with points earns points only on the money actually
paid; the programme does not pay itself.

### 3.14 Gift card sold (Phase 26)

Money in, owed back as work. A liability until it is spent, never revenue on
the day it is sold:

```
  Dr  1000 Bank                            50.00
      Cr  2300 Gift cards outstanding                 50.00

  source: GiftCard gc_...
```

Cash goes to 1010 rather than 1000, as for any other payment.

### 3.15 Gift card redeemed (Phase 26)

The money came in when the card was sold. Redeeming it releases the
liability against what the customer owed and never touches the bank a
second time:

```
  Dr  2300 Gift cards outstanding          24.00
      Cr  1100 Accounts receivable                    24.00

  source: Payment pay_..., method GIFT_CARD
```

A refund by method `GIFT_CARD` is the mirror image and puts the money back
on the card: Dr 1100, Cr 2300.

### 3.16 Gift card adjusted by hand (Phase 28)

Money added to a card by hand is a gift from the workshop, the same cost as
the loyalty programme; money taken off is a card the workshop no longer owes
on, which is sundry income rather than a sale. A cancellation is an
adjustment down to nothing with the reason, so the liability leaves the
books with the card:

```
  Dr  6400 Loyalty rewards                  5.00
      Cr  2300 Gift cards outstanding                  5.00

  source: GiftCardEntry gce_..., kind ADJUSTMENT, up

  Dr  2300 Gift cards outstanding          12.00
      Cr  4020 Fees and sundry revenue                12.00

  source: GiftCardEntry gce_..., kind ADJUSTMENT, down
```

A gift card taken at the counter posts inside the sale's own entry: Dr 2300
for the card's share, alongside the cash and card lines, so the drawer is
never expected to hold money it did not take.

### 3.17 Deposit taken, applied, and returned (Phase 30)

Money before the work, and money kept on account after a refund, are the
same liability. Taken:

```
  Dr  1000 Bank                           200.00
      Cr  2200 Customer deposits                    200.00

  source: Deposit dep_...
```

Put against the invoice, as a payment of kind DEPOSIT, which releases the
liability and never touches the bank:

```
  Dr  2200 Customer deposits              200.00
      Cr  1100 Accounts receivable                  200.00

  source: Payment pay_..., method DEPOSIT
```

Returned to the customer, the way money goes:

```
  Dr  2200 Customer deposits               50.00
      Cr  1000 Bank                                  50.00

  source: DepositMovement dm_...
```

A refund by method `DEPOSIT` is the ordinary refund posting with the credit
to 2200: the workshop owes the customer credit instead of cash.

### 3.18 Card payment through a provider (Phase 32)

A payment that arrives through the provider posts exactly as a card taken at
the counter, with method `ONLINE` and the provider's reference on the
payment:

```
  Dr 1000 Bank                 amount
      Cr 1100 Receivable               amount
```

It is posted once, at the moment the attempt moves to succeeded, and never
again however many times the provider reports it. A refund back through the
provider is `postRefund` with method `ONLINE`, credited from the bank; the
provider is asked before the refund is recorded, so a refusal there leaves
no posting here.

Deliberately not modelled yet: the provider's fee and the payout. The bank
is debited for the gross amount the customer paid, which is what the
invoice was for; the fee arrives on the provider's statement and is
recorded as an expense when the bank feed is matched, the way a card
terminal's fee is today. Netting the fee at the moment of payment would
make the customer's receipt and the bank's figure disagree.

## 4. Job profitability

Derived from the postings, not computed separately, so the figure on the job
screen and the figure in the accounts cannot disagree.

```
  Revenue        4000 + 4010 + 4020 where sourceId = job     1,257.50
  Parts cost     5000 where sourceId = job                    -498.00
  Labour cost    clocked minutes x technician cost rate       -197.60
  ---------------------------------------------------------------------
  Gross profit                                                 561.90
  Margin                                                        44.7%
```

Labour cost uses **clocked** time at the technician's cost rate, not the
charged hours. This job bills 4.5 hours; the technician took 5.2. Both are
true, and only using the second gives a real margin. Systems that conflate the
two cannot measure profitability at all, which is why most workshop owners
cannot tell you which jobs lose money.

## 5. Periods and closing

- A fiscal period has a start, an end, and a closed flag.
- Posting into a closed period is refused.
- Closing computes the period's profit and posts it to retained earnings.
- Reopening is possible, permission-gated, and audited.

## 6. Reports

| Report              | Definition                                           |
| ------------------- | ---------------------------------------------------- |
| Trial balance       | Sum of debits and credits per account. Must balance. |
| Profit and loss     | Revenue less expense accounts over a period          |
| Balance sheet       | Assets, liabilities and equity at a date             |
| Aged receivables    | Outstanding invoices by age band                     |
| Aged payables       | Outstanding supplier bills by age band               |
| Tax report          | Output less input tax for the period                 |
| Job profitability   | Section 4, per job or aggregated                     |
| Parts profitability | Revenue less cost by part and category               |

## 7. Before this ships

Non-negotiable, because a ledger that does not balance destroys trust
irrecoverably (risk R2):

- [ ] Property tests: no sequence of operations produces an unbalanced entry
- [ ] Trial balance reconciles against operational totals on seeded data
- [ ] Stock value in the ledger equals the sum of stock movements
- [ ] An external accountant reviews the postings in this document
- [ ] Period close and reopen tested, including the retained-earnings posting

---

_Next: [Design system](08-design-system.md)._
