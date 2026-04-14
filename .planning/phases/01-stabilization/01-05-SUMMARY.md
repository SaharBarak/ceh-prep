---
phase: 01-stabilization
plan: 05
subsystem: auth
tags: [tier-gate, entitlements, redirect, defense-in-depth, cve-2025-23061, stab-03]

requires:
  - phase: 01-stabilization
    provides: "canAccessDay + Tier type in lib/billing/entitlements (Plan 01-04)"
  - phase: 01-stabilization
    provides: "User schema tier field defaulted to 'free' (Plan 01-03)"
provides:
  - "Server-side tier gate on course/[day]/page.tsx — redirect() to /pricing?from=day-{n} before any lesson HTML reaches the client"
  - "Single source of truth, two enforcement points: saveAnswer action AND page render both import canAccessDay from the same module"
  - "generateStaticParams deleted from the course day route — page is now correctly session-dynamic"
affects:
  - Phase 4 (TIER-01..TIER-04): tier rules can evolve to date-window logic in ONE place; both gates pick it up automatically
  - Phase 4 (lib/guards/require-day-access, lib/guards/require-tier): can internalize the fail-closed Mongo wrapper pattern established here
  - Phase 5 (CSP, admin routes): same "requireSession + fail-closed tier pull + redirect outside try/catch" pattern re-applies to any gated page

tech-stack:
  added: []
  patterns:
    - "Single source of truth, two enforcement points (same pure function called at action entry AND at page render)"
    - "Fail-closed tier resolution (Mongo error = treat as free; never leak gated content on a transient blip)"
    - "redirect() called OUTSIDE try/catch to avoid swallowing NEXT_REDIRECT (01-RESEARCH.md Pattern 4)"
    - "Narrow Mongoose projection via .select('tier') — don't pull the whole user doc to read one field"
    - "Delete generateStaticParams on session-gated routes (honest dynamic vs. latent prerender-leak bug)"

key-files:
  created:
    - app/src/app/(app)/course/[day]/page.tsx
    - app/src/lib/actions/progress.ts
  modified: []

key-decisions:
  - "Fail-closed default on Mongo error: userTier stays 'free' in the catch, so a transient DB blip redirects to /pricing instead of rendering gated content. Better to annoy a legitimate pro user once than to leak a lesson body to a free user ever."
  - "requireSession() re-check at the page boundary even though the parent (app)/layout.tsx already redirects to /login on missing session. Defense in depth — this file is now safe to move or re-parent without reintroducing an unauth hole."
  - "Narrow the Mongoose projection to .select('tier').lean() in BOTH the page gate and the saveAnswer action — pulling the entire UserDoc just to read one field was wasteful and widens the attack surface on leaky projections."
  - "generateStaticParams DELETED (not overridden with force-dynamic). Prerendering a session-gated page was a latent bug; deleting the export is the honest fix. Comment in the file explains why."
  - "isFreeDay retained in lib/content/ — still used for the 'free tier' UI hint badge in the lesson header. The badge is cosmetic; canAccessDay is the gate. Phase 4 may consolidate UI hints into a separate display helper."
  - "Dropped isFreeDay import from progress.ts (no other uses in that file). canAccessDay is the new, single rule."
  - "Reused the existing 'locked' error discriminant in saveAnswer — no new error codes. The ActionState union stays lean."

patterns-established:
  - "Page-level tier gate: requireSession -> connectDB -> fail-closed tier pull -> canAccessDay -> redirect(/pricing?from=day-{n}) BEFORE any JSX is returned"
  - "redirect() lives outside the try/catch wrapping DB I/O — surrounding catches would swallow NEXT_REDIRECT"
  - "$eq wrap on every user-supplied _id filter value (CVE-2025-23061 defense; project-wide rule)"
  - "Same canAccessDay function at action entry and page render — zero rule drift, single refactor point for Phase 4 tier-rule evolution"

requirements-completed:
  - STAB-03

duration: 4 min
completed: 2026-04-14
---

# Phase 01 Plan 05: Page-Level Tier Gate Summary

