---
phase: 1
slug: stabilization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 ships no automated tests (Vitest/Playwright land in Phase 5, per TEST-01..07).
> Verification for this phase is a mix of static-file assertions, console-output checks,
> and HTTP smoke checks against a running dev server.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None in Phase 1 (Vitest + Playwright deferred to Phase 5 TEST-01..07) |
| **Config file** | `app/tsconfig.json` (typecheck is the closest thing we have) |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npm run typecheck && npm run lint && npm run dev & sleep 8 && curl -sI http://localhost:3000 && kill %1` |
| **Estimated runtime** | ~30 seconds (typecheck + boot + curl + kill) |

---

## Sampling Rate

- **After every task commit:** `cd app && npx tsc --noEmit` (catches type regressions immediately)
- **After every plan wave:** Boot `npm run dev` and run the Wave's observable-outcome checks from `01-RESEARCH.md` § Validation Architecture
- **Before `/gsd:verify-work`:** Full manual smoke — signup form submits, dashboard loads, `/course/5` redirects, console shows zero Mongoose warnings
- **Max feedback latency:** 30 seconds (typecheck) / 90 seconds (full smoke)

---

## Per-Task Verification Map

Populated by `gsd-planner` once plans are written. Tasks map to REQ-IDs as follows:

| REQ-ID | Validation Type | Command / Check |
|---|---|---|
| STAB-01 | HTTP smoke | `curl -X POST localhost:3000/signup` with stub body; expect 302 or 400, NEVER 500 |
| STAB-01 | Integration | Kill Mongo mid-signup (simulated timeout); expect structured error, not crash |
| STAB-02 | Console output | `npm run dev 2>&1 \| grep -c "Duplicate schema index"` → expect 0 |
| STAB-03 | HTTP redirect | `curl -i localhost:3000/course/5` as free user → expect 307 Location `/pricing?from=day-5` |
| STAB-03 | Content leak check | `curl localhost:3000/course/5` body should NOT contain any Day 5 lesson text |
| STAB-04 | Static version check | `cd app && npm ls next \| grep -E "next@15\\.(2\\.3\|[3-9])"` → exit 0 |
| STAB-05 | Static version check | `cd app && npm ls mongoose \| grep -E "mongoose@8\\.(9\\.[5-9]\|[1-9][0-9])"` → exit 0 |
| STAB-06 | Fresh-install smoke | `cd app && rm -rf node_modules && npm ci && npm run dev` works without setting `MONGO_URI` |
| STAB-06 | Docker alt path | `docker compose -f app/docker-compose.yml up -d && curl mongodb://localhost:27017` responds |
| STAB-07 | Static config check | grep `maxPoolSize: 5` in `app/src/lib/db/mongo.ts` |
| STAB-07 | Static config check | grep `maxIdleTimeMS: 30` in `app/src/lib/db/mongo.ts` |
| STAB-08 | File existence | `test -f app/src/lib/infra/README.md && test -f app/src/lib/guards/README.md && test -f app/src/lib/billing/README.md` |
| STAB-08 | File existence | `test -f app/src/lib/billing/entitlements.ts` |
| STAB-08 | Export check | `grep -q "export.*canAccessDay" app/src/lib/billing/entitlements.ts` |
| STAB-09 | Schema introspection | Mongoose-side: `UserModel.schema.path('emailVerifiedAt')` is defined |
| STAB-09 | Schema introspection | All 8 new fields present: emailVerifiedAt, googleSub, paddleCustomerId, role, emailVerifyTokenHash, passwordResetTokenHash, emailVerifyTokenExpiresAt, passwordResetTokenExpiresAt |
| STAB-09 | Default flip check | `grep "default: \"free\"" app/src/lib/db/models/user.ts` |

Task-level Status codes: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

---

## Wave 0 Requirements

- None. Phase 1 adds no test infrastructure. Validation runs via typecheck + curl + grep.
- Vitest + Playwright installation deferred to Phase 5 (TEST-01 / TEST-03).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Signup form in a real browser submits without a 500 page | STAB-01 | Needs real browser session, CSRF cookie, redirect follow | 1. `npm run dev`. 2. Open http://localhost:3000/signup. 3. Enter a fresh email + strong 12+ char password. 4. Click Create account. 5. Expect redirect to `/dashboard`, no 500. |
| Mongoose duplicate-index warnings are gone | STAB-02 | Requires observing `next dev` console boot stream | 1. `npm run dev`. 2. Wait for "Ready" line. 3. Visit http://localhost:3000. 4. Confirm console has zero lines containing `Warning: Duplicate schema index`. |
| Free user hitting Day 5 is redirected | STAB-03 | Requires an actual free-tier session cookie | 1. Sign up a new account (will be free tier after Phase 1). 2. Browser-navigate to /course/5. 3. Expect instant redirect to /pricing?from=day-5 with upgrade CTA visible. |
| Memory-server dev path works with zero setup | STAB-06 | Requires fresh clone context | 1. In a sibling directory clone the repo. 2. `cd app && npm ci && npm run dev` without touching .env. 3. Expect memory-server boot line in console, dev server ready, signup flow works end-to-end. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc + grep + curl) or are explicitly Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — no test infra in Phase 1)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner populates task-level map)

**Approval:** pending
