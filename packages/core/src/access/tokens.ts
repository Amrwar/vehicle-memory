/**
 * Proving an address, and getting back in when the password is gone.
 *
 * Both are the same mechanism with different windows: a random capability sent
 * to an address, redeemable once, expiring on its own. What makes them worth
 * writing carefully is that each is a way into somebody's account, and the
 * mistakes are all quiet ones.
 *
 * Four rules, and each exists because leaving it out is a real attack rather
 * than a theoretical one.
 *
 * A request never says whether the address exists. A form that answers "no
 * such account" is a way to find out who banks where, and it takes about an
 * hour to enumerate a customer list through one.
 *
 * A token is single use and short lived. Password reset links end up in
 * forwarded mail, shared inboxes and browser history, and one that still works
 * a week later is a spare key under the mat.
 *
 * Issuing a new one retires the old. Otherwise every link ever sent stays
 * live, and the window is not the expiry any more, it is the whole history.
 *
 * Redeeming a reset ends every session. Somebody resetting a password is
 * often doing it because they think another person has it, and leaving that
 * person signed in defeats the point entirely.
 */

export type TokenPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

/**
 * How long each kind lives.
 *
 * A reset is an hour because it is a key to an account and the person asked
 * for it thirty seconds ago. Verification is three days because it is proof of
 * an address rather than a way in, and somebody signing up on a Friday should
 * not have to start again on Monday.
 */
export const TOKEN_LIFETIME_MINUTES: Record<TokenPurpose, number> = {
  PASSWORD_RESET: 60,
  EMAIL_VERIFICATION: 60 * 24 * 3,
};

/** How many may be asked for in an hour before it is somebody else asking. */
export const MAX_REQUESTS_PER_HOUR = 5;

export class TokenError extends Error {
  constructor(
    readonly code: 'EXPIRED' | 'USED' | 'UNKNOWN' | 'TOO_MANY' | 'WEAK_PASSWORD' | 'SAME_PASSWORD',
    message: string,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

export interface IssuedToken {
  purpose: TokenPurpose;
  expiresAt: Date;
  usedAt: Date | null;
}

export function expiryFor(purpose: TokenPurpose, now = new Date()): Date {
  return new Date(now.getTime() + TOKEN_LIFETIME_MINUTES[purpose] * 60_000);
}

/**
 * Whether a token may be redeemed.
 *
 * Used is checked before expired, because a token somebody already spent is a
 * different event from one that ran out, and the second is likelier to be an
 * honest mistake worth a gentler message.
 */
export function assertTokenUsable(token: IssuedToken | null, now = new Date()): void {
  if (!token) {
    throw new TokenError(
      'UNKNOWN',
      'That link is not one of ours, or it has been replaced by a newer one.',
    );
  }

  if (token.usedAt) {
    throw new TokenError('USED', 'That link has already been used. Ask for a new one.');
  }

  if (token.expiresAt <= now) {
    const hours = TOKEN_LIFETIME_MINUTES[token.purpose] / 60;

    throw new TokenError(
      'EXPIRED',
      hours < 24
        ? `That link only lasts ${hours} hour${hours === 1 ? '' : 's'}. Ask for another and it will work.`
        : 'That link has expired. Ask for another and it will work.',
    );
  }
}

/** Whether somebody is asking too often for it to be them. */
export function assertNotFlooding(recentRequests: number): void {
  if (recentRequests >= MAX_REQUESTS_PER_HOUR) {
    throw new TokenError(
      'TOO_MANY',
      'That has been asked for several times in the last hour. Check the messages already sent before asking again.',
    );
  }
}

/**
 * What a form says after a reset is requested.
 *
 * Deliberately identical whether the address exists or not. The alternative
 * is an oracle that tells anybody which addresses have accounts, and a
 * customer list is exactly what somebody would want out of a workshop.
 */
export const RESET_REQUESTED_MESSAGE =
  'If that address has an account, a link is on its way. It lasts an hour, and asking again replaces it.';

export interface PasswordCheck {
  ok: boolean;
  problem?: string;
}

/**
 * Whether a new password is good enough.
 *
 * Length rather than character classes. A twelve-character phrase somebody
 * remembers beats eight characters with a digit and a symbol they wrote on a
 * card taped to the monitor, and the composition rules are what produce the
 * card.
 */
export const RESET_MIN_PASSWORD_LENGTH = 12;

const OBVIOUS = [
  'password',
  'passw0rd',
  'letmein',
  'qwerty',
  '111111',
  '123456',
  'welcome',
  'carnet',
  'workshop',
  'garage',
];

export function checkPassword(password: string, email?: string | null): PasswordCheck {
  const value = password.trim();

  if (value.length < RESET_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      problem: `Passwords need at least ${RESET_MIN_PASSWORD_LENGTH} characters. A short phrase you will remember is stronger than a short word with a number after it.`,
    };
  }

  const lowered = value.toLowerCase();

  if (OBVIOUS.some((needle) => lowered.includes(needle))) {
    return {
      ok: false,
      problem: 'That contains a word which appears in every list attackers try first.',
    };
  }

  const local = email?.split('@')[0]?.toLowerCase();

  // A password containing the address it protects is one guess away from
  // anybody who knows the address, which is everybody who has been emailed.
  if (local && local.length >= 4 && lowered.includes(local)) {
    return { ok: false, problem: 'That contains your own email address.' };
  }

  // Something typed by holding one key down looks long and is not.
  if (/^(.)\1+$/.test(value)) {
    return { ok: false, problem: 'That is one character repeated.' };
  }

  return { ok: true };
}

/**
 * What an unverified account may still do.
 *
 * Everything, for now, and the banner says so. Locking somebody out of the
 * product they just signed up for because a message is sitting in a spam
 * folder loses the customer rather than protecting them. What verification
 * gates is sending on their behalf, which is where an unproven address
 * actually costs something: a workshop that cannot receive its own bounces.
 */
export function unverifiedWarning(daysSinceSignup: number): string | null {
  if (daysSinceSignup < 1) return null;

  if (daysSinceSignup < 7) {
    return 'Your email address has not been confirmed yet. Until it is, we cannot tell you when a message to a customer bounces.';
  }

  return 'Your email address still has not been confirmed. Anything sent on your behalf may be treated as spam, and you will not hear about it.';
}
