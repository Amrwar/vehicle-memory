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

function resolveClient(): PrismaClient {
  const existing = globalForPrisma.carnetPrisma;
  if (existing) return existing;

  const client = createClient();

  // Cached in every environment, not only development. A serverless invocation
  // reuses the module between requests, and building a new pool per request
  // exhausts Postgres connections within minutes.
  globalForPrisma.carnetPrisma = client;
  return client;
}

/**
 * Constructed on first use rather than at import.
 *
 * `next build` walks the module graph to collect page data, which imports this
 * file. Creating the client there would make the build depend on a database
 * URL that only the running application needs, and the build fails on any host
 * where the variable is set at runtime rather than at build time — Vercel, for
 * one.
 *
 * The proxy keeps the ergonomics of a plain client: `prisma.job.findMany()`
 * works exactly as before, and the connection is opened the first time
 * something actually asks for data.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = resolveClient();
    const value = Reflect.get(client, property, receiver);
    // Methods must keep their binding: prisma.$transaction(...) relies on it.
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(resolveClient(), property);
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(resolveClient());
  },
});
