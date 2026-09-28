# User Stories

Stories grouped by epic. Each carries acceptance criteria in Given / When /
Then form, a size in points, and the functional requirements it satisfies.
Epics A to J are Phase 1. Epics K to T were written as Phases 15.1 to 23
shipped, one epic per phase, and are what those phases' verification scripts
check. Phases 2 to 15 are traced by requirement rather than by story, a gap the
[traceability matrix](04-traceability-matrix.md) names.

Sizing uses a modified Fibonacci scale: 1, 2, 3, 5, 8, 13. Anything estimated
above 13 is split before it enters a sprint.

Personas are referenced as defined in [Personas](../00-product/04-personas.md).

---

## Epic A — Foundation and access

### A1 — Sign in to my workshop

**As** any staff user **I want** to sign in with my email and password **so
that** I can reach my workshop's data and nobody else's.
**Size** 5 · **Satisfies** FR-103, FR-104, FR-105, FR-110

- **Given** a registered active user, **when** they submit correct credentials,
  **then** a session is created and they land on the dashboard for their role.
- **Given** a registered user, **when** they submit an incorrect password,
  **then** the response is a generic failure that does not reveal whether the
  email exists.
- **Given** five failed attempts within fifteen minutes for one account,
  **when** a sixth is attempted, **then** it is rejected and the lockout is
  logged.
- **Given** an authenticated session, **when** the idle period configured for
  the organisation elapses, **then** the session is rejected on the next
  request.
- **Given** any session, **when** the cookie is inspected, **then** it is
  httpOnly, Secure and SameSite=Lax.

### A2 — Never see another workshop's data

**As** a workshop owner **I want** absolute certainty that no other
organisation can see my records **so that** I can trust the platform with my
business.
**Size** 8 · **Satisfies** FR-101, FR-102, NFR-407

- **Given** two organisations each with customers, **when** a user of one
  requests a list of customers, **then** only their own organisation's records
  are returned.
- **Given** a user of organisation A, **when** they request a record belonging
  to organisation B by its identifier directly, **then** the response is 404,
  not 403, so existence is not disclosed.
- **Given** any repository method, **when** it is called without an
  organisation scope, **then** it fails at the type level rather than returning
  unscoped data.
- **Given** the automated test suite, **when** it runs, **then** it includes a
  cross-tenant isolation test for every tenant-scoped entity.

### A3 — See only what my role permits

**As** a workshop owner **I want** technicians to see jobs but not financial
reports **so that** commercial information stays with the people who need it.
**Size** 5 · **Satisfies** FR-106, FR-107

- **Given** a user with the Technician role, **when** they open the
  application, **then** the navigation shows only shop-floor destinations.
- **Given** a Technician, **when** they request a financial report URL
  directly, **then** access is denied and the attempt is audited.
- **Given** a permission that has not been explicitly granted, **when** it is
  checked, **then** the result is deny.

### A4 — Know who changed what

**As** a workshop owner **I want** an audit record of every change **so that**
I can resolve disputes about what happened.
**Size** 5 · **Satisfies** FR-109

- **Given** any state-changing action, **when** it succeeds, **then** an audit
  record captures actor, action, entity, before and after values, timestamp and
  source address.
- **Given** an audit record, **when** anyone attempts to modify or delete it,
  **then** the attempt fails.

---

## Epic B — Customers and vehicles

### B1 — Add a customer without re-typing

**As** Sara, service advisor **I want** to create a customer quickly while
someone is on the phone **so that** I am not keeping them waiting.
**Size** 5 · **Satisfies** FR-201, FR-202, FR-203, FR-206

- **Given** the new customer form, **when** I enter a name and a mobile number,
  **then** the customer can be saved with everything else left blank.
- **Given** an existing customer with the same mobile number, **when** I try to
  save, **then** I am shown the existing record and asked to confirm before a
  duplicate is created.
- **Given** a company customer, **when** I mark it as a company, **then** the
  form asks for a trading name and tax reference instead of a personal name.

### B2 — See everything about a customer in one place

**As** Sara **I want** one screen showing a customer's vehicles, jobs, invoices
and messages **so that** I can answer any question without navigating away.
**Size** 5 · **Satisfies** FR-205

- **Given** a customer with three vehicles and eleven jobs, **when** I open
  their record, **then** I see all vehicles with current status, recent
  activity in date order, and the outstanding balance.
- **Given** the customer view, **when** I select a vehicle, **then** I go
  directly to that vehicle without losing my place.

### B3 — Identify a vehicle from its VIN

**As** Sara **I want** the VIN to fill in the vehicle details **so that** I do
not mistype a model and corrupt the history.
**Size** 8 · **Satisfies** FR-301, FR-302, FR-304, FR-305

- **Given** a valid 17-character VIN, **when** I enter it, **then** make,
  model, year and engine populate automatically.
- **Given** a VIN that fails its check digit, **when** I enter it, **then** I
  am warned but allowed to proceed, because real-world VINs on older vehicles
  are sometimes non-conforming.
- **Given** a VIN already known to the platform, **when** I enter it, **then**
  the existing vehicle is offered rather than a duplicate being created.
- **Given** a vehicle known to another organisation, **when** I claim it for a
  job, **then** I gain access to write events but see prior events only at the
  disclosure level the owner permits.

### B4 — Record mileage and catch impossible readings

**As** the system **I want** to validate odometer readings **so that** the
history stays trustworthy.
**Size** 5 · **Satisfies** FR-306, FR-307, FR-308

- **Given** a vehicle whose last reading was 82,430 km, **when** 84,100 km is
  recorded, **then** it is accepted and the daily average is updated.
- **Given** the same vehicle, **when** 71,000 km is recorded, **then** it is
  accepted, flagged as a decrease anomaly, and made visible on the passport.
- **Given** a reading implying more than 1,000 km per day since the last one,
  **when** it is recorded, **then** it is flagged as implausible.
- **Given** at least three readings over 90 days, **when** the next service is
  calculated, **then** the projected date uses the observed daily rate.

---

## Epic C — The vehicle passport

### C1 — See a vehicle's whole life

**As** Maria, vehicle owner **I want** to see everything that has happened to
my car **so that** I understand what I own.
**Size** 8 · **Satisfies** FR-401, FR-402, FR-405, FR-413

- **Given** a vehicle with events from three workshops, **when** I open its
  passport, **then** events appear newest first, grouped by year, each showing
  date, type, plain-language summary, mileage and who recorded it.
- **Given** an event recorded by a workshop, **when** I view it, **then** the
  recording organisation is named and its verification level is stated.
- **Given** an event with photographs, **when** I open it, **then** I can view
  them full-size.
- **Given** a passport with 500 events, **when** it loads, **then** it renders
  within the NFR-104 budget.

### C2 — Trust that the history has not been altered

**As** David, used-car buyer **I want** evidence that the history is not edited
**so that** I can rely on it when spending fourteen thousand pounds.
**Size** 13 · **Satisfies** FR-403, FR-404, FR-406

- **Given** an event being appended, **when** it is written, **then** its hash
  covers its own content and the previous event's hash.
- **Given** a vehicle's chain, **when** verification runs, **then** it either
  confirms integrity or names the first divergent event.
- **Given** any stored event, **when** an update or delete is attempted through
  any application path, **then** it is refused.
- **Given** an event later found to be wrong, **when** it is corrected, **then**
  a superseding event is appended referencing the original, and both remain
  visible with the original shown as superseded.

### C3 — Write history automatically by doing the work

**As** John, technician **I want** the passport to fill itself in **so that** I
never do data entry twice.
**Size** 8 · **Satisfies** FR-408, FR-707, FR-614

- **Given** a job moving to Completed, **when** the transition commits, **then**
  passport events are written for the service performed, each part fitted, the
  inspection, and the odometer reading.
- **Given** the same job, **when** the transition is retried after a failure,
  **then** duplicate events are not created.
- **Given** event writing fails, **when** the job completes, **then** the job
  still completes and the event write is retried by the background worker,
  because losing the job is worse than delaying the event.

### C4 — Share my car's history with a buyer

**As** Maria, selling her car **I want** to give a buyer a link **so that** I
can prove how well it was maintained.
**Size** 8 · **Satisfies** FR-409, FR-410, NFR-410

- **Given** a vehicle I own, **when** I create a share link, **then** I choose
  an expiry and receive an unguessable URL scoped to that one vehicle.
- **Given** a share link, **when** someone opens it, **then** they see the
  passport read-only with no personal details of any owner.
- **Given** a share link, **when** it is opened, **then** I can see that it was
  opened and when.
- **Given** a share link, **when** I revoke it, **then** it stops working
  immediately.
- **Given** an expired link, **when** it is opened, **then** access is refused.

### C5 — Hand the history over with the car

**As** Maria **I want** the history to transfer to the buyer **so that** it
stays with the vehicle.
**Size** 8 · **Satisfies** FR-411, FR-412

- **Given** a vehicle I own, **when** I initiate a transfer to a new owner,
  **then** a transfer event is appended and the new owner gains full access.
- **Given** a completed transfer, **when** I view the vehicle, **then** I can
  read the period I owned it and can no longer write to it.
- **Given** a completed transfer, **when** the new owner views the passport,
  **then** the entire prior history is visible, including events from before
  their ownership.

---

## Epic D — Booking and the diary

### D1 — See the week at a glance

**As** Sara **I want** a diary showing bays and technicians **so that** I know
what can be promised.
**Size** 13 · **Satisfies** FR-501, FR-502

- **Given** the diary, **when** I choose day, week or month, **then** the view
  changes without a full page reload.
- **Given** the week view, **when** it renders, **then** bookings appear in
  lanes by bay and can be regrouped by technician.
- **Given** 200 bookings in a week, **when** the view renders, **then** it
  meets the NFR-103 budget.
- **Given** the diary, **when** I filter by status, **then** only matching
  entries remain and the filter persists across reloads.

### D2 — Move a booking by dragging it

**As** Sara **I want** to drag a booking to a new slot **so that** rescheduling
takes seconds.
**Size** 8 · **Satisfies** FR-504, FR-505

- **Given** a booking, **when** I drag it to another time or bay, **then** it
  is saved and the change is audited.
- **Given** a drop that exceeds capacity, **when** I release, **then** I am
  warned and may confirm or cancel.
- **Given** a drop onto a technician who is unavailable, **when** I release,
  **then** it is refused with the reason stated.
- **Given** a failed save, **when** the error returns, **then** the booking
  returns to its original position.

### D3 — Turn a booking into a job on arrival

**As** Sara **I want** one action to start the job **so that** check-in is not
re-typing.
**Size** 5 · **Satisfies** FR-506

- **Given** a booking for today, **when** I check the vehicle in, **then** a
  job is created carrying customer, vehicle, services, technician and bay.
- **Given** check-in, **when** the job is created, **then** I am prompted for
  the current odometer reading.
- **Given** a job created from a booking, **when** I view the booking, **then**
  it links to the job and shows as converted.

---

## Epic E — The job

### E1 — Everything about a job on one screen

**As** Ahmed, owner **I want** one screen that answers every question about a
job **so that** I never navigate between modules to understand what happened.
**Size** 13 · **Satisfies** FR-601, FR-604, FR-605, FR-606

- **Given** a job, **when** I open it, **then** I see customer, vehicle,
  technician, bay, status, progress trail, diagnosis, labour, parts, photos,
  documents, communications and totals without leaving the page.
- **Given** the progress trail, **when** I view it, **then** completed stages,
  the current stage and future stages are visually distinct and each completed
  stage shows who did it and when.
- **Given** a job with an inspection, estimate and invoice, **when** I view it,
  **then** each is reachable in one click and shows its status inline.

### E2 — Only legal status changes

**As** the system **I want** to reject impossible transitions **so that** the
data stays coherent.
**Size** 8 · **Satisfies** FR-602, FR-603

- **Given** a job in Draft, **when** a transition to Invoiced is attempted,
  **then** it is refused with the permitted transitions named.
- **Given** a job in Awaiting Approval, **when** the customer approves, **then**
  it moves to Approved and the assigned technician is notified.
- **Given** a job requiring quality control, **when** completion is attempted
  without a recorded check, **then** it is refused.
- **Given** any transition, **when** it succeeds, **then** actor, timestamp and
  note are recorded.

### E3 — Clock on and off

**As** John **I want** to start and stop the clock in one tap **so that**
labour time is real rather than estimated.
**Size** 5 · **Satisfies** FR-610

- **Given** an assigned job, **when** I tap start, **then** a time entry opens
  against that job and me.
- **Given** an open time entry, **when** I start a different job, **then** the
  first is closed automatically and I am told.
- **Given** a time entry left open past end of day, **when** the worker runs,
  **then** it is closed at the configured shift end and flagged for review.

---

## Epic F — Inspection

### F1 — Complete an inspection on a tablet

**As** John **I want** to record a 30-point inspection in under four minutes
**so that** it actually gets done.
**Size** 13 · **Satisfies** FR-701, FR-702, FR-703, FR-706, NFR-605, NFR-606

- **Given** an inspection template, **when** I open it on a tablet, **then**
  each item offers Pass, Advisory, Critical and Not checked as targets of at
  least 48 by 48 pixels.
- **Given** an item, **when** I mark it Advisory or Critical, **then** a note
  and photograph prompt appears without leaving the list.
- **Given** a section, **when** I tap mark-all-pass, **then** every unset item
  in that section becomes Pass.
- **Given** a part-complete inspection, **when** the tablet loses connectivity,
  **then** my entries survive and sync when it returns.
- **Given** a 30-item inspection, **when** timed with a real technician wearing
  gloves, **then** the median completion is under four minutes.

### F2 — Structured measurements, not prose

**As** Ahmed **I want** tyre and brake measurements recorded as numbers **so
that** wear can be tracked across visits.
**Size** 5 · **Satisfies** FR-709

- **Given** a tyre item, **when** I record it, **then** I enter tread depth in
  millimetres per wheel position.
- **Given** a brake item, **when** I record it, **then** I enter pad thickness
  and disc thickness as numbers with units.
- **Given** a vehicle with prior measurements, **when** I view the item,
  **then** the previous value and the wear rate are shown.

### F3 — Turn findings into an estimate

**As** Sara **I want** inspection findings to become estimate lines **so that**
nothing is lost in re-typing.
**Size** 8 · **Satisfies** FR-705

- **Given** a completed inspection with two Critical and one Advisory finding,
  **when** I generate an estimate, **then** three lines are created carrying
  description, recommended action, estimated cost and photographs.
- **Given** the generated estimate, **when** I review it, **then** I can adjust
  prices, remove lines and add lines before sending.
- **Given** a finding already on an estimate, **when** I generate again,
  **then** it is not duplicated.

---

## Epic G — Estimate and approval

### G1 — Send an estimate the customer can actually read

**As** Sara **I want** to send an estimate by SMS **so that** approval does not
depend on a phone call.
**Size** 8 · **Satisfies** FR-803, FR-804, FR-809

- **Given** a completed estimate, **when** I send it, **then** the customer
  receives a link by their preferred channel and the message is logged.
- **Given** the link, **when** it is opened, **then** it shows the vehicle,
  each line in plain language, the inspection photographs, and the total
  including tax.
- **Given** the link, **when** it is opened after expiry, **then** access is
  refused with an instruction to contact the workshop.

### G2 — Approve on a phone in under a minute

**As** Maria **I want** to approve without an account **so that** I can do it
in a supermarket car park.
**Size** 8 · **Satisfies** FR-805, FR-806, FR-807, FR-808, NFR-608

- **Given** the estimate link on a phone, **when** it loads, **then** it is
  readable without zooming and the primary action is reachable with a thumb.
- **Given** the estimate, **when** I approve, **then** the job advances, the
  technician is notified, and I see confirmation.
- **Given** the estimate, **when** I decline a single line and approve the
  rest, **then** the job proceeds with only the approved work and the revised
  total is recorded.
- **Given** any decision, **when** it is recorded, **then** timestamp, source
  address and the exact total agreed are stored.
- **Given** the estimate, **when** I ask a question, **then** it appears on the
  job and the advisor is notified.

### G3 — Extra work needs fresh approval

**As** Ahmed **I want** work beyond the approved figure to require re-approval
**so that** we never argue at the collection desk.
**Size** 5 · **Satisfies** FR-812, FR-810

