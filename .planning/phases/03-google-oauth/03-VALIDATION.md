---
phase: 3
slug: google-oauth
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 3 ships Google OAuth 2.0 PKCE flow end-to-end.
> No automated test framework yet (Vitest/Playwright land in Phase 5 TEST-01..07).
> Verification runs via typecheck + grep + HTTP smoke against a running dev server with OAuth creds stubbed.

---

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | None in Phase 3 — typecheck + grep + curl smoke |
| **Config file** | `app/tsconfig.json` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npm run typecheck && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** `cd app && npx tsc --noEmit`
- **After every plan wave:** Boot `npm run dev`, run the wave's observable-outcome checks from 03-RESEARCH.md §Validation Architecture
- **Before `/gsd:verify-work`:** Full manual smoke — click "Continue with Google", inspect network tab for `code_challenge_method=S256`, inspect cookies for `Lax`/`HttpOnly`
- **Max feedback latency:** 30s typecheck / 2 min full smoke

---

## Per-Task Verification Map

| REQ-ID | Validation Type | Command / Check |
|---|---|---|
| OAUTH-01 | Static | `test -f app/src/components/oauth/google-button.tsx` + `grep -q "GoogleButton" app/src/app/\(auth\)/login/page.tsx app/src/app/\(auth\)/signup/page.tsx` |
| OAUTH-01 | HTTP smoke | `curl -I http://localhost:3000/api/oauth/google/start` → 302 Location |
| OAUTH-02 | Grep | `grep -q "code_challenge_method.*S256" app/src/app/api/oauth/google/start/route.ts` |
| OAUTH-02 | Grep | `grep -q "codeVerifier" app/src/app/api/oauth/google/callback/route.ts` |
| OAUTH-03 | Grep | `grep -q 'sameSite: "lax"' app/src/app/api/oauth/google/start/route.ts && grep -q "httpOnly: true" app/src/app/api/oauth/google/start/route.ts` |
| OAUTH-03 | Structural | Callback deletes both cookies BEFORE `client.getToken(` |
| OAUTH-04 | Grep | `grep -q "verifyIdToken" app/src/app/api/oauth/google/callback/route.ts && grep -q "email_verified !== true" app/src/app/api/oauth/google/callback/route.ts && grep -q "audience: env.GOOGLE_OAUTH_CLIENT_ID" app/src/app/api/oauth/google/callback/route.ts` |
| OAUTH-05 | Code review | `decideLink` "auto_link" requires `emailVerifiedAt !== null`; "require_manual_link" when `=== null` |
| OAUTH-05 | Manual | Call decideLink with 5 cases, assert each returns expected kind |
| OAUTH-06 | Grep | `grep -q 'redirectWithError.*"link_required"' app/src/app/api/oauth/google/callback/route.ts` |
| OAUTH-07 | Grep | `grep -q "validateReturnTo" app/src/lib/auth/oauth/state.ts` + regex allows only dashboard\|course\|exam\|pricing\|settings\|verify-pending |
| OAUTH-07 | Structural | `returnTo` comes from `statePayload.returnTo`, not `searchParams` in callback |
| OAUTH-08 | Grep | `grep -cE 'audit.*oauth_(start\|callback\|link)' app/src/app/api/oauth/google/` ≥ 6 |
| OAUTH-08 | Grep | No raw token material in audit payloads (no `idToken:`, no `pkceCookie:`) |
| OAUTH-09 | File + grep | `test -f app/src/app/api/oauth/google/callback/route.ts && grep -q "export const GET" && grep -q 'runtime = "nodejs"'` |

---

## Wave 0 Requirements

- None. Phase 3 adds no test infrastructure.
- `google-auth-library` added as a new dep by Wave 1 itself.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Button renders | OAUTH-01 | Browser UI | `npm run dev` → /login → see "Continue with Google" button |
| OAuth start redirects to Google | OAUTH-01+02 | Requires dev creds | Click button → URL becomes accounts.google.com/o/oauth2/v2/auth?... with code_challenge, state, client_id |
| State + PKCE cookies set | OAUTH-03 | Devtools | Application → Cookies → oauth-state + oauth-pkce present with Lax, HttpOnly, path=/ |
| State mismatch rejected | OAUTH-03 | Crafted request | `curl /api/oauth/google/callback?code=x&state=y` with wrong cookie → 302 to /login?error=oauth_state_mismatch |
| decideLink 5-case matrix | OAUTH-05 | Unit-style | `scripts/tmp-oauth-test.ts` calls decideLink with each case |
| Unverified email blocks auto-link | OAUTH-05 | Two-user flow | Sign up A (no verify) → Google OAuth with A's email → /login?error=oauth_link_required |
| Audit log populated | OAUTH-08 | Mongo query | db.audit.find({ event: { $in: ["oauth_start", "oauth_callback", "oauth_link"] } }) shows events with no raw tokens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner populates task-level map)

**Approval:** pending