**Server-side redirect at the top of `course/[day]/page.tsx` and matching `canAccessDay` import in `saveAnswer` — free users navigating to `/course/4..14` now get a 307 to `/pricing?from=day-{n}` before any gated lesson HTML reaches the client, and both the page render and the server action share a single source of truth.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T06:36:11Z
- **Completed:** 2026-04-14T06:40:09Z
- **Tasks:** 2
- **Files modified:** 2
- **Files created:** 0

## Accomplishments

- **Content-leak hole closed (STAB-03).** Free users browsing to `/course/5` no longer see the Day 5 lesson body — the page re-verifies session, pulls tier fresh from Mongo, and calls `redirect("/pricing?from=day-5")` BEFORE returning any JSX.
- **Single source of truth, two enforcement points.** `saveAnswer` and the page gate both import `canAccessDay` from the same module (`@/lib/billing/entitlements`). Phase 4 can evolve the tier rule in ONE place and both gates pick it up — zero drift risk.
- **Fail-closed Mongo error handling.** On a transient DB blip, `userTier` stays `"free"` and the page redirects to `/pricing`. Better to annoy a legitimate pro user once than to leak gated content.
- **`generateStaticParams` deleted** from the route. Static generation of a session-gated page was a latent bug — the page is now correctly dynamic per-user, and the file ships a comment explaining why.
- **Narrow projection `.select("tier")`** added to BOTH the page query and the action query — no more pulling the whole `UserDoc` just to read one field.
- **`$eq` wrap preserved** on every `_id` filter value (CVE-2025-23061 defense, project-wide rule).

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side tier gate on course/[day]/page.tsx** — `fd664a4` (feat)
2. **Task 2: saveAnswer action to canAccessDay single source of truth** — `c05b0c3` (refactor)

**Plan metadata:** _to be added by final commit step_

## Files Created/Modified

- `app/src/app/(app)/course/[day]/page.tsx` — Added 5 imports (`redirect`, `requireSession`, `connectDB`, `UserModel`, `canAccessDay` + `Tier`), inserted a 22-line page-level tier-gate block between the numeric range check (line 18) and the content lookup (line 50), deleted the `generateStaticParams` export at the bottom of the file. Line range of the new gate block: **lines 20-48**. The `redirect()` call sits on **line 47**, structurally OUTSIDE the `try { ... } catch { ... }` wrapper which closes at line 41.
- `app/src/lib/actions/progress.ts` — Added `canAccessDay + Tier` import from `@/lib/billing/entitlements` (line 10), dropped `isFreeDay` from the `@/lib/content` import (line 8), replaced the inline `user.tier === "free" && !isFreeDay(day)` check with `if (!canAccessDay(tier, day))` (line 48), narrowed the Mongoose projection to `.select("tier").lean()` (lines 42-45), preserved the `{ _id: { $eq: userId } }` wrap.

## Redirect Placement Verification (Pattern 4 compliance)

From `app/src/app/(app)/course/[day]/page.tsx`:

```
line 30:   try {
line 31:     const user = await UserModel
line 32:       .findOne({ _id: { $eq: session.userId } })
line 33:       .select("tier")
line 34:       .lean();
line 35:     if (user?.tier === "pro") userTier = "pro";
line 36:   } catch {
line 37:     // On a Mongo blip, fail closed: treat the user as free. ...
line 40:     userTier = "free";
line 41:   }
line 42:
line 43:   // CRITICAL: redirect() throws NEXT_REDIRECT — it MUST NOT be inside the
line 44:   // try/catch above, or the catch would swallow the redirect signal.
line 45:   // (01-RESEARCH.md §"Architecture Pattern 4: Page-Level Server Redirect".)
line 46:   if (!canAccessDay(userTier, n)) {
line 47:     redirect(`/pricing?from=day-${n}`);
line 48:   }
```

The try/catch closes on **line 41**; `redirect()` is called on **line 47**. Pattern 4 compliance is satisfied — the `NEXT_REDIRECT` thrown by `redirect()` cannot be swallowed by the surrounding catch.

## Single-Source-of-Truth Verification