- **Given** an approved estimate, **when** lines are added exceeding the
  configured threshold, **then** the job returns to Awaiting Approval.
- **Given** a revision, **when** it is sent, **then** it is a new version and
  the previous one remains visible.

---

## Epic H — Technician interface

### H1 — See only my work

**As** John **I want** a list of just my jobs for today **so that** I do not
navigate a management system.
**Size** 8 · **Satisfies** FR-106, NFR-108

- **Given** the Technician role, **when** I sign in on a tablet, **then** I see
  my jobs for today, ordered by promised time, with vehicle, work and estimated
  hours.
- **Given** the list, **when** I tap a job, **then** I get tasks, inspection,
  photos, notes, part request and complete, and nothing else.
- **Given** the tablet on workshop Wi-Fi, **when** the list loads, **then** it
  is interactive within 1.5 seconds.

### H2 — Request a part without leaving the job

**As** John **I want** to request a part in two taps **so that** I do not walk
to the office.
**Size** 5 · **Satisfies** FR-609, FR-1102

- **Given** a job, **when** I request a part, **then** I search by name or
  number and add it with a quantity.
- **Given** the request, **when** it is submitted, **then** the service advisor
  is notified and it appears on the job.

---

## Epic I — Invoice and payment

### I1 — Invoice from the completed job

**As** Sara **I want** the invoice to build itself **so that** collection is not
delayed by paperwork.
**Size** 8 · **Satisfies** FR-901, FR-902, FR-903, FR-907

- **Given** a completed job, **when** I create the invoice, **then** it carries
  all approved labour, parts and fees with correct tax.
- **Given** an issued invoice, **when** editing is attempted, **then** it is
  refused and a credit note is offered.
- **Given** consecutive invoices in one organisation, **when** numbers are
  assigned, **then** they are sequential with no gaps.

### I2 — Take a part payment

**As** Sara **I want** to record a deposit or partial payment **so that** the
balance is always right.
**Size** 5 · **Satisfies** FR-905, FR-906, FR-908

- **Given** an invoice of 1,408, **when** I record 500 by card, **then** the
  balance shows 908 and the payment is listed.
- **Given** payments totalling the invoice, **when** the last is recorded,
  **then** the invoice and job both move to Paid.

---

## Epic J — Dashboard and portal

### J1 — Know what needs me today

**As** Ahmed **I want** a dashboard of actions rather than charts **so that**
opening it tells me what to do.
**Size** 8 · **Satisfies** FR-1401, FR-1402

- **Given** the dashboard, **when** it loads, **then** it shows today's jobs,
  vehicles in shop, jobs awaiting approval and revenue today.
- **Given** any figure, **when** I select it, **then** I reach the underlying
  records filtered accordingly.
- **Given** jobs awaiting approval, **when** shown, **then** each can be
  reviewed and chased from the dashboard itself.

### J2 — Follow my car from my phone

**As** Maria **I want** to see my vehicle's status without ringing **so that**
I know when it will be ready.
**Size** 8 · **Satisfies** FR-1301, FR-1303, FR-1304, FR-1308

- **Given** portal access, **when** I sign in, **then** I see my vehicles and
  each one's current status in plain language.
- **Given** a vehicle in progress, **when** I open it, **then** I see the
  current stage, the estimate if any, and the expected completion.
- **Given** any portal screen on a phone, **when** it renders, **then** it is
  usable without horizontal scrolling.

---

## Epic K — Customers with accounts (Phase 15.1)

### K1 — Sign up and claim my car

**As** Maria **I want** an account of my own and to put my car on it **so that**
I can see its history without waiting for a workshop to invite me.
**Size** 8 · **Satisfies** FR-4101, FR-4102, FR-4103, FR-4104, FR-4105

- **Given** no account, **when** I sign up at `/signup/customer`, **then** I have
  an account with no vehicles on it.
- **Given** my account, **when** I type my plate or VIN however it is written,
  **then** a request goes to the workshop that last serviced the car, and I
  cannot tell which workshop that is.
- **Given** a plate that has been on two cars, **when** I ask, **then** I am
  told to use the VIN instead.
- **Given** my request, **when** the workshop refuses, **then** I am told why,
  the refusal records who and when, and it cannot be answered twice.

### K2 — Confirm my email before I run a workshop

**As** a new workshop owner **I want** to be held until my address is proven
**so that** nobody can run a workshop from an address that is not theirs.
**Size** 3 · **Satisfies** FR-4106, FR-4107

- **Given** a fresh workshop sign-up, **when** I try any workshop screen,
  **then** I am held at the confirmation page.
- **Given** the confirmation email, **when** it is queued, **then** it is
  pushed to the provider at once rather than waiting for the daily cron.

### K3 — Every button leads somewhere

**As** any staff user **I want** every "new" button to create the record it
names **so that** I never press something that silently does nothing.
**Size** 5 · **Satisfies** FR-4108, FR-4109, FR-4110, FR-4111, FR-4112, FR-4113, FR-4114

- **Given** the customers, parts and purchasing pages, **when** I press new,
  **then** a form appears and saving it creates the record, with duplicates
  shown before saving.
- **Given** a draft quote, **when** I send it, **then** the customer receives a
  single-use link and it cannot be sent twice.
- **Given** an invitation, **when** I invite a colleague, **then** the email the
  page promises is actually queued and pushed.

## Epic L — The money cycle (Phase 16)

### L1 — Move a job through its life and invoice it

**As** Sara **I want** to start, complete and invoice a job from its own page
**so that** the money follows the work without a second system.
**Size** 8 · **Satisfies** FR-4201, FR-4202, FR-4203, FR-4204, FR-4205

- **Given** a received job, **when** I start the work, complete it and issue
  the invoice, **then** each move is refused with a reason if the lifecycle
  forbids it, parts are consumed at average cost on completion, and the invoice
  is numbered without a gap.
- **Given** an approved estimate, **when** the customer approves, **then** the
  approved lines land on the job once and never overwrite what was typed.

### L2 — Take payment, credit and refund

**As** Sara **I want** to record payments, credit notes and refunds against an
invoice **so that** what the customer owes is always exactly right.
**Size** 5 · **Satisfies** FR-4206, FR-4207, FR-4208, FR-4209

- **Given** an outstanding invoice, **when** I record more than is owed,
  **then** it is refused.
- **Given** a credit note, **when** I raise it, **then** it carries a reason and
  cannot exceed the invoice less earlier credits.
- **Given** a refund, **when** I record it, **then** it is the lesser of what
  was paid and what was credited, and the trial balance still balances.

## Epic M — Suppliers, payroll and fleets (Phase 16)

### M1 — Book and pay a supplier's bill

**As** Sara **I want** to book a supplier's bill against its order, approve it
and pay it **so that** what we owe is in the ledger and the supplier is told.
**Size** 5 · **Satisfies** FR-4301, FR-4302, FR-4303, FR-4304

- **Given** a purchase order, **when** I book the bill with the supplier's
  reference, **then** it enters payables once.
- **Given** approved bills, **when** I pay the supplier, **then** the payment is
  allocated oldest-due first, every penny lands on a bill, and a remittance
  advice names each.

### M2 — Hand timesheets to payroll

**As** an owner **I want** a period's approved timesheets as one payroll file
**so that** wages are paid from what was actually worked.
**Size** 5 · **Satisfies** FR-4305, FR-4306, FR-4307

- **Given** approved timesheets, **when** I run payroll, **then** one CSV row
  per person carries reference, name, period, ordinary and overtime hours and
  gross pay, and the same sheet cannot be run twice.
- **Given** an exported run, **when** I mark it paid, **then** every sheet on it
  is paid, wages are posted against the bank, and a paid sheet is final.

### M3 — One invoice per fleet a month

**As** a fleet manager's supplier **I want** one consolidated invoice a month
at agreed discounts **so that** the company pays once and sees every job.
**Size** 5 · **Satisfies** FR-4308, FR-4309, FR-4310

- **Given** a company customer, **when** I save an agreement, **then** it
  carries labour and parts discounts, terms and whether a PO number is required.
- **Given** a month's completed jobs, **when** I consolidate, **then** one
  invoice names the job on every line at the agreed discount, and a job with
  no PO number is refused by name when the agreement requires one.

## Epic N — Answers rather than pages (Phase 17)

### N1 — Ask a question in words

**As** an owner **I want** to ask "what did we take this month" and get a
figure with its working **so that** I am not hunting through pages.
**Size** 5 · **Satisfies** FR-4401, FR-4402, FR-4403, FR-4404

- **Given** a question the page advertises, **when** I ask it, **then** I get
  the figure, the steps, and a link to the page that computes the same thing.
- **Given** a question outside the vocabulary, **when** I ask it, **then** it is
  refused with the list of what can be asked, never guessed at.

### N2 — A summary for the customer

**As** Sara **I want** a customer-ready summary of a completed job **so that**
the customer understands what was done without my rewriting it.
**Size** 3 · **Satisfies** FR-4405, FR-4406, FR-4407, FR-4408

- **Given** a completed job, **when** I open its summary, **then** every number
  and part number in it is on the job, or the plain version is used and the
  reason shown.
- **Given** the summary, **when** it exists, **then** nothing has changed on
  the job: no status, posting or message follows from it without my action.

## Epic O — The network (Phase 18)

### O1 — Find a car another workshop keeps

**As** Sara **I want** to find a car we have never seen by its plate **so that**
its history is in front of me before it is on the ramp.
**Size** 8 · **Satisfies** FR-4501, FR-4502, FR-4503, FR-4504, FR-4505, FR-4506

- **Given** a plate or VIN, **when** I look it up, **then** I am told history
  exists, how much and who kept it, but not the entries.
- **Given** the car, **when** I take it on, **then** I can read its history with
  the other workshop's job numbers, identifiers and staff withheld, and what I
  record continues the same chain.
- **Given** a car new to the network, **when** I add it by VIN, **then** a VIN
  already on the network is refused with the way in, and a bad check digit is a
  warning, not a refusal.

### O2 — Read my records through a key

**As** an owner with accounting software **I want** a key that reads our jobs
and invoices **so that** the software can sync without a person signed in.
**Size** 5 · **Satisfies** FR-4507, FR-4508, FR-4509

- **Given** Settings, **when** I make a key, **then** it is shown once, stored
  as a digest, and listed by name with its last use.
- **Given** the key, **when** the software calls the API, **then** it sees only
  what this workshop sees, bounded by a window and a row cap, and a revoked key
  reads nothing.

## Epic P — The workshop configures itself (Phase 19)

### P1 — Change the workshop's own settings

**As** an owner **I want** to change our details, site, hours, bays, tax rates
and kinds of work myself **so that** nobody at Carnet has to touch a database.
**Size** 8 · **Satisfies** FR-4601, FR-4602, FR-4603, FR-4604, FR-4605, FR-4607, FR-4608

- **Given** a settings page, **when** I save a bad value, **then** it is
  refused at the form with the reason.
- **Given** a bay, rate or kind of work that has been used, **when** I retire
  it, **then** it takes no new work and old work reads the same; the default
  tax rate cannot be retired and an invoiced rate keeps its percentage.
- **Given** any change, **when** it is saved, **then** the audit log has who,
  when, what it was and what it became.

### P2 — Write the plan into the diary

**As** a manager **I want** the proposed day written into the diary with one
press **so that** the morning meeting does not retype it.
**Size** 5 · **Satisfies** FR-4606

- **Given** a proposed day, **when** I accept it, **then** each placement is a
  booking against its job with the plan's technician, bay and times.
- **Given** an accepted day, **when** I accept again, **then** bookings move
  rather than double, and the next proposal treats them as fixed.

## Epic Q — The vehicle's paperwork (Phase 20)

### Q1 — Keep the vehicle's paperwork

**As** Maria **I want** the registration certificate, MOT, insurance and
receipts kept with the car **so that** they are there whoever services it.
**Size** 8 · **Satisfies** FR-4701, FR-4702, FR-4703, FR-4704, FR-4705, FR-4707, FR-4708

- **Given** my vehicle, **when** I add a PDF or a picture of the paper by kind,
  **then** it is stored before the row is recorded and shown to me and to the
  workshop that services the car, and to nobody else.
- **Given** an MOT running out, **when** the workshop opens reminders, **then**
  it is listed, and an old certificate under a newer one is not counted.
- **Given** a document, **when** I remove it, **then** a reason is required, the
  row stays with it, and the removal is audited.

### Q2 — Ask for my usual technician

**As** Maria **I want** the workshop to know which technician I ask for **so
that** I am not asked every time.
**Size** 2 · **Satisfies** FR-4706

- **Given** my customer record, **when** the workshop sets my preferred
  technician, **then** that person is preselected on my next job, and the
  diary has the last word.

---

## Epic R — Before general availability (Phase 21)

### R1 — Every page defends itself

**As** an owner **I want** every page to carry a strict Content Security Policy
**so that** a script nobody at Carnet wrote cannot run in my workshop's browser.
**Size** 5 · **Satisfies** FR-4801, FR-4806

- **Given** any page, **when** it is served, **then** the policy names a nonce
  that only this request's scripts carry, and no inline script runs without it.
- **Given** two requests, **when** their headers are compared, **then** the
  nonces differ.

### R2 — No leaked passwords

**As** any person setting a password **I want** to be told if it has already
leaked **so that** my account is not protected by a password on a public list.
**Size** 3 · **Satisfies** FR-4802

- **Given** a password in a known breach, **when** I set it, **then** it is
  refused and I am told how often it has appeared and what to do instead.
- **Given** the range service is down, **when** I set a password, **then** the
  sign-up completes and the gap is logged.

### R3 — A key cannot flood the database

**As** an owner **I want** an integration limited to a thousand calls an hour
**so that** one badly written sync cannot slow the workshop down.
**Size** 2 · **Satisfies** FR-4803

- **Given** a key that has made its thousand calls, **when** it calls again,
  **then** it gets 429 with Retry-After, and an hour later it works again.

### R4 — The backup is proven, not trusted

**As** an owner **I want** the backup restored and checked automatically **so
that** the day we need it is not the first time anybody tried.
**Size** 5 · **Satisfies** FR-4804

- **Given** the seeded database, **when** CI runs, **then** a dump is restored
  into a fresh database and every row and every vehicle's chain match.

### R5 — The API describes itself

**As** an integrator **I want** an OpenAPI document that cannot drift from the
endpoints **so that** what I build against is what is running.
**Size** 3 · **Satisfies** FR-4805

- **Given** the API, **when** I fetch `/api/v1/openapi.json`, **then** every
  endpoint is described, and CI fails if a handler has no entry.

---

## Epic S — The assistant inside the workflow (Phase 22)

### S1 — Read the job back to me

**As** Sara **I want** a job's state read back in plain sentences **so that** I
can pick up a colleague's job cold and know what is blocking it.
**Size** 5 · **Satisfies** FR-4901, FR-4907

- **Given** a job, **when** I ask where it stands, **then** the first sentence
  says whose car, what it is in for and its state, and the next says what it
  is waiting on, if anything.
- **Given** a question on the Ask page, **when** I ask it, **then** it is
  routed as before and the exchange is recorded.

### S2 — Draft the message, I will send it

**As** Sara **I want** a message to the customer drafted from the job **so
that** I do not retype the same update thirty times a day.
**Size** 8 · **Satisfies** FR-4902, FR-4903, FR-4906

- **Given** a job, **when** I ask for a progress update, a request for a
  decision or a ready note, **then** the draft carries no figure the job does
  not have.
- **Given** a draft, **when** I edit and send it, **then** it goes once, as
  edited, to the customer's own number or address, and cannot be sent twice.
- **Given** a model configured, **when** its version adds a figure, **then**
  the plain version is used and the reason is shown.

### S3 — Know what the assistant is doing and spending

**As** an owner **I want** every exchange recorded and a monthly budget **so
that** the assistant is accountable and cannot run up a bill.
**Size** 3 · **Satisfies** FR-4904, FR-4905

- **Given** any exchange, **when** it happens, **then** it is recorded with who,
  what kind, the words shown and the tokens used, and audited.
- **Given** a spent budget, **when** somebody asks for a draft, **then** they
  get the plain text, not a refusal; zero switches the model off.

---

## Epic T — The passport, designed (Phase 23)

### T1 — A document I recognise

