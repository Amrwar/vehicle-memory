"""
Builds the Carnet presentation.

    python infra/scripts/build_deck.py

The deck is generated rather than hand-edited so it cannot drift from the
product the way the coverage map twice did. Figures that appear on slides are
counted from the repository at build time: models from the schema, routes from
the app directory, tests from the suite, requirements from the requirements
document. If a number here is wrong, the fix is in the code, not the slide.

Re-run it whenever something worth presenting changes. The output is
docs/Carnet-Presentation.pptx.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'Carnet-Presentation.pptx'

# The product's own palette, so the deck and the application look like one
# thing. Petrol is the brand, brass is the accent used sparingly.
PETROL_900 = RGBColor(0x12, 0x32, 0x36)
PETROL_700 = RGBColor(0x1A, 0x4D, 0x52)
PETROL_500 = RGBColor(0x2F, 0x7A, 0x80)
PETROL_200 = RGBColor(0xB0, 0xD4, 0xD6)
PETROL_50 = RGBColor(0xEE, 0xF6, 0xF6)
BRASS = RGBColor(0xB8, 0x86, 0x3B)
BRASS_LIGHT = RGBColor(0xD9, 0xB3, 0x6C)
INK = RGBColor(0x16, 0x1A, 0x1B)
SOFT = RGBColor(0x53, 0x5E, 0x60)
FAINT = RGBColor(0x8A, 0x94, 0x96)
PAPER = RGBColor(0xFA, 0xFA, 0xF8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DANGER = RGBColor(0xA8, 0x3A, 0x3A)

DISPLAY = 'Georgia'
BODY = 'Segoe UI'

W = Inches(13.333)
H = Inches(7.5)
MARGIN = Inches(0.9)


# --------------------------------------------------------------------------
# Figures, counted rather than typed
# --------------------------------------------------------------------------


def count_models() -> int:
    schema = (ROOT / 'packages/db/prisma/schema.prisma').read_text(encoding='utf-8')
    return len(re.findall(r'^model ', schema, re.M))


def count_routes() -> int:
    return len(list((ROOT / 'apps/web/src/app').rglob('page.tsx')))


def count_requirements() -> int:
    doc = (ROOT / 'docs/01-requirements/01-functional-requirements.md').read_text(encoding='utf-8')
    return len(set(re.findall(r'^\|\s*(FR-\d+)\s*\|', doc, re.M)))


def count_tests() -> int:
    """Reads the suite's own report. Falls back rather than inventing a number."""
    try:
        result = subprocess.run(
            ['npm', 'run', 'test', '--silent'],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=900,
            shell=True,
        )
        found = re.findall(r'Tests\s+(\d+) passed', result.stdout + result.stderr)
        if found:
            return int(found[-1])
    except Exception:
        pass

    return 0


def count_checks() -> int:
    return len(list((ROOT / 'infra/scripts').glob('verify-*.ts')))


MAP = 'docs/00-product/09-feature-map.md'


def count_feature_lines() -> dict[str, int]:
    """Counts capabilities in the feature map, both forms.

    Some capabilities are rows in a table and some are a bold verdict over a
    paragraph. Counting only the rows undercounts by a third, which is how the
    first version of this deck came to disagree with the document it was built
    from.
    """
    doc = (ROOT / MAP).read_text(encoding='utf-8')

    counts: dict[str, int] = {}

    for status in ('Built', 'Partial', 'Missing', 'Deferred'):
        rows = len(re.findall(rf'^\|[^|\n]+\|\s*{status}\s*\|', doc, re.M))
        prose = len(re.findall(rf'^\*\*{status}[.,]?', doc, re.M))
        counts[status] = rows + prose

    return counts


