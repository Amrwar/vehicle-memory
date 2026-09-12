# User Stories

Stories grouped by epic. Each carries acceptance criteria in Given / When /
Then form, a size in points, and the functional requirements it satisfies.
Epics A to J are Phase 1. Epics K to Q were written as Phases 15.1 to 20
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
  O1 the network     P1 settings      Q1 paperwork
  O2 the API         P2 accept plan   Q2 preferred technician
```

The bottom row is the differentiator. Everything above it is table stakes that
must nonetheless be excellent, because a workshop will not adopt the system for
the bottom row alone.

---

_Next: [Traceability matrix](04-traceability-matrix.md)._
