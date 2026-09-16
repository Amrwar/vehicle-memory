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
  // Card payments through a provider (Phase 32). The stub takes pretend
  // money until keys are put in; its webhook is signed with PAYMENT_WEBHOOK_SECRET.
  PAYMENT_PROVIDER: z.enum(['stub', 'stripe']).default('stub'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // The provider's own recurring prices per plan, per bay per month. Without
  // them the subscription checkout prices the plan inline from core.
  STRIPE_PRICE_CORE: z.string().min(1).optional(),
  STRIPE_PRICE_COMPLETE: z.string().min(1).optional(),
  STRIPE_PRICE_GROUP: z.string().min(1).optional(),

  // Providers behind seams (Phase 43). The VIN decoder built in reads the
  // maker and year from the VIN alone; 'nhtsa' asks the US registry's free
  // public decoder for the model, engine and body too. The sample fitment
  // feed knows the demonstration parts only and says nothing about any
  // other; 'none' hides the fetch. The review site is where a customer who
  // gave five stars is sent, once the workshop has named its listing.
  VIN_DECODER: z.enum(['stub', 'nhtsa']).default('stub'),
  FITMENT_FEED: z.enum(['none', 'sample']).default('sample'),
  REVIEW_SITE: z.enum(['none', 'google']).default('google'),

  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  SMS_TRANSPORT: z.enum(['console', 'twilio']).default('console'),
  MAIL_FROM: z.string().default('Carnet <no-reply@carnet.local>'),

  // Where the product writes to whoever runs it: a new workshop signing up,
  // and anything else the operator would want to know before a customer
  // tells them. Unset means nobody is told, which is the right default for a
  // developer's machine and for anybody else running this.
  OPERATOR_EMAIL: z.string().email().optional(),

  // Where replies go. The product sends as one verified address for every
  // workshop, and a reply has to reach the workshop that sent it, so each
  // message carries a Reply-To of <workshop slug>@<this domain>. Absent means
  // replies go back to MAIL_FROM, which is right for a single-workshop install
  // and wrong for a network.
  REPLY_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Refuse a password that has already leaked, by k-anonymity against Have I
  // Been Pwned. On in production; off elsewhere so tests and probes do not
  // call a third party. The check fails open and logs when the service is
  // unreachable.
  PASSWORD_BREACH_CHECK: z
    .enum(['on', 'off'])
    .default(process.env.NODE_ENV === 'production' ? 'on' : 'off'),

  // Generated text is a port, like mail. 'none' means every summary is the
  // plain one composed from the record, which is a complete feature rather
  // than a degraded one. 'anthropic' lets a model tidy the prose, and its
  // output is checked against the record before a customer sees it.
  AI_TRANSPORT: z.enum(['none', 'anthropic']).default('none'),
  AI_MODEL: z.string().default('claude-sonnet-5'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

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
