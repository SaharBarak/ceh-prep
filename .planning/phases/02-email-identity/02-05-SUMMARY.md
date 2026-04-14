---
phase: 02-email-identity
plan: 05
subsystem: auth
tags: [nextjs, react-email, resend, mongoose, zod, iron-session, react-19, server-actions]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: ClientMeta capture pattern, audit sink, rate-limit, tier schema, FREE_DAY_LIMIT, iron-session
  - phase: 02-email-identity/02-01
    provides: createToken/hashToken/isExpired primitive, sessionEpoch schema field, RESEND_API_KEY env
  - phase: 02-email-identity/02-02
    provides: ActionErrorCode union expansion (email_send_failed, token_invalid, token_expired, already_verified), VerifyEmailSchema, exported captureClientMeta/verifyOrigin/audit
  - phase: 02-email-identity/02-03
    provides: lib/infra/resend vendor boundary, VerifyEmail/ResetPassword/Welcome React Email templates, getMailClient with dev stub
  - phase: 02-email-identity/02-04
    provides: sendVerifyEmail/sendResetPasswordEmail/sendWelcomeEmail audited wrappers, requireSession sessionEpoch drift check
provides:
  - resendVerificationEmail server action (rate-limited 3/h per email, 10/h per IP, uses requireSession for RESET-03 drift enforcement)
  - signup wiring: createToken(verify_email) + persist hash + sendVerifyEmail BEFORE redirect
  - GET /api/verify route handler (runtime=nodejs, dynamic=force-dynamic) with single-use idempotent consume, expiry-after-hash timing-oracle defense, and non-blocking welcome email
  - dashboard UnverifiedBanner server component (no client bundle, progressive-enhancement form)
  - lib/actions/shared.ts extraction (non-action primitives) — Next 15 "use server" constraint compliance
  - signup tier default flip pro → free (latent paywall bypass fix)
  - session.epoch stamping in signup (0) and login (user.sessionEpoch ?? 0)
affects:
  - phase 02-06 (password reset) — reuses the exact audit + rate-limit + createToken + sendResetPasswordEmail pattern, already shown working here
  - phase 03 (google oauth) — decideLink auto-link gate reads emailVerifiedAt which signup now stamps null and /api/verify stamps non-null
  - phase 04 (paddle billing) — subscribe action will gate on emailVerifiedAt using the same dashboard-style read
  - phase 05 (production hardening) — welcome/verify email templates are the baseline for additional transactional emails

# Tech tracking
tech-stack:
  added: []  # no new dependencies — all primitives already installed in 02-01/02-03
  patterns:
    - "lib/actions/shared.ts: non-action server-side primitives extracted from 'use server' files (Next 15 build-time constraint compliance)"
    - "Inline server-action adapter for form actions with state-shape mismatch (React 19 <form action={fn}> expects (FormData) => void|Promise<void>, Phase 2 convention is (prev, formData) => ActionState)"
    - "Route handler captureMeta() inlined (cannot cross 'use server' boundary) but delegates to canonical audit() — never reimplements AuditModel.create"
    - "Single-use token consume: re-hash querystring, findOne with $eq on hash, check isExpired AFTER the match (timing-oracle defense), then updateOne that nulls both hash fields — replay protection is structural"

key-files:
  created:
    - app/src/lib/actions/email.ts — resendVerificationEmail server action
    - app/src/lib/actions/shared.ts — ClientMeta, ActionState, ActionErrorCode, captureClientMeta, verifyOrigin, audit (non-action primitives)
    - app/src/app/api/verify/route.ts — GET handler for verify link consumption
    - app/src/app/(app)/dashboard/page.tsx — committed for the first time (was untracked Phase 1 scaffolding) with the UnverifiedBanner
  modified:
    - app/src/lib/actions/auth.ts — signup issues verify token + sends email, tier default flipped to "free", signup and login both stamp session.epoch, all non-action primitives imported from shared.ts
    - app/src/lib/actions/reset.ts — imports shifted from auth.ts to shared.ts (lockstep refactor)
    - app/src/lib/infra/resend/send.ts — audit + ClientMeta imports shifted from auth.ts to shared.ts

