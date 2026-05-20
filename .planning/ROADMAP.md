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
- [x] **Phase 2: Email Identity (Resend + Verify + Reset)** — Users own their email-bound identity: verification on signup, constant-time password recovery
- [ ] **Phase 3: Google OAuth** — Users can sign in with Google; auto-link gated on verified email; no open redirect, no token confusion
- [ ] **Phase 4: Paddle Billing + Tier Gate** — Users can upgrade to Pro at $30/mo and unlock days 4-14 + exam simulator; tier is set only by verified webhooks
- [ ] **Phase 5: Production Hardening (Admin + CSP + Tests + Deploy)** — Nonce-based CSP, pino structured logging, Redis rate limits, audit admin view, test suite, deploy runbook
- [ ] **Phase 6: Curriculum Content Module** — Ship `app/src/lib/content/` with the typed 14-day CEH v13 curriculum (lesson HTML, quiz banks, lab exercises) and the `getDay` / `DAYS` / `isFreeDay` API the rest of the app already imports
- [ ] **Phase 7: Lesson Reader Polish** — Per-day reader toolbar (day-jump, font scale, mark-complete, copy-cmd, scroll-spy outline) + sticky-progress UI
- [ ] **Phase 8: Pro Lab Integration (WebVM)** — Embed `saharbarak.github.io/ceh-webvm` per-day with deep-link drill autostart, gated by `canAccessDay`, with a "Run this drill" CTA on each lab card
- [ ] **Phase 9: Premium Content Library + Landing Lift** — Render `docs/content/*.md` as `/bonus` (Pro-gated), surface curated content samples on the landing page, and rework hero copy to sell on outcomes from real lesson value
- [ ] **Phase 10: Email Drip — Curriculum Sequence** — Resend Audiences scaffolding + 14-day onboarding drip: one curriculum-tied email per day starting one day after signup, with free→Pro upsell injected at Day 4
- [ ] **Phase 11: Email Broadcast + Re-engagement** — Fire-on-publish bonus-library digest broadcast, plus 7-day / 21-day re-engagement nudges for inactive users; shares Phase 10's Audience + suppression list

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
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08, PROD-09, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. A user loading any production page sees `Content-Security-Policy` (not `Report-Only`) in the response headers with `script-src 'nonce-{random}' 'strict-dynamic'` — no `'unsafe-inline'` — and every inline `<script>` in the rendered HTML carries the same nonce; the Paddle overlay, Google OAuth redirect, and HIBP password check all function without a single CSP violation in the browser console.
  2. A user (or attacker) hammering `/api/login` or `/api/reset` across distributed IPs hits rate limits that hold under load — verified by a multi-instance load test — because the limiter is now Upstash Redis sliding-window, not in-process LRU cache.
  3. The sole user promoted to `role: "admin"` (via the one-off `scripts/set-admin.ts` CLI) can visit `/admin/audit`, see a paginated server-side-filtered view of audit events via the `toPublicAudit` DTO (zero PII leak), while any non-admin session hitting `/admin/*` or any admin server action directly gets a 403 — RBAC check duplicated at layout AND every server action, per CVE-2025-29927 defense-in-depth.
  4. The GitHub Actions CI pipeline runs on every PR and passes only when lint + typecheck + vitest + playwright + `npm audit --audit-level=moderate` + `gitleaks` secret scan + the `$eq`-wrap grep rule all succeed; the Playwright suite covers the full landing → signup → verify → login → paywall → checkout → welcome flow, the Google OAuth auto-link happy path, and the 125-question exam simulator run.
  5. A fresh deployer following `DEPLOY-01` can take an empty Vercel project and an empty MongoDB Atlas cluster and an empty Paddle sandbox and reach a working production signup → verify → upgrade → access-day-4 smoke test in under 60 minutes using only the runbook — no tribal knowledge, no undocumented env vars, no silent production misconfig.
**Plans**: TBD

