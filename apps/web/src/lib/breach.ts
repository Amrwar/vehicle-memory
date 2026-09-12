import { breachCount, describeBreach, passwordRange } from '@carnet/core';

import { env } from './env';

/**
 * Refusing a password that has already leaked. Security model T1, Phase 21.
 *
 * Have I Been Pwned's range API, by k-anonymity: five characters of the
 * digest go out, a list of suffixes comes back, and the comparison happens
 * here. The service never sees the password or its full digest.
 *
 * Fails open. A sign-up that cannot complete because a third party is slow
 * is a worse failure than one weak password getting through, and the
 * outcome is logged either way so the gap is visible.
 */

export type RangeFetcher = (prefix: string) => Promise<string | null>;

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function fetchRange(prefix: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Carnet' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The reason a password must not be used, or null. `fetcher` is for the
 * probe, which must not call the real service on every run.
 */
export async function breachedPasswordProblem(
  password: string,
  fetcher: RangeFetcher = fetchRange,
): Promise<string | null> {
  if (env().PASSWORD_BREACH_CHECK === 'off') return null;

  const { prefix, suffix } = passwordRange(password);
  const body = await fetcher(prefix);

  if (body === null) {
    console.warn(
      JSON.stringify({
        time: new Date().toISOString(),
        level: 'warn',
        event: 'breach.check.unavailable',
      }),
    );
    return null;
  }

  const count = breachCount(body, suffix);
  return count > 0 ? describeBreach(count) : null;
}
