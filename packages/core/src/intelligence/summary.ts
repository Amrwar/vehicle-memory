/**
 * A job summary written for the customer, checkable against the job.
 *
 * The first and most trustworthy use of generated text in the product, because
 * it only ever restates work that has already been recorded. Every number, part
 * and finding in the summary has to exist on the job. A model may make the
 * sentences read better; it may not add a fact, and anything it produces is
 * checked against the record before a customer sees it. If the check fails,
 * the plain version is used and nobody is told a story.
 */

export interface SummaryFacts {
  customerFirstName: string;
  vehicle: string;
  registration: string | null;
  odometerKm: number | null;
  labour: readonly { description: string; hours: number }[];
  parts: readonly { description: string; partNumber: string | null; quantity: number }[];
  findings: readonly {
    item: string;
    severity: 'PASS' | 'ADVISORY' | 'CRITICAL' | 'NOT_CHECKED';
    note: string | null;
  }[];
  declined: readonly string[];
  total: string | null;
  workshopName: string;
}

/**
 * The summary, written plainly from the facts.
 *
 * No adjectives about the work, no reassurance that is not a finding. A
 * customer who reads "we also noticed the rear tyres are wearing" has been
 * told something they can act on; one who reads "your car is in great shape"
 * has been told nothing.
 */
export function customerSummary(facts: SummaryFacts): string {
  const lines: string[] = [];

  lines.push(`Hello ${facts.customerFirstName}.`);
  lines.push('');

  const car = facts.registration ? `${facts.vehicle} (${facts.registration})` : facts.vehicle;
  const mileage =
    facts.odometerKm !== null ? ` at ${facts.odometerKm.toLocaleString('en-GB')} km` : '';

  lines.push(`Here is what we did on the ${car}${mileage}.`);
  lines.push('');

  if (facts.labour.length > 0) {
    lines.push('Work carried out:');
    for (const item of facts.labour) {
      lines.push(`  - ${item.description} (${formatHours(item.hours)})`);
    }
    lines.push('');
  }

  if (facts.parts.length > 0) {
    lines.push('Parts fitted:');
    for (const part of facts.parts) {
      const qty = part.quantity === 1 ? '' : ` x${trimNumber(part.quantity)}`;
      const ref = part.partNumber ? ` [${part.partNumber}]` : '';
      lines.push(`  - ${part.description}${qty}${ref}`);
    }
    lines.push('');
  }

  const advisories = facts.findings.filter((f) => f.severity === 'ADVISORY');
  const critical = facts.findings.filter((f) => f.severity === 'CRITICAL');

  if (critical.length > 0 || advisories.length > 0) {
    lines.push('We also checked the vehicle over and noticed:');
    for (const finding of critical) {
      lines.push(
        `  - ${finding.item}: needs attention soon${finding.note ? `. ${finding.note}` : ''}`,
      );
    }
    for (const finding of advisories) {
      lines.push(
        `  - ${finding.item}: worth keeping an eye on${finding.note ? `. ${finding.note}` : ''}`,
      );
    }
    lines.push('');
  }

  if (facts.declined.length > 0) {
    lines.push(
      `You chose not to go ahead with: ${facts.declined.join(', ')}. That is noted on the record so nobody asks you twice.`,
    );
    lines.push('');
  }

  if (facts.total) {
    lines.push(`The total is ${facts.total}.`);
    lines.push('');
  }

  lines.push(`Any questions, ring us. ${facts.workshopName}`);

  return lines.join('\n');
}

/**
 * Whether a piece of text about the job says anything the job does not.
 *
 * Every number and every part number in the text has to appear in the facts.
 * Words are not checked, because a model rephrasing "replaced" as "fitted" is
 * the point of letting it near the text; a model inventing a torque figure or
 * a part number is not, and numbers are where invention does damage.
 */
const TOKEN = /\d[\d,.]*\d(?![A-Za-z0-9-])|\d(?![A-Za-z0-9-])|[A-Z0-9][A-Z0-9-]*\d[A-Z0-9-]*/g;

export function verifyAgainstFacts(
  text: string,
  facts: SummaryFacts,
  /** Further facts the text may repeat: a job number, a closing time, a date. */
  extra: readonly (string | number | null | undefined)[] = [],
): { ok: boolean; unsupported: string[] } {
  const allowed = new Set<string>();

  // Every number and every code in a fact is allowed. A description like
  // "5W-30 oil" or a plate like "AB12 CDE" is a code, not a figure, and the
  // text may repeat it.
  const addNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return;
    for (const token of String(value).match(TOKEN) ?? []) {
      allowed.add(token.toUpperCase());
      allowed.add(normaliseNumber(token));
    }
  };

  addNumber(facts.odometerKm);
  for (const value of extra) addNumber(value);
  addNumber(facts.total);
  addNumber(facts.registration);
  // A plate is a code, not a figure, but it is one the text may repeat.
  if (facts.registration) {
    allowed.add(facts.registration.toUpperCase().replace(/\s+/g, ''));
    for (const part of facts.registration.toUpperCase().split(/\s+/)) allowed.add(part);
  }
  for (const item of facts.labour) {
    addNumber(item.hours);
    addNumber(item.description);
  }
  for (const part of facts.parts) {
    addNumber(part.quantity);
    addNumber(part.description);
    if (part.partNumber) {
      allowed.add(part.partNumber.toUpperCase());
      addNumber(part.partNumber);
    }
  }
  for (const finding of facts.findings) {
    addNumber(finding.item);
    addNumber(finding.note);
  }
  for (const item of facts.declined) addNumber(item);
  addNumber(facts.vehicle);

  const unsupported: string[] = [];

  for (const token of text.match(
    /\d[\d,.]*\d(?![A-Za-z0-9-])|\d(?![A-Za-z0-9-])|[A-Z0-9][A-Z0-9-]*\d[A-Z0-9-]*/g,
  ) ?? []) {
    const upper = token.toUpperCase();
    if (allowed.has(upper)) continue;
    if (allowed.has(normaliseNumber(token))) continue;
    // Plain small counts in prose ("two items", "1 of them") are not facts
    // worth refusing over; anything with a decimal, a comma or three digits is.
    if (/^\d{1,2}$/.test(token)) continue;
    unsupported.push(token);
  }

  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}

function normaliseNumber(token: string): string {
  const cleaned = token.replace(/,/g, '').replace(/\.$/, '');
  const asNumber = Number(cleaned);
  return Number.isFinite(asNumber) ? String(asNumber) : cleaned.toUpperCase();
}

function formatHours(hours: number): string {
  if (hours === 1) return '1 hour';
  return `${trimNumber(hours)} hours`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
