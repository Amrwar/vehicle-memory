# Design System

Implemented in `packages/ui`. This document explains the choices; the code is
the specification.

## 1. Where the identity comes from

The subject is an engine bay, not a software product. The palette is taken from
it: petrol for the brand, brass for the accent, and a neutral scale biased a
few degrees toward petrol so greys read as chosen rather than inherited.

That is not only taste. It solves a real constraint.

**This product uses red, amber and green constantly** — inspection severity,
job status, capacity, ledger sign. The brand colour therefore cannot be any of
them, and cannot be adjacent to any of them:

| Candidate brand | Why it fails                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Blue or indigo  | Collides with the "info" state, which the diary uses heavily                                                      |
| Green           | Collides with "pass" and "healthy capacity"                                                                       |
| Orange          | Collides with "advisory", and belongs to the incumbent                                                            |
| Red             | Collides with "critical". Obviously                                                                               |
| **Petrol**      | Dark enough for white text at every usable tint, distinct from all four semantic hues, and drawn from the subject |

Brass is spent sparingly: focus rings, the passport, the one thing on a screen
that should be looked at first. If brass is everywhere, it is nowhere.

## 2. Colour

### Brand — petrol

| Token                | Hex       | Use                                      |
| -------------------- | --------- | ---------------------------------------- |
| `--color-petrol-50`  | `#eef6f6` | Active navigation background             |
| `--color-petrol-300` | `#7fb8bc` | Brand colour in dark mode                |
| `--color-petrol-600` | `#1f6167` | **Primary buttons, links, active state** |
| `--color-petrol-700` | `#1a4d52` | Primary hover                            |
| `--color-petrol-900` | `#123236` | Sign-in panel, marketing ground          |

### Accent — brass

| Token               | Hex       | Use                            |
| ------------------- | --------- | ------------------------------ |
| `--color-brass-50`  | `#fbf6ec` | Passport highlight             |
| `--color-brass-500` | `#b8863b` | **Focus ring**                 |
| `--color-brass-600` | `#9a6d24` | Accent text, section numbering |

Focus is brass precisely because it is not a status colour. A focus ring that
looked like "warning" would be read as one.

### Neutrals — petrol-biased slate

`--color-slate-0` `#ffffff` through `--color-slate-950` `#0f1516`. Every step
carries a slight green-blue cast. Set beside a pure grey the difference is
obvious; on its own it simply looks deliberate.

### Semantic

| Role    | Light     | Dark      | Meaning in this product                             |
| ------- | --------- | --------- | --------------------------------------------------- |
| Success | `#2c6e4b` | `#6cbb8c` | Inspection pass, healthy capacity, paid             |
| Warning | `#9a6a12` | `#d9ab55` | Advisory finding, awaiting customer, day full       |
| Danger  | `#973030` | `#e08383` | Critical finding, overdue, chain broken, overbooked |
| Info    | `#1f5f8b` | `#79b4d8` | Booked, in progress, workshop-recorded event        |

### The rule that governs all of it

**Colour never carries meaning alone** (NFR-603). Every status badge has a
label. Every severity has a glyph as well as a hue. The inspection summary
shows `× 2  ! 3  ✓ 5`, which survives being printed in black and white, read on
a sunlit tablet, or seen by someone who cannot distinguish the hues.

## 3. Token layering

Three layers, and components only ever touch the third:

```
  Scale        --color-petrol-600        raw palette
     |
  Semantic     --brand, --danger,        role in the interface
     |         --surface, --text
     |
  Component    bg-(--brand)              usage
```

A theme switch redefines the middle layer only. No component knows what colour
petrol is.

## 4. Typography

| Role      | Face                        | Why                                                                                                   |
| --------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Display   | **Archivo** 600/700         | Industrial signage character. Slightly condensed, so a long vehicle description fits a table heading. |
| Interface | **Public Sans** 400/500/600 | Neutral, highly legible at 13px, which is where this interface lives                                  |
| Data      | **IBM Plex Mono**           | VINs, registrations, part numbers, job numbers, hashes, and every figure in a column                  |

Monospace for data is not an aesthetic preference. A VIN is read character by
character and compared against a plate on a windscreen. A proportional face
makes `1`, `I` and `l` ambiguous, which in this product means merging two
vehicles' histories.

