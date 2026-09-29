/**
 * The machine the job needs.
 *
 * A workshop's lifts, scan tools, torque wrenches, air-conditioning stations
 * and alignment rigs decide what work it can take, and until now the product
 * knew nothing about any of them. `Bay.capability` was a free-text hint typed
 * once and read by nobody, and `JobTypeSkill` covered the people.
 *
 * ## Available is not one flag
 *
 * A workshop asks three different questions and a single `isAvailable` column
 * answers none of them: is it here, is it working, and **is it allowed to be
 * used**. The third is the one nobody models and the one that stops the job.
 * A torque wrench out of calibration and a lift whose statutory inspection has
 * lapsed are physically present and apparently fine, and using either is a
 * failed audit, a void insurance claim, or a wheel coming off.
 *
 * So the state is derived, never stored, and in this order:
 *
 *   retired → out of service → out of calibration → in use → available
 *
 * The order is the point. A retired machine is not "out of calibration", it is
 * gone; a broken one is not "in use". Each state answers the first question
 * that is true, so the sentence a person reads is the most important thing
 * wrong with it rather than whichever flag was checked last.
 *
 * ## An expired certificate takes the machine out by itself
 *
 * Nobody has to notice, and nobody has to press anything. `stateOf` compares
 * the expiry against the clock, which means the machine becomes unusable on
 * the right morning even though every person who could have flagged it was on
 * holiday. A stored `isCalibrated` boolean would have been true until somebody
 * remembered, and the day anybody remembers is not the day it expired.
 *
 * ## Late for a service warns; an expired certificate blocks
 *
 * These are different in kind and the product must not conflate them. A lift
 * that is a month late for its service is a risk a workshop may knowingly
 * carry for a week. A lift whose LOLER inspection expired is one it is not
 * permitted to use at all. Flattening the two either grounds a workshop for a
 * missed service or lets it keep working on an uninspected lift, and the
 * second is how somebody gets hurt.
 *
 * Phase 89.
 */

/** Why a machine cannot be used, first true answer wins. */
export const EQUIPMENT_STATES = [
  'RETIRED',
  'OUT_OF_SERVICE',
  'OUT_OF_CALIBRATION',
  'IN_USE',
  'AVAILABLE',
] as const;

export type EquipmentState = (typeof EQUIPMENT_STATES)[number];

export const EQUIPMENT_STATE_SENTENCE: Record<EquipmentState, string> = {
  RETIRED: 'Retired',
  OUT_OF_SERVICE: 'Out of service',
  OUT_OF_CALIBRATION: 'Certificate expired',
  IN_USE: 'In use on another job',
  AVAILABLE: 'Available',
};

/** The three that stop a job, and the two that do not. */
export const BLOCKING_STATES: readonly EquipmentState[] = [
  'RETIRED',
  'OUT_OF_SERVICE',
  'OUT_OF_CALIBRATION',
];

export function blocks(state: EquipmentState): boolean {
  return BLOCKING_STATES.includes(state);
}

/**
 * How long before a certificate expires the screens start saying so.
 *
 * Thirty days, because booking a calibration engineer takes a fortnight and a
 * warning that arrives the day the certificate lapses is a warning that
 * arrives too late to do anything about. The warning is not a state: the
 * machine is still available, still usable, and still the right answer for a
 * job today.
 */
export const CERTIFICATE_WARNING_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

export interface EquipmentFacts {
  /** Retired from the workshop. Nothing else about it matters after this. */
  retired: boolean;
  /** Taken out by a person, with a reason. */
  outOfServiceSince: Date | null;
  /**
   * When its calibration or statutory inspection certificate runs out.
   *
   * Null means the machine does not carry one -- a trolley jack, a bench vice
   * -- which is different from one whose certificate has lapsed, and the two
   * must never collapse into the same state.
   */
  certificateExpiresAt: Date | null;
  /** Jobs on the bench right now that need this machine. */
  inUseOnJobs?: number;
}

/** What is most importantly true about this machine, right now. */
export function stateOf(facts: EquipmentFacts, now: Date): EquipmentState {
  if (facts.retired) return 'RETIRED';
  if (facts.outOfServiceSince) return 'OUT_OF_SERVICE';
  if (facts.certificateExpiresAt && facts.certificateExpiresAt.getTime() <= now.getTime()) {
    return 'OUT_OF_CALIBRATION';
  }
  if ((facts.inUseOnJobs ?? 0) > 0) return 'IN_USE';
  return 'AVAILABLE';
}