**As** David **I want** the shared history to read as a passport **so that**
I know in a second what it is and why I should believe it.
**Size** 8 · **Satisfies** FR-5001, FR-5002, FR-5003, FR-5004

- **Given** a share link, **when** I open it, **then** I see a cover, an
  identity page with a machine-readable zone, observations, and stamps.
- **Given** any stamp, **when** I read it, **then** it names who pressed it,
  what kind of entry it is, the date and the mileage, and no owner's name.

### T2 — I can get back, and I can pick it up

**As** anybody **I want** the passport on the home page to be an object I can
open, and a way back from a shared passport **so that** I am never stranded.
**Size** 5 · **Satisfies** FR-5005, FR-5006

- **Given** the home page, **when** I press "Open the passport", **then** the
  cover opens on the identity page and the entries are also buttons.
- **Given** a shared passport reached from this site, **when** I press Back,
  **then** I return where I came from; from elsewhere, to the front door.

---

## Epic U — Points, and the public face (Phase 24)

### U1 — Points at the counter

**As** Sara **I want** a customer's points to earn themselves and to come off
a bill when I press the button **so that** the programme costs me a moment,
not a spreadsheet.
**Size** 5 · **Satisfies** FR-5101, FR-5102, FR-5103, FR-5104, FR-5105, FR-5107

- **Given** a bill paid in full, **when** the last payment lands, **then** the
  customer earns a point a pound on what they paid, once, and I did nothing.
- **Given** an invoice with something owed and a customer with points,
  **when** I open it, **then** I am offered the most they can use, and the
  points come off the bill as a payment that the ledger books as the cost of
  the programme.
- **Given** more points than they have, or more than the bill, **when** I try,
  **then** I am told in a sentence and nothing is spent.
- **Given** a bad week, **when** I give points by hand, **then** I have to say
  why, and that is what the customer reads.

### U2 — My points, where I can see them

**As** Maria **I want** to see the points I hold at each garage **so that** I
know what they are worth and use them before they lapse.
**Size** 3 · **Satisfies** FR-5106

- **Given** the portal, **when** I hold points at a workshop, **then** I see
  how many, what they are worth there, and when any lapse.
- **Given** a workshop where I hold none, **when** I look, **then** it is not
  listed; a row of zeros is a sales pitch.

---

## Epic V — Referrals, in the product (Phase 25)

### V1 — A code at the counter

**As** Sara **I want** to take a referral code from somebody new and have
both sides paid when it is earned **so that** the scheme runs itself and I
never promise points on a sign-up.
**Size** 5 · **Satisfies** FR-5202, FR-5203, FR-5204, FR-5205, FR-5206

- **Given** a new customer who arrived with a code, **when** I take them
  down, **then** the code is checked before the record exists and refused in
  a sentence if it is wrong.
- **Given** a newcomer whose bills have not reached the minimum, **when**
  their bill is paid, **then** nobody is paid; **when** the bill that crosses
  the line is paid, **then** both sides are, and I pressed nothing.
- **Given** a customer already introduced, **when** a second code is offered,
  **then** it is refused.

### V2 — Bring a friend

**As** Maria **I want** my code for each garage, with what it pays and when
**so that** I can hand it to a friend and know what to expect.
**Size** 2 · **Satisfies** FR-5201

- **Given** the portal, **when** I look, **then** I see a code per workshop and
  the rule beside it: both of us get the points once my friend has had the
  minimum of work done.

---

## Epic W — Gift cards (Phase 26)

### W1 — Selling one

**As** Sara **I want** to sell a gift card at the counter **so that** a
present can be bought here without me inventing a way to record it.
**Size** 3 · **Satisfies** FR-5301, FR-5302, FR-5303, FR-5306

- **Given** somebody paying by card, **when** I sell a fifty pound card,
  **then** I get a number to write on it, and the books show fifty pounds
  owed as work rather than fifty pounds earned.
- **Given** pence, too little, too much, or points offered as payment,
  **when** I try, **then** I am told in a sentence and nothing is sold.

### W2 — Spending one

**As** Sara **I want** to take a gift card off a bill **so that** the
customer pays the rest and the books stay right.
**Size** 3 · **Satisfies** FR-5302, FR-5304, FR-5305

- **Given** an invoice with something owed, **when** I type the card number
  and leave the amount blank, **then** the card pays as much as the bill
  needs and the rest is left on it.
- **Given** an amount larger than the card or the bill, **when** I try,
  **then** it is refused, not quietly reduced.
- **Given** the card's page, **when** I open it, **then** I see every
  movement on it and what is left.

---

## Epic X — The passport, listed (Phase 27)

### X1 — All of them at once

**As** Ahmed **I want** every passport my workshop has a hand in on one page
**so that** I can see how much of the network we have built and whether
every record is sound.
**Size** 3 · **Satisfies** FR-5401, FR-5402, FR-5404

- **Given** the Passports page, **when** I open it, **then** I see each
  vehicle with its entries, its workshops and whether its chain verifies, and
  I can open any as the next owner will see it.
- **Given** a chain that does not verify, **when** I open the page, **then**
  that is the first figure on it.

### X2 — Mine, together

**As** Maria **I want** my cars' passports listed **so that** I can open one
or show it to a buyer without hunting.
**Size** 2 · **Satisfies** FR-5403

- **Given** the portal, **when** I open Passports, **then** I see each car I
  own now, whether its record is sound, and how to show it to somebody.

---

## Epic Y — Gift cards, deepened (Phase 28)

### Y1 — A card at the counter, and back onto it

**As** Sara **I want** to take a gift card at the counter and to put a
refund back on the card that paid **so that** a present works everywhere a
card does and a refund does not become cash the customer never handed over.
**Size** 5 · **Satisfies** FR-5501, FR-5504, FR-5505

- **Given** a sale at the counter, **when** the customer offers a gift card,
  **then** it pays what it can and the rest is cash, and the books show the
  liability released rather than money in the drawer.
- **Given** a bill paid with a card and then credited, **when** I refund by
  gift card, **then** the money is back on that card.

### Y2 — A card explained

**As** Ahmed **I want** every card to say what happened on it and what it is
now **so that** a question about a balance has an answer and a lost card can
be dealt with.
**Size** 5 · **Satisfies** FR-5502, FR-5503, FR-5506, FR-5507

- **Given** a card's page, **when** I open it, **then** I see it loaded,
  spent, returned or changed by hand, each with a reason, and whether it is
  active, spent, lapsed or cancelled.
- **Given** a complaint, **when** I add five pounds with a reason, **then**
  the books move by five pounds as goodwill.
- **Given** a card reported lost, **when** I cancel it with the reason,
  **then** what was on it is written off and the number refuses every use.

---

## Epic Z — Country and currency (Phase 29)

### Z1 — A workshop in dollars

**As** an owner opening a workshop in Canada **I want** to choose my country
once and see dollars, Canadian dates and my own tax everywhere **so that**
the product is mine and not a British one with the labels changed.
**Size** 8 · **Satisfies** FR-5601, FR-5602, FR-5603, FR-5605, FR-5606

- **Given** sign-up, **when** I choose Canada, **then** the currency, the
  language and region, the clock and the first tax rate are set for me.
- **Given** any page, **when** it shows money or a date, **then** it is in my
  workshop's currency and my region's format.
- **Given** settings, **when** I change the currency, **then** I am told that
  nothing already recorded is converted.

### Z2 — The driver sees what the bill says

**As** Maria **I want** each amount in the portal in the currency the
workshop billed it in **so that** what I read matches the paper.
**Size** 2 · **Satisfies** FR-5604

- **Given** two workshops in two countries, **when** I look at my invoices,
  **then** each is in its own currency.

---

## Epic AA — Money owed ahead (Phase 30)

### AA1 — A deposit before the parts are ordered

**As** Sara **I want** to take a deposit before ordering a customer's parts
and have the invoice take it later **so that** the workshop is not out of
pocket and nobody retypes anything.
**Size** 5 · **Satisfies** FR-5701, FR-5702, FR-5703, FR-5705

- **Given** a customer and their job, **when** I take two hundred pounds,
  **then** the books show it as owed, not earned, and the job's page says it
  is in hand.
- **Given** the invoice, **when** I press "Use money held", **then** it comes
  off the bill and the books release what was owed.
- **Given** a cancelled order, **when** I return the money with a reason,
  **then** it goes back the way money goes and the reason stays.

### AA2 — Keep it as credit

**As** Ahmed **I want** a refund to be keepable on the customer's account
**so that** a regular customer's twenty pounds is spent on their next visit
rather than posted back and forgotten.
**Size** 2 · **Satisfies** FR-5704

- **Given** a credit note, **when** I refund it as credit, **then** the
  customer's page shows it held and the next invoice can take it.

### AA3 — A receipt in my hand

**As** Maria **I want** a receipt for every payment **so that** I have paper
that says what I paid and what is still owed.
**Size** 2 · **Satisfies** FR-5706

- **Given** a payment, **when** it lands, **then** I am sent a receipt, and
  the workshop can print one for me at the counter.

## Epic AB — Permissions at the resource, and the plan enforced (Phase 31)

### AB1 — Tried, not trusted

**As** Ahmed **I want** every door in the workshop knocked on as every role
by a script **so that** the permission table is something we know, not
something we believe.
**Size** 5 · **Satisfies** FR-5801, FR-5802, FR-5803

- **Given** every workshop page and every role, **when** the probe runs,
  **then** each answer matches the table, and a technician lands on the shop
  floor.
- **Given** another workshop's customer, **when** I ask for it by id,
  **then** it is not found, and I learn nothing.
- **Given** a server action behind a reading permission that writes, **when**
  the probe reads the page, **then** it fails and names the action.

### AB2 — Told where I try

**As** Ahmed **I want** the plan's limit to stop me where I add the seventh
bay, with the number and the plan that raises it **so that** I am not sent
to a pricing page to work out why.
**Size** 3 · **Satisfies** FR-5804, FR-5805

- **Given** six bays on Core, **when** I save a seventh, **then** the form
  says six of six and that Complete raises it, and nothing is saved.
- **Given** Core, **when** I make an API key, **then** I am told Complete
  has the API.

### AB3 — Nothing lost when the trial ends

**As** Ahmed **I want** a lapsed workshop to keep reading and exporting
**so that** a missed renewal never costs a record, and choosing a plan puts
everything back.
**Size** 3 · **Satisfies** FR-5806, FR-5807

- **Given** a trial that ended a fortnight ago, **when** I open a new job,
  **then** I land on the subscription page with the reason, and the jobs
  list still opens.
- **Given** a cancelled workshop, **when** I choose a plan, **then** it is
  open again and the change is in the audit log.

## Epic AC — Card payment through a provider (Phase 32)

### AC1 — Pay now, from my phone

**As** Maria **I want** to pay an invoice by card from the portal **so
that** I am not asked to transfer money by hand or ring the workshop with a
card number.
**Size** 5 · **Satisfies** FR-5901, FR-5902, FR-5903, FR-5904

- **Given** an outstanding invoice, **when** I press "Pay now", **then** I
  land on a secure checkout for exactly what is owed.
- **Given** the card is declined, **when** I come back, **then** the page
  says why, nothing has been taken, and I can try again.
- **Given** the card is accepted, **when** I come back, **then** the invoice
  is settled and a receipt is on its way, and pressing back does not pay
  twice.

### AC2 — Back to the card it came from

**As** Sara **I want** a refund to go back through the provider to the card
that paid **so that** I am not typing card numbers or sending bank transfers
for money that arrived online.
**Size** 3 · **Satisfies** FR-5905

- **Given** an invoice paid online, **when** I refund by card, **then** the
  provider is asked first and the refund carries its reference.
- **Given** an invoice paid in cash, **when** I choose card, **then** it is
  refused with a sentence.

### AC3 — The provider's word against the books

**As** Fatima **I want** the provider's record compared with the books, with
each difference named **so that** a payment that landed at the provider and
never reached us is found by me and not by the customer.
**Size** 3 · **Satisfies** FR-5906, FR-5907

- **Given** a payment the provider took and we did not record, **when** I
  reconcile, **then** it is named, and checking that attempt records it.
- **Given** everything agrees, **when** I reconcile, **then** the page says
  so and changes nothing.

## Epic AD — The subscription, billed (Phase 32.6)

### AD1 — Nothing about the charge surprises me

**As** a workshop owner opening Carnet **I want** to be told, before I add
a card, exactly when and how much it will be charged and how to stop it
**so that** the trial is a trial and not a trap.
**Size** 5 · **Satisfies** FR-6001, FR-6002, FR-6003

- **Given** the sign-up form, **when** I read the box beside the button,
  **then** it names the plan, the price per bay, the day the card is charged,
  and that cancelling is two presses from Settings.
- **Given** the trial has three days left, **when** the hourly job runs,
  **then** I get one email with the card, the amount and the date, and not a
  second one.
- **Given** I skipped the card, **when** I open the workshop, **then** it is
  read-only with a button to add the card and a sentence saying nothing is
  charged until the trial ends.

### AD2 — The billing page tells me everything

**As** Ahmed **I want** one page with the card, the next charge, the
invoices and the cancel button **so that** I never have to email anybody to
find out what I am paying.
**Size** 3 · **Satisfies** FR-6004, FR-6005

- **Given** a card on file, **when** I open Settings, Subscription, **then**
  I see the card's last four digits, the next charge as an amount on a date,
  and every invoice with its status.
- **Given** a charge fails, **when** I open the page, **then** it says so,
  tells me to update the card, and the workshop still works.

### AD3 — Cancelling is two presses and does what it says

**As** Ahmed **I want** cancelling to stop the next charge and keep what I
paid for **so that** leaving costs nothing more than the month I used.
**Size** 2 · **Satisfies** FR-6006, FR-6007

- **Given** a plan, **when** I cancel, **then** the page says the workshop
  stays open until the paid period ends, and no next charge is scheduled.
- **Given** a trial, **when** I cancel, **then** the card is never charged.

## Epic AE — One currency, and the customer's account (Phase 32.7)

### AE1 — Priced in my money

**As** a workshop owner in Canada **I want** every price I see and pay to
be in dollars **so that** I am never quoted in one currency and billed in
another.
**Size** 3 · **Satisfies** FR-6101, FR-6102

- **Given** the pricing page, **when** I pick Canada, **then** every plan is
  in dollars and the tax is called GST.
- **Given** the sign-up form, **when** I choose Canada, **then** the plan
  prices and the sentence by the terms box change to dollars at once.
- **Given** my billing page, **when** the trial is about to end, **then** the
  next charge and the reminder are in dollars, and the provider charges
  dollars.

### AE2 — My account, in one place

**As** Maria **I want** a settings page in the portal **so that** I can
change my phone number, my password and what a workshop may send me without
asking anybody.
**Size** 3 · **Satisfies** FR-6103

- **Given** the portal, **when** I press Account, **then** I see my details,
  a password form, and a row per workshop with email and text switches.
- **Given** I turn off a workshop's offers, **when** I save, **then** the
  workshop sees a consent change with the date and that I made it.

## Epic AF — Data in, data out (Phase 33)

### AF1 — Five thousand customers by the afternoon

**As** Ahmed **I want** to upload the customer list from the old system and
be told, row by row, what would not go in **so that** the move takes an
afternoon and not a fortnight of retyping.
**Size** 5 · **Satisfies** FR-6201, FR-6202, FR-6203, FR-6204

- **Given** a file with "Forename", "Surname" and "E-Mail" columns, **when**
  I upload it, **then** the columns are already mapped and I only check.
- **Given** two rows with the same email, **when** I preview, **then** the
  second says "same as row 2" and is left out.
- **Given** a customer already on my books, **when** I import, **then** the
  row is refused with the reason and nothing is doubled.

### AF2 — The books open where they left off

**As** Fatima **I want** to import the opening balances **so that** the
ledger starts from the old system's closing figures.
**Size** 3 · **Satisfies** FR-6205

- **Given** debits and credits that do not balance, **when** I preview,
  **then** the difference is stated and goes to retained earnings.
- **Given** a code not in the chart, **when** I import, **then** nothing is
  posted and the row is named.

### AF3 — Leaving with everything

**As** Ahmed **I want** every dataset exported whole **so that** the data
is mine whether I stay or go.
**Size** 2 · **Satisfies** FR-6206