```
$ grep -l 'from "@/lib/billing/entitlements"' \
    app/src/app/\(app\)/course/\[day\]/page.tsx \
    app/src/lib/actions/progress.ts
app/src/app/(app)/course/[day]/page.tsx
app/src/lib/actions/progress.ts
```

Both files import `canAccessDay` from the same module. The function is defined exactly once (in `app/src/lib/billing/entitlements.ts`). Three places total that reference `canAccessDay`: one definition (entitlements.ts), one consumer at action entry (progress.ts), one consumer at page render (page.tsx). Phase 4 can evolve the tier rule in ONE place and both gates pick it up.

## Decisions Made

1. **Fail-closed default on Mongo error.** The `try/catch` around the `UserModel.findOne(...)` defaults `userTier = "free"` on any error. If Mongo times out, a flaky moment, or a connection blip, a legitimate pro user is worst-case redirected to `/pricing` once (they can click back and retry). A free user never sees lesson body HTML on the boundary of a transient DB issue. Annoy-pro-once is strictly better than leak-lesson-ever.

2. **Re-verify session at the page boundary** even though the parent `(app)/layout.tsx` already redirects to `/login` on missing session. Defense in depth means this file is safe to move, re-parent, or extract into a different layout without reintroducing an unauth hole — the page owns its own authentication requirement, not the layout above it.

3. **Narrow projection on BOTH queries** (`.select("tier").lean()`) — pulling the full `UserDoc` just to read one field was wasteful and widens the surface for a leaky projection bug (if `emailVerifyTokenHash` or a similar sensitive field were accidentally logged). Tight projections are cheap and load-bearing.

4. **Delete `generateStaticParams` rather than overriding with `force-dynamic`.** The export was always a latent bug — the page is session-gated and cannot be prerendered without leaking the gated HTML into the build output. Deleting the export is the honest fix; `force-dynamic` would be a papering-over. The deletion is commented so the next reader understands why.

5. **`isFreeDay` stays in `lib/content/` and in `page.tsx`.** It's still used for the cosmetic "free tier" badge on the Day 1-3 lesson header. The badge is NOT a gate — `canAccessDay` is the gate. Phase 4 may consolidate UI hints into a separate `lib/content/display.ts` helper, but not in this phase. Removed `isFreeDay` from `progress.ts` only because that file uses it nowhere else.

6. **Reuse the existing `"locked"` error discriminant** in `saveAnswer` — no new error codes added. The `ActionState.error` union stays lean, and Phase 4 can introduce more specific discriminants (`"day_out_of_range"`, `"tier_expired"`) when the tier rule evolves into date-window logic.

## Deviations from Plan

None — plan executed exactly as written.

Both tasks followed their `<action>` specs verbatim. All eight acceptance-criteria grep checks from Task 1 passed on the first run (billing import count: 1, canAccessDay(userTier, n) count: 1, redirect(/pricing?from=day-) count: 1, `_id: { $eq: session.userId }` count: 1, requireSession references: 2, connectDB references: 2, generateStaticParams count: 0, UserModel references: 2). All seven acceptance-criteria grep checks from Task 2 passed on the first run (billing import count: 1, canAccessDay(tier, day) count: 1, isFreeDay count: 0, `_id: { $eq: userId }` count: 1, `.select("tier")` count: 1, cross-file grep confirming BOTH files import from `@/lib/billing/entitlements`).

## Issues Encountered

None. TypeScript compiled clean on both tasks; lint passed clean on both scoped directories (`src/app/(app)/course` and `src/lib/actions`). The pre-existing `@next/next/no-page-custom-font` lint warning on `src/app/layout.tsx` is documented in `deferred-items.md` as pre-existing and out of scope (not touched by this plan, owned by Phase 5 hardening or a dedicated font-migration plan).

## Verification Receipts

```
$ cd app && npx tsc --noEmit
EXIT: 0

$ cd app && npx next lint --max-warnings=0 \
    --dir 'src/app/(app)/course' --dir src/lib/actions --dir src/lib/billing
✔ No ESLint warnings or errors

$ grep -c 'from "@/lib/billing/entitlements"' \
    app/src/app/\(app\)/course/\[day\]/page.tsx
1

$ grep -c 'canAccessDay(userTier, n)' \
    app/src/app/\(app\)/course/\[day\]/page.tsx
1

$ grep -c 'redirect(`/pricing?from=day-' \
    app/src/app/\(app\)/course/\[day\]/page.tsx
