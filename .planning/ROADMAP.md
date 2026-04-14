# Roadmap: CEH Prep — Monetization + Security Hardening

## Overview

This milestone takes the existing CEH Prep scaffold (two products in one repo:
`/free` static HTML and `/app` Next.js 15 SaaS) from a partially-working beta
to a revenue-earning, security-hardened production SaaS. Five phases ship in
strict dependency order: first we fix the bugs that are corrupting every
integration test (Phase 1), then we stand up the email primitive every
downstream flow depends on (Phase 2), then we add Google OAuth on top of the
now-verifiable email accounts (Phase 3), then we wire Paddle Billing v2 to
turn the 3-day free trial into $30/mo Pro subscriptions (Phase 4), and finally
we ship the audit admin view, nonce-based CSP, Redis rate limiter, test suite,
and deploy runbook that let us defend the product once students start attacking
it (Phase 5).

Every phase produces a deployable app. Every phase's success criteria are
observable from a user's browser — not from an implementation checklist. The
threat model is non-negotiable: the audience is ethical hacking students, so
every new surface gets a security review before it ships.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Stabilization** — Kill the signup 500, pin CVE-patched versions, scaffold shared folders, extend User schema for every downstream flow
- [ ] **Phase 2: Email Identity (Resend + Verify + Reset)** — Users own their email-bound identity: verification on signup, constant-time password recovery
- [ ] **Phase 3: Google OAuth** — Users can sign in with Google; auto-link gated on verified email; no open redirect, no token confusion
- [ ] **Phase 4: Paddle Billing + Tier Gate** — Users can upgrade to Pro at $30/mo and unlock days 4-14 + exam simulator; tier is set only by verified webhooks
- [ ] **Phase 5: Production Hardening (Admin + CSP + Tests + Deploy)** — Nonce-based CSP, pino structured logging, Redis rate limits, audit admin view, test suite, deploy runbook

## Phase Details

### Phase 1: Stabilization
**Goal**: The app boots clean, signup stops 500ing, and the folder + schema surfaces every downstream phase depends on exist. This phase ships zero new user-facing features — it unblocks the next four.
**Depends on**: Nothing (first phase)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06, STAB-07, STAB-08, STAB-09
**Success Criteria** (what must be TRUE):
  1. A new visitor can submit the signup form with a fresh email + strong password and reach the dashboard without seeing any 500 — even when the MongoDB driver momentarily times out (the `headers()`-after-await bug is dead).
  2. A free-tier user who directly navigates to `/course/5` is redirected to `/pricing` and sees an upgrade CTA, not the Day 5 lesson content (the render-time tier gate is the same hard wall the action-level gate already is).
  3. The dev server starts with zero Mongoose duplicate-index warnings in the console, and a fresh `npm install && npm run dev` works against either `mongodb-memory-server` or the documented Docker Compose path without any manual Mongo setup.
  4. `npm ls next` reports ≥15.2.3 and `npm ls mongoose` reports ≥8.9.5 — both CVE-patched versions pinned in `package.json` (CVE-2025-29927 and CVE-2025-23061 are neutralized).
  5. A developer can grep for `lib/infra/resend`, `lib/infra/paddle`, `lib/guards/require-tier`, and `lib/billing/entitlements` and find folder stubs with README placeholders, and the User schema exposes `emailVerifiedAt`, `googleSub`, `paddleCustomerId`, `role`, `emailVerifyTokenHash`, `passwordResetTokenHash` fields via TypeScript inference.
**Plans**: 6 plans
- [ ] 01-01-PLAN.md — Refactor auth.ts to ClientMeta capture-once pattern (kills signup 500) [STAB-01]
- [ ] 01-02-PLAN.md — Extend connectDB with mongodb-memory-server fallback + Atlas-tuned pool options [STAB-06, STAB-07]
- [ ] 01-03-PLAN.md — Mongoose model cleanup (drop dup indexes) + User schema extension + DTO update [STAB-02, STAB-09]
- [ ] 01-04-PLAN.md — lib/billing + lib/guards + lib/infra folder scaffolding + entitlements pure functions [STAB-08]
- [ ] 01-05-PLAN.md — Page-level tier gate in course/[day]/page.tsx + saveAnswer action switches to canAccessDay [STAB-03]
- [ ] 01-06-PLAN.md — Exact-pin next@15.2.3 + mongoose@8.9.5; .env.example + docker-compose.yml + check-no-eq.sh [STAB-04, STAB-05, STAB-06]

---

