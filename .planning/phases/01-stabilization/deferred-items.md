# Phase 01 Stabilization — Deferred Items

Pre-existing issues discovered during execution but **out of scope** for the discovering plan. Each item names the plan that should fix it.

## Pre-existing TypeScript errors (NOT caused by 01-04)

### 1. `src/app/pricing/page.tsx:163:11` — `Type 'string' is not assignable to type 'UrlObject | RouteImpl<string>'` ✅ RESOLVED by Plan 01-01

- **Discovered during:** Plan 01-04 baseline check (before any 01-04 changes)
- **Cause:** Next.js typed-routes — a `string` was being passed where a typed `Route` is required
- **Resolved during:** Plan 01-01 (Rule 3 blocking auto-fix). The phase-level success criterion for Plan 01-01 required `npx tsc --noEmit` to pass clean after the auth.ts refactor; this pre-existing error was the only blocker. Fix was minimal: import `type { Route } from "next"` and tighten `CTA.href` from `string` to `Route`.
- **Files modified by 01-01:** `app/src/app/pricing/page.tsx` (2 lines: import + type)
- **Verification:** `cd app && npx tsc --noEmit` exits 0.

## Pre-existing lint warnings (NOT caused by 01-04)

### 1. `src/app/layout.tsx:20:9` — `@next/next/no-page-custom-font`

- **Discovered during:** Plan 01-04 baseline check
- **Cause:** Custom `<link>` font declaration in App Router root layout instead of using `next/font`
- **Owning plan:** Plan 01-03 (UI surface) or a follow-up font-migration plan
- **Fix sketch:** Migrate to `next/font/google` with `Inter({ subsets: ["latin"] })` and apply via `className`
- **Action this plan took:** None — left as-is. Plan 01-04 only adds new files under `lib/billing/`, `lib/guards/`, `lib/infra/` (zero new lint warnings introduced).

---

*Updated: 2026-04-14 by plan 01-04 executor*
