/**
 * What was scanned.
 *
 * A workshop with a barcode scanner does not want seven kinds of label. It
 * wants to point the thing at whatever is in front of it -- a key tag, a shelf
 * edge, a windscreen, a printed job sheet -- and land on the right record.
 *
 * ## The failure worth designing against
 *
 * Not a scan that fails. A scan that **succeeds at the wrong record**.
 *
 * `10482` is a plausible job number, a plausible part number and a plausible
 * bin. A resolver that tries each in turn and takes the first hit will, one
 * day, book a part out against a job that is not the one on the ramp -- and it
 * will do it silently, because from the outside a right answer and a wrong
 * answer look identical. This is the same argument as everywhere else in this
 * product: a confident wrong answer is worse than no answer, and the way out
 * is to refuse rather than to guess.
 *
 * So two things.
 *
 * **Everything Carnet prints carries a namespaced code.** `CNT:job:cku9…` is
 * unambiguous by construction, and a scan of one can never be anything else.
 *
 * **Anything else is looked up, and an ambiguous result is a refusal.** A
 * workshop will scan a supplier's own barcode on a box, or type a registration
 * into the same field. Those are worth resolving. But if `10482` matches both
 * a job and a part, the answer is "that matches two things, which did you
 * mean" -- never the first one found.
 *
 * Phase 92.
 */

/**
 * The things a code can point at.
 *
 * The passport is not among them, and the reason is worth writing down: a
 * `PassportShare` stores only the *hash* of its token, so the product cannot
 * look a passport up from a scanned token even if it wanted to -- and it
 * should not want to, because being unable to enumerate them is half of what
 * makes a shared link safe to hand out. The passport's label carries a URL
 * instead, which a phone camera opens without anything here being involved.
 */
export const SCAN_KINDS = ['vehicle', 'job', 'part', 'bin', 'inspection', 'equipment'] as const;

export type ScanKind = (typeof SCAN_KINDS)[number];

/** The prefix, short enough for a small label and long enough to be ours. */
export const SCAN_PREFIX = 'CNT';

const SEPARATOR = ':';

/**
 * The code that goes on a label.
 *
 * Kept deliberately readable. Somebody holding a key tag whose QR will not
 * scan -- a crease, a thumbprint, a dead scanner -- can read `CNT:job:cku9x2…`
 * off the label and type the tail into the search box. An opaque hash would
 * have been shorter and would have left that person with nothing.
 */
export function scanCode(kind: ScanKind, id: string): string {
  return [SCAN_PREFIX, kind, id].join(SEPARATOR);
}

export interface ParsedScan {
  kind: ScanKind;
  id: string;
}

/**
 * A code of ours, read back. Null for anything that is not one.
 *
 * Case-insensitive on the prefix and the kind, because a scanner configured
 * for upper case is a scanner somebody will eventually use, and the id is left
 * exactly as it was because a cuid is case-sensitive.
 */
export function parseScanCode(text: string): ParsedScan | null {
  const trimmed = text.trim();
  const parts = trimmed.split(SEPARATOR);
  if (parts.length < 3) return null;

  const [prefix, kind, ...rest] = parts;
  if (prefix?.toUpperCase() !== SCAN_PREFIX) return null;

  const found = SCAN_KINDS.find((one) => one === kind?.toLowerCase());
  if (!found) return null;

  // Rejoined, because nothing stops an id containing the separator later and
  // a code that silently truncated one would resolve to the wrong record.
  const id = rest.join(SEPARATOR).trim();
  return id ? { kind: found, id } : null;
}

/**
 * The one code a person outside the workshop points a camera at.
 *
 * A URL rather than a `CNT:` code, because a phone camera opens a URL and
 * understands nothing else -- and the passport already has a public address
 * built to be opened by a stranger.
 *
 * Nothing else gets one. A key tag carrying a URL would be a key tag that
 * hands whoever picks it up a way into somebody's job, which is why every
 * other label carries an internal code that means nothing off the premises.
 */
export function passportUrl(base: string, token: string): string {
  return `${base.replace(/\/$/, '')}/p/${token}`;
}

