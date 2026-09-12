# The passport, designed

Phase 23. What the passport looks like, why each choice was made, and why the
choices make the product more attractive and more credible to the three
people who read it: a buyer standing in a driveway, an owner about to share
it, and a workshop asking what the next owner will see.

This document is the design rationale. The [design system](08-design-system.md)
remains the source for the rest of the interface; the passport extends it
rather than replacing it.

---

## 1. The idea, and why it is the right one

Carnet's claim is that a vehicle's history should belong to the car. Every
competitor renders a service history as a list in a card, which is what a
history looks like when it belongs to a database. A record that belongs to a
car should look like the document a car would carry: a passport.

That is not a metaphor sprinkled over the old page. The page _is_ the
document. It has a cover, an identity page with the vehicle's particulars and
a machine-readable zone, a page of observations, and pages of stamps, one per
entry, pressed by whoever recorded it. Somebody who has never used Carnet
recognises it in a second, which is the whole test of a metaphor: it explains
the product before a word is read.

Three things make it credible rather than cute:

- **Every part carries a fact.** The seal is the chain verification. The stamp
  ink is the verification level. The passport number is the chain head. The
  machine-readable zone checks, digit for digit, the way a travel document's
  does. Nothing on the page is decoration that could be removed without
  removing information.
- **It is honest about what it is not.** The observations page says what the
  record does not cover, in the same type as what it does. A document that
  only ever said good things would be a brochure.
- **It is the same document for everybody.** Buyer, owner and workshop see the
  same component, so nobody can be shown a different story.

## 2. The object: a booklet on the home page

The home page opens with a closed passport that tilts toward the pointer and
opens on a press. Inside, the vehicle turns in the photograph window (the
three-dimensional scene the page already had, now inside the page it belongs
to), the fields read as a passport reads, the chosen entry is pressed on the
page as a stamp, and the machine-readable zone runs along the foot.

Why an object rather than a diagram: a diagram of a history is a diagram; a
passport you can open is the product's argument made physical, and it is the
one thing on the page a competitor cannot screenshot and copy, because they do
not have a record that belongs to the car.

Why it is still a page: the button that opens it is a real button; the four
entries below it are real buttons carrying the same text as the stamps; a
person on a keyboard, a screen reader, or a phone with no WebGL gets the whole
story. Reduced motion stops the tilt and opens the cover without animating.
The cover, once open, settles out of the way so the column belongs to the
page rather than to the hinge.

## 3. Colour

A passport is a physical object, and a physical object does not change colour
with the operating system. The paper, ink, cover and foil are defined once and
are deliberately not redefined for dark mode; the chrome around the document
follows the theme, the document does not. This is stated in the stylesheet so
nobody "fixes" it later.

| Token                       | Value      | Why                                                                                     |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `--passport-cover`          | `#0f2a2e`  | The brand's petrol, deepened to leatherette. Unmistakably Carnet, unmistakably a cover. |
| `--passport-foil`           | `#d9b36c`  | Brass, the product's accent, used as foil: the one place it is allowed to shine.        |
| `--passport-paper`          | `#f4f0e6`  | Paper with a slight warmth. Not the generic cream of a template: it sits between the    |
|                             |            | brand's petrol-biased neutrals and the brass, so the two inks read on it.               |
| `--passport-ink`            | `#1a2022`  | The product's darkest slate. Ink, not black: black on cream looks photocopied.          |
| `--passport-guilloche`      | petrol 16% | The security pattern behind every page, drawn from the brand colour at low opacity.     |
| `--passport-stamp-verified` | `#1f6167`  | Petrol. Workshop-verified entries are stamped in the brand's own ink.                   |
| `--passport-stamp-recorded` | `#1f5f8b`  | Info blue. Recorded but not photographed: still a workshop, less evidenced.             |
| `--passport-stamp-owner`    | `#8a5f1d`  | Brass. Self-reported, registry and manufacturer entries: not a workshop's word.         |
| `--passport-stamp-alert`    | `#973030`  | Red. A mileage reading on a record that contradicts itself, and an outstanding recall.  |

