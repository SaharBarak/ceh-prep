# Requirements: CEH Prep

**Defined:** 2026-04-14
**Core Value:** A student can go from zero to passing the CEH v13 exam in fourteen 30-minute sessions, with every quiz, lab, and exam-simulator run synced across devices — free for the first 3 days, $30/mo for the rest.

## v1 Requirements

### Stabilization (bug fixes landing before any new feature)

- [x] **STAB-01**: Signup POST completes without 500 — collect client meta once at action start, pass to audit as parameters instead of re-calling `headers()` after Mongo awaits
- [x] **STAB-02**: Mongoose boots without duplicate-index warnings on `user.email` and `audit.at`
- [x] **STAB-03**: Tier gate enforced at course page render, not just at answer-save — free users are redirected to `/pricing` when they navigate to Day 4+
- [x] **STAB-04**: Next.js pinned to ≥15.2.3 (CVE-2025-29927 middleware-bypass fix)
- [x] **STAB-05**: Mongoose pinned to ≥8.9.5 (CVE-2025-23061 `$or`-nested NoSQLi fix)
- [x] **STAB-06**: Local dev works without a live Mongo connection — documented path via Docker Compose OR `mongodb-memory-server`
- [x] **STAB-07**: MongoDB Atlas M0 free tier wired in production with connection pool tuned for Vercel (maxPoolSize 5, maxIdleTimeMS 30000)
- [x] **STAB-08**: `lib/infra/`, `lib/guards/`, `lib/billing/` folder scaffolding created with README stubs so subsequent phases never fight shared surfaces
- [x] **STAB-09**: User schema extended with `emailVerifiedAt`, `googleSub`, `paddleCustomerId`, `role`, `emailVerifyTokenHash`, `passwordResetTokenHash` fields

### Email (Resend) — shared infrastructure

- [x] **EMAIL-01**: Resend integration in `lib/infra/resend/` with React Email templates
- [x] **EMAIL-02**: Email sender domain verified (DKIM/SPF/DMARC) and documented in deploy guide
- [x] **EMAIL-03**: Per-account rate limit on outbound mail (≤1/10min for reset requests) before hitting Resend
- [x] **EMAIL-04**: `lib/auth/tokens.ts` — single-use token primitive: 32-byte base64url, SHA-256 hash at rest, TTL, `purpose` field prevents cross-flow replay
- [x] **EMAIL-05**: Audit log written for every send attempt (success / failure) without logging token material

### Email verification

- [x] **VERIFY-01**: User receives verification email on signup
- [x] **VERIFY-02**: Clicking the link marks `emailVerifiedAt`, consumes the token, invalidates other tokens with `purpose=verify` for that user
- [x] **VERIFY-03**: User can request a new verification email from Settings
- [x] **VERIFY-04**: Unverified users can use the free tier; paywall content still requires verification before subscription access (reduces account-takeover blast radius)

### Password reset

- [x] **RESET-01**: Forgot-password form — constant-time response regardless of email existence (defeat enumeration)
- [x] **RESET-02**: Reset email contains single-use token, 1h TTL
- [x] **RESET-03**: Reset form validates token against stored hash, rotates password, invalidates all active sessions for that user, invalidates all outstanding reset tokens
- [x] **RESET-04**: Rate limited by IP AND by identifier (email) with uniform error responses

### Google OAuth 2.0