### Phase 2: Email Identity (Resend + Verify + Reset)
**Goal**: Users own their email-bound identity — they receive a verification email on signup, they can recover a lost password, and every message sent is rate-limited, audit-logged, and carries single-use tokens stored only as SHA-256 hashes. This phase ships the shared token primitive and the Resend infrastructure that Phase 3's OAuth auto-link and Phase 5's production hardening both build on top of.
**Depends on**: Phase 1
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, RESET-01, RESET-02, RESET-03, RESET-04
**Success Criteria** (what must be TRUE):
  1. A new user who signs up with email + password receives a verification email from the verified sender domain within 10 seconds; clicking the link lands them on a page that shows "Email verified" and updates `emailVerifiedAt` in Mongo.
  2. A verified user who tries to access Pro content is told they must verify their email first (unverified accounts cannot subscribe — reduces account-takeover blast radius); an unverified user can still use the free tier days 1-3 unimpeded.
  3. A user who forgets their password and enters an email on `/forgot-password` sees the same generic "If an account exists we sent a link" page with identical response time whether the email exists or not — and if the email DOES exist, they receive a reset link valid for exactly 1 hour, single-use, that on click rotates the password, kills every active session for that user, and invalidates every other outstanding reset token for that user.
  4. A user (or a script) hammering `/forgot-password` or the resend-verification endpoint hits a rate limit within the documented threshold (≤1 reset request per 10 minutes per account, per-IP and per-identifier), with a uniform error response that leaks nothing about account existence.
  5. An admin querying the audit log can see one event for every send attempt (success or failure) with outcome + destination-hash but no raw email addresses and no token material of any kind.
**Plans**: TBD

---

### Phase 3: Google OAuth
**Goal**: Users can click "Continue with Google" on the login or signup page and end up authenticated inside the app, with auto-link to existing password accounts strictly gated on the email being verified. Own the flow — no NextAuth, just `google-auth-library` + two httpOnly cookies (state, pkce-verifier) + a route handler for the callback.
**Depends on**: Phase 2 (auto-link's `decideLink` pure function requires `emailVerifiedAt !== null`, which only Phase 2's VERIFY-02 can set)
**Requirements**: OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05, OAUTH-06, OAUTH-07, OAUTH-08, OAUTH-09
**Success Criteria** (what must be TRUE):
  1. A brand-new user clicks "Continue with Google" on `/signup`, completes Google's consent screen, lands back on `/dashboard` authenticated — and the newly-created User record shows `googleSub` set, `emailVerifiedAt` set (trusted from Google's `email_verified` claim), and no password hash.
  2. A user with an existing password-account (email already verified) clicks "Continue with Google" using the same Google email; they are seamlessly auto-linked — one User record now has both a password hash and a `googleSub` — and they land on `/dashboard` without a merge-conflict prompt.
  3. A user with an existing password-account whose email is NOT yet verified clicks "Continue with Google" using the same email; they are NOT auto-linked — instead they are routed to a manual-link flow that requires logging in with password first, then linking Google from Settings (account-takeover-by-email-collision is structurally impossible).
  4. A crafted callback URL with a tampered state parameter, a replayed state, a `returnTo` pointing to `https://evil.example.com`, or a Google `id_token` with a wrong `aud` or missing `email_verified` all return structured errors — none complete the sign-in, all emit audit events.
  5. Every OAuth start, callback success, callback failure, and link outcome appears in the audit log with outcome code; no raw id_tokens, no PKCE verifiers, no state values ever touch the log.
**Plans**: TBD

---

### Phase 4: Paddle Billing + Tier Gate
**Goal**: A free-tier user on the pricing page can click "Upgrade to Pro", complete checkout in the Paddle overlay at $30/mo USD, and within 30 seconds see their account flip to Pro and unlock days 4-14 + exam simulator + analytics. Tier is set ONLY by verified webhooks; the client-side `checkout.completed` event is never trusted; webhook replays are no-ops; out-of-order webhooks never overwrite newer state.
**Depends on**: Phase 3 (OAuth users need a working upgrade path too, and testing checkout without OAuth users = half the funnel untested)
**Requirements**: TIER-01, TIER-02, TIER-03, TIER-04, TIER-05, PADDLE-01, PADDLE-02, PADDLE-03, PADDLE-04, PADDLE-05, PADDLE-06, PADDLE-07, PADDLE-08, PADDLE-09, PADDLE-10, PADDLE-11
**Success Criteria** (what must be TRUE):
  1. A free-tier user on `/pricing` clicks "Upgrade to Pro" and sees the Paddle overlay open with a $30/mo USD monthly subscription (no "$0 beta" crossout in the copy); after successful checkout the welcome page polls until the backend-verified tier flips to Pro, then redirects to `/dashboard` with days 4-14 and `/exam` now accessible.
  2. A free-tier user (directly, or via curl bypassing the UI) who hits a Pro-only page (`/course/5`, `/exam`, `/analytics/*`) or a Pro-only server action is blocked at BOTH render and action layers, with the same `canAccessDay` and `canAccessExam` functions from `lib/billing/entitlements.ts` enforcing the decision — a single source of truth, two enforcement points.
  3. Paddle replays the same `subscription.created` webhook three times (simulating the real 72h retry window); the second and third attempts return 200 "already processed" without touching the User record, confirmed via audit log (idempotency via unique index on `WebhookEvent.eventId`).
  4. A `subscription.canceled` event arrives after a later `subscription.updated` (out-of-order delivery); the `findOneAndUpdate` with `occurredAt` monotonic clock guard rejects the stale cancel, and the User tier remains Pro — verified by firing webhooks with manually-crafted `occurred_at` timestamps.
  5. A Pro user opens Settings and sees a "Manage subscription" link that deep-links into the Paddle Customer Portal; the Terms of Service, Privacy, and Refund policy pages are live and linked from both the footer and the checkout page (Paddle merchant-of-record requirement).
