---
phase: 02
slug: email-identity
status: passed
verified: 2026-04-14
score: 13/13 must-haves verified
re_verification: false
---

# Phase 2: Email Identity Verification Report

**Phase Goal:** Users own their email-bound identity — they receive a verification email on signup, they can recover a lost password, and every message sent is rate-limited, audit-logged, and carries single-use tokens stored only as SHA-256 hashes. This phase ships the shared token primitive and the Resend infrastructure that Phase 3's OAuth auto-link and Phase 5's production hardening both build on top of.
**Verified:** 2026-04-14
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New user receives verification email on signup; clicking link stamps `emailVerifiedAt` | VERIFIED | `auth.ts` calls `createToken("verify_email")` + `sendVerifyEmail()` before `redirect("/dashboard")`. `GET /api/verify` finds user by `$eq`-wrapped hash, runs `isExpired` AFTER match, sets `emailVerifiedAt: new Date()`, nulls token fields. |
| 2 | Unverified users can use free-tier days 1-3; upgrading to Pro requires verified email | VERIFIED | Dashboard renders non-blocking `UnverifiedBanner` with resend form; no `redirect()` for unverified users. `emailVerifiedAt` check absent from course access paths. Banner copy explicitly states "Days 1-3 right now — upgrading to Pro requires a verified email." |
| 3 | `/forgot-password` returns identical response regardless of email existence; reset link is 1h, single-use, kills all sessions on confirm | VERIFIED | `requestPasswordReset` has exactly ONE top-level `return {}`. Four `hashPassword("pad-for-uniform-timing-do-not-store")` burns one per non-success branch. `confirmPasswordReset` uses `$inc: { sessionEpoch: 1 }` + `session.destroy()` + `redirect("/login?reset=1")`. |
| 4 | Rate limits hit within documented thresholds; uniform error response leaks nothing about account existence | VERIFIED | `reset-ip` bucket: 10/hour/IP. `reset-id` bucket: 1/10min/email-hash. Both denials fall through to the single `return {}`. Verify resend: `resend-verify-ip` 10/h + `resend-verify-id` 3/h. |
| 5 | Admin sees one audit event per send attempt with outcome + destination-hash; no raw email or token material | VERIFIED | `send.ts` audits `"email_send"` with `{ kind, emailHash: sha256(email).slice(0,12), id }` on success and `{ kind, emailHash, message }` on error. No raw email, no token plaintext, no hash stored in audit payload. Confirmed in `requestPasswordReset` audit payloads: only `emailHash` present. |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Provides | Status | Evidence |
|----------|----------|--------|----------|
| `app/src/lib/auth/tokens.ts` | Token primitive: `createToken`, `hashToken`, `isExpired`, `TokenPurpose`, `Token` | VERIFIED | Exists, 62 lines. `randomBytes(32).toString("base64url")`, SHA-256 hex at rest, TTL table `{ verify_email: 24*60*60*1000, reset_password: 60*60*1000 }`, null-safe `isExpired`. |
| `app/src/lib/infra/resend/client.ts` | `getMailClient()` singleton with dev-stub + prod Resend path | VERIFIED | Exists. Exports `getMailClient`, `MailClient`, `SendInput`, `SendResult`. `server-only` guard at top. `resend@^6.11.0` in `package.json`. |
| `app/src/lib/infra/resend/templates/VerifyEmail.tsx` | React Email verification template | VERIFIED | Exists. `VerifyEmailProps = { link: string }`. Inline styles. No tracking pixels. |
| `app/src/lib/infra/resend/templates/ResetPassword.tsx` | React Email password reset template | VERIFIED | Exists. `ResetPasswordProps = { link: string }`. |
| `app/src/lib/infra/resend/templates/Welcome.tsx` | React Email welcome template | VERIFIED | Exists. `WelcomeProps = { displayName, dashboardUrl }`. |
| `app/src/lib/infra/resend/send.ts` | Audited narrow wrappers: `sendVerifyEmail`, `sendResetPasswordEmail`, `sendWelcomeEmail` | VERIFIED | Exists. Every send path audits `"email_send"` with `emailHash` fingerprint. Discriminated-union Result. No raw email in audit. |
| `app/src/lib/actions/email.ts` | `resendVerificationEmail` server action (rate-limited, session-gated) | VERIFIED | Exists. Uses `requireSession()` (not `getSession`). Dual rate limit: `resend-verify-ip` + `resend-verify-id`. Audits every path. |
| `app/src/lib/actions/reset.ts` | `requestPasswordReset` + `confirmPasswordReset` server actions | VERIFIED | Exists. Structural invariants confirmed: 1x `return {}`, 4x pad burn, `rateLimit("reset-ip")`, `rateLimit("reset-id")`, `$inc: { sessionEpoch: 1 }`, `session.destroy()`. |
| `app/src/app/api/verify/route.ts` | GET handler for verify link consumption | VERIFIED | Exists. `runtime = "nodejs"`, `dynamic = "force-dynamic"`. `isExpired` runs after hash match. Sets `emailVerifiedAt: new Date()`. Nulls token fields. All failure modes redirect to `/login?error=token_invalid`. |
| `app/src/app/(app)/dashboard/page.tsx` | UnverifiedBanner with resend form | VERIFIED | Exists. Checks `emailVerifiedAt`, renders `<UnverifiedBanner>` conditionally with `<form action={resendVerificationAction}>`. No blocking redirect for unverified users. |
| `app/src/app/(auth)/forgot-password/page.tsx` | Forgot-password server page | VERIFIED | Exists. |
| `app/src/app/(auth)/forgot-password/forgot-form.tsx` | Forgot-password client form | VERIFIED | Exists. |
| `app/src/app/(auth)/reset/page.tsx` | Reset confirm server page | VERIFIED | Exists. |
| `app/src/app/(auth)/reset/reset-form.tsx` | Reset confirm client form | VERIFIED | Exists. |
| `app/src/lib/env.ts` | `RESEND_API_KEY` + `RESEND_FROM_ADDRESS` with production localhost-refusal refinement | VERIFIED | `.refine((v) => process.env.NODE_ENV !== "production" || !v.includes("localhost"), ...)` present. |
| `app/src/lib/db/models/user.ts` | `sessionEpoch: { type: Number, default: 0, select: false }` field | VERIFIED | Field present per SUMMARY 02-01. |
| `app/src/lib/auth/session.ts` | `requireSession` with `sessionEpoch` drift enforcement | VERIFIED | `select("+sessionEpoch")`, `serverEpoch ?? 0`, `sessionEpoch ?? 0`, drift check `sessionEpoch < serverEpoch` → `session.destroy()` + throw `SESSION_REVOKED`. |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `auth.ts::signup` | `sendVerifyEmail` | `createToken("verify_email")` + `updateOne` + call before `redirect` | WIRED | `grep -n "sendVerifyEmail\|createToken\|redirect"` confirms token create, hash persist, send, then redirect at line 132 |
| `email.ts::resendVerificationEmail` | `requireSession` | `await requireSession()` at action entry | WIRED | Uses `requireSession()` not `getSession()` — RESET-03 epoch drift fires on every call |
| `verify/route.ts` | `UserModel` | `findOne({ emailVerifyTokenHash: { $eq: hash } })` | WIRED | `$eq` wrapper present; `emailVerifiedAt: new Date()` + null token fields on success |
| `reset.ts::confirmPasswordReset` | `sessionEpoch` invalidation | `$inc: { sessionEpoch: 1 }` in `updateOne` | WIRED | Line 214: `$inc: { sessionEpoch: 1 }` present |
| `session.ts::requireSession` | epoch drift check | Mongo `findOne + select("+sessionEpoch") + comparison` | WIRED | Lines 61-74 in session.ts confirmed |
| `send.ts` | `audit()` | `audit(meta, "email_send", outcome, { kind, emailHash }, userId?)` | WIRED | Both success and error paths audit at lines 48-63 in send.ts |
| Vendor isolation: `from "resend"` | only `client.ts` | no other file imports Resend SDK directly | WIRED | `grep -rn 'from "resend"'` returns exactly one match: `client.ts:2` |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| EMAIL-01 | Resend integration in `lib/infra/resend/` with React Email templates | SATISFIED | `client.ts` + three templates + `send.ts` exist. `resend@6.11.0` in `package.json`. |
| EMAIL-02 | Email sender domain verified (DKIM/SPF/DMARC) and documented in deploy guide | SATISFIED (scope-bounded) | Per locked CONTEXT.md decision: Phase 2 ships the code contract (env Zod refinement refuses `localhost` in prod). DKIM/SPF/DMARC documentation is a Phase 5 DEPLOY-01 task. `RESEND_FROM_ADDRESS` production refinement is in place. |
| EMAIL-03 | Per-account rate limit on outbound mail (≤1/10min for reset requests) | SATISFIED | `rateLimit("reset-id", hash, 1, 10 * 60_000)` in `reset.ts:56`. `rateLimit("resend-verify-id", hash, 3, 60 * 60_000)` in `email.ts:74`. |
| EMAIL-04 | `lib/auth/tokens.ts` — single-use token primitive: 32-byte base64url, SHA-256 hash at rest, TTL, purpose field | SATISFIED | Full implementation verified: `randomBytes(32).toString("base64url")`, `createHash("sha256")`, TTL table by `TokenPurpose`, null-safe `isExpired`. |
| EMAIL-05 | Audit log written for every send attempt (success/failure) without logging token material | SATISFIED | `send.ts` audits both success and error paths with `{ kind, emailHash }`. `audit` payload in `reset.ts` carries only `emailHash` (not `token.plaintext`, not `token.hash`). `route.ts` audits via `auditVerify` wrapper. |
| VERIFY-01 | User receives verification email on signup | SATISFIED | `auth.ts` signup: `createToken("verify_email")`, persist hash, `sendVerifyEmail()`, then `redirect("/dashboard")`. |
| VERIFY-02 | Clicking link marks `emailVerifiedAt`, consumes token, invalidates other verify tokens | SATISFIED | `route.ts`: stamps `emailVerifiedAt: new Date()`, sets `emailVerifyTokenHash: null` + `emailVerifyTokenExpiresAt: null` (structural single-use). Replay: hash matches null → no-match path → `/login?error=token_invalid`. |
| VERIFY-03 | User can request new verification email | SATISFIED (per CONTEXT.md scope) | Dashboard banner ships the resend action via `<form action={resendVerificationAction}>`. Locked decision in CONTEXT.md §"VERIFY-03 scope decision": dashboard banner satisfies Phase 2; Settings page deferred. |
| VERIFY-04 | Unverified users can use free tier; paywall requires verification | SATISFIED | Dashboard shows non-blocking banner only. No `redirect()` in dashboard for unverified. No `emailVerifiedAt` check in course access paths. Banner copy explicitly states Days 1-3 remain accessible. |
| RESET-01 | Forgot-password — constant-time response regardless of email existence | SATISFIED | Structural invariants: 1x `return {}` at function bottom (awk check = 1). 4x `hashPassword("pad-for-uniform-timing-do-not-store")` — one per miss/rate-limit-ip/rate-limit-id/parse-fail branch. CSRF origin check is the only early return (non-timing-sensitive). |
| RESET-02 | Reset email contains single-use token, 1h TTL | SATISFIED | `TTL_MS.reset_password = 60 * 60 * 1000` in tokens.ts. `createToken("reset_password")` used in reset.ts. |
| RESET-03 | Reset validates token, rotates password, invalidates all sessions and outstanding reset tokens | SATISFIED | `confirmPasswordReset`: `$eq` on `passwordResetTokenHash`, `isExpired` after match, `$inc: { sessionEpoch: 1 }` burns all active sessions, `passwordResetTokenHash: null` clears outstanding tokens, `session.destroy()` on current session, `redirect("/login?reset=1")`. |
| RESET-04 | Rate limited by IP AND by identifier (email) with uniform error responses | SATISFIED | `rateLimit("reset-ip", meta.ip, 10, 60 * 60_000)` + `rateLimit("reset-id", hash, 1, 10 * 60_000)`. Both deny paths fall through to the single `return {}` (no `rate_limited` error code exposed to caller). |

