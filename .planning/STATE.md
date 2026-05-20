---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_plan: Not started
status: unknown
stopped_at: Phase 3 context gathered
last_updated: "2026-04-14T15:46:21.032Z"
progress:
  total_phases: 12
  completed_phases: 2
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** A student goes from zero to passing the CEH v13 exam in fourteen 30-minute sessions, synced across devices — free for the first 3 days, then $30/mo for the full curriculum and exam simulator.
**Current focus:** Phase 02 — email-identity

## Current Position

**Current Phase:** 3
**Current Plan:** Not started
**Total Plans in Phase:** 6

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Stabilization | 0/TBD | — | — |
| 2. Email Identity | 0/TBD | — | — |
| 3. Google OAuth | 0/TBD | — | — |
| 4. Paddle Billing + Tier Gate | 0/TBD | — | — |
| 5. Production Hardening | 0/TBD | — | — |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*
| Phase 01-stabilization P01 | 4 min | 1 tasks | 2 files |
| Phase 01 P04 | 4 min | 2 tasks | 7 files |
| Phase 01 P02 | 4 min | 2 tasks | 4 files |
| Phase 01-stabilization P03 | 4 min | 3 tasks | 3 files |
| Phase 01-stabilization P06 | 8 min | 4 tasks | 6 files |
| Phase 01-stabilization P05 | 4 min | 2 tasks | 2 files |
| Phase 02 P01 | 5 min | 3 tasks | 3 files |
| Phase 02-email-identity P02 | 5 min | 2 tasks | 2 files |
| Phase 02-email-identity P03 | 9min | 2 tasks | 6 files |
| Phase 02-email-identity P04 | 4min | 2 tasks | 4 files |
| Phase 02-email-identity P05 | 18min | 3 tasks | 7 files |
| Phase 02-email-identity P06 | 23min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Full decision log lives in PROJECT.md Key Decisions table. Most recent decisions affecting current work:

