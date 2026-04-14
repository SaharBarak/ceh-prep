---
phase: 01-stabilization
plan: 04
subsystem: architecture
tags: [domain-driven-design, entitlements, boundary-stubs, pure-functions, tier-gating]

requires:
  - phase: 01-stabilization
    provides: project structure (lib/ tree, tsconfig path mapping `@/*`)
provides:
  - "Pure entitlement domain rules: canAccessDay(tier, day) and canAccessExam(tier)"
  - "FREE_DAY_LIMIT = 3 as const literal type"
  - "lib/billing/, lib/guards/, lib/infra/ folder boundaries with README contracts"
  - "Typed empty re-export barrels for guards/ and infra/ (Phase 2-5 fill them)"
affects:
  - Plan 01-05 (page-level tier gate + saveAnswer action refactor — wires canAccessDay)
  - Phase 2 (lib/infra/resend/ Resend client lands inside this folder)
  - Phase 3 (lib/infra/google/ + decideLink helpers in lib/guards/)
  - Phase 4 (lib/infra/paddle/ + lib/guards/require-tier + lib/guards/require-day-access)
  - Phase 5 (lib/infra/log/ + lib/infra/rate-limit/ + lib/guards/require-role)

tech-stack:
  added: []
  patterns:
    - "Domain/Infra/Guards three-folder boundary (DDD layer separation)"
    - "Pure functions in domain layer (no I/O, no async, no SDK imports)"
    - "Single source of truth via shared pure function + two enforcement points (action + render)"
    - "Typed empty re-export barrel (`export {};`) for forward-compatible folder seams"

key-files:
  created:
    - app/src/lib/billing/entitlements.ts
    - app/src/lib/billing/index.ts
    - app/src/lib/billing/README.md
    - app/src/lib/guards/index.ts
    - app/src/lib/guards/README.md
    - app/src/lib/infra/index.ts
    - app/src/lib/infra/README.md
  modified: []

key-decisions:
  - "canAccessDay enforces a defensive integer-and-range check (day must be 1..14, integer) — out-of-range days return false even for pro tier; callers still validate, but this function will never accidentally allow day 0 or day 15"
  - "FREE_DAY_LIMIT typed as `3 as const` (literal, not number-widening) so Phase 4's exhaustive switches over day numbers can rely on the literal type"
  - "canAccessExam stubbed in Phase 1 as `tier === 'pro'` so Phase 4 imports the same module — no churn at the call site when the fuller TIER-04 rule lands"
  - "Empty `export {};` barrel in guards/index.ts and infra/index.ts to satisfy `isolatedModules` while keeping the folder seam ready for Phase 2-5 appends — no scaffolding fights at the bottom of every PR"
  - "READMEs follow the CLAUDE.md taste-skill aesthetic: tight, declarative, no fluff; each names what lives there, what does NOT, and who imports from there"
  - "No consumer wired in this plan — Plan 01-05 owns the saveAnswer + course/[day]/page.tsx wire-up; this plan only ships the seam"

patterns-established:
  - "Domain purity boundary: `lib/billing/` is pure rules, `lib/guards/` is Result-typed composition, `lib/infra/` is vendor SDK isolation. Domain never imports from infra."
  - "Single source of truth, two enforcement points: the same canAccessDay runs at server-action entry AND page-render redirect — defense in depth."
  - "Forward-compatible folder seams: typed empty `export {};` barrels created now so Phase 2-5 can append without merge conflicts."

requirements-completed:
  - STAB-08

duration: 4 min
completed: 2026-04-14
---

# Phase 01 Plan 04: Architectural Boundary Folders Summary

**Three architectural-boundary folders (`lib/billing/`, `lib/guards/`, `lib/infra/`) shipped with README contracts and typed barrels, plus pure `canAccessDay` + `canAccessExam` entitlement functions in `lib/billing/entitlements.ts` ready for Plan 01-05 to wire.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T06:04:55Z
- **Completed:** 2026-04-14T06:09:41Z
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 0

## Accomplishments

- Pure `canAccessDay(tier, day)` and `canAccessExam(tier)` functions in `lib/billing/entitlements.ts` — single source of truth for free/pro gating
- `FREE_DAY_LIMIT = 3 as const` literal exported from the same module (preserved literal type for Phase 4 exhaustive switches)
- Defensive integer-and-range guard inside `canAccessDay` (day must be 1..14 integer or returns false even for pro)
- Three folder boundaries scaffolded with README contracts: `lib/billing/` (pure rules), `lib/guards/` (Result-typed composition), `lib/infra/` (vendor SDK isolation)
- Typed empty `export {};` barrels in `lib/guards/index.ts` and `lib/infra/index.ts` — forward-compatible seams for Phase 2-5 appends
- All 11 behavior cases from the plan verified via `npx tsx` smoke import (cases 1-11 all passed: free=days 1-3, pro=days 1-14, out-of-range rejected, exam Pro-only, FREE_DAY_LIMIT === 3)
- Smoke test of the public barrel `@/lib/billing` returned exactly the expected `3 true false true`