def sync_feature_map(counts: dict[str, int]) -> None:
    """Writes the counts back into the document they were counted from.

    The alternative is a hand-typed total, and a hand-typed total is what the
    traceability matrix had when it claimed 97% coverage of a table that had
    stopped existing.
    """
    path = ROOT / MAP
    doc = path.read_text(encoding='utf-8')

    table = '\n'.join(
        [
            '| Status  | Capabilities |',
            '| ------- | ------------ |',
            *(
                f'| {status} | {count} |'
                for status, count in counts.items()
                if count > 0
            ),
        ]
    )

    start = doc.index('<!-- counts:start -->')
    end = doc.index('<!-- counts:end -->')

    updated = (
        doc[:start]
        + '<!-- counts:start -->\n'
        + '\n_Counted by `infra/scripts/build_deck.py`. Do not edit by hand._\n\n'
        + table
        + '\n\n'
        + doc[end:]
    )

    path.write_text(updated, encoding='utf-8')


# --------------------------------------------------------------------------
# Drawing helpers
# --------------------------------------------------------------------------


def blank(prs: Presentation):
    return prs.slides.add_slide(prs.slide_layouts[6])


def rect(slide, x, y, w, h, fill, line=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1)
    shape.shadow.inherit = False
    return shape


def text(
    slide,
    body,
    x,
    y,
    w,
    h,
    size=18,
    colour=INK,
    font=BODY,
    bold=False,
    align=PP_ALIGN.LEFT,
    spacing=1.15,
    anchor=MSO_ANCHOR.TOP,
):
    box = slide.shapes.add_textbox(x, y, w, h)
    frame = box.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = anchor
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0

    for index, line in enumerate(body.split('\n')):
        para = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        para.alignment = align
        para.line_spacing = spacing
        run = para.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.color.rgb = colour
        run.font.name = font
        run.font.bold = bold

    return box


def eyebrow(slide, label, y=Inches(0.75)):
    text(slide, label.upper(), MARGIN, y, Inches(8), Inches(0.3), size=11, colour=BRASS, bold=True)


def heading(slide, title, y=Inches(1.15), colour=INK, size=38):
    text(slide, title, MARGIN, y, W - MARGIN * 2, Inches(1.0), size=size, colour=colour, font=DISPLAY, bold=True)


def rule(slide, y, colour=PETROL_200):
    rect(slide, MARGIN, y, W - MARGIN * 2, Pt(1), colour)


def footer(slide, number):
    text(
        slide,
        'Carnet',
        MARGIN,
        H - Inches(0.55),
        Inches(3),
        Inches(0.3),
        size=10,
        colour=FAINT,
    )
    text(
        slide,
        str(number),
        W - MARGIN - Inches(1),
        H - Inches(0.55),
        Inches(1),
        Inches(0.3),
        size=10,
        colour=FAINT,
        align=PP_ALIGN.RIGHT,
    )


def bullets(slide, items, x, y, w, size=16, gap=Inches(0.62), lead_colour=INK):
    """Each item is (lead, rest). The lead is bold; the rest is not."""
    for index, (lead, rest) in enumerate(items):
        top = y + gap * index
        rect(slide, x, top + Inches(0.09), Pt(3), Pt(11), BRASS)

        box = slide.shapes.add_textbox(x + Inches(0.18), top, w - Inches(0.18), gap)
        frame = box.text_frame
        frame.word_wrap = True
        frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = 0

        para = frame.paragraphs[0]
        para.line_spacing = 1.25

        strong = para.add_run()
        strong.text = lead
        strong.font.size = Pt(size)
        strong.font.bold = True
        strong.font.color.rgb = lead_colour
        strong.font.name = BODY

        if rest:
            tail = para.add_run()
            tail.text = '  ' + rest
            tail.font.size = Pt(size)
            tail.font.color.rgb = SOFT
            tail.font.name = BODY


def stat_tiles(slide, tiles, y, height=Inches(1.5)):
    gap = Inches(0.25)
    total = W - MARGIN * 2
    width = int((total - gap * (len(tiles) - 1)) / len(tiles))

    for index, (value, label, note) in enumerate(tiles):
        x = MARGIN + (width + gap) * index
        rect(slide, x, y, width, height, PETROL_50)
        rect(slide, x, y, width, Pt(3), BRASS)

        text(slide, value, x + Inches(0.25), y + Inches(0.26), Emu(width) - Inches(0.5), Inches(0.6),
             size=30, colour=PETROL_900, font=DISPLAY, bold=True)
        text(slide, label, x + Inches(0.25), y + Inches(0.86), Emu(width) - Inches(0.5), Inches(0.3),
             size=12, colour=INK, bold=True)
        text(slide, note, x + Inches(0.25), y + Inches(1.12), Emu(width) - Inches(0.5), Inches(0.3),
             size=10, colour=FAINT)