/** What a scanned string might be, before anything is looked up. */
export interface ScanCandidate {
  kind: ScanKind;
  /** The value to look the record up by. */
  value: string;
  /** Why this was considered, for a screen that has to explain a refusal. */
  because: string;
}

// A registration is "BV19 FLM" with a space, and a machine code is "ALIGN-1"
// with a hyphen. The first draft of these allowed neither, so the two things a
// workshop would most obviously point a scanner at -- a windscreen and a
// machine -- resolved to nothing. verify-scanning caught both.
const REGISTRATION = /^[A-Z0-9][A-Z0-9 -]{1,10}$/i;
const JOB_NUMBER = /^#?\d{3,9}$/;
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const CODE_LIKE = /^[A-Z0-9][A-Z0-9 ._/-]{1,30}$/i;

/** Spacing and punctuation, which a plate has and a database column may not. */
export function looseKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Everything a bare scan could plausibly be.
 *
 * Deliberately generous: it is better to offer somebody two answers and let
 * them choose than to pick one and be wrong. The narrowing happens against the
 * database, and what survives decides whether this is an answer or a question.
 */
export function whatItCouldBe(text: string): ScanCandidate[] {
  const raw = text.trim();
  if (!raw) return [];

  const parsed = parseScanCode(raw);
  if (parsed) {
    return [{ kind: parsed.kind, value: parsed.id, because: 'a Carnet code' }];
  }

  const candidates: ScanCandidate[] = [];

  if (VIN.test(raw)) {
    candidates.push({
      kind: 'vehicle',
      value: raw.toUpperCase(),
      because: 'it is shaped like a VIN',
    });
  }

  if (JOB_NUMBER.test(raw)) {
    candidates.push({
      kind: 'job',
      value: raw.replace('#', ''),
      because: 'it is shaped like a job number',
    });
  }

  // A registration and a short part number look the same, and a supplier's
  // barcode looks like neither. All three are offered and the database
  // decides -- which is the point: the shape of a string is not evidence.
  if (REGISTRATION.test(raw)) {
    candidates.push({
      kind: 'vehicle',
      value: raw.toUpperCase(),
      because: 'it is shaped like a registration',
    });
  }

  // A machine's code looks like a part number and like a bin. All three are
  // offered for the same reason as the rest: the shape of a string is not
  // evidence, and the database is what narrows it.
  if (CODE_LIKE.test(raw)) {
    candidates.push({
      kind: 'equipment',
      value: raw,
      because: 'it may be a machine code',
    });
  }

  candidates.push({ kind: 'part', value: raw, because: 'it may be a part number or a barcode' });
  candidates.push({ kind: 'bin', value: raw, because: 'it may be a bin' });

  return candidates;
}

export type ScanOutcome =
  | { found: 'one'; kind: ScanKind; id: string; label: string }
  | { found: 'several'; matches: { kind: ScanKind; id: string; label: string }[] }
  | { found: 'none' };

/**
 * What to do with what the lookups came back with.
 *
 * One match is an answer. Several is a question, never a guess -- because the
 * one thing this must never do is take somebody to a job that is not the one
 * whose number they scanned. None is none, and saying so is a better outcome
 * than opening something.
 */
export function decideScan(
  matches: readonly { kind: ScanKind; id: string; label: string }[],
): ScanOutcome {
  // The same record found by two routes is one record. A part matched by its
  // own number and by its supplier's barcode must not read as an ambiguity.
  const unique = [...new Map(matches.map((one) => [`${one.kind}:${one.id}`, one])).values()];

  if (unique.length === 0) return { found: 'none' };
  if (unique.length === 1) {
    const only = unique[0]!;
    return { found: 'one', kind: only.kind, id: only.id, label: only.label };
  }
  return { found: 'several', matches: unique };
}

/** Where a resolved scan takes somebody. */
export function scanDestination(kind: ScanKind, id: string): string {
  switch (kind) {
    case 'vehicle':
      return `/vehicles/${id}`;
    case 'job':
      return `/jobs/${id}`;
    case 'part':
      return `/parts/${id}`;
    case 'bin':
      return `/parts?bin=${encodeURIComponent(id)}`;
    case 'inspection':
      return `/shop/inspect/${id}`;
    case 'equipment':
      return `/equipment/${id}`;
  }
}