The rule from the design system holds: colour never carries meaning alone.
Every stamp says its kind in words; the seal says "History intact" under the
foil; a cancelled stamp is overprinted CANCELLED as well as greyed.

Inside a page, the interface's own tokens (`--surface`, `--text`, `--danger`)
are re-pointed at the paper and the inks, so any existing component placed on
a page, such as the mileage findings, renders in the document's colours
without being rewritten.

## 4. Type

| Role                    | Face                             | Why                                                                                                                                        |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cover, headings, stamps | **Fraunces** 500/600, small caps | A document serif with the engraved character of a passport's cover. Used nowhere else in the product, so it belongs to the passport alone. |
| Fields and the zone     | **IBM Plex Mono**                | Already the product's data face. In the machine-readable zone it stands in for OCR-B, letter-spaced and upper case.                        |
| Labels and body         | **Public Sans**                  | The interface face, small and tracked for labels, so the page is still the same product.                                                   |

Fraunces is loaded through the build like the other faces, so it is
self-hosted and needs no font host in the content security policy.

## 5. Layout

- **The cover** is a band above the pages on the reading views and a closed
  booklet on the home page. Foil emblem, foil title, the registration in foil
  at the foot. The emblem is a wheel in a laurel over a road: the product's
  own device, drawn in code, not a stock crest.
- **The identity page** puts the photograph window and the seal on the left,
  the particulars on the right, and the machine-readable zone across the foot.
  Fields follow a passport's order: type, code, number, then the vehicle.
- **Observations** is the report the product already produced, set as
  endorsements: what the record amounts to, what it does not cover, what a
  buyer will ask, who has owned it (never by name), and an outstanding recall
  as a red stamp.
- **Mileage** is the existing findings component on paper.
- **Entries** are pages by year, numbered, with a stamp per entry. Each stamp
  is tilted by a value derived from the entry's id, so the page looks pressed
  by hand and renders identically every time.

Every page carries a number in the corner and a perforated inner margin; both
are structure, not ornament: they say this is one bound document.

## 6. What is withheld, and why that is design

A transfer stamp says "Ownership transferred" and nothing else, even though the
entry's own summary names both parties. No owner is named anywhere on the
document. This was found by looking at the page as a buyer would, and it is the
kind of correction a design pass exists to make: the previous page showed the
names.

## 7. The way back

The passport is reached by link. The header now carries a way back that uses
the browser's history when the reader came from this site and the front door
otherwise, so a visitor from the home page's demonstration is never stranded.

## 8. Where it is used

| Reader   | Page                             | Difference                                                                                                |
| -------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Buyer    | `/p/{token}`                     | Reached by a share link. Footer says the visit is logged.                                                 |
| Owner    | `/portal/vehicles/{id}/passport` | The same document; the observations speak to the owner. The vehicle page carries the cover as the way in. |
| Workshop | `/vehicles/{id}/passport`        | "As the next owner will see it", from the vehicle's page.                                                 |
| Anybody  | `/`                              | The booklet, with the demonstration vehicle's real record.                                                |

## 9. What was checked

The controls crawl reads every page and fails on a button with nothing behind
it; the booklet's controls declare their state and are recognised as live.
The accessibility crawl checks labels, names and landmarks on every page. The
headers probe checks the content security policy, which the new face and the
three-dimensional scene both respect. The machine-readable zone has unit
tests, including the specification's own check-digit example. The pages were
reviewed in a browser at desktop width, open and closed, light chrome and
dark.

## 10. What would make it better still

- A photograph of the actual vehicle in the window, once a workshop has taken
  one; the paperwork phase already stores photographs, and the first of kind
  PHOTO could stand in.
- A page-turn between years on a touch screen, which is a pleasure but not
  information, and so waits.
- Print. The document is built to survive black and white; a print stylesheet
  that drops the chrome would make the passport something a buyer can carry.
