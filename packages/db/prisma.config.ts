import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of schema.prisma. The CLI reads it
 * from here for migrate, introspect and studio; the runtime client gets a
 * driver adapter instead (see src/client.ts).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations use DIRECT_DATABASE_URL when it is set, falling back to
    // DATABASE_URL. On a pooled provider such as Neon or Supabase, the runtime
    // connects through the pooler while migrations must not: a pooler in
    // transaction mode cannot hold the advisory lock Prisma Migrate takes, and
    // the migration hangs or fails in a way that is hard to read.
    //
    // Read lazily rather than through env(), which throws when the variable is
    // absent. `prisma generate` needs no database and runs during
    // `npm install` on build servers where nothing is set yet.
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