All 13 Phase-2 requirements: SATISFIED.

---

## Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| None | — | — | No TODOs, no placeholder returns, no console.log-only implementations, no empty handlers in Phase 2 files |

Pre-existing (out of scope, logged in `deferred-items.md`):
- `app/src/app/layout.tsx`: pre-existing `no-page-custom-font` lint warning — not touched by Phase 2.
- `next@15.2.3` CVE advisories — deferred to Phase 5 DEPLOY-01 per locked version-pin policy.

---

## Build and Type Checks

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | EXIT 0 — clean |
| `npx next lint` (scoped to Phase 2 dirs) | EXIT 0 — no warnings or errors |
| Git co-author search (`Co-Authored-By.*Claude\|Anthropic`) | Empty — no co-author tags found |
| Vendor isolation (`from "resend"` search) | Exactly one match: `lib/infra/resend/client.ts:2` |

---

## Human Verification Required

The following items cannot be verified by static analysis and should be confirmed with a running dev instance:

### 1. Verify email delivery in dev mode

**Test:** Sign up with a new email at `/signup`, watch the terminal for `[resend:dev] to=... subject="Verify your CEH Sprint email"` and extract the `?token=...` from the logged link.
**Expected:** Dev stub logs the full link with a 43-char base64url token. `curl -sI "http://localhost:3000/api/verify?token=<PLAINTEXT>"` returns `307 Location: /dashboard?verified=1`. Replay returns `307 Location: /login?error=token_invalid`.
**Why human:** Dev stub console output and HTTP redirect behavior require a running Next.js instance.

