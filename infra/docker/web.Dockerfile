# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Carnet web application.
#
# Multi-stage: dependencies, build, runtime. The runtime image carries no
# build toolchain, no source, and runs as a non-root user.
#
#   docker build -f infra/docker/web.Dockerfile -t carnet-web .
# ---------------------------------------------------------------------------

# --- dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Alpine's musl needs this for Prisma's engines.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY packages/db/package.json      packages/db/
COPY packages/core/package.json    packages/core/
COPY packages/ui/package.json      packages/ui/
COPY apps/web/package.json         apps/web/
COPY apps/worker/package.json      apps/worker/

RUN npm ci --ignore-scripts

# --- build -----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The Prisma client is generated into packages/db/src/generated and is
# gitignored, so it must be produced here rather than copied.
RUN npm run db:generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time placeholders. Real values are injected at runtime; these exist
# only so environment validation passes during the build.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-time-placeholder-value-at-least-32-chars
ENV LEDGER_CHAIN_SALT=build-time-placeholder

RUN npm run build --workspace=@carnet/web

# --- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl \
 && addgroup -g 1001 -S carnet \
 && adduser -u 1001 -S carnet -G carnet

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build --chown=carnet:carnet /app/node_modules      ./node_modules
COPY --from=build --chown=carnet:carnet /app/package.json      ./package.json
COPY --from=build --chown=carnet:carnet /app/packages          ./packages
COPY --from=build --chown=carnet:carnet /app/apps/web/.next    ./apps/web/.next
COPY --from=build --chown=carnet:carnet /app/apps/web/public   ./apps/web/public
COPY --from=build --chown=carnet:carnet /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=carnet:carnet /app/apps/web/next.config.ts ./apps/web/next.config.ts

USER carnet
EXPOSE 3000

# Fails the container rather than serving errors quietly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/login || exit 1

CMD ["npm", "run", "start", "--workspace=@carnet/web"]
