---
phase: 02-email-identity
plan: 02
subsystem: auth
tags: [zod, clientmeta, audit, next-15, csrf, error-codes]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: "ClientMeta type + captureClientMeta/verifyOrigin/audit helpers + ActionErrorCode union + SignupSchema/LoginSchema in validation/schemas.ts"
provides:
  - "captureClientMeta exported from @/lib/actions/auth — downstream Phase 2 actions can capture ClientMeta at entry without redeclaring the helper"
  - "audit exported from @/lib/actions/auth — canonical (meta, event, outcome, payload, userId?) sink reused across email.ts + reset.ts + send.ts"
  - "verifyOrigin exported from @/lib/actions/auth — CSRF check reusable for every new server action"
  - "ActionErrorCode union extended with 4 new variants (email_send_failed, token_invalid, token_expired, already_verified) — 13 total"
  - "RequestResetSchema in validation/schemas.ts — parses the /forgot-password email input"
  - "ConfirmResetSchema in validation/schemas.ts — parses the /reset token+password form"
  - "VerifyEmailSchema in validation/schemas.ts — typed empty schema for the resend-verification action"
  - "RequestResetInput / ConfirmResetInput / VerifyEmailInput inferred types for typed downstream consumers"
affects: [02-03, 02-04, 02-05, 02-06, 03-google-oauth, 04-paddle-billing, 05-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ClientMeta capture-once pattern is now a PUBLIC import surface (Phase 1 established; Phase 2-02 exported)"
    - "Error code front-loading: every new ActionErrorCode variant lives in auth.ts from day one, so downstream plans only touch their own files"
    - "Zod schema front-loading: every new input shape defined before its action module exists, so subsequent plans import and safeParse without scaffolding"

key-files:
  created:
    - app/src/lib/validation/schemas.ts  # first-time git tracking; file existed on disk since Phase 1
  modified:
    - app/src/lib/actions/auth.ts  # 4 edits: 3 `export` prefixes + 4 new union variants

key-decisions:
  - "Use `export const` on helpers even though auth.ts has `\"use server\"` — Next.js 15 supports server-to-server imports of non-action exports from server files; captureClientMeta crashes outside request scope anyway, so leakage surface is nil"
  - "Token schema uses min(32) max(64) instead of exact(43) — forward-compat with token entropy changes without breaking downstream validation"
  - "VerifyEmailSchema is typed empty z.object({}) not z.never() — enables uniform safeParse({}) call pattern in the resend action even though there is no user-provided input"
  - "ActionErrorCode union extended in Plan 02-02 (not incrementally in each downstream plan) — front-loading prevents merge friction across the parallel Phase 2 wave"

patterns-established:
  - "Phase 2 downstream plans can `import { captureClientMeta, audit, verifyOrigin, ClientMeta, ActionErrorCode, ActionState } from '@/lib/actions/auth'` and must never redeclare any of these"
  - "Zod schemas for new input shapes land BEFORE the action module that consumes them, so the action module's first edit is adding the import, not defining the schema"

requirements-completed: [EMAIL-05]

# Metrics
duration: 5min
completed: 2026-04-14
---

# Phase 2 Plan 02: Exports + Schemas Summary

**Exposed Phase 1's ClientMeta + audit + verifyOrigin helpers as public exports, extended ActionErrorCode with 4 Phase 2 variants, and added three new Zod schemas (RequestReset, ConfirmReset, VerifyEmail) — all strictly additive with zero signup/login/logout behavior change.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-14T12:55:01Z
- **Completed:** 2026-04-14T13:00:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Flipped three Phase 1 helpers (`captureClientMeta`, `verifyOrigin`, `audit`) from module-private to exported so Phase 2's new action modules (`lib/actions/email.ts`, `lib/actions/reset.ts`) can import them directly — the Phase 1 security posture (capture-once ClientMeta, no re-entry into `next/headers` after await) is now enforceable at the import boundary.
- Extended `ActionErrorCode` union from 9 → 13 variants by adding `email_send_failed`, `token_invalid`, `token_expired`, `already_verified`. Downstream Phase 2 plans can return these codes without ever touching `auth.ts`, eliminating merge friction across the parallel wave.
- Added `RequestResetSchema`, `ConfirmResetSchema`, and `VerifyEmailSchema` to `validation/schemas.ts`, plus their `z.infer` types (`RequestResetInput`, `ConfirmResetInput`, `VerifyEmailInput`).
- Zero regressions: `signup`/`login`/`logout` implementations, call sites, and exports all untouched. `audit(meta, ...)` call count holds at 14 (Phase 1 baseline).

## Task Commits

Each task was committed atomically:

1. **Task 1: Export captureClientMeta + audit + verifyOrigin; extend ActionErrorCode** — `868e881` (feat)
2. **Task 2: Add VerifyEmail/RequestReset/ConfirmReset Zod schemas** — `b445615` (feat)

## Files Created/Modified

- `app/src/lib/actions/auth.ts` — 4 edits: added `export` to `captureClientMeta`, `verifyOrigin`, `audit`; extended `ActionErrorCode` union with 4 new variants. Bodies, call sites, and the `"use server"` directive all preserved verbatim.
- `app/src/lib/validation/schemas.ts` — appended 32 lines after the Phase 1 baseline: three new schemas + three inferred input types. Existing `SignupSchema`/`LoginSchema`/`SaveAnswerSchema` and the `email`/`password` constants untouched. Also first-time git tracking (see "Issues Encountered").

### Exact diff — `auth.ts`

Edit 1 (ActionErrorCode extension, lines 16–29):
```typescript
// Before (9 variants)
export type ActionErrorCode =
  | "invalid_input"
  | "weak_password"
  | "pwned_password"
  | "email_taken"
  | "invalid_credentials"
  | "rate_limited"
  | "forbidden_origin"
  | "locked"
  | "server_error";

// After (13 variants)
export type ActionErrorCode =
  | "invalid_input"
  | "weak_password"
  | "pwned_password"
  | "email_taken"
  | "invalid_credentials"
  | "rate_limited"
  | "forbidden_origin"
  | "locked"
  | "server_error"
  | "email_send_failed"
  | "token_invalid"
  | "token_expired"
  | "already_verified";
```

Edit 2 (line 57):
```typescript
// Before
const captureClientMeta = async (): Promise<ClientMeta> => {
// After
export const captureClientMeta = async (): Promise<ClientMeta> => {
```

Edit 3 (line 73):
```typescript
// Before
const verifyOrigin = (origin: string): boolean => {
// After
export const verifyOrigin = (origin: string): boolean => {
```

Edit 4 (line 89):
```typescript
// Before
const audit = async (
// After
export const audit = async (
```

### New schemas — `schemas.ts`

```typescript
export const RequestResetSchema = z.object({ email });
export const ConfirmResetSchema = z.object({
  token: z.string().min(32).max(64),
  password,
});
export const VerifyEmailSchema = z.object({});

export type RequestResetInput = z.infer<typeof RequestResetSchema>;
export type ConfirmResetInput = z.infer<typeof ConfirmResetSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
```

## Decisions Made

- **`export const` inside a `"use server"` file** — Next.js 15 accepts non-action named exports from server files for server-to-server imports. The risk surface is nil because `captureClientMeta` invokes `headers()` which crashes outside a request scope anyway; it can only ever be called from another server module inside a request. `verifyOrigin` is sync and pure. `audit` is async and swallows errors. This matches the plan's guardrail and was validated by `cd app && npx tsc --noEmit` exiting 0 post-edit.
- **Token schema is `min(32).max(64)`, not `length(43)`** — forward-compat with entropy-tuning in `lib/auth/tokens.ts` (Plan 02-01 produces 32-byte base64url tokens → 43 chars, but if we ever bump to 48 bytes the schema still passes). Obvious garbage (random 8-char user-typed strings) is still rejected.
- **`VerifyEmailSchema = z.object({})` rather than skipping the schema** — keeps the resend action's validation call pattern identical to signup/login (`Schema.safeParse(input)` → `if (!parsed.success) return { error: "invalid_input" }`). Consistency over brevity.
- **Front-load all 4 new ActionErrorCode variants in 02-02 instead of incrementally in 02-04/02-05/02-06** — prevents three separate touches of `auth.ts` during the parallel Phase 2 wave, eliminating the risk of lost-update merge conflicts.

## Deviations from Plan

**None — plan executed exactly as written.**

All four `auth.ts` edits applied verbatim. The `schemas.ts` append matches the plan's specified shape character-for-character, including the three JSDoc blocks.

## Issues Encountered

1. **`validation/schemas.ts` was untracked in git prior to 02-02** — the file existed on disk since Phase 1 but was never `git add`-ed (it appeared in `git status` as `??` alongside many other Phase 1 files). Task 2's commit (`b445615`) therefore tracks the file for the first time, which shows as `new file mode 100644` in the diff. The Phase 1 baseline (29 lines) is preserved verbatim at the top of the file and the 33 new lines are strictly additive at the bottom. This is flagged in the commit message for audit-trail clarity.

2. **Parallel-wave race with Plan 02-01's executor** — during Task 2 execution, the 02-01 executor (running in parallel under the Phase 2 wave-1 dependency graph: 02-01 and 02-02 are both `depends_on: []`) briefly swept `schemas.ts` into one of its own commits (`9cdf0ef`). That commit was `git reset --hard HEAD~1`'d and recreated without `schemas.ts` (HEAD ended at `ec1e0d8`). Once the race resolved, Task 2 was committed cleanly with proper 02-02 attribution as `b445615`. Final main branch now has: `868e881` (Task 1, 02-02) → `4c686cd` / `74f125b` / `ec1e0d8` (02-01 three commits) → `b445615` (Task 2, 02-02). The ordering is interleaved with 02-01 but every commit is correctly attributed and every file lands in the correct final state. No data loss, no missing edits, tsc + lint both clean post-race.

3. **`tsx` dynamic-import smoke test initial-attempt failure** — the first smoke-test attempt used `npx tsx -e 'import("./src/lib/validation/schemas.ts").then(...)'` which returned `undefined` for the module namespace (tsx's eval mode does not resolve named exports from `.ts` extensions through dynamic `import()`). Fixed by writing a temporary file-based smoke script (`src/__schema-smoke.ts`) that uses static `import { ... } from "./lib/..."` — this produced the expected `true true true true true` output (valid/valid/valid/invalid-email-rejected/short-token-rejected), confirming all three schemas parse and reject as intended. Smoke file was removed after the check.

## Verification

All plan acceptance criteria verified post-execution:

- `cd app && npx tsc --noEmit` — exit 0 (clean, project-wide)
- `cd app && npx next lint --max-warnings=0 --file src/lib/actions/auth.ts --file src/lib/validation/schemas.ts` — exit 0 (clean)
- `grep -c "export const captureClientMeta" app/src/lib/actions/auth.ts` = 1
- `grep -c "export const verifyOrigin" app/src/lib/actions/auth.ts` = 1
- `grep -c "export const audit = async" app/src/lib/actions/auth.ts` = 1
- `grep -c "^const captureClientMeta" app/src/lib/actions/auth.ts` = 0 (no private declarations left)
- `grep -c "^const verifyOrigin" app/src/lib/actions/auth.ts` = 0
- `grep -c "^const audit = async" app/src/lib/actions/auth.ts` = 0
- `grep -c '"email_send_failed"' app/src/lib/actions/auth.ts` = 1
- `grep -c '"token_invalid"' app/src/lib/actions/auth.ts` = 1
- `grep -c '"token_expired"' app/src/lib/actions/auth.ts` = 1
- `grep -c '"already_verified"' app/src/lib/actions/auth.ts` = 1
- `grep -c "export type ClientMeta" app/src/lib/actions/auth.ts` = 1 (unchanged from Phase 1)
- `grep -c "export const signup" app/src/lib/actions/auth.ts` = 1 (unchanged)
- `grep -c "export const login" app/src/lib/actions/auth.ts` = 1 (unchanged)
- `grep -c "export const logout" app/src/lib/actions/auth.ts` = 1 (unchanged)
- `grep -c "audit(meta," app/src/lib/actions/auth.ts` = 14 (Phase 1 regression gate, threshold was >= 12)
- `grep -c "export const RequestResetSchema" app/src/lib/validation/schemas.ts` = 1
- `grep -c "export const ConfirmResetSchema" app/src/lib/validation/schemas.ts` = 1
- `grep -c "export const VerifyEmailSchema" app/src/lib/validation/schemas.ts` = 1
- `grep -c "export const SignupSchema" app/src/lib/validation/schemas.ts` = 1 (unchanged)
- `grep -c "export const LoginSchema" app/src/lib/validation/schemas.ts` = 1 (unchanged)
- `grep -c "export const SaveAnswerSchema" app/src/lib/validation/schemas.ts` = 1 (unchanged)
- `grep -c "z.string().min(32).max(64)" app/src/lib/validation/schemas.ts` = 1 (token field)
- `grep -c "export type RequestResetInput" app/src/lib/validation/schemas.ts` = 1
- `grep -c "export type ConfirmResetInput" app/src/lib/validation/schemas.ts` = 1
- Schema smoke test: `RequestResetSchema.safeParse({email:"a@b.com"})` → `success=true`; `ConfirmResetSchema.safeParse({token:"a".repeat(43),password:"x".repeat(12)})` → `success=true`; `VerifyEmailSchema.safeParse({})` → `success=true`; invalid-email rejected; short-token rejected.

## User Setup Required

None — no external service configuration, no environment variables, no dashboard steps. Pure code-surface-expansion plan.

## Next Phase Readiness

Downstream Phase 2 plans are now unblocked on imports:

- **Plan 02-03** (lib/infra/resend/client.ts + templates) — does not consume these exports directly but benefits from the front-loaded `email_send_failed` error code landing in `ActionErrorCode`.
- **Plan 02-04** (lib/infra/resend/send.ts) — will call `audit(meta, "email_send", outcome, { kind, emailHash, ... }, userId?)` via `import { audit } from "@/lib/actions/auth"`. Signature matches Phase 1's canonical shape exactly, no adapter needed.
- **Plan 02-05** (lib/actions/email.ts) — consumes `captureClientMeta`, `verifyOrigin`, `audit`, `ActionErrorCode`, `ActionState` from `@/lib/actions/auth`. Also consumes `VerifyEmailSchema` from `@/lib/validation/schemas`.
- **Plan 02-06** (lib/actions/reset.ts) — same import list as 02-05 plus `RequestResetSchema` and `ConfirmResetSchema`. Will emit the new `token_invalid`, `token_expired` error codes front-loaded in this plan.

All Phase 2 wave-2 plans (02-03 through 02-06) can now reference these exports in their `@`-context blocks without scaffolding concerns.

## Self-Check: PASSED

- Commit `868e881` (Task 1, auth.ts) — FOUND in `git log`
- Commit `b445615` (Task 2, schemas.ts) — FOUND in `git log`
- File `app/src/lib/actions/auth.ts` — FOUND on disk
- File `app/src/lib/validation/schemas.ts` — FOUND on disk
- File `.planning/phases/02-email-identity/02-02-SUMMARY.md` — FOUND on disk
- `cd app && npx tsc --noEmit` — exit 0 post-execution
- `cd app && npx next lint --max-warnings=0 --file src/lib/actions/auth.ts --file src/lib/validation/schemas.ts` — exit 0 post-execution

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
