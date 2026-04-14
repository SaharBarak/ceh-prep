# Phase 1: Stabilization — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Mode:** Auto (decisions below are recommended defaults; override by editing this file before `/gsd:plan-phase 1`)

<domain>
## Phase Boundary

Kill the four known bugs corrupting the integration-test baseline, pin the two CVE-patched versions, scaffold the folder structure and User schema every downstream phase writes to, and make local dev work without a live Mongo connection. This phase ships zero new user-facing features — its entire purpose is unblocking Phases 2-5.

**In scope:** STAB-01..09 (see REQUIREMENTS.md). Specifically: signup 500 fix, Mongoose duplicate-index cleanup, page-level tier gate, `next` + `mongoose` version pins, local dev Mongo story, Atlas wiring, `lib/infra/` + `lib/guards/` + `lib/billing/` folder scaffolding, User schema extension.

**Out of scope:** Email sending (Phase 2), Google OAuth (Phase 3), Paddle billing (Phase 4), production CSP rewrite (Phase 4/5), tests + CI (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Signup 500 fix approach (STAB-01)
- **Refactor, don't patch.** The root cause is `headers()` being re-called inside `audit()` after a Mongoose await — the AsyncLocalStorage request scope is already lost by then.
- Introduce a `ClientMeta` type (`{ ip: string; ua: string; origin: string }`) collected ONCE at the top of every server action, passed explicitly to `audit()`, `rateLimit()`, and anything else that needs request context.
- `audit()` loses its `headers()` call entirely — becomes a pure function of its inputs.
- Same pattern applied retroactively to login and logout actions so the fix holds across the existing auth surface.
- Verification: integration test that signs up with Mongo offline (simulated timeout) still returns a structured error, never 500.

### Mongoose duplicate index warnings (STAB-02)
- Remove the explicit `userSchema.index({ email: 1 }, { unique: true })` in `app/src/lib/db/models/user.ts` — the field-level `unique: true, index: true` already creates it.
- Remove the explicit `auditSchema.index({ at: 1 }, ...)` in `app/src/lib/db/models/audit.ts` — same issue with the `at` field's `index: true`.
- Keep the TTL settings (`expireAfterSeconds: 60 * 60 * 24 * 90`) — those still need an explicit `index()` call because they're not pure index definitions.
- Verification: `npm run dev` boots with zero `[MONGOOSE] Warning` lines in console.

### Page-level tier gate (STAB-03)
- `app/src/app/(app)/course/[day]/page.tsx` gains a server-side tier check BEFORE any content renders.
- Free users hitting day 4+ are redirected to `/pricing?from=day-{n}` so the pricing page knows to show contextual upgrade copy ("You just hit Day {n} — $30/mo unlocks the full sprint").
- The redirect uses `redirect()` from `next/navigation` (not a client-side router.push), so the HTML content for the gated day never reaches the client.
- The same `canAccessDay(tier, day)` pure function from `lib/billing/entitlements.ts` (created in this phase as a stub, fully populated in Phase 4) is the source of truth. Action-level and page-level both import from the same module — zero rule drift.
- For this phase, the function lives at `lib/billing/entitlements.ts` and implements the v1 rule: `tier === "free" ? day <= 3 : true`. Tier-based extension lands in Phase 4.

### Version pin policy (STAB-04, STAB-05)
- **Exact pins** on `next` and `mongoose` — these are the CVE-sensitive packages (CVE-2025-29927 and CVE-2025-23061). Exact pin prevents accidental minor drift past a known-safe range.
- Caret (`^`) on every other dependency — matches existing package.json style; reduces lockfile churn.
- Pin `next@15.2.3` (minimum CVE-safe version) and `mongoose@8.9.5` (minimum CVE-23061-safe version) — track upstream but only bump deliberately.
- Verification: `npm ls next | grep next@` shows exact version; `npm ls mongoose | grep mongoose@` shows exact version.

### Local dev Mongo path (STAB-06)
- **Both approaches documented**, with mongodb-memory-server as the default so `npm run dev` "just works" with zero setup.
- Add `mongodb-memory-server` as a `devDependencies` entry; on dev boot, if `MONGO_URI` is absent OR starts with `memory://`, spin up an in-process MongoDB via `MongoMemoryServer.create()` and swap the URI at runtime.
- Docker Compose file at `app/docker-compose.yml` for developers who want a persistent dev Mongo. `docker compose up -d` gives them `mongodb://localhost:27017/ceh-prep`. README documents it as the alternative path.
- Tests (Phase 5) will also use `mongodb-memory-server` via `globalSetup` — same dependency, same muscle memory.
- `.env.example` updated: comment block explains the three options (memory-server default, docker compose, Atlas production).

### Atlas production wiring (STAB-07)
- **No secrets in this commit.** Deploy guide (Phase 5) walks the user through creating an M0 cluster, generating credentials, and pasting the SRV string into Vercel env vars.
- Mongoose client options tuned for Vercel serverless per research: `maxPoolSize: 5`, `maxIdleTimeMS: 30_000`, `serverSelectionTimeoutMS: 8_000`.
- Connection cache across hot reloads already exists in `lib/db/mongo.ts` — keep it.
- For this phase: update the `connectDB()` options, add a comment pointing to deploy docs, done.

### Folder stubs (STAB-08)
- Each of `lib/infra/`, `lib/guards/`, `lib/billing/` gets:
  1. A `README.md` explaining its purpose, what belongs in it, and what doesn't — reads like an architectural boundary doc
  2. An `index.ts` that re-exports the public surface (initially empty, but typed — downstream phases append to it)
- `lib/infra/README.md` specifically states: "Vendor SDKs live here. Domain layers NEVER import from infra/ directly. This is the single sink for Paddle, Google OAuth, Resend, and any future third-party SDK."
- `lib/guards/README.md` documents the guard pattern: "Guards compose `requireSession()` with additional authorization checks. Every guard returns `Result<GuardedContext, GuardError>`. Guards are called at BOTH page render AND server action entry."
- `lib/billing/README.md` documents entitlements: "Pure domain rules. No SDK imports. No I/O. `canAccessDay(tier, day)` is the single source of truth for free/pro gating."

### User schema extension (STAB-09)
- All new fields nullable (`default: null`), all sparse-indexed where applicable, all additive (zero breaking changes to existing docs).
- New fields:
  - `emailVerifiedAt: Date | null` — set in Phase 2 on verification
  - `googleSub: string | null` (sparse unique index) — set in Phase 3 on OAuth link
  - `paddleCustomerId: string | null` (sparse unique index) — set in Phase 4 on first checkout
  - `role: "user" | "admin"` (default `"user"`) — promoted via CLI script in Phase 5
  - `emailVerifyTokenHash: string | null` — short-lived, set in Phase 2
  - `passwordResetTokenHash: string | null` — short-lived, set in Phase 2
  - `emailVerifyTokenExpiresAt: Date | null` — paired with the verify token
  - `passwordResetTokenExpiresAt: Date | null` — paired with the reset token
- The DTO mapper in `lib/dto/user.ts` is extended to expose `emailVerifiedAt` and `role` publicly (needed for UI conditionals). It NEVER exposes `googleSub`, `paddleCustomerId`, or any token hash — those are strictly server-side.
- The existing `tier: "free" | "pro"` field's default flips from `"pro"` to `"free"` in this phase so new signups correctly enter the free tier (the scaffold default was a placeholder that would make Phase 4 a no-op for new users).

### Claude's Discretion
- Exact error codes in the `ClientMeta` refactor (use the existing `ActionState.error` union style — consistent with `forbidden_origin`, `invalid_input`, etc.)
- The `MongoMemoryServer.create()` cache behavior across hot reloads — must match the existing `connectDB` global cache pattern so a single in-process Mongo survives reloads
- README tone for the three `lib/` READMEs — match the taste-skill aesthetic of the existing PLAN.md: tight, declarative, no fluff
- Whether to add a `scripts/check-no-eq.sh` linter script in this phase or defer to Phase 5 CI (recommendation: stub it now, wire into CI in Phase 5)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + roadmap
- `.planning/PROJECT.md` — Product vision, constraints, CLAUDE.md-derived standards
- `.planning/REQUIREMENTS.md` §STAB — The 9 requirements this phase delivers
- `.planning/ROADMAP.md` §"Phase 1: Stabilization" — Goal, requirements, success criteria

### Research
- `.planning/research/SUMMARY.md` §"Phase 1: Stabilization + Infrastructure Foundation" — Phase rationale
- `.planning/research/STACK.md` §"MongoDB Atlas M0" + §"Runtime Compatibility Matrix" — Connection pool tuning, `runtime = "nodejs"` rule
- `.planning/research/PITFALLS.md` Pitfalls 14 (CVE-2025-29927), 16 (`$eq` wrap / CVE-2025-23061), 17 (in-process rate limit), 20 (headers-after-await)
- `.planning/research/ARCHITECTURE.md` §"New Directories to Add" — The `lib/infra/`, `lib/guards/`, `lib/billing/` scaffolding spec

### Codebase map
- `.planning/codebase/STACK.md` — Current locked stack, versions, scripts
- `.planning/codebase/STRUCTURE.md` — Existing `src/lib/` layout to extend
- `.planning/codebase/CONVENTIONS.md` — Existing code style (strict TS, Result monad, Zod-at-boundary, `$eq` wrap, DTO pattern)
- `.planning/codebase/CONCERNS.md` #1 (signup 500), #2 (duplicate indexes), #3 (no local Mongo), #6 (tier gate incomplete) — Root causes already documented

### Files this phase touches
- `app/src/lib/actions/auth.ts` — Signup/login/logout refactor for STAB-01
- `app/src/lib/db/models/user.ts` — Duplicate index removal + schema extension (STAB-02, STAB-09)
- `app/src/lib/db/models/audit.ts` — Duplicate index removal (STAB-02)
- `app/src/lib/db/mongo.ts` — Atlas connection options tuning (STAB-07)
- `app/src/lib/dto/user.ts` — DTO extension to expose emailVerifiedAt + role (STAB-09)
- `app/src/app/(app)/course/[day]/page.tsx` — Page-level tier gate (STAB-03)
- `app/package.json` — Version pins (STAB-04, STAB-05), `mongodb-memory-server` dep (STAB-06)
- `app/docker-compose.yml` — New file (STAB-06)
- `app/.env.example` — Updated comments (STAB-06)
- `app/src/lib/infra/README.md` + `index.ts` — New (STAB-08)
- `app/src/lib/guards/README.md` + `index.ts` — New (STAB-08)
- `app/src/lib/billing/README.md` + `index.ts` + `entitlements.ts` — New (STAB-08 + sets up TIER-01 for Phase 4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `Result<T, E>` monad at `app/src/lib/result.ts` — Use for all new error returns in the refactored auth actions
- `DTO mapper pattern` at `app/src/lib/dto/user.ts` — Extend, never replace. Add new allowed fields to the allowlist.
- `Zod-at-boundary` at `app/src/lib/validation/schemas.ts` — Every new input validates here first
- `connectDB()` global cache at `app/src/lib/db/mongo.ts` — Hot-reload-safe Mongoose connection; extend options, don't replace
- `ActionState` discriminated union at `app/src/lib/actions/auth.ts` — Existing error code vocabulary to extend (not replace)

### Established patterns
- `$eq` wrap on every user-supplied value in Mongoose queries — extend to all new queries in this phase (though this phase adds few queries)
- DDD layering: `lib/actions/` → `lib/domain/` → `lib/db/` → `lib/dto/`. The new `lib/infra/`, `lib/guards/`, `lib/billing/` folders slot into this without disruption.
- Server actions re-verify auth at entry; middleware never does auth (CVE-2025-29927 defense). Preserve.
- Structured error codes, never raw messages to client. Preserve.

### Integration points
- The new `lib/billing/entitlements.ts::canAccessDay` is imported from TWO places in this phase: the existing `saveAnswer` action (replaces inline `isFreeDay` check) AND the new page-level gate in `course/[day]/page.tsx`. Both import the same function — single source of truth.
- The `ClientMeta` refactor touches every existing server action in `lib/actions/auth.ts`. Do all three (signup, login, logout) in the same commit so the pattern is consistent across the surface.

</code_context>

<specifics>
## Specific Ideas

- The `headers()`-after-await bug is the reason the whole product is currently broken in dev. This fix is the critical path — everything else is scaffolding behind it.
- The folder scaffolding (`lib/infra/`, `lib/guards/`, `lib/billing/`) exists to prevent merge conflicts between Phases 2-5 when they all land on the same surface. Get the boundaries right now.
- The `tier` field default flip from `"pro"` to `"free"` is load-bearing for Phase 4 — without it, new signups skip the paywall entirely. Easy to miss.
- The Atlas connection pool tuning (maxPoolSize 5, maxIdleTimeMS 30_000) matters for Vercel serverless cold-start fragmentation — research flagged that M0 has only 100 total connections.

</specifics>

<deferred>
## Deferred Ideas

None surfaced during discussion — scope stayed tight to Phase 1's bug fixes + scaffolding. Every new feature idea belongs to Phases 2-5 and is already mapped in REQUIREMENTS.md.

</deferred>

---

*Phase: 01-stabilization*
*Context gathered: 2026-04-14*