- **Given** the data page, **when** I download Everything, **then** one file
  holds customers, vehicles, jobs, invoices, payments, parts, suppliers, the
  ledger and the passports.

---

## Epic AG — The workflow, as one thing (Phase 34)

### AG1 — Car is here

**As** Ahmed at the desk **I want** the booking to become the job in one
press **so that** the customer standing with their keys out is not watching
me retype what I took on the phone.
**Size** 2 · **Satisfies** FR-6301

- **Given** a booking with a technician and notes, **when** I press "Car is
  here, start the job", **then** I am on the job, and it has the customer,
  the car, the description, the notes and the technician on it.
- **Given** a booking already converted, **when** I press it again, **then**
  I am told it is already a job.

### AG2 — Yes, at the counter

**As** Ahmed **I want** to record that the customer approved the quote in
front of me **so that** the work is on the job and the parts are reserved
before they have left the building.
**Size** 3 · **Satisfies** FR-6302, FR-6303, FR-6304

- **Given** an inspection that found worn pads, **when** it is completed,
  **then** the quote it raises has a total I can send.
- **Given** the customer says yes, **when** I press "Customer approved in
  person", **then** the approval is recorded under their name and mine, the
  lines are on the job and any part on our books is reserved.
- **Given** a part we are short of, **when** the approval lands, **then**
  the shortfall is on the purchase list without my going there.

### AG3 — Something else found

**As** Tom under the car **I want** to quote what I just found without
stopping the job I am on **so that** the customer can say yes while I am
still there.
**Size** 3 · **Satisfies** FR-6305

- **Given** a job in progress, **when** I add a part by number and press
  "Quote it now", **then** the customer has the quote and the job is still in
  progress.
- **Given** the customer approves it from their phone, **when** the answer
  arrives, **then** the extra lines are on the job after the ones already
  there, the part is reserved and the job has not moved backwards.

### AG4 — The count, written down

**As** the owner **I want** every hand-off counted in presses **so that** the
next screen anybody adds has to justify itself.
**Size** 2 · **Satisfies** FR-6306

- **Given** the table in core, **when** a hand-off would cost more than it
  did, **then** the unit test fails.
- **Given** the walkthrough, **when** a step needs a second screen, **then**
  the script fails and names the step.

---

## Epic AH — Arrival and departure (Phase 35)

### AH1 — Handed over

**As** Ahmed at the desk **I want** to note what the car is like as it is
handed over, with the customer's signature **so that** "that scratch was
already there" is settled by the record, not by memory.
**Size** 5 · **Satisfies** FR-6401, FR-6402, FR-6403, FR-6405

- **Given** the customer at the counter, **when** I press "Car is here",
  **then** I am on the check-in, and one press saves the mileage, the fuel,
  the marks, the belongings, the hook and the signature.
- **Given** a mileage lower than the last reading, **when** I save, **then**
  it is refused with both numbers.
- **Given** an empty pad, **when** I save with a name, **then** it is
  refused; a check-in without a signature at all is saved and says so.
- **Given** the record, **when** I take photographs, **then** they are on it
  the moment the store confirms them.

### AH2 — Handed back

**As** Ahmed **I want** the car handed back against what was done and what
was paid **so that** no car leaves unfinished or unpaid by accident.
**Size** 3 · **Satisfies** FR-6404, FR-6407

- **Given** a job still in progress, **when** I try to hand the car back,
  **then** I am told to complete it first.
- **Given** money owing, **when** I try, **then** I am sent to take the
  payment, or asked to say why it is leaving unpaid.
- **Given** a fleet car, **when** I write "invoiced monthly", **then** it
  leaves, and the reason is on the record the customer can see.

### AH3 — Where are the keys

**As** Tom under the car **I want** to see where the keys are and say when
I have them **so that** nobody walks round the workshop asking.
**Size** 2 · **Satisfies** FR-6406

- **Given** keys on hook 12, **when** I press "I have them", **then** the
  job says the keys are with me; **when** I press "Back on the hook",
  **then** it says hook 12 again.

---

## Epic AI — Conversations (Phase 36)

### AI1 — One thread

**As** Ahmed **I want** everything said to and by a customer in one place,
on the job it is about **so that** I answer knowing what was already said.
**Size** 5 · **Satisfies** FR-6501, FR-6502, FR-6503

- **Given** a quote sent by text and a reply on WhatsApp, **when** I open
  the job, **then** both are on its conversation in order.
- **Given** a reply, **when** I open the thread, **then** it is read; a
  colleague sees it was.
- **Given** a message from a number nobody has, **when** it arrives,
  **then** it waits for a person and threads when filed.

### AI2 — Answering from the job

**As** Ahmed **I want** to reply from the job on whatever the customer
uses **so that** I do not leave the job or guess the channel.
**Size** 3 · **Satisfies** FR-6504, FR-6505, FR-6507

- **Given** a customer with a mobile and no email, **when** I reply,
  **then** only text and WhatsApp are offered.
- **Given** a PDF chosen with the reply, **when** I send, **then** it is
  on the thread and the message says it was attached.

### AI3 — Sentences, not blanks

**As** Fatima **I want** templates that read as messages **so that** I
send them as they are.
**Size** 2 · **Satisfies** FR-6506

- **Given** "Car is ready" on a job with a vehicle, **when** I choose it,
  **then** the composer holds the sentence with the car's name in it.
- **Given** money owed, **when** I press Payment link, **then** the amount
  and the link are in a sentence; with nothing owed, I am told so.

---

## Epic AJ — Packages and templates (Phase 37)

### AJ1 — Full service, one press

**As** Ahmed **I want** "Full service" to put everything on the job
**so that** the technician picks it up without asking what a full service
is here.
**Size** 3 · **Satisfies** FR-6601, FR-6602, FR-6603

- **Given** a package with labour, an oil filter by part number, a fee
  and a checklist, **when** I open a job from it, **then** the job has the
  lines, the tasks, the kind of work and the hours.
- **Given** a job already open, **when** I add the package, **then** its
  lines follow what was there.
- **Given** a package with no lines, **when** I save, **then** I am told.

### AJ2 — Booked and offered

**As** Maria **I want** to book a full service online at a price **so
that** I know what I am paying before I arrive.
**Size** 2 · **Satisfies** FR-6604

- **Given** a bookable package, **when** I book online, **then** its name,
  description, time and price are shown and the booking is for it.
- **Given** the car arrives, **when** the desk presses "Car is here",
  **then** the job is made from the package.

### AJ3 — The next one

**As** the owner **I want** a service that comes round every year or every
20,000 km to set the next reminder **so that** the customer comes back.
**Size** 2 · **Satisfies** FR-6605

- **Given** the job completes at 50,000 km, **when** it is marked
  completed, **then** the vehicle's schedule says 70,000 km and a year
  from now.

---

## Epic AK — Languages (Phase 37.5)

### AK1 — In my language

**As** Maria in Cairo **I want** the portal in Arabic, read the right way
round **so that** my car's history is something I can read.
**Size** 5 · **Satisfies** FR-6701, FR-6702, FR-6705

- **Given** the switcher, **when** I press العربية, **then** every page I
  visit is in Arabic and reads right to left, on this phone and the next.
- **Given** my browser asks for French, **when** I first arrive, **then**
  the site is in French before I choose anything.

### AK2 — Never half a page

**As** the owner **I want** a sentence without a translation to show in
English and be named **so that** nobody ever sees a key or a blank.
**Size** 2 · **Satisfies** FR-6703, FR-6704

- **Given** a sentence added to a page without its translations, **when**
  the coverage script runs, **then** it fails and says which sentence, in
  which file.

---

## Epic AL — Parts back, work out (Phase 38)

### AL1 — Sending it back

**As** Ahmed **I want** to send faulty pads back from the order they came on
**so that** the credit comes off what I owe and I do not pay for them twice.
**Size** 5 · **Satisfies** FR-6801, FR-6802, FR-6803, FR-6804, FR-6805

- **Given** four pads received, **when** I send back five, **then** I am
  told only four came.
- **Given** two sent back, **when** their credit note arrives, **then** it
  comes off the supplier's oldest bill, and the stock and the books agree.
- **Given** a supplier who will not credit, **when** I record it refused,
  **then** the value is written off and the return is closed.

### AL2 — The core

**As** Fatima **I want** a core charge coming back to reduce the cost of
parts **so that** the margin on the job that used the part is right.
**Size** 2 · **Satisfies** FR-6801, FR-6803, FR-6804

- **Given** a core credited for more than the supplier is owed, **when** the
  next bill is booked, **then** the rest comes off it.

### AL3 — Work sent out

**As** Ahmed **I want** the alignment the tyre place does for us on the job
**so that** the customer pays for it and I can see what we made.
**Size** 3 · **Satisfies** FR-6806, FR-6807

- **Given** an alignment costing 45 charged at 75, **when** I add it,
  **then** it is a line on the job with a margin of 30.
- **Given** their bill for 50, **when** I book it, **then** the line's cost
  is 50, the margin says so, and the bill is owed like any other.

---

## Epic AM — Finding anything (Phase 39)

### AM1 — Whatever is on the paper

**As** Sara on the telephone **I want** to type what the caller reads out
**so that** I am looking at their car before they finish the sentence.
**Size** 3 · **Satisfies** FR-6901, FR-6902, FR-6903

- **Given** "bj21oyd", **when** I search, **then** I am on BJ21 OYD.
- **Given** "0161 496 5522", **when** I search, **then** the customer with
  that number is found however it was written down.
- **Given** a plate only another workshop has worked on, **when** I search,
  **then** nothing is found.

### AM2 — Being told

**As** Ahmed **I want** to be told when a customer approves, writes in,
books online or pays **so that** nobody has to walk over and ask.
**Size** 3 · **Satisfies** FR-6904, FR-6905

- **Given** a customer approves a quote, **when** I look at the bell,
  **then** there is one unread, and it opens the job.
- **Given** John asks for a part, **when** it is recorded, **then** I am
  told and John is not.

---

## Epic AN — The owner's day, sharpened (Phase 40)

### AN1 — What came back

**As** Ahmed **I want** to record that a car is back with the same fault
**so that** I know how much of our work comes back, and whose it was.
**Size** 3 · **Satisfies** FR-7001, FR-7002

- **Given** a car back nine days after its brakes were done, **when** I open
  the new job, **then** the brake job is offered as what came back.
- **Given** I record it with no reason, **when** I press record, **then** it
  is refused and says why.
- **Given** John did the brake job, **when** I read the comebacks, **then**
  it counts against John and not against whoever fixed it.

### AN2 — Whether they are happier

**As** Ahmed **I want** to see whether ratings are rising or falling, by site
and by technician **so that** I talk to the right person about the right
thing.
**Size** 2 · **Satisfies** FR-7003

- **Given** five answers this quarter and five last, **when** I open
  reputation, **then** I read whether it went up, down or held.
- **Given** three answers for a technician, **when** I read the list,
  **then** no average is given.

### AN3 — Who to ring for a part

**As** Paul in parts **I want** every supplier of a short part side by side
**so that** I order from the right one in one press.
**Size** 3 · **Satisfies** FR-7004, FR-7005

- **Given** two suppliers of a filter, **when** I open the part, **then** I
  see which was cheapest last time and which delivers quickest.
- **Given** a supplier whose deliveries went from one day to six, **when** I
  open them, **then** it says they are slower.

### AN4 — The morning read

**As** Ahmed **I want** the dashboard to give me today, the money and the
shelf as figures **so that** I know what needs me before the doors open.
**Size** 2 · **Satisfies** FR-7006

- **Given** invoices past their due date, **when** I open the dashboard,
  **then** I see how much is overdue and it opens the aged debt.
- **Given** a technician, **when** they open the dashboard, **then** the
  business block is not shown.

---

## Epic AO — Every word translated (Phase 40.5)

### AO1 — A workshop in French

**As** Claire, who runs a workshop in Lyon and reads no English, **I want**
every screen in French **so that** I never meet a page I cannot use.
**Size** 8 · **Satisfies** FR-7101, FR-7103, FR-7104

- **Given** French is chosen, **when** I open any workshop page, **then**
  every heading, label, button, empty state and page title is French.
- **Given** a customer called Maria, **when** I read her record in French,
  **then** she is still Maria.

### AO2 — Refused in Arabic

**As** a receptionist in Cairo **I want** a refusal in Arabic **so that** I
know what to do next.
**Size** 3 · **Satisfies** FR-7102, FR-7105

- **Given** Arabic is chosen, **when** I try to record a comeback with no
  reason, **then** the sentence that refuses it is Arabic, with the job
  number in it.
- **Given** a developer adds a heading in English only, **when** the checks
  run, **then** the scanner names the file and line and the phase fails.

---

## Epic AP — Tax, configurable (Phase 41)

### AP1 — Two taxes on a line

**As** a workshop owner in Quebec **I want** GST and QST on the same line,
QST charged with GST in **so that** my invoices are right and my returns add
up.
**Size** 5 · **Satisfies** FR-7201, FR-7205, FR-7207

- **Given** a rate of GST 5% and QST 9.975% on top, **when** a 100.00 job
  is invoiced, **then** the invoice shows GST 5.00 and QST 10.47 and comes
  to 115.47.
- **Given** that rate is on an invoice, **when** I change QST, **then** it
  is refused and I am told to add a new rate.

### AP2 — Prices with tax in

**As** a workshop in Dubai **I want** to enter prices as the customer pays
them **so that** the price on the board is the price on the invoice.
**Size** 3 · **Satisfies** FR-7202

- **Given** prices with tax in and VAT at 5%, **when** a 105.00 service is
  invoiced, **then** it comes to 105.00, of which 5.00 is VAT.

### AP3 — An exempt fleet

**As** Sara **I want** to mark a charity's fleet exempt with its certificate
**so that** their invoices charge no tax and say why.
**Size** 2 · **Satisfies** FR-7203

- **Given** no certificate, **when** I mark them exempt, **then** it is
  refused.
- **Given** a certificate, **when** their job is invoiced, **then** there is
  no tax and the certificate is on the invoice.

### AP4 — Filing the return

**As** the bookkeeper **I want** each tax for last quarter, less credit
notes, per site **so that** I can file without adding up invoices.
**Size** 3 · **Satisfies** FR-7204, FR-7206

- **Given** a site with its own rate, **when** a line is added there,
  **then** it takes that rate.
- **Given** last quarter's invoices, credit notes and counter sales, **when**
  I open the tax report, **then** each tax shows what was charged, given back
  and owed, and the CSV says the same.

---

## Epic CI - Whose move it is (Phase 84)

### CI1 - What is holding things up

**As** a service manager **I want** one screen showing what every job is
waiting for **so that** I stop walking the floor to find out.

**Size** 8 - **Satisfies** FR-11701, FR-11704

- **Given** the open jobs, **when** I open the board, **then** the ones only we
  are holding up come first, and anything past its promised time comes above
  all of it.
- **Given** any job on it, **when** I read the line, **then** it says whose
  move it is, how long, why, and one thing to do.

### CI2 - The estimate nobody sent

**As** a service manager **I want** a job awaiting approval of an unsent
estimate to be shown as ours **so that** our own omission does not read as the
customer being slow.

**Size** 3 - **Satisfies** FR-11703

- **Given** an estimate not yet sent, **when** the job waits for approval,
  **then** the position is ours and the action is to send it.
- **Given** it has been sent, **when** the job waits, **then** the position is
  the customer's.

### CI3 - Nothing stored, nothing to drift

**As** an engineer **I want** the position derived **so that** there is no
second field to keep true.

**Size** 5 - **Satisfies** FR-11702, FR-11705

- **Given** a part put on order, **when** the job is read, **then** it is the
  supplier's, with nothing about the job edited.
- **Given** that part fitted, **when** the job is read again, **then** it is
  ours again, with nothing about the job edited.
- **Given** one job, **when** it is read on the board and on its own page,
  **then** both say the same thing.

---

## Epic CH - One word, two endings (Phase 83)

### CH1 - A word that agrees with its noun

**As** a French or Arabic reader **I want** a status to agree with the thing it
describes **so that** the page reads as written rather than as translated.

**Size** 5 - **Satisfies** FR-11601, FR-11602

- **Given** a gift card, **when** it is active, **then** it reads « Active »,
  and a plan reads « Actif », from one English word.
- **Given** a qualified key with no translation of its own, **when** it is
  shown, **then** the bare key's translation is used.
