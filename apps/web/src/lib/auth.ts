import {
  DEFAULT_REGION,
  type Region,
  type Role,
  safeLocale,
  type Subscription,
  subscriptionDatesOf,
  subscriptionStateOf,
} from '@carnet/core';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { prisma } from '@carnet/db';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import { env } from './env';

/**
 * Authentication and session handling.
 *
 * A first-party session rather than an off-the-shelf provider. The rationale
 * and the migration path to OpenID Connect are in ADR-0006; the short version
 * is that credentials plus a database adapter is the one combination those
 * libraries handle worst, and this is a small, well-understood surface.
 *
 * The session token is random, never derived from user data. Only its SHA-256
 * digest is stored, so a database disclosure does not hand over live sessions.
 */

const COOKIE = 'carnet_session';
const BCRYPT_COST = 12;

/* --- passwords ------------------------------------------------------------ */

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/* --- tokens --------------------------------------------------------------- */

function issueToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: digest(token) };
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* --- rate limiting -------------------------------------------------------- */

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function isRateLimited(email: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const failures = await prisma.loginAttempt.count({
    where: {
      succeeded: false,
      createdAt: { gte: since },
      OR: [{ email: email.toLowerCase() }, ...(ip ? [{ ip }] : [])],
    },
  });

  return failures >= MAX_ATTEMPTS;
}

export async function recordAttempt(
  email: string,
  ip: string | null,
  succeeded: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), ip, succeeded },
  });
}

/* --- sign in and out ------------------------------------------------------ */

export type SignInResult =
  { ok: true; role: Role; orgId: string | null } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = headerList.get('user-agent') ?? null;

  if (await isRateLimited(email, ip)) {
    return {
      ok: false,
      error: 'Too many attempts. Wait fifteen minutes and try again.',
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      memberships: {
        where: { isActive: true },
        include: { org: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  // Always run a comparison, even when the account does not exist, so the
  // response time does not disclose whether an email is registered.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const passwordOk = await verifyPassword(password, hash);

  if (!user || !user.isActive || !passwordOk) {
    await recordAttempt(email, ip, false);
    return { ok: false, error: 'That email and password do not match.' };
  }

  const membership = user.memberships[0];

  await startSession(user.id, { ip, userAgent });
  await recordAttempt(email, ip, true);

  return {
    ok: true,
    role: (membership?.role ?? 'CUSTOMER') as Role,
    orgId: membership?.orgId ?? null,
  };
}

/**
 * Issues a session and sets the cookie.
 *
 * One place, used by signing in and by signing up. Two copies of this drift,
 * and the copy that drifts is the one nobody looks at: a sign-up path that
 * quietly sets a cookie without the secure flag, or with the wrong expiry, is
 * not something a test notices.
 */
export async function startSession(
  userId: string,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const membership = await prisma.membership.findFirst({
    where: { userId, isActive: true },
    select: { orgId: true },
  });

  const { token, tokenHash } = issueToken();
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 3_600_000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      orgId: membership?.orgId ?? null,
      expiresAt,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: digest(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  store.delete(COOKIE);
}

/* --- current session ------------------------------------------------------ */

export interface CurrentUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  orgSlug: string | null;
  /** The organisation's plan, so a page can gate on it without a second query. */
  orgPlan: string | null;
  locationId: string | null;
  sessionId: string;
  /** The organisation's region: what money and dates are formatted by. */
  region: Region;
  /** Where the workshop stands with us. Null for a portal-only person. */
  subscription: Subscription | null;
}

/**
 * Cached per request, so a page that checks permissions in five places
 * queries once.
 */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: digest(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { isActive: true },
            include: {
              org: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  plan: true,
                  country: true,
                  baseCurrency: true,
                  locale: true,
                  timezone: true,
                  trialEndsAt: true,
                  subscribedAt: true,
                  suspendedAt: true,
                  cancelledAt: true,
                  billingSubscriptionRef: true,
                  billingStatus: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  const membership =
    session.user.memberships.find((m) => m.orgId === session.orgId) ?? session.user.memberships[0];

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (membership?.role ?? 'CUSTOMER') as Role,
    orgId: membership?.orgId ?? null,
    orgName: membership?.org.name ?? null,
    orgSlug: membership?.org.slug ?? null,
    orgPlan: membership?.org.plan ?? null,
    locationId: membership?.locationId ?? null,
    sessionId: session.id,
    region: membership
      ? {
          country: membership.org.country,
          currency: membership.org.baseCurrency,
          locale: safeLocale(membership.org.locale, DEFAULT_REGION.locale),
          timezone: membership.org.timezone,
        }
      : DEFAULT_REGION,
    subscription: membership ? subscriptionStateOf(subscriptionDatesOf(membership.org)) : null,
  };
});

/** Constant-time comparison for public link tokens. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/* --- public share links --------------------------------------------------- */

export function issueShareToken(): { token: string; tokenHash: string } {
  // 32 bytes, well beyond the 128 bits NFR-410 requires.
  return issueToken();
}

export function hashShareToken(token: string): string {
  return digest(token);
}
