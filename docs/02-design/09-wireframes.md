# Wireframes

Annotated layouts for every Phase 1 screen. These are the intent; the built
screens are in `apps/web/src/app`.

## 1. Workshop shell

```
+---------------+-----------------------------------------------------------+
| Hillside      |  WEDNESDAY, 9 SEPTEMBER 2026                              |
| Carnet Workshop|  Good afternoon, Ahmed         [Open diary] [New job]     |
+---------------+-----------------------------------------------------------+
| WORKSHOP      |                                                           |
|  Dashboard  * |                     MAIN CONTENT                          |
|  Diary        |                                                           |
|  Jobs      [1]|                                                           |
|  Customers    |                                                           |
|  Vehicles     |                                                           |
| MONEY         |                                                           |
|  Invoices     |                                                           |
|  Payments     |                                                           |
|  Reports      |                                                           |
| INVENTORY     |                                                           |
| FINANCE       |                                                           |
| ADMIN         |                                                           |
+---------------+                                                           |
| Ahmed Bakri   |                                                           |
| Owner         |                                                           |
| Sign out      |                                                           |
+---------------+-----------------------------------------------------------+
```

Groups are named for what a person is doing, not for which module a feature
lives in. **Items a role cannot reach are absent, not greyed out** — a disabled
control is an invitation to ask why. The badge on Jobs counts approvals
waiting, because that is the number that blocks work.

## 2. Dashboard

```
+-------------------+-------------------+-------------------+---------------+
| JOBS TODAY        | VEHICLES IN SHOP  | AWAITING APPROVAL | TAKEN TODAY   |
|      2            |        1          |       1           |   £0.00       |
| Created since     | Physically on site| Work is blocked   | Payments      |
| midnight          |                   |                   | received      |
+-------------------+-------------------+-------------------+---------------+
     ^ every tile is a link to the records behind it (FR-1402)

+---------------------------------------------------------------[See all]--+
| APPROVALS NEEDED                                                          |
| Nothing can proceed on these until the customer decides.                  |
|                                                                           |
| BMW X5  [MK20 XRT]  #10482                          £1,509.00  [Review]   |
| Maria Okonkwo - Brake system repair - waiting 2h                          |
+---------------------------------------------------------------------------+

+-----------------------------------------------------------------[Diary]---+
| TODAY IN THE WORKSHOP                    3 bookings scheduled             |
| TIME  VEHICLE           CUSTOMER      WORK              TECH    BAY  STATUS|
| 08:00 BMW X5 [MK20 XRT] Maria Okonkwo Brake repair      John    B1   *Appr |
| 09:00 Honda [LR21 KJD]  Maria Okonkwo Interim service   Mike    B2   Booked|
| 13:00 Transit [BV19 FLM]Pennine       Diagnostics       John    B4   Booked|
+---------------------------------------------------------------------------+
```

**Action-oriented, not a wall of charts.** Ahmed opens this at 7:40am. The
approvals block is the first thing under the tiles because it is the only
thing on the page that is actively blocking money.

## 3. Job detail — the central screen

