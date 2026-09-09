import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client/index';

export * from './generated/client/index';
export { PrismaClient };

/**
 * Prisma 7 takes a driver adapter rather than a connection string. The pool is
 * created once per process; Next.js recreates modules on every hot reload in
 * development, so the instance is cached on globalThis to avoid exhausting
 * Postgres connections after a dozen edits.
 */
const globalForPrisma = globalThis as unknown as {
  carnetPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill it in, ' +
        'then start Postgres with: docker compose up -d postgres',
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // A workshop has a handful of concurrent users; a large pool here would
    // starve the database for no benefit. Raise deliberately, with evidence.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });
}

export const prisma: PrismaClient = globalForPrisma.carnetPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.carnetPrisma = prisma;
}
