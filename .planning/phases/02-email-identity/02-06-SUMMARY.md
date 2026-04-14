---
phase: 02-email-identity
plan: 06
subsystem: auth
tags: [password-reset, constant-time, enumeration-safe, iron-session, argon2id, zxcvbn, hibp, react-19, useActionState, next-15]

# Dependency graph
requires:
  - phase: 02-email-identity/02-01
    provides: token primitive (createToken, hashToken, isExpired, 1h reset_password TTL), sessionEpoch field on User
  - phase: 02-email-identity/02-02
    provides: RequestResetSchema + ConfirmResetSchema, ActionErrorCode extension (token_invalid, token_expired)
  - phase: 02-email-identity/02-03
    provides: Resend vendor boundary + ResetPassword React Email template
  - phase: 02-email-identity/02-04
    provides: sendResetPasswordEmail audited wrapper, requireSession sessionEpoch drift, shared.ts ClientMeta capture-once
provides:
  - lib/actions/reset.ts — requestPasswordReset (constant-time) + confirmPasswordReset (rotate + invalidate-all-sessions + redirect)
  - /forgot-password page + ForgotForm client component (uniform success UX)
  - /reset?token=... page + ResetForm client component (hidden-input token flow)
  - /login extended with ?reset=1 success banner + ?error=token_invalid banner + Forgot-password link
