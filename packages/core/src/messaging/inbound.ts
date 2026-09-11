/**
 * A reply arriving, and working out what it is about.
 *
 * Everything outbound has been recorded and sent since Phase 5. Nothing
 * inbound has ever arrived: a customer replying to a text about their car
 * reaches somebody's phone, or nothing at all.
 *
 * The hard part is not receiving it. It is deciding what it belongs to without
 * guessing, because a reply filed against the wrong job is worse than one
 * filed against nothing: somebody reads it in the context of another car.
 *
 * So matching produces a confidence, never a silent assignment. A reference in
 * the body is certain. An address that belongs to exactly one customer with
 * exactly one job open is probable. An address belonging to two customers is
 * a question for a person, and the inbox says so rather than picking one.
 */

export type InboundConfidence = 'CERTAIN' | 'PROBABLE' | 'POSSIBLE' | 'NONE';

export interface Candidate {
  customerId: string;
  customerName: string;
  /** Open jobs for that customer, newest first. */
  openJobs: { id: string; number: number; shortDescription: string }[];
  /** The last job of theirs anybody messaged about. */
  lastMessagedJobId: string | null;
}

export interface InboundMatch {
  confidence: InboundConfidence;
  customerId: string | null;
  jobId: string | null;
  /** The sentence the inbox shows beside the message. */
  why: string;
  /** True when a person has to choose before this can be filed. */
  needsChoosing: boolean;
}

/**
 * A job number quoted in the text.
 *
 * Matched only in the shapes the product itself sends — "job 10482" or
 * "#10482" — rather than any five-digit number. A postcode, a price and a
 * registration all contain digits, and a rule loose enough to catch them all
 * files replies against whichever job happens to share the number.
 */
export function quotedJobNumber(body: string): number | null {
  const match = /(?:job|ref(?:erence)?)\s*#?\s*(\d{3,8})\b|#(\d{4,8})\b/i.exec(body);
  if (!match) return null;

  const digits = match[1] ?? match[2];
  return digits ? Number(digits) : null;
}

/**
 * Whether a reply is somebody saying yes.
 *
 * Deliberately narrow, and deliberately not acted on automatically. An
 * approval worth thousands of pounds does not rest on a regular expression:
 * this only surfaces the message at the top of the inbox so somebody looks at
 * it first.
 */
export function looksLikeApproval(body: string): boolean {
  const text = body.trim().toLowerCase();
  if (text.length > 40) return false;

  return /^(y|ok|okay|yes|yep|go ahead|approved?|do it|please do|confirm(ed)?)\b[.! ]*$/.test(text);
}

/** Whether a reply is somebody asking to be left alone. */
export function looksLikeOptOut(body: string): boolean {
  const text = body.trim().toLowerCase();
  if (text.length > 30) return false;

  return /^(stop|unsubscribe|opt ?out|no more|remove me)\b[.! ]*$/.test(text);
}

/**
 * What an inbound message is about.
 *
 * Ordered by how certain each rule is, and it stops at the first that answers.
 * A quoted job number beats everything: the customer copied it from something
 * the workshop sent them.
 */
export function matchInbound(input: {
  body: string;
  /** Customers whose email or mobile matches the address it came from. */
  candidates: readonly Candidate[];
  /** A job whose number was quoted, where one was and it exists. */
  quotedJob: { id: string; number: number; customerId: string } | null;
}): InboundMatch {
  const { candidates, quotedJob } = input;

  if (quotedJob) {
    return {
      confidence: 'CERTAIN',
      customerId: quotedJob.customerId,
      jobId: quotedJob.id,
      why: `They quoted job ${quotedJob.number}, so this is about that one.`,
      needsChoosing: false,
    };
  }

  if (candidates.length === 0) {
    return {
      confidence: 'NONE',
      customerId: null,
      jobId: null,
      why: 'Nobody on record uses that address. It may be a new customer, or a wrong number.',
      needsChoosing: true,
    };
  }

  if (candidates.length > 1) {
    // Two customers sharing an address is ordinary: a couple, or a company
    // address on several accounts. Picking one would file a reply about one
    // car under another.
    return {
      confidence: 'POSSIBLE',
      customerId: null,
      jobId: null,
      why: `${candidates.length} customers use that address. Somebody has to say which.`,
      needsChoosing: true,
    };
  }

  const only = candidates[0]!;

  if (only.openJobs.length === 1) {
    return {
      confidence: 'PROBABLE',
      customerId: only.customerId,
      jobId: only.openJobs[0]!.id,
      why: `${only.customerName} has one job open, so it is almost certainly about that.`,
      needsChoosing: false,
    };
  }

  if (only.openJobs.length === 0) {
    return {
      confidence: 'PROBABLE',
      customerId: only.customerId,
      jobId: only.lastMessagedJobId,
      why: only.lastMessagedJobId
        ? `${only.customerName} has nothing open. Filed against the last job anybody messaged them about.`
        : `${only.customerName} has nothing open and nothing recent to attach it to.`,
      needsChoosing: false,
    };
  }

  return {
    confidence: 'POSSIBLE',
    customerId: only.customerId,
    jobId: null,
    why: `${only.customerName} has ${only.openJobs.length} jobs open. Somebody has to say which this is about.`,
    needsChoosing: true,
  };
}

/**
 * Where a message sits in the inbox.
 *
 * Not by arrival. Somebody asking to be left alone has to be acted on today or
 * the workshop is breaking a promise; somebody apparently approving work is
 * holding up a car. Both go above an ordinary reply that arrived first.
 */
export function priorityOf(input: {
  body: string;
  confidence: InboundConfidence;
  receivedAt: Date;
}): { rank: number; label: string | null } {
  if (looksLikeOptOut(input.body)) {
    return { rank: 0, label: 'asking to be left alone' };
  }

  if (looksLikeApproval(input.body)) {
    return { rank: 1, label: 'possibly approving work' };
  }

  if (input.confidence === 'NONE' || input.confidence === 'POSSIBLE') {
    return { rank: 2, label: 'needs filing' };
  }

  return { rank: 3, label: null };
}