- **Given** any qualified key, **when** it is read in English, **then** the
  qualifier is not shown.
- **Given** `Job #41`, **when** it is rendered, **then** nothing is stripped.

### CH2 - A backlog rather than a number

**As** whoever picks this up next **I want** the remainder sorted by kind
**so that** I know which of three methods each one needs.

**Size** 2 - **Satisfies** FR-11603

- **Given** the remaining clashes, **when** the check runs, **then** it prints
  how many need a qualifier, how many need one spelling chosen, and how many
  need the English mended.

---

## Epic CG - The corpus, not the guess (Phase 81)

### CG1 - What it has turned out to be here

**As** a technician **I want** to see what this complaint has actually been in
this workshop **so that** I start where the evidence is rather than where I
last looked.

**Size** 8 - **Satisfies** FR-11501, FR-11502, FR-11508

- **Given** a complaint with a settled history, **when** I open the job,
  **then** I am told how many jobs reached a verdict and what they were.
- **Given** the list of causes to rule on, **when** it is drawn, **then** it is
  in the catalogue's order and carries no counts.
- **Given** another workshop's history, **when** I read mine, **then** none of
  it appears.

### CG2 - Silence when it does not know

**As** a workshop owner **I want** the product to say nothing on thin evidence
**so that** nobody is given advice dressed as a record.

**Size** 5 - **Satisfies** FR-11505, FR-11506, FR-11507

- **Given** a cause confirmed twice, **when** the job is opened, **then**
  nothing is shown and the reason is given.
- **Given** a cause only ever ruled out, **when** the history is drawn, **then**
  it is absent from it.
- **Given** a cause confirmed three times and ruled out nine, **when** it is
  shown, **then** both numbers are on the line.
- **Given** a verdict I just entered, **when** I read the history beside it,
  **then** my own verdict is not counted in it.

### CG3 - A finding somebody made

**As** an owner **I want** every verdict to carry who reached it and when
**so that** the corpus is made of findings rather than of entries.

**Size** 3 - **Satisfies** FR-11503, FR-11504

- **Given** a verdict, **when** it is written, **then** the person and the time
  go with it, and the database refuses one without them.
- **Given** a diagnosis with one cause still undecided, **when** the evidence is
  counted, **then** none of that diagnosis is in it.

---

## Epic CF - The sidebar somebody can learn (Phase 80)

### CF1 - My own screen, in my own order

**As** a service advisor **I want** the side of the screen to hold my day
**so that** my first morning is spent working rather than looking.

**Size** 8 - **Satisfies** FR-11401

- **Given** I am an advisor, **when** I sign in, **then** the first section is
  Today and the last is Payments, and there are eight.
- **Given** I am an owner, **when** I sign in, **then** there are thirteen, and
  the first is the Dashboard.
- **Given** I am a technician, **when** I open a workshop page, **then** I am
  taken to my own shell rather than shown a sidebar of two entries.

### CF2 - Nothing built that cannot be found

**As** an engineer **I want** a page with no way in to fail a check **so that**
the map cannot say a thing exists while nobody can reach it.

**Size** 5 - **Satisfies** FR-11402, FR-11403

- **Given** a page in no section, **when** the check runs, **then** it names
  the page and asks for a section or a sentence.
- **Given** a sentence about a page that has been deleted, **when** the check
  runs, **then** it says the sentence has stopped being true.
- **Given** an entry a role could not open, **when** the check runs, **then**
  it names the role, the entry and the permission.

### CF3 - In all three languages, including the headings

**As** a reader in French or Arabic **I want** the section headings translated
**so that** the one part of the screen that never changes is not in English.

**Size** 2 - **Satisfies** FR-11404

- **Given** a heading with no translation, **when** the check runs, **then** it
  names the word and the language.

---

## Epic CE - What the shelf lost, and what the supplier owes (Phase 79)

### CE1 - A credit note for what they charged

**As** a parts manager **I want** the credit box to offer what the supplier
charged **so that** I am not invited to claim a figure their note will not
match.

**Size** 3 - **Satisfies** FR-11301, FR-11303

- **Given** a shelf whose average has moved since the parts were bought,
  **when** the return is credited, **then** the box offers the price paid.
- **Given** the same return, **when** it is listed, **then** the stock value
  it released is still shown, and still what comes off the books.

### CE2 - A core at the charge agreed

**As** a parts manager **I want** a core charge proposed **so that** the one
figure known exactly is not the one left blank.

**Size** 2 - **Satisfies** FR-11302

- **Given** a core sent back at an agreed charge, **when** it is credited,
  **then** the box offers that charge.

---

## Epic CD - A figure that happened to fit (Phase 78)

### CD1 - A credit larger than the bill

**As** a workshop **I want** a supplier credit bigger than the bill to be held
rather than lost **so that** the money is still mine when the next bill comes.

**Size** 2 - **Satisfies** FR-11201

- **Given** a credit worth more than the bill owes, **when** it is applied,
  **then** the bill is settled and the remainder is held against the supplier.
- **Given** a credit worth less, **when** it is applied, **then** it comes off
  in full and nothing is held.

### CD2 - The same answer on any database

**As** an engineer **I want** the returns check to give one answer **so that**
a red means something changed in the code.

**Size** 2 - **Satisfies** FR-11202

- **Given** a shelf whose average cost another check has moved, **when** the
  returns check runs, **then** it passes for the same reason it passed before.

---

## Epic CC - The section that never ran (Phase 77)

### CC1 - The books of a workshop built by the product

**As** an operator **I want** the books of a workshop built through the
product's own functions checked **so that** ordinary use is known to keep them
straight, rather than assumed to.

**Size** 3 - **Satisfies** FR-11102

- **Given** no demonstration workshop, **when** the books check runs, **then**
  it builds one, audits it, and takes it away again.
- **Given** the audit, **when** it runs, **then** every rule holds across the
  whole workshop.

### CC2 - No section that may or may not have run

**As** an engineer **I want** a check that cannot do its job to say so **so
that** green means checked.

**Size** 2 - **Satisfies** FR-11101

- **Given** a probe missing what a section needs, **when** it runs, **then**
  it fails and names the remedy.
- **Given** a probe that prints a skip, **when** `verify-throughout` runs,
  **then** it names that file.

---

## Epic CB - A check that skipped itself (Phase 76)

### CB1 - Money arriving, checked

**As** a workshop **I want** a payment the provider confirms to be recorded
once **so that** my books match the money.

**Size** 3 - **Satisfies** FR-11001

- **Given** a correctly signed webhook, **when** CI runs, **then** it is
  applied and the invoice is paid.
- **Given** the same event again, **when** it arrives, **then** nothing
  changes and there is still one payment.

### CB2 - A check that admits it cannot run

**As** an engineer **I want** a check with a missing precondition to fail
**so that** green means checked.

**Size** 2 - **Satisfies** FR-11002

- **Given** no webhook secret, **when** the payments or billing check runs,
  **then** it fails and names where to set it.

---

## Epic CA - A button that would not wrap (Phase 75)

### CA1 - Nothing wider than the screen

**As** somebody signing up on a small telephone **I want** the form to fit
**so that** I am not dragging the page sideways to read a field.

**Size** 2 - **Satisfies** FR-10901, FR-10902

- **Given** a button whose label is longer than the screen, **when** the page
  is drawn at 320 pixels, **then** the label wraps and nothing overflows.
- **Given** a grid of fields above that button, **when** it is measured,
  **then** none of them is widened by it.

---

## Epic BZ - The browser nobody installed (Phase 74)

### BZ1 - A check that can run

**As** an engineer **I want** the workflow to install what the checks launch
**so that** a red step is about the product rather than about the runner.

**Size** 2 - **Satisfies** FR-10801, FR-10802

- **Given** a check that imports Chromium, **when** the workflow runs, **then**
  Chromium was installed by an earlier step.
- **Given** an install line naming only some engines, **when**
  `verify-throughout` runs, **then** it names each check and the engine it
  launches that nothing installed.

---

## Epic BY - A page that is not there says so (Phase 73)

### BY1 - A dead link that admits it

**As** somebody who followed a link that has expired **I want** the answer to
be honest to whatever is reading it **so that** a link checker, a crawler and a
person are all told the same thing.

**Size** 8 - **Satisfies** FR-10701, FR-10702

- **Given** a revoked or expired passport share link, **when** it is opened,
  **then** the response is 404 and the page explains why links expire.
- **Given** a handover or review link already used, **when** it is opened,
  **then** the response is 404.
- **Given** a car or a quote that is not yours, **when** the portal is asked
  for it, **then** the response is 404 and nothing about it is shown.
- **Given** any of those, **when** the page is slow, **then** the reader still
  sees the loading screen the segment used to draw.

### BY2 - A rule that cannot be forgotten

**As** an engineer **I want** the route tree checked **so that** the next
public route to be added cannot quietly answer 200 for something absent.

**Size** 3 - **Satisfies** FR-10702, FR-10703

- **Given** a page that calls notFound() under a loading boundary, **when** the
  check runs, **then** it names the route and what to do.
- **Given** a segment that should be exempt, **when** it is added to ADR-0015,
  **then** the check accepts it — and not otherwise.

### BY3 - One place for one number

**As** a reader of the front door **I want** the trial length on the page to be
the trial length in the code **so that** a published figure is never a guess.

**Size** 2 - **Satisfies** FR-10704

- **Given** TRIAL_DAYS, **when** the front door renders its call to action,
  **then** the number comes from the constant in all three languages.
- **Given** the same constant, **when** the route checks run, **then** they
  assert against it rather than a number typed beside it.

---

## Epic BX - The passport outlives the workshop (Phase 72)

### BX1 - The history survives the business

**As** David, standing in a driveway **I want** the service history to still
verify after the garage that wrote it has closed **so that** the record means
something years later, which is the only time anybody needs it.

**Size** 8 - **Satisfies** FR-10601, FR-10602

- **Given** a workshop that has recorded an entry, **when** anything tries to
  delete it, **then** the database refuses and the entry still names it.
- **Given** that same workshop, **when** anything tries to null the column by
  hand, **then** the append-only trigger refuses.
- **Given** the workshop is retired instead, **when** the passport is
  verified, **then** it verifies, and the entry still says who did the work.

### BX2 - Made-up history can still be taken away

**As** a workshop trying the demonstration **I want** to remove it completely
**so that** nothing invented is left in my books.

**Size** 3 - **Satisfies** FR-10603

- **Given** a demonstration workshop, **when** it is removed, **then** its
  vehicles and their entries go first and the workshop goes with them.
- **Given** a demonstration workshop that booked in somebody's real car,
  **when** it is removed, **then** that entry stays and the workshop is
  retired rather than deleted.

### BX3 - A break that says what broke it

**As** an engineer **I want** a chain that fails to tell me why **so that** I
do not spend an hour deciding whether the database has been tampered with.

**Size** 2 - **Satisfies** FR-10604

- **Given** an entry recorded by a workshop that names none now, **when** the
  integrity check reports the chain, **then** it says the workshop was deleted
  while its entries pointed at it.

---

## Epic BW - A red that tells you what to do (Phase 70)

### BW1 - A failure I can act on

**As** an engineer **I want** a failing check to tell me whether the code or
the database is at fault **so that** I do not spend an hour proving the code
innocent.
**Size** 8 - **Satisfies** FR-10501, FR-10502

- **Given** a probe that needs a freshly seeded database, **when** the database
  is not fresh, **then** it says so once and names the remedy.
- **Given** a probe that has run before, **when** it runs again, **then** it
  measures what it did rather than what it and every previous run did.
- **Given** a chain broken before this run, **when** the integrity check runs,
  **then** it says the chain was already broken and which vehicle.

### BW2 - The same answer CI gets

**As** an engineer **I want** to run the checks the way CI runs them **so that**
a green locally means something.
**Size** 5 - **Satisfies** FR-10503, FR-10504

- **Given** the workflow, **when** I run one command, **then** the probes run
  in its order with its reseeds.
- **Given** a probe added to the workflow, **when** I run that command,
  **then** it runs too, because the order is read rather than remembered.
- **Given** no application running, **when** I ask for the checks that need
  one, **then** I am told that once rather than twenty-nine times.

---

## Epic BV - What the fleet calls it (Phase 69)

### BV1 - The driver says "van 17"

**As** a service advisor **I want** to find a van by the number painted on its
door **so that** a driver who has never read the registration can still be
helped.
**Size** 8 - **Satisfies** FR-10401, FR-10402

- **Given** a van a fleet calls Van 17, **when** I type that into the search
  box, **then** it is the first answer, with the fleet's name beside it.
- **Given** I type it in lower case with stray spaces, **when** I search,
  **then** it still finds it.
- **Given** two fleets that each call a van Van 17, **when** I search,
  **then** I am offered both, named by fleet, rather than one being guessed.

### BV2 - And the number means one van

**As** a workshop owner **I want** a fleet unable to give two vans one number
**so that** the number stays something a van can be rung about.
**Size** 5 - **Satisfies** FR-10403, FR-10404

- **Given** a number already used, **when** I give it to another van, **then**
  it is refused.
- **Given** a van that leaves the fleet, **when** its number is cleared,
  **then** the number is free for the van that replaces it.
- **Given** a van sold to another company, **when** they bring it in, **then**
  the previous owner's number is not on it.

---

## Epic BU - One English sentence, one meaning (Phase 68)

### BU1 - The French page says what the English page says

**As** a French-reading service advisor **I want** a word on one page not to
have been borrowed from another **so that** a courtesy car is not described to
me as "unbalanced".
**Size** 8 - **Satisfies** FR-10301, FR-10303

- **Given** an English word two pages mean differently, **when** it is found,
  **then** the English is changed on one of them rather than a translation
  picked.
- **Given** a gift card balance, **when** I read it, **then** it says
  Remaining, which has one meaning.

### BU2 - And it cannot happen again quietly

**As** an engineer **I want** a new clash to fail the build **so that** the
next one is found on the day it is written rather than two phases later by
accident.
**Size** 5 - **Satisfies** FR-10302

- **Given** two areas defining one key differently, **when** the checks run,
  **then** one fails and names the key.
- **Given** the clashes that already exist, **when** the checks run, **then**
  they are counted and do not fail, because a baseline that stops the bleeding
  is worth more than a promise to fix them all at once.

---

## Epic BT - The courtesy car (Phase 67)

### BT1 - The car we promised is there

**As** a service advisor **I want** the same car never to be promised to two
people **so that** nobody is standing at my counter on Tuesday morning while
their car is in Leeds.
**Size** 13 - **Satisfies** FR-10202, FR-10203, FR-10204

- **Given** a car promised over some days, **when** I try to promise it again
  over days that touch those, **then** I am refused.
- **Given** two people booking at the same moment, **when** both pass the
  check, **then** the database refuses the second, because a check that reads
  before it writes cannot stop that on its own.
- **Given** a period, **when** I am choosing, **then** I can see which cars
  are free over it.
- **Given** a car brought back early, **when** somebody else wants it,
  **then** the days it would have been out are free.

### BT2 - And it is legal to lend

**As** the workshop owner **I want** to be stopped from lending a car whose
MOT runs out mid-loan **so that** the offence is not mine and the insurer has
nothing to say afterwards.
**Size** 5 - **Satisfies** FR-10205

- **Given** a car whose MOT expires during the period, **when** I try to lend
  it, **then** I am refused and told which certificate and when.
- **Given** the same car and a shorter loan that ends first, **when** I lend
  it, **then** it is allowed.
- **Given** a car whose papers nobody has uploaded, **when** I lend it,
  **then** nothing is claimed, because nothing is known.

### BT3 - We know where they are

**As** the workshop owner **I want** to see what is out and how late it is
**so that** a car nobody has asked after for a fortnight is not how I find out.
**Size** 8 - **Satisfies** FR-10201, FR-10206, FR-10207

- **Given** cars out with customers, **when** I look, **then** I see who has
  each one and how overdue it is, in words.
- **Given** one coming back, **when** I take it back, **then** when, who took
  it and the odometer are recorded.
- **Given** a car that is out, **when** I try to stop lending it, **then** I
  am refused until it is back.

---

## Epic BS - Chasing something later (Phase 66)

### BS1 - I can write down what we said we would do

