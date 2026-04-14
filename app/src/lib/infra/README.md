# lib/infra

Vendor SDKs live here. **Domain layers NEVER import from `lib/infra/` directly.** This is
the single sink for every third-party SDK in the project: Resend (Phase 2), Google OAuth
(Phase 3), Paddle Billing (Phase 4), and any future vendor.

## What lives here

- `lib/infra/resend/`  (Phase 2) — Resend client, React Email templates, send helpers.
- `lib/infra/google/`  (Phase 3) — `google-auth-library` wrapper, ID token verifier.
- `lib/infra/paddle/`  (Phase 4) — Paddle SDK init, webhook unmarshal helpers, customer portal links.
- `lib/infra/log/`     (Phase 5) — pino logger with redaction.
- `lib/infra/rate-limit/` (Phase 5) — Upstash Redis sliding window adapter.

## The contract

1. **No domain logic.** Infra files wrap SDKs and expose narrow, typed functions. They never
   decide whether a tier should be flipped or whether an email is verified — they just send
   the email or marshal the webhook.
2. **One folder per vendor.** `lib/infra/paddle/index.ts` is the only place Paddle SDK calls
   live. If you find Paddle imports anywhere else in the codebase, that's a leak.
3. **Domain layers go through guards, not infra.** Action files import from `lib/billing/`,
   `lib/guards/`, and `lib/db/`, never from `lib/infra/`. Infra is for the seam between the
   app and the outside world; domain is for the rules.
4. **Bundle hygiene.** Anything that pulls in MongoDB binaries, native modules, or large
   server-only deps must be lazy-imported (`await import("...")`) so production bundles stay clean.

## Who imports from here

- Route handlers (`app/api/**/route.ts`) — Paddle webhook, OAuth callback.
- Server actions that send mail or hit Paddle — through narrow infra-layer functions.
- Phase 5 logging seams.

Vendor SDKs live here. Domain layers do not. That is the entire boundary.
