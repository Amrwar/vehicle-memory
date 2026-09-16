/**
 * What happens when the same write arrives twice. Phase 46.
 *
 * Nothing in this file is a feature. It is the vocabulary the rest of the
 * phase argues in, because "is it idempotent?" is a question with four
 * different answers depending on who is asking, and a product that cannot say
 * which one it means will eventually take a customer's money twice and have a
 * meeting about it.
 *
 * The question a write has to answer is narrow: the same request arrives
 * again — a double-click, a refresh mid-submit, a back button, a webhook the
 * provider retried, a worker that crashed after doing the work and before the
 * tick that said so — and what happens the second time?
 *
 * There are only three honest answers.
 *
 *   HARMLESS  The second one changes nothing. Setting a field to the value it
 *             already holds. Marking something read that is read.
 *
 *   GUARDED   The second one is stopped, by something that can be named and
 *             pointed at: a unique index, a status that has already moved, a
 *             key written before the work.
 *
 *   ONE_ONLY  The second one would do it again, and doing it again would be
 *             wrong. This is not a disposition a write is allowed to keep. It
 *             is what a write is called while somebody is still fixing it.
 *
 * The distinction that matters is between GUARDED and ONE_ONLY, and it is not
 * a judgement. A guard is a thing in the code or the database that another
 * person can read. "It is fine because the user would not do that" is not a
 * guard; it is a hope, and this file will not accept it as one.
 */

export type Repeat = 'HARMLESS' | 'GUARDED' | 'ONE_ONLY';

/** What a guard is made of, so a register cannot be filled with adjectives. */
export type GuardKind =
  /** A unique index or constraint. The database refuses the second write. */
  | 'CONSTRAINT'
  /** A key written before the work and checked before it is repeated. */
  | 'KEY'
  /** The record has already moved on, and the rule refuses to move it back. */
  | 'STATE'
  /**
   * The write is a set rather than a change: the second one lands
   * identically. The only kind a HARMLESS write may name, because it is the
   * only one that explains harmlessness rather than prevention.
   */
  | 'OVERWRITE';

export class RepeatError extends Error {
  constructor(
    readonly code: 'NO_NAME' | 'NO_SENTENCE' | 'NO_GUARD' | 'GUARD_WITHOUT_NEED' | 'UNGUARDED',
    message: string,
  ) {
    super(message);
    this.name = 'RepeatError';
  }
}

export interface WriteSafety {
  /** What the write is called where it lives, e.g. `recordPayment()`. */
  name: string;
  /** Where it is, so the sentence can be checked against the code. */
  where: string;
  repeat: Repeat;
  /** Required for GUARDED: the kind of guard, and the thing itself. */
  guard?: { kind: GuardKind; named: string };
  /**
   * One sentence, in the product's own words, about what the second one does.
   * Written for somebody deciding whether it is safe to press again, not for
   * somebody who already knows the answer.
   */
  says: string;
}

/**
 * Checks a declaration is a declaration rather than a gesture.
 *
 * A guarded write that cannot name its guard is an unguarded write with a
 * confident comment above it, and those are the ones that fail in production,
 * because everybody who read the comment stopped looking.
 */
export function assertDeclared(write: WriteSafety): void {
  if (!write.name.trim() || !write.where.trim()) {
    throw new RepeatError('NO_NAME', 'A write is declared by name and by where it lives.');
  }

  if (write.says.trim().length < 20) {
    throw new RepeatError(
      'NO_SENTENCE',
      `${write.name}: say what the second one does, in a sentence somebody can act on.`,
    );
  }

  if (write.repeat === 'GUARDED' && !write.guard?.named.trim()) {
    throw new RepeatError(
      'NO_GUARD',
      `${write.name} says it is guarded but does not name the guard. A guard that cannot be pointed at is a hope.`,
    );
  }

  // A harmless write may still say why it is harmless, and the only reason
  // that counts is that it is a set rather than a change. Anything else
  // claiming to be harmless while naming a constraint or a claim is really a
  // guarded write that has been described as a quiet one.
  if (write.repeat === 'HARMLESS' && write.guard && write.guard.kind !== 'OVERWRITE') {
    throw new RepeatError(
      'GUARD_WITHOUT_NEED',
      `${write.name} says a repeat is harmless but names a ${write.guard.kind} guard. A write that needs stopping is guarded, not harmless.`,
    );
  }

  if (write.repeat === 'ONE_ONLY' && write.guard) {
    throw new RepeatError(
      'GUARD_WITHOUT_NEED',
      `${write.name} names a guard and says it would repeat anyway. One of the two is wrong.`,
    );
  }
}