**Plans**: TBD

---

### Phase 5: Production Hardening (Admin + CSP + Tests + Deploy)
**Goal**: Ship the defenses a product for ethical hacking students needs: nonce-based CSP (with Paddle + Google + HIBP domains allowlisted — this allowlist can only be finalized NOW that Paddle is integrated and we know what it actually loads), Upstash Redis distributed rate limits, pino structured logging with redaction, audit admin dashboard, Vitest + Playwright test suite, GitHub Actions CI with npm audit + secret scan, and the deploy runbook that turns this into a production-ready system.
**Depends on**: Phase 4 (CSP allowlist needs the Paddle integration to baseline in Report-Only mode; E2E tests need every user flow to exist before they can be covered)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08, PROD-09, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. A user loading any production page sees `Content-Security-Policy` (not `Report-Only`) in the response headers with `script-src 'nonce-{random}' 'strict-dynamic'` — no `'unsafe-inline'` — and every inline `<script>` in the rendered HTML carries the same nonce; the Paddle overlay, Google OAuth redirect, and HIBP password check all function without a single CSP violation in the browser console.
  2. A user (or attacker) hammering `/api/login` or `/api/reset` across distributed IPs hits rate limits that hold under load — verified by a multi-instance load test — because the limiter is now Upstash Redis sliding-window, not in-process LRU cache.
  3. The sole user promoted to `role: "admin"` (via the one-off `scripts/set-admin.ts` CLI) can visit `/admin/audit`, see a paginated server-side-filtered view of audit events via the `toPublicAudit` DTO (zero PII leak), while any non-admin session hitting `/admin/*` or any admin server action directly gets a 403 — RBAC check duplicated at layout AND every server action, per CVE-2025-29927 defense-in-depth.
  4. The GitHub Actions CI pipeline runs on every PR and passes only when lint + typecheck + vitest + playwright + `npm audit --audit-level=moderate` + `gitleaks` secret scan + the `$eq`-wrap grep rule all succeed; the Playwright suite covers the full landing → signup → verify → login → paywall → checkout → welcome flow, the Google OAuth auto-link happy path, and the 125-question exam simulator run.
  5. A fresh deployer following `DEPLOY-01` can take an empty Vercel project and an empty MongoDB Atlas cluster and an empty Paddle sandbox and reach a working production signup → verify → upgrade → access-day-4 smoke test in under 60 minutes using only the runbook — no tribal knowledge, no undocumented env vars, no silent production misconfig.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stabilization | 0/6 | Not started | - |
| 2. Email Identity | 0/TBD | Not started | - |
| 3. Google OAuth | 0/TBD | Not started | - |
| 4. Paddle Billing + Tier Gate | 0/TBD | Not started | - |
| 5. Production Hardening | 0/TBD | Not started | - |

## Coverage

- v1 requirements total: **71** (STAB 9 + EMAIL 5 + VERIFY 4 + RESET 4 + OAUTH 9 + TIER 5 + PADDLE 11 + ADMIN 5 + PROD 9 + TEST 7 + DEPLOY 3)
- Mapped to phases: **71**
- Unmapped: **0** ✓
- Duplicates: **0** ✓

Note: The REQUIREMENTS.md traceability footer previously listed "69 total" — this was an off-by-2 miscount (verified by enumerating all REQ-IDs in the traceability table). The correct total is 71.

---
*Roadmap created: 2026-04-13*
*Granularity: standard (5 phases, at floor of 5-8 band)*
*Parallelization: enabled*