Scale: 10, 11, 12, 13, 15, 17, 19, 22, 28. Body is 13px on the desktop
surfaces and 15px on the shop floor, because a wall-mounted tablet is at arm's
length.

## 5. Space, radius, elevation

Spacing is the Tailwind 4px scale. Radii are deliberately small — 3, 4, 6, 10,
14 — because a workshop tool should look like an instrument, not a consumer
app. Uniformly rounded cards flatten hierarchy.

Elevation is restrained: **border first, shadow only when something genuinely
lifts off the page.** A dialog has a shadow. A card does not.

## 6. Surface characters

One design system, four voices ([ADR-0009](../03-adr/0009-role-segregated-interfaces.md)).

|             | Workshop         | Shop floor       | Portal        | Public passport |
| ----------- | ---------------- | ---------------- | ------------- | --------------- |
| Body size   | 13px             | 15px             | 15px          | 15px            |
| Target size | 32px             | **48px minimum** | 44px          | 44px            |
| Density     | High             | Low              | Low           | Low             |
| Navigation  | Sidebar, grouped | None             | Minimal       | None            |
| Hover       | Used             | **Never**        | Never         | Never           |
| Language    | Trade terms      | Trade terms      | Plain English | Plain English   |

The shop floor rules are binding. `size="touch"` exists on every control for
exactly this reason, and a hover-dependent interaction there is a defect, not a
preference.

## 7. Components

`packages/ui` exports these. Domain components are shared across surfaces so a
passport renders identically wherever it is read — which matters, because a
buyer comparing what the seller showed them against what they see on their own
phone must see the same thing.

**Primitives:** Button (6 variants, 6 sizes), Badge, Card, Input, Textarea,
Select, Field, Alert, EmptyState, PageHeader, Divider.

**Buttons read as buttons before they are read at all.** Every variant has a
pointer cursor (Tailwind 4 removed the browser default), a weight above body
text, a visible focus ring, and a one-pixel press. Primary is the filled
petrol with a lifting shadow, and there is one per screen, for the thing the
screen is for: "Pay by card", "Complete the job", "Choose a plan". Secondary
sits raised on the page with a border and a soft shadow, so it is never
mistaken for the input beside it, which is sunk and flat. Danger is filled red
and used only where money or a record leaves. A button that takes money says
the amount inside it, on its own line, full width on a phone, with the
assurance beneath it rather than inside it (Phase 32).

**Data:** Table with sticky headers, StatTile, StatRow, KeyValue,
UtilisationBar, TabStrip.

**Domain:** Vin, Registration, Money, Mileage, SeverityBadge, SeveritySummary,
ProgressTrail, VerificationBadge, TimelineEntry, ChainFingerprint.

Two worth calling out:

**`Registration`** draws a number plate as a plate. Across a busy diary it is
recognisable at a glance in a way that plain text is not.

**`ChainFingerprint`** shows `Chain E5A9-A764` with a pass or fail mark, so two
people can compare a vehicle's history over the phone without reading 64 hex
characters to each other.

**The customer's side (Phase 32.5).** The portal is an app on a phone
before it is a website: a fixed five-tab bar at the bottom (Home,
Passports, Invoices, Updates, Book), each with an icon, on every page, and
the same tabs under the header on a desktop, where the home widens to two
columns. The home leads with "Needs you", each item carrying its own
button. Cars are cards with one way in. Rewards and the workshop directory
are pages, not sections.

## 8. Dark mode

Full support, both themes designed rather than one inverted. Tokens are
redefined under `.dark` and `[data-theme="dark"]`; no component references a
raw colour. Brand and accent are lightened for a dark ground so contrast holds
in both directions.

## 9. Accessibility

WCAG 2.2 AA across all four surfaces (NFR-601).

- Contrast: 4.5:1 body, 3:1 large text and UI boundaries.
- Focus is always visible, brass, 2px, with 2px offset.
- Every interactive element is keyboard reachable and operable.
- Status is never colour alone.
- Touch targets: 48px on the shop floor, 44px on the portal.
- `prefers-reduced-motion` disables all animation.
- Text direction is not hard-coded; the system supports right-to-left.
- A skip link precedes the navigation on every page.

## 10. Writing

The words are design material.

- Name things as a person recognises them. A "job", not a "work order record".
- Active voice on controls. "Send estimate", then a confirmation that says
  "Estimate sent".
