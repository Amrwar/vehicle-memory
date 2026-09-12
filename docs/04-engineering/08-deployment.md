# Deployment

## 1. What this application needs

Four things, and the shape of the application decides where each can live.

| Need                                  | Why                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| A Node runtime for the web app        | Server components render per request; almost nothing is static                             |
| PostgreSQL                            | Partial indexes, constraint triggers, `NUMERIC` money. Not optional and not substitutable. |
| A long-running process for the worker | Outbox dispatch, chain audit, reminders. It polls, so it cannot be serverless.             |
| Object storage                        | Inspection photographs, which are the trust mechanism of the whole product                 |

The worker is the constraint people miss. A platform that only runs request
handlers can host the web app but not the worker, so the worker needs a home of
its own or the outbox never drains.

## 2. Recommended shape

```
  Vercel              apps/web        request handlers, preview deployments
  Neon                PostgreSQL      pooled at runtime, direct for migrations
  Railway or Render   apps/worker     one always-on container
  Cloudflare R2       photographs     no egress charge
  Resend              email
  Sentry              errors
```

At design-partner scale this is roughly £0 to £40 per month in total, rising
with photograph storage more than with anything else.

### Why Neon specifically

- Serverless Postgres with built-in pooling, which matters because serverless
  functions open connections faster than a fixed-size pool expects.
- **Database branching** gives every Vercel preview deployment its own copy of
  the data. For a schema of 73 tables with triggers, that is the difference
  between reviewing a migration and hoping about it.
- Scales to zero, so a staging database costs nothing when nobody is using it.

The alternative worth considering is **Supabase**, which bundles Postgres,
storage and auth. We use our own auth (ADR-0006), so most of that bundle goes
unused, and Neon's branching is the more useful feature here.

If you would rather have one bill and one dashboard, **Railway** hosts the web
app, the worker and Postgres together. Simpler to operate, weaker at previews.

## 3. Setting it up

### Neon

1. Create a project and a database named `carnet`.
2. Copy **both** connection strings. They differ, and the difference matters:

   | Variable              | Which string                         |
   | --------------------- | ------------------------------------ |
   | `DATABASE_URL`        | Pooled. The host contains `-pooler`. |
   | `DIRECT_DATABASE_URL` | Direct. No `-pooler`.                |

   Migrations must not go through a transaction-mode pooler. It cannot hold the
   advisory lock Prisma Migrate takes, and the migration hangs in a way that is
   hard to diagnose. `prisma.config.ts` already prefers the direct URL when it
   is set.

### Vercel

1. Import the repository. Leave the root directory at the repository root, or
   set it to `apps/web`. The build works either way, because `apps/web` has a
   `prebuild` hook that generates the Prisma client.
2. Set these for both Production and Preview:

   | Variable              | Value                                          |
   | --------------------- | ---------------------------------------------- |
   | `DATABASE_URL`        | Neon pooled connection string                  |
   | `DIRECT_DATABASE_URL` | Neon direct connection string                  |
   | `AUTH_SECRET`         | `openssl rand -base64 48`                      |
   | `LEDGER_CHAIN_SALT`   | `openssl rand -base64 32`                      |
   | `APP_URL`             | Optional. Leave unset until you have a domain. |
   | `NODE_ENV`            | `production`                                   |

3. Deploy.

`APP_URL` is deliberately absent from that list. Until you have a domain,
leaving it unset is better than guessing: the application derives its own
origin from `VERCEL_PROJECT_PRODUCTION_URL` in production and `VERCEL_URL` on
previews, so an approval link generated on a preview deployment opens that
preview rather than production. Set `APP_URL` explicitly once a real domain
exists, and it overrides both.

> **`LEDGER_CHAIN_SALT` must never change once events exist.**
>
> Rotating it invalidates every vehicle's hash chain, and there is no way back.
> Set it once, record it somewhere that resists casual editing, and treat it as
> permanent. This is the single most damaging configuration mistake available
> in this system.

### Migrations

Deliberately not run automatically on deploy. A migration that runs itself
during a rolling deploy is a migration nobody reviewed.

```bash
DIRECT_DATABASE_URL="postgresql://..." npm run db:deploy
```

Every migration is backward compatible with the previous release (NFR-309), so
this can run before or after the code deploys.

To populate a demonstration environment:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

Never against production. **The seed truncates.**

### The worker

Deploy `apps/worker` to Railway, Render or Fly as a single always-on instance.

```
Start command:  npm run worker
Environment:    DATABASE_URL, LEDGER_CHAIN_SALT   (the same values as the web app)
Instances:      exactly one
```

One instance, not several. Dispatch is at-least-once and handlers are
idempotent, so duplicates are survivable, but several copies multiply the
polling load for no benefit.

Without the worker the application still works: jobs complete, invoices issue,
payments record. The outbox simply accumulates and passport events arrive late.
That is by design ([ADR-0007](../03-adr/0007-transactional-outbox.md)), not a
reason to skip it.

### Object storage

Photographs are the trust mechanism ([ADR-0012](../03-adr/0012-photographs-as-the-trust-mechanism.md)),
so this is not optional beyond a demonstration. Cloudflare R2 is cheapest at
volume because it charges no egress, and inspection photographs are read far
more often than they are written.

Serve them through the authorising handler, never from a public bucket. An
inspection photograph belongs to a vehicle whose owner controls disclosure.

## 4. What each environment variable actually does

| Variable                                                                                 | Consequence of getting it wrong                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                           | Nothing works                                                                                                                                         |
| `DIRECT_DATABASE_URL`                                                                    | Migrations hang against a pooled provider                                                                                                             |
| `AUTH_SECRET`                                                                            | Sessions cannot be verified; everyone is signed out                                                                                                   |
| `LEDGER_CHAIN_SALT`                                                                      | **Every vehicle's history fails verification, permanently**                                                                                           |
| `APP_URL`                                                                                | Links in email and SMS point at the wrong host. Inferred from Vercel when unset.                                                                      |
| `CRON_SECRET`                                                                            | The daily cron cannot authenticate, so reminders, retention and outbox pushes stop.                                                                   |
| `MAIL_TRANSPORT`, `MAIL_FROM`, `SMS_TRANSPORT`                                           | Messages stay in `message_logs` as queued, or go to the console. Real sending needs SMTP or Resend, and Twilio for SMS.                               |
| `REPLY_DOMAIN`, `INBOUND_WEBHOOK_SECRET`                                                 | Replies from customers cannot be routed back to the workshop that sent the message.                                                                   |
| `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Photographs and paperwork fall back to the local disk, which a serverless host discards. Set `STORAGE_DRIVER=s3` with R2 or S3 before real customers. |
| `AI_TRANSPORT`, `AI_MODEL`, `ANTHROPIC_API_KEY`                                          | Customer summaries use the plain composed text. Nothing else changes; no model is needed for any figure the product shows.                            |

## 5. Before real customers

- [ ] Backups verified by restoring one, not by trusting the dashboard
- [ ] `LEDGER_CHAIN_SALT` stored where it cannot be casually rotated
- [ ] Worker running, with its queue depth alerted on
- [ ] Error tracking capturing unhandled exceptions
- [ ] A scheduled job running `verify-integrity.ts` against production
- [ ] Penetration test complete (NFR-413)
- [ ] Data processing agreement with every sub-processor

The fifth item deserves stating plainly: the passport's integrity claim is only
as good as the last time anybody actually checked it.

---

_Back to the [documentation index](../README.md)._
