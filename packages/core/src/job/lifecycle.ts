/**
 * Job lifecycle state machine.
 *
 * The job is the central aggregate (domain model section 3.2). Its status is
 * the single most consulted fact in the system: the diary colours by it, the
 * dashboard counts by it, the technician's list filters by it, and the
 * accounting posting depends on it.
 *
 * Illegal transitions are rejected here, in the domain, rather than merely
 * being absent from the UI. A UI-only guard is bypassed by the first API
 * client, the first background job and the first support script.
 *
 * FR-602, FR-603, invariants J1 and J2.
 */

export const JOB_STATUSES = [
  'DRAFT',
  'BOOKED',
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CANCELLED',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Permitted transitions.
 *
 * Two shapes deserve comment.
 *
 * Several statuses can go back to an earlier one. That is not sloppiness: a
 * technician who starts work and finds a second fault must be able to return
 * the job to DIAGNOSED. Workshops are not assembly lines, and a state machine
 * that refuses to go backwards gets worked around by never advancing it.
 *
 * CANCELLED is reachable from everything before COMPLETED and from nothing
 * after, because once an invoice exists the correction is a credit note.
 */
const TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  DRAFT: ['BOOKED', 'RECEIVED', 'CANCELLED'],
  BOOKED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'CANCELLED'],
  INSPECTING: ['DIAGNOSED', 'ESTIMATED', 'RECEIVED', 'CANCELLED'],
  DIAGNOSED: ['ESTIMATED', 'IN_PROGRESS', 'INSPECTING', 'CANCELLED'],
  ESTIMATED: ['AWAITING_APPROVAL', 'APPROVED', 'DIAGNOSED', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'ESTIMATED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'ESTIMATED', 'CANCELLED'],
  IN_PROGRESS: ['QUALITY_CHECK', 'COMPLETED', 'DIAGNOSED', 'ESTIMATED', 'CANCELLED'],
  QUALITY_CHECK: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['INVOICED', 'IN_PROGRESS'],
  INVOICED: ['PAID'],
  PAID: [],
  CANCELLED: [],
};

/** Statuses from which no further transition is possible. */
export const TERMINAL_STATUSES: readonly JobStatus[] = ['PAID', 'CANCELLED'];

/** Statuses meaning the vehicle is physically in the workshop. */
export const IN_SHOP_STATUSES: readonly JobStatus[] = [
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
];

/** Statuses meaning the workshop is waiting on the customer, not the reverse. */
export const BLOCKED_ON_CUSTOMER_STATUSES: readonly JobStatus[] = ['AWAITING_APPROVAL'];

export interface TransitionContext {
  /** Whether any assigned job type demands a quality check. FR-612. */
  requiresQualityCheck?: boolean;
  /** Whether a passed quality check has been recorded. */
  hasPassedQualityCheck?: boolean;
  /** Whether an estimate has been approved, in whole or in part. */
  hasApprovedEstimate?: boolean;
  /** Whether the job has at least one priced line. */
  hasChargeableLines?: boolean;
  /** Whether an odometer reading was captured at check-in. */
  hasOdometerIn?: boolean;
  /**
   * Machines this job's type requires that are not usable, with the reason.
   *
   * Empty or absent for every job whose type requires no machine, which is
   * every job in every workshop that has not declared one -- so this gate,
   * unlike FR-612 before Phase 85, cannot be reached by anybody who has no
   * way to satisfy it. Phase 89.
   */
  unusableEquipment?: readonly { name: string; why: string }[];
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: TransitionErrorCode; message: string; allowed: readonly JobStatus[] };

export type TransitionErrorCode =
  | 'ILLEGAL_TRANSITION'
  | 'TERMINAL_STATUS'
  | 'QUALITY_CHECK_REQUIRED'
  | 'EQUIPMENT_UNAVAILABLE'
  | 'APPROVAL_REQUIRED'
  | 'NOTHING_TO_INVOICE';

export class JobTransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly from: JobStatus;
  readonly to: JobStatus;
  readonly allowed: readonly JobStatus[];

  constructor(from: JobStatus, to: JobStatus, result: Extract<TransitionResult, { ok: false }>) {
    super(result.message);
    this.name = 'JobTransitionError';
    this.code = result.code;
    this.from = from;
    this.to = to;
    this.allowed = result.allowed;
  }
}

export function allowedTransitions(from: JobStatus): readonly JobStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isInShop(status: JobStatus): boolean {
  return IN_SHOP_STATUSES.includes(status);
}

/**
 * Checks a transition without throwing. Returns the reason on failure so the
 * interface can explain what is missing rather than merely disabling a button.
 */
