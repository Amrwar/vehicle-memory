import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

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
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