- Errors say what went wrong and what to do. "A job cannot move from Draft to
  Invoice. Permitted next steps: Booked, Vehicle received, Cancelled."
- Plain language on the portal and the public passport. Maria does not know
  what 2mm of tread means, so the measurement is stated alongside what it
  means.
- Never claim more than is true. The passport says "recorded by a workshop"
  or "recorded with photographic evidence", because those are different
  things and a buyer is entitled to weigh them differently.

## 11. The passport

The passport pages have their own paper, ink, cover and foil, defined once and
not redefined for dark mode, and their own face, Fraunces, used nowhere else.
Every choice and the fact it carries is in [The passport, designed](10-passport-design.md).

## 12. The mark

One drawing, everywhere: a passport booklet with the wheel from its cover.
It is the favicon, the app icon, the home-screen icon and the mark beside
the name in every header. Before Phase 27 the tab had no icon at all and the
headers carried a clock, which said "time" about a product whose subject is
a record.

Drawn to survive sixteen pixels. On the tab it sits on a petrol ground so it
shows against a light tab bar and a dark one; the booklet is near-black, the
wheel is a heavy foil stroke, and the laurel from the passport cover is left
off because at that size it turned to fog. In a header it is one colour,
`currentColor`, so it takes the brand tint on white and the paper tint on
petrol. The name beside it is "Carnet", alone: a carnet is a booklet of
papers a vehicle carries, so the name already says passport, and the tagline
says it in plain words where a tagline belongs.

## 12.5 Money and dates follow the workshop (Phase 29)

Nothing in the interface writes a currency symbol or a date format itself.
The `Money` and `Mileage` components take a currency and a locale, the pages
pass the session's region, and the three shared components that render for
a customer or a buyer take a locale from whoever is reading. A page that
forgets is not wrong in Britain, which is why the rule is written here.

### 12.6 The plan in the workshop's currency (Phase 32.7)

A price is shown in exactly one currency on any page: the workshop's, or on
the public pricing page the currency of the country picked. Never a pound
figure beside a dollar one, never a conversion. The sign-up form's country,
plan and terms sentence are one component so they cannot disagree.

### 12.7 Languages and direction (Phase 37.5)

Every sentence on a translated page goes through `t()`, with the English
sentence as the key. The root element carries `lang` and `dir`; Arabic is
`dir="rtl"`, and the layout follows because it is built on flex and grid
with logical order, not on absolute positions. The switcher is three small
buttons, the current one filled in the brand colour, in the header of the
public site and the portal and at the foot of the workshop navigation. A
sentence without a translation is shown in English rather than as a key:
half a page in another language is worse than a page in English.

## 13. Lists that lead with the fault

The passports list (Phase 27) leads with how many chains are sound rather
than how many passports there are, and the gift cards page (Phase 26) leads
with what the workshop owes rather than what it has sold. The rule: when a
page has one figure that means somebody must act today, it is the first tile
that changes colour, and it changes colour only when it is non-zero.

## 14. Two rules that only work as minimums (Phase 55)

Both were written earlier, both did nothing, and both did nothing silently
until every screen was measured for the first time.

**A control's size is a minimum, never a size.** The stylesheet has held, since
Phase 46.5, that on a screen driven by a thumb a tick box is twenty-four pixels
through the middle. It set `block-size`, which is the same property as the
`height` a utility class sets — and a utility wins over the base layer whatever
its specificity, so every `h-4 w-4` in the product went on being sixteen pixels
and the rule reached nothing. As `min-block-size` it reaches everything at
once, because a minimum and a height are different properties and the minimum
wins. The same reasoning already made the forty-pixel rule for buttons work;
it was the tick boxes that were written the other way.

**A box inside a grid or a flex row needs `min-w-0`, not only `w-full`.** They
are different promises. A box's intrinsic width — twenty characters, whatever
the browser decides that is — is its minimum content width, and a track sized
by its content takes that minimum rather than the width asked for. So a
full-width field inside a narrow column pushed the whole page sideways while
claiming to be exactly as wide as its parent. `Input`, `Textarea`, `Select` and
`Field` all carry it now, which fixed three of the four pages that overflowed
on a telephone.

The fourth was not a component but a layout: five fixed columns in the packages
form came to 392 pixels, and because a grid track is as wide as its widest
item, every other row of that form became 392 pixels too. On a phone it is two
columns with the description across both.

---

_Next: [Wireframes](09-wireframes.md)._