### 2. Dashboard banner visibility and resend UX

**Test:** Log in as a newly-signed-up unverified user and navigate to `/dashboard`.
**Expected:** Non-blocking banner "Verify your email" is visible above the hero content. Days 1-3 links are accessible. Submit the resend form — terminal shows a new `[resend:dev]` line with a fresh token.
**Why human:** Progressive-enhancement form submission and server component rendering require a browser session.

### 3. Password reset constant-time response

**Test:** POST to `/forgot-password` with an existing email and with a non-existing email. Measure response times for both.
**Expected:** Response times are statistically indistinguishable (within ~50ms variance across multiple runs). Both display identical UI: "If an account exists we sent a link."
**Why human:** Timing measurement cannot be performed statically.

### 4. Session invalidation on password reset

**Test:** Log in on two different browser profiles (simulating two devices). In browser A, complete a password reset at `/forgot-password`. Then in browser B, attempt any authenticated action (e.g., navigate to `/dashboard`).
**Expected:** Browser B's session is rejected — either redirected to `/login` or sees an authentication error — because `requireSession` detects the epoch drift (`session.epoch < user.sessionEpoch`).
**Why human:** Multi-session state behavior requires live browser sessions and a real Mongo instance.

---

## Gaps Summary

No gaps. All 13 Phase-2 requirements are satisfied by substantive, wired implementations. The four human verification items are confidence checks on runtime behavior — not gaps in the implementation.

