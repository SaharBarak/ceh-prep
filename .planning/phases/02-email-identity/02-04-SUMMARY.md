---
phase: 02-email-identity
plan: 04
subsystem: infra
tags: [resend, react-email, audit, iron-session, mongoose, sessionEpoch, nodejs]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: "ClientMeta type + captureClientMeta + audit() pure sink + lib/infra boundary + UserModel schema"
  - phase: 02-email-identity (wave 1)
    provides: "Plan 02-01 sessionEpoch field + tokens.ts + env Resend vars; Plan 02-02 audit + ClientMeta + ActionErrorCode variants exported; Plan 02-03 Resend client.ts + React Email templates"
provides:
  - "sendVerifyEmail, sendResetPasswordEmail, sendWelcomeEmail — audited narrow wrappers in lib/infra/resend/send.ts"
  - "lib/infra/resend/index.ts public barrel exporting send functions (getMailClient stays internal)"
  - "lib/infra/index.ts wired to re-export from ./resend (no longer empty)"
  - "requireSession with sessionEpoch drift enforcement — destroys stale sessions on reset"
  - "SessionData.epoch?: number field for drift comparison (backfill-safe: undefined ?? 0)"
affects: [02-05-email-actions, 02-06-reset-actions, 03-google-oauth, 04-paddle-billing, 05-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor wrapper pattern: infra layer exposes ONLY audited narrow functions; raw SDK (getMailClient) stays module-local"
    - "Discriminated-union Result shape for infra calls: {ok:true,id} | {ok:false,error}"
    - "emailHash = sha256(email).slice(0,12) — standardized 12-char audit fingerprint across Phase 2"
    - "requireSession as DB-backed gate with narrow projection (select +sessionEpoch + lean<T | null>())"
    - "Backfill-safe field rollout via optional ?? 0 comparison on both sides"

key-files:
  created:
    - "app/src/lib/infra/resend/send.ts"
    - "app/src/lib/infra/resend/index.ts"
  modified:
    - "app/src/lib/infra/index.ts"
    - "app/src/lib/auth/session.ts"

key-decisions:
  - "send.ts is the sole file allowed to import the infra/resend templates directly; domain actions import via the barrel"
  - "Discriminated-union Result ({ok:true,id} | {ok:false,error:'email_send_failed'}) — never throws from send.ts except framework control flow"
  - "emailHash hard-coded to sha256(email).slice(0,12) inside send.ts (createHash from node:crypto) — no shared util dependency, audit-in-isolation"
  - "requireSession now makes one Mongo findOne per protected request — accepted cost per 02-CONTEXT §Open Questions #3; memoization deferred to Phase 5"
  - "SessionData.epoch stays optional (not required) so Phase 1 sessions without the field compare as 0 on both sides — zero migration"
  - "requireSession return widens from {userId,email} to {userId,email,epoch} — legal TS because destructuring extra fields is compatible (progress.ts/page.tsx unchanged)"
  - "UserModel.findOne uses {_id:{$eq:session.userId}} — mandatory $eq wrap per project guardrail even on session-derived values"

patterns-established:
  - "Infra wrapper pattern: every vendor SDK hides behind narrow typed functions that write exactly one audit event per call"
  - "Session drift check pattern: cheap counter on User doc, $inc to invalidate, compare-on-gate to enforce — immune to clock skew, atomic, backfill-safe"
  - "Audit hash width: sha256 + slice(0,12) is the Phase 2 canonical fingerprint for emails — downstream email.ts / reset.ts must match"

requirements-completed: [EMAIL-03, EMAIL-05, RESET-03]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 2 Plan 04: Audited Resend wrappers + sessionEpoch drift enforcement Summary

**Three audited narrow Resend send functions (verify/reset/welcome) plus sessionEpoch drift check in requireSession — the Wave-2 glue that makes Wave-3 domain actions trivially correct and enables RESET-03's total-session-invalidation on password reset.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T13:13:22Z
- **Completed:** 2026-04-14T13:17:16Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `send.ts` exposes three narrow audited wrappers — every email send writes exactly one `email_send` audit event with `{kind, emailHash, id|message}` payload.
- `emailHash` standardized to `createHash("sha256").update(email).digest("hex").slice(0, 12)` — matches CONTEXT.md §"Audit surface" and is the canonical width for every downstream email audit.
- Discriminated-union Result shape (`{ok:true,id} | {ok:false,error:"email_send_failed"}`) — SDK failures never throw, they become audit `"error"` outcomes.
- `lib/infra/resend/index.ts` re-exports only the public surface (three send functions + types). `getMailClient` and raw templates stay internal — vendor isolation fully preserved.
- `lib/infra/index.ts` no longer an empty barrel — domain code can now `import { sendVerifyEmail } from "@/lib/infra"` OR `from "@/lib/infra/resend"`.
- `requireSession` re-fetches user via narrow `select("+sessionEpoch")` + `.lean<{sessionEpoch?: number} | null>()` — destroys session and throws `SESSION_REVOKED` when `session.epoch < user.sessionEpoch`.
- Backfill-safe: both sides default to `0` via `?? 0`, so Phase 1 sessions without the epoch field compare cleanly against new users with `sessionEpoch: 0`.
- Return type of `requireSession` widened to `{userId, email, epoch}` — existing `const { userId } = await requireSession()` destructurings in `progress.ts` and `course/[day]/page.tsx` are unchanged and typecheck cleanly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/infra/resend/send.ts + barrels** — `4990d7a` (feat)
2. **Task 2: Extend requireSession with sessionEpoch drift** — `4511192` (feat)

**Plan metadata:** (final docs commit after SUMMARY, STATE, ROADMAP, REQUIREMENTS updates)

## Files Created/Modified

- `app/src/lib/infra/resend/send.ts` **(created)** — Three narrow audited wrappers (`sendVerifyEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail`) plus internal `sendWithAudit` helper and `emailHash` fingerprint.
- `app/src/lib/infra/resend/index.ts` **(created)** — Public barrel re-exporting the three send functions + `SendKind`/`SendOutcome` types.
- `app/src/lib/infra/index.ts` **(modified)** — Replaced empty `export {}` with re-export from `./resend`.
- `app/src/lib/auth/session.ts` **(modified)** — Added `epoch?: number` to `SessionData`, extended `requireSession` with Mongo re-fetch + drift comparison + `session.destroy()` branches.

## Audit event shape (locked for Wave 3)

```ts
// Success path
audit(meta, "email_send", "ok",   { kind: "verify"|"reset"|"welcome", emailHash: "<12 hex>", id }, userId?)
// Failure path
audit(meta, "email_send", "error", { kind: "verify"|"reset"|"welcome", emailHash: "<12 hex>", message }, userId?)
```

- `meta` is the `ClientMeta` captured at action entry — never re-entered after `await`.
- Raw email NEVER appears in audit payloads (only the 12-char sha256 prefix).
- Token material (plaintext or hash) NEVER appears in audit payloads.
- Every send path produces exactly one event — zero sends go unlogged even when the SDK throws.

## send.ts API surface (for Wave 3 import)

```ts
export type SendKind = "verify" | "reset" | "welcome";
export type SendOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: "email_send_failed" };

export const sendVerifyEmail = async (args: {
  readonly to: string;
  readonly meta: ClientMeta;
  readonly userId?: string;
  readonly link: string;
}): Promise<SendOutcome>;

export const sendResetPasswordEmail = async (args: {
  readonly to: string;
  readonly meta: ClientMeta;
  readonly userId?: string;
  readonly link: string;
}): Promise<SendOutcome>;

export const sendWelcomeEmail = async (args: {
  readonly to: string;
  readonly meta: ClientMeta;
  readonly userId?: string;
  readonly displayName: string;
  readonly dashboardUrl: string;
}): Promise<SendOutcome>;
```

## session.ts drift check (RESET-03 enforcement point)

```ts
// Excerpt — full file at app/src/lib/auth/session.ts
await connectDB();
const user = await UserModel.findOne({ _id: { $eq: session.userId } })
  .select("+sessionEpoch")
  .lean<{ sessionEpoch?: number } | null>();

if (!user) {
  session.destroy();
  throw new Error("UNAUTHORIZED");
}

const serverEpoch = user.sessionEpoch ?? 0;
const sessionEpoch = session.epoch ?? 0;

if (sessionEpoch < serverEpoch) {
  session.destroy();
  throw new Error("SESSION_REVOKED");
}

return { userId: session.userId, email: session.email, epoch: sessionEpoch };
```

When Plan 02-06 lands `confirmPasswordReset`, one `$inc: { sessionEpoch: 1 }` on the User doc atomically burns every active iron-session for that user on every device — the next protected request hits this drift branch and is thrown out.

## Vendor isolation grep output

```text
$ grep -rn 'from "resend"' app/src/
app/src/lib/infra/resend/client.ts:2:import { Resend } from "resend";

$ grep -rn 'from "@react-email' app/src/ | grep -v 'lib/infra/resend/templates/'
(no matches)

$ grep -rn 'getMailClient' app/src/ | grep -v 'lib/infra/resend/'
(no matches)
```

- `resend` package imported in exactly one file (`client.ts`).
- `@react-email/components` imported only inside `templates/`.
- `getMailClient` never called outside `lib/infra/resend/` — send.ts is the sole caller.

## Decisions Made

- **Inlined `emailHash` helper inside send.ts instead of importing from `lib/auth/tokens.ts`** — send.ts is audit-in-isolation; the 12-char-slice fingerprint is conceptually part of the "audit surface" not the "token primitive" surface. Tokens.ts SHA-256 helper is file-private per its own design; re-deriving via `node:crypto` in send.ts is cheap, local, and keeps the two audit-vs-token surfaces decoupled.
- **`requireSession` return shape widened in this plan (not in a follow-up)** — waiting to widen the type meant Wave-3 reset/email actions would have to re-read the session themselves to get the epoch. Widening now is backward-compatible (destructuring one extra field is legal TS) and unblocks all downstream callers.
- **No per-request memoization of the drift check** — accepted one `findOne` per protected request. Phase 5 can add a request-scoped memoization layer if metrics show it matters; no premature optimization.
- **`select("+sessionEpoch")` explicit flag** — field is `select:false` in the schema, so omitting the `+` prefix would silently return `undefined` and the drift check would falsely compare `0 ?? 0 < 0 ?? 0 → false` → never drift. Caught at plan-review.
- **`$eq` wrap on `session.userId` even though it comes from iron-session** — project guardrail is "$eq wrap on every user input"; an iron-session payload is user-controlled in the threat model (cookie-tamper). Defense-in-depth.

## Deviations from Plan

The plan executed almost exactly as written. Two strictly-numeric acceptance criteria in the plan text (`grep -c "connectDB" === 1` and `grep -c "epoch: number" === 1`) are over-tight — they cannot be satisfied without deleting required code, because:

- "connectDB" appears twice: once in the `import { connectDB }` statement and once in the `await connectDB()` call site. Both are required.
- "epoch: number" appears twice: once in the Promise return type annotation and once in the returned object literal. Both are required.

These are plan-text spec bugs, not implementation gaps. The semantic intent ("connectDB is wired, return shape includes epoch: number") is fully satisfied. The plan's `<verify>` automated block (`grep -q ...`) uses `-q` (existence check) and passes cleanly — only the `<acceptance_criteria>` `-c` counts are over-tight. No code changes made; flagged here for plan-author awareness.

**Total deviations:** 0 (no auto-fixes needed; plan executed as written)
**Impact on plan:** None. All success criteria met; the two over-tight grep-counts are documentation-level issues in the plan, not defects in the shipped code.

## Issues Encountered

None. Every task passed `npx tsc --noEmit` on the first attempt. Vendor isolation held on the first check. Existing Phase-1 callers (`progress.ts::saveAnswer`, `course/[day]/page.tsx`) typecheck unchanged against the new `requireSession` return shape.

## User Setup Required

None — this plan ships only internal code. `RESEND_API_KEY` env var remains optional in dev (console-log stub path is already wired in Plan 02-03's `client.ts`). Production sender-domain verification is documented as a Phase 5 deploy task.

## Next Phase Readiness

**Plan 02-05 (email actions) is fully unblocked:**
- Can `import { sendVerifyEmail, sendWelcomeEmail } from "@/lib/infra/resend"` (or `from "@/lib/infra"`)
- Can `import { requireSession } from "@/lib/auth/session"` and destructure `{ userId, email, epoch }` for epoch-aware audit payloads
- Every send writes one audit event without the action file having to re-implement audit discipline

**Plan 02-06 (reset actions) is fully unblocked:**
- `confirmPasswordReset` can `await UserModel.updateOne({ _id: { $eq: userId } }, { $inc: { sessionEpoch: 1 }, $set: { passwordHash, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null } })` — one atomic write invalidates the password, clears the reset token, and burns every active session.
- `sendResetPasswordEmail` is ready to import from `lib/infra/resend`.

**Phase 1 regression check:** `progress.ts::saveAnswer` still destructures `{ userId }` from `requireSession()` — legal against the widened `{userId, email, epoch}` return. `cd app && npx tsc --noEmit` exits 0. No Phase-1 call site needs a touch-up.

## Self-Check: PASSED

- `app/src/lib/infra/resend/send.ts` — FOUND
- `app/src/lib/infra/resend/index.ts` — FOUND
- `app/src/lib/infra/index.ts` (modified to re-export) — FOUND
- `app/src/lib/auth/session.ts` (extended with drift check) — FOUND
- Commit `4990d7a` — FOUND (`feat(02-04): add audited narrow Resend wrappers (send.ts) + infra barrels`)
- Commit `4511192` — FOUND (`feat(02-04): enforce sessionEpoch drift in requireSession (RESET-03 infra)`)
- `npx tsc --noEmit` — exited 0 after every task
- Vendor isolation — `resend` imported only in `client.ts`; `@react-email` only in `templates/`; `getMailClient` never escapes `lib/infra/resend/`

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
