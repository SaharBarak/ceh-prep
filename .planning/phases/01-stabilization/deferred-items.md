# Phase 01 Stabilization — Deferred Items

Pre-existing issues discovered during execution but **out of scope** for the discovering plan. Each item names the plan that should fix it.

## Pre-existing TypeScript errors (NOT caused by 01-04)

### 1. `src/app/pricing/page.tsx:163:11` — `Type 'string' is not assignable to type 'UrlObject | RouteImpl<string>'` RESOLVED by Plan 01-01

- **Discovered during:** Plan 01-04 baseline check (before any 01-04 changes)
- **Cause:** Next.js typed-routes — a `string` was being passed where a typed `Route` is required
- **Resolved during:** Plan 01-01 (Rule 3 blocking auto-fix). The phase-level success criterion for Plan 01-01 required `npx tsc --noEmit` to pass clean after the auth.ts refactor; this pre-existing error was the only blocker. Fix was minimal: import `type { Route } from "next"` and tighten `CTA.href` from `string` to `Route`.
- **Files modified by 01-01:** `app/src/app/pricing/page.tsx` (2 lines: import + type)
- **Verification:** `cd app && npx tsc --noEmit` exits 0.

## Pre-existing lint warnings (NOT caused by 01-04)

### 1. `src/app/layout.tsx:20:9` — `@next/next/no-page-custom-font`

- **Discovered during:** Plan 01-04 baseline check
- **Cause:** Custom `<link>` font declaration in App Router root layout instead of using `next/font`
- **Re-routed:** Plan 01-03 was NOT a UI plan (its scope was schema/DTO only — `user.ts`, `audit.ts`, `dto/user.ts`). The original "Owning plan" guess was inaccurate.
- **Owning plan:** Phase 5 hardening (CI lint gate) OR a dedicated font-migration plan before Phase 2 UI work
- **Fix sketch:** Migrate to `next/font/google` with `Inter({ subsets: ["latin"] })` and apply via `className` on `<body>`
- **Action taken by Plan 01-03:** Observed during lint verification. Declined to fix per SCOPE BOUNDARY rule (pre-existing in a file untouched by this plan). Confirmed `layout.tsx` is currently untracked (no git history) and the only lint offender in the entire tree.

## CVE-2025-66478 (next.js) — discovered during Plan 01-06 Task 1

- **Discovered during:** `cd app && npm install --save-exact next@15.2.3 mongoose@8.9.5`
- **Signal:** npm emitted `npm warn deprecated next@15.2.3: This version has a security vulnerability. Please upgrade to a patched version. See https://nextjs.org/blog/CVE-2025-66478 for more details.`
- **Status:** NOT addressed in Phase 1. The locked decision in `01-CONTEXT.md §"Version pin policy (STAB-04, STAB-05)"` is explicit — `next` is exact-pinned to `15.2.3` as the CVE-2025-29927 floor. Bumping the floor mid-execution would change the contract the rest of Phase 1 (plans 01-03, 01-05) and research references already reference.
- **Owning plan:** Phase 5 production hardening (Phase 5 owns the CI `npm audit` job and the deploy-time version verification). A dedicated "next CVE rebase" ticket belongs in Phase 5.
- **Fix sketch:**
  1. Research the patched version for CVE-2025-66478 on the `15.x` line (likely `15.2.x+N` or `15.3.x`).
  2. If a clean in-branch upgrade exists, bump the exact pin and re-run typecheck + integration smoke.
  3. If only a major-version bump fixes it, open a breaking-change analysis ticket before touching the pin.
  4. Wire `npm audit --audit-level=high` into the CI lint job so future CVEs surface at PR time, not at install time.
- **Action this plan took:** Accepted the pin at `15.2.3` per locked decision; logged this entry and the Phase 5 follow-up.

---

*Updated: 2026-04-14 by plan 01-06 executor*