```
JOB #10482 - HILLSIDE ROAD
BMW X5  [MK20 XRT]  (*) Customer approval        [Vehicle passport]
Brake system repair

+-- WAITING ON THE CUSTOMER ------------------------------------------------+
| Work cannot proceed until the estimate is approved. Sent 9 Sept, 10:42.   |
+---------------------------------------------------------------------------+

+---------------------------------------------+  +------------------------+
| VEHICLE AND CUSTOMER                        |  | PROGRESS               |
| Customer  Maria Okonkwo   Contact 07700...  |  |  (v) Vehicle received  |
| Vehicle   2020 BMW X5     VIN WBA JA9C50... |  |  (v) Inspection        |
| Technician John Adeyemi   Bay  Bay 1        |  |  (v) Diagnosis         |
| Promised  17:00           Clocked 0.8h      |  |  (v) Estimate created  |
| DIAGNOSIS                                   |  |  (o) Customer approval |
| Front brake pads worn beyond the wear...    |  |  ( ) Approved          |
+---------------------------------------------+  |  ( ) Repair            |
                                                 |  ( ) Quality control   |
+-----------------------------[x2] [!3] [v5]-+  |  ( ) Completed         |
| INSPECTION            John Adeyemi          |  |  ( ) Invoice           |
| SECTION  ITEM         MEAS.  FINDING  EST.  |  |  ( ) Payment           |
| Brakes   Front pads   1.5mm  Critical £420  |  +------------------------+
| Brakes   Front discs  25.4mm Critical £410  |
| Tyres    Front left   2.8mm  Advisory £165  |  +------------------------+
| Bonnet   Battery      11.9V  Advisory £240  |  | ESTIMATE v1     [sent] |
+---------------------------------------------+  | Subtotal    £1,257.50  |
                                                 | Tax           £251.50  |
+---------------------------------------------+  | Total       £1,509.00  |
| LABOUR AND PARTS                            |  +------------------------+
| Charged at book time; costed at clocked time|
| Brake inspection      1.00h  £95   £95.00   |  +------------------------+
| Brake replacement     3.50h  £95  £332.50   |  | HISTORY                |
| BMW front pads    34116794300 1  £420.00    |  | Customer approval      |
| BMW front discs   34116864059 1  £410.00    |  | Sara Whitfield 10:42   |
|                          TOTAL  £1,509.00   |  | Estimate created 09:50 |
+---------------------------------------------+  +------------------------+
```

**Everything about the job on one screen.** No jumping between ten modules to
understand what happened. This is the single strongest UX claim in the
product, and the reason the Job is the central aggregate.

## 4. Vehicle passport

```
VEHICLE PASSPORT
2020 BMW X5  [MK20 XRT]
xDrive30d M Sport                            [Share history]  [New job]

+------------------------------------------+  +-------------------------+
| IDENTITY          (v) History intact     |  | OPEN RECALLS            |
|                       Chain E5A9-A764    |  | EGR cooler coolant leak |
| VIN         WBA JA9C50 9G000000          |  | BMW-0072340100          |
| Registration MK20 XRT   Engine B57D30A   |  +-------------------------+
| Odometer    82,430 km   Avg 889 km/month |  | NEXT SERVICE            |
| Current owner Maria Okonkwo              |  | Due at    94,150 km     |
| Owners on record 3   Events on record 7  |  | Remaining 11,720 km     |
+------------------------------------------+  | Projected Mar 2026      |
                                              | (*) Overdue             |
+------------------------------------------+  +-------------------------+
| HISTORY            7 entries              |  | JOBS AT THIS WORKSHOP   |
| 2025                                      |  | #10482  Customer appr.  |
|  o TIRES  19 Mar 2025  78,150 km          |  +-------------------------+
|    Two front tyres replaced               |  | OWNERSHIP               |
|    Michelin Pilot Sport 4 SUV 265/50 R19  |  | Maria Okonkwo           |
|    [Workshop] Kirkstall Autocentre        |  | 02/07/2025 - present    |
|                                           |  | Peter Vasquez           |
|  o OWNERSHIP 2 Jul 2025  74,800 km        |  | 18/05/2023 - 02/07/2025 |
|    Ownership transferred                  |  | Northgate Leasing Ltd   |
|    Changed hands. The 3rd keeper.         |  | 03/03/2020 - 18/05/2023 |
|    [Owner]                                |  +-------------------------+
| 2024                                      |
|  o RECALL 4 Oct 2024                      |
|    Safety recall issued: EGR cooler       |
|    [Official]                             |
+------------------------------------------+
```

The ownership event says how many keepers, never who. The names beside
it are ownership rows, which an erasure request can reach; the event is in
the hash chain, which nothing can (ADR-0014). This wireframe read "From
Peter Vasquez to Maria Okonkwo" until Phase 62, and so, therefore, did the
seed.