def flow(slide, steps, y, highlight=None, size=11):
    gap = Inches(0.16)
    total = W - MARGIN * 2
    width = int((total - gap * (len(steps) - 1)) / len(steps))

    for index, step in enumerate(steps):
        x = MARGIN + (width + gap) * index
        chosen = highlight is not None and index in highlight

        rect(slide, x, y, width, Inches(0.72), PETROL_700 if chosen else WHITE,
             None if chosen else PETROL_200)

        text(slide, step, x + Inches(0.1), y + Inches(0.2), Emu(width) - Inches(0.2), Inches(0.4),
             size=size, colour=WHITE if chosen else SOFT, align=PP_ALIGN.CENTER, bold=chosen)


# --------------------------------------------------------------------------
# Slides
# --------------------------------------------------------------------------


def build() -> Path:
    models = count_models()
    routes = count_routes()
    requirements = count_requirements()
    tests = count_tests()
    checks = count_checks()
    coverage = count_feature_lines()
    sync_feature_map(coverage)

    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    page = [0]

    def numbered(slide):
        page[0] += 1
        footer(slide, page[0])

    # --- 1. Title ---------------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PETROL_900)
    rect(slide, 0, 0, Inches(0.13), H, BRASS)

    text(slide, 'CARNET', MARGIN, Inches(2.15), Inches(9), Inches(0.4),
         size=13, colour=BRASS_LIGHT, bold=True)
    text(slide, 'The history belongs\nto the car.', MARGIN, Inches(2.65), Inches(10), Inches(2.0),
         size=52, colour=WHITE, font=DISPLAY, bold=True, spacing=1.05)
    text(slide,
         'Workshop management and ERP, built around a vehicle record that survives\n'
         'the sale, the workshop and the owner.',
         MARGIN, Inches(4.75), Inches(9.5), Inches(1.0), size=17, colour=PETROL_200, spacing=1.35)

    text(slide, 'Amr Hefny   ·   hefnyamr@rocketmail.com   ·   +1 514 553 4360',
         MARGIN, H - Inches(1.1), Inches(9), Inches(0.3), size=12, colour=FAINT)

    # --- 2. The problem ---------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'The problem')
    heading(slide, 'A car outlives every record kept about it')
    rule(slide, Inches(2.15))

    bullets(slide, [
        ('The workshop owns the history.', 'Change garage and it starts again from nothing.'),
        ('The owner sells the car.', 'Everything known about it stays behind, with a business that no longer has any reason to care.'),
        ('The buyer has no way to check.', 'Mileage, work done, parts fitted: all of it is a claim on a sheet of paper.'),
        ('Clocking survives because nobody holds the whole sequence.', 'Each garage sees only its own readings, and its own readings always agree with each other.'),
    ], MARGIN, Inches(2.6), W - MARGIN * 2, size=16, gap=Inches(0.9))

    numbered(slide)

    # --- 3. The thesis ----------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PETROL_900)
    eyebrow(slide, 'The idea')
    heading(slide, 'Key the record to the vehicle, not the workshop', colour=WHITE)
    rule(slide, Inches(2.15), PETROL_700)

    text(slide,
         'Every event is written to a tamper-evident chain against the VIN. The workshop that\n'
         'wrote it cannot alter it afterwards, and neither can we. When the car is sold, the record\n'
         'goes with it.',
         MARGIN, Inches(2.5), Inches(11), Inches(1.4), size=17, colour=PETROL_200, spacing=1.4)

    flow(slide, ['Job completed', 'Event hashed', 'Chained to the last', 'Owner changes',
                 'History transfers', 'Buyer reads it'], Inches(4.3), highlight={4, 5}, size=12)

    text(slide,
         'This is the part a competitor cannot copy by adding a feature. It is a different answer to '
         'the question of who the record is for.',
         MARGIN, Inches(5.5), Inches(11), Inches(0.8), size=14, colour=BRASS_LIGHT, spacing=1.35)

    numbered(slide)

    # --- 4. Three experiences --------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'The shape of the product')
    heading(slide, 'Three connected experiences, one set of records')
    rule(slide, Inches(2.15))

    columns = [
        ('The workshop', PETROL_700,
         ['Technician', 'Job', 'Inspection', 'Parts', 'Repair'],
         'One tablet surface for the floor, with the clock running against the job.'),
        ('The business', BRASS,
         ['Jobs', 'Inventory', 'Purchasing', 'Accounting', 'Profitability'],
         'A double-entry ledger that posts from the work itself, not a monthly export.'),
        ('The customer', PETROL_500,
         ['Booking', 'Inspection', 'Approval', 'Tracking', 'Payment'],
         'No account needed to answer a quote. Most people meet Carnet on a link.'),
    ]

    width = Inches(3.7)
    for index, (title, colour, steps, note) in enumerate(columns):
        x = MARGIN + (width + Inches(0.42)) * index
        rect(slide, x, Inches(2.55), width, Inches(3.6), WHITE, PETROL_200)
        rect(slide, x, Inches(2.55), width, Pt(4), colour)

        text(slide, title, x + Inches(0.3), Inches(2.85), width - Inches(0.6), Inches(0.4),
             size=19, colour=INK, font=DISPLAY, bold=True)

        for step_index, step in enumerate(steps):
            top = Inches(3.42) + Inches(0.34) * step_index
            rect(slide, x + Inches(0.3), top + Inches(0.09), Pt(5), Pt(5), colour)
            text(slide, step, x + Inches(0.52), top, width - Inches(0.8), Inches(0.3),
                 size=13, colour=SOFT)

        text(slide, note, x + Inches(0.3), Inches(5.28), width - Inches(0.6), Inches(0.8),
             size=11, colour=FAINT, spacing=1.3)

    numbered(slide)

    # --- 5. Where it stands ----------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'Where it stands')
    heading(slide, 'Built, and checked')
    rule(slide, Inches(2.15))

    stat_tiles(slide, [
        (str(routes), 'Pages', 'Every one rendered in CI'),
        (str(models), 'Tables', 'One schema, one ledger'),
        (f'{tests:,}' if tests else '—', 'Tests', 'Domain logic, no mocks'),
        (str(checks), 'Database probes', 'Invariants proved, not assumed'),
        (str(requirements), 'Requirements', 'Traced to code and a test'),
    ], Inches(2.55))

    bullets(slide, [
        ('Every phase ships green.', 'Format, lint, types, tests, database invariants, then a production build with every route rendered for every role.'),
        ('The rules live in the database.', 'A ledger entry that does not balance, a rule acting twice inside its cooldown, an edited consent record: all refused by Postgres, not only by code.'),
        ('Empty states and accessibility are checked by script.', 'A workshop on its first morning sees a product that tells it what to do next.'),
    ], MARGIN, Inches(4.5), W - MARGIN * 2, size=14, gap=Inches(0.78))

    numbered(slide)

    # --- 6. Coverage ------------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'Coverage, honestly')
    heading(slide, 'What is built and what is not')
    rule(slide, Inches(2.15))

    total = sum(coverage.values()) or 1
    bar_y = Inches(2.7)
    bar_w = W - MARGIN * 2
    left = MARGIN

    for label, colour in (('Built', PETROL_700), ('Partial', BRASS), ('Missing', RGBColor(0xC9, 0xCF, 0xD0))):
        share = coverage.get(label, 0) / total
        segment = int(bar_w * share)
        rect(slide, left, bar_y, segment, Inches(0.6), colour)

        if segment > Inches(1.1):
            text(slide, f'{label} {coverage.get(label, 0)}', left + Inches(0.2), bar_y + Inches(0.16),
                 Emu(segment) - Inches(0.3), Inches(0.35), size=13,
                 colour=WHITE if label != 'Missing' else SOFT, bold=True)

        left += segment

    text(slide,
         'Counted line by line from the feature map, which is written against the code. '
         'A capability counts as built only when somebody can open a page and do it.',
         MARGIN, Inches(3.55), Inches(11.4), Inches(0.6), size=13, colour=SOFT, spacing=1.35)

    bullets(slide, [
        ('Complete.', 'Jobs, diary, customers, vehicles, the passport, estimates, invoices, payments, inventory, purchasing, the ledger, people, multi-site, counter sales, automation, CRM, the customer portal.'),
        ('Partial, and named.', 'Inspections have six tables and no interface. The calendar has one view of six. Communication goes out but nothing comes back.'),
        ('Absent, and scheduled.', 'Warranty, fleet, reviews, loyalty, the bay board, the command centre. Phases 7 to 12.'),
    ], MARGIN, Inches(4.35), W - MARGIN * 2, size=14, gap=Inches(0.85))

    numbered(slide)

    # --- 7. What makes it different ---------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PETROL_900)
    eyebrow(slide, 'The difference')
    heading(slide, 'Caught by the record, not by a feature', colour=WHITE)
    rule(slide, Inches(2.15), PETROL_700)

    rect(slide, MARGIN, Inches(2.6), W - MARGIN * 2, Inches(2.15), PETROL_700)
    rect(slide, MARGIN, Inches(2.6), Pt(4), Inches(2.15), DANGER)

    text(slide, 'The demonstration vehicle',
         MARGIN + Inches(0.4), Inches(2.85), Inches(11), Inches(0.35),
         size=12, colour=BRASS_LIGHT, bold=True)
    text(slide,
         '67,410 miles, then 62,000, then 74,800.',
         MARGIN + Inches(0.4), Inches(3.2), Inches(11), Inches(0.5),
         size=26, colour=WHITE, font=DISPLAY, bold=True)
    text(slide,
         'Up, down, up. Every recent pair of readings agrees, so a garage comparing its own last two\n'
         'sees nothing wrong. Only something holding the whole sequence, across both workshops, finds it.',
         MARGIN + Inches(0.4), Inches(3.85), Inches(11.2), Inches(0.8),
         size=14, colour=PETROL_200, spacing=1.35)

    bullets(slide, [
        ('Nothing is scored.', 'A number out of ten gets quoted in an advert and cannot carry its reasoning.'),
        ('Certainty is stated.', 'A reading lower than an earlier one is arithmetic. Lower annual mileage before a sale is a question, because it also fits retirement.'),
        ('Silence is not evidence.', 'Gaps are reported as thin history, never as suspicion.'),
    ], MARGIN, Inches(5.15), W - MARGIN * 2, size=13, gap=Inches(0.6), lead_colour=WHITE)

    numbered(slide)

    # --- 8. Pricing --------------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'Business model')
    heading(slide, 'Priced per bay, not per person')
    rule(slide, Inches(2.15))

    text(slide,
         'A bay is what a workshop actually scales by. Charging per user makes a workshop ration '
         'logins, which keeps work off the system and makes the record worse.',
         MARGIN, Inches(2.5), Inches(11.4), Inches(0.7), size=15, colour=SOFT, spacing=1.35)

    plans = [
        ('Core', '£39', 'per bay, per month', ['Jobs and diary', 'Customers and vehicles', 'The passport', 'Invoicing']),
        ('Complete', '£69', 'per bay, per month', ['Everything in Core', 'Inventory and purchasing', 'Full ledger', 'Automation and CRM']),
        ('Group', '£99', 'per bay, per month', ['Everything in Complete', 'Multiple sites', 'Consolidated reporting', 'Stock transfers']),
    ]

    width = Inches(3.7)
    for index, (name, price, unit, features) in enumerate(plans):
        x = MARGIN + (width + Inches(0.42)) * index
        featured = index == 1

        rect(slide, x, Inches(3.35), width, Inches(2.9),
             PETROL_700 if featured else WHITE, None if featured else PETROL_200)

        text(slide, name, x + Inches(0.3), Inches(3.6), width - Inches(0.6), Inches(0.35),
             size=15, colour=BRASS_LIGHT if featured else BRASS, bold=True)
        text(slide, price, x + Inches(0.3), Inches(3.95), width - Inches(0.6), Inches(0.6),
             size=36, colour=WHITE if featured else PETROL_900, font=DISPLAY, bold=True)
        text(slide, unit, x + Inches(0.3), Inches(4.6), width - Inches(0.6), Inches(0.3),
             size=11, colour=PETROL_200 if featured else FAINT)

        for feature_index, feature in enumerate(features):
            top = Inches(5.0) + Inches(0.3) * feature_index
            text(slide, feature, x + Inches(0.3), top, width - Inches(0.6), Inches(0.3),
                 size=12, colour=PETROL_200 if featured else SOFT)

    text(slide, 'Staff accounts are unlimited on every plan. 14-day trial; the card goes on first and is charged only when the trial ends.',
         MARGIN, Inches(6.5), Inches(11), Inches(0.3), size=12, colour=FAINT)

    numbered(slide)

    # --- 9. Roadmap --------------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PAPER)
    eyebrow(slide, 'What happens next')
    heading(slide, 'Ordered by what a workshop loses each day')
    rule(slide, Inches(2.15))

    phases = [
        ('34', 'The workflow, as one thing', 'Built: a booking becomes a job in one press; an approval puts the work on the job and reserves the parts; extra work quoted mid-job; 37 presses down to 20.'),
        ('35', 'Arrival and departure', 'Built: the car checked in and handed back against a signed record of what it was like; keys as events; a car cannot leave owing money without a reason.'),
        ('36', 'Conversations', 'Built: one thread per customer and per job over email, text and WhatsApp, answered from the job; templates as sentences; a payment link in one press.'),
        ('37', 'Packages and templates', 'Built: a package with labour, parts, checklist, time, price and interval; a job from it in one press, at the counter, online or on a job already open.'),
        ('37.5', 'Languages', 'Built: English, French and Arabic, the person\'s choice kept on the account; Arabic right to left; the public site, the portal and the workshop shells.'),
        ('38', 'Parts back, work out', 'Built: returns and cores credited against what the supplier is owed, oldest bill first; sublet work on the job at its real cost.'),
        ('39', 'Finding anything', 'Built: one box for a plate however typed, a VIN, a phone number, a job, an invoice or a part, straight to the record; notifications for staff.'),
    ]

    for index, (number, title, note) in enumerate(phases):
        top = Inches(2.6) + Inches(0.72) * index
        rect(slide, MARGIN, top, Inches(0.52), Inches(0.52), PETROL_700)
        text(slide, number, MARGIN, top + Inches(0.11), Inches(0.52), Inches(0.34),
             size=15, colour=WHITE, align=PP_ALIGN.CENTER, bold=True, font=DISPLAY)

        text(slide, title, MARGIN + Inches(0.75), top + Inches(0.02), Inches(3.6), Inches(0.34),
             size=15, colour=INK, bold=True)
        text(slide, note, MARGIN + Inches(4.45), top + Inches(0.04), Inches(6.9), Inches(0.6),
             size=12, colour=SOFT, spacing=1.25)

    numbered(slide)

    # --- 10. Close ---------------------------------------------------------
    slide = blank(prs)
    rect(slide, 0, 0, W, H, PETROL_900)
    rect(slide, 0, 0, Inches(0.13), H, BRASS)

    text(slide, 'A workshop system that pays for itself twice.',
         MARGIN, Inches(2.5), Inches(10.5), Inches(1.6),
         size=40, colour=WHITE, font=DISPLAY, bold=True, spacing=1.1)

    text(slide,
         'Once by running the business, and again by building a record that becomes\n'
         'more valuable the longer it exists and that no competitor can start from.',
         MARGIN, Inches(4.3), Inches(10.5), Inches(1.0),
         size=17, colour=PETROL_200, spacing=1.4)

    text(slide, 'Amr Hefny   ·   hefnyamr@rocketmail.com   ·   +1 514 553 4360',
         MARGIN, Inches(5.9), Inches(9), Inches(0.3), size=13, colour=BRASS_LIGHT)

    prs.save(OUT)
    return OUT


if __name__ == '__main__':
    path = build()
    print(f'Written {path.relative_to(ROOT)}')
