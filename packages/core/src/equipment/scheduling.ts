/**
 * Promises the workshop cannot keep.
 *
 * Phase 89 gave the machines five states and refused to store any of them:
 * whether a lift may be used is worked out from its certificate against the
 * clock, every time it is asked.
 *
 * That turns out to have been the whole of this phase as well. Asking "will
 * this rig be usable next Tuesday?" is the same function with a different
 * date. A stored `isAvailable` flag could only ever have answered *now*, and a
 * diary needs to answer *then* — so a booking made today for the twentieth can
 * be told, today, that the certificate lapses on the eighteenth.
 *
 * ## What a clash is
 *
 * Two things, and they are different.
 *
 * A machine that **will not be usable** on the day is a promise the workshop
 * cannot keep at all: the certificate will have lapsed, or somebody has taken
 * it out of service and nobody has put it back. That is known now, weeks
 * early, and the point of knowing it now is that the booking can be moved
 * while moving it is still a phone call rather than an apology.
 *
 * A machine **already promised to another car** at the same hour is a
 * different problem with the same cause: one alignment rig cannot do two cars
 * at once. Quantity is deliberately not modelled — a workshop with two rigs
 * records two machines, because that is what it has, and a "quantity: 2"
 * column would have to be kept true by somebody.
 *
 * ## Nothing here moves a booking
 *
 * The product names the clash and the workshop decides, exactly as the
 * supplier recommendation carries the argument against itself. A diary that
 * quietly shuffled a customer's appointment to suit a rig would be a diary
 * nobody could explain to the customer on the phone.
 *
 * Phase 91.
 */

import { overlaps } from '../scheduling/capacity';
import { type EquipmentFacts, stateOf } from './index';

/** A machine, and everything needed to say whether it will be usable. */
export interface SchedulableMachine {
  equipmentId: string;
  name: string;
  facts: EquipmentFacts;
}

/** Work promised to a customer, and the machines it cannot be done without. */
export interface Commitment {
  bookingId: string;
  label: string;
  startAt: Date;
  endAt: Date;
  machineIds: readonly string[];
}

export type ClashKind = 'NOT_USABLE' | 'DOUBLE_BOOKED';

export interface Clash {
  bookingId: string;
  label: string;
  startAt: Date;
  kind: ClashKind;
  equipmentId: string;
  machineName: string;
  /** For a double booking, the other one. */
  againstBookingId?: string;
  againstLabel?: string;
  /** For an unusable machine, what will be wrong with it that day. */
  why?: string;
}

/*
 * Whether two windows touch is `overlaps` from the capacity rules, which has
 * answered it since Phase 12 with the same meaning: ends are exclusive, so
 * ten-to-eleven and eleven-to-twelve do not clash. A second definition of
 * that would be a second thing to get right.
 */

/**
 * Whether a machine will be usable on a given day.
 *
 * `inUseOnJobs` is deliberately zeroed. Being busy on the bench today says
 * nothing about a Tuesday three weeks out, and counting it would refuse a
 * booking for a machine that is simply working -- which is what it is for.
 * Who else has been promised it is a separate question, answered by
 * `clashesAmong` from the bookings themselves.
 */
export function usableOn(machine: SchedulableMachine, when: Date): boolean {
  const state = stateOf({ ...machine.facts, inUseOnJobs: 0 }, when);
  return state === 'AVAILABLE';
}

export function whyNotOn(machine: SchedulableMachine, when: Date): string | null {
  const state = stateOf({ ...machine.facts, inUseOnJobs: 0 }, when);
  return state === 'AVAILABLE' ? null : state;
}

/**
 * Every promise the workshop cannot keep, and why.
 *
 * Judged at each booking's own start, which is the point: a certificate that
 * lapses on the eighteenth makes the twentieth's booking unkeepable today,
 * weeks before anybody has driven anywhere.
 */
export function clashesAmong(
  commitments: readonly Commitment[],
  machines: readonly SchedulableMachine[],
): Clash[] {
  const byId = new Map(machines.map((machine) => [machine.equipmentId, machine]));
  const clashes: Clash[] = [];

  for (const commitment of commitments) {
    for (const equipmentId of commitment.machineIds) {
      const machine = byId.get(equipmentId);
      if (!machine) continue;

      const why = whyNotOn(machine, commitment.startAt);
      if (why) {
        clashes.push({
          bookingId: commitment.bookingId,
          label: commitment.label,
          startAt: commitment.startAt,
          kind: 'NOT_USABLE',
          equipmentId,
          machineName: machine.name,
          why,
        });
      }
    }
  }

  // One machine cannot do two cars at once. Reported against the later of the
  // pair, because the earlier booking is the one that was promised first and
  // the later one is the one somebody would move.
  const ordered = [...commitments].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  for (let later = 0; later < ordered.length; later += 1) {
    for (let earlier = 0; earlier < later; earlier += 1) {
      const a = ordered[earlier]!;
      const b = ordered[later]!;
      if (!overlaps(a, b)) continue;

      for (const equipmentId of b.machineIds) {
        if (!a.machineIds.includes(equipmentId)) continue;
        const machine = byId.get(equipmentId);
        if (!machine) continue;

        clashes.push({
          bookingId: b.bookingId,
          label: b.label,
          startAt: b.startAt,
          kind: 'DOUBLE_BOOKED',
          equipmentId,
          machineName: machine.name,
          againstBookingId: a.bookingId,
          againstLabel: a.label,
        });
      }
    }
  }

  return clashes.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * Certificates that run out inside a window somebody is planning.
 *
 * Not a clash: nothing is booked against them yet, and that is exactly why it
 * is worth saying. A workshop looking at the fortnight ahead should see that
 * the air-conditioning station lapses on Thursday while there is still time to
 * book the engineer rather than cancel the work.
 */
export function lapsingBetween(
  machines: readonly SchedulableMachine[],
  from: Date,
  to: Date,
): { equipmentId: string; name: string; on: Date }[] {
  return machines
    .flatMap((machine) => {
      const on = machine.facts.certificateExpiresAt;
      if (!on || machine.facts.retired) return [];
      if (on.getTime() < from.getTime() || on.getTime() > to.getTime()) return [];
      return [{ equipmentId: machine.equipmentId, name: machine.name, on }];
    })
    .sort((a, b) => a.on.getTime() - b.on.getTime());
}

/**
 * Whether a proposed booking could be honoured, for the moment of booking.
 *
 * The same question as `clashesAmong` asked about one commitment that does not
 * exist yet, so a workshop taking an appointment over the telephone learns
 * before the customer hangs up.
 */
export function couldPromise(
  proposed: Commitment,
  existing: readonly Commitment[],
  machines: readonly SchedulableMachine[],
): { ok: boolean; clashes: Clash[] } {
  const clashes = clashesAmong([...existing, proposed], machines).filter(
    (clash) => clash.bookingId === proposed.bookingId,
  );
  return { ok: clashes.length === 0, clashes };
}
