import {
  ApiKeyError,
  assertKeyNameable,
  assertKeyUsable,
  bearerToken,
  hashApiKey,
  issueApiKey,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * API keys, against the database.
 *
 * Issued once and shown once; only the digest is stored. A request that
 * carries a key is answered as that key's organisation and nothing else.
 */

export { ApiKeyError };

/** Issues a key. The token is returned exactly once. */
export async function createApiKey(input: { orgId: string; userId: string; name: string }) {
  assertKeyNameable(input.name);

  const issued = issueApiKey();

  const key = await prisma.apiKey.create({
    data: {
      orgId: input.orgId,
      name: input.name.trim(),
      prefix: issued.prefix,
      keyHash: issued.hash,
      createdByUserId: input.userId,
    },
    select: { id: true, name: true, prefix: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'apikey.created',
    entityType: 'ApiKey',
    entityId: key.id,
    after: { name: key.name, prefix: key.prefix },
  });

  return { ...key, token: issued.token };
}

export async function revokeApiKey(input: {
  orgId: string;
  userId: string;
  keyId: string;
}): Promise<void> {
  const key = await prisma.apiKey.findFirst({
    where: { id: input.keyId, orgId: input.orgId, revokedAt: null },
    select: { id: true, name: true },
  });

  if (!key) return;

  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'apikey.revoked',
    entityType: 'ApiKey',
    entityId: key.id,
    after: { name: key.name },
  });
}

export async function apiKeysFor(orgId: string) {
  return prisma.apiKey.findMany({
    where: { orgId },
    orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

/**
 * The organisation behind a request, or a refusal.
 *
 * Last use is recorded so a list of keys shows which are alive. The update is
 * not awaited on the request's critical path beyond the write itself: one
 * extra row touch per call is the price of knowing what a key is doing.
 */
export async function authenticateApiKey(
  request: Request,
): Promise<{ orgId: string; keyId: string }> {
  const token = bearerToken(request.headers.get('authorization'));

  if (!token) {
    throw new ApiKeyError('MISSING', 'Send the key as "Authorization: Bearer cn_…".');
  }

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    select: { id: true, orgId: true, revokedAt: true },
  });

  assertKeyUsable(key);

  await prisma.apiKey.update({ where: { id: key!.id }, data: { lastUsedAt: new Date() } });

  return { orgId: key!.orgId, keyId: key!.id };
}

/** The shape every refusal takes, so an integrator can rely on it. */
export function apiRefusal(error: unknown): Response {
  if (error instanceof ApiKeyError) {
    const status = error.code === 'MISSING' ? 401 : error.code === 'NO_NAME' ? 400 : 403;
    return Response.json({ error: error.code, message: error.message }, { status });
  }

  return Response.json(
    { error: 'FAILED', message: 'The request could not be completed.' },
    { status: 500 },
  );
}