**As** a service advisor **I want** to note that we should ring somebody in
three months **so that** the work they turned down is not simply lost.
**Size** 8 - **Satisfies** FR-10101, FR-10104

- **Given** a job, **when** I add a follow-up, **then** it carries what needs
  doing, when, and who it is for if anybody.
- **Given** a follow-up with no note, **when** I try to save it, **then** it
  is refused: a list of "follow up" entries is a list nobody reads.
- **Given** one that has been done, **when** I look at it, **then** it says
  who did it, which is the question asked when a customer says nobody rang.

### BS2 - And somebody actually sees it

**As** the workshop owner **I want** what is late to be in front of me
**so that** a follow-up nobody does stops being worse than no follow-up at all.
**Size** 8 - **Satisfies** FR-10102, FR-10103

- **Given** something three weeks late, **when** I open the dashboard,
  **then** it is there and it says how late.
- **Given** something due today and something due in two months, **when** I
  read the list, **then** only the first is on it.
- **Given** several, **when** I read them, **then** the worst is first.

### BS3 - Mine finds me

**As** a technician **I want** what was given to me to appear on my own screen
**so that** I am not relying on somebody remembering to tell me.
**Size** 5 - **Satisfies** FR-10105

- **Given** a follow-up given to me, **when** it is created, **then** I am
  told, and nobody else is.
- **Given** the shop floor screen, **when** something of mine is late or due
  today, **then** it is at the top of it.

---

## Epic BR - The scripts nobody type-checked (Phase 65)

### BR1 - The gate covers the code

**As** an engineer **I want** every file in the repository to be type-checked
**so that** a gate named after the thing it checks checks all of it.
**Size** 8 - **Satisfies** FR-10001, FR-10002

- **Given** a TypeScript file, **when** the checks run, **then** some tsconfig
  includes it.
- **Given** a file outside every tsconfig, **when** the checks run, **then**
  one fails and names it.

### BR2 - A read with no bounds says so

**As** an engineer **I want** an unbounded read to be spelled out **so that**
one that happened by omission can be told from one somebody meant.
**Size** 3 - **Satisfies** FR-10003

- **Given** a call that wants every row, **when** I read it, **then** it names
  the range it is asking for.
- **Given** a call that forgot the range, **when** it is compiled, **then** it
  fails rather than silently reading everything.

---

## Epic BQ - The list somebody typed (Phase 64)

### BQ1 - My records are mine

**As** a workshop owner **I want** the isolation between workshops to be a
mechanism rather than a habit **so that** nobody else's staff appear on my
reports and mine appear on nobody else's.
**Size** 13 - **Satisfies** FR-9901, FR-9902, FR-9905

- **Given** a record written by another workshop, **when** any list is drawn
  here, **then** it is not in it.
- **Given** the set of models the filter covers, **when** the schema changes,
  **then** the set changes with it rather than being remembered.
- **Given** the claim that the filter works, **when** it is checked, **then**
  it is checked by writing a row as one workshop and failing to read it as
  another.

### BQ2 - A new table cannot be forgotten

**As** an engineer **I want** a model added without a tenancy decision to fail
**so that** the mistake is caught on the day it is cheap.
**Size** 8 - **Satisfies** FR-9903, FR-9904

- **Given** a new model carrying an organisation, **when** the list is not
  regenerated, **then** the build fails and says so.
- **Given** a model with no organisation of its own, **when** it is read
  through the scoped client without naming its parent, **then** a check fails
  and names the file and line.

---

## Epic BP - Two workshops, one person (Phase 63)

### BP1 - I work at two garages

**As** a contractor servicing two garages on alternate days **I want** to say
which one I am in **so that** the customer I am typing goes into the right
workshop's records.
**Size** 13 - **Satisfies** FR-9801, FR-9802, FR-9804

- **Given** I am on two teams, **when** I sign in, **then** I am asked which
  workshop, and put in neither until I say.
- **Given** I am on one team, **when** I sign in, **then** I am not asked,
  because that is not a choice.
- **Given** I am a manager at one and a technician at the other, **when** I
  move between them, **then** what I may do changes with the workshop.
- **Given** I have chosen, **when** I load any page, **then** I stay where I
  am: a page load is not a decision.

### BP2 - And the two stay apart

**As** a workshop owner **I want** somebody else's second job to be invisible
here **so that** having a contractor in common with the garage down the road
costs me nothing.
**Size** 8 - **Satisfies** FR-9803, FR-9807

- **Given** a workshop I am not on the team of, **when** I try to enter it,
  **then** I am refused.
- **Given** an organisation that does not exist, **when** I try to enter it,
  **then** I am refused in the same words, so the refusal confirms nothing.
- **Given** somebody entering my workshop, **when** I read the audit log,
  **then** I can see who came in and when.

### BP3 - Letting somebody go ends here

**As** a workshop owner **I want** taking somebody off my team to affect my
workshop only **so that** I cannot reach into a business I have nothing to do
with.
**Size** 8 - **Satisfies** FR-9805, FR-9806

- **Given** I take somebody off my team, **when** they are signed in here,
  **then** that session ends at once.
- **Given** the same person is signed in at another workshop, **when** I take
  them off mine, **then** that session is untouched.
- **Given** a session naming a workshop I have been taken off, **when** I load
  a page, **then** I no longer act in it — at the next request, not the next
  sign-in.

### BP4 - The invitation is not a password

**As** anybody with a Carnet account **I want** an invitation to my address to
need my password **so that** a forwarded email is not a way into everything I
already have.
**Size** 5 - **Satisfies** FR-9809

- **Given** an invitation to an address that already has an account, **when**
  somebody opens the link without the password, **then** it is refused and no
  workshop is attached.
- **Given** the account's own password, **when** I accept, **then** the
  workshop is attached and I start in the one I have just joined.

---

## Epic BO - Being forgotten (Phase 62)

### BO1 - I can take my record with me

**As** Maria **I want** everything the workshop holds about me, in a form I can
keep **so that** asking to be forgotten is not the same as losing my own
history.
**Size** 8 - **Satisfies** FR-9701, FR-9702

- **Given** a customer, **when** the workshop takes an export, **then** it
  contains every kind of record the product holds about them.
- **Given** a kind of record the product holds none of for them, **when** I
  read the export, **then** that kind appears and is empty, so that having
  looked is distinguishable from not having looked.

### BO2 - I can be forgotten

**As** Maria **I want** my name, my address and my signature gone **so that**
selling the car ends my relationship with the workshop rather than filing it.
**Size** 13 - **Satisfies** FR-9703, FR-9707

- **Given** an erasure, **when** every text column of every table is searched
  for my name, my email address and where I live, **then** nothing comes back.
- **Given** an erasure, **when** somebody tries to sign in as me, **then**
  there is no account to sign in to: the login is removed, not emptied.
- **Given** a person already erased, **when** somebody asks again, **then** it
  is refused and says why.
- **Given** any erasure, **when** the audit log is read, **then** it says who
  asked, when, and the reason given.

### BO3 - And the workshop keeps its books

**As** the workshop owner **I want** my accounts and the cars' histories to
survive somebody being forgotten **so that** a request from one customer is not
a hole in seven years of records.
**Size** 8 - **Satisfies** FR-9704, FR-9705, FR-9706

- **Given** the books totalled before an erasure, **when** they are totalled
  after it, **then** the figures agree exactly.
- **Given** a vehicle whose owner has been forgotten, **when** its passport is
  verified, **then** the chain is valid and exactly as long as it was.
- **Given** the passport, **when** any event is read, **then** it names no
  person: it says the car changed hands and which keeper this is.
- **Given** the audit log, **when** anything but the copy of the values is
  changed, **then** the database refuses it.

---

## Epic BN - The rows that were never there (Phase 61)

### BN1 - A matrix that is true

**As** the operator **I want** every requirement to have a row that has been
read against the code **so that** the document can be relied on rather than
admired.
**Size** 13 - **Satisfies** FR-9601, FR-9602

- **Given** the requirements document, **when** the check runs, **then** every
  requirement has a row of its own.
- **Given** a row naming a test, **when** that file does not exist, **then**
  the check fails and names it.
- **Given** a row naming a function, **when** nothing in the source has that
  name, **then** the check fails and names it.

### BN2 - What is admitted rather than claimed

**As** the operator **I want** a requirement nothing implements to say so **so
that** the gap is a decision rather than a discovery during the pilot.
**Size** 5 - **Satisfies** FR-9603, FR-9604

- **Given** a requirement nothing implements, **when** I read its row, **then**
  it says Missing and claims no test.
- **Given** any row that is not Done, **when** I read it, **then** it says
  which kind of not-done, and why.

### BN3 - A summary that cannot drift

**As** an engineer **I want** the coverage figures counted from the table **so
that** a percentage is never arithmetic about a table that no longer exists.
**Size** 3 - **Satisfies** FR-9605

- **Given** the table, **when** rows are added or removed, **then** the summary
  is recounted and the check compares it.

---

## Epic BM - What the screen does while somebody waits (Phase 60)

### BM1 - I can see what I came for

**As** Maria **I want** the quote I was sent to appear quickly on my telephone
**so that** approving it is not a thing I put off.
**Size** 8 - **Satisfies** FR-9501, FR-9502, FR-9503

- **Given** a screen somebody waits on, **when** it is measured, **then** it is
  measured in a browser over a connection whose speed is written down.
- **Given** three runs, **when** the verdict is taken, **then** it is the
  middle one, not the best.
- **Given** a budget, **when** I ask where it came from, **then** it names the
  requirement rather than a number somebody liked.

### BM2 - The page does not jump

**As** Sara **I want** the screen to hold still once it has drawn **so that**
I do not press the wrong thing with a customer waiting.
**Size** 5 - **Satisfies** FR-9505

- **Given** any screen, **when** it has loaded, **then** what moves afterwards
  is under the budget.
- **Given** a reading of zero, **when** I ask whether anything was watching,
  **then** a control has proved the measurement can see a shift.

### BM3 - Not measured is not passed

**As** an engineer **I want** an unmeasurable screen to fail **so that**
silence is never mistaken for success.
**Size** 3 - **Satisfies** FR-9504, FR-9506

- **Given** a page that fell over, **when** it is loaded, **then** it is
  reported as broken rather than timed.
- **Given** a screen that reported no paint, **when** the run ends, **then** it
  fails rather than passing quietly.

---

## Epic BL - One press, followed through (Phase 59)

### BL1 - I pressed it and nothing happened

**As** Sara **I want** somebody to be able to find out what became of a press
**so that** "it did not work" can be answered rather than argued about.
**Size** 13 - **Satisfies** FR-9401, FR-9402, FR-9405

- **Given** a press, **when** anything is recorded because of it, **then** every
  record carries the same identifier.
- **Given** that identifier, **when** the operator searches it, **then** every
  record it touched is listed in the order it happened.
- **Given** a chain that stops halfway, **when** I read it, **then** where it
  stops is what went wrong.

### BL2 - The part that happens later

**As** the operator **I want** the work a press queues to carry the press
**so that** a message sent an hour later can still be traced to the button.
**Size** 8 - **Satisfies** FR-9403

- **Given** an outbox event, **when** a worker handles it, **then** anything it
  writes or logs carries the trace the event came in with.
- **Given** two jobs running at once, **when** both write, **then** neither can
  read the other's trace.

### BL3 - Nothing invented

**As** the operator **I want** work nobody asked for to have no trace **so
that** "nobody pressed anything" stays different from "we lost it".
**Size** 3 - **Satisfies** FR-9404

- **Given** a reminder queued by a schedule, **when** it is written, **then** it
  carries no trace.
- **Given** the column, **when** I look at the schema, **then** it is nullable,
  and says why.

### BL4 - A rule no hand could keep

**As** an engineer **I want** the stamping enforced **so that** the one somebody
forgets is found the day it happens rather than a year later.
**Size** 5 - **Satisfies** FR-9406, FR-9407

- **Given** a write that a request causes, **when** it does not stamp the trace,
  **then** a check fails and names the file and the line.
- **Given** a trace offered by a caller, **when** it is the right shape, **then**
  it is kept; **when** it is not, **then** it is replaced.

---

## Epic BK - Configured to do anything (Phase 58)

### BK1 - The setting that looks fine and does nothing

**As** the operator **I want** to be told when a deployment is configured to do
nothing **so that** a workshop does not spend a fortnight wondering why no
customer ever replies.
**Size** 8 - **Satisfies** FR-9301, FR-9303, FR-9304

- **Given** a mail transport left on console, **when** the check runs, **then**
  it is reported as pretending rather than as set.
- **Given** several things wrong at once, **when** they are listed, **then**
  the ones nobody would notice come before the ones that stop the product.
- **Given** any setting, **when** I read its line, **then** it says what a
  workshop would feel and what to set it to.

### BK2 - A register that cannot fall behind

**As** an engineer **I want** the register checked against the application
**so that** a setting added next month is not missing from it for a year.
**Size** 5 - **Satisfies** FR-9302

- **Given** a setting the application reads anywhere — the schema or a bare
  `process.env` — **when** it has no entry in the register, **then** the check
  fails and names it.
- **Given** an entry in the register, **when** the application does not read
  it, **then** the check fails and names that too.

### BK3 - One command before the first morning

**As** the operator **I want** one command that says whether a workshop can be
put on this **so that** handing it over is a decision rather than a hope.
**Size** 5 - **Satisfies** FR-9305, FR-9306

- **Given** a real deployment, **when** I run the handover check, **then** it
  fails while anything needed is missing or pretending.
- **Given** my laptop, **when** I run the ordinary check, **then** it passes,
  because a console transport there is correct rather than wrong.
- **Given** either, **when** it reports, **then** it prints no value of any
  setting.

---

## Epic BJ - Before the workshop rings (Phase 57)

### BJ1 - Told, rather than finding out

**As** the operator **I want** to be told when Carnet goes wrong **so that** I
am not finding out from a workshop whose morning has already gone.
**Size** 8 - **Satisfies** FR-9201, FR-9205

- **Given** something goes wrong overnight, **when** the hourly job runs,
  **then** a message reaches me.
- **Given** that message, **when** it could not be sent, **then** nothing is
  written down as sent, and it goes on trying.
- **Given** I am not set as the operator on a deployment, **when** something
  goes wrong there, **then** nothing is sent and nothing is claimed to be.

### BJ2 - Something I can act on at four in the morning

**As** the operator **I want** the message to tell me what to do **so that** I
do not have to open a laptop to find out whether it matters.
**Size** 8 - **Satisfies** FR-9202, FR-9203, FR-9207

- **Given** an alert, **when** I read it on a telephone, **then** it says what
  it means, the first thing to do, and what fixed looks like.
- **Given** a signal nobody has written an action for, **when** it goes wrong,
  **then** no message is sent and the gap is named instead.
- **Given** the health page, **when** I open it, **then** each thing that is
  wrong carries the same first action and says whether I have been told.

### BJ3 - Once, not six times

**As** the operator **I want** one message per problem **so that** I keep
reading them.
**Size** 5 - **Satisfies** FR-9204

- **Given** the same fault an hour later, **when** nothing has changed,
  **then** nothing is sent.
- **Given** the same fault getting worse, **when** it does, **then** I am told
  straight away.
- **Given** the fault going away, **when** it does, **then** I am told once —
  and never about the end of something I was never told about.

### BJ4 - In my own language

**As** an operator who reads French **I want** the instructions in French **so
that** the one page written for me is not the one page in English.
**Size** 3 - **Satisfies** FR-9206

- **Given** every runbook action, **when** the check runs, **then** each is
  answered in French and in Arabic.
- **Given** an action added next month, **when** nobody translates it, **then**
  the check fails, even though it reaches the translator as a variable that no
  scanner can see.

---

## Epic BI - The other half of the requirements (Phase 56)

### BI1 - A number with nothing behind it

**As** the operator **I want** every quality budget to name what enforces it
**so that** "fast enough" and "safe enough" are claims somebody can check
rather than paragraphs somebody wrote.
**Size** 13 - **Satisfies** FR-9101, FR-9102

- **Given** the eighty-four quality requirements, **when** the check runs,
  **then** each is either checked by something that runs, true of the
  repository and asserted, or honestly marked as enforced by nothing.
- **Given** one that names a script, **when** that script is missing or
  nothing runs it, **then** the check fails rather than reading as covered.