- [ ] **OAUTH-01**: "Continue with Google" button on login and signup pages
- [ ] **OAUTH-02**: Authorization Code + PKCE flow via `google-auth-library` (no NextAuth)
- [ ] **OAUTH-03**: State + PKCE stored in separate httpOnly `SameSite=Lax` single-use cookies (NOT iron-session Strict)
- [ ] **OAUTH-04**: `verifyIdToken` with explicit `audience` + `iss` + `email_verified === true` checks
- [ ] **OAUTH-05**: `decideLink` pure function — auto-link to an existing password account ONLY when `existingByEmail.emailVerifiedAt !== null AND googleSub === null`
- [ ] **OAUTH-06**: All other conflict cases route to a manual-link flow: user must first log in with password, then link Google from Settings
- [ ] **OAUTH-07**: `returnTo` parameter stored in the state cookie (not the URL) and validated with `URL` constructor + origin check — no open redirect
- [ ] **OAUTH-08**: Audit events emitted for every OAuth start, callback success, callback failure, and link outcome
- [ ] **OAUTH-09**: OAuth callback is a route handler, not a server action (required because it's a GET target of a third-party redirect)

### Tier gating domain + guards

- [ ] **TIER-01**: `lib/billing/entitlements.ts` exposes `canAccessDay(tier, day)` and `canAccessExam(tier)` as pure functions — single source of truth for all gate checks
- [ ] **TIER-02**: `lib/guards/require-tier.ts` and `require-day-access.ts` — composable guards usable from server actions AND page renders
- [ ] **TIER-03**: Free tier is hard-capped at days 1-3 (`FREE_DAY_LIMIT = 3`). No grey area — free users blocked at render AND at action for day 4+
- [ ] **TIER-04**: Exam simulator is Pro-only
- [ ] **TIER-05**: All analytics routes are Pro-only

### Paddle Billing v2

- [ ] **PADDLE-01**: `lib/infra/paddle/` — Paddle SDK isolated; never imported from domain layers
- [ ] **PADDLE-02**: Client-side overlay checkout via `@paddle/paddle-js` triggered from the pricing page
- [ ] **PADDLE-03**: Pro plan = $30/mo USD, monthly billing, monthly renewal; Paddle price ID configured via env var
- [ ] **PADDLE-04**: `POST /api/webhooks/paddle` route handler with `runtime = "nodejs"` + `dynamic = "force-dynamic"`; `await request.text()` BEFORE anything else; `paddle.webhooks.unmarshal(rawBody, secret, signature)`
- [ ] **PADDLE-05**: Webhook idempotency via unique index on `WebhookEvent.eventId`, 7-day TTL; duplicate-key error returns 200 (already processed)
- [ ] **PADDLE-06**: Subscription updates use `findOneAndUpdate` with `occurredAt` monotonic clock guard — out-of-order events never overwrite newer state
- [ ] **PADDLE-07**: Tier is set ONLY by the verified webhook. Client-side `checkout.completed` event is NEVER trusted for tier flip
- [ ] **PADDLE-08**: Post-checkout welcome page polls `user.tier` fresh from Mongo for up to 30s while waiting for the webhook — no client-side tier optimism
- [ ] **PADDLE-09**: Customer Portal link (from Paddle) surfaced on Settings — self-serve cancel / update payment / view invoices
- [ ] **PADDLE-10**: Pricing page copy updated — Pro is $30/mo, no "$0 beta" crossout; Free tier clearly labeled as days 1-3
- [ ] **PADDLE-11**: Terms of Service + Privacy + Refund policy pages published (Paddle merchant-of-record requirement)

### Audit admin view

- [ ] **ADMIN-01**: `app/src/app/(admin)/` route group with layout-level `requireRole("admin")`
- [ ] **ADMIN-02**: Admin role granted exclusively via a one-off CLI script (`scripts/set-admin.ts`); no promotion UI in v1
- [ ] **ADMIN-03**: Audit log view — paginated, server-side filtered, uses `toPublicAudit` DTO (no PII leak)
- [ ] **ADMIN-04**: RBAC check duplicated at the top of every admin server action (defense in depth, never trust layout alone — CVE-2025-29927 lesson)
- [ ] **ADMIN-05**: `lib/guards/require-role.ts` composes with existing `requireSession` and returns `Result<{user}, ForbiddenError>`

### Production hardening

- [ ] **PROD-01**: Nonce-based CSP — nonce generated per-request in middleware, injected into layout `<script>` tags; `script-src 'nonce-{n}' 'strict-dynamic'` replaces `'unsafe-inline'` in production
- [ ] **PROD-02**: CSP allowlist for `cdn.paddle.com`, `*.paddle.com`, `checkout.paddle.com`, `buy.paddle.com`, `accounts.google.com`, `oauth2.googleapis.com`, `api.pwnedpasswords.com` (latent bug — HIBP domain currently not whitelisted)
- [ ] **PROD-03**: CSP rolls out in `Report-Only` mode first; 48h violation collection window; then enforced
- [ ] **PROD-04**: pino structured logging wired via `server-only` module in `lib/infra/log/`; JSON to stdout; Vercel log drain captures it
- [ ] **PROD-05**: pino redaction configured for `password`, `authorization`, `cookie`, `email`, token fields; `logSafe()` helper sanitizes before logging user strings
- [ ] **PROD-06**: Upstash Redis rate limiter via `@upstash/ratelimit` sliding-window algorithm; interface-swap against dev-time `lru-cache` keyed on `NODE_ENV`
- [ ] **PROD-07**: Per-IP and per-identifier rate limits on auth + reset + verify + OAuth start endpoints
- [ ] **PROD-08**: Every Mongo query in new code wraps user input in `$eq` — CI grep check enforces
- [ ] **PROD-09**: No stack traces reach the client; all errors flow through a single error mapper that emits structured error codes

### Tests + CI

- [ ] **TEST-01**: Vitest unit tests — Result monad, `canAccessDay`, `decideLink`, token hashing, Zod schemas, DTO mappers
- [ ] **TEST-02**: Vitest + `mongodb-memory-server` integration tests for auth domain (signup, login, verify, reset)
- [ ] **TEST-03**: Playwright E2E — landing → signup → verify → login → dashboard → paywall redirect → checkout → welcome
- [ ] **TEST-04**: Playwright E2E — Google OAuth happy path + conflict (existing password account + verified email → auto-link)
- [ ] **TEST-05**: Playwright E2E — exam simulator 125-question full run with timer (accelerated via test seam)
- [ ] **TEST-06**: GitHub Actions CI pipeline — lint + typecheck + vitest + playwright + `npm audit --audit-level=moderate` + secret scan (`trufflehog` or `gitleaks`)
- [ ] **TEST-07**: CI enforces the `$eq`-wrap convention via a grep rule in the lint job

### Deploy

- [ ] **DEPLOY-01**: Deploy guide for Vercel + MongoDB Atlas M0 + Paddle webhook URL wiring + Resend domain verification + Google OAuth redirect URI setup
- [ ] **DEPLOY-02**: `app/.env.example` updated with every new required variable and a comment explaining each
- [ ] **DEPLOY-03**: Production smoke test runbook (signup, verify email, login, upgrade, receive webhook, access day 4)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Retention + study UX

- **STREAK-01**: Daily study streak counter with grace day (Vercel cron)
- **STREAK-02**: Streak freeze mechanic
- **REVIEW-01**: "Retake wrong questions only" mode
- **REVIEW-02**: Flag/bookmark questions for later review
- **REVIEW-03**: Exam attempt history — persisted `ExamAttempt` model, view past runs
- **REVIEW-04**: Domain heatmap — aggregate accuracy by CEH domain across attempts
- **REVIEW-05**: Per-question explanation backfill for all 70+ questions (content work, not code)
- **LEITNER-01**: Leitner spaced-repetition review deck (5-box state machine)

### Identity hardening

- **MFA-01**: Optional TOTP MFA for pro users (`otpauth` package)
- **MFA-02**: Recovery codes + device binding

### Content expansion

- **CONTENT-01**: Weekly email drip during 14-day sprint (Resend scheduled sends)
- **CONTENT-02**: PDF certificate of completion
- **CONTENT-03**: Additional certifications beyond CEH (Security+, CISSP) — multi-cert model

### Infrastructure

- **INFRA-01**: Distributed cache for hot quiz queries (Upstash Redis)
- **INFRA-02**: Uptime monitoring + Sentry integration for error reporting

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web is responsive enough; study sessions happen on laptops. App Store 15% + scope explosion |
| Chat / community forum | Scope creep, not core to exam prep, moderation burden |
| AI tutor via Claude API | Cost + accuracy risk + feature-gate logic before core product is validated |
| Team / multi-seat billing | Individual B2C only; enterprise is a future product |
| Blockchain / NFT certificates | Zero value, signal chasing |
| Multi-language curriculum | English-only v1; translation is a separate project |
| Live proctoring / webcam exam | CEH real exam is proctored by EC-Council; we are a prep tool, not a testing center |
| Leaderboards / social features | Wrong audience — adults prepping for a $1,200 professional exam |
| XP / confetti gamification | Taste failure for adult cybersecurity learners |
| Scraped question dumps | EC-Council DMCA + ruins learning value |
| Unlimited exam retakes of same mock | Teaches memorization, not concepts |
| Custom billing settings UI | Paddle Customer Portal is free and does it better |
| Pause-subscription flow | Complexity with negligible churn impact per Paddle research |
| Optimistic client-side tier unlock | Unauthenticated tier escalation — pure anti-feature |

## Traceability

Populated by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAB-01 | Phase 1 | Complete |
| STAB-02 | Phase 1 | Complete |
| STAB-03 | Phase 1 | Complete |
| STAB-04 | Phase 1 | Complete |
| STAB-05 | Phase 1 | Complete |
| STAB-06 | Phase 1 | Complete |
| STAB-07 | Phase 1 | Complete |
| STAB-08 | Phase 1 | Complete |
| STAB-09 | Phase 1 | Complete |
| EMAIL-01 | Phase 2 | Complete |
| EMAIL-02 | Phase 2 | Complete |
| EMAIL-03 | Phase 2 | Complete |
| EMAIL-04 | Phase 2 | Complete |
| EMAIL-05 | Phase 2 | Complete |
| VERIFY-01 | Phase 2 | Complete |
| VERIFY-02 | Phase 2 | Complete |
| VERIFY-03 | Phase 2 | Complete |
| VERIFY-04 | Phase 2 | Complete |
| RESET-01 | Phase 2 | Complete |
| RESET-02 | Phase 2 | Complete |
| RESET-03 | Phase 2 | Complete |
| RESET-04 | Phase 2 | Complete |
| OAUTH-01 | Phase 3 | Pending |
| OAUTH-02 | Phase 3 | Pending |
| OAUTH-03 | Phase 3 | Pending |
| OAUTH-04 | Phase 3 | Pending |
| OAUTH-05 | Phase 3 | Pending |
| OAUTH-06 | Phase 3 | Pending |
| OAUTH-07 | Phase 3 | Pending |
| OAUTH-08 | Phase 3 | Pending |
| OAUTH-09 | Phase 3 | Pending |
| TIER-01 | Phase 4 | Pending |
| TIER-02 | Phase 4 | Pending |
| TIER-03 | Phase 4 | Pending |
| TIER-04 | Phase 4 | Pending |
| TIER-05 | Phase 4 | Pending |
| PADDLE-01 | Phase 4 | Pending |
| PADDLE-02 | Phase 4 | Pending |
| PADDLE-03 | Phase 4 | Pending |
| PADDLE-04 | Phase 4 | Pending |
| PADDLE-05 | Phase 4 | Pending |
| PADDLE-06 | Phase 4 | Pending |
| PADDLE-07 | Phase 4 | Pending |
| PADDLE-08 | Phase 4 | Pending |
| PADDLE-09 | Phase 4 | Pending |
| PADDLE-10 | Phase 4 | Pending |
| PADDLE-11 | Phase 4 | Pending |
| ADMIN-01 | Phase 5 | Pending |
| ADMIN-02 | Phase 5 | Pending |
| ADMIN-03 | Phase 5 | Pending |
| ADMIN-04 | Phase 5 | Pending |
| ADMIN-05 | Phase 5 | Pending |
| PROD-01 | Phase 5 | Pending |
| PROD-02 | Phase 5 | Pending |
| PROD-03 | Phase 5 | Pending |
| PROD-04 | Phase 5 | Pending |
| PROD-05 | Phase 5 | Pending |
| PROD-06 | Phase 5 | Pending |
| PROD-07 | Phase 5 | Pending |
| PROD-08 | Phase 5 | Pending |
| PROD-09 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| TEST-04 | Phase 5 | Pending |
| TEST-05 | Phase 5 | Pending |
| TEST-06 | Phase 5 | Pending |
| TEST-07 | Phase 5 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 71 total
- Mapped to phases: 71
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after initial definition*
