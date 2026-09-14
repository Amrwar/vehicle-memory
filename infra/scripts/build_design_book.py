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

BUILT_ON = "14 September 2026"


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
    para(doc, f"Built on {BUILT_ON}, after Phase 32.5.", size=9.5, colour=FAINT,
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
