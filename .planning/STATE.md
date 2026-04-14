# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** A student goes from zero to passing the CEH v13 exam in fourteen 30-minute sessions, synced across devices — free for the first 3 days, then $30/mo for the full curriculum and exam simulator.
**Current focus:** Phase 1 — Stabilization

## Current Position

Phase: 1 of 5 (Stabilization)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-13 — ROADMAP.md created from 71-requirement v1 scope across 5 dependency-ordered phases

Progress: [░░░░░░░░░░] 0%

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

## Accumulated Context

### Decisions

Full decision log lives in PROJECT.md Key Decisions table. Most recent decisions affecting current work:

- **Roadmap**: 5 phases (standard granularity) — Stabilization → Email → OAuth → Paddle → Hardening; hard dependency chain, no resplit
- **Phase 2 scope**: Keep Email+Verify+Reset fused — they share `lib/auth/tokens.ts` and `lib/infra/resend/`; splitting creates false decoupling
- **Phase 4 before Phase 5 CSP**: Paddle domains can only be allowlisted after the overlay is integrated and Report-Only-baselined
- **Phase 2 before Phase 3**: OAuth `decideLink` auto-link gate literally reads `emailVerifiedAt`, which Phase 2 is the only thing that can set

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

- [Phase 1] Local dev currently broken — `npm run dev` 500s on every auth route until STAB-06 (`mongodb-memory-server` or Docker Compose path) lands. This will resolve itself in Phase 1's first plan.
- [Cross-phase] Requirements footer reported 69 v1 reqs — correct count is 71. ROADMAP.md coverage section documents this; REQUIREMENTS.md footer will be corrected alongside.

## Session Continuity

Last session: 2026-04-13
Stopped at: ROADMAP.md + STATE.md written; Phase 1 ready to plan via `/gsd:plan-phase 1`
Resume file: None