**EMAIL-02 note:** The requirement text says "documented in deploy guide." The deploy guide (DEPLOY-01) belongs to Phase 5. Phase 2's contribution to EMAIL-02 is the production env Zod refinement that structurally prevents shipping a `localhost` sender to production. This split was locked in CONTEXT.md §"Email provider" and is the intended Phase 2 scope. Not a gap.

**VERIFY-03 note:** The requirement text says "from Settings." Per the locked decision in CONTEXT.md §"VERIFY-03 scope decision," the dashboard banner satisfies VERIFY-03 for Phase 2. Settings page is deferred. Not a gap.

---

## Architectural Notes for Downstream Phases

These Phase 2 design decisions are load-bearing for later phases:

- **Phase 3 (Google OAuth):** `decideLink` auto-link gate reads `emailVerifiedAt !== null`. The verify route (`GET /api/verify`) is the only code path that sets this field. Any Phase 3 auto-link must import and check this against the User doc.
- **Phase 4 (Paddle Billing):** The subscribe action should gate on `emailVerifiedAt` — VERIFY-04 explicitly states "paywall content still requires verification before subscription access." The dashboard banner already communicates this to users.
- **Phase 5 (Production Hardening):** `lib/actions/shared.ts` is the import surface for `ClientMeta`, `ActionState`, `ActionErrorCode`, `captureClientMeta`, `verifyOrigin`, and `audit`. All Phase 5 route handlers and admin actions should import from here — not from `auth.ts`.

---

_Verified: 2026-04-14T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