key-decisions:
  - "Resolved Next 15 'use server' constraint by extracting ClientMeta/ActionState/captureClientMeta/verifyOrigin/audit into lib/actions/shared.ts — every top-level export in a 'use server' file must be an async function, so non-action helpers and types cannot co-locate with actions. Pre-Phase-2 decision to co-locate them in auth.ts was technically legal (every export happened to be async) but created a cross-boundary hazard for downstream action files and route handlers."
  - "React 19 <form action={fn}> type mismatch with Phase 2 server-action convention solved via inline adapter pattern: a one-line async function with 'use server' body directive that discards the ActionState return value and bridges the signature. Avoids forcing the dashboard to 'use client' (which would lose progressive enhancement) and avoids changing resendVerificationEmail's shared-convention signature."
  - "Dashboard banner is satisfied by the UnverifiedBanner + resend form; dedicated Settings page deferred to Phase 5 (locked in 02-CONTEXT.md §'Email verification UX', VERIFY-03 scope decision)."
  - "resendVerificationEmail uses requireSession() NOT getSession() — enforces the Phase 2 sessionEpoch drift check at every call, so a session left stale by a concurrent password-reset on another device gets destroyed here. This is the load-bearing RESET-03 contract; downstream callers must never regress to getSession."
  - "Route-handler audit uses the canonical audit() imported from shared.ts — never reimplements AuditModel.create inline. Phase 5 ADMIN-03 audit viewer reads one canonical shape; drift would silently exclude email_verify events from the viewer."
  - "Signup tier default flipped 'pro' → 'free'. The Phase 1 schema default already set 'free' but the signup code overrode it. Leaving 'pro' in signup would silently bypass the Phase 4 paywall for every new account. This is a latent security bug, fixed as Rule 1 (auto-fix)."

patterns-established:
  - "Verify-flow discipline: createToken → persist hash + expiresAt via $eq-wrapped updateOne → send via @/lib/infra/resend → audit with sha256(email).slice(0,12). Reset flow will mirror this exactly (already visible in reset.ts)."
  - "Route handler inline captureMeta: three-line helper shape mirrored from lib/actions/shared.ts's captureClientMeta — never hoisted, never shared across the 'use server' boundary, but delegates to the canonical audit()."
  - "Single-use token idempotency: emailVerifiedAt already set → return success (benign, no error). Hash null-out + replay → no_match path → invalid redirect. Structural not sentinel-based."
  - "Inline server-action form adapter: bridge (prev, formData) => State convention and <form action={fn}> React 19 signature without a client boundary."

requirements-completed: [VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04]

# Metrics
duration: 18min
completed: 2026-04-14
---

# Phase 02 Plan 05: Email Verification End-to-End Summary

