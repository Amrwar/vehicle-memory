/**
 * A record read as its own history, rather than as rows in a log.
 *
 * The product has written an audit entry on every meaningful action since
 * Phase 1: who, what, when, before, after, and the address it came from.
 * Nothing has ever read them back except one reverse-chronological page that
 * shows every action in the organisation mixed together.
 *
 * That page answers "what happened this morning". It cannot answer the
 * question somebody actually asks, which is "what happened to this quote" —
 * created, changed, sent, approved, converted, invoiced — with the person and
 * the change at each step.
 *
 * Two rules make this safe to put in front of somebody.
 *
 * Nothing is invented. Where a before and after exist the difference is
 * computed and shown; where they do not, the entry says what happened and
 * does not pretend to know what changed.
 *
 * Nothing sensitive is displayed. Audit payloads are written by many callers
 * over years, and the day somebody includes a token in one is the day this
 * page would publish it. The redaction list is deny-by-default on the shape
 * of the key rather than a list of known-bad names.
 */

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  at: Date;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
}

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
  /** True when the field appeared for the first time. */
  added: boolean;
  removed: boolean;
}

export interface LifeEvent {
  id: string;
  at: Date;
  actorName: string;
  /** The action as somebody would say it. */
  title: string;
  changes: FieldChange[];
  /** Where it came from, where that is known and worth saying. */
  origin: string | null;
  /** True for the entries that change what the record is, not merely its detail. */
  milestone: boolean;
}

export interface Life {
  events: LifeEvent[];
  /** The people who touched it, most recent first. */
  hands: string[];
  createdAt: Date | null;
  lastTouchedAt: Date | null;
  summary: string;
}

/**
 * Keys whose values never reach a screen.
 *
 * Matched on the shape of the name rather than an exact list, because the
 * list would be out of date the first time somebody added a field. A key
 * containing any of these is redacted wherever it appears, at any depth.
 */
const SECRET = [
  'password',
  'passwordhash',
  'hash',
  'token',
  'tokenhash',
  'secret',
  'salt',
  'apikey',
  'accesskey',
  'privatekey',
  'authorization',
  'cookie',
  'session',
];

function isSecret(key: string): boolean {
  const flat = key.toLowerCase().replace(/[^a-z]/g, '');
  return SECRET.some((needle) => flat.includes(needle));
}

/** A value as a short readable string, or null when there is nothing to say. */
function show(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 157)}…` : value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return JSON.stringify(value).slice(0, 160);
}

/** A field name as a phrase rather than a column. */
export function humaniseField(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .trim()
    .toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) out.set(prefix, value);
    return out;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isSecret(key)) {
      out.set(path, '[hidden]');
      continue;
    }

    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const [nested, nestedValue] of flatten(entry, path)) out.set(nested, nestedValue);
    } else {
      out.set(path, entry);
    }
  }

  return out;
}

/**
 * What changed between two snapshots.
 *
 * Only fields that actually differ. An entry listing forty unchanged fields
 * buries the one that moved, which is the whole reason somebody opened it.
 */
export function diffOf(before: unknown, after: unknown): FieldChange[] {
  const from = flatten(before);
  const to = flatten(after);

  const fields = [...new Set([...from.keys(), ...to.keys()])].sort();
  const changes: FieldChange[] = [];

  for (const field of fields) {
    const had = from.has(field);
    const has = to.has(field);

    const left = show(from.get(field));
    const right = show(to.get(field));

    if (left === right) continue;

    changes.push({
      field: humaniseField(field),
      from: left,
      to: right,
      added: !had && has,
      removed: had && !has,
    });
  }

  return changes;
}

/**
 * An action code as a sentence.
 *
 * Codes are written as `noun.verb` or `noun.thing.verb` by convention across
 * the product. Rather than a lookup table that goes stale the moment somebody
 * adds an action, the last segment is read as the verb and the rest as what
 * it happened to, with a handful of verbs given better English.
 */
const VERBS: Record<string, string> = {
  created: 'Created',
  added: 'Added',
  updated: 'Changed',
  changed: 'Changed',
  deleted: 'Deleted',
  removed: 'Removed',
  sent: 'Sent',
  approved: 'Approved',
  declined: 'Declined',
  issued: 'Issued',
  paid: 'Paid',
  cancelled: 'Cancelled',
  voided: 'Voided',
  recorded: 'Recorded',
  raised: 'Raised',
  settled: 'Settled',
  transferred: 'Transferred',
  completed: 'Completed',
  reopened: 'Reopened',
  withdrawn: 'Withdrawn',
};

/** Actions that change what a record is, rather than what it says. */
const MILESTONES = [
  'created',
  'sent',
  'approved',
  'declined',
  'issued',
  'paid',
  'completed',
  'cancelled',
  'voided',
  'transferred',
  'settled',
];

export function describeAuditAction(action: string): { title: string; milestone: boolean } {
  const parts = action.split('.');
  const verb = parts.at(-1) ?? action;
  const subject = parts.slice(0, -1).join(' ');

  const english = VERBS[verb] ?? humaniseField(verb);

  return {
    title: subject ? `${english} ${subject.replace(/-/g, ' ')}` : english,
    milestone: MILESTONES.includes(verb),
  };
}

/** Where an action came from, in as much as an address can say. */
function originOf(entry: AuditEntry): string | null {
  if (!entry.userAgent && !entry.ip) return null;

  const agent = entry.userAgent ?? '';

  const device = /iPhone|Android|iPad|Mobile/i.test(agent)
    ? 'a phone or tablet'
    : agent
      ? 'a computer'
      : null;

  // The address is shown, not the parsed location. Guessing a town from an
  // address and printing it beside somebody's name is a claim the data does
  // not support.
  return [device, entry.ip].filter(Boolean).join(', ') || null;
}

/**
 * One record's whole life, oldest first.
 *
 * Oldest first here and newest first on the customer thread, deliberately.
 * A thread is caught up with; a life is read from the beginning, because the
 * question is how it got to where it is.
 */
export function lifeOf(entries: readonly AuditEntry[]): Life {
  const ordered = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());

  const events: LifeEvent[] = ordered.map((entry) => {
    const { title, milestone } = describeAuditAction(entry.action);

    return {
      id: entry.id,
      at: entry.at,
      actorName: entry.actorName ?? 'The system',
      title,
      changes: diffOf(entry.before, entry.after),
      origin: originOf(entry),
      milestone,
    };
  });

  const hands = [
    ...new Set([...ordered].reverse().map((entry) => entry.actorName ?? 'The system')),
  ];

  const created = ordered[0]?.at ?? null;
  const last = ordered.at(-1)?.at ?? null;

  const milestones = events.filter((event) => event.milestone);

  return {
    events,
    hands,
    createdAt: created,
    lastTouchedAt: last,
    summary:
      events.length === 0
        ? 'Nothing has been recorded against this yet.'
        : `${events.length} recorded action${events.length === 1 ? '' : 's'} by ${hands.length} ${hands.length === 1 ? 'person' : 'people'}${
            milestones.length > 0
              ? `. ${milestones.map((event) => event.title.toLowerCase()).join(', then ')}.`
              : '.'
          }`,
  };
}