## Task Commits

1. **Task 1: Scaffold lib/billing with entitlements pure functions and boundary README** — `fa6a252` (feat)
2. **Task 2: Scaffold lib/guards and lib/infra with empty barrels and boundary READMEs** — `7adca7b` (feat)

**Plan metadata:** _to be added by final commit step_

_Note: Task 1 had `tdd="true"` in the plan, but Phase 1 ships zero test infrastructure (Phase 5 owns Vitest setup). The plan's `<acceptance_criteria>` validate via `tsc --noEmit` + grep + file existence + smoke-import only — no test runner required. All 11 behavior cases from the plan's `<behavior>` block were verified manually via `npx tsx` smoke import before the Task 1 commit._

## Files Created

- `app/src/lib/billing/entitlements.ts` — Pure entitlement domain rules: `canAccessDay`, `canAccessExam`, `FREE_DAY_LIMIT`, `Tier` type
- `app/src/lib/billing/index.ts` — Public re-export barrel for `@/lib/billing` consumers
- `app/src/lib/billing/README.md` — Boundary doc: "single source of truth", what lives here, what does not, who imports from here
- `app/src/lib/guards/index.ts` — Typed empty re-export barrel (`export {};`) — Phase 4 fills it with `require-tier`, `require-day-access`
- `app/src/lib/guards/README.md` — Boundary doc: every guard returns `Result<GuardedContext, GuardError>`, re-verifies session, pulls user fresh, applies a rule from `lib/billing/`, never trusts middleware (CVE-2025-29927 lesson)
- `app/src/lib/infra/index.ts` — Typed empty re-export barrel (`export {};`) — Phase 2/3/4 fill it with Resend, Google, Paddle SDKs
- `app/src/lib/infra/README.md` — Boundary doc: "Vendor SDKs live here. Domain layers NEVER import from `lib/infra/` directly", contract listing one folder per vendor (resend, google, paddle, log, rate-limit)

## Decisions Made

