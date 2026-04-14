---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 4
status: unknown
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-04-14T06:20:19.545Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 6
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** A student goes from zero to passing the CEH v13 exam in fourteen 30-minute sessions, synced across devices — free for the first 3 days, then $30/mo for the full curriculum and exam simulator.
**Current focus:** Phase 01 — stabilization

## Current Position

Phase: 01 (stabilization) — EXECUTING
Current Plan: 4
Total Plans in Phase: 6

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] ~~Local dev currently broken — `npm run dev` 500s on every auth route until STAB-06 (`mongodb-memory-server` or Docker Compose path) lands.~~ RESOLVED in 01-02 (mongodb-memory-server fallback + Atlas-tuned pool). Remaining doc side (docker-compose.yml, .env.example, README) lands in 01-06.
- [Cross-phase] Requirements footer reported 69 v1 reqs — correct count is 71. ROADMAP.md coverage section documents this; REQUIREMENTS.md footer will be corrected alongside.

## Session Continuity

Last session: 2026-04-14T06:20:19.540Z
Stopped at: Completed 01-02-PLAN.md
Resume file: None