/**
 * The rule the phase is held to: nothing ships as ONE_ONLY.
 *
 * Kept separate from the declaration check so that a write can be honestly
 * described as dangerous while somebody is in the middle of fixing it, and
 * the build still says so.
 */
export function assertShippable(writes: readonly WriteSafety[]): void {
  const open = writes.filter((write) => write.repeat === 'ONE_ONLY');

  if (open.length > 0) {
    throw new RepeatError(
      'UNGUARDED',
      `${open.length} write(s) would do it again if the request arrived twice: ${open
        .map((write) => write.name)
        .join(', ')}.`,
    );
  }
}

/** One line for the register, as a person would read it out. */
export function describeRepeat(write: WriteSafety): string {
  if (write.repeat === 'HARMLESS') {
    return write.guard
      ? `${write.name}: ${write.says} (${describeGuard(write.guard)})`
      : `${write.name}: ${write.says}`;
  }
  if (write.repeat === 'ONE_ONLY') return `${write.name}: NOT SAFE — ${write.says}`;
  return `${write.name}: ${write.says} (${describeGuard(write.guard!)})`;
}

export function describeGuard(guard: { kind: GuardKind; named: string }): string {
  switch (guard.kind) {
    case 'CONSTRAINT':
      return `refused by ${guard.named}`;
    case 'KEY':
      return `held off by ${guard.named}`;
    case 'STATE':
      return `already moved on: ${guard.named}`;
    case 'OVERWRITE':
      return `lands identically: ${guard.named}`;
  }
}

/** How the register reads as a whole, for the top of the page and the deck. */
export function repeatTally(writes: readonly WriteSafety[]): {
  total: number;
  harmless: number;
  guarded: number;
  open: number;
  byGuard: Record<GuardKind, number>;
} {
  const byGuard: Record<GuardKind, number> = {
    CONSTRAINT: 0,
    KEY: 0,
    STATE: 0,
    OVERWRITE: 0,
  };

  for (const write of writes) {
    if (write.guard) byGuard[write.guard.kind] += 1;
  }

  return {
    total: writes.length,
    harmless: writes.filter((write) => write.repeat === 'HARMLESS').length,
    guarded: writes.filter((write) => write.repeat === 'GUARDED').length,
    open: writes.filter((write) => write.repeat === 'ONE_ONLY').length,
    byGuard,
  };
}

/* ---------------------------------------------------------------------------
   Keys
   --------------------------------------------------------------------------- */

/**
 * The key a repeated request is recognised by.
 *
 * Built from what the request is about rather than from when it arrived, so
 * that the same intent produces the same key on a second attempt: a form
 * submitted twice, a webhook retried an hour later, a worker restarted after
 * a crash. Anything in it that changes between attempts — a timestamp, a
 * random token minted at send — makes the key useless, because two attempts
 * at one thing then look like two things.
 */
export function repeatKey(parts: readonly (string | number | null | undefined)[]): string {
  const key = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':');

  if (key.length < 3) {
    throw new RepeatError('NO_NAME', 'A key needs something in it to recognise a repeat by.');
  }

  return key.slice(0, 200);
}

/**
 * How long a claimed key is worth keeping.
 *
 * Long enough to outlast every retry anybody sends: a provider's webhook
 * backoff runs for days, a person pressing a stuck button gives up in
 * seconds, and a worker restarted after a crash comes back inside an hour.
 * Short enough that the table does not become a second copy of the ledger.
 */
export const KEY_KEPT_FOR_DAYS = 30;

export function keyExpiry(at = new Date()): Date {
  return new Date(at.getTime() + KEY_KEPT_FOR_DAYS * 86_400_000);
}
