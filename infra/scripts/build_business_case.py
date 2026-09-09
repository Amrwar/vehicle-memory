#!/usr/bin/env python
"""
Generates the Carnet business case as a Word document.

    python infra/scripts/build_business_case.py [output.docx]

The content is held as structured data below so the Word file, the repository
documentation and the published web version stay in step. Kept in the repo
rather than produced by hand so regenerating it after an edit is one command
rather than an afternoon of reformatting.

Requires: python-docx  (pip install python-docx)
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

# --- house style -----------------------------------------------------------

PETROL = RGBColor(0x0D, 0x3B, 0x3F)
BRASS = RGBColor(0x9A, 0x6D, 0x24)
INK = RGBColor(0x10, 0x17, 0x18)
INK_SOFT = RGBColor(0x3F, 0x4C, 0x4D)
FAINT = RGBColor(0x6B, 0x78, 0x78)

DISPLAY = "Arial"
BODY = "Georgia"
MONO = "Consolas"

OWNER = "Amr Hefny"
EMAIL = "hefnyamr@rocketmail.com"
PHONE = "+1 514 553 4360"
VERSION = "1.0"
DATE = "9 September 2026"


def shade(cell, hex_colour: str) -> None:
    """Applies a background fill to a table cell."""
    element = OxmlElement("w:shd")
    element.set(qn("w:val"), "clear")
    element.set(qn("w:fill"), hex_colour)
    cell._tc.get_or_add_tcPr().append(element)


def style_document(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = BODY
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.25

    for name, size, colour, before in (
        ("Heading 1", 20, PETROL, 22),
        ("Heading 2", 14, PETROL, 16),
        ("Heading 3", 11, BRASS, 12),
    ):
        style = doc.styles[name]
        style.font.name = DISPLAY
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = colour
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(6)
        style.paragraph_format.keep_with_next = True


def para(doc, text: str, *, size=10.5, colour=INK, bold=False, italic=False,
         font=BODY, align=None, space_after=8):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = font
    run.font.size = Pt(size)
    run.font.color.rgb = colour
    run.bold = bold
    run.italic = italic
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    return p


def rich(doc, parts, *, size=10.5, space_after=8):
    """parts: list of (text, bold) tuples, so a sentence can carry emphasis."""
    p = doc.add_paragraph()
    for text, bold in parts:
        run = p.add_run(text)
        run.font.name = BODY
        run.font.size = Pt(size)
        run.font.color.rgb = INK
        run.bold = bold
    p.paragraph_format.space_after = Pt(space_after)
    return p


def bullets(doc, items, numbered=False):
    for item in items:
        p = doc.add_paragraph(style="List Number" if numbered else "List Bullet")
        if isinstance(item, tuple):
            lead, rest = item
            run = p.add_run(lead)
            run.bold = True
            run.font.name = BODY
            run.font.size = Pt(10.5)
            run = p.add_run(rest)
        else:
            run = p.add_run(item)
        run.font.name = BODY
        run.font.size = Pt(10.5)
        p.paragraph_format.space_after = Pt(4)


def table(doc, caption: str, headers: list[str], rows: list[list[str]],
          widths: list[float] | None = None, highlight: set[int] | None = None):
    if caption:
        cap = para(doc, caption.upper(), size=7.5, colour=FAINT, font=DISPLAY,
                   bold=True, space_after=3)
        cap.paragraph_format.keep_with_next = True

    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    t.autofit = True

    for index, header in enumerate(headers):
        cell = t.rows[0].cells[index]
        cell.text = ""
        run = cell.paragraphs[0].add_run(header.upper())
        run.font.name = DISPLAY
        run.font.size = Pt(7.5)
        run.font.bold = True
        run.font.color.rgb = PETROL
        shade(cell, "ECEFF0")

    for row_index, row in enumerate(rows):
        cells = t.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = ""
            paragraph = cells[index].paragraphs[0]
            run = paragraph.add_run(str(value))
            run.font.name = BODY
            run.font.size = Pt(9)
            run.font.color.rgb = INK
            if highlight and row_index in highlight:
                run.bold = index == 0
                shade(cells[index], "E2ECEC")

    if widths:
        for row in t.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Cm(width)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def callout(doc, tag: str, text: str, accent=PETROL, fill="E2ECEC"):
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    cell = t.rows[0].cells[0]
    cell.text = ""
    shade(cell, fill)

    head = cell.paragraphs[0]
    run = head.add_run(tag.upper())
    run.font.name = DISPLAY
    run.font.size = Pt(7.5)
    run.font.bold = True
    run.font.color.rgb = accent
    head.paragraph_format.space_after = Pt(3)

    body = cell.add_paragraph()
    run = body.add_run(text)
    run.font.name = BODY
    run.font.size = Pt(9.5)
    run.font.color.rgb = INK

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def rule(doc):
    p = doc.add_paragraph()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:color"), "0D3B3F")
    border.append(bottom)
    p._p.get_or_add_pPr().append(border)
    p.paragraph_format.space_after = Pt(10)


def add_footer(doc):
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.text = ""
    run = p.add_run(
        f"Carnet — Business Case & Commercial Proposal · Version {VERSION} · "
        f"{DATE} · Document owner: {OWNER} · Confidential"
    )
    run.font.name = DISPLAY
    run.font.size = Pt(7)
    run.font.color.rgb = FAINT
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER


# --- document --------------------------------------------------------------


def build(output: Path) -> None:
    doc = Document()
    style_document(doc)

    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

    add_footer(doc)

    # ---- cover ----
    para(doc, "CARNET", size=9, colour=BRASS, font=DISPLAY, bold=True, space_after=2)
    para(doc, "BUSINESS CASE & COMMERCIAL PROPOSAL", size=9, colour=FAINT,
         font=DISPLAY, bold=True, space_after=18)

    title = doc.add_paragraph()
    run = title.add_run("The history should\nbelong to the car.")
    run.font.name = DISPLAY
    run.font.size = Pt(34)
    run.font.bold = True
    run.font.color.rgb = INK
    title.paragraph_format.space_after = Pt(14)

    rich(doc, [
        ("A workshop management and ERP platform whose distinguishing asset is a ", False),
        ("portable vehicle history that follows the vehicle", True),
        (" rather than the owner or the garage. This document sets out the problem, "
         "the product, the competitive position, the minimum viable release and the "
         "commercial terms.", False),
    ], size=12, space_after=18)

    table(doc, "", ["Field", "Detail"], [
        ["Prepared by", OWNER],
        ["Email", EMAIL],
        ["Telephone", PHONE],
        ["Document owner", OWNER],
        ["Version", VERSION],
        ["Date", DATE],
        ["Status", "For approval"],
        ["Repository", "vehicle-memory"],
        ["Classification", "Confidential"],
    ], widths=[4.5, 11.5])

    doc.add_page_break()

    # ---- 01 executive summary ----
    doc.add_heading("01  Executive summary", level=1)
    rule(doc)

    para(doc,
         "The workshop software market is mature and competently served. We do not "
         "propose to win on feature count. We propose to win on a structural advantage "
         "that incumbents cannot copy without rebuilding their data model.",
         size=12, colour=INK_SOFT)

    para(doc,
         "A vehicle passes through four or five owners and a dozen workshops across a "
         "twenty-year life. At every step somebody writes something down, and almost "
         "none of it survives. The buyer inherits a car whose real condition is "
         "unknowable, the seller cannot prove the money they spent looking after it, "
         "and the next mechanic diagnoses from zero.")

    rich(doc, [
        ("The data that would fix this ", False),
        ("already gets typed into a computer", True),
        (", every day, by the mechanic doing the work. It goes into workshop management "
         "software and is buried inside one tenant, where it dies the moment the "
         "customer goes elsewhere.", False),
    ])

    callout(doc, "The central insight",
            "Do not ask anyone to contribute vehicle history. Give workshops a genuinely "
            "better system for running their business, and let the history be the exhaust "
            "of them doing their ordinary work.",
            accent=BRASS, fill="F4ECDC")

    rich(doc, [
        ("Carnet is one data core with two surfaces. ", False),
        ("Carnet Workshop", True),
        (" is the business we sell: booking, jobs, digital inspections, estimates, "
         "customer approval, invoicing, and a real double-entry ledger underneath so the "
         "owner sees job-level profit rather than only an invoice total. ", False),
        ("Carnet Passport", True),
        (" is the network we build: every completed job writes verified, attributed, "
         "tamper-evident events to that vehicle's permanent timeline, which transfers "
         "when the car is sold.", False),
    ])

    table(doc, "Headline figures", ["Measure", "Value", "Note"], [
        ["Delivery", "28 weeks", "To a commercially complete platform"],
        ["Build cost", "GBP 302,500", "Phases 1 to 3, before contingency"],
        ["Proposal range", "GBP 268,000 – 312,000", "Excluding held contingency"],
        ["First revenue", "Week 20", "First paying customer"],
        ["Capability gaps", "11", "Where the verified incumbent has nothing"],
    ], widths=[4.0, 4.5, 7.5])

    rich(doc, [
        ("The ask: ", True),
        ("approval to deliver Phases 1 to 3 over 28 weeks at an estimated "
         "GBP 268,000 to 312,000 of build cost, producing a sellable product with "
         "paying customers by week 20.", False),
    ])

    # ---- 02 problem ----
    doc.add_page_break()
    doc.add_heading("02  The problem", level=1)
    rule(doc)

    para(doc, "A car outlives every record of it.", size=12, bold=True)
    para(doc,
         "The record is not missing. It is scattered across parties who have no "
         "mechanism, and no incentive, to share it. A dealer holds the handover report. "
         "One mechanic holds job card 412 in a closed system. The owner holds a box of "
         "receipts, half of them lost. The next mechanic starts from blank. The next "
         "owner knows nothing. Five partial histories, and the only party present at "
         "every event is the car, which cannot speak.")

    table(doc, "Cost of a fragmented record", ["Party", "What it costs them"], [
        ["Buyer", "Pays for a car whose condition is unknowable. Odometer fraud, "
                  "undisclosed accident damage, skipped cambelt intervals. Buys risk blind."],
        ["Seller", "Cannot prove the thousands spent on diligent maintenance. A well-kept "
                   "car sells for the same price as a neglected one."],
        ["Workshop", "Every unfamiliar car is diagnosed from zero. Hours spent "
                     "rediscovering facts somebody already established."],
        ["Owner", "Cannot judge whether a quote is fair, having no record of what was "
                  "already replaced. Pays twice for the same part more often than anyone admits."],
        ["Insurer / OEM", "Recall campaigns reach a fraction of affected vehicles. Claims "
                          "assessed on assertion rather than evidence."],
    ], widths=[3.5, 12.5])

    doc.add_heading("Why the existing answers do not work", level=3)
    bullets(doc, [
        ("Vehicle history reports ", "aggregate what institutions already report: "
         "registrations, write-offs, some franchised-dealer servicing. They are thin on "
         "the routine maintenance performed by the independent workshops that service "
         "most cars. They can only report what somebody else already digitised."),
        ("Paper service booklets ", "are forgeable, and lost with the glovebox."),
        ("Workshop software ", "captures excellent data and then locks it inside one tenant."),
    ])

    # ---- 03 product ----
    doc.add_page_break()
    doc.add_heading("03  The product", level=1)
    rule(doc)

    para(doc, "One data core, two surfaces.", size=12, bold=True)
    para(doc,
         "The commercial product and the strategic asset are the same system seen from "
         "two directions. This is what makes the model work: contribution is not a favour "
         "asked of workshops, it is a by-product of them running their own business.")

    table(doc, "The two surfaces", ["Surface", "Who uses it", "Price", "What it is"], [
        ["Carnet Passport", "Owners, buyers, sellers, insurers", "Free",
         "The vehicle's permanent timeline. Keyed to VIN, not to an owner or a workshop. "
         "Append-only, tamper-evident, transfers on sale."],
        ["Carnet Workshop", "Workshops, technicians, owners, bookkeepers", "Paid",
         "Booking, job, inspection, estimate, approval, parts, work, quality check, "
         "invoice, payment, ledger."],
    ], widths=[3.2, 4.0, 1.8, 7.0])

    doc.add_heading("What a passport holds", level=3)
    table(doc, "Event categories on the vehicle timeline",
          ["Category", "What it answers"], [
        ["Ownership", "Who held the vehicle, and for how long"],
        ["Mileage", "Every reading ever taken, checked for consistency"],
        ["Repairs", "What failed, what was done, by which workshop"],
        ["Parts", "Exactly which part number went in, and when"],
        ["Accidents", "Damage, assessment and repair"],
        ["Inspections", "Every checklist result, with photographs"],
        ["Tyres", "Fitted, rotated, replaced, with tread depths"],
        ["Recalls", "Campaign issued, and campaign performed"],
        ["Modifications", "What was changed from factory specification"],
        ["Maintenance", "Services performed against the schedule"],
    ], widths=[4.0, 12.0])

    callout(doc, "Design decision",
            "A decreasing odometer reading is recorded and flagged, never rejected. The "
            "obvious implementation refuses an impossible reading. That implementation is "
            "wrong: a backwards odometer is either a clerical error or odometer fraud, and "
            "the second is precisely what a buyer most needs to see. Refusing the reading "
            "destroys the evidence.")

    # ---- 04 mechanism ----
    doc.add_page_break()
    doc.add_heading("04  How it works", level=1)
    rule(doc)

    doc.add_heading("Trust, without a blockchain", level=3)
    para(doc,
         "A history that can be quietly edited is not evidence. Each event's "
         "cryptographic hash covers its own content and the hash of the event before it. "
         "Altering any entry changes its hash, which breaks every hash after it, and "
         "verification names the first point of divergence.")
    para(doc,
         "We deliberately did not use a distributed ledger. Consensus answers the "
         "question of who decides what is true when nobody is trusted. Our question is "
         "narrower: can the operator of this database silently rewrite the past. A hash "
         "chain, an append-only database trigger and periodic external anchoring answer "
         "it at a fraction of the cost, latency and regulatory exposure.")

    doc.add_heading("The flow that generates the data", level=3)
    para(doc,
         "Nothing in this loop asks anybody to do extra work. The passport entries at the "
         "end are written automatically when the job completes.")

    table(doc, "End-to-end workflow",
          ["Step", "Who", "Contributes to the passport"], [
        ["Booking", "Service advisor", "—"],
        ["Vehicle received", "Service advisor", "Odometer reading"],
        ["Inspection", "Technician, on a tablet", "Checklist results, measurements, photographs"],
        ["Estimate", "Generated from findings", "—"],
        ["Approval", "Customer, on a phone", "—"],
        ["Repair", "Technician", "Work performed, hours, diagnosis"],
        ["Parts fitted", "Technician", "One entry per part, with part number"],
        ["Quality check", "Manager", "—"],
        ["Invoice and payment", "Service advisor", "—"],
        ["Job completed", "System", "All of the above written and chained, automatically"],
    ], widths=[3.6, 4.4, 8.0], highlight={9})

    doc.add_heading("Every operational act posts its financial consequence", level=3)
    para(doc,
         "This is the second differentiator, and the reason a workshop owner will pay a "
         "premium. Incumbents produce an invoice. We post the ledger entries behind it, "
         "so job profitability is a fact rather than a March guess from an accountant.")

    table(doc, "Worked example — a brake repair",
          ["Line", "Charged", "Cost", "Margin"], [
        ["Brake inspection, 1.0 h", "95.00", "38.00", "57.00"],
        ["Brake replacement, 3.5 h", "332.50", "133.00", "199.50"],
        ["Brake pads", "420.00", "252.00", "168.00"],
        ["Brake discs", "410.00", "246.00", "164.00"],
        ["Net, before tax", "1,257.50", "669.00", "588.50"],
        ["Gross margin", "—", "—", "46.8%"],
    ], widths=[7.0, 3.0, 3.0, 3.0], highlight={4, 5})

    callout(doc, "Why this is harder than it looks",
            "Labour is charged at book time and costed at clocked time. This job bills 4.5 "
            "hours and the technician actually took 5.2. Both figures are true, and both "
            "are needed. Systems that conflate them cannot measure profitability at all, "
            "which is exactly why most workshop owners cannot tell you which jobs lose money.",
            accent=BRASS, fill="F4ECDC")

    # ---- 05 strategy ----
    doc.add_page_break()
    doc.add_heading("05  Why this works where others have not", level=1)
    rule(doc)

    para(doc,
         "Every vehicle-history network faces the same cold-start problem. The history is "
         "worthless until coverage is high, and nobody contributes until it is valuable. "
         "Our answer is that contribution is a side effect, not a request.")

    bullets(doc, [
        "A workshop adopts Carnet because it is better workshop software.",
        "Each completed job writes verified events to that vehicle's passport.",
        "Coverage rises with no additional data entry by anyone.",
        "Passports become valuable, so owners ask their workshop for one.",
        "Owners prefer workshops that can issue one, and more workshops adopt.",
    ], numbered=True)

    doc.add_heading("The contributor revenue share", level=3)
    rich(doc, [
        ("A workshop's instinctive objection is: why would I help the garage down the "
         "road? The answer is that they get paid. When a verified buyer report is sold, ", False),
        ("30% of net revenue is distributed among the workshops whose events populate "
         "that vehicle's timeline", True),
        (", weighted by event count and recency.", False),
    ])

    table(doc, "Distribution of a single verified buyer report",
          ["Line", "Amount", "Note"], [
        ["Report price", "GBP 14.99", "Paid by the buyer"],
        ["Processing and tax", "-GBP 1.20", ""],
        ["Carnet, 70%", "GBP 9.65", ""],
        ["Workshop A — 11 events, recent", "GBP 2.40", "Contributor pool"],
        ["Workshop B — 5 events", "GBP 1.09", "Contributor pool"],
        ["Workshop C — 2 events, older", "GBP 0.65", "Contributor pool"],
    ], widths=[7.0, 4.0, 5.0])

    para(doc,
         "The sums are small. The signal is not. Publishing the rate makes it costly for "
         "us to change later, which is precisely what makes it credible now.")

    doc.add_heading("What is actually defensible", level=3)
    table(doc, "Defensibility, assessed candidly",
          ["Asset", "Copyable?", "Why"], [
        ["Digital inspection module", "Yes, one quarter", "A well-understood feature"],
        ["Customer portal", "Yes, one quarter", "Same"],
        ["General ledger", "Yes, two quarters", "Harder, but bounded"],
        ["Vehicle history coverage", "No",
         "An accumulated record of work actually performed. A competitor starting today "
         "starts at zero and cannot backfill what was never captured."],
        ["Contributor incentive", "Partly",
         "The mechanism is copyable; the installed base already contributing is not"],
    ], widths=[4.5, 3.5, 8.0], highlight={3})

    rich(doc, [
        ("The moat is time-based and coverage-based. That argues for exactly one thing: ", False),
        ("start writing passport events in Phase 1, from the very first job", True),
        (", even while the passport has almost no readers.", False),
    ])

    # ---- 06 competition ----
    doc.add_page_break()
    doc.add_heading("06  Competitive position", level=1)
    rule(doc)

    rich(doc, [
        ("The structural observation is that ", False),
        ("nobody sits in both the workshop's operational system and the vehicle's "
         "lifetime record", True),
        (". Those are treated as separate industries. They are the same data.", False),
    ])

    table(doc, "Competitive landscape",
          ["Category", "Examples", "Where they leave room"], [
        ["Workshop management", "MechanicDesk, Garage Hive, Tekmetric, Shopmonkey",
         "Data ends at the tenant boundary. Accounting is an export, not a ledger. The "
         "customer is a phone number, not a participant."],
        ["Vehicle history reports", "Carfax, HPI, CarVertical",
         "Blind to independent-workshop maintenance, which is most maintenance. "
         "Read-only, with no relationship to the workshops generating the facts."],
        ["Accounting packages", "Xero, QuickBooks",
         "Know nothing about a job, a part or a vehicle. Job profitability is manual."],
        ["Franchised dealer DMS", "Keyloop, CDK",
         "Priced and shaped for dealer groups. Independents cannot buy or use them."],
    ], widths=[3.5, 4.5, 8.0])

    doc.add_heading("Verified feature comparison", level=3)
    para(doc,
         "The following was verified inside MechanicDesk's product on 9 September 2026, "
         "not taken from marketing material. Their complete navigation is: Diary, Jobs, "
         "Customers and Vehicles, and under More: Invoices and Bills, Inventory and "
         "Suppliers, Service Schedules, Reports, Timesheets, POS, Settings, Help.")

    comparison = [
        ["Booking diary, day / week / month", "Yes", "Yes, plus bay and technician lanes"],
        ["Job management, types, tags, follow-ups", "Yes", "Yes, as an explicit state machine"],
        ["Customers, vehicles, VIN lookup", "Yes", "Yes"],
        ["Invoicing and quoting", "Yes", "Yes"],
        ["Stock control and reordering", "Yes", "Yes, with job reservation"],
        ["Suppliers and bills", "Yes", "Yes, with approval workflow"],
        ["Service scheduling and reminders", "Yes", "Yes, time and mileage projected"],
        ["Timesheets, reporting, multi-site, POS", "Yes", "Yes / phased"],
        ["Structured digital vehicle inspection", "No", "Yes"],
        ["Findings auto-generate the estimate", "No", "Yes"],
        ["Customer portal", "No", "Yes"],
        ["Approval by secure link, with audit trail", "No", "Yes"],
        ["Double-entry general ledger", "No", "Yes"],
        ["Job-level profitability", "No", "Yes"],
        ["Purchase approval workflow", "No", "Yes"],
        ["Portable history across workshops", "No", "Yes"],
        ["Tamper-evident event ledger", "No", "Yes"],
        ["Ownership transfer of history", "No", "Yes"],
        ["Owner-controlled disclosure", "No", "Yes"],
    ]
    table(doc, "Carnet against a verified incumbent",
          ["Capability", "Incumbent", "Carnet"], comparison,
          widths=[8.0, 3.0, 5.0], highlight=set(range(8, 19)))

    para(doc,
         "Eleven capabilities where the incumbent has nothing. Nine of them are not "
         "features that could be added in a sprint; they require a data model built "
         "around the vehicle rather than around the tenant.")

    doc.add_heading("Where we deliberately do not compete", level=3)
    bullets(doc, [
        ("On price. ", "A system that posts your ledger correctly is worth more than one "
         "that does not, and a race to the bottom funds neither support nor correctness."),
        ("On breadth of ERP. ", "Multi-jurisdiction payroll and fixed-asset depreciation "
         "are not our problem."),
        ("On franchised dealer groups. ", "Different buyer, different sales motion, "
         "different compliance surface."),
    ])

    # ---- 07 MVP ----
    doc.add_page_break()
    doc.add_heading("07  The minimum viable release", level=1)
    rule(doc)

    para(doc,
         "An MVP is not version one with fewer features. It is the smallest thing that "
         "tests whether the idea is true.", size=12, colour=INK_SOFT)

    table(doc, "What the MVP is actually testing",
          ["#", "Hypothesis", "Fails if"], [
        ["H1", "A workshop will run its entire day in Carnet in preference to what it "
               "uses now", "They keep a paper diary or spreadsheet alongside it"],
        ["H2", "Technicians will genuinely record inspection results on a tablet",
         "Under 60% of jobs get a completed inspection, or the median exceeds four minutes"],
        ["H3", "Customers will approve estimates on a phone rather than by telephone",
         "Under 40% approved by link, or advisors keep phoning anyway"],
    ], widths=[1.5, 7.0, 7.5], highlight={1})

    callout(doc, "The load-bearing hypothesis",
            "H2 matters most. If technicians do not record, the passport is empty, and "
            "without the passport this is just another workshop system. If H2 fails we "
            "stop and redesign the shop-floor interface before building anything else.",
            accent=BRASS, fill="F4ECDC")

    doc.add_heading("In scope", level=3)
    bullets(doc, [
        "Multi-tenant foundation, authentication, six roles, full audit trail",
        "Customers and vehicles, with VIN and registration lookup",
        "The vehicle passport event ledger, including sharing and ownership transfer",
        "Booking diary with bay and technician lanes, and drag to reschedule",
        "The job lifecycle engine, with fourteen defined statuses",
        "Digital vehicle inspection with photographs and structured measurements",
        "Estimates, secure customer approval, line-by-line accept or decline",
        "Invoicing, partial payments, gapless document numbering",
        "Shop-floor technician interface, built for a tablet and gloves",
        "Customer portal and the action-oriented workshop dashboard",
    ])

    doc.add_heading("Out of scope, and where it lands", level=3)
    table(doc, "Deliberate exclusions", ["Excluded", "Phase", "Why deferred"], [
        ["Inventory and stock control", "2", "Jobs can name parts as text with a cost until then"],
        ["Purchase orders and suppliers", "2", "No stock, no purchasing"],
        ["General ledger and accounting", "3", "You cannot post what has not happened yet"],
        ["Payroll, HR, commissions", "4", "Regulatory variance, low differentiation"],
        ["Multi-location", "4", "One location proves the model first"],
        ["Point of sale, online self-booking", "5", "Not the wedge"],
        ["Native mobile apps", "5", "Responsive web is enough to test H2"],
        ["Forecasting, AI-assisted diagnosis", "6", "Requires a year of data that does not yet exist"],
    ], widths=[5.5, 2.0, 8.5])

    callout(doc, "The one contentious inclusion",
            "The passport earns nothing in year one and no customer asks for it. Cutting it "
            "would save roughly two weeks. We keep it because coverage cannot be backfilled "
            "— work not captured in week one is gone permanently — and because retrofitting "
            "an append-only ledger onto mutable operational tables is a rewrite, not a feature.")

    doc.add_heading("Definition of done", level=3)
    para(doc, "The MVP is complete when all of these are true. Not most.")
    bullets(doc, [
        "A workshop runs a complete day without touching another system",
        "A technician completes a 30-item inspection with photographs in under four "
        "minutes, verified by observation rather than assertion",
        "A customer approves an estimate on a phone in under sixty seconds, without an account",
        "Every completed job has written its events to the vehicle passport",
        "A passport can be shared by link and read by someone with no account",
        "Ownership can be transferred and the history goes with the vehicle",
        "Domain-layer test coverage at or above 70%, with the job lifecycle and passport "
        "chain at or above 90%",
        "Two design partners have run live for four weeks with no parallel system",
    ])

    table(doc, "MVP success metrics", ["Metric", "Target", "Tests"], [
        ["Inspection completion rate", "> 60%", "H2"],
        ["Median inspection duration", "< 4 minutes", "H2"],
        ["Estimates approved by link", "> 40%", "H3"],
        ["Median send-to-decision time", "< 4 hours", "H3"],
        ["Jobs per workshop per day", "> 8", "H1"],
        ["Passport events per completed job", "> 3", "Coverage"],
        ["Arrival to estimate sent", "< 90 minutes", "Flow"],
    ], widths=[7.0, 4.5, 4.5])

    # ---- 08 proposal ----
    doc.add_page_break()
    doc.add_heading("08  Commercial proposal", level=1)
    rule(doc)

    doc.add_heading("Phasing, and why this order", level=3)
    para(doc,
         "The sequence is not arbitrary. It follows the dependency chain of the money: "
         "you cannot invoice what you did not job, you cannot cost a job without parts "
         "costs, and you cannot post a ledger entry without both.")

    table(doc, "Delivery phases", ["Phase", "Scope", "Weeks", "Estimate"], [
        ["1  Workshop Core",
         "Tenancy, customers, vehicles, passport ledger, diary, jobs, inspections, "
         "estimates, approval, invoicing, technician interface, portal, dashboard",
         "10", "GBP 93,500"],
        ["2  Inventory and Procurement",
         "Parts, warehouses, stock movements, reservation against jobs, reorder "
         "detection, purchase requests and approval, orders, receiving, supplier bills",
         "8", "GBP 93,500"],
        ["3  Finance and ERP",
         "Chart of accounts, general ledger, automatic posting, receivables and "
         "payables, expenses, tax, periods, financial statements, profitability",
         "10", "GBP 115,500"],
        ["Build subtotal", "110 person-weeks", "28", "GBP 302,500"],
        ["Contingency at 15%", "Held, released on evidence", "—", "GBP 45,375"],
    ], widths=[4.0, 7.0, 1.8, 3.2], highlight={3, 4})

    para(doc,
         "Phases overlap by design: Phase 2 schema work does not contend with Phase 1 "
         "interface work. Running costs are separate from build, at roughly GBP 400 to "
         "900 per month in year one for hosting, database, object storage, error "
         "tracking, SMS and email.")

    doc.add_heading("Team", level=3)
    table(doc, "Team shape, peak 4.2 FTE",
          ["Role", "FTE", "Weeks", "Responsibility"], [
        ["Tech lead / architect", "1.0", "28", "Domain model, architecture, review, the hard parts"],
        ["Senior full-stack engineer", "1.0", "28", "Feature delivery across the stack"],
        ["Full-stack engineer", "1.0", "24", "Feature delivery, from week 5"],
        ["Product designer", "0.5", "20", "Design system, screen design, usability testing"],
        ["QA engineer", "0.5", "22", "Test strategy, automation, exploratory testing"],
        ["Product owner", "0.2", "28", "Prioritisation, acceptance, design partners"],
    ], widths=[4.5, 1.5, 1.8, 8.2])

    para(doc,
         "Deliberately small. This domain requires shared understanding of one intricate "
         "model, and that does not survive a large team.")

    doc.add_heading("Milestones", level=3)
    table(doc, "Key dates and gates", ["Week", "Milestone"], [
        ["2", "Design system approved; domain model reviewed with design partners"],
        ["4", "Architecture and data model signed off; walking skeleton deployed"],
        ["10", "Phase 1 accepted — MVP live with design partners"],
        ["18", "Phase 2 accepted"],
        ["20", "First paying customer; pricing validated"],
        ["28", "Phase 3 accepted — commercially complete platform"],
    ], widths=[2.0, 14.0], highlight={2, 4, 5})

    doc.add_heading("Payment schedule", level=3)
    table(doc, "Payment against milestones", ["Milestone", "Trigger", "Share"], [
        ["Mobilisation", "Contract signature", "15%"],
        ["Phase 1 acceptance", "Workshop Core demonstrated against acceptance criteria", "30%"],
        ["Phase 2 acceptance", "Inventory and Procurement accepted", "25%"],
        ["Phase 3 acceptance", "Finance and ERP accepted", "25%"],
        ["Warranty release", "30 days after Phase 3 acceptance", "5%"],
    ], widths=[4.5, 9.0, 2.5])

    doc.add_heading("Assumptions", level=3)
    bullets(doc, [
        "One product owner available a minimum of four hours per week for decisions and acceptance.",
        "Two design-partner workshops give access to real workflows and fortnightly feedback from week 3.",
        "Single-country tax and compliance in version one; multi-jurisdiction tax is priced separately.",
        "Third-party services (SMS, email, payments, VIN decoding) are procured separately "
        "and are not in the build cost.",
        "Migration from an incumbent system is a professional-services engagement, not product work.",
    ], numbered=True)

    doc.add_heading("What you receive at each phase", level=3)
    bullets(doc, [
        "Running software deployed to staging and production, source under an MIT licence.",
        "Passing test suites with coverage reporting, and the pipeline that enforces them.",
        "Complete documentation: requirements, domain model, data model, architecture, "
        "API contract, design system, operational runbook.",
        "Architecture decision records explaining not just what was built, but what was "
        "rejected and why.",
        "A demonstration against written acceptance criteria agreed before the work started.",
    ], numbered=True)

    # ---- 09 business model ----
    doc.add_page_break()
    doc.add_heading("09  Business model", level=1)
    rule(doc)

    para(doc,
         "Two revenue lines, one build. The subscription funds the company; the passport "
         "is what makes the company valuable.")

    table(doc, "Workshop subscription, per bay per month",
          ["Tier", "Price", "Includes"], [
        ["Core", "GBP 39",
         "Diary, jobs, customers, vehicles, inspections, estimates, invoicing, technician "
         "interface, customer portal, passport writing"],
        ["Complete", "GBP 69",
         "Core plus inventory, purchasing, suppliers, general ledger, financial "
         "statements, job profitability"],
        ["Group", "GBP 99",
         "Complete plus multi-location, consolidated reporting, stock transfer, "
         "commissions, priority support"],
    ], widths=[3.0, 2.5, 10.5])

    para(doc,
         "Pricing is per bay rather than per user, because bays correlate with capacity "
         "while user count punishes a workshop for giving staff access, the opposite of "
         "what we want. The customer portal and passport writing sit in the cheapest tier "
         "deliberately: restricting them would throttle the network we are trying to grow, "
         "to protect revenue we have not earned.")

    table(doc, "Passport pricing", ["Product", "Price", "Buyer"], [
        ["Owner access to their own vehicles", "Free", "Every owner, permanently"],
        ["Share link to a prospective buyer", "Free", "Seller"],
        ["Verified buyer report", "GBP 14.99", "Private buyer"],
        ["Trade seat, unlimited reports", "GBP 99/month", "Used-car dealers"],
        ["API access", "Volume-priced", "Insurers, auctions, finance"],
    ], widths=[6.5, 4.0, 5.5])

    doc.add_heading("Unit economics", level=3)
    para(doc, "Modelled on a six-bay workshop on Complete at GBP 414 per month.")
    table(doc, "Unit economics", ["Measure", "Value"], [
        ["ARPA", "GBP 4,968 per year"],
        ["Gross margin", "82%"],
        ["Customer acquisition cost", "GBP 1,400"],
        ["CAC payback", "4.1 months"],
        ["Assumed annual churn", "12%"],
        ["Lifetime value", "GBP 33,800"],
        ["LTV to CAC", "24 : 1"],
    ], widths=[8.0, 8.0])

    callout(doc, "The fragile assumption",
            "That ratio is high because assumed annual churn is 12%. A workshop that has "
            "put its diary, its history and its ledger into a system does not casually "
            "leave, but this is an assumption until measured, and it is the single number "
            "most capable of making the model wrong.",
            accent=BRASS, fill="F4ECDC")

    doc.add_heading("Go to market", level=3)
    bullets(doc, [
        ("Months 1 to 6, design partners. ", "Two workshops, free, in exchange for access "
         "and honesty. We are buying product truth, not revenue."),
        ("Months 5 to 12, local density. ", "Sell within one geography until vehicles start "
         "arriving with history already attached. That moment, a workshop opening a car it "
         "has never seen and finding three years of records, is the product demonstrating "
         "itself. Density beats breadth."),
        ("Months 12 to 24, owner pull. ", "Once passports have content, market to owners. An "
         "owner who values their vehicle's history asks their workshop for it, converting "
         "workshops far more cheaply than outbound sales."),
        ("Months 24 onward, the trade. ", "Dealers, auctions, insurers, finance. They pay "
         "most and need least support, but only once coverage is real."),
    ], numbered=True)

    # ---- 10 risks ----
    doc.add_page_break()
    doc.add_heading("10  Risks", level=1)
    rule(doc)

    para(doc, "The five that could actually derail this, with the mitigation each carries.")

    table(doc, "Principal risks", ["#", "Risk", "Impact", "Mitigation"], [
        ["R1", "Technicians do not adopt the shop-floor interface. Data quality collapses "
               "and the passport is worthless.", "Critical",
         "Design partners from week 3. Usability testing on real tablets, in a real "
         "workshop, with gloves on, before Phase 1 acceptance."],
        ["R2", "Accounting correctness defects. A ledger that does not balance destroys "
               "trust irrecoverably.", "Critical",
         "Double-entry invariants enforced in the database, not only in code. No unbalanced "
         "journal can post. External accountant review before Phase 3 acceptance."],
        ["R3", "Cold start. Passports stay empty long enough that the differentiator never "
               "materialises.", "High",
         "Phase 1 already writes passport events. Coverage measured from day one. Revenue "
         "share designed in from the start rather than retrofitted."],
        ["R4", "Scope expansion into general ERP. The word ERP attracts unbounded "
               "requirements.", "High",
         "Explicit written exclusions. Anything off the roadmap requires a change request "
         "with cost and schedule impact."],
        ["R5", "Data protection exposure. We hold personal data plus a vehicle's complete "
               "history.", "Critical",
         "Tenant isolation enforced at the data-access layer rather than by convention. "
         "Documented security model. Penetration test before general availability."],
    ], widths=[1.2, 5.3, 2.0, 7.5])

    doc.add_heading("What would make the business model wrong", level=3)
    table(doc, "Assumptions under test",
          ["Assumption", "If false", "Detected by"], [
        ["Workshops pay a premium for integrated accounting",
         "Compress to one GBP 45 tier and compete on the passport alone",
         "Design-partner pricing validation, week 20"],
        ["Local density achievable at reasonable acquisition cost",
         "The network effect never ignites; we are a workshop SaaS with a nice feature",
         "Density tracking, months 5 to 12"],
        ["Buyers pay for a report when free share links exist",
         "Passport revenue never materialises; the moat is defensive only",
         "First paid cohort, month 18"],
        ["Workshops are not hostile to data portability",
         "Adoption stalls on principle rather than product",
         "Design-partner interviews, week 6"],
    ], widths=[5.5, 6.0, 4.5])

    para(doc,
         "The last is the one to watch early. It is a belief about attitude rather than "
         "software, and it is cheap to test in conversation long before it is expensive to "
         "discover in the market.")

    # ---- 11 references ----
    doc.add_page_break()
    doc.add_heading("11  References and sources", level=1)
    rule(doc)

    para(doc,
         "Where a claim in this document rests on something external, it is listed here. "
         "Where a figure is an internal estimate rather than a measured quantity, it is "
         "labelled as such in the text.")

    references = [
        ("MechanicDesk product navigation, feature set and job data model, verified "
         "directly inside the application.",
         "mechanicdesk.com.au — accessed 9 September 2026. Basis for the comparison in section 06."),
        ("MechanicDesk public feature listing.",
         "mechanicdesk.com.au/features — accessed 9 September 2026."),
        ("ISO 3779 and FMVSS 115 — vehicle identification number structure, "
         "transliteration table and check-digit algorithm.",
         "Implemented and unit-tested in the VIN module. Governs the check-digit behaviour "
         "described in section 03."),
        ("Minimum legal tyre tread depth of 1.6 mm across the majority of European "
         "jurisdictions; 3 mm as the widely accepted safety advisory threshold.",
         "Encoded as named constants in the inspection module so the reasoning is "
         "inspectable rather than buried in a comparison."),
        ("Sequential, gapless invoice numbering as a statutory requirement in several "
         "jurisdictions.",
         "Drives the decision to use a locked counter row rather than a database sequence, "
         "which leaves gaps on rollback."),
        ("Statutory retention of financial records, minimum seven years.",
         "Non-functional requirement NFR-903."),
        ("WCAG 2.2 Level AA.",
         "Accessibility conformance target for all four interface surfaces."),
        ("Carnet project repository — full requirements, domain model, data model, "
         "architecture decision records, design system and test strategy.",
         "Repository vehicle-memory. This document summarises material held there in full."),
    ]

    for index, (claim, source) in enumerate(references, start=1):
        p = doc.add_paragraph()
        marker = p.add_run(f"[{index}]  ")
        marker.font.name = MONO
        marker.font.size = Pt(9)
        marker.font.color.rgb = BRASS
        marker.bold = True
        run = p.add_run(claim)
        run.font.name = BODY
        run.font.size = Pt(9.5)
        p.paragraph_format.space_after = Pt(2)

        note = doc.add_paragraph()
        note.paragraph_format.left_indent = Cm(1.0)
        run = note.add_run(source)
        run.font.name = BODY
        run.font.size = Pt(8.5)
        run.font.color.rgb = FAINT
        run.italic = True
        note.paragraph_format.space_after = Pt(8)

    doc.add_heading("A note on figures", level=3)
    para(doc,
         "Market sizing has not been commissioned and is not claimed. Cost and timeline "
         "figures are estimates built from the team shape in section 08 at a blended rate "
         "of GBP 550 per person-day. Unit economics in section 09 are a model, not a "
         "measurement, and the churn assumption on which they most depend is named "
         "explicitly as a risk.")

    # ---- 12 approval ----
    doc.add_page_break()
    doc.add_heading("12  Approval", level=1)
    rule(doc)

    para(doc,
         "Approval of this proposal authorises mobilisation and Phase 1. Phases 2 and 3 "
         "are re-confirmed at their respective gates, at which point either party may stop "
         "with no obligation beyond work completed.")

    table(doc, "Signatures", ["Party", "Name", "Signature", "Date"], [
        ["Client", "", "", ""],
        ["Supplier", OWNER, "", ""],
    ], widths=[3.0, 5.0, 5.0, 3.0])

    doc.add_heading("Contact", level=3)
    para(doc, OWNER, bold=True, space_after=2)
    para(doc, EMAIL, space_after=2)
    para(doc, PHONE, space_after=2)

    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output))
    print(f"Written {output} ({output.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/Carnet-Business-Case.docx")
    build(target)