- **Roadmap**: 5 phases (standard granularity) — Stabilization → Email → OAuth → Paddle → Hardening; hard dependency chain, no resplit
- **Phase 2 scope**: Keep Email+Verify+Reset fused — they share `lib/auth/tokens.ts` and `lib/infra/resend/`; splitting creates false decoupling
- **Phase 4 before Phase 5 CSP**: Paddle domains can only be allowlisted after the overlay is integrated and Report-Only-baselined
- **Phase 2 before Phase 3**: OAuth `decideLink` auto-link gate literally reads `emailVerifiedAt`, which Phase 2 is the only thing that can set
- [Phase 01-stabilization]: ClientMeta capture-once pattern locked for Phase 1-5 auth surface — Reading next/headers across Mongoose await boundaries in Next.js 15 is unsafe (AsyncLocalStorage scope tear-down). audit() now takes meta as first positional arg so missed call sites fail at compile time. ClientMeta type exported so Phase 2-5 reuse the same shape.
- [Phase 01]: FREE_DAY_LIMIT typed as '3 as const' literal (not number-widening) so Phase 4 exhaustive switches over day numbers can use it as a literal discriminator — Preserves literal type for downstream pattern-matching
- [Phase 01]: canAccessExam stubbed in Phase 1 as 'tier === pro' so Phase 4 imports the same module without churn at the call site when the fuller TIER-04 rule lands — Eliminates a future seam migration; one extra one-line stub now saves a refactor later
- [Phase 01]: canAccessDay enforces a defensive integer-and-range check (day must be 1..14, integer) — out-of-range days return false even for pro tier — Catches the class of 'loose validation in caller' bugs cheaply with one Number.isInteger + range check
- [Phase 01]: Pass dbName explicitly to server.getUri('ceh-prep') — the no-arg form drops the db segment and mongoose falls back to 'test'. Caught via runtime smoke test on top of research Pattern 3 as written.
- [Phase 01]: Lazy-import pattern locked for dev-only packages: 'import type { X } from pkg' + 'const { X } = await import(pkg)' keeps the value out of the production bundle (Next.js code-splits dynamic imports, type imports are erased).
- [Phase 01]: globalThis.__memoryMongo cache shape (instance, uri) is the Phase 5 Vitest harness contract — replicate in vitest.globalSetup.ts so tests get a single memory server per process without importing from lib/db/mongo.ts.
- [Phase 01]: MONGO_URI default is memory:// (Zod .default) — new contributors clone and run without touching env vars. Atlas SRV strings are explicit overrides, not the happy path.
- [Phase 01-stabilization]: Audit TTL via field-level expires:"90d" shortcut — single source of truth, obsoletes both field-level index:true and schema-level .index() call — Mongoose v8 SchemaDateOptions.expires IS the TTL index; any parallel definition triggers [MONGOOSE] Warning duplicate
- [Phase 01-stabilization]: All 8 new User fields additive with default:null (or "user"/"free") — no migration script needed — Phase 1's goal is unblocking Phases 2-5 with zero data migrations; existing docs auto-work via Mongoose defaults at read time
- [Phase 01-stabilization]: googleSub + paddleCustomerId use unique:true + sparse:true (field-level only) — Without sparse:true, MongoDB treats null as a value and the second null doc violates the unique constraint; sparse means 'only index docs where the field is set'
- [Phase 01-stabilization]: All 4 token hash fields + their expiration timestamps use select:false — Defense in depth — even if a .lean() or default-projection query forgets to exclude them, Mongoose drops them; caller must explicitly .select(+emailVerifyTokenHash) to fetch
- [Phase 01-stabilization]: tier default flip to "free" is a lockstep pair — BOTH userSchema.default AND toPublicUser fallback must use "free" — If only the schema flips, legacy docs missing tier would still appear Pro in the UI because the DTO fallback was ?? "pro"; the paywall would remain a no-op. Documented as a paired flip so Phase 5 deploy verifies both together.
- [Phase 01-stabilization]: Exact-pin-only-on-CVE-deps policy locked: next@15.2.3 and mongoose@8.9.5 are the only no-caret pins; everything else stays caret. Prevents accidental minor drift past CVE-2025-29927 and CVE-2025-23061 floors.
- [Phase 01-stabilization]: CVE-2025-66478 (next.js) deferred to Phase 5. Locked floor at 15.2.3 per 01-CONTEXT version-pin policy; mid-phase floor bump would break downstream 01-03/01-05 contracts and needs fresh CVE research.
- [Phase 01-stabilization]: MONGO_URI=memory:// is the .env.example default. Fresh-clone npm-run-dev requires zero infrastructure; the memory-server fallback from 01-02 handles the runtime side.
- [Phase 01-stabilization]: docker-compose.yml commits zero credentials (not even placeholders). Local-dev-only file; production uses Atlas. Avoids the 'it's fine to commit fake secrets' precedent.
- [Phase 01-stabilization]: check-no-eq.sh allowlist tuned not loosened: added ??, return {, : ident.field (value-position only), <tag to skip false positives in dto/session/content files. Negative test on contrived findOne({ email: x }) still trips exit 1.
- [Phase 01-stabilization]: STAB-03 enforcement: page.tsx pattern is requireSession -> connectDB -> UserModel.findOne({_id:{$eq:session.userId}}).select('tier').lean() (fail-closed to 'free' on catch) -> canAccessDay gate -> redirect(/pricing?from=day-{n}) OUTSIDE the try/catch so NEXT_REDIRECT is never swallowed.
- [Phase 01-stabilization]: Single source of truth, two enforcement points locked in: both course/[day]/page.tsx AND saveAnswer in progress.ts import canAccessDay from @/lib/billing/entitlements. Phase 4 can evolve the tier rule in ONE place and both gates pick it up with zero drift risk.
- [Phase 01-stabilization]: generateStaticParams deleted from course/[day]/page.tsx — not overridden with force-dynamic. Prerendering a session-gated route was a latent leak bug; deleting the export is the honest fix, force-dynamic would have been papering over.
- [Phase 01-stabilization]: Fail-closed tier resolution: on any Mongo error in the page gate, userTier stays 'free' in the catch and the page redirects to /pricing. Better to annoy a pro user on a transient blip than to leak a lesson body to a free user ever.
- [Phase 01-stabilization]: isFreeDay retained in lib/content/ and still used in course/[day]/page.tsx for the cosmetic 'free tier' badge on days 1-3 lesson header. The badge is NOT a gate; canAccessDay is the gate. Phase 4 may consolidate UI hints into a separate lib/content/display.ts helper.
- [Phase 02]: Phase 2 token primitive: node:crypto randomBytes(32) + base64url (43 chars, 256 bits) + SHA-256 hex (64 chars). No userland deps. SHA-256 not Argon2 — single-use short-lived tokens don't need memory-hard hashing (PITFALLS.md #9).
- [Phase 02]: Token TTLs: verify_email=24h (NIST SP 800-63B), reset_password=1h (OWASP). TTL table typed Readonly<Record<TokenPurpose, number>> so exhaustive switches over purposes are compiler-enforced downstream.
- [Phase 02]: isExpired runs AFTER hash match, is pure and null-safe (null/undefined = expired). Defeats timing oracles that would otherwise distinguish 'hash not found' from 'hash found but expired' (PITFALLS.md #10).
- [Phase 02-email-identity]: Plan 02-02: Exported captureClientMeta/verifyOrigin/audit from auth.ts as public imports for Phase 2 downstream — Next.js 15 'use server' files support server-to-server named exports for non-action helpers; no client leakage risk because captureClientMeta crashes outside request scope anyway
- [Phase 02]: RESEND_API_KEY optional in dev (stub console-log path); RESEND_FROM_ADDRESS default 'CEH Sprint <no-reply@localhost>' with production refinement that rejects the literal 'localhost'. Dev default becomes a load-bearing safety belt — prod boot fails loudly if the env var isn't overridden.
- [Phase 02]: sessionEpoch as integer counter (default:0, select:false), not sessionRevokedAt timestamp. Integer compare is immune to clock skew across app instances; $inc is atomic; backfill is implicit because undefined ?? 0 === 0. No migration script needed.
- [Phase 02-email-identity]: Plan 02-02: Front-loaded all 4 new ActionErrorCode variants (email_send_failed, token_invalid, token_expired, already_verified) in 02-02 instead of incrementally in 02-04/05/06 — prevents three separate touches of auth.ts across the parallel Phase 2 wave, eliminating lost-update merge friction
- [Phase 02-email-identity]: Plan 02-02: ConfirmResetSchema token field is z.string().min(32).max(64) not length(43) — forward-compat with future token entropy changes in lib/auth/tokens.ts without breaking downstream validation; obvious garbage still rejected by the min bound
- [Phase 02-email-identity]: Plan 02-02: VerifyEmailSchema is z.object({}) typed empty, not z.never() — enables uniform Schema.safeParse({}) call pattern in the resend-verification action consistent with signup/login, even though the action has no user-provided input (user derives from session)
- [Phase 02-email-identity]: Plan 02-03 established lib/infra/resend/ as the first populated vendor boundary — single-file Resend SDK import, server-only guard, dev stub that returns fake id + logs [resend:dev] so local dev needs zero credentials; pattern mirrored later by lib/infra/google/ and lib/infra/paddle/
- [Phase 02-email-identity]: React Email templates are authored with self-contained 'as const' styles literals (not a shared module) — each template is audit-in-isolation and defeats accidental CSS cross-pollination; system-ui fallback stack used because email clients (Gmail/Outlook/Apple Mail) don't load web fonts reliably
- [Phase 02-email-identity]: Plan 02-04: send.ts inlines emailHash via node:crypto (sha256+slice(0,12)) instead of importing from tokens.ts — audit-in-isolation; the 12-char fingerprint width is part of the audit surface contract, not the token primitive surface
- [Phase 02-email-identity]: Plan 02-04: requireSession return widened to {userId, email, epoch} and backward-compatible — destructuring an extra field is legal TS, so progress.ts and course/[day]/page.tsx callers typecheck unchanged; eliminates the need for downstream reset/email actions to re-read the session
- [Phase 02-email-identity]: Plan 02-04: requireSession now does one Mongo findOne per protected request (narrow select +sessionEpoch + lean<T|null>()) — accepted cost per 02-CONTEXT Open Question #3; request-scoped memoization deferred to Phase 5 if metrics show it matters
- [Phase 02-email-identity]: Plan 02-05: Extracted lib/actions/shared.ts for non-action primitives (ClientMeta, ActionState, captureClientMeta, verifyOrigin, audit) to comply with Next 15 build-time constraint that every top-level export from a 'use server' file must be async. Phase 1's co-location in auth.ts was legal by coincidence but created cross-boundary hazards; rewired auth/email/reset/send/route-handler callers in one lockstep commit.
- [Phase 02-email-identity]: Plan 02-05: resendVerificationEmail uses requireSession() NOT getSession() — enforces sessionEpoch drift check on every resend, destroying stale sessions left by concurrent password-reset on another device. Load-bearing RESET-03 contract; downstream callers must never regress to getSession.
- [Phase 02-email-identity]: Plan 02-05: Inline server-action adapter pattern for form-action signature mismatch. React 19 <form action={fn}> expects (FormData) => void|Promise<void>; Phase 2 convention is (prev, formData) => ActionState. Bridge via one-line async function with 'use server' body directive that discards the ActionState return. Preserves progressive enhancement and keeps server components unpolluted by 'use client'.
- [Phase 02-email-identity]: Plan 02-05: Signup tier default flip 'pro' -> 'free' — Phase 1 schema default was already 'free', but signup code was overriding to 'pro', silently bypassing the Phase 4 paywall for every new account. Latent security bug fixed as Rule 1 auto-fix.
- [Phase 02-email-identity]: Plan 02-06: requestPasswordReset structural invariants enforced by strict awk/grep in VALIDATION.md §RESET-01 — exactly ONE top-level return {} at body bottom (regex ^\s*return \{\};\$ count === 1), hashPassword pad burned on all four non-success branches (miss, rate-limit-ip, rate-limit-id, parse-fail). Comment moved above the return line so the strict regex matches.
- [Phase 02-email-identity]: Plan 02-06: confirmPasswordReset uses getSession() (not requireSession()) before session.destroy() — users clicking a reset link may have no session on the device; requireSession would throw UNAUTHORIZED and block the reset. Single $inc sessionEpoch is the sole session-invalidation mechanism; other devices fail at the next requireSession drift check from 02-04.
- [Phase 02-email-identity]: Plan 02-06: AMENDMENT to 02-02 decision — Next 15 enforces at BUILD time that every export from a "use server" file is an async function. tsc --noEmit doesn't catch this. lib/actions/shared.ts now holds ClientMeta/ActionErrorCode/ActionState/captureClientMeta/verifyOrigin/audit; lib/actions/auth.ts is server-actions-only. Parallel 02-05 executor converged on the identical refactor independently (commit 5db6c0c).

### Non-negotiable guardrails (carry these into every plan)

- Every Mongo query wraps user input in `$eq` (CI grep-check enforces in Phase 5)
- Middleware never does auth — auth is re-verified at every protected layout and every server action (CVE-2025-29927 defense-in-depth)
- `runtime = "nodejs"` on every route that touches Paddle / Google / Mongoose / Pino / Resend
- Paddle webhook: `await request.text()` BEFORE anything else; `paddle.webhooks.unmarshal` with the raw body; idempotency via unique index on `WebhookEvent.eventId`
- Google OAuth: own the flow (no NextAuth); state + PKCE in separate httpOnly `SameSite=Lax` single-use cookies; auto-link ONLY when `existingByEmail.emailVerifiedAt !== null AND googleSub === null`
- Tier gate enforced at BOTH page render AND action call (`canAccessDay` / `canAccessExam` from `lib/billing/entitlements.ts` — single source of truth, two enforcement points)
- Pro tier price: **$30/mo USD** — not $0, not $9, not "beta"
- No Claude/Anthropic co-author tags on any commit, PR, or push
- No hardcoded credentials; all secrets via Zod-validated env at boot

### Roadmap Evolution

- 2026-05-19: Added Phase 6 (Curriculum Content Module) — `lib/content/` never committed; app does not compile without it
- 2026-05-19: Added Phase 7 (Lesson Reader Polish) — toolbar / scroll-spy / progress strip
- 2026-05-19: Added Phase 8 (Pro Lab Integration / WebVM) — embed `saharbarak.github.io/ceh-webvm` per-day, postMessage pass/fail back to host
- 2026-05-19: Added Phase 9 (Premium Content Library + Landing Lift) — render `docs/content/*.md` as `/bonus`, rework hero copy with real content samples
- 2026-05-20: Added Phase 10 (Email Drip — Curriculum Sequence) — Resend Audiences + 14-day onboarding drip; Day 4 free→Pro upsell
- 2026-05-20: Added Phase 11 (Email Broadcast + Re-engagement) — fire-on-publish bonus digest + 7/21-day re-engagement nudges
- 2026-05-20: Added Phase 12 (Testing + LLM Quality Review) — two-track:
    Track A: Vitest + Playwright + MSW + supertest deterministic suite, advisory CI on every PR.
    Track B: Claude-driven nightly ICP-funnel-simulation harness — 3-5 ICP personas walk the full product, vision-API judges animations + trust + conversion, chain-of-critique produces ranked friction reports under .planning/qa-reports/YYYY-MM-DD.md.
    Severity: advisory only (never blocks merges). Budget capped via CLAUDE_QA_MAX_USD env (default $2/run, ~$30/mo).

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] ~~Local dev currently broken — `npm run dev` 500s on every auth route until STAB-06 (`mongodb-memory-server` or Docker Compose path) lands.~~ RESOLVED in 01-02 (mongodb-memory-server fallback + Atlas-tuned pool). Remaining doc side (docker-compose.yml, .env.example, README) lands in 01-06.
- [Cross-phase] Requirements footer reported 69 v1 reqs — correct count is 71. ROADMAP.md coverage section documents this; REQUIREMENTS.md footer will be corrected alongside.

## Session Continuity

Last session: 2026-04-14T15:46:21.014Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-google-oauth/03-CONTEXT.md