- **Given** one that nothing enforces, **when** I read it, **then** what it
  would take is written down.

### BI2 - Nothing secret in a log

**As** Ahmed **I want** my staff's passwords and my customers' card details to
stay out of the log files **so that** a log search is not a way into the
business.
**Size** 5 - **Satisfies** FR-9103

- **Given** anything handed to the logger, **when** a field is named like a
  credential, **then** the value is taken out and the key is left.
- **Given** a secret nested inside something else, **when** it is written,
  **then** it is taken out too.
- **Given** a record with every relation attached, **when** somebody logs it by
  accident, **then** the line stops rather than printing the database.

### BI3 - The telephone in the customer's hand

**As** Maria **I want** the quote I was sent to work on my iPhone **so that**
approving it does not need a computer.
**Size** 8 - **Satisfies** FR-9104, FR-9105

- **Given** the screens a workshop lives in and the links a customer is sent,
  **when** they are checked, **then** they are checked in Safari and Firefox as
  well as Chrome.
- **Given** the Arabic layout, **when** it is checked, **then** it is checked in
  all three, because that is where engines disagree most.
- **Given** a page whose stylesheet did not arrive, **when** it is measured,
  **then** nothing is measured and the check says why.

---

## Epic BH - The four things that are not features (Phase 55)

### BH1 - A check nobody runs

**As** the operator **I want** every check the product has to be run by
something other than me remembering **so that** a green repository means what
it says.
**Size** 8 - **Satisfies** FR-9001, FR-9002

- **Given** a verification script with a name, **when** nothing in the workflow
  runs it, **then** a check fails and says which.
- **Given** the gates the roadmap names, **when** any is missing from the
  workflow, **then** the same check fails and names it.
- **Given** a script added next month, **when** nobody wires it up, **then**
  the failure arrives that day rather than nine phases later.

### BH2 - Every screen, not most of them

**As** Sara **I want** every screen measured on the phone I actually hold **so
that** the one I need at the counter is not the one nobody looked at.
**Size** 13 - **Satisfies** FR-9003, FR-9004, FR-9005

- **Given** the product's own directory of pages, **when** the screens are
  measured, **then** the list comes from there rather than from a file somebody
  types into.
- **Given** a page nobody has decided about, **when** the check runs, **then**
  it fails naming the address.
- **Given** a page that fell over, **when** it answers 200 with an error on it,
  **then** nothing is measured and the check says so.

### BH3 - A figure that does not get slower every month

**As** Ahmed **I want** the pages that add my money up to stay quick as the
years go by **so that** the third year is not the year the software gives up.
**Size** 8 - **Satisfies** FR-9006, FR-9007

- **Given** the trial balance, **when** I open it, **then** the adding up
  happened in the database and forty rows came back rather than every posting.
- **Given** a list with no bound, **when** nobody has written what holds it,
  **then** a check fails rather than nobody noticing.
- **Given** a bound that is a judgement, **when** I read the code, **then** the
  judgement is written where it applies, in words I can disagree with.

### BH4 - Waiting, with something to look at

**As** Maria **I want** something on the screen while my records load **so
that** a slow moment outside a garage does not look like a broken link.
**Size** 5 - **Satisfies** FR-9008

- **Given** any page of my own, **when** it is still fetching, **then** I see
  the car being worked on rather than nothing at all.
- **Given** a link sent to me in a message, **when** I open it on mobile data,
  **then** the same.
- **Given** a page that needs no loading state, **when** it has none, **then**
  the reason is written down rather than assumed.

### BH5 - The customer who brings other people in

**As** Ahmed **I want** a customer who has referred a friend to still have a
referral card **so that** the customer I most want to look after is not the one
the software breaks on.
**Size** 5 - **Satisfies** FR-9009

- **Given** a customer who has introduced somebody, **when** I open their card,
  **then** it opens.
- **Given** that customer, **when** they want to introduce somebody else,
  **then** they have a fresh code to hand out.
- **Given** two pages asking for their code at the same moment, **when** both
  ask, **then** there is still only one code waiting to be used.

---

## Epic BG - What you are using (Phase 54)

### BG1 - What nobody used

**As** Ahmed **I want** to see which parts of the product my workshop has
actually put to work **so that** I know what I am paying for and have not
touched.
**Size** 8 - **Satisfies** FR-8901, FR-8902, FR-8903

- **Given** four weeks of ordinary work, **when** I open what I am using,
  **then** each capability is named the way I would say it out loud.
- **Given** that page, **when** I read a figure, **then** it came from the
  record the product already keeps rather than from anything added to watch me.
- **Given** a capability nobody here has touched, **when** it is the sort of
  thing most workshops use, **then** it is called out rather than listed
  quietly among the rest.

### BG2 - One pair of hands

**As** Ahmed **I want** to know where only one person has used something **so
that** I find out now rather than the week they are off.
**Size** 5 - **Satisfies** FR-8904

- **Given** a capability one person has used, **when** I look at the top of
  the page, **then** it is worth a conversation rather than marked as in use.
- **Given** a capability two people have used twice, **when** I look, **then**
  it is in use.
- **Given** something my workshop has no need for, **when** nobody uses it,
  **then** it says so plainly rather than reading as a failure.

### BG3 - The figure is honest about itself

**As** Sara **I want** to know what the count does not see **so that** I do
not switch something off that we use every day.
**Size** 3 - **Satisfies** FR-8906

- **Given** the page, **when** I read it, **then** it says it counts what
  people did rather than what they looked at.
- **Given** a car's history we open constantly and never add to, **when** I
  read the figure, **then** I can tell why it reads as untouched.
- **Given** any page in the product, **when** I look at what is recorded,
  **then** nothing anywhere records who looked at what.

### BG4 - Ready to hand over

**As** the operator **I want** every one of the pilot's four findings to have
a source before the first morning **so that** the debrief is evidence rather
than recollection.
**Size** 5 - **Satisfies** FR-8905, FR-8907

- **Given** the four lists the pilot must produce, **when** the check runs,
  **then** each names where it comes from and the check fails if any does not.
- **Given** an action the product records, **when** it belongs to no named
  capability, **then** the check fails rather than counting it towards nothing.
- **Given** a workshop's first morning, **when** it begins, **then** the
  messages it will send are already written and the clock baseline is recorded.

---

## Epic BF - The awkward cases (Phase 53)

### BF1 - The Tuesday the flowchart did not expect

**As** Sara **I want** the product to have an answer for the awkward things
**so that** I am not stuck at the counter with a customer's keys in my hand.
**Size** 13 - **Satisfies** FR-8801, FR-8803, FR-8805, FR-8806

- **Given** a job cancelled after the parts came, **when** I cancel it,
  **then** what was reserved goes back on the shelf and what was fitted stays
  fitted.
- **Given** a car with no VIN, **when** I book it in, **then** it is booked in.
- **Given** a part in my hand and a shelf that says nought, **when** I fit it,
  **then** the work is not blocked and the count shows as wrong.

### BF2 - They paid too much

**As** Sara **I want** one press for a customer who hands over more than the
bill **so that** I am not doing arithmetic on another page while they wait.
**Size** 8 - **Satisfies** FR-8802

- **Given** a payment larger than the bill, **when** I record it, **then** I am
  asked rather than guessed at.
- **Given** that refusal, **when** I read it, **then** the thing it tells me to
  do is a button underneath it.
- **Given** that button, **when** I press it, **then** the bill is settled
  exactly and the rest is on their account to the penny.

### BF3 - Sold off the ramp

**As** Ahmed **I want** a car that changes hands mid-job to leave the bill
where it belongs **so that** I am not chasing a stranger for somebody else's
work.
**Size** 8 - **Satisfies** FR-8807, FR-8808, FR-8809

- **Given** a car with work on it, **when** somebody transfers it, **then**
  they are asked first and told what happens to the work.
- **Given** the transfer goes ahead, **when** I look at the job, **then** it is
  still the customer who agreed to it.
- **Given** a refund against a month already reported on, **when** it is
  posted, **then** it lands in the open period, dated today.

## Epic BE - The workshop's own clock (Phase 52)

### BE1 - Where the morning goes

**As** Ahmed **I want** to know how long each part of the work takes **so
that** I can fix the slow one instead of guessing which it is.
**Size** 13 - **Satisfies** FR-8701, FR-8702, FR-8703

- **Given** the last year, **when** I open the page, **then** I see each
  stretch with what it usually takes and what the slowest tenth takes.
- **Given** one car left over a bank holiday, **when** the figures are shown,
  **then** it has not moved them.
- **Given** any figure, **when** I ask where it came from, **then** it is two
  moments already on the record.

### BE2 - A number I can trust or ignore

**As** Fatima **I want** the page to say when it does not know **so that** I do
not act on four jobs' worth of coincidence.
**Size** 8 - **Satisfies** FR-8704, FR-8705, FR-8706

- **Given** a stretch measured on four jobs, **when** it is shown, **then** it
  says too few rather than giving a number.
- **Given** a car that was never collected, **when** collection is measured,
  **then** it is left out rather than counted as no time at all.
- **Given** a target, **when** I disagree with it, **then** the page says what
  it is based on.

### BE3 - Before and after

**As** the operator **I want** the figures written down before a pilot **so
that** afterwards there is something to compare against.
**Size** 5 - **Satisfies** FR-8707

- **Given** a measurement, **when** I record it, **then** it is kept with the
  date and the window it covered.
- **Given** a later measurement, **when** I compare, **then** each stretch says
  what moved, or says it cannot be compared.

## Epic BD - Quick at the size of a real workshop (Phase 51)

### BD1 - Three years in

**As** Ahmed **I want** the product to be as quick in year three as in week one
**so that** growing my business does not make my software worse.
**Size** 13 - **Satisfies** FR-8601, FR-8602, FR-8604

- **Given** a hundred thousand customers, **when** I open any screen, **then**
  it comes back inside its budget.
- **Given** a screen that renders eight rows, **when** it loads, **then** it
  did not fetch a hundred and thirty thousand.
- **Given** a total over every bill, **when** it is shown, **then** it was
  summed in the database.

### BD2 - The screen I open fifty times a day

**As** Sara **I want** the job page to be immediate **so that** the fiftieth
one of the morning is as quick as the first.
**Size** 8 - **Satisfies** FR-8603

- **Given** a job, **when** I open it, **then** the page does no filing,
  sweeping or catching up on my time.
- **Given** messages that arrived unfiled, **when** an hour passes, **then**
  they are filed without anybody opening anything.

### BD3 - A number I can argue with

**As** a developer **I want** each screen to have a budget with a reason **so
that** a slow screen is a defect rather than an opinion.
**Size** 8 - **Satisfies** FR-8605, FR-8606, FR-8607

- **Given** a screen, **when** it is measured, **then** the budget names the
  requirement or says it is a judgement.
- **Given** a page that threw, **when** it is measured, **then** it is reported
  as broken rather than as slow.
- **Given** a screen at eighty per cent of its budget, **when** the run ends,
  **then** it is named.

## Epic BC - How Carnet itself is (Phase 50)

### BC1 - Where is my invoice?

**As** Sara **I want** to know why a customer did not get their message **so
that** I can tell them something other than "it says it was sent".
**Size** 13 - **Satisfies** FR-8504, FR-8505, FR-8507

- **Given** an address, **when** I look it up, **then** every message to it is
  listed with a sentence saying what happened and what to do next.
- **Given** a bounced address, **when** I look, **then** the block is the
  reason given, not the message's status.
- **Given** somebody who asked not to be written to, **when** I look, **then**
  it is not reported as a failure.
- **Given** a message held until the morning, **when** I look, **then** it
  reads as held rather than as stuck.

### BC2 - Is it me or is it them?

**As** the operator **I want** one page showing how Carnet itself is **so
that** an incident starts with a look rather than with a log.
**Size** 8 - **Satisfies** FR-8501, FR-8502, FR-8503

- **Given** the system, **when** I open the page, **then** I see the machine,
  the background work, the outside services, the records, access and recovery.
- **Given** something configured but never used, **when** I look, **then** it
  says so rather than showing a green tick.
- **Given** one thing failing among many working, **when** I look at the top,
  **then** the whole reads as failing.

### BC3 - Not for a workshop

**As** Ahmed **I want** never to see another workshop's figures **so that**
the promise the rest of the product makes is not undone by one page.
**Size** 5 - **Satisfies** FR-8506

- **Given** I own my workshop, **when** I open the operator's page, **then**
  there is nothing at that address.
- **Given** no operator is configured, **when** anybody opens it, **then**
  nobody can.

## Epic BB - Carnet came back (Phase 49)

### BB1 - The morning the database went

**As** Ahmed **I want** to know what a disaster would actually cost me **so
that** "we have backups" is a number rather than a reassurance.
**Size** 13 - **Satisfies** FR-8401, FR-8402, FR-8403

- **Given** a backup, **when** it is restored into a fresh database, **then**
  every table comes back with every row that was in it at the time.
- **Given** the restore, **when** it finishes, **then** how much work was lost
  and how long it took are both measured and compared with what was promised.
- **Given** the copy, **when** it is opened, **then** it needs no migration and
  its passports, triggers and books are all intact.

### BB2 - The photograph that is not there

**As** Maria **I want** the pictures in my report to still be there **so that**
a record with holes in it is not what I am handed.
**Size** 8 - **Satisfies** FR-8404, FR-8405

- **Given** a row pointing at a file, **when** the drill runs, **then** the
  file is confirmed to exist.
- **Given** a file that did not come back, **when** the drill runs, **then** it
  is named — proved by taking one away on purpose.
- **Given** a file nothing points at, **when** the drill runs, **then** it is
  recorded, and an operator can remove it deliberately.

### BB3 - The message that was in the queue

**As** Fatima **I want** work that was in flight to survive **so that** a
customer who was promised a receipt still gets one.
**Size** 5 - **Satisfies** FR-8406, FR-8407

- **Given** messages waiting to be sent, **when** the system comes back,
  **then** they are all still waiting.
- **Given** the drill's report, **when** I read it, **then** it says what it
  did not measure as plainly as what it did.

## Epic BA - One workshop cannot reach another (Phase 48)

### BA1 - The garage down the road

**As** Ahmed **I want** to know no other workshop can see my customers **so
that** putting my business on somebody else's software is not the end of it.
**Size** 13 - **Satisfies** FR-8301, FR-8302, FR-8304, FR-8305

- **Given** another workshop's identifier, **when** anybody asks for it at any
  address, **then** they are told there is no such record.
- **Given** a write path called by hand with my identifier, **when** somebody
  else calls it, **then** nothing of mine changes.
- **Given** a new page with an identifier in it, **when** nobody has said what
  it is, **then** the check fails before it ships.

### BA2 - Somebody else's car

**As** Maria **I want** my car's record to be mine **so that** another
customer cannot read it by changing the address in their browser.
**Size** 5 - **Satisfies** FR-8303, FR-8307

- **Given** a vehicle that is not mine, **when** I open it in the portal,
  **then** it is not there.
- **Given** a passport link I chose to share, **when** a buyer opens it,
  **then** they see the car and nothing about me.

### BA3 - A link that was never sent

**As** Fatima **I want** a made-up link to give nothing away **so that**
guessing is not a way in.
**Size** 8 - **Satisfies** FR-8306, FR-8308

- **Given** a token nobody issued, **when** it is opened, **then** nothing is
  shown and no session is granted.
- **Given** a page that cannot check its token until the form is sent, **when**
  a real link and an invented one are compared, **then** they are identical.

## Epic AZ - The books agree with themselves (Phase 47)

### AZ1 - The figure I am about to sign

**As** Fatima **I want** to know the books still agree with themselves **so
that** I am not the one who finds out in front of an accountant.
**Size** 13 - **Satisfies** FR-8201, FR-8202, FR-8203, FR-8205

- **Given** the whole workshop, **when** I open the page, **then** every figure
  has been recomputed from the rows underneath it rather than read back.
- **Given** a total that has drifted from its lines, **when** I look, **then**
  it is named with both figures and the difference, to the penny.
- **Given** two entries wrong in opposite directions, **when** the trial
  balance still comes to nought, **then** both are still found.

### AZ2 - A quarter I have already reported on

**As** Ahmed **I want** a closed period to stay closed **so that** a figure I
gave somebody in April is still that figure in June.
**Size** 5 - **Satisfies** FR-8206

