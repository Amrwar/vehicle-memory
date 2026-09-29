/**
 * An equivalent part, and what makes it equivalent.
 *
 * Every workshop substitutes. The disc the job was quoted on is out of stock
 * and the car is on the ramp, so somebody fits the other brand, and the whole
 * question is what they knew when they did it. The bad version of this feature
 * is a list of parts with similar names and a percentage beside each. The
 * percentage is invented, and inventing one is how the wrong pads get fitted
 * to a car whose owner is braking.
 *
 * So there is no score here, on purpose. **The confidence is the evidence** —
 * facts already in the workshop's own records, each stated as a sentence a
 * person can check.
 *
 * ## The distinction the first draft got wrong
 *
 * The first version of this file treated any of six facts as reason enough to
 * offer a part. The screen then offered a brake *disc* as an alternative to
 * brake *pads*: both are in the braking category, both fit the car, and the
 * rule could not tell "suits this vehicle" from "does the same job". That is
 * the precise failure the design existed to prevent, shipped by the design.
 *
 * **Fitting the same car is not a claim that two parts interchange.** Only two
 * records make that claim:
 *
 *   - somebody here has already fitted this one in place of that one, and
 *     confirmed it;
 *   - a supplier lists both of them under one number.
 *
 * Those two **qualify** a candidate. Everything else — we fitted it to this
 * car, to this model, somebody typed a fitment, a catalogue agrees — is
 * **corroboration**: worth showing beside a candidate that already qualifies,
 * never a reason to list one.
 *
 * The first is deliberately the strongest, and it is how the list grows. A
 * workshop that confirms one substitution has taught the product something
 * permanent about those two parts, the same way Phase 81's diagnosis corpus is
 * built out of verdicts technicians were making anyway.
 *
 * And nothing here applies a substitution. `needsConfirmation` is a constant
 * and it is `true`: a person confirms, the record says who and on what
 * evidence, and the customer's invoice can be read back to them years later.
 *
 * Phase 87.
 */

/**
 * Why a part is believed to be an equivalent, strongest first.
 *
 * The order is not arbitrary. Our own confirmed swap outranks a supplier's
 * cross-reference because somebody here stood over it with the car present;
 * the supplier's number outranks every corroboration because it is the only
 * other record that says *these two parts are the same thing* rather than
 * *this part suits that car*.
 *
 * `SAME_PART_NUMBER` means a *supplier's* number, and the distinction is not
 * pedantry: a workshop's own catalogue cannot hold two products under one part
 * number -- `products` is unique on (org, number) -- so read the obvious way
 * this rule could never fire at all. Read the useful way it is one of the
 * better signals there is: a factor listing the OE disc and the aftermarket
 * disc under one line is a factor saying they interchange, with their money
 * behind it.
 */
export const EVIDENCE_ORDER = [
  'SUBSTITUTED_BEFORE',
  'SAME_PART_NUMBER',
  'FITTED_TO_THIS_CAR',
  'FITTED_TO_THIS_MODEL',
  'RECORDED_HERE',
  'CATALOGUE',
] as const;

export type FitEvidence = (typeof EVIDENCE_ORDER)[number];

/**
 * The evidence that says two parts are the same thing.
 *
 * Nothing outside this list may put a part on the screen, however much else is
 * true about it. A brake disc that fits the car, that we have fitted to the
 * car, and that a catalogue vouches for is still not an alternative to a set
 * of brake pads.
 */
export const QUALIFYING: readonly FitEvidence[] = ['SUBSTITUTED_BEFORE', 'SAME_PART_NUMBER'];

export function qualifies(evidence: readonly FitEvidence[]): boolean {
  return evidence.some((one) => QUALIFYING.includes(one));
}

/** What the screen says, as a sentence and never as a number. */
export const EVIDENCE_SENTENCE: Record<FitEvidence, string> = {
  SUBSTITUTED_BEFORE: 'We have fitted this in place of it before',
  SAME_PART_NUMBER: 'A supplier lists both under one number',
  FITTED_TO_THIS_CAR: 'We fitted this to this car before',
  FITTED_TO_THIS_MODEL: 'We fitted this to the same model before',
  RECORDED_HERE: 'Somebody here recorded that it fits',
  CATALOGUE: 'A catalogue says it fits',
};

export interface Substitute {
  productId: string;
  partNumber: string;
  name: string;
  brand: string | null;
  /** Everything true about it. Without a qualifying kind it is not shown. */
  evidence: readonly FitEvidence[];
  /** On our own shelf now, across every warehouse. */
  inStock: number;
  /** What we would pay for it. Null where nobody has priced it. */
  cost: number | null;
}

export interface RankedSubstitute extends Substitute {
  /** The qualifying evidence: why it is on the screen at all. */
  strongest: FitEvidence;
  /** What else is true about it, strongest first. Shown beside, never alone. */
  corroboration: FitEvidence[];
}

function rank(evidence: FitEvidence): number {
  return EVIDENCE_ORDER.indexOf(evidence);
}

/** The strongest evidence in a set, or null when there is none. */
export function strongestEvidence(evidence: readonly FitEvidence[]): FitEvidence | null {
  if (evidence.length === 0) return null;
  return [...evidence].sort((a, b) => rank(a) - rank(b))[0]!;
}

/**
 * The candidates worth putting in front of somebody, best evidence first.
 *
 * Anything without a qualifying kind is dropped rather than ranked last. Stock
 * breaks a tie, because the reason anybody is on this screen is that the first
 * choice was not on the shelf.
 */
export function rankSubstitutes(candidates: readonly Substitute[]): RankedSubstitute[] {
  return candidates
    .flatMap<RankedSubstitute>((candidate) => {
      const strongest = strongestEvidence(
        candidate.evidence.filter((one) => QUALIFYING.includes(one)),
      );
      if (!strongest) return [];
      return [
        {
          ...candidate,
          strongest,
          corroboration: [...candidate.evidence]
            .filter((one) => one !== strongest)
            .sort((a, b) => rank(a) - rank(b)),
        },
      ];
    })
    .sort(
      (a, b) =>
        rank(a.strongest) - rank(b.strongest) ||
        b.corroboration.length - a.corroboration.length ||
        (b.inStock > 0 ? 1 : 0) - (a.inStock > 0 ? 1 : 0) ||
        (a.cost ?? Number.MAX_SAFE_INTEGER) - (b.cost ?? Number.MAX_SAFE_INTEGER) ||
        a.partNumber.localeCompare(b.partNumber),
    );
}

/**
 * Never false.
 *
 * Stated as a constant so that it is a thing the codebase says rather than a
 * thing the codebase happens to do, and so a check can point at it. The
 * system does not substitute parts. It shows what it knows and a person
 * decides, because a person is who the customer will ask.
 */
export const needsConfirmation = true as const;

/** The sentence that goes on the job, the invoice and the passport. */
export function substitutionSentence(input: {
  original: string;
  fitted: string;
  evidence: FitEvidence;
}): string {
  return `${input.fitted} fitted in place of ${input.original} — ${EVIDENCE_SENTENCE[input.evidence].toLowerCase()}`;
}