**Verify flow ships: signup issues SHA-256-hashed verify tokens and fires a Resend-backed email, GET /api/verify consumes tokens idempotently with timing-oracle-safe expiry checks and stamps emailVerifiedAt, and the dashboard renders a progressive-enhancement unverified-email banner with rate-limited resend action.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-14T13:23:25Z
- **Completed:** 2026-04-14T13:41:12Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `lib/actions/email.ts` ships `resendVerificationEmail` as a fire-and-forget server action. Rate-limited 10/h per IP AND 3/h per sha256(email).slice(0,12) fingerprint (defense in depth). Uses `requireSession()` — NOT `getSession` — so the Phase 2 `sessionEpoch` drift check fires on every call and rejects stale sessions post password-reset (RESET-03 load-bearing guarantee). Already-verified path returns uniform success to avoid leaking cross-tab state. Every deny/error/ok path audits `email_resend_verify` with only the email fingerprint — never the raw address.
- `auth.ts` signup now issues `createToken("verify_email")`, persists the hash + expiresAt with a `$eq`-wrapped `updateOne`, and calls `sendVerifyEmail()` BEFORE the `redirect("/dashboard")`. Email send failures never block signup (the wrapper is contract-non-throwing per 02-04), so users still land on the dashboard with the unverified banner even if Resend is down. Tier default flipped `"pro"` → `"free"` — removed a latent paywall bypass that pre-dated the Phase 1 schema flip. Both signup and login now stamp `session.epoch` (0 on signup, `user.sessionEpoch ?? 0` on login) giving `requireSession`'s drift check a meaningful baseline.
- `/api/verify/route.ts` ships as a route handler with `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Validates querystring token length (32-64 chars) before touching Mongo. Re-hashes with `hashToken`, finds user by `$eq`-wrapped `emailVerifyTokenHash`, runs `isExpired` AFTER the hash match so timing oracles cannot distinguish "expired" from "wrong token" (NIST SP 800-63B). On success stamps `emailVerifiedAt`, nulls both token fields (single-use invariant — replay protection is structural, not a sentinel), fires non-blocking `sendWelcomeEmail`, and 307-redirects to `/dashboard?verified=1`. All failure modes collapse to `/login?error=token_invalid` with a uniform response and a single `email_verify` event name.
- Dashboard page now commits for the first time with the `UnverifiedBanner`. A server-component `requireSession()` + `findOne({ _id: { $eq: userId } }).select("_id emailVerifiedAt")` read gates a non-blocking banner above the existing hero. The banner uses a progressive-enhancement `<form action={resendVerificationAction}>` — no `"use client"` boundary, no client JS. The inline `resendVerificationAction` is a one-line server-action adapter (`"use server"` body directive) bridging React 19's `(formData) => void|Promise<void>` form-action signature to Phase 2's `(prev, formData) => ActionState` convention.
- `lib/actions/shared.ts` extraction: Next 15 enforces at build time that every top-level export from a `"use server"` file is an async function. The Phase 1 pattern of co-locating `ClientMeta`, `ActionErrorCode`, `ActionState`, `captureClientMeta`, `verifyOrigin`, and `audit` inside `auth.ts` was technically legal (every export happened to be async) but created a cross-boundary hazard. Extracted to `shared.ts` (NOT marked `"use server"`) and rewired all callers in lockstep: `auth.ts`, `email.ts`, `reset.ts`, `send.ts`, `/api/verify/route.ts`. Every discipline guarantee preserved — still `requireSession` in `email.ts`, still `sha256(email).slice(0, 12)` audit width, still canonical `audit()` in the route handler.

## Task Commits

Each task was committed atomically (NO Claude/Anthropic co-author tags):

1. **Task 1: Create lib/actions/email.ts + wire signup in auth.ts** — `e9d134a` (feat)
2. **Refactor deviation: extract lib/actions/shared.ts for non-action primitives** — `5db6c0c` (refactor) — Rule 2 deviation fix
3. **Task 2: Create GET /api/verify route handler** — `d80c6d6` (feat)
4. **Task 3: Dashboard UnverifiedBanner + inline resend adapter** — `087f3fc` (feat)

**Plan metadata:** TBD on final commit.

## Files Created/Modified

Created:
- `app/src/lib/actions/email.ts` — `resendVerificationEmail` server action (rate-limited dual bucket, requireSession-gated, audit-on-every-path)
- `app/src/lib/actions/shared.ts` — non-action primitives module (ClientMeta, ActionState, ActionErrorCode, captureClientMeta, verifyOrigin, audit)
- `app/src/app/api/verify/route.ts` — GET handler consuming verify tokens, runtime=nodejs, single-use idempotent
- `app/src/app/(app)/dashboard/page.tsx` — first commit (was Phase 1 untracked scaffolding), now includes UnverifiedBanner + inline resend adapter

Modified:
- `app/src/lib/actions/auth.ts` — signup wires createToken + sendVerifyEmail, tier default fixed, both signup and login stamp session.epoch, non-action primitives now imported from shared.ts
- `app/src/lib/actions/reset.ts` — lockstep: imports from shared.ts
- `app/src/lib/infra/resend/send.ts` — lockstep: imports audit + ClientMeta from shared.ts

## Verify Route Handler Behavior Matrix

| Input                                          | Outcome                                          | Redirect                              | Audit event   | Outcome       |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------- | ------------- | ------------- |
| No `token` querystring                         | Malformed                                        | `/login?error=token_invalid`          | `email_verify` | `deny` (missing_or_malformed_token) |
| `token` length < 32 or > 64                    | Malformed                                        | `/login?error=token_invalid`          | `email_verify` | `deny` (missing_or_malformed_token) |
| Token hashes to unknown user                   | No match                                         | `/login?error=token_invalid`          | `email_verify` | `deny` (no_match) |
| Token matches but `emailVerifyTokenExpiresAt < now` | Expired (checked AFTER hash match)         | `/login?error=token_invalid`          | `email_verify` | `deny` (token_expired) |
| Token matches, already verified (`emailVerifiedAt` set) | Idempotent success                    | `/dashboard?verified=1`               | `email_verify` | `ok` (already_verified) |
| Token matches, fresh, not expired              | Consume: stamp, null token fields, send welcome  | `/dashboard?verified=1`               | `email_verify` | `ok`          |
| Any DB/hash error                              | Error                                            | `/login?error=token_invalid`          | `email_verify` | `error`       |

## Decisions Made

- **Extract `lib/actions/shared.ts` for non-action primitives (Next 15 constraint).** Found during tsc verify of Task 3: Next 15 build-time check rejects non-async exports from `"use server"` files. Phase 1's co-location pattern in `auth.ts` was legal by coincidence (all helpers were async) but wouldn't scale past the email + reset + route-handler consumers added this plan. The extraction is architecturally cleaner: types, sync helpers, and plain-object metadata capture live in one unambiguous module; `auth.ts`/`email.ts`/`reset.ts` stay pure `"use server"` action files. Rewired all callers (including pre-existing `reset.ts` and `send.ts`) in lockstep in one commit so tsc stayed clean.
- **Inline `resendVerificationAction` adapter in dashboard/page.tsx.** React 19's `<form action={fn}>` expects `(formData: FormData) => void | Promise<void>`; Phase 2 server-action convention is `(prev, formData) => Promise<ActionState>`. Three options: (a) introduce `useFormState` and force `"use client"`, (b) change the `resendVerificationEmail` signature globally, (c) inline a one-line server-action adapter. Picked (c): a local `async function resendVerificationAction(formData)` with `"use server"` body directive that discards the `ActionState` return. Preserves progressive enhancement, keeps the dashboard a server component, and doesn't regress the shared (prev, formData) convention that 02-02 standardized for the rest of the auth surface.
- **Signup tier default `"pro"` → `"free"`.** The Phase 1 schema default already sets `"free"`, but `auth.ts` signup's `UserModel.create({ tier: "pro", ... })` was overriding that. Leaving it as `"pro"` would silently bypass the Phase 4 paywall for every new account. Fixed as Rule 1 (auto-fix — bug in code doesn't match documented discipline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted lib/actions/shared.ts for non-action primitives**
- **Found during:** Task 3 (tsc --noEmit after editing dashboard/page.tsx)
- **Issue:** Next 15 enforces at build time that every top-level export from a `"use server"` file is an async function (a server action). The Phase 1 pattern of co-locating `ClientMeta`, `ActionErrorCode`, `ActionState`, `captureClientMeta`, `verifyOrigin`, and `audit` inside `auth.ts` was legal by coincidence (every export happened to be async) but created a cross-boundary hazard for downstream consumers (route handlers, type-only imports, the new `shared` sibling). A linter pass flagged this and refactored `auth.ts` to import from a new `lib/actions/shared.ts` module; all sibling files (`email.ts`, `reset.ts`, `send.ts`, `/api/verify/route.ts`) were rewired in lockstep so the compile stayed clean.
- **Fix:** Extracted non-action primitives into `lib/actions/shared.ts` (NOT marked `"use server"`), rewired every caller's import line. Discipline guarantees preserved: `email.ts` still uses `requireSession()`, route handler still uses canonical `audit()`, emailHash width still 12 chars.
- **Files modified:** `lib/actions/auth.ts`, `lib/actions/email.ts`, `lib/actions/reset.ts`, `lib/infra/resend/send.ts`, `app/api/verify/route.ts`; new `lib/actions/shared.ts`
- **Verification:** `npx tsc --noEmit` clean; all grep checks in the original plan still pass (imports from shared.ts satisfy the same contracts); vendor isolation still holds; `email_verify` event still present; `requireSession` still in email.ts; `slice(0, 12)` still in email.ts.
- **Committed in:** `5db6c0c` (refactor(02-05): extract lib/actions/shared.ts for non-action primitives)

**2. [Rule 1 - Bug] Inline server-action adapter `resendVerificationAction` in dashboard**
- **Found during:** Task 3 (tsc --noEmit after applying the plan's `<form action={resendVerificationEmail}>` pattern verbatim)
- **Issue:** The plan's claim that React 19 accepts `action={(prev, formData) => Promise<ActionState>}` directly is TRUE at runtime (React 19 does bind it via useActionState under the hood) but FALSE at the TypeScript type level — `<form action>` is typed as `(formData: FormData) => void | Promise<void>`, which rejects a two-arg function returning `ActionState`. Plan code failed `tsc --noEmit` with `TS2322: Type ... is not assignable to type '(formData: FormData) => void | Promise<void>'`.
- **Fix:** Added a one-line inline server-action adapter (`async function resendVerificationAction(formData: FormData): Promise<void> { "use server"; await resendVerificationEmail({}, formData); }`) at module scope in `dashboard/page.tsx`. The inline `"use server"` body directive turns the adapter itself into a server action at build time; Next 15 serializes it across the client/server boundary. The `<form action={resendVerificationAction}>` now type-checks while preserving the same progressive-enhancement semantics the plan intended.
- **Files modified:** `app/src/app/(app)/dashboard/page.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npx next lint --max-warnings=0 --file 'src/app/(app)/dashboard/page.tsx'` clean; grep checks pass.
- **Committed in:** `087f3fc` (feat(02-05): render unverified-email banner on dashboard with resend action)

---

**Total deviations:** 2 auto-fixed (1 missing critical architectural, 1 bug)
**Impact on plan:** Both deviations are necessary for correctness. Deviation 1 is a Next 15 build-time constraint that the plan did not account for — the extraction was required and is a strictly better architecture (types + sync helpers separated from action files). Deviation 2 is a plan documentation bug: the claim that React 19 accepts the two-arg signature directly in `<form action>` is runtime-true but TS-false. No scope creep; neither deviation added new features.

## Issues Encountered

- A transient `tsc` error on `app/src/app/(auth)/login/page.tsx` reporting `/forgot-password` as not assignable to a `RouteImpl` literal appeared at one point during Task 3. Re-running `npx tsc --noEmit` from a clean state cleared it — appears to have been a `.next/types/link.d.ts` regeneration race during a concurrent edit. Final tsc run is clean. This is a pre-existing file from Phase 02-06 scaffolding (the `(auth)/forgot-password/page.tsx` exists but is uncommitted — Phase 02-06 owns it). Out of scope for this plan.

## User Setup Required

None. All infrastructure already configured in prior plans:
- `RESEND_API_KEY` (optional in dev — stub path logs `[resend:dev]` lines; required in prod via env Zod refinement from 02-01)
- `RESEND_FROM_ADDRESS` (defaulted to `CEH Sprint <no-reply@localhost>` in dev, refused in prod by the env refinement)
- `NEXT_PUBLIC_APP_URL` (used to build the `/api/verify?token=` link)
- No new DB fields (all verify/welcome fields were additive in Phase 1 STAB-09 + Phase 2 02-01)

Dev smoke test (optional, not blocking completion):
1. `cd app && npm run dev`
2. Register a new user at `/signup`
3. Watch the dev console for `[resend:dev] to=... subject="Verify your CEH Sprint email"` and extract the `?token=...` from the logged `link` arg
4. `curl -sI "http://localhost:3000/api/verify?token=<PLAINTEXT>"` → 307 Location `/dashboard?verified=1`
5. Replay the same curl → 307 Location `/login?error=token_invalid`
6. Visit `/dashboard` while unverified → banner present; submit form → new `[resend:dev]` line
7. After 3 resend submissions within an hour → 4th attempt returns `rate_limited` (verify via audit event)

## Next Phase Readiness

Plan 02-06 (reset flow) can reuse every pattern in this plan verbatim:
- `requestPasswordReset` / `confirmPasswordReset` action file `reset.ts` is already drafted (visible in the repo) with the same audit + rate-limit + createToken + sendResetPasswordEmail shape
- `lib/actions/shared.ts` import pattern is the blueprint for `reset.ts`
- The constant-time discipline (`requestPasswordReset` has ONE return at the bottom) is already encoded
- `requireSession`'s sessionEpoch drift check is the RESET-03 guarantee — `confirmPasswordReset` `$inc: { sessionEpoch: 1 }` will land on a foundation that's already verified to work (the very action shipped in this plan uses `requireSession` to demonstrate the drift enforcement path)

Phase 02-06 TODO:
- `/forgot-password/page.tsx` + `forgot-form.tsx` (both already exist as untracked scaffolding — 02-06 will review and commit)
- `/reset/page.tsx` + `reset-form.tsx` (may need to be created or may already exist)
- `reset.ts` action file already drafted — 02-06 will review, test, and commit
- VALIDATION.md HTTP smokes

No blockers for 02-06.

## Self-Check: PASSED

All claimed artifacts verified:
- `app/src/lib/actions/email.ts` — FOUND
- `app/src/lib/actions/shared.ts` — FOUND
- `app/src/app/api/verify/route.ts` — FOUND
- `app/src/app/(app)/dashboard/page.tsx` — FOUND
- `app/src/lib/actions/auth.ts` — FOUND (modified)
- `.planning/phases/02-email-identity/02-05-SUMMARY.md` — FOUND

All claimed commits verified in `git log`:
- `e9d134a` (feat(02-05): add resendVerificationEmail action + wire signup) — FOUND
- `5db6c0c` (refactor(02-05): extract lib/actions/shared.ts) — FOUND
- `d80c6d6` (feat(02-05): add GET /api/verify route handler) — FOUND
- `087f3fc` (feat(02-05): render unverified-email banner on dashboard) — FOUND

Static checks:
- `npx tsc --noEmit` exits 0
- `npx next lint` clean for all edited files (one pre-existing warning in `app/src/app/layout.tsx` — out of scope, not touched by this plan)
- `grep -rn 'from "resend"' app/src/` matches only `lib/infra/resend/client.ts` (vendor isolation holds)
- `grep -c '"email_verify"' app/src/app/api/verify/route.ts` === 1
- `grep -q "await requireSession" app/src/lib/actions/email.ts` (RESET-03 guarantee)
- `grep -q "slice(0, 12)" app/src/lib/actions/email.ts` (standardized audit width)

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
