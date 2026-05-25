# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Next.js 15 app using standalone output.
# Build context: REPO ROOT. The app code lives under app/ and the
# wiki / bonus markdown content lives under docs/ — both are needed
# at runtime because lib/content/{wiki,bonus}.ts reads files from the
# docs/ directory relative to the app's working directory.
#
# Final image: ~190MB. Runs the standalone Next server as non-root.

# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /repo
COPY app/package.json app/package-lock.json ./app/
RUN --mount=type=cache,target=/root/.npm \
    cd app && npm ci --include=dev

# ---------- build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /repo
COPY --from=deps /repo/app/node_modules ./app/node_modules
COPY app ./app
COPY docs ./docs

# Public env vars get baked into the client bundle. Provide build args
# (Railway sets these via the dashboard) so the values are correct in
# production. Anything not set falls back to a sentinel that's safe.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_PADDLE_ENV=sandbox
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
ARG NEXT_PUBLIC_GA4_MEASUREMENT_ID=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ENV NEXT_PUBLIC_GA4_MEASUREMENT_ID=$NEXT_PUBLIC_GA4_MEASUREMENT_ID

# Env validation runs at build time too (Zod schema is module-level).
# Provide non-default placeholders so the production refinements don't
# fail during the build. Real values are injected at runtime by Railway.
ENV NODE_ENV=production
ENV SESSION_SECRET=build-only-placeholder-not-used-at-runtime-32+chars
ENV CRON_SECRET=build-only-placeholder-not-used-at-runtime
ENV UNSUB_SECRET=build-only-placeholder-not-used-at-runtime
ENV RESEND_FROM_ADDRESS="Build Placeholder <build@placeholder.example>"

WORKDIR /repo/app
RUN npm run build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Standalone output ships a minimal node_modules + the server entrypoint.
# Layout when outputFileTracingRoot is the repo root:
#   /repo/app/.next/standalone/app/server.js   ← entrypoint
#   /repo/app/.next/standalone/app/.next/      ← server build
#   /repo/app/.next/standalone/node_modules    ← traced runtime deps
# We mirror that layout into the runtime stage.
COPY --from=build --chown=nextjs:nodejs /repo/app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/app/.next/static ./app/.next/static
# (No app/public/ — assets are served via the app router.)
COPY --from=build --chown=nextjs:nodejs /repo/docs ./docs

USER nextjs
EXPOSE 3000

# Run the standalone entrypoint from the repo root so process.cwd() matches
# the development layout — lib/content/wiki.ts resolves docs/wiki relative
# to cwd + ".." from the app/ subdir.
WORKDIR /repo/app
CMD ["node", "server.js"]
