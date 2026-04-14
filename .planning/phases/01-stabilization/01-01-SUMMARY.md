---
phase: 01-stabilization
plan: 01
subsystem: auth
tags: [next-15, server-actions, async-local-storage, mongoose, audit-log, csrf, headers-after-await]

# Dependency graph
requires:
  - phase: 00-foundation
    provides: existing app/src/lib/actions/auth.ts (signup/login/logout) and AuditModel
provides:
  - "ClientMeta type ({ ip, ua, origin } readonly) exported from app/src/lib/actions/auth.ts"
  - "Pure audit() helper: takes ClientMeta as first arg, never re-enters next/headers"
  - "captureClientMeta() — single source of truth for request metadata, called once at action entry"
  - "ClientMeta capture-once pattern applied uniformly to signup, login, logout"
affects: [phase-2-email-identity, phase-3-google-oauth, phase-4-paddle-billing, phase-5-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ClientMeta capture-once: read headers() exactly once at server-action entry, pass plain object to all helpers"
    - "Pure audit sink: audit(meta, event, outcome, payload, userId?) — no AsyncLocalStorage dependency"
    - "Typed CTA.href via next Route type for typed-routes safety"

key-files:
  created:
    - app/src/lib/actions/auth.ts
    - app/src/app/pricing/page.tsx
  modified: []

key-decisions:
  - "ClientMeta is exported (not module-local) so Phase 2-5 can extend the same surface without redeclaring the type"
  - "Pattern applied to logout even though it has no connectDB() await — the rule is uniform: every action captures meta once at entry"
  - "audit() takes meta as first positional arg (not last) to make missing-meta a compile error, not a runtime bug"
  - "verifyOrigin and rateLimit untouched — they already took request-scoped values explicitly"

patterns-established:
  - "ClientMeta capture-once: every server action's first await is captureClientMeta(); helpers never call headers() themselves"
  - "Audit failures are swallowed silently — they must never break the auth flow"
  - "Origin verification uses the captured meta.origin, never a fresh headers() lookup"

requirements-completed: [STAB-01]

# Metrics
duration: 4 min
completed: 2026-04-14
---

# Phase 01 Plan 01: Kill Signup 500 — ClientMeta Capture-Once Refactor Summary

**Refactored auth.ts to capture request headers exactly once at server-action entry, eliminating the headers()-after-await crash that 500'd every signup the moment Mongoose paused the event loop.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T06:04:03Z
- **Completed:** 2026-04-14T06:08:18Z
- **Tasks:** 1
- **Files modified:** 2 (1 planned + 1 Rule 3 blocking auto-fix)

## Accomplishments

- **Killed the signup 500.** `audit()` no longer calls `headers()` from `next/headers`. The function that used to crash when re-entered after a Mongoose await is gone. Server actions now return structured `ActionState` errors even when Mongo is unreachable.
- **Established `ClientMeta` capture-once pattern** as the canonical shape for request metadata across the entire auth surface. `signup`, `login`, and `logout` all capture once at entry and pass `meta` explicitly to every helper that needs request context.
- **Exported `ClientMeta` type** so Phase 2 (email verify), Phase 3 (Google OAuth), and Phase 4 (Paddle) can extend the same surface without redeclaring it.
- **Made `audit()` a pure function of its inputs.** No AsyncLocalStorage dependency. No hidden side-channel reads. Trivially testable.
- **Cleared the codebase tsc baseline** as a side effect (Rule 3 blocking auto-fix on `pricing/page.tsx` typed-routes error).

## Task Commits

1. **Task 1: Refactor auth.ts to ClientMeta capture-once pattern** — `69e473d` (fix)

_Single-task plan — no segmentation. Two files in one atomic commit (the planned `auth.ts` rewrite plus the Rule 3 blocking pricing-page typed-route fix needed to satisfy the phase-level `tsc --noEmit` clean gate)._

## Files Created/Modified

- `app/src/lib/actions/auth.ts` — Full rewrite to ClientMeta capture-once pattern. Adds `export type ClientMeta`. Renames `getClientMeta` → `captureClientMeta`. Rewrites `audit()` to take `meta: ClientMeta` as the first positional arg and read `meta.ip` / `meta.ua` directly. Updates all 14 `audit()` call sites across signup (7), login (6), logout (1) to pass `meta` explicitly. Adds `await captureClientMeta()` as the first statement of every server action (including logout, for consistency).
- `app/src/app/pricing/page.tsx` — Rule 3 blocking auto-fix only. Imports `type { Route } from "next"` and tightens `CTA.href` from `string` to `Route` so Next.js typed-routes accepts it. Two-line type-only change, zero behavior change.

## Decisions Made

- **`ClientMeta` is exported, not module-local.** Phase 2-5 will all extend the same auth surface and they need a single shared type. Re-declaring it per file would invite drift.
- **`meta` is the FIRST positional argument of `audit()`, not the last.** This makes "forgot to pass meta" a compile error rather than a sneaky runtime bug. TypeScript catches every missed call site immediately.
- **`logout` got the same treatment** even though it has no `connectDB()` await and therefore can't trigger the original bug. Reason: the rule is "every action captures meta once at entry." Exceptions create cognitive overhead and invite Phase 2-5 to skip it on a different action that DOES trigger the bug.
- **`verifyOrigin` and `rateLimit` were NOT refactored.** Both already took their request-scoped values (`origin`, `ip`) explicitly. Touching them would have been pure churn.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing typed-routes tsc error in pricing/page.tsx**
- **Found during:** Task 1 verification (`cd app && npx tsc --noEmit`)
- **Issue:** `src/app/pricing/page.tsx:163:11 — Type 'string' is not assignable to type 'UrlObject | RouteImpl<string>'`. The pricing page's local `CTA` type declared `href: string`, but `next.config.ts` enables `experimental.typedRoutes: true`, which makes `next/link`'s `Link.href` require a `Route<string>`. This error pre-existed the plan (already documented in `.planning/phases/01-stabilization/deferred-items.md` by Plan 01-04's baseline check) but blocked Plan 01-01's phase-level success criterion that `cd app && npx tsc --noEmit` "passes clean after the refactor."
- **Fix:** Two-line change in `app/src/app/pricing/page.tsx`: `import type { Route } from "next"` and `type CTA = { label: string; href: Route; note?: string }`. Both `cta.href` literals (`"/"` and `"/signup"`) are valid app routes, so no string changes were needed.
- **Files modified:** `app/src/app/pricing/page.tsx`
- **Verification:** `cd app && npx tsc --noEmit` exits 0. Updated `deferred-items.md` to mark item resolved by Plan 01-01.
- **Committed in:** `69e473d` (folded into the Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Strictly additive. The blocking fix was needed to satisfy the phase-level `tsc --noEmit` clean criterion. Zero scope creep beyond the minimum required to unblock verification — only the type of `CTA.href` changed, no behavior touched.

## Issues Encountered

- **Pre-existing untracked `app/` directory.** The entire `app/` source tree was untracked at the directory level (the prior phase had not committed source files into git). The Task 1 commit therefore shows `create mode 100644` for both `auth.ts` and `pricing/page.tsx` — these files existed on disk but were not yet under git tracking. This is benign: the commit faithfully captures the post-refactor state, and the diff for review is the entire file (which is the right behavior for files entering version control).
- **Phase-level success criterion required `tsc --noEmit` clean.** A pre-existing typed-routes error in an unrelated file blocked this. Resolved as Rule 3 (Blocking) auto-fix; documented above and in `deferred-items.md`. No scope creep beyond the two-line type tightening.

## Verification Results

| Acceptance Criterion (from PLAN.md) | Expected | Actual |
| ----------------------------------- | -------- | ------ |
| `cd app && npx tsc --noEmit` exit code | 0 | **0** |
| `grep -c "headers(" app/src/lib/actions/auth.ts` | exactly 1 | **1** |
| `grep -c "getClientMeta" app/src/lib/actions/auth.ts` | 0 | **0** |
| `grep "export type ClientMeta" app/src/lib/actions/auth.ts` | 1 | **1** |
| `grep -E "const audit = async \(\s*meta: ClientMeta"` (multiline) | 1 | **1** |
| `grep -c "audit(meta," app/src/lib/actions/auth.ts` | ≥ 6 | **14** |
| `grep -c "await getClientMeta" app/src/lib/actions/auth.ts` | 0 | **0** |
| `grep -c "captureClientMeta" app/src/lib/actions/auth.ts` | ≥ 4 | **4** |
| New `any` types introduced | 0 | **0** |

All criteria pass.

## API Reference (for downstream phases)

**Final `audit()` signature** — Phase 2-5 must use this shape:

```typescript
const audit = async (
  meta: ClientMeta,
  event: string,
  outcome: "ok" | "deny" | "error",
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void>
```

**`ClientMeta` type and import path:**

```typescript
import type { ClientMeta } from "@/lib/actions/auth";

// type ClientMeta = {
//   readonly ip: string;
//   readonly ua: string;
//   readonly origin: string;
// };
```

**Capture pattern — every new server action MUST start with:**

```typescript
export const newAction = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta(); // FIRST. Before any other await.
  if (!verifyOrigin(meta.origin)) { /* ... */ }
  // ... DB work, helpers all receive `meta` explicitly ...
};
```

**`ActionErrorCode` variants added by this plan:** None. Existing union (`invalid_input | weak_password | pwned_password | email_taken | invalid_credentials | rate_limited | forbidden_origin | locked | server_error`) is sufficient.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **STAB-01 satisfied at the code level.** Signup, login, and logout no longer 500 when Mongoose pauses the event loop. End-to-end HTTP verification (start dev server, POST to /signup, observe 302) waits for **Plan 01-02** (Mongo dev story via `mongodb-memory-server` or Docker Compose) — this plan's outcome is verifiable via static analysis (grep + tsc) plus the live Mongo path that Plan 01-02 will deliver.
- **Pattern is locked for Phase 2-5.** Every server action added in subsequent phases (email verify, password reset, OAuth callback, Paddle webhook handler) starts with `const meta = await captureClientMeta()`. The shape is exported and reusable.
- **Codebase tsc baseline is clean.** Plan 01-02 onward can rely on `npx tsc --noEmit` as a hard gate without inheriting pre-existing noise.
- **Ready for Plan 01-02:** Mongoose duplicate index cleanup + `mongodb-memory-server` local dev path.

## Self-Check: PASSED

- `app/src/lib/actions/auth.ts` — exists on disk
- `app/src/app/pricing/page.tsx` — exists on disk
- `.planning/phases/01-stabilization/01-01-SUMMARY.md` — exists on disk
- `.planning/phases/01-stabilization/deferred-items.md` — exists on disk (updated to mark pricing-page item resolved)
- Commit `69e473d` — found in `git log --oneline --all`
- All 9 acceptance criteria from PLAN.md verified passing (see Verification Results table above)

---
*Phase: 01-stabilization*
*Completed: 2026-04-14*