### Phase 6: Curriculum Content Module
**Goal**: Ship `app/src/lib/content/` with the typed 14-day CEH v13 curriculum — lesson HTML, quiz banks, hands-on lab exercises — and the `getDay` / `DAYS` / `isFreeDay` API that `course/[day]/page.tsx`, `dashboard/page.tsx`, and `actions/progress.ts` already import. PROJECT.md called this module "existing" but git history shows it was never committed; the app does not compile today without it.
**Depends on**: Phase 1 (stabilization shipped the page-level tier gate this module hooks into)
**Requirements**: CONTENT-01..09 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. `/course/N` for every N in 1..14 renders real CEH v13 module content (Intro, Footprinting, Scanning, Enumeration, Vuln Analysis, System Hacking, Malware/Sniffing, SocEng/DoS/Hijack, Web/Servers, SQLi, Wireless/Mobile/IoT, Cloud, Crypto, Exam Sim) — not "TODO".
  2. `npm run build` produces a clean production bundle with zero TypeScript errors about missing `@/lib/content` exports.
  3. `getDay(n)`, `DAYS`, and `isFreeDay(n)` match the types `course/[day]/page.tsx` and `actions/progress.ts` expect today (no consumer-side changes needed).
  4. Free-tier users see day 1–3 lesson HTML; day 4+ redirects to `/pricing` (existing page-level tier gate is re-validated end-to-end).
  5. Quiz answers persist via the existing `saveAnswer` server action with no regressions of the Phase 2 progress flow — same `Map<questionIndex, selectedIndex>` shape.
**Plans**: TBD (run `/gsd:plan-phase 6`)

---

### Phase 7: Lesson Reader Polish
**Goal**: Take the per-day reader from "renders content" to "a tool a student wants to spend an hour in". Finalize the lesson toolbar (day-jump dropdown, font-scale, mark-as-complete, copy-cmd buttons on every `<pre>`), add a sticky scroll-spy outline of section headings, and a per-day progress strip that shows lesson read %, quiz answered %, lab attempted Y/N.
**Depends on**: Phase 6 (need real lesson HTML structure to design the reader UI around)
**Requirements**: READER-01..07 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. The lesson toolbar is visible at the top of every `/course/[day]` page with day-jump, font-scale (S/M/L persisted to localStorage), and mark-complete; mark-complete writes to Mongo via a new `setLessonComplete(day)` server action that updates a `completedDays: number[]` field on the User.
  2. Every `<pre>` block in lesson HTML renders with a copy-to-clipboard button that flashes "copied" for 1.5s; the button is keyboard-accessible (Tab + Enter).
  3. A scroll-spy sidebar lists the lesson's h2/h3 sections and highlights the current section as the user scrolls; clicking a heading scrolls smoothly to it.
  4. The per-day progress strip renders three pills — Lesson, Quiz, Lab — each filling proportionally as the user makes progress; the strip is sticky at the top of the page and visible from the lesson, quiz, and lab sections.
  5. All reader controls degrade gracefully on a free-tier user reading days 1–3 (no Pro upsell modal interrupts a 3-minute read).
**Plans**: TBD (run `/gsd:plan-phase 7`)

---

### Phase 8: Pro Lab Integration (WebVM)
**Goal**: Wire the live WebVM at `https://saharbarak.github.io/ceh-webvm/` into each day's lab card. Each day's lab gets a "Run this drill" button that opens the WebVM in a Pro-gated panel pre-loaded with the matching drill (deep-link via URL fragment that the WebVM page parses to auto-run `drill start dayNN MM`). Iframe is sandboxed; cross-origin postMessage carries pass/fail back to the host so the host UI marks the lab attempted/completed.
**Depends on**: Phase 6 (lab card needs real `day.exercise` data), Phase 1 (entitlements gate already shipped)
**Requirements**: LAB-01..08 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. A Pro user on `/course/3` clicks "Run this drill" on the lab card and sees the WebVM mount in a side panel within 8 seconds, already at the right drill prompt — no manual `drill start` typing needed.
  2. A free-tier user on `/course/3` (a free day) sees the same lab card but the "Run this drill" CTA shows a lock + "Upgrade to Pro to launch the in-browser lab" with a `/pricing?from=lab-day3` link — the iframe never mounts for free users.
  3. The WebVM iframe is sandboxed with `sandbox="allow-scripts allow-same-origin allow-popups"` and `allow="clipboard-read; clipboard-write"`; CSP allows `frame-src https://saharbarak.github.io` in the same nonce-based policy Phase 5 ships.
  4. When the user runs `drill check` inside the WebVM and the drill passes, the WebVM posts a `cehprep:drill:pass` message back to the host window via postMessage with `{ day, slug }`; the host validates `event.origin === 'https://saharbarak.github.io'` and writes to a new `completedDrills` field on the User.
  5. The day→drill mapping comes from `CURRICULUM-MAP.md` parsed at build time into a typed `dayDrills.ts` lookup table — no hardcoded slugs in the React component.