The dot colour on each entry encodes its verification level, and the badge
states it in words. Note the third-party attribution: **Kirkstall Autocentre**
is a different workshop. That single line is the product.

## 5. Shop floor

```
CARNET
My jobs                                        John Adeyemi / Sign out
+-------------------------------------------------------------------------+
| BMW X5  [MK20 XRT]                              (*) Customer approval    |
| Brake system repair                                                      |
| Job #10482   Allowed 4.5h   Odometer 82,430 km   Tasks 2/6               |
|                                                                          |
| +----------------------------------------------------------------------+ |
| | Waiting for the customer to approve the estimate.                    | |
| | Do not start this work yet.                                          | |
| +----------------------------------------------------------------------+ |
|                                                                          |
| [  Start job  ] [ Inspection v ] [  Add photo  ] [ Request part ]        |
|    (disabled)                                                            |
+-------------------------------------------------------------------------+
```

No sidebar, no money, no reports. Every control is at least 48px. The blocked
job is **shown with its reason**, not hidden: hiding it sends John to the front
desk to ask, which is the interruption this screen exists to remove.

## 6. Inspection capture (tablet)

```
< Back        BRAKES                                        3 of 4 sections
+-------------------------------------------------------------------------+
| Front pads                                    [ Mark all in section pass]|
|  [  PASS  ] [ ADVISORY ] [ CRITICAL ] [ NOT CHECKED ]                    |
|              ^ selected                                                  |
|  Measurement  [ 1.5 ] mm                                                 |
|  Note         [ Worn to the backing plate on the outer pad.          ]   |
|               [ 🎤 dictate ]                                             |
|  Photos       [ + ]  [img]  [img]                                        |
|  Recommend    [ Replace front brake pads              ]  Est [ 420 ]     |
+-------------------------------------------------------------------------+
| Front discs                                                              |
|  [  PASS  ] [ ADVISORY ] [ CRITICAL ] [ NOT CHECKED ]                    |
+-------------------------------------------------------------------------+
                                                    [ Complete inspection ]
```

Four severity buttons at 48px. Mark-all-pass per section, because most items
pass and the technician should spend their attention on the ones that do not.
Photo capture is one tap. Dictation on every note field. **Target: a 30-item
inspection in under four minutes with gloves on** (hypothesis H2).

## 7. Customer estimate approval (phone)

```
+---------------------------------+
| Hillside Motors                 |
| BMW X5  MK20 XRT                |
+---------------------------------+
| We found two things that need   |
| attention.                      |
|                                 |
| [photo of worn pad]             |
| Front brake pads                |
| 1.5mm of material left. The     |
| legal minimum is 3mm.           |
|                          £420.00|
|                                 |
| [photo of disc]                 |
| Front brake discs               |
| Below the minimum thickness.    |
|                          £410.00|
|                                 |
| Labour, 4.5 hours        £427.50|
| ------------------------------- |
| Subtotal              £1,257.50 |
| VAT                     £251.50 |
| TOTAL                 £1,509.00 |
|                                 |
| We also noticed (optional):     |
| [ ] Front left tyre      £165.00|
| [ ] Battery              £240.00|
|                                 |
| [        APPROVE           ]    |
| [        DECLINE           ]    |
| [     ASK A QUESTION       ]    |
+---------------------------------+
```

**The photograph is the trust mechanism** ([ADR-0012](../03-adr/0012-photographs-as-the-trust-mechanism.md)).
Maria cannot evaluate "1.5mm pad thickness". She can evaluate a picture of her
own brake pad next to a plain sentence about what it means. Advisories are
opt-in checkboxes, so she chooses rather than being told. **Target: under 60
seconds, no account.**

## 8. Public passport (buyer, no account)

