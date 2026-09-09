import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * APP_URL inference.
 *
 * The interesting case is a preview deployment: an estimate approval link in a
 * test email must open that preview, not production. Getting this wrong is
 * confusing rather than loud, which is exactly why it is worth a test.
 */

const CLEARED = ['APP_URL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const;

let saved: Record<string, string | undefined>;

async function loadAppUrl(): Promise<string> {
  // The module caches its parse, so it must be re-imported per case.
  vi.resetModules();
  const { env } = await import('./env');
  return env().APP_URL;
}

beforeEach(() => {
  saved = Object.fromEntries(
    [...CLEARED, 'NODE_ENV', 'DATABASE_URL', 'AUTH_SECRET', 'LEDGER_CHAIN_SALT'].map((key) => [
      key,
      process.env[key],
    ]),
  );

  for (const key of CLEARED) delete process.env[key];

  // The other required variables, so validation passes and we are testing the
  // one thing this file is about.
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
  process.env.AUTH_SECRET = 'a'.repeat(40);
  process.env.LEDGER_CHAIN_SALT = 'b'.repeat(20);
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe('APP_URL', () => {
  it('falls back to localhost when nothing is set', async () => {
    await expect(loadAppUrl()).resolves.toBe('http://localhost:3000');
  });

  it('uses the deployment URL on a preview, so links open that preview', async () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'carnet-abc123-amrwar.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vehicle-memory.vercel.app';

    await expect(loadAppUrl()).resolves.toBe('https://carnet-abc123-amrwar.vercel.app');
  });

  it('uses the stable production domain in production, not the deployment hash', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'carnet-xyz789-amrwar.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vehicle-memory.vercel.app';

    await expect(loadAppUrl()).resolves.toBe('https://vehicle-memory.vercel.app');
  });

  it('prefers an explicit APP_URL over anything the host supplies', async () => {
    process.env.APP_URL = 'https://carnet.co.uk';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'vehicle-memory.vercel.app';

    await expect(loadAppUrl()).resolves.toBe('https://carnet.co.uk');
  });

  it('adds the protocol, which the host variables omit', async () => {
    process.env.VERCEL_URL = 'example.vercel.app';
    const url = await loadAppUrl();

    expect(url.startsWith('https://')).toBe(true);
    expect(url).not.toContain('https://https://');
  });
});