**Plans**: TBD (run `/gsd:plan-phase 8`)

---

### Phase 9: Premium Content Library + Landing Lift
**Goal**: Make the `docs/content/*.md` bonus library reachable from the running app at `/bonus` (Pro-gated, with a free-tier teaser of the first 3 items) and rework the landing page to sell on real content value — pull excerpts from items like the 32 OSINT search engines, the SQLMap workflow, the bug-bounty platforms list — instead of generic "ace your CEH" copy. The premium proof IS the content.
**Depends on**: Phase 4 (paywall must exist for Pro gate); Phase 8 helpful but not required
**Requirements**: LIB-01..05, LAND-01..06 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. `/bonus` lists every `docs/content/NN-*.md` item with title, topic, primary day, and a 2-line teaser; Pro users get the full markdown rendered server-side; free users get the first 3 items full + the rest gated.
  2. Each `/bonus/[slug]` renders the markdown with syntax highlighting on code blocks, working anchor links, and a per-item "Related Day" CTA that links to `/course/N` for the primary day in `CURRICULUM-MAP.md`.
  3. The landing-page hero replaces the generic value copy with a 3-card preview pulling actual snippets from the bonus library (e.g. "7 Claude prompts every cybersecurity engineer should save" — `01-claude-prompts-cybersecurity.md`); clicking a preview card scrolls to a sample reader pane.
  4. A new "What's inside Pro" landing-page section shows the per-day bonus content count via the `CURRICULUM-MAP.md` index — concrete numbers ("14 days · 18 bonus articles · 6 in-browser drills") instead of vague claims.
  5. Conversion-relevant tracking: the landing hero's primary CTA, the bonus-preview clicks, and the "Upgrade to Pro" CTA on `/bonus/[slug]` all fire structured analytics events that Phase 5's analytics layer can pick up.
**Plans**: TBD (run `/gsd:plan-phase 9`)

---

### Phase 10: Email Drip — Curriculum Sequence
**Goal**: A new signup receives a 14-day curriculum-tied drip email — one per day starting one calendar day after signup, in the user's signup-time-zone, with each day's blurb + a sample question + a deep-link to `/course/N`. Free-tier users hit Day 4 with a "tomorrow is Pro territory — here's what's inside" upsell. The whole stream rides on Resend Audiences (same vendor as the transactional layer); a single unsubscribe kills marketing without touching the transactional channel.
**Depends on**: Phase 2 (`lib/infra/resend/` and audit pattern), Phase 6 (`DAYS` is the content source)
**Requirements**: DRIP-01..09 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. A user signs up at 23:00 local time and receives "Day 1 of your sprint is ready" at ~09:00 their local time the next calendar day — never at 02:00 their time because the queue is naive UTC. Subsequent days arrive at the same local hour ±15 min jitter.
  2. A free-tier user receives Days 1–3 in the standard format; the Day 4 email's body is replaced with the "this is where Pro picks up" upsell variant that lists what they'll get + an `/pricing?from=drip-day4` CTA. Pro users (or anyone whose tier flipped after signup) get the standard Day 4 email instead.
  3. Every drip-sent message is logged in the audit collection with `kind="drip"`, the day number, the user's hashed email, the audience-id, and the outcome (`sent` / `bounce` / `suppressed`). No raw email addresses, no token material.
  4. A user clicks the unsubscribe link in any drip email → the user's `marketingOptOut: true` flag flips, the Resend Audiences contact is removed, and no subsequent drip OR broadcast (Phase 11) email is ever sent to that address. Transactional email (verify, reset) continues to flow.
  5. Re-running the drip cron repeatedly during a window is a no-op for any user who already received that day's email — keyed by a `(userId, day, kind)` unique index on the EmailDispatch collection. Out-of-order delivery + retries never produce a duplicate Day-N email to the same user.
**Plans**: TBD (run `/gsd:plan-phase 10`)

---

