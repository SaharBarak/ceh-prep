---
phase: 2
slug: email-identity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 2 ships Resend + React Email templates + token primitive + verify flow + reset flow.
> No automated test framework yet (Vitest/Playwright land in Phase 5 TEST-01..07).
> Verification runs via typecheck + grep + HTTP smoke tests against a running dev server.

---

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | None in Phase 2 — typecheck + grep + curl smoke tests |
| **Config file** | `app/tsconfig.json` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npm run typecheck && npm run lint && npm run dev & sleep 10 && curl -s http://localhost:3000 && kill %1` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** `cd app && npx tsc --noEmit` (catches type regressions immediately)
- **After every plan wave:** Boot `npm run dev`, run the wave's observable-outcome checks from `02-RESEARCH.md` §Validation Architecture
- **Before `/gsd:verify-work`:** Full manual smoke — signup emits verify email (dev stub log), /verify link activates, forgot-password returns uniformly, reset rotates password + invalidates sessions
- **Max feedback latency:** 45 seconds (typecheck + grep) / 2 minutes (full HTTP smoke)

---

## Per-Task Verification Map

Planner populates this once plans are written. Mapping from REQ-IDs to check commands:

| REQ-ID | Validation Type | Command / Check |
|---|---|---|
| EMAIL-01 | Static | `test -f app/src/lib/infra/resend/client.ts && grep -q "getMailClient" app/src/lib/infra/resend/client.ts` |
| EMAIL-01 | Manual | Dev: send a test email with `RESEND_API_KEY=` unset → stdout has `[resend:dev]` line |
| EMAIL-02 | Static | Deploy guide (Phase 5) references DKIM/SPF/DMARC; env refuses `localhost` sender in production |
| EMAIL-03 | Grep | `grep -q "rateLimit.\"reset-id\"" app/src/lib/actions/reset.ts` |
| EMAIL-04 | Static | `test -f app/src/lib/auth/tokens.ts && grep -q "randomBytes(32)" app/src/lib/auth/tokens.ts && grep -q "sha256" app/src/lib/auth/tokens.ts` |
| EMAIL-04 | Manual | Two `createToken("verify_email")` calls produce different 43-char base64url plaintexts |
| EMAIL-05 | Grep | Every `getMailClient().send(` call site is followed by or wrapped in an `audit(meta, "email_send", ...)` call. Confirmed via structural inspection of email.ts/reset.ts/auth.ts. `grep -c "raw email\|email: user\.email" app/src/lib/actions/` → 0 leaks |
| VERIFY-01 | Manual | Post-signup: Mongo User doc has `emailVerifyTokenHash` set; dev stub logs the verify URL |
| VERIFY-02 | HTTP smoke | `curl -sI "http://localhost:3000/api/verify?token=<valid>"` → 307 to `/dashboard?verified=1` |
| VERIFY-02 | HTTP smoke | Replay same token → 307 to `/login?error=token_invalid` |
| VERIFY-03 | Manual | Dashboard shows "Verify your email" banner to unverified users; resend button sends another email (within 3/hour limit) |
| VERIFY-04 | Grep | `grep -rn "emailVerifiedAt" app/src/app/\(app\)/dashboard/` returns at least one match |
| RESET-01 | Structural grep | `grep -c "^  return {" app/src/lib/actions/reset.ts` shows exactly one `return { ok: true }` in `requestPasswordReset` |
| RESET-01 | Structural grep | `grep -q 'hashPassword."pad-for-uniform-timing' app/src/lib/actions/reset.ts` → 1 (uniform-time padding) |
| RESET-01 | Manual | Timing smoke: `time curl -X POST .../forgot-password` with existent vs nonexistent email → diff < 50ms |
| RESET-02 | Manual | `createToken("reset_password").expiresAt.getTime() - Date.now() ∈ [3_599_000, 3_601_000]` |
| RESET-03 | DB state | After reset: `passwordHash` changed, `sessionEpoch` incremented by 1, `passwordResetTokenHash === null` |
| RESET-03 | Manual | Two-browser test: reset from browser A → browser B's `requireSession()` call returns UNAUTHORIZED |
| RESET-04 | Grep + Manual | `grep -q 'rateLimit.\"reset-ip\"' app/src/lib/actions/reset.ts` AND `rateLimit.\"reset-id\"`; second reset request within 10 min returns uniform "sent" |

Status codes: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

---

## Wave 0 Requirements

- None. Phase 2 adds no test infrastructure. Validation runs via typecheck + grep + curl.
- Vitest + Playwright installation remains deferred to Phase 5 (TEST-01 / TEST-03).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Signup produces a verify email (dev stub) | VERIFY-01 | Requires a real browser session + Mongo state read | 1. `npm run dev`. 2. Open /signup. 3. Submit fresh email + strong password. 4. Expect redirect to /dashboard and console line `[resend:dev] kind=verify ...`. 5. Mongo: `db.users.findOne({email:"..."}).emailVerifyTokenHash` is non-null. |
| Verify link activates the account | VERIFY-02 | Requires extracting token from dev-stub log | 1. After the above, grab the URL from the `[resend:dev]` log line. 2. Open in browser. 3. Expect redirect to /dashboard?verified=1. 4. Mongo: `emailVerifiedAt` is set, `emailVerifyTokenHash` is null. |
| Forgot-password is constant-time | RESET-01 | Requires timing measurement | 1. Sign up user A. 2. `time curl -X POST .../forgot-password -d "email=a@example.com"`. 3. `time curl -X POST .../forgot-password -d "email=nonexistent@example.com"`. 4. Both responses identical. Difference < 50ms. |
| Reset invalidates all sessions | RESET-03 | Requires two browsers | 1. Sign up user, verify email. 2. Open /dashboard in Firefox AND Chrome (both logged in). 3. In Firefox: /forgot-password, click dev-stub link, set new password. 4. In Chrome: refresh /dashboard → redirected to /login. |
| Reset email landing page works end-to-end | RESET-02 + RESET-03 | Full UX smoke | Extract reset link from dev-stub log → opens /reset?token=... → form renders → submit new password → redirected to /login?reset=1 → sign in with new password succeeds, old password fails. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc + grep + curl) or are explicitly Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — no test infra in Phase 2)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner populates task-level map)

**Approval:** pending