1

$ grep -c '_id: { $eq: session.userId }' \
    app/src/app/\(app\)/course/\[day\]/page.tsx
1

$ grep -c 'export const generateStaticParams' \
    app/src/app/\(app\)/course/\[day\]/page.tsx
0

$ grep -c 'canAccessDay(tier, day)' app/src/lib/actions/progress.ts
1

$ grep -c 'isFreeDay' app/src/lib/actions/progress.ts
0

$ grep -c '.select("tier")' app/src/lib/actions/progress.ts
1

$ grep -l 'from "@/lib/billing/entitlements"' \
    app/src/app/\(app\)/course/\[day\]/page.tsx \
    app/src/lib/actions/progress.ts
app/src/app/(app)/course/[day]/page.tsx
app/src/lib/actions/progress.ts

# check-no-eq.sh heuristic against both modified files — manual run:
$ grep -rnE '[[:space:]]*(_id|email|userId|googleSub|paddleCustomerId):[[:space:]]+[a-zA-Z_$][a-zA-Z0-9_$.]*[[:space:],}]' \
    --include='*.ts' --include='*.tsx' \
    app/src/lib/actions/progress.ts \
    app/src/app/\(app\)/course/\[day\]/page.tsx
(no output — no unwrapped filter values)
```

## User Setup Required

None — no external service configuration required by this plan. The tier gate works against the existing `MONGO_URI` (memory-server in dev, Atlas in prod), the existing `UserModel`, and the existing iron-session cookie.

**Manual smoke test (when the dev server is running after Phases 2-3 land):**

1. Sign up a fresh user → confirm the new user's tier defaults to `"free"` (STAB-09 — Plan 01-03 flipped the default).
2. Navigate the browser to `/course/3` — the page renders normally.
3. Navigate the browser to `/course/4` — instant redirect to `/pricing?from=day-4`. Open DevTools → Network → confirm the response for `/course/4` is a 307 with `Location: /pricing?from=day-4` and the body contains no Day 4 lesson text.
4. From the Day 3 page, if you craft a POST to `saveAnswer` for Day 4 (e.g., via devtools), the action returns `{ ok: false, error: "locked" }`.

## Next Phase Readiness

- **Phase 2 (Email Identity) unblocked.** The tier gate is now a hard wall; Phase 2 can build the verification-email flow on top of an enforced free-tier perimeter. Pre-verification signups still see days 1-3 (free tier), which is the intended UX: sign up → verify → get 3 free days → hit the paywall at Day 4.
- **Phase 4 (Paddle) unblocked at the rule-evolution point.** When Phase 4 introduces date-window logic (e.g., "pro for 30 days from last payment"), it edits exactly ONE function — `canAccessDay` in `lib/billing/entitlements.ts` — and both the page gate and the `saveAnswer` action pick it up with zero additional changes.
- **Phase 4 guards (`lib/guards/require-day-access`, `lib/guards/require-tier`) are seam-ready.** The fail-closed Mongo wrapper pattern established in this plan is the reference implementation those guards should adopt. The plan's inline try/catch + narrow projection is the exact shape they'll internalize.
- **No new blockers** introduced by this plan.

## Self-Check: PASSED

All 5 referenced artifacts verified present:

- FOUND: `app/src/app/(app)/course/[day]/page.tsx` (Task 1 target)
- FOUND: `app/src/lib/actions/progress.ts` (Task 2 target)
- FOUND: `.planning/phases/01-stabilization/01-05-SUMMARY.md` (this file)
- FOUND: commit `fd664a4` (Task 1: server-side tier gate on course/[day]/page.tsx)
- FOUND: commit `c05b0c3` (Task 2: saveAnswer action to canAccessDay single source of truth)

---
*Phase: 01-stabilization*
*Completed: 2026-04-14*