affects: [03-google-oauth, 04-paddle-billing, 05-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enumeration-safe constant-time action: exactly ONE top-level return {} at body bottom, hashPassword pad burned on every non-success branch (miss, rate-limit-ip, rate-limit-id, parse-fail). Only CSRF origin_mismatch short-circuits because it isn't timing-sensitive."
    - "Single-point session invalidation via sessionEpoch $inc: one atomic Mongo increment burns every active iron-session for the user, which requireSession's epoch drift check (02-04) picks up on the next protected request."
    - "Destroy-then-redirect post-reset UX: confirmPasswordReset calls session.destroy() on the current iron-session and redirects to /login?reset=1 — user must explicitly re-authenticate with the new password, no auto-login."
    - "Server-component searchParams: Promise<...>: /reset and /login read the querystring via async component + await searchParams — Next 15 async searchParams contract preserved."
    - "Hidden-input token flow: /reset page passes the URL token to the client form as a plain string prop, ResetForm renders <input type=hidden name=token value={token}>, and confirmPasswordReset reads formData.get('token') — no client-side token exposure beyond the URL the user already has."
    - "Client-form error mapping via local messageFor() switch: reset-specific ActionErrorCode cases (invalid_input, weak_password, pwned_password, token_invalid, token_expired, forbidden_origin, server_error) mapped to user-facing strings inside reset-form.tsx — kept local because it's a reset-specific concern, not global copy."

key-files:
  created:
    - app/src/lib/actions/reset.ts
    - app/src/app/(auth)/forgot-password/page.tsx
    - app/src/app/(auth)/forgot-password/forgot-form.tsx
    - app/src/app/(auth)/reset/page.tsx
    - app/src/app/(auth)/reset/reset-form.tsx
  modified:
    - app/src/app/(auth)/login/page.tsx

key-decisions:
  - "requestPasswordReset structural invariants enforced by grep: exactly ONE `return {};` at body top level (VALIDATION.md §RESET-01 regex `^\\s*return \\{\\};$` count === 1), exactly FOUR calls to hashPassword('pad-for-uniform-timing-do-not-store') (one per non-success branch). Comments on the return line moved above so the strict structural regex matches."
  - "confirmPasswordReset uses getSession() (not requireSession()) before destroy — the user clicking a reset link may have no active session on this device at all; requireSession would throw UNAUTHORIZED and block the reset."
  - "$inc: { sessionEpoch: 1 } on the user doc is the ONLY session-invalidation mechanism. No separate sessionRevokedAt timestamp (02-01 decision). Other devices' sessions fail the next requireSession() call (02-04 drift check)."
  - "Reset-flow error codes stay server-side — the client form maps them via messageFor() to user-facing copy. The action exports ActionState with ActionErrorCode (from shared.ts), not a bespoke union, so the error surface stays unified with signup/login."
  - "Submit button in ResetForm disabled when `!token` — missing token (direct /reset visit without ?token=) short-circuits the form entirely so the user cannot waste time typing a password against a broken link."
  - "Rate limit buckets: reset-ip (10/hour/IP) + reset-id (1/10min/emailHash). Both limit hits return the uniform {} success response — leaking 'rate_limited' would reveal the email exists."

patterns-established:
  - "Pattern: Constant-time server action — captureClientMeta first, verifyOrigin early-return ONLY for CSRF, then all paths flow through a try block with pad-burn on non-success and a single return {} at function bottom."
  - "Pattern: sessionEpoch $inc as single-point session revocation — no broadcast, no socket, no redis keys. One atomic Mongo update burns every active session for the user."
  - "Pattern: /reset page + hidden-input token flow — server component reads ?token, client form includes hidden input, server action reads formData.get('token'). Token never leaves the URL + form body."

requirements-completed: [RESET-01, RESET-02, RESET-03, RESET-04, EMAIL-03]

# Metrics
duration: 23min
completed: 2026-04-14
---

# Phase 02 Plan 06: Password Reset Flow (End-to-End) Summary

**Constant-time enumeration-safe password reset with single-point session invalidation via sessionEpoch $inc, shipped with /forgot-password + /reset pages and a /login?reset=1 post-reset notice.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-04-14T13:24:03Z
- **Completed:** 2026-04-14T13:46:33Z
- **Tasks:** 3
- **Files created/modified:** 6

## Accomplishments

- `lib/actions/reset.ts` ships with TWO exported server actions:
  - `requestPasswordReset` — single `return {}` at body bottom, hashPassword pad burned on every non-success branch (miss, rate-limit-ip, rate-limit-id, parse-fail), uniform response regardless of email existence. Audit events fire for every outcome (ok/deny/error).
  - `confirmPasswordReset` — zxcvbn >= 3 + HIBP check, token hash match with `$eq`, `isExpired` check AFTER hash match (no timing oracle), rotates passwordHash, `$inc: { sessionEpoch: 1 }` to burn all active sessions, destroys current iron-session, redirects `/login?reset=1`.
- `/forgot-password` page + `ForgotForm` client component: single email input bound to `requestPasswordReset` via `useActionState`, uniform success copy regardless of outcome (constant-time UX discipline).
- `/reset?token=...` page + `ResetForm` client component: hidden-input token flow, full error-code mapping (invalid_input, weak_password, pwned_password, token_invalid, token_expired, forbidden_origin, server_error), submit button disabled on missing token.
- `/login` page extended: async server component with typed `searchParams: Promise<...>`, renders "Password updated" banner on `?reset=1` and "link invalid/expired" banner on `?error=token_invalid` (the latter also serves the `/api/verify` redirect from Plan 02-05), plus a new "Forgot password?" link next to the existing Sign-up link.

## Task Commits

1. **Task 1: lib/actions/reset.ts** — `7601ed0` (feat) — constant-time reset action + session-invalidating confirm
2. **Task 2: /forgot-password + /login** — `45697ea` (feat) — forgot-password flow + login ?reset=1 notice
3. **Task 3: /reset page + form** — `1af1907` (feat) — /reset page + reset-form bound to confirmPasswordReset

## Structural Invariants (verified)

| Invariant | Check | Result |
|---|---|---|
| Single top-level return in `requestPasswordReset` | `awk '/^export const requestPasswordReset/,/^};$/' reset.ts \| grep -cE '^\s*return \{\};$'` | 1 |
| Uniform-timing pad on every non-success branch | `grep -c 'pad-for-uniform-timing-do-not-store' reset.ts` | 4 |
| `rateLimit("reset-ip"` present | `grep -c 'rateLimit("reset-ip"' reset.ts` | 1 |
| `rateLimit("reset-id"` present | `grep -c 'rateLimit("reset-id"' reset.ts` | 1 |
| IP bucket 10/hour | `grep -c '10, 60 \* 60_000' reset.ts` | 1 |
| Email bucket 1/10min | `grep -c '1, 10 \* 60_000' reset.ts` | 1 |
| `$inc: { sessionEpoch: 1 }` present | `grep -c '\$inc: { sessionEpoch: 1 }' reset.ts` | 1 |
| `session.destroy()` present | `grep -c 'session.destroy()' reset.ts` | 1 |
| `slice(0, 12)` standardized audit hash | `grep -c 'slice(0, 12)' reset.ts` | 1 |
| `redirect("/login?reset=1")` present | `grep -c 'redirect("/login?reset=1")' reset.ts` | 1 |
| Both Mongo queries use `$eq` wrap | `grep -cE 'findOne\(\{ (email\|passwordResetTokenHash): \{ \$eq:' reset.ts` | 2 |
| `tsc --noEmit` exit | 0 | clean |
| `next lint --file reset.ts` exit | 0 | clean |

## Audit event cardinality

`password_reset_request` events (raised by `requestPasswordReset`):

- `deny` — `origin_mismatch` (early return, not timing-sensitive)
- `ok` — hit path, after `sendResetPasswordEmail`
- `deny` — `unknown_email` (miss path, after pad)
- `deny` — `rate_limit_ip`
- `deny` — `rate_limit_id`
- `deny` — `invalid_input` (parse failure)
- `error` — catch-all exceptions

`password_reset` events (raised by `confirmPasswordReset`):

- `deny` — `origin_mismatch`
- `deny` — `invalid_input`
- `deny` — `weak_password`
- `deny` — `pwned_password`
- `deny` — `token_invalid`
- `deny` — `token_expired`
- `ok` — rotate + invalidate + destroy success
- `error` — catch-all exceptions

Every audit entry carries `emailHash` (`sha256(email).slice(0, 12)`) where relevant; no raw email is ever persisted to the audit collection.

## Files Created/Modified

- **Created** `app/src/lib/actions/reset.ts` — two server actions, constant-time request + session-invalidating confirm
- **Created** `app/src/app/(auth)/forgot-password/page.tsx` — server component shell
- **Created** `app/src/app/(auth)/forgot-password/forgot-form.tsx` — client form with uniform success UX
- **Created** `app/src/app/(auth)/reset/page.tsx` — server component, async searchParams + token prop
- **Created** `app/src/app/(auth)/reset/reset-form.tsx` — client form with error-code mapping
- **Modified** `app/src/app/(auth)/login/page.tsx` — now async server component with `?reset=1` + `?error=token_invalid` banners and Forgot-password link

## Decisions Made

- **The `return {};` line has NO trailing comment.** The VALIDATION.md §RESET-01 structural check (`^\s*return \{\};$`) is strict about anchoring on end-of-line, so the explanatory comment ("ONE return — enumeration-safe") sits on the line ABOVE the return, not appended to it. Caught during Task 1 verification; fixed inline before commit.
- **`getSession()` (not `requireSession()`) before `session.destroy()` in confirmPasswordReset.** A user clicking a reset link may have no active session at all — `requireSession` would throw `UNAUTHORIZED` and block the reset. Plan 02-06's objective explicitly calls this out, and we followed it verbatim.
- **Hidden-input token flow, not URL query in action.** The `/reset` server component reads `?token=...` from searchParams, passes the plaintext string down as a `ResetForm` prop, and the client form renders `<input type="hidden" name="token" value={token}>`. The server action then reads `formData.get("token")`. Keeps the token inside the form payload and lets `confirmPasswordReset` validate it against `ConfirmResetSchema` without the action needing its own searchParams access.
- **Submit button disabled when `!token`**. Prevents typing a password against a broken `/reset` URL that's missing the token; a small friendly alert replaces the form instead.
- **Reset-flow error copy mapped locally** in `messageFor()` inside `reset-form.tsx`. Resisted the urge to hoist a global `ERROR_COPY` into `shared.ts` because reset has a specific vocabulary (`token_invalid`, `token_expired`, `pwned_password`) that doesn't apply to login/signup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Next 15 `"use server"` file export constraint on `lib/actions/auth.ts`**

- **Found during:** Task 2 (first `next build` run after creating /forgot-password)
- **Issue:** Plan 02-02 added `captureClientMeta`, `verifyOrigin`, `audit`, `ClientMeta`, `ActionErrorCode`, `ActionState` as exports from `lib/actions/auth.ts` under a `"use server"` directive. Next 15 enforces at build time that every export from a `"use server"` file is an async function (a server action) — `verifyOrigin` is sync, and the types cannot be exported at all. Build failure: `Server Actions must be async functions`.
- **Fix:** Extracted all shared primitives into a new `lib/actions/shared.ts` (NOT marked `"use server"`). Updated import sites in `auth.ts`, `email.ts`, `reset.ts`, `send.ts`, `api/verify/route.ts`, `login-form.tsx`, `signup-form.tsx`, `forgot-form.tsx`, `reset-form.tsx` to import from `@/lib/actions/shared`.
- **Files modified:** `app/src/lib/actions/shared.ts` (new), `app/src/lib/actions/auth.ts`, `app/src/lib/actions/email.ts`, `app/src/lib/actions/reset.ts`, `app/src/lib/infra/resend/send.ts`, `app/src/app/api/verify/route.ts`, `app/src/app/(auth)/login/login-form.tsx`, `app/src/app/(auth)/signup/signup-form.tsx`, plus the new forgot/reset client forms which were already pointed at `/shared`.
- **Verification:** `tsc --noEmit` passes; per-file lint passes on every touched file.
- **Resolution note:** The parallel Plan 02-05 executor ALSO detected this and shipped the identical refactor as `5db6c0c refactor(02-05): extract lib/actions/shared.ts for non-action primitives`. Both executors converged on the same fix independently; my local edits to auth.ts/email.ts/send.ts/route.ts merged transparently into the parallel commit tree because the changes were byte-identical. No conflict occurred. My reset.ts (committed as `7601ed0` BEFORE the parallel refactor) imports from `/shared` thanks to the parallel refactor landing afterward.

---

**Total deviations:** 1 auto-fixed (1 blocking — Next 15 build constraint)
**Impact on plan:** Zero behavioral change. The plan's 02-02 exports continue to work; they just live in a sibling module. Every consumer follows the same `(meta, event, outcome, payload, userId?)` audit signature and every action still captures client meta first. State decision from 02-02 that assumed Next 15 would tolerate non-action exports under `"use server"` is superseded — see "Next Phase Readiness" below.

## Auth Gates

None — the reset flow is anonymous (`confirmPasswordReset` uses `getSession()`, which returns a fresh anonymous session if nothing exists). No auth secrets or third-party credentials needed for this plan.

## Issues Encountered

- **Parallel executor overlap.** Plan 02-05 was being executed in parallel by a separate agent while I was mid-task. The 02-05 agent's `5db6c0c` refactor commit (extracting `shared.ts`) and my local refactor converged on the identical design. No merge conflict occurred because changes were byte-identical; my `reset.ts` commit (`7601ed0`) shipped its original import from `@/lib/actions/auth`, and the parallel refactor rewrote it to point at `@/lib/actions/shared` as part of the in-lockstep update. Final tree is internally consistent — verified via `tsc --noEmit` + `grep -q '@/lib/actions/shared' app/src/lib/actions/reset.ts`.
- **`next build` trips on `RESEND_FROM_ADDRESS` production refinement.** The build sets `NODE_ENV=production` which activates the `01-01`/`02-01` Zod refinement rejecting `localhost` in the default `CEH Sprint <no-reply@localhost>`. This is load-bearing by design (prevents silently shipping a bogus sender in prod). `tsc --noEmit` passes clean regardless, which is what the plan's acceptance criteria require. `next build` against prod env is a Phase 5 concern (pre-deploy check, not a CI gate here).
- **Preexisting `app/src/app/layout.tsx` next-lint warning** (`no-page-custom-font`). Unrelated to Plan 02-06 scope; logged in `deferred-items.md` for later cleanup.

## User Setup Required

None — reset flow uses the existing Resend dev stub path (`[resend:dev]` logs the link; real email send kicks in when `RESEND_API_KEY` is set). The in-process LRU rate limiter from Phase 1 handles both `reset-ip` and `reset-id` buckets without external infra.

## Next Phase Readiness

**Phase 2 — email-identity — is complete.** All six plans have landed:

- 02-01: token primitive + sessionEpoch field + env extension
- 02-02: Zod schemas + ActionErrorCode extension
- 02-03: Resend vendor boundary + React Email templates
- 02-04: audited Resend wrappers + sessionEpoch drift in `requireSession`
- 02-05: `/api/verify` route + `resendVerificationEmail` action + dashboard banner
- 02-06: `/forgot-password` + `/reset` + constant-time request + session-invalidating confirm

**Phase 3 (Google OAuth) is unblocked** because `decideLink` can now read `emailVerifiedAt !== null` — Phase 2 is the only thing that can set that flag (via `/api/verify` in Plan 02-05). The auto-link gate for Google signin will check `existingByEmail.emailVerifiedAt !== null AND googleSub === null` against a User doc that now has a real path to populate `emailVerifiedAt`.

**Amendment to the 02-02 state decision:** The prior STATE.md decision stated "Next.js 15 'use server' files support server-to-server named exports for non-action helpers; no client leakage risk because captureClientMeta crashes outside request scope anyway" — this is now partially false. Next 15 enforces async-function-only at BUILD time for all `"use server"` exports. The 02-02 export pattern worked under `tsc --noEmit` (which doesn't enforce the build-time rule) but fails on `next build`. The fix landed via the `lib/actions/shared.ts` extraction (Plan 02-05's refactor commit + this plan's imports). Record this as a correction to the 02-02 decision.

**Dependency forward to Phase 3 / Phase 5:**

- Phase 3 can import `captureClientMeta`, `verifyOrigin`, `audit`, `ClientMeta`, `ActionErrorCode`, `ActionState` from `@/lib/actions/shared` for the Google OAuth callback route handler and the `decideLink` action — no need to cross the `"use server"` boundary.
- Phase 5 admin audit viewer reads from the same canonical `AuditModel.create` shape (`event`, `outcome`, `ip`, `ua`, `meta`, `userId`) that reset.ts writes; no schema drift to worry about.

## Self-Check: PASSED

**Files verified:**
- FOUND: `app/src/lib/actions/reset.ts`
- FOUND: `app/src/app/(auth)/forgot-password/page.tsx`
- FOUND: `app/src/app/(auth)/forgot-password/forgot-form.tsx`
- FOUND: `app/src/app/(auth)/reset/page.tsx`
- FOUND: `app/src/app/(auth)/reset/reset-form.tsx`
- FOUND: `app/src/app/(auth)/login/page.tsx`

**Commits verified:**
- FOUND: `7601ed0` feat(02-06): add constant-time reset action + session-invalidating confirm
- FOUND: `45697ea` feat(02-06): ship forgot-password flow + login ?reset=1 notice
- FOUND: `1af1907` feat(02-06): ship /reset page + reset-form bound to confirmPasswordReset

**Verification commands executed:**
- `cd app && npx tsc --noEmit` → exit 0
- `npx next lint --file {edited files}` → exit 0
- `awk '/^export const requestPasswordReset/,/^};$/' reset.ts | grep -cE '^\s*return \{\};$'` → 1
- `grep -c 'pad-for-uniform-timing-do-not-store' reset.ts` → 4
- `grep -c '$inc: { sessionEpoch: 1 }' reset.ts` → 1
- `grep -c 'session.destroy()' reset.ts` → 1
- `grep -c 'slice(0, 12)' reset.ts` → 1

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