export function checkTransition(
  from: JobStatus,
  to: JobStatus,
  context: TransitionContext = {},
): TransitionResult {
  const allowed = TRANSITIONS[from];

  if (isTerminal(from)) {
    return {
      ok: false,
      code: 'TERMINAL_STATUS',
      message: `A job that is ${humanise(from)} cannot change status.`,
      allowed,
    };
  }

  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      message:
        `A job cannot move from ${humanise(from)} to ${humanise(to)}. ` +
        `Permitted next steps: ${allowed.map(humanise).join(', ') || 'none'}.`,
      allowed,
    };
  }

  // Phase 89: work does not start on a machine that is not allowed to be
  // used. Only the three states that mean *not usable at all* reach here --
  // a machine merely busy on another job never does, because a workshop puts
  // a car on the ramp knowing the rig is free in an hour and a product that
  // refused would be wrong about how a workshop runs.
  if (to === 'IN_PROGRESS' && (context.unusableEquipment?.length ?? 0) > 0) {
    const named = context
      .unusableEquipment!.map((one) => `${one.name} (${one.why.toLowerCase()})`)
      .join(', ');
    return {
      ok: false,
      code: 'EQUIPMENT_UNAVAILABLE',
      message: `This job needs equipment that cannot be used: ${named}.`,
      allowed,
    };
  }

  // FR-612: completion is gated on quality control where the job type wants it.
  if (to === 'COMPLETED' && context.requiresQualityCheck && !context.hasPassedQualityCheck) {
    return {
      ok: false,
      code: 'QUALITY_CHECK_REQUIRED',
      message: 'This job type requires a passed quality check before it can be completed.',
      allowed,
    };
  }

  // Work must not begin on unapproved chargeable work. This is the rule that
  // prevents the argument at the collection desk.
  if (
    to === 'IN_PROGRESS' &&
    from === 'AWAITING_APPROVAL' &&
    context.hasApprovedEstimate === false
  ) {
    return {
      ok: false,
      code: 'APPROVAL_REQUIRED',
      message: 'The customer has not approved the estimate yet.',
      allowed,
    };
  }

  if (to === 'INVOICED' && context.hasChargeableLines === false) {
    return {
      ok: false,
      code: 'NOTHING_TO_INVOICE',
      message: 'This job has no chargeable lines, so there is nothing to invoice.',
      allowed,
    };
  }

  return { ok: true };
}

/** Throws on an illegal transition. Use where the caller cannot proceed. */
export function assertTransition(
  from: JobStatus,
  to: JobStatus,
  context: TransitionContext = {},
): void {
  const result = checkTransition(from, to, context);
  if (!result.ok) {
    throw new JobTransitionError(from, to, result);
  }
}

/**
 * The progress trail shown on the job screen (story E1). Returns the canonical
 * happy-path stages with each marked done, current or upcoming.
 *
 * The trail deliberately shows the ideal path even when the actual job went
 * backwards, because its purpose is to answer "how far along is this car",
 * not to narrate every correction. The full history is in JobStatusEvent.
 */
export const PROGRESS_STAGES: readonly JobStatus[] = [
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'COMPLETED',
  'INVOICED',
  'PAID',
];

export type StageState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface ProgressStage {
  status: JobStatus;
  label: string;
  state: StageState;
}

export function progressFor(
  current: JobStatus,
  reachedStatuses: readonly JobStatus[] = [],
): ProgressStage[] {
  const currentIndex = PROGRESS_STAGES.indexOf(current);
  const reached = new Set(reachedStatuses);

  return PROGRESS_STAGES.map((status, index) => {
    let state: StageState;

    if (current === 'CANCELLED') {
      state = reached.has(status) ? 'done' : 'skipped';
    } else if (index < currentIndex) {
      // A stage before the current one that was never visited was skipped —
      // a walk-in repair with no inspection, for instance.
      state = reached.has(status) ? 'done' : 'skipped';
    } else if (index === currentIndex) {
      state = 'current';
    } else {
      state = 'upcoming';
    }

    return { status, label: humanise(status), state };
  });
}

const LABELS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  BOOKED: 'Booked',
  RECEIVED: 'Vehicle received',
  INSPECTING: 'Inspection',
  DIAGNOSED: 'Diagnosis',
  ESTIMATED: 'Estimate created',
  AWAITING_APPROVAL: 'Customer approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'Repair',
  QUALITY_CHECK: 'Quality control',
  COMPLETED: 'Completed',
  INVOICED: 'Invoice',
  PAID: 'Payment',
  CANCELLED: 'Cancelled',
};

export function humanise(status: JobStatus): string {
  return LABELS[status];
}

/**
 * Tone for each status, consumed by the design system's Badge. Never the only
 * carrier of meaning: the label always accompanies it (NFR-603).
 */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent';

const TONES: Record<JobStatus, StatusTone> = {
  DRAFT: 'neutral',
  BOOKED: 'info',
  RECEIVED: 'info',
  INSPECTING: 'accent',
  DIAGNOSED: 'accent',
  ESTIMATED: 'accent',
  AWAITING_APPROVAL: 'warning',
  APPROVED: 'success',
  IN_PROGRESS: 'info',
  QUALITY_CHECK: 'accent',
  COMPLETED: 'success',
  INVOICED: 'success',
  PAID: 'success',
  CANCELLED: 'danger',
};

export function toneFor(status: JobStatus): StatusTone {
  return TONES[status];
}
