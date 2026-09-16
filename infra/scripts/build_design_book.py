"""
Builds the design book: docs/Carnet-Design-Book.docx, and a PDF beside it
when Word is installed.

    python infra/scripts/build_design_book.py

Every design in the product, in the order a reader meets them: when it was
made, why, what each part means, and why it works for the people who use
it, with a photograph of each taken from the running application by
design-shots.ts. Regenerate after any screen or brand change; the deck and
the business case are regenerated the same way, so the set stays in step.

The text is written here rather than pulled from the design documents,
because a book reads as a book; the documents remain the source of every
token and rule, and each section says which one to open.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "assets" / "design"
OUT = ROOT / "docs" / "Carnet-Design-Book.docx"

DISPLAY = "Archivo"
BODY = "Public Sans"
MONO = "IBM Plex Mono"
INK = RGBColor(0x1A, 0x20, 0x22)
PETROL = RGBColor(0x1F, 0x61, 0x67)
PETROL_DEEP = RGBColor(0x12, 0x32, 0x36)
BRASS = RGBColor(0x9A, 0x6D, 0x24)
FAINT = RGBColor(0x6B, 0x75, 0x77)

BUILT_ON = "15 September 2026"


# ----------------------------------------------------------------- helpers
def style_document(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = BODY
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.18
    for name, size, colour, before in (
        ("Heading 1", 22, PETROL_DEEP, 18),
        ("Heading 2", 15, PETROL, 14),
        ("Heading 3", 12, INK, 10),
    ):
        style = doc.styles[name]
        style.font.name = DISPLAY
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = colour
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(6)
        style.paragraph_format.keep_with_next = True

    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = section.right_margin = Cm(2.2)
    section.top_margin = section.bottom_margin = Cm(2.0)


def para(doc, text: str, *, size=10.5, colour=INK, bold=False, italic=False, font=BODY,
         align=None, space_after=8, keep=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = font
    run.font.size = Pt(size)
    run.font.color.rgb = colour
    run.bold = bold
    run.italic = italic
    p.paragraph_format.space_after = Pt(space_after)
    if align:
        p.alignment = align
    if keep:
        p.paragraph_format.keep_with_next = True
    return p


def label(doc, text: str):
    return para(doc, text.upper(), size=8.5, colour=BRASS, bold=True, space_after=2, keep=True)


def picture(doc, name: str, caption: str, width_cm: float = 16.4):
    path = SHOTS / f"{name}.png"
    if not path.exists():
        para(doc, f"[missing photograph: {name}.png — run design-shots.ts]", italic=True, colour=FAINT)
        return
    doc.add_picture(str(path), width=Cm(width_cm))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(doc, caption, size=9, colour=FAINT, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)


def rule(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "D9B36C")
    border.append(bottom)
    pPr.append(border)
    p.paragraph_format.space_after = Pt(4)


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def design(doc, *, title: str, when: str, why: str, meaning: list[str], works: str,
           shots: list[tuple[str, str, float]], source: str):
    """One design. Title, when, why it was made, what each part means, why it works, photographs."""
    doc.add_heading(title, level=2)
    para(doc, when, size=9.5, colour=FAINT, italic=True, space_after=6)
    label(doc, "Why it was made")
    para(doc, why)
    label(doc, "What each part means")
    for line in meaning:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(line)
        run.font.name = BODY
        run.font.size = Pt(10.5)
        p.paragraph_format.space_after = Pt(3)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(8)
    label(doc, "Why it works")
    para(doc, works)
    for name, caption, width in shots:
        picture(doc, name, caption, width)
    para(doc, f"Source: {source}", size=8.5, colour=FAINT, space_after=14)
    rule(doc)


# ------------------------------------------------------------------- book
def build() -> None:
    doc = Document()
    style_document(doc)

    # Cover
    for _ in range(6):
        doc.add_paragraph()
    if (SHOTS / "mark.png").exists():
        doc.add_picture(str(SHOTS / "mark.png"), width=Cm(3.2))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(doc, "Carnet", size=34, colour=PETROL_DEEP, bold=True, font=DISPLAY,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "The design book", size=16, colour=BRASS, font=DISPLAY,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)
    para(doc, "Every design in the product: when it was made, why, what each part means, and why it "
              "works for the people who use it. Photographed from the running application.",
         size=11, colour=FAINT, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=40)
    para(doc, f"Built on {BUILT_ON}, after Phase 43.", size=9.5, colour=FAINT,
         align=WD_ALIGN_PARAGRAPH.CENTER)
    page_break(doc)

    # How to read it
    doc.add_heading("How to read this book", level=1)
    para(doc, "Carnet is a workshop management system built around one idea: a vehicle's history should "
              "belong to the car, not to the garage that happened to record it. Every design decision in "
              "the product serves that idea, or serves the three people who use the product on an ordinary "
              "day: the service advisor at the counter, the technician under the car, and the owner or "
              "driver reading their own record on a phone.")
    para(doc, "Each design below is described the same way. When it was made, by phase and date. Why it "
              "was made, meaning the problem it solves. What each part means, because nothing on a "
              "Carnet screen is decoration: every colour, every mark and every figure carries a fact. "
              "And why it works, meaning why this design rather than the obvious one. Under each is a "
              "photograph taken from the application itself, with its seeded demonstration data, so the "
              "picture is the product and not a mock-up of it.")
    para(doc, "The rules behind every design live in the design documents in the repository, and each "
              "section names the one to open. This book is the tour; those are the law.")
    page_break(doc)

    # Contents
    doc.add_heading("Contents", level=1)
    contents = [
        "1. The identity: colour, type, and the rule that colour never carries meaning alone",
        "2. The mark: a passport booklet, on the tab and beside the name",
        "3. The front door and the passport as an object",
        "4. Signing in, signing up, and the region",
        "5. The workshop shell and the dashboard",
        "6. The diary and the floor",
        "7. The job: the central screen",
        "8. The shop floor and the inspection",
        "9. The estimate, approved on a phone",
        "10. The invoice and the money cycle",
        "11. The counter",
        "12. Gift cards",
        "13. The customer: points, referrals and the whole story",
        "14. The vehicle and its passport",
        "15. Passports, listed",
        "16. The portal",
        "17. Reputation, answers, people and the business",
        "18. Dark mode, empty states and the page that is not there",
        "19. What the design refuses to do",
    ]
    for line in contents:
        para(doc, line, space_after=3)
    page_break(doc)

    # 1. Identity
    doc.add_heading("1. The identity", level=1)
    design(
        doc,
        title="Colour drawn from an engine bay",
        when="Phase 1, 9 September 2026, in the design system; refined through Phase 23.",
        why="The product uses red, amber and green constantly: inspection severity, job status, "
            "capacity, the sign of a ledger figure. The brand colour therefore cannot be any of them "
            "and cannot sit next to any of them. Blue collides with the diary's information state, "
            "green with a pass, orange with an advisory and with the incumbent competitor, red with "
            "a critical finding. What is left is petrol, which is dark enough for white text at every "
            "usable tint, distinct from all four, and drawn from the subject.",
        meaning=[
            "Petrol is the brand: primary buttons, links, the active state in the sidebar, the sign-in panel.",
            "Brass is the accent, spent sparingly: the focus ring, section numbering, and the passport's foil. If brass were everywhere it would be nowhere.",
            "The neutrals are a slate scale biased a few degrees toward petrol, so greys read as chosen rather than inherited.",
            "Success, warning, danger and info each have a light and a dark value, and each means one thing in this product: paid, awaiting a customer, a broken chain, in progress.",
        ],
        works="Colour never carries meaning alone. Every status badge has a label; every severity has a glyph as well as a hue. The inspection summary reads as a cross, a mark and a tick with counts, which survives a black-and-white print, a sunlit tablet and a reader who cannot tell the hues apart. The palette is therefore not a mood but a constraint satisfied, and it looks deliberate because it is.",
        shots=[("dashboard", "The workshop dashboard: petrol for the brand, the four semantic colours each doing one job.", 16.4)],
        source="docs/02-design/08-design-system.md, sections 1 to 3",
    )
    design(
        doc,
        title="Three faces, one of them for data",
        when="Phase 1, 9 September 2026; Fraunces added for the passport in Phase 23.",
        why="A workshop interface lives at thirteen pixels in dense tables, and its most important "
            "strings are read character by character: a VIN against the plate on a windscreen, a part "
            "number against a box. A proportional face makes the digit one, the capital I and the lower-case "
            "L ambiguous, and in this product that means merging two vehicles' histories.",
        meaning=[
            "Archivo for display: industrial signage character, slightly condensed so a long vehicle description fits a table heading.",
            "Public Sans for the interface: neutral and legible at thirteen pixels, the size most of the workshop surface is set at.",
            "IBM Plex Mono for data: VINs, registrations, part numbers, job numbers, hashes and every figure in a column.",
            "Fraunces, used nowhere but the passport, so the document keeps a face of its own.",
        ],
        works="Body text is thirteen pixels on the desktop and fifteen on the shop floor and the portal, because a wall-mounted tablet is at arm's length and a phone is read outdoors. Radii are small and elevation is border first, shadow only when something genuinely lifts off the page, so the product looks like an instrument rather than a consumer app.",
        shots=[("job", "The job screen: three faces at work, the data face on every identifier.", 16.4)],
        source="docs/02-design/08-design-system.md, sections 4 and 5",
    )

    # 2. The mark
    doc.add_heading("2. The mark", level=1)
    design(
        doc,
        title="A passport booklet, on the tab and beside the name",
        when="Phase 27, 14 September 2026. The site had no favicon before, and the headers carried a clock.",
        why="A clock said \"time\" about a product whose subject is a record. The passport is the "
            "product's one idea, so the mark is the passport: a booklet with the wheel from its cover. "
            "One drawing serves the favicon, the app icon, the home-screen icon and the mark beside the "
            "name in every header, so a person meets the same shape wherever they meet the product.",
        meaning=[
            "The petrol ground shows against a light tab bar and a dark one.",
            "The booklet is near-black with a darker spine: a cover, not a card.",
            "The wheel is the foil emblem from the passport's cover, drawn heavy enough to survive sixteen pixels.",
            "The two lines at the foot are the machine-readable zone, the part of a passport that a machine checks.",
            "In a header the mark is one colour, so it takes the brand tint on white and the paper tint on petrol.",
        ],
        works="The name beside it stays \"Carnet\", alone. A carnet is a booklet of papers a vehicle carries, so the name already says passport; adding the word would make the wordmark longer and less sure of itself. The tagline says it in plain words where a tagline belongs.",
        shots=[("mark", "The mark as the home screen sees it.", 4.0),
               ("login", "The mark beside the name on the sign-in panel.", 16.4)],
        source="docs/02-design/08-design-system.md, section 12",
    )

    # 3. Front door
    doc.add_heading("3. The front door", level=1)
    design(
        doc,
        title="The passport as an object you can open",
        when="Phase 4.5, 9 September 2026, as a marketing page; the vehicle in three dimensions in Phase 7; the booklet in Phase 23, 12 September 2026.",
        why="Every competitor renders a service history as a list in a card, which is what a history "
            "looks like when it belongs to a database. Carnet's claim is that the history belongs to the "
            "car, so the front door opens with the document a car would carry: a closed passport that "
            "tilts toward the pointer and opens on a press, with the demonstration vehicle turning in its "
            "photograph window and its real record pressed on the page as stamps.",
        meaning=[
            "The cover is petrol deepened to leatherette, with the emblem and the title in brass foil.",
            "Inside, the fields read in a passport's order: type, code, number, then the vehicle.",
            "The chosen entry is pressed on the page as a stamp, inked by how well evidenced it is.",
            "The machine-readable zone runs along the foot and checks, digit for digit, the way a travel document's does.",
        ],
        works="A diagram of a history is a diagram. A passport you can open is the product's argument made physical, and it is the one thing on the page a competitor cannot copy, because they do not have a record that belongs to the car. It is still a page: the button that opens it is a real button, the entries below are real buttons carrying the same text as the stamps, and reduced motion opens the cover without animating.",
        shots=[("home", "The home page: the booklet, closed, tilting toward the pointer.", 16.4)],
        source="docs/02-design/10-passport-design.md, section 2",
    )

    # 4. Sign in
    doc.add_heading("4. Signing in", level=1)
    design(
        doc,
        title="A sign-in that says which system this is",
        when="Phase 1, 9 September 2026; password reset and email confirmation in Phase 15.1.",
        why="A service advisor signing in on a shared machine at the counter should know which system "
            "this is before typing a password. The petrol panel with the mark and the product's pitch is "
            "not decoration; it is the label on the door.",
        meaning=[
            "The petrol panel carries the mark and the name in the paper tint, and the promise in one sentence.",
            "The form is a single column with a real label on every field and a brass focus ring.",
            "The reset and confirmation pages share the same panel, so a person coming back from an email is still in the same building.",
        ],
        works="First-party sessions, a cookie that the browser cannot read, and a token that is stored only as a digest. The design is quiet because the security is not visible and should not need to be.",
        shots=[("login", "Sign in.", 16.4)],
        source="docs/02-design/05-security-model.md, sections 1 to 3",
    )

    design(
        doc,
        title="Signing up, and the region a workshop lives in",
        when="Phase 4.5, 9 September 2026; the country added in Phase 29, 14 September 2026.",
        why="Signing up creates a workshop, not an account, so the form asks for the business first "
            "and the person second. In Phase 29 it asks for the country before either, because a workshop "
            "keeps one set of books in one currency and everything else follows: the currency, the "
            "language and region dates are written in, the clock, and the first tax rate.",
        meaning=[
            "One picker, and four facts written from it. Nothing else in the product has to know a country exists.",
            "The organisation settings page shows all four and lets the owner change them, with the currency carrying the one warning that matters: nothing already recorded is converted.",
            "Every page then formats money and dates from the workshop's region rather than from a default; a driver in the portal sees each amount in the currency it was billed in.",
        ],
        works="A Canadian workshop sees dollars, Canadian dates and GST from the first screen, and a British one is exactly as it was. The rule is that no figure or date reaches a person formatted by a default, and it is written into the design system so a page that forgets is a defect rather than a habit.",
        shots=[("signup", "Sign-up, with the country first.", 16.4),
               ("settings-organisation", "The organisation settings, where the region can be changed.", 16.4)],
        source="docs/02-design/08-design-system.md, section 12.5; packages/core/src/region/countries.ts",
    )

    # 5. Shell and dashboard
    doc.add_heading("5. The workshop shell and the dashboard", level=1)
    design(
        doc,
        title="A sidebar grouped by what somebody is doing",
        when="Phase 1, 9 September 2026; reorganised in Phase 3 and pruned by role in Phase 4.",
        why="With ninety-four pages, a flat list of links is a wall. The sidebar is grouped into Workshop, "
            "Money, Inventory, People and Settings, filtered by the role of the person signed in so a "
            "technician never sees the ledger, and the active item is marked in petrol.",
        meaning=[
            "Each group is a kind of work, not a kind of table.",
            "A thin rule appears under the item you pressed while the next page loads, so the answer to \"did that register?\" is on the thing you pressed.",
            "The organisation and the site are named at the foot, because a person at a group can be at any of them.",
        ],
        works="Nothing in the sidebar is a promise the product cannot keep. The controls crawl reads every page for every role and fails on a link that goes nowhere, so the shell is verified as well as designed.",
        shots=[("dashboard", "The shell around the dashboard.", 16.4)],
        source="docs/02-design/09-wireframes.md, section 1; docs/00-product/09-feature-map.md, section 21",
    )
    design(
        doc,
        title="The dashboard: today, then the money",
        when="Phase 1, 9 September 2026; rebuilt from real figures in Phase 4.9 and Phase 17.",
        why="An owner opening the product in the morning has six questions: what is booked, what is in, "
            "what is waiting on a customer, what is waiting on parts, what is past its promise, and what "
            "was taken. The dashboard answers those in tiles and then shows the floor and the reminders.",
        meaning=[
            "A tile changes colour only when its figure means somebody must act today.",
            "The floor is the bays as they stand, with the car and the technician on each.",
            "The month view is the diary's shape at a glance.",
        ],
        works="Every figure is derived from the records rather than stored, so the dashboard cannot disagree with the pages behind it, and the same figures answer the questions typed at /ask.",
        shots=[("dashboard", "The dashboard.", 16.4)],
        source="docs/02-design/09-wireframes.md, section 2",
    )

    # 6. Diary and floor
    doc.add_heading("6. The diary and the floor", level=1)
    design(
        doc,
        title="A diary with lanes, and cards that move",
        when="Phase 1, 9 September 2026; six views and drag in Phase 8, 10 September 2026.",
        why="A workshop's day is bays and technicians against hours. A calendar that shows appointments "
            "as a list cannot show that bay two is free at eleven. The diary shows lanes by bay and by "
            "technician, in day, week and month, and a booking is a card that can be dragged to another "
            "lane or time, with the diary having the last word on whether it fits.",
        meaning=[
            "The registration on each card is drawn as a plate, recognisable at a glance across a busy day.",
            "A card's colour is the job type, never the status; status is a badge with a word.",
            "Capacity is a bar under each day: hours the site can absorb against hours booked.",
        ],
        works="Drag is a convenience layered over a form that works without it. A keyboard user and a tablet with a dodgy touch screen get the same diary, and every move is written to the job's history with who made it.",
        shots=[("diary", "The diary.", 16.4), ("floor", "The floor: the bays as they stand.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phase 8",
    )

    # 7. Job
    doc.add_heading("7. The job", level=1)
    design(
        doc,
        title="The central screen",
        when="Phase 1, 9 September 2026; the assistant added in Phase 22.",
        why="Every other part of the product exists to feed or consume the job. The screen puts the "
            "customer, the vehicle and the complaint at the top, the lifecycle as a trail, and then labour, "
            "parts, inspection, estimate, invoice and history as sections down the page, so nobody opens "
            "four screens to answer \"where does this job stand?\".",
        meaning=[
            "The progress trail is the state machine drawn: each step is a real transition and an illegal one is refused with the permitted next steps named.",
            "A part line carries its reservation state and a fitment warning if the part does not fit this vehicle.",
            "The assistant's explanation of the job is composed from the record and decides nothing.",
        ],
        works="The job is the aggregate the domain layer defends, and the screen is that aggregate laid out. Nothing on it can be edited into an impossible state, because the transitions are the only way to move it.",
        shots=[("job", "A job in progress, top to bottom.", 16.4)],
        source="docs/02-design/09-wireframes.md, section 3; docs/02-design/04-state-machines.md, section 1",
    )

    # 8. Shop floor and inspection
    doc.add_heading("8. The shop floor and the inspection", level=1)
    design(
        doc,
        title="A tablet for oily hands",
        when="Phase 7, 10 September 2026; offline in Phase 14, 11 September 2026.",
        why="A technician standing in a workshop with oily hands, interrupted every few minutes, cannot "
            "use a desktop interface. The shop floor is a separate surface: fifteen-pixel type, forty-eight "
            "pixel targets, no hover anywhere, and nothing held in the browser that a sleeping tablet could "
            "lose.",
        meaning=[
            "Each inspection item saves the moment it is answered; there is no submit button at the end.",
            "Three large buttons per item: green, amber, red. Amber and red open a reason, and the reason is required, because a red the workshop cannot explain is worse than no inspection.",
            "Nothing is preselected and unchecked items stay unchecked, so a tick never means \"I wanted to leave\".",
            "With no signal, actions queue on the device and replay in order when it returns; a conflict stays on the device with a reason rather than silently winning.",
        ],
        works="The photographs are the trust mechanism: an advisory with a picture is worth more to a customer than a line of text, and the passport carries the same evidence to the next owner. The surface rules are binding, and a hover-dependent control on the floor is treated as a defect.",
        shots=[("shop", "The shop floor: today's jobs and the clock.", 14.0),
               ("inspection", "An inspection in progress.", 14.0)],
        source="docs/02-design/09-wireframes.md, sections 5 and 6; ADR-0012",
    )

    # 9. Estimate approval
    doc.add_heading("9. The estimate, approved on a phone", level=1)
    design(
        doc,
        title="Approval item by item, in under a minute",
        when="Phase 1, 9 September 2026; item-by-item decisions in Phase 5.1, 9 September 2026.",
        why="A customer in a supermarket car park is asked to approve brake work by a link in a text. "
            "They do not have an account and do not want one. The page shows each recommended item with "
            "its photograph, its plain-English meaning and its price, and lets them say yes to some and "
            "no to others.",
        meaning=[
            "Plain language throughout: two millimetres of tread is stated alongside what it means.",
            "Each decision is recorded with the time, the address it came from and the exact total agreed.",
            "The approved items become lines on the job without anybody retyping them.",
        ],
        works="The MVP condition is that this takes under sixty seconds. The page has one task and no navigation, and the approve button is the largest thing on it.",
        shots=[("estimate-approval", "An estimate as the customer sees it.", 7.0)],
        source="docs/02-design/09-wireframes.md, section 7",
    )

    # 10. Invoice
    doc.add_heading("10. The invoice and the money cycle", level=1)
    design(
        doc,
        title="Three forms, not three modals",
        when="Phase 3, 9 September 2026; the full cycle in Phase 16, 12 September 2026; points and gift cards in Phases 24 and 26.",
        why="An issued invoice is immutable. What a person can do is take a payment, raise a credit note, "
            "send money back, take points off, or redeem a gift card, and each is a form on the page that "
            "refuses with a sentence when it would make the figures wrong.",
        meaning=[
            "\"Where it stands\" is invoiced, paid, credited, refunded, outstanding and owed back, each derived.",
            "\"Use their points\" appears only when there is a bill to put them against and points to put.",
            "\"Redeem a gift card\" takes the number and an optional amount; blank means as much as the bill needs.",
            "Every payment posts to the ledger in the same request, so the books and the page never disagree.",
        ],
        works="Refusing rather than clamping is the rule. Quietly using fewer points than somebody asked for produces a bill they did not expect, and they find out at the counter.",
        shots=[("invoice", "An invoice with something owed.", 16.4)],
        source="docs/02-design/07-accounting-model.md, sections 3.3, 3.9, 3.13 and 3.15",
    )

    design(
        doc,
        title="Money held, and a receipt in the hand",
        when="Phase 30, 14 September 2026.",
        why="A workshop takes money before parts are ordered, and sometimes owes a regular customer "
            "twenty pounds they would rather keep on account. Neither is revenue, and both used to be a "
            "flag in the ledger with no screen. Now a deposit is taken on the customer's page, a refund "
            "can be kept as credit, and either goes against the next bill in one press. And every "
            "payment produces a receipt, because a person at a counter is handed paper.",
        meaning=[
            "The Money held card leads with the figure and lists each deposit or credit with what is left on it and a way to give it back, with a reason.",
            "On the invoice, \"Use money held\" takes as much as the bill needs unless an amount is typed, oldest first, refused rather than clamped.",
            "The receipt is one payment on one sheet: who paid, how much, how, for what, and what is still owed. The chrome hides when it prints.",
        ],
        works="Money held is a payment of its own kind when it meets a bill, so the books release the liability and never see the bank twice. What is held is never stored: it is what came in less what went out, and every movement says why.",
        shots=[("receipt", "A receipt, as it prints.", 14.0)],
        source="docs/02-design/07-accounting-model.md, section 3.17",
    )

    design(
        doc,
        title="Where the workshop stands",
        when="Phase 31, 14 September 2026.",
        why="A trial ends, a plan is chosen or not, a workshop cancels. Each of these used to be a "
            "column nobody read. Now there is one page that says where the workshop stands, what its "
            "plan allows and how much of it is used, and it is also where a refused write lands, so the "
            "reason for the refusal is on the screen that can fix it.",
        meaning=[
            "The badge in the header is the state in two words: on trial, trial ended, on a plan, read-only, cancelled.",
            "The left card is the standing: plan, state, days left, and each counted thing as used-of-allowed, with \"any number\" where there is no ceiling.",
            "The right column is the two things that change the state: choose a plan, or cancel. Cancel is bordered in the danger colour and says in its own words that nothing is deleted.",
            "A refused write arrives with a red alert at the top: what could not be saved, and that reading and exporting still work.",
        ],
        works="A plan limit is refused where the thing is made, so the page is a courtesy and never the lock. The state is read from four dates each time, so the page cannot disagree with the guard that turned the write away.",
        shots=[("subscription", "The subscription page, on a plan.", 16.4)],
        source="docs/02-design/05-security-model.md, section 3, and 04-state-machines.md, section 9",
    )

    design(
        doc,
        title="Pay now, and what became of it",
        when="Phase 32, 14 September 2026.",
        why="The portal used to say \"pay the workshop directly\". A customer on their phone at nine in the "
            "evening does not want a sort code; they want a button. The button opens the provider's checkout "
            "for exactly what is owed, and whichever way it goes the customer comes back to the same page "
            "with the outcome in a sentence.",
        meaning=[
            "One filled petrol button per outstanding invoice, full width, with a card icon and the amount inside it: \"Pay £750.00 by card\". Beneath it, a lock and the assurance that the card details never reach the workshop; paying the workshop directly stays possible.",
            "The outcome comes back as an alert at the top: paid and a receipt on its way; declined, with the provider's reason and the assurance that nothing was taken; cancelled; or not yet confirmed.",
            "The workshop's card payments page is every attempt, newest first, with a declined card kept beside its reason rather than vanishing, and a reconcile button that names each difference between the provider and the books.",
        ],
        works="A failed payment is a row with a reason, so the customer and the workshop see the same fact. The provider is a witness and never the record: the payment is recorded once, at the moment the attempt succeeds, and the reconcile page exists because two records can disagree and somebody has to be told.",
        shots=[("portal-invoices", "The portal's invoices, with Pay now.", 7.0), ("card-payments", "Every card payment tried, and the provider's word against the books.", 16.4)],
        source="docs/02-design/04-state-machines.md, section 10; 07-accounting-model.md, section 3.18",
    )

    design(
        doc,
        title="The customer's side, redesigned",
        when="Phase 32.5, 14 September 2026.",
        why="The owner opened the portal on their own phone and found the navigation missing from the "
            "home page, invoices reachable only through a vehicle, a referral code sitting between the "
            "cars and the service history, and a phone layout stretched across a monitor. Each of those "
            "is a small thing; together they made the customer's side feel like an afterthought, and the "
            "customer's side is the passport's audience.",
        meaning=[
            "A fixed tab bar at the bottom of the phone, five tabs with icons, on every page: Home, Passports, Invoices, Updates, Book. On a desktop the same tabs run under the header and the home becomes two columns.",
            "The home leads with Needs you: an estimate to decide, invoices to pay by card, a recall to book, each with its own button. Then the cars as cards with one way in, then recent work.",
            "Rewards are a page: points per workshop and the referral code, with the rule beside it. The home gives them one line in the side column.",
            "A directory of every workshop on Carnet, findable by name or place, with Book here on each; booking at a new one makes the customer its customer.",
        ],
        works="A person who visits twice a year should never have to learn a layout. Everything is one tap away and the first thing on the screen is the thing that needs them, with the button that finishes it.",
        shots=[("portal", "The home, on a phone.", 7.0), ("portal-desktop", "The home, on a desktop.", 16.4), ("portal-rewards", "Rewards, on their own page.", 7.0), ("portal-workshops", "The workshop directory.", 7.0)],
        source="docs/02-design/09-wireframes.md, section 11; 08-design-system.md, section 7",
    )

    design(
        doc,
        title="The charge, said before the card",
        when="Phase 32.6, 14 September 2026.",
        why="The owner asked for a trial that could not be mistaken for a trap: the card first, "
            "fourteen days, and the charge said in plain words everywhere it could be. The design "
            "problem is where to put a sentence nobody wants to read so that everybody reads it.",
        meaning=[
            "On the sign-up form the terms are a box beside the button, not a footnote under it, and the box itself says the plan, the price per bay, the day the card is charged and that cancelling is two presses. The button says what happens next: create the workshop and add a card.",
            "The terms page leads with the same sentence in bold, then cancelling, then what happens when a payment fails, then the data. Seven short sections, no legal register.",
            "The billing page states the next charge as an amount on a date, the card by its last four digits, and the invoices as a table with the provider's PDF. A workshop without a card sees one button and one sentence: nothing is charged until the trial ends.",
        ],
        works="A sentence repeated in the same words in five places is a sentence nobody can claim not to have seen. The reminder three days before, once, is the same sentence with a date and an amount in it.",
        shots=[("signup", "Sign-up, with the terms beside the button.", 16.4), ("terms", "The terms, in plain words.", 12.0), ("subscription", "The billing page: card, next charge, invoices.", 16.4)],
        source="docs/02-design/04-state-machines.md, section 9; 05-security-model.md, section 7.2",
    )

    design(
        doc,
        title="Priced in the workshop's money, and the customer's account",
        when="Phase 32.7, 14 September 2026.",
        why="The owner put it in one sentence: everything in one currency based on the country, not "
            "shown in pounds and billed in another. And a customer looking for settings in the portal "
            "found none.",
        meaning=[
            "The pricing page takes a country and shows every plan in that currency, with the tax named the way that country names it. No second currency appears anywhere on the page.",
            "On the sign-up form, changing the country changes the plan's prices and the sentence beside the terms box in the same breath; they are one component.",
            "The customer's Account page: details the workshops know them by, a password change that asks for the current one, a row per workshop with email and text switches, and sign out. A tab on the desktop, a person icon in the header on a phone.",
        ],
        works="One currency per page removes a whole class of doubt. A price book set by hand, rather than a rate on the day, means the number a workshop saw on Tuesday is the number it is charged on Friday.",
        shots=[("pricing", "The pricing page, in Canadian dollars.", 16.4), ("portal-settings", "The customer's account page.", 7.0)],
        source="docs/00-product/07-business-model.md; 08-design-system.md, section 12.6",
    )

    design(
        doc,
        title="Data in, data out",
        when="Phase 33, 14 September 2026.",
        why="A workshop arriving with five thousand customers in another system, and a workshop leaving "
            "with everything: both are one page, because both are the same promise, that the data is theirs.",
        meaning=[
            "The import card leads: what is in the file, the file, one button. Beneath it, one line per dataset saying what a row becomes.",
            "On the batch page the three steps sit side by side: which column is which, with the first rows shown beside each header; what would go in, with every problem by spreadsheet row and field; then one button naming the count.",
            "The export card is the datasets as a list with a download on each and Everything as the primary, and a sentence saying exports work in every state of the subscription.",
        ],
        works="Problems named by row and field are problems a person can fix in the spreadsheet they already have open. Writing every row through the page's own function means the import cannot do anything the page could not.",
        shots=[("data", "Data in and out.", 16.4)],
        source="docs/02-design/01-domain-model.md, section 3.11; 05-security-model.md, section 7.3",
    )

    design(
        doc,
        title="The workflow, as one thing",
        when="Phase 34, 15 September 2026.",
        why="A workshop does not buy features; it buys the number of presses between a car arriving and the "
            "money being in the bank. This phase counted them, wrote the count down, and then took it from 37 to 20.",
        meaning=[
            "On the booking, one primary button: \"Car is here, start the job\". It opens the job with the customer, the car, the description, the notes and the technician already on it; the two secondary buttons either side are the telephone's other answers.",
            "On the job, \"Customer approved in person\" sits beside \"Send the quote\" for as long as the quote is open, because a yes across the counter is as real as a yes on a phone and must cost one press to record.",
            "Below the labour and parts, a card called Extra work found: what kind, what was found, how many, at what price, which part. Two buttons: \"Quote it now\" sends in the same press; \"Add to the quote, send later\" collects lines. What is on the unsent quote is listed above the form with its own send and approve, so nothing about the extra work leaves this screen.",
            "The five workflows are a table in core with a press count per hand-off, before and now, and the screen it happens on; the design document 02-design/11-workflows.md is generated from it.",
        ],
        works="A hand-off that costs nothing is one the system did on the person's behalf: the approval that puts the lines on the job and reserves the parts. Counting presses in code, with a test that fails if any grow, is what stops a 94-page product from becoming slower than a spreadsheet and a phone.",
        shots=[("job", "The job, with the extra-work card and the counter approval.", 16.4)],
        source="docs/02-design/11-workflows.md; 04-state-machines.md, section 2",
    )

    design(
        doc,
        title="Arrival and departure",
        when="Phase 35, 15 September 2026.",
        why="Most of what a workshop is ever argued with about is settled by what the car was like when it "
            "was handed over and when it was handed back. Those two moments are a record of their own, signed.",
        meaning=[
            "The check-in is one screen filled in with the customer standing there: the mileage off the dash, the fuel as nine buttons in eighths, a walk round the car as twelve places to tick with a note against each, what was left inside, the hook, and a signature pad in the sidebar with one button under it.",
            "Saving makes the record and shows it, with the camera button on it, because a walk round a car is six pictures and they belong to the record, not to a form.",
            "The check-out puts the money before the mileage: what is outstanding, a primary button to take the payment, and a field to say why the car is leaving unpaid if it is. The hand-back button is disabled until the work is marked completed and the page says so in a sentence.",
            "Keys are a sentence on the job and on the technician's card, with the one press each needs: I have them; back on the hook.",
        ],
        works="A signature kept as strokes is a few hundred bytes, redraws at any size and cannot be a pasted picture. Refusing a car that is leaving owing money unless somebody writes down why turns a habit into a record.",
        shots=[("check-in", "Checking a car in.", 16.4)],
        source="docs/02-design/01-domain-model.md, section 3.13; 05-security-model.md, section 7.4",
    )

    design(
        doc,
        title="Conversations",
        when="Phase 36, 15 September 2026.",
        why="A customer does not think in channels. They asked a question; the workshop answered or did not. "
            "Everything said to and by a customer belongs in one place, on the job it is about.",
        meaning=[
            "The list on the left is unread first, a dot and a bold name for what needs reading, the last line as a preview with an arrow for its direction, and the job it is about under the name.",
            "The thread on the right reads oldest to newest, sent on the right in the brand tint and received on the left in a bordered card, each with a one-word state, the channel, the time and who wrote it.",
            "The composer offers only the channels the customer can be reached on, the one they last wrote on first. Templates are chips that fill the box with a sentence; Payment link is a chip in the brand colour.",
            "On the job, the same thread as a card: the last three messages and a reply box, so nobody leaves the job to answer.",
        ],
        works="A thread that is a view over the two message tables rather than a third one keeps the queue and the inbox honest; unread derived from dates rather than a flag cannot drift; refusing a template with a blank is the difference between a workshop's name under a good message and under an embarrassing one.",
        shots=[("conversations", "Conversations, with a thread open.", 16.4)],
        source="docs/02-design/01-domain-model.md, section 3.14; 06-api-contract.md, inbound",
    )

    design(
        doc,
        title="Packages and templates",
        when="Phase 37, 15 September 2026.",
        why="\"Full service\" typed at the counter is a job nobody can pick up without asking. A package is the "
            "same words with the labour, the parts, the checklist, the time and the price already decided.",
        meaning=[
            "The settings page is the list on the left and the editor on the right. Each package is one line: code, name, price with the saving if the fixed price undercuts the lines, hours, how many lines and checks, the kind of work, the interval, whether it is bookable.",
            "The editor is six line rows (kind, description, quantity, each, part number) and six checklist rows, because a package with more than that is two packages. A fixed price is one field; blank means the lines add up.",
            "On the new-job form the package is the first question; choosing one fills the description. On the job, the labour and parts card offers a package and one button. The booking form and the customer's online booking offer the same list.",
        ],
        works="Saved whole, a package is never half of one. Recording which package a job came from is what lets completion say when the next one is due, which is the reminder that brings the customer back.",
        shots=[("packages", "Service packages.", 16.4)],
        source="docs/02-design/01-domain-model.md, section 3.15",
    )

    design(
        doc,
        title="Languages",
        when="Phase 37.5, 15 September 2026.",
        why="A customer in Cairo and a workshop in Lyon should each read Carnet in their own language, "
            "chosen once and kept. Arabic reads right to left, and the page has to follow.",
        meaning=[
            "The switcher is three buttons, the current one filled in the brand colour: EN, FR, AR in the headers, the full names where there is room.",
            "The whole page turns with the language: the root element carries the direction, and a layout built on flex and grid with logical order reads right to left without a second stylesheet.",
            "English is the source of truth. A sentence without a translation is shown in English rather than as a key or a blank, and the coverage script names it.",
        ],
        works="Keeping the English sentence as the key means a page is translated by wrapping what is already there, and the dictionary reads as a list of sentences a person can check.",
        shots=[("portal-ar", "The customer's portal in Arabic, right to left.", 16.4), ("home-fr", "The home page in French.", 16.4)],
        source="docs/02-design/08-design-system.md, section 12.7",
    )

    design(
        doc,
        title="Parts back, work out",
        when="Phase 38, 15 September 2026.",
        why="A faulty part that goes back without a record is a part paid for twice; an alignment bought in and "
            "not written down is work given away. Both belong where the money already is.",
        meaning=[
            "On the order, a card called Send parts back: which part, how many, why, a core charge for a core, a note. One secondary button, because sending parts back is not the order's main business.",
            "The returns page leads with what is waiting on a credit note, each with two forms side by side: the credit note (number, net, tax, and a primary button) and the refusal (the reason, and a secondary one).",
            "On the job, Sublet work lists each piece with its vendor, cost, charge and margin, red when it is sold below cost, and the two presses it needs: the work is back, and book their bill.",
        ],
        works="Taking the cost off the shelf the moment the part leaves, and holding it as a credit due, means stock, the ledger and the supplier's account agree on every day between the part going and the credit arriving.",
        shots=[("returns", "Returns to suppliers.", 16.4)],
        source="docs/02-design/07-accounting-model.md, Returns, cores and sublet",
    )

    design(
        doc,
        title="Finding anything",
        when="Phase 39, 15 September 2026.",
        why="A caller reads out a plate, a number, an invoice. The person at the desk should be looking at the record "
            "before they finish the sentence, from whatever page they are on.",
        meaning=[
            "The box sits at the top of the navigation, under the workshop's name, on every page, with the bell beside it carrying the unread count in red.",
            "An exact identifier opens its record with no page between. A name gives a grid of cards by kind, vehicles and jobs first, with exact matches badged.",
            "Notifications are a single list, unread rows tinted and bold, each with its kind as a small badge and one press to open what it is about.",
        ],
        works="Going straight to the one record saves the press that a list of one would cost, which is most searches at a counter. Telling only the people whose role acts on something keeps the bell worth looking at.",
        shots=[("search", "Search results for a name.", 16.4), ("notifications", "Notifications.", 16.4)],
        source="docs/02-design/05-security-model.md, section 7.5",
    )

    design(
        doc,
        title="The owner's day, sharpened",
        when="Phase 40, 15 September 2026.",
        why="An owner asks four things the product could answer and did not: how much of the work comes back and whose, "
            "whether customers are happier and where, who to ring for a part that has run out, and which supplier has got slower.",
        meaning=[
            "The dashboard reads in three blocks under small headings: today, the business, inventory. Every tile is a figure that opens its list; none is a word.",
            "Comebacks sit on the business report in three columns, by site, by person, and what came back, with the count shown instead of a percentage until ten jobs stand behind it.",
            "Reputation gains a strip of six months, each with its average or a dash and the number of answers, and a list by site and by person with a small badge for improving, falling or steady.",
            "On a part, every supplier sits in one table with small badges for cheapest, quickest and most reliable, and an Order button that is primary when the part is short.",
        ],
        works="Refusing to state a rate or an average on too little keeps the figures fair to the people they name. Laying suppliers side by side, and leaving the choice to the person, fits how parts are really bought: the cheapest is not always the one that arrives by four o'clock.",
        shots=[("dashboard", "The dashboard in three blocks.", 16.4), ("comebacks", "Comebacks on the business report.", 16.4), ("reputation-trend", "How reputation is moving.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phase 40",
    )

    design(
        doc,
        title="Every word translated",
        when="Phase 40.5, 15 September 2026.",
        why="A page that is half English is useless to somebody who reads only French or only Arabic. "
            "The workshop's own screens, and the sentences that refuse something, had stayed in English.",
        meaning=[
            "Nothing about the look changes with the language except the direction: Arabic mirrors the navigation, the tables and the forms from the root element, and French and English read left to right.",
            "Headings, labels, empty states, buttons, badges and page titles all turn. Names, registrations and what staff typed never do.",
            "A refusal keeps its values: the job number, the amount, the date, with the month in the reader's language.",
        ],
        works="English stays the source, so the dictionaries read as sentences a person can check, and the scan that names any text left outside the translator keeps the next page from shipping half translated.",
        shots=[("dashboard-ar", "The dashboard in Arabic.", 16.4), ("job-fr", "The jobs list in French.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phase 40.5",
    )

    design(
        doc,
        title="Tax, configurable",
        when="Phase 41, 15 September 2026.",
        why="One rate per line fitted Britain and nowhere with two taxes, prices with tax in, or customers who pay none. "
            "And a return was added up by hand from invoices.",
        meaning=[
            "A rate's form has three rows of a tax's name and percentage, with a tick for a tax charged on top of the ones before it. Most workshops fill one.",
            "The invoice lists each tax on its own line, with what it was charged on, and prints the exemption certificate or that prices include tax where either applies.",
            "The tax report reads as a return: each tax and rate, what it was charged on, charged, given back and owed, with the period chosen by buttons and a CSV beside them.",
        ],
        works="Keeping what each document declared, rather than recalculating from rates, means a return filed last quarter reads the same next year, whatever the rates have become.",
        shots=[("tax-report", "The report per tax.", 16.4)],
        source="docs/02-design/07-accounting-model.md, Tax, configurable",
    )

    design(
        doc,
        title="Paper",
        when="Phase 42, 15 September 2026.",
        why="A workshop runs on paper as much as screens: the sheet on the bench, the tag on the keys, the label on the shelf, "
            "and the invoice a customer's company wants as a file.",
        meaning=[
            "Each document is one white sheet on a grey desk, with Back, Download PDF and Print above it on screen and nothing but the sheet on paper.",
            "The letterhead runs across the top with the title and number opposite; what the document is about sits in two columns of label and value; tables are ruled lightly, figures aligned to the end.",
            "A document that is not final carries its state across it in large faint red letters. A QR code sits beside what it opens, with the words under it for anyone without a phone.",
            "In Arabic the sheet mirrors; names, plates, addresses and amounts stay in their own direction inside the Arabic text.",
        ],
        works="Rendering the PDF from the printed page means one layout to keep right, in every language, and a file that is always the paper.",
        shots=[("print-work-order", "A work order.", 16.4), ("print-inspection-ar", "An inspection report in Arabic.", 16.4)],
        source="docs/02-design/05-security-model.md, section 7.6",
    )

    design(
        doc,
        title="Providers behind seams",
        when="Phase 43, 15 September 2026.",
        why="A workshop should not type a make off a windscreen, nor every vehicle a part fits, nor "
            "re-key a pay period into payroll software. What answers those questions comes from outside, "
            "so what the screens show is the answer and who gave it.",
        meaning=[
            "Reading a VIN fills the form and says who read it; what it could not tell is left blank, with a line saying to type it from the car.",
            "A fitment row says whether a catalogue or a person put it there, and a fetch reports what was added, held, taken back and left alone.",
            "The payroll page carries the bonuses and deductions under the period they belong to, the overtime multiplier beside the file the workshop hands over, and each file shape described in a line.",
            "The customer's thank-you page, after five out of five, becomes one button to write it on Google.",
        ],
        works="Every seam has an implementation that needs nobody else, so a fresh install answers the same questions with less detail rather than with an error.",
        shots=[("vin-decode", "A VIN read into the form.", 16.4), ("payroll", "Bonuses, deductions and the file.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phase 43",
    )

    design(
        doc,
        title="A car handed to the person who bought it",
        when="Phase 44, 15 September 2026.",
        why="A car is usually sold on a driveway, and the history is worth something only if it "
            "survives that. So the sale is an invitation the buyer accepts rather than a line the "
            "seller types, and what the buyer is shown is the car, never the seller.",
        meaning=[
            "One page, no navigation: the vehicle, its plate, a sentence saying how many owners and how much history, and two buttons.",
            "The figures are counts, not names. Nothing on the page identifies the seller, and nothing the seller sees identifies the buyer beyond the name they typed.",
            "Accepting asks for a login, because a vehicle handed to nobody in particular is a vehicle nobody can be shown to own.",
            "At the workshop the same form does either: record the sale on the workshop's word, or invite the buyer and wait for theirs.",
        ],
        works="Nothing moves until the buyer accepts, so the worst case is an invitation that lapses rather than a car taken off somebody's account by a stranger.",
        shots=[("handover", "What the buyer is shown.", 12.0), ("warranty-cost", "What warranty costs.", 16.4)],
        source="docs/02-design/05-security-model.md, section 7.8",
    )

    # 11. Counter
    doc.add_heading("11. The counter", level=1)
    design(
        doc,
        title="One form, one screen",
        when="Phase 4.7, 9 September 2026.",
        why="Somebody wants a bulb and there are two people behind them. The whole sale is one form: "
            "pick the part, say how it was paid, done. The stock leaves the shelf and the ledger is posted "
            "as part of that one submit, and the money lands in a till session that has to reconcile at "
            "the end of the day.",
        meaning=[
            "Cash can be over-tendered and change is worked out; a card is always the exact amount.",
            "The till's expected drawer is derived from the sales, and closing it asks for the count.",
        ],
        works="There is no draft and no basket, because a counter queue is not a service desk.",
        shots=[("counter", "The counter.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phase 4.7",
    )

    # 12. Gift cards
    doc.add_heading("12. Gift cards", level=1)
    design(
        doc,
        title="A liability that leads the page",
        when="Phase 26, 14 September 2026.",
        why="Two things go wrong with gift cards and both are accounting: the sale is booked as revenue, "
            "which flatters December and starves the month the work is done, or the redemption is booked "
            "as money in and the bank shows the same fifty pounds twice. The page leads with what the "
            "workshop owes as work, because that is what a gift card is.",
        meaning=[
            "The number is twelve characters from an alphabet with nothing that gets misheard, read in groups of four.",
            "The balance is the sum of the card's entries, each naming what it was for.",
            "Sold for whole pounds, paid for with money, never with points or another card.",
        ],
        works="A card redeemed on an invoice releases the liability and never touches the bank; a bill settled with a card still earns points, because the card was paid for with real money.",
        shots=[("gift-cards", "Gift cards.", 16.4)],
        source="docs/02-design/09-wireframes.md, section 10; docs/02-design/07-accounting-model.md, 3.14 and 3.15",
    )

    # 13. Customer
    doc.add_heading("13. The customer", level=1)
    design(
        doc,
        title="One screen for the person on the phone",
        when="Phase 1, 9 September 2026; the whole story in Phase 9; points and referrals in Phases 24 and 25, 13 September 2026.",
        why="A service advisor with a customer on the phone should not have to navigate away. Contact, "
            "vehicles, jobs, invoices, payments, preferences, points, referrals and the whole story are on "
            "one page, newest first.",
        meaning=[
            "The Points card shows the balance as the sum of the entries, what it is worth, what lapses, and a form for the points a rule cannot see coming.",
            "The Referrals card shows the customer's code in large letters because it is said out loud over a counter, who introduced them, and whom they brought in.",
            "\"The whole story\" is every visit, quote, decision and payment as one thread; messages are kept apart because they are matched on an address rather than an id.",
        ],
        works="A certain record and a probable one are never mixed, and every card says its rule beside its figure so nobody promises points on a sign-up.",
        shots=[("customer", "A customer's page.", 16.4)],
        source="docs/02-design/01-domain-model.md, section 3.6",
    )

    # 14. Vehicle and passport
    doc.add_heading("14. The vehicle and its passport", level=1)
    design(
        doc,
        title="The document a car would carry",
        when="Phase 1 as a list; Phase 23, 12 September 2026, as a passport.",
        why="A record that belongs to a car should look like the document a car would carry. The page "
            "is the document: a cover, an identity page with the particulars and a machine-readable "
            "zone, a page of observations, and pages of stamps, one per entry, pressed by whoever "
            "recorded it.",
        meaning=[
            "The seal is the chain verification; it says \"History intact\" under the foil, in words.",
            "The stamp ink is the verification level: petrol for workshop-verified, blue for recorded, brass for self-reported, red for a contradiction or a recall.",
            "The passport number is the chain head, and the zone checks digit for digit as a travel document's does.",
            "A transfer stamp names nobody. No owner is named anywhere on the document.",
            "The paper, ink, cover and foil do not follow dark mode, because a document does not.",
        ],
        works="Every part carries a fact; nothing could be removed without removing information. It is honest about what it does not cover, in the same type as what it does. And it is the same component for the buyer, the owner and the workshop, so nobody can be shown a different story.",
        shots=[("passport", "A vehicle's passport as the next owner will see it.", 16.4),
               ("vehicle", "The vehicle's own page, with the passport as the way in.", 16.4)],
        source="docs/02-design/10-passport-design.md",
    )

    # 15. Passports listed
    doc.add_heading("15. Passports, listed", level=1)
    design(
        doc,
        title="How many are sound, before how many there are",
        when="Phase 27, 14 September 2026.",
        why="A passport per vehicle had existed since the first phase; nobody could see them side by "
            "side. An owner asking how many cars the workshop has written to, and whether every chain "
            "is sound, had to open each one.",
        meaning=[
            "The third tile, chains sound, is the one that matters; it turns red when it is not the same number as the first.",
            "\"From elsewhere\" counts entries other workshops wrote: the network, counted.",
            "The verdict is computed per vehicle on request, never cached, because a stored verdict about a chain would be the one stored fact the design forbids.",
        ],
        works="The rule generalises: when a page has one figure that means somebody must act today, it is the first tile that changes colour, and it changes only when it is non-zero.",
        shots=[("passports", "Passports, listed.", 16.4)],
        source="docs/02-design/09-wireframes.md, section 9; docs/02-design/08-design-system.md, section 13",
    )

    # 16. Portal
    doc.add_heading("16. The portal", level=1)
    design(
        doc,
        title="Plain English, on a phone, in a car park",
        when="Phase 1, 9 September 2026; accounts and claiming a car in Phase 15.1; points, referrals and passports in Phases 24 to 27.",
        why="Maria knows nothing about cars and does not want to. Every status is in plain language, "
            "every figure is explained, and the whole thing works on a phone with one hand.",
        meaning=[
            "Her vehicles are hers, across every workshop that uses Carnet, not one garage's list.",
            "Points and a referral code are shown per workshop, with the rule in the same breath.",
            "Her passports are one card each: whether the record is sound, how much of the car's life is in it, and how to show it to a buyer.",
            "The passport she sees is the document a buyer sees, word for word, so she knows what she is handing over.",
        ],
        works="Forty-four pixel targets, no hover, and no jargon. A portal is judged in a supermarket car park, not in a design review.",
        shots=[("portal", "The portal home.", 7.0), ("portal-passports", "Her passports.", 7.0),
               ("portal-passport", "Her passport, on paper, on a phone.", 7.0)],
        source="docs/02-design/08-design-system.md, section 6",
    )

    # 17. Reputation, answers, people, business
    doc.add_heading("17. Reputation, answers, people and the business", level=1)
    design(
        doc,
        title="Screens that decide nothing",
        when="Phases 12, 15, 16 and 17, 11 to 12 September 2026.",
        why="These pages exist to answer questions from the record: who to ask for a review and who not "
            "to, what the records can say in words, who can do what and where the workshop is one person "
            "deep, and what the business made. None of them changes a record until a person presses the "
            "button that does.",
        meaning=[
            "Reputation routes by the answer: a five is invited to say so publicly; three or less opens a conversation instead.",
            "Ask has a closed vocabulary routed to calculations the product already trusts, with the working shown.",
            "People shows utilisation, efficiency and productivity per person, presented as operations rather than a league table.",
            "The business report is revenue, margin, retention and the parts sold at a loss.",
        ],
        works="Satisfaction is refused below five answers rather than swung by one, and every figure names the calculation behind it.",
        shots=[("reputation", "Reputation.", 16.4), ("ask", "A question answered from the records.", 16.4),
               ("people", "People.", 16.4), ("business", "The business report.", 16.4),
               ("plan", "The day, planned.", 16.4)],
        source="docs/00-product/06-roadmap.md, Phases 12, 15, 16 and 17; ADR-0013",
    )

    # 18. Dark mode, empty, not found
    doc.add_heading("18. Dark mode, empty states, and the page that is not there", level=1)
    design(
        doc,
        title="Both themes designed, nothing waits on a blank screen",
        when="Phase 1, 9 September 2026; the loading car in Phase 4.9; the stranded car in Phase 15.1.",
        why="Dark mode is designed rather than inverted, with brand and accent lightened so contrast "
            "holds both ways. Every list has a bound and every empty page says what to do next. A page "
            "that does not exist shows a car with nowhere to go, drawn in the product's own terms, rather "
            "than an error code.",
        meaning=[
            "Tokens are redefined for dark; no component references a raw colour, so nothing is missed.",
            "The empty-state crawl opens every page with nothing in it and fails on one that does not say what to do.",
            "Where a page cannot render immediately, a car being worked on stands in for a spinner.",
        ],
        works="These are the moments a product is usually caught out, so they are designed and verified like any other screen.",
        shots=[("dashboard-dark", "The dashboard in dark mode.", 16.4), ("not-found", "The page that is not there.", 16.4)],
        source="docs/02-design/08-design-system.md, sections 8 and 9",
    )

    # 19. Refusals
    doc.add_heading("19. What the design refuses to do", level=1)
    para(doc, "Some of the strongest decisions are absences, and a reader of this book should know them.")
    for line in [
        "It never claims more than is true. The passport says \"recorded by a workshop\" or \"recorded with photographic evidence\", because those are different things and a buyer is entitled to weigh them.",
        "It never clamps. A redemption, a payment, a refund or a transition that would make a figure wrong is refused with a sentence that says what to do instead.",
        "It never stores a derived truth. Balances, verdicts, totals and statuses are computed from the entries beneath them, so two screens cannot disagree.",
        "It never names an owner on a shared document, and never shows a price, a margin or a note to anybody the record is not for.",
        "It never lets colour carry meaning alone, and never depends on hover on the shop floor.",
        "It never leaves a button with nothing behind it. A crawl reads every page for every role and fails on one.",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(line)
        run.font.name = BODY
        run.font.size = Pt(10.5)
        p.paragraph_format.space_after = Pt(4)

    doc.add_paragraph()
    para(doc, "Sources. The design system: docs/02-design/08-design-system.md. The passport: "
              "docs/02-design/10-passport-design.md. The wireframes: docs/02-design/09-wireframes.md. "
              "The accounting behind the money screens: docs/02-design/07-accounting-model.md. The phases: "
              "docs/00-product/06-roadmap.md.", size=9.5, colour=FAINT)

    doc.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)}")


def to_pdf() -> None:
    """Word, when present, prints the book to PDF beside it. Quiet when it is not."""
    if sys.platform != "win32":
        return
    pdf = OUT.with_suffix(".pdf")
    script = (
        "$w = New-Object -ComObject Word.Application; $w.Visible = $false; "
        f"$d = $w.Documents.Open('{OUT}'); $d.SaveAs2('{pdf}', 17); $d.Close(); $w.Quit(); 'pdf'"
    )
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True, timeout=180)
        if "pdf" in out.stdout:
            print(f"wrote {pdf.relative_to(ROOT)}")
        else:
            print("Word did not produce a PDF; the .docx is complete on its own.")
    except Exception:  # noqa: BLE001
        print("Word is not available; the .docx is complete on its own.")


if __name__ == "__main__":
    build()
    to_pdf()
