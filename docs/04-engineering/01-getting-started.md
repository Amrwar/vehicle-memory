# Getting Started

**Target: clone to a running, seeded application in under 15 minutes** (NFR-706).
That number is measured literally, by handing these instructions to somebody
who has not seen the project and timing them. If it takes longer, the
instructions are the defect.

## Prerequisites

| Tool    | Version      | Check                    |
| ------- | ------------ | ------------------------ |
| Node.js | 22 or later  | `node --version`         |
| npm     | 10 or later  | `npm --version`          |
| Docker  | with Compose | `docker compose version` |
| Git     | any recent   | `git --version`          |

## Steps

```bash
git clone https://github.com/Amrwar/vehicle-memory.git
cd vehicle-memory

npm install

# Secrets. Generate real values for the three placeholders.
cp .env.example .env
#   AUTH_SECRET          openssl rand -base64 48
#   PUBLIC_LINK_SECRET   openssl rand -base64 48
#   LEDGER_CHAIN_SALT    openssl rand -base64 32   <- never rotate this
cp .env packages/db/.env
cp .env apps/web/.env

# Postgres, Redis and a mail catcher
docker compose up -d postgres redis mailpit

npm run db:generate     # Prisma client
npm run db:deploy       # migrations
npm run db:seed         # demo workshop

npm run dev             # http://localhost:3000
```

## What you get

A workshop called **Hillside Motors** having a plausible Tuesday.

| Sign in as      | Email                        | Lands on   |
| --------------- | ---------------------------- | ---------- |
| Owner           | `ahmed@hillsidemotors.test`  | Dashboard  |
| Service advisor | `sara@hillsidemotors.test`   | Dashboard  |
| Technician      | `john@hillsidemotors.test`   | Shop floor |
| Bookkeeper      | `fatima@hillsidemotors.test` | Dashboard  |
| Customer        | `maria@example.test`         | Portal     |

Password for all: `carnet-demo-2026`

The seed is built to make the product's point visible immediately. Open the
BMW X5: it carries **seven history entries, three of them written by a
different workshop**, three owners, an open safety recall, and one deliberately
impossible odometer reading so the fraud-detection path is on screen.

## Verify it is really working

```bash
npm test                                      # 192 domain tests
npx tsx infra/scripts/verify-integrity.ts     # chain + database invariants
npx tsx infra/scripts/smoke.ts                # 19 routes across 5 roles
npx tsx infra/scripts/verify-inventory.ts     # stock arithmetic, end to end
```

`verify-integrity` is worth running once by hand. It does not check that the
guarantees are configured — it **actively tries to break them**: rewriting a
passport entry, deleting an audit record, posting an unbalanced journal. A
guarantee nobody tests is a guarantee nobody has.

## Common commands

| Command                 | Does                                         |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Web app on :3000                             |
| `npm run worker`        | Background worker                            |
| `npm test`              | Domain tests                                 |
| `npm run test:coverage` | With coverage thresholds                     |
| `npm run verify`        | format, lint, typecheck, test — what CI runs |
| `npm run db:studio`     | Prisma Studio                                |
| `npm run db:reset`      | Drop, migrate, reseed                        |

## When it goes wrong

| Symptom                         | Cause and fix                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL is not set`       | `.env` missing, or not copied to `packages/db` and `apps/web`                                      |
| `LEDGER_CHAIN_SALT is required` | Same. The salt is mandatory to write passport events.                                              |
| `Can't reach database`          | `docker compose up -d postgres`, then `docker compose ps`                                          |
| Components render unstyled      | Tailwind is not seeing `packages/ui`. Check the `@source` lines in `apps/web/src/app/globals.css`. |
| `chain BROKEN` after a reseed   | The salt changed. Rotating it invalidates every existing chain, by design. Reseed.                 |
| Port 3000 taken                 | `npm run dev -- --port 3001`                                                                       |

---

_Next: [Coding standards](02-coding-standards.md)._