```
CARNET                                            VEHICLE HISTORY
2020 BMW X5   [MK20 XRT]   WBA JA9C50 9G000000

+-------------------------------------------------------------+
| (v) History intact                    Chain E5A9-A764       |
+-------------------------------------------------------------+
This record is append-only. Each entry is cryptographically
linked to the one before it, so an entry cannot be altered or
removed without breaking the chain. The check above recomputes it.

  Entries on record     7      Workshops contributing    2
  Latest odometer  82,430 km   Owners on record          3
  Mileage anomalies  (!) 1 flagged   Open recalls    (!) 1

+-- MILEAGE INCONSISTENCY ON RECORD --------------------------+
| 1 odometer reading has been recorded that does not follow   |
| from the readings before it. Readings are never discarded,  |
| so you can see it below.                                    |
+-------------------------------------------------------------+

HISTORY
Newest first. Each entry names the workshop that recorded it
and how well evidenced it is.
  ...

Shared by the vehicle's owner. This link expires on 9 October
2026, and the owner can revoke it at any time. Your visit has
been recorded and is visible to them.
```

David arrives cold and leaves in three minutes. Every element answers one of
two questions: what happened to this car, and why should I believe it. The
flagged odometer reading is **surfaced prominently**, because it is the single
most valuable thing this page can tell him.

---

_Next: [Architecture decision records](../03-adr/)._

## 9. Passports, listed (Phase 27)

```
PASSPORTS
The record that belongs to each car.                 [ Search: reg, VIN ... ]

+-----------+  +-----------+  +--------------------+  +--------------------+
| PASSPORTS |  | ENTRIES   |  | CHAINS SOUND   (v) |  | SHARED WITH OTHERS |
|     7     |  |    64     |  |        7           |  |         1          |
+-----------+  +-----------+  +--------------------+  +--------------------+

Vehicle              Registration  VIN          Entries  Workshops  Recorded            Chain
2020 BMW X5          [MK20 XRT]    WBA...0000        7          1  Mar 2020 to Jun 25  (v) Verifies
2008 Ford Transit    [PR08 NET]    WF0...1234       24          2  Jan 2019 to Sep 26  (v) Verifies
                                                          . 18 from elsewhere
2021 Vauxhall Corsa  [BJ21 OYD]    W0V...9876        0          0  -                   Empty
```

The third tile is the one that matters and it turns red when it is not the
same number as the first. "From elsewhere" is the network, counted.

## 10. Gift cards (Phase 26)

```
GIFT CARDS
Money taken in advance. Owed as work until it is spent.

+--------------+  +---------------------+  +----------+  +----------+
| OUTSTANDING  |  | CARDS WITH MONEY ON |  | SOLD     |  | SPENT    |
|   £76.00     |  |          2          |  | £150.00  |  | £74.00   |
+--------------+  +---------------------+  +----------+  +----------+

+-------------------------------------------------+  +---------------------+
| EVERY CARD                                      |  | SELL A CARD         |
| Number          Sold          For   Loaded Left |  | Amount   [ 50 ]     |
| M2HP-VY89-F7QH  14 Sep . Sara Probe £50.00 Spent|  | How paid [ Card v ] |
| BCDF-GHJK-LMNP  12 Sep . Ali  Dad   £100   £76  |  | For      [ Dad ]    |
+-------------------------------------------------+  | [ Sell the card ]   |
                                                     +---------------------+
```

On the invoice, "Redeem a gift card" takes the number and an optional amount;
blank means as much as the bill needs.

## 11. The customer's home (Phase 32.5)