### Phase 11: Email Broadcast + Re-engagement
**Goal**: When a new bonus-library item is published (a new `docs/content/NN-*.md` file lands on main), every opted-in user receives a digest email leading with the new article + 2 micro-snippets from earlier items + a deep-link to `/bonus/[slug]`. In parallel, users inactive for 7 and 21 days receive a single re-engagement nudge each, never more, never to people who unsubscribed from broadcast. Builds on Phase 10's Audience + suppression list.
**Depends on**: Phase 10 (Audience + suppression infrastructure)
**Requirements**: BLAST-01..06, REENG-01..04 (to be enumerated during planning)
**Success Criteria** (what must be TRUE):
  1. A new `docs/content/NN-*.md` file landing on `main` (detected by build-time SHA of the bonus library index) triggers a one-shot broadcast within the next cron tick (≤15 min). The email's lead-story link is the new article; the two snippets are deterministically chosen from the existing library (deduplicated by send-history). The broadcast is sent exactly once per article — never re-fires on rebuild.
  2. A user who has not opened `/dashboard` or any `/course/*` in 7 days receives a single "Day {lastDay+1} is still waiting" nudge with a deep-link back to their last active day. Same user at 21 days receives a single "We saved your spot — pick up where you left off" nudge with their current quiz-progress %. After 21 days, no further re-engagement emails ever fire for that user from this stream.
  3. Pro users get the broadcast (it's value-aligned content), but the re-engagement nudges only fire for free-tier accounts — paying users get a softer "we noticed you've been quiet" variant gated behind a separate `marketingNudgeOptOut` flag (defaulted opt-out for Pro).
  4. A user who unsubscribed in Phase 10's drip emails (`marketingOptOut: true`) never receives a broadcast OR a re-engagement message — the suppression list is one-source-of-truth across all three streams.
  5. CAN-SPAM + GDPR minima are visible: every broadcast and re-engagement email carries the physical mailing address in the footer, a one-click unsubscribe link in the header (`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers), and the "why are you receiving this" line that names which stream (drip / broadcast / re-engagement) and how to opt out of that one specifically.
**Plans**: TBD (run `/gsd:plan-phase 11`)

---

## Progress

**Execution Order:**
Three parallel tracks share the milestone:
  - Auth/billing/hardening: 1 → 2 → 3 → 4 → 5
  - Content/lab/landing: 6 → 7 → 8 → 9 (parallel to auth track; only 9 → 4 cross-track dep for the Pro paywall)
  - Email engagement: 10 → 11 (depends on Phase 2's Resend foundation + Phase 6's content; parallel to everything else)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stabilization | 6/6 | Complete | 2026-04-14 |
| 2. Email Identity | 6/6 | Complete | 2026-04-14 |
| 3. Google OAuth | 0/TBD | Paused (plans drafted) | - |
| 4. Paddle Billing + Tier Gate | 0/TBD | Paused (context gate) | - |
| 5. Production Hardening | 0/TBD | Not started | - |
| 6. Curriculum Content Module | 0/TBD | Not started | - |
| 7. Lesson Reader Polish | 0/TBD | Not started | - |
| 8. Pro Lab Integration (WebVM) | 0/TBD | Not started | - |
| 9. Premium Content Library + Landing Lift | 0/TBD | Not started | - |
| 10. Email Drip — Curriculum Sequence | 0/TBD | Not started | - |
| 11. Email Broadcast + Re-engagement | 0/TBD | Not started | - |

## Coverage

**v1 monetization + security track** (Phases 1–5):
- v1 requirements total: **77** (STAB 9 + EMAIL 5 + VERIFY 4 + RESET 4 + OAUTH 9 + TIER 5 + PADDLE 11 + ADMIN 5 + PROD 9 + ANALYTICS 6 + TEST 7 + DEPLOY 3)
- Mapped to phases: **77** · Unmapped: **0** ✓ · Duplicates: **0** ✓

Note: The REQUIREMENTS.md traceability footer previously listed "69 total" — this was an off-by-2 miscount (verified by enumerating all REQ-IDs in the traceability table). The correct total is 71.

**Content + lab + landing track** (Phases 6–9):
- New requirement families: CONTENT-*, READER-*, LAB-*, LIB-*, LAND-*
- Counts TBD until `/gsd:plan-phase 6..9` enumerates them
- REQUIREMENTS.md will be extended at plan time

**Email engagement track** (Phases 10–11):
- New requirement families: DRIP-*, BLAST-*, REENG-*
- Counts TBD until `/gsd:plan-phase 10..11` enumerates them
- Compliance line items (CAN-SPAM / GDPR / one-click unsubscribe) folded into BLAST + REENG

---
*Roadmap created: 2026-04-13*
*Phases 6-9 added: 2026-05-19 (content + lab + landing track)*
*Phases 10-11 added: 2026-05-20 (email engagement track)*
*Granularity: 11 phases — 5 v1 + 4 content/lab/landing + 2 email*
*Parallelization: enabled*