- **Given** a period that has been closed, **when** anything was posted into it
  afterwards, **then** it is listed with both dates.
- **Given** rows written before the guard existed, **when** the check runs,
  **then** they are found too, because it looks rather than trusts.

### AZ3 - A part that is not on the shelf

**As** Ahmed **I want** a shelf to agree with its own history **so that** I do
not promise a customer a part I do not have.
**Size** 5 - **Satisfies** FR-8204

- **Given** a shelf, **when** its figure differs from the balance its last
  movement recorded, **then** the part is named with the difference in units.
- **Given** stock moved by anything at all, **when** it moves, **then** a
  movement explains it.

## Epic AY - What the customer could not see (Phase 46.7)

### AY1 - The deposit I already paid

**As** Maria **I want** to see money the garage is holding for me **so that** a
bill saying "still to pay" is not the only thing I have to go on.
**Size** 5 - **Satisfies** FR-8103

- **Given** I paid a deposit, **when** I open my invoices, **then** I can see
  what they are holding and that it comes off my next bill.
- **Given** a credit note was raised, **when** I look at that bill, **then** I
  can see what was taken off and why.

### AY2 - The mileage typed wrong

**As** Ahmed **I want** to correct an entry **so that** a mistake is a
correction rather than a permanent lie on somebody's car.
**Size** 8 - **Satisfies** FR-8101, FR-8104

- **Given** an entry my workshop recorded, **when** I correct it, **then** both
  entries stay on the record and the old one reads as corrected.
- **Given** another workshop's entry, **when** I try, **then** I am told to add
  my own rather than rewrite theirs.
- **Given** a correction, **when** the chain is verified, **then** it still
  verifies.

## Epic AX - Wired at both ends (Phase 46.6)

### AX1 - Telling somebody their car is ready

**As** Maria **I want** to hear when my car needs a decision or is ready
**so that** I am not ringing the garage to find out.
**Size** 5 - **Satisfies** FR-8002, FR-8003

- **Given** my car is waiting on my say-so, **when** the workshop moves it to
  awaiting approval, **then** I am told, once.
- **Given** it moves between states I do not care about, **when** that happens,
  **then** I hear nothing.

### AX2 - A rule that actually runs

**As** Ahmed **I want** the rules I write to run **so that** chasing an overdue
bill is something the product does rather than something I remember.
**Size** 8 - **Satisfies** FR-8004, FR-8005, FR-8006

- **Given** a rule on a bill a fortnight overdue, **when** a bill reaches that,
  **then** the rule runs and its action is carried out.
- **Given** a rule whose condition is not met, **when** it is evaluated,
  **then** the page shows it was blocked and why.
- **Given** a rule asking for something the product cannot do, **when** it runs,
  **then** it fails with a sentence rather than reporting success.

### AX3 - A fleet I can invoice

**As** Ahmed **I want** to record the purchase order a fleet gives me **so
that** their accounts department can match my bill to something.
**Size** 3 - **Satisfies** FR-8001

- **Given** a fleet that requires a purchase order, **when** I put the number
  on the job, **then** the month's invoice goes out.

### AX4 - Knowing it worked

**As** Priya **I want** the screen to say what happened **so that** I am not
pressing a button twice to find out.
**Size** 3 - **Satisfies** FR-8007, FR-8008

- **Given** I cash up, **when** I enter what I counted, **then** I am told
  whether the drawer is over or short.
- **Given** I am handed a vehicle and have no account, **when** I make one,
  **then** it is a customer account and I land back on the handover.

## Epic AW — Built, and reachable (Phase 46.5)

### AW1 — The number I wrote down wrong

**As** Priya **I want** to correct a customer **so that** one person is one
record with one history, rather than two halves of one.
**Size** 5 · **Satisfies** FR-7901, FR-7902

- **Given** a customer whose mobile is wrong, **when** I correct it, **then**
  it is the same record and everything they have ever had done is still on it.
- **Given** that form, **when** I look for a marketing tick box, **then** there
  is none, and it says where consent is changed and why not here.

### AW2 — The parts that are in the van

**As** Ahmed **I want** to move stock between my sites **so that** a part one
branch is short of and another is sitting on actually gets there.
**Size** 8 · **Satisfies** FR-7903, FR-7904

- **Given** a suggestion, **when** I press start, **then** a draft exists and
  nothing has left a shelf.
- **Given** a transfer that arrived three of four, **when** I book in what came,
  **then** it stays open and the fourth is still counted as in the van.

### AW3 — What we stand behind

**As** Ahmed **I want** to record a warranty **so that** when somebody comes
back I know whether it is mine to fix and whether anybody is behind me.
**Size** 5 · **Satisfies** FR-7905, FR-7906

- **Given** a finished job, **when** I record two years and thirty thousand,
  **then** it counts from that day and that reading.
- **Given** a vehicle with no reading, **when** I ask for a mileage allowance,
  **then** I am told what to do instead rather than shown an error.

### AW4 — The person in the driveway

**As** a buyer **I want** to check a car from the printed report **so that** I
can tell whether the history is real before I hand over money.
**Size** 2 · **Satisfies** FR-7907

- **Given** the public site, **when** I look for where to check a vehicle,
  **then** it is in the navigation and the footer.

## Epic AV — Doing it twice (Phase 46)

### AV1 — The button that did not seem to do anything

**As** Priya **I want** pressing twice not to charge twice **so that** a slow
connection is not something a customer pays for.
**Size** 8 · **Satisfies** FR-7801, FR-7802, FR-7803

- **Given** a payment form, **when** I press the button twice, **then** one
  payment is recorded and the second press is quietly absorbed.
- **Given** the form, **when** it is in flight, **then** the button says it is
  working and cannot be pressed again.
- **Given** the same bill tomorrow, **when** I take another payment, **then**
  it goes through, because that is a different decision.

### AV2 — The points that never arrived

**As** Ahmed **I want** what a bill earns to arrive even if something failed at
that moment **so that** a customer is not quietly short-changed by an outage
nobody saw.
**Size** 5 · **Satisfies** FR-7806

- **Given** a bill paid while the loyalty write fails, **when** the payment
  finishes, **then** the payment still stands and nothing is shown as an error.
- **Given** the next hour, **when** the sweep runs, **then** the points are
  there, once.

### AV3 — Two workers, one queue

**As** Ahmed **I want** a deploy not to send my customers two of everything
**so that** overlapping workers are an implementation detail rather than an
apology.
**Size** 5 · **Satisfies** FR-7804, FR-7805

- **Given** two workers reaching for one queued message, **when** both claim,
  **then** exactly one gets it.
- **Given** a worker that died holding a claim, **when** the lease runs out,
  **then** another worker picks the work up.

### AV4 — Saying so, and proving it

**As** a developer **I want** every write that moves money to say what a repeat
does to it **so that** the next person to add one cannot quietly leave the
question unanswered.
**Size** 5 · **Satisfies** FR-7807, FR-7808

- **Given** a new write in a money file, **when** it has no declaration,
  **then** the build fails and names it.
- **Given** a declaration claiming a guard, **when** it cannot name the guard,
  **then** the build refuses it as a hope rather than a guard.

## Epic AU — Coupons (Phase 45.5)

### AU1 — The code on the postcard

**As** Ahmed **I want** to write a code down with everything it promises **so
that** nobody at the counter has to remember what the spring offer was.
**Size** 5 · **Satisfies** FR-7701, FR-7702

- **Given** a code worth a fifth off bills over £150 until the end of June,
  **when** I save it, **then** it says so in one line on the list.
- **Given** the offer is over, **when** I withdraw the code, **then** it is
  refused at the counter and still shows what it gave away.

### AU2 — The one standing in front of me

**As** Priya **I want** to be told why a code will not work **so that** I can
decide what to do about it while the customer is still here.
**Size** 3 · **Satisfies** FR-7705, FR-7706

- **Given** a code that ran out last week, **when** I try it, **then** I am
  told the date it ran out rather than that it is invalid.
- **Given** a code worth more than is left on the bill, **when** I take it,
  **then** it takes what is owed and no more.

### AU3 — What the offer actually cost

**As** Ahmed **I want** the discount in the books as what it was **so that** my
accounts do not say I took money I never saw.
**Size** 5 · **Satisfies** FR-7703, FR-7704, FR-7707, FR-7708

- **Given** a code taken on an invoice, **when** I read the invoice, **then**
  it still shows the total it was issued at, and the bank shows nothing.
- **Given** a month of codes, **when** I read the page, **then** each one says
  what it gave away beside what was billed on the visits it was used on.

## Epic AT — The first day (Phase 45)

### AT1 — The Tuesday somebody signs up

**As** Ahmed **I want** to be told what to do next **so that** I am not
guessing which of forty screens matters before I can invoice anybody.
**Size** 5 · **Satisfies** FR-7601, FR-7602

- **Given** a new workshop, **when** I open the dashboard, **then** the next
  thing to set up is named, with the reason it matters.
- **Given** I add an hourly rate, **when** I look at the list, **then** it is
  ticked without my having pressed anything.

### AT2 — Seeing what it looks like full

**As** Ahmed **I want** a workshop with a year of work in it **so that** I can
see what the screens do before my own has anything in them.
**Size** 5 · **Satisfies** FR-7604, FR-7605, FR-7606

- **Given** the demonstration, **when** I move into it, **then** every screen
  says it is a demonstration and the way back is one press away.
- **Given** I have finished with it, **when** I remove it, **then** the
  workshop, its vehicles and its work are gone.

### AT3 — Finding out how something works

**As** Priya **I want** an answer inside the product **so that** I do not have
to ring somebody to find out what a credit note does.
**Size** 3 · **Satisfies** FR-7603

- **Given** a question, **when** I type it into the search box, **then** the
  help page about it appears under the records.
- **Given** a help page, **when** I read it, **then** it is two paragraphs and
  a link to the screen it is about.

## Epic AS — Ownership, warranty and sites (Phase 44)

### AS1 — The car I just sold

**As** Maria **I want** to hand the history to whoever bought my car **so
that** what I paid to have recorded is worth something to them and is no
longer on my account.
**Size** 5 · **Satisfies** FR-7501, FR-7503

- **Given** I have invited the buyer, **when** I look at the vehicle, **then**
  it is still mine and the invitation is waiting.
- **Given** the buyer accepts, **when** I open the portal, **then** the car is
  gone from it and its history went with the car.

### AS2 — The car I just bought

**As** a buyer **I want** to see what I am being given before I accept it
**so that** I know what the history holds, without being handed somebody's
personal details.
**Size** 3 · **Satisfies** FR-7502, FR-7504, FR-7505

- **Given** a handover link, **when** I open it, **then** I see the car, the
  number of owners and the size of its history, and no name.
- **Given** I am the seller, **when** I open the link, **then** I am told the
  buyer accepts it themselves.

### AS3 — What our own warranty costs

**As** Ahmed **I want** the real cost of warranty work **so that** I can tell
which parts and which suppliers are expensive rather than guessing.
**Size** 5 · **Satisfies** FR-7506, FR-7507

- **Given** a claim with the job that fixed it attached, **when** I settle it,
  **then** its cost comes from that job's parts and hours, not from what they
  would have been charged.
- **Given** a period, **when** I read the warranty page, **then** it says what
  was spent, what came back, what we carried and what that is of turnover.

### AS4 — Two branches, two price lists

**As** Ahmed **I want** each site to charge its own rate **so that** the city
branch is not quoting the industrial estate's prices.
**Size** 3 · **Satisfies** FR-7508

- **Given** a rate against a site, **when** a line is added at that site,
  **then** it takes that rate and the page says whose it is.
- **Given** no rate for a site, **when** a line is added, **then** it takes the
  workshop's.

## Epic AR — Providers (Phase 43)

### AR1 — The car in front of me

**As** Ahmed **I want** the VIN read for me **so that** I am not typing a make
and a year off a windscreen and getting one of them wrong.
**Size** 3 · **Satisfies** FR-7401, FR-7402

- **Given** a VIN nobody has recorded, **when** I read it, **then** the form is
  filled with what the VIN says and tells me who read it.
- **Given** a VIN that does not encode a year, **when** I read it, **then** the
  year is left blank rather than guessed.

### AR2 — What the part fits, without typing it

**As** Priya **I want** the catalogue's fitments fetched **so that** the
warning on a job has something to work with.
**Size** 5 · **Satisfies** FR-7403, FR-7404

- **Given** a part with a row I typed, **when** I fetch from the feed, **then**
  my row is left as it is and the page says so.
- **Given** a claim the feed no longer sends, **when** I fetch again, **then**
  it is taken back.

### AR3 — The pay period as it really was

**As** Ahmed **I want** a bonus and a deduction on a timesheet and a file
payroll can import **so that** what leaves here is what somebody is owed.
**Size** 5 · **Satisfies** FR-7405, FR-7406, FR-7407

- **Given** a submitted timesheet, **when** I add a bonus, **then** it is in
  gross and in the file.
- **Given** a period already handed over, **when** I try to add one, **then**
  it is refused and I am told it goes on the next period.

### AR4 — Saying so where people look

**As** Maria **I want** to write my review where I already have an account
**so that** saying the workshop did well takes one tap.
**Size** 3 · **Satisfies** FR-7408

- **Given** I answered five, **when** the workshop has named its listing,
  **then** I am offered the button and the visit is counted.
- **Given** I answered three, **when** I open the public link, **then** I am
  taken back to the thank-you page.

## Epic AQ — Paper (Phase 42)

### AQ1 — The work order on the bench

**As** John **I want** the job on a sheet beside the car **so that** I work
through it without going back to a screen with greasy hands.
**Size** 3 · **Satisfies** FR-7301, FR-7305

- **Given** a job I am on, **when** I print its work order, **then** it has
  the checklist, labour, parts, what the inspection found and the keys' hook.
- **Given** a job I am not on, **when** I open its work order, **then** it is
  not found.

### AQ2 — The invoice, as a file

**As** Maria **I want** my invoice as a PDF **so that** I can send it to my
company for expenses.
**Size** 3 · **Satisfies** FR-7302, FR-7303, FR-7304

- **Given** my invoice, **when** I download it from the portal, **then** a PDF
  named for the workshop and the number arrives, and it matches the paper.
- **Given** Arabic is my language, **when** I print it, **then** it reads
  right to left with the plate and amounts intact.

### AQ3 — Labels and tags

**As** Paul in parts **I want** labels for a delivery and tags for the keys
**so that** nothing on the shelf or the hook board is anonymous.
**Size** 2 · **Satisfies** FR-7306, FR-7307

- **Given** twelve of a filter arrived, **when** I print twelve labels,
  **then** a sheet of them prints with a QR code to the part.
- **Given** any workshop page, **when** I print it, **then** only the page's
  content is on the paper.

---

## Story map

```
  BOOK          RECEIVE       INSPECT      QUOTE        APPROVE
  ----          -------       -------      -----        -------
  D1 diary      D3 convert    F1 tablet    F3 generate  G1 send
  D2 drag       B4 odometer   F2 measure   G3 threshold G2 approve
  B1 customer   E1 job screen                           J2 portal
  B3 VIN

  WORK          COMPLETE      INVOICE      REMEMBER
  ----          --------      -------      --------
  H1 my jobs    E2 lifecycle  I1 invoice   C3 auto-write
  H2 part req   A4 audit      I2 payment   C1 timeline
  E3 clock                                 C2 integrity
                                           C4 share
                                           C5 transfer

  Cross-cutting: A1 sign in - A2 tenancy - A3 roles - J1 dashboard

  LATER PHASES (15.1 to 20)
  -------------------------
  K1 claim a car     L1 lifecycle     M1 payables      N1 ask
  K2 confirm email   L2 pay/credit    M2 payroll       N2 summary
  K3 dead buttons                     M3 fleets
  O1 the network     P1 settings      Q1 paperwork            R1 CSP    R4 backup drill
  O2 the API         P2 accept plan   Q2 preferred technician R2 breach R5 openapi
                                                              R3 rate limit
  S1 read the job back   S2 draft, I send   S3 the budget
  T1 a passport I recognise   T2 the way back, the booklet
```

The bottom row is the differentiator. Everything above it is table stakes that
must nonetheless be excellent, because a workshop will not adopt the system for
the bottom row alone.

---

_Next: [Traceability matrix](04-traceability-matrix.md)._