1. **Defensive integer-and-range check inside `canAccessDay`** — Even though callers should validate day indices independently, the function rejects day 0, day 15, and non-integer values up front so a buggy caller cannot accidentally unlock content. This is cheap (a single `Number.isInteger` + range check) and catches the entire class of "loose validation in caller" bugs.
2. **`FREE_DAY_LIMIT = 3 as const`** — Literal type preserved (not widened to `number`) so Phase 4 exhaustive switches over day numbers can use it as a literal discriminator.
3. **`canAccessExam` stubbed now, not deferred to Phase 4** — Phase 4 will import from the same `lib/billing/entitlements` module without changing the call site. Stubbing one extra one-line function now eliminates a future seam migration.
4. **Empty `export {};` barrels for guards/ and infra/** — TypeScript's `isolatedModules` requires every file to be a module. The bare `export {};` is the canonical no-export marker that keeps `tsc` happy without forcing a name to live there. Phase 2-5 will append `export { ... } from "./<file>";` lines without ever touching the surrounding scaffold.
5. **No consumer wired in this plan** — Plan 01-05 explicitly owns the `saveAnswer` action refactor and the `course/[day]/page.tsx` redirect. Wiring inside this plan would conflate "lay the seam" (01-04) with "switch the gate" (01-05) and create a bigger PR for code review.
6. **READMEs use the existing PLAN.md taste-skill aesthetic** — Tight, declarative, no fluff. Each names exactly what lives there, what does NOT live there, and who imports from there. The structure matches across all three READMEs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment in `entitlements.ts` contained the literal substring `await`, tripping the acceptance-criterion grep**

- **Found during:** Task 1 acceptance verification (`grep -c 'await' app/src/lib/billing/entitlements.ts` returned 1, must be 0)
- **Issue:** The plan's exact-content spec for the file header included `* No I/O. No SDK imports. No `await`. Pure functions only.` — the literal word "await" inside the doc comment matched the `grep -c 'await'` purity check.
- **Fix:** Reworded the comment to `* No I/O. No SDK imports. No async, no Promises. Pure functions only.` — preserves the same semantic intent without the literal substring.
- **Files modified:** `app/src/lib/billing/entitlements.ts`
- **Verification:** `grep -c 'await' app/src/lib/billing/entitlements.ts` returned 0; isolated `tsc --noEmit` still exits 0; smoke import still passes all 11 cases.
- **Committed in:** `fa6a252` (Task 1 commit, applied before commit was made)

---

**Total deviations:** 1 auto-fixed (1 bug — minor doc-comment wording to satisfy grep purity check)
**Impact on plan:** Zero functional impact. The acceptance criterion's intent (no async I/O in pure rules) is preserved; only the comment's literal phrasing changed.

## Pre-existing Issues (Out of Scope — Not Caused by 01-04)

Two pre-existing issues were observed at baseline and recorded in `.planning/phases/01-stabilization/deferred-items.md`. Per scope-boundary rules, neither was fixed by this plan:

1. **`src/app/pricing/page.tsx:163:11` — `Type 'string' is not assignable to type 'UrlObject | RouteImpl<string>'`** — Resolved by Plan 01-01 (Rule 3 blocking auto-fix during a parallel execution); already documented in `deferred-items.md` with the resolution. After Plan 01-01's fix landed, `tsc --noEmit` exited clean for the post-plan verification.
2. **`src/app/layout.tsx:20:9` — `@next/next/no-page-custom-font` lint warning** — Pre-existing, owned by Plan 01-03 (UI surface). My new files lint clean when scoped (`next lint --dir src/lib/billing --dir src/lib/guards --dir src/lib/infra` exits 0 with zero warnings). The repo-wide `npm run lint` still surfaces this single pre-existing warning, but it is not introduced by this plan.

Both issues are documented in `.planning/phases/01-stabilization/deferred-items.md` with cause, owning plan, and fix sketch.

## Issues Encountered

None — all 11 behavior cases passed first-try, both files compiled clean, both READMEs hit every grep target on the first write.

## Verification Receipts

```
$ cd app && npx tsc --noEmit
EXIT: 0

$ cd app && npx next lint --max-warnings=0 --dir src/lib/billing --dir src/lib/guards --dir src/lib/infra
✔ No ESLint warnings or errors
EXIT: 0

$ find app/src/lib/billing app/src/lib/guards app/src/lib/infra -type f | sort | wc -l
7

$ npx tsx /tmp/billing-smoke.ts   # all 11 behavior cases
OK  Test 1: canAccessDay('free', 1) -> true
OK  Test 2: canAccessDay('free', 3) -> true
OK  Test 3: canAccessDay('free', 4) -> false
OK  Test 4: canAccessDay('free', 14) -> false
OK  Test 5: canAccessDay('pro', 1) -> true
OK  Test 6: canAccessDay('pro', 14) -> true
OK  Test 7: canAccessDay('free', 0) (out of range) -> false
OK  Test 8: canAccessDay('free', 15) (out of range) -> false
OK  Test 9: canAccessExam('free') -> false
OK  Test 10: canAccessExam('pro') -> true
OK  Test 11 (literal): FREE_DAY_LIMIT === 3 -> 3
11/11 passed

$ npx tsx /tmp/billing-barrel-smoke.ts   # @/lib/billing barrel re-export
3 true false true   # FREE_DAY_LIMIT, canAccessDay("free", 3), canAccessDay("free", 4), canAccessExam("pro")

$ grep -r 'from "@/lib/billing"' app/src/
EXIT: 1   # OK — Plan 01-05 owns the wire-up
```

## User Setup Required

None — no external service configuration required by this plan.

## Next Phase Readiness

- **Plan 01-05 is unblocked.** It can immediately import `canAccessDay` from `@/lib/billing/entitlements` (or `@/lib/billing`) for both the page-level tier gate in `course/[day]/page.tsx` and the `saveAnswer` server-action refactor.
- **Phases 2-5 are seam-ready.** `lib/infra/` and `lib/guards/` exist with typed barrels, so Phase 2 (Resend), Phase 3 (Google OAuth), Phase 4 (Paddle), and Phase 5 (logging/rate-limit) can append into pre-existing folders without a scaffolding merge conflict at the bottom of every PR.
- **No blockers** introduced by this plan.

## Self-Check: PASSED

All 9 referenced files exist on disk and both task commits resolve in `git log --all`:

- FOUND: `app/src/lib/billing/entitlements.ts`
- FOUND: `app/src/lib/billing/index.ts`
- FOUND: `app/src/lib/billing/README.md`
- FOUND: `app/src/lib/guards/index.ts`
- FOUND: `app/src/lib/guards/README.md`
- FOUND: `app/src/lib/infra/index.ts`
- FOUND: `app/src/lib/infra/README.md`
- FOUND: `.planning/phases/01-stabilization/01-04-SUMMARY.md`
- FOUND: `.planning/phases/01-stabilization/deferred-items.md`
- FOUND: commit `fa6a252` (Task 1: lib/billing scaffold)
- FOUND: commit `7adca7b` (Task 2: lib/guards + lib/infra scaffold)

---
*Phase: 01-stabilization*
*Completed: 2026-04-14*