/** Days until the certificate lapses. Null where there is no certificate. */
export function daysOfCertificateLeft(facts: EquipmentFacts, now: Date): number | null {
  if (!facts.certificateExpiresAt) return null;
  return Math.ceil((facts.certificateExpiresAt.getTime() - now.getTime()) / DAY);
}

/** Close enough to expiry to book the engineer, and not yet a problem. */
export function certificateDueSoon(facts: EquipmentFacts, now: Date): boolean {
  const left = daysOfCertificateLeft(facts, now);
  return left !== null && left > 0 && left <= CERTIFICATE_WARNING_DAYS;
}

/**
 * Whether a machine is overdue its own service, which warns and never blocks.
 *
 * Deliberately separate from the certificate. A workshop may run a lift a
 * fortnight past its service while it waits for the engineer; it may not run
 * one whose inspection has lapsed. Collapsing the two either grounds the
 * workshop for a missed service or keeps it working on an uninspected lift.
 */
export function serviceOverdue(
  facts: { servicedAt: Date | null; serviceEveryMonths: number | null },
  now: Date,
): boolean {
  if (!facts.serviceEveryMonths) return false;
  if (!facts.servicedAt) return true;
  const due = new Date(facts.servicedAt);
  due.setMonth(due.getMonth() + facts.serviceEveryMonths);
  return due.getTime() <= now.getTime();
}

/** When the next service falls due, where the machine has an interval. */
export function serviceDueAt(facts: {
  servicedAt: Date | null;
  serviceEveryMonths: number | null;
}): Date | null {
  if (!facts.serviceEveryMonths || !facts.servicedAt) return null;
  const due = new Date(facts.servicedAt);
  due.setMonth(due.getMonth() + facts.serviceEveryMonths);
  return due;
}

export interface MachineForJob {
  equipmentId: string;
  name: string;
  state: EquipmentState;
}

export interface JobCanRun {
  ok: boolean;
  /** Every machine standing in the way, with what is wrong with each. */
  blocking: { equipmentId: string; name: string; state: EquipmentState; why: string }[];
  /** Machines the job needs that are simply busy on another job. */
  busy: { equipmentId: string; name: string }[];
}

/**
 * Whether the work can start, and if not, which machine and why.
 *
 * "In use on another job" is deliberately not blocking. A workshop puts a car
 * on the ramp knowing the alignment rig is busy and gets to it in an hour; a
 * product that refused would be a product that is wrong about how a workshop
 * runs. Only the three that mean *not usable at all* stop it, and the refusal
 * names the machine, because "this job cannot start" with no name attached is
 * a message somebody works around rather than acts on.
 */
export function jobCanRun(machines: readonly MachineForJob[]): JobCanRun {
  return {
    ok: machines.every((machine) => !blocks(machine.state)),
    blocking: machines
      .filter((machine) => blocks(machine.state))
      .map((machine) => ({
        equipmentId: machine.equipmentId,
        name: machine.name,
        state: machine.state,
        why: EQUIPMENT_STATE_SENTENCE[machine.state],
      })),
    busy: machines
      .filter((machine) => machine.state === 'IN_USE')
      .map((machine) => ({ equipmentId: machine.equipmentId, name: machine.name })),
  };
}

/** The sentence a refusal carries, naming every machine in the way. */
export function whyItCannotStart(result: JobCanRun): string | null {
  if (result.ok) return null;
  return result.blocking.map((one) => `${one.name}: ${one.why.toLowerCase()}`).join('; ');
}

/**
 * What an owner needs to do something about, worst first.
 *
 * Out of calibration before due soon before overdue a service, because the
 * first has already stopped work and the last has not stopped anything yet.
 */
export function equipmentWorstFirst<
  T extends { state: EquipmentState; dueSoon: boolean; serviceOverdue: boolean },
>(all: readonly T[]): T[] {
  const rank = (one: T) => {
    if (one.state === 'OUT_OF_CALIBRATION') return 0;
    if (one.state === 'OUT_OF_SERVICE') return 1;
    if (one.dueSoon) return 2;
    if (one.serviceOverdue) return 3;
    if (one.state === 'RETIRED') return 5;
    return 4;
  };
  return [...all].sort((a, b) => rank(a) - rank(b));
}
