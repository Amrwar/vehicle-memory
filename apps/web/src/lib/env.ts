import { z } from 'zod';

/**
 * Environment validation.
 *
 * Parsed once, at startup, so a missing secret fails the boot with a message
 * naming the variable rather than failing the first request that happens to
 * need it, at 4pm, in production.
 */
/**
 * The application's own public origin, used to build the absolute links that
 * go out in estimate and passport messages.
 *
 * Set APP_URL explicitly once there is a real domain. Until then it is derived
 * from the host's own variables, which is better than a hard-coded value in
 * two ways: it is correct before a domain exists, and on a preview deployment
 * it points at *that* preview rather than at production. An approval link in a
 * test email that opens the live site is a genuinely confusing bug.
 */
function inferAppUrl(): string | undefined {
  if (process.env.APP_URL) return process.env.APP_URL;

  // Vercel supplies these automatically; neither includes a protocol.
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelDeployment = process.env.VERCEL_URL;

  if (process.env.VERCEL_ENV === 'production' && vercelProduction) {
    return `https://${vercelProduction}`;
  }
  if (vercelDeployment) return `https://${vercelDeployment}`;

  return undefined;
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('Carnet'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Generate: openssl rand -base64 48'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  // Share and estimate-approval links are capability URLs: 32 random bytes,
  // stored only as a SHA-256 digest. The token is the credential, so there is
  // no signing secret to configure. If links ever become HMAC-signed, the
  // secret introduced for it must not start with PUBLIC_ — several frameworks
  // reserve that prefix for client-exposed values, and Vercel refuses to keep
  // such a variable secret.

  LEDGER_CHAIN_SALT: z
    .string()
    .min(16, 'LEDGER_CHAIN_SALT must be at least 16 characters and must never be rotated'),

  // Shared with the scheduler. Absent means the cron routes refuse every
  // request, which is the right failure: they send messages to customers and
  // close people's timesheets, so an open URL would hand both to anybody.
  CRON_SECRET: z.string().min(16).optional(),

  // Signs the inbound mail webhook. Absent means inbound is refused outright,
  // which is the right failure: the endpoint writes rows into a workshop's
  // inbox, and an inbox anybody can write to is one nobody can trust.
  INBOUND_WEBHOOK_SECRET: z.string().min(16).optional(),

  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  SMS_TRANSPORT: z.enum(['console', 'twilio']).default('console'),
  MAIL_FROM: z.string().default('Carnet <no-reply@carnet.local>'),

  // Where replies go. The product sends as one verified address for every
  // workshop, and a reply has to reach the workshop that sent it, so each
  // message carries a Reply-To of <workshop slug>@<this domain>. Absent means
  // replies go back to MAIL_FROM, which is right for a single-workshop install
  // and wrong for a network.
  REPLY_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  FEATURE_CUSTOMER_PORTAL: z.coerce.boolean().default(true),
  FEATURE_VEHICLE_PASSPORT: z.coerce.boolean().default(true),
  FEATURE_INVENTORY: z.coerce.boolean().default(false),
  FEATURE_ACCOUNTING: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({ ...process.env, APP_URL: inferAppUrl() });

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Environment is not configured correctly:\n${problems}\n\n` +
        'Copy .env.example to .env and fill in the missing values.',
    );
  }

  cached = parsed.data;
  return cached;
}

export const isProduction = (): boolean => env().NODE_ENV === 'production';