```
  PHONE                                DESKTOP
  +-----------------------------+      +--------------------------------------------------+
  | [mark] Carnet   [theme] out |      | [mark] Carnet · YOUR CARS          [theme] Sign out|
  |        YOUR CARS            |      | Home  Passports  Invoices  Updates  Rewards       |
  +-----------------------------+      | Workshops  Book                                   |
  | Hello, Maria                |      +--------------------------------------------------+
  | 2 things need your attention|      | Hello, Maria            [Add a car] [Book a visit]|
  |          [Add a car][Book]  |      | 2 things need your attention                      |
  |                             |      |                                    |             |
  | NEEDS YOU                   |      | NEEDS YOU                          | REWARDS     |
  | +-------------------------+ |      | +------------------------------+   | 576 points  |
  | | Estimate to approve     | |      | | Estimate to approve          |   |             |
  | | BMW X5 · Brake repair   | |      | | BMW X5 · Brake repair        |   | YOUR        |
  | | Hillside · est £1,509   | |      | |     [Review and decide]      |   | PASSPORTS   |
  | |     [Review and decide] | |      | +------------------------------+   | [See]       |
  | +-------------------------+ |      | | Invoice to pay  £750.00      |   |             |
  | | Invoice to pay  £750.00 | |      | |            [Pay by card]     |   | YOUR        |
  | |            [Pay by card]| |      | +------------------------------+   | WORKSHOPS   |
  | +-------------------------+ |      |                                    | Hillside    |
  |                             |      | MY CARS                            | [Find one]  |
  | MY CARS                     |      | +-------------+ +-------------+    |             |
  | +-------------------------+ |      | | 2020        | | 2021        |    |             |
  | | 2020        [MK20 XRT]  | |      | | BMW X5      | | Honda Civic |    |             |
  | | BMW X5                  | |      | | 82,430 km   | | Not recorded|    |             |
  | | 82,430 km · 14 entries  | |      | | ● Approval  Open → | ● Nothing due  Open →|    |
  | | ● Customer approval  Open →|      | +-------------+ +-------------+    |             |
  | +-------------------------+ |      |                                    |             |
  |                             |      | RECENT WORK                        |             |
  | RECENT WORK                 |      | Brake system repair  ·  £750  ● Approval          |
  | ...                         |      +--------------------------------------------------+
  +-----------------------------+
  | [Home][Passports][Invoices] |
  | [Updates][Book]             |   <- fixed bottom tab bar, always visible
  +-----------------------------+
```

The navigation is never behind a vehicle. Five tabs on a phone, at the
bottom where a thumb is; seven on a desktop, under the header. "Needs you"
comes first and each item carries its own button, so the page is done with
in one press for the person who came to pay. Rewards and the workshop
directory are pages of their own.

## 12. Do not miss (Phase 95)

```
WORKSHOP
Do not miss
What acting on this morning changes. Ordered by what it costs to miss, and
short enough to finish.

8 things to deal with.   (2 Somebody could be hurt) (4 A promise) (2 Money)

+-------------------------------------------------------------------------+
| IN THE ORDER THEY COST TO MISS                                          |
| Each one is a single thing to do.                                       |
|-------------------------------------------------------------------------|
| (Somebody could be hurt) Two-post lift cannot be used, and         ->   |
|                          brake work needs it        12 Sep  Put it right|
| (Somebody could be hurt) Wheel aligner's certificate runs out      ->   |
|                          on 2026-10-14      Book the engineer           |
| (A promise)   #10482 [BV19 FLM]: waiting on the customer           ->   |
|                                            30 Sep  Tell the customer    |
| (A promise)   Order #PO-118 from Pennine Motor Factors was due     ->   |
|                          and has not arrived  28 Sep  Ring the supplier |
| (Money)       Sara Probe has not paid #INV-2041   14 Sep  Chase it ->   |
+-------------------------------------------------------------------------+

And 0 more behind these.
```

Every row is one action, as a verb, at the end where the eye finishes — and
the whole row is the link, because a row that says something is wrong and
gives nobody anything to press is how a list stops being read. The badge is
what it costs to miss, not a status: safety is the only thing above a promise
to a customer.

Where there is nothing, the card is replaced rather than emptied:

```
+-------------------------------------------------------------------------+
|                    Nothing to miss this morning.                        |
|   Nothing is late, nothing is unusable, and nothing is waiting on        |
|                        somebody here.                                   |
+-------------------------------------------------------------------------+
```

A screen that showed an empty area would leave somebody wondering whether it
had loaded. A workshop that has cleared its list should be told so.
