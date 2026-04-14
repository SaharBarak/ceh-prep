# Phase 2: Email Identity - Research

**Researched:** 2026-04-13
**Domain:** Transactional email (Resend), single-use token primitive, password reset, email verification, enumeration-safe flows
**Confidence:** HIGH (all decisions pre-locked in CONTEXT.md; research validates library shapes, runtime constraints, constant-time patterns against Resend v6 + React Email v0.5 docs and OWASP Password Reset Cheat Sheet)

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Email provider:** `resend@^6.1.0` + `@react-email/components@^0.5.x` + `@react-email/render@^1.3.x`. No alternatives.
- **Token generation:** `crypto.randomBytes(32).toString("base64url")` — 256 bits, Node-native, URL-safe.
- **Token at-rest:** SHA-256 hash (NOT Argon2id). Argon2 is password-only; single-use tokens use fast hashing.
- **Purpose field:** every token stamped with `purpose: "verify_email" | "reset_password"`, cross-checked on consume.
- **TTLs:** 24h for verify, 1h for reset. Expiry checked AFTER hash match to defeat timing oracles.
- **Constant-time `/forgot-password`:** uniform response regardless of email existence, uniform timing (~500ms target).
- **Rate limiting:** per-IP AND per-hashed-email. Buckets: verify-resend 3/h per email, reset-request 1/10min per email + 10/h per IP, verify-consume 20/h per IP.
- **Session invalidation on reset:** `sessionEpoch: number` on User (default 0), `$inc` on reset, drift-check in session helper.
- **ClientMeta pattern:** reuse Phase 1 verbatim. Capture once at entry, pass explicitly, never re-enter `next/headers` after `await`.
- **Templates:** system font stack, single desaturated-lime CTA, no tracking pixels, no utm, no preview-text dark patterns.
- **Dev fallback:** when `RESEND_API_KEY` is missing, console-log the email and return success. Never throw.
- **Route runtime:** `/verify` and `/reset` route handlers MUST `export const runtime = "nodejs"` (React Email uses `react-dom/server`).
- **New error codes:** `email_send_failed`, `token_invalid`, `token_expired`, `already_verified`.
- **New action files:** `lib/actions/email.ts` (verify flow), `lib/actions/reset.ts` (reset flow). `auth.ts` only extends `ActionErrorCode` and calls into the new modules from signup.
- **Post-signup UX:** redirect to `/dashboard` with banner for unverified (not `/verify-pending`).
- **Post-reset UX:** redirect to `/login?reset=1`. Do NOT auto-login.
- **Unverified gating:** free tier days 1-3 allowed; Phase 4 subscribe will gate on `emailVerifiedAt`.

### Claude's Discretion
- Exact React Email template copy within taste-skill voice guidelines (terse, declarative, no marketing verbs).
- Dashboard banner rendering (server component with prop vs client component reading fetched data) — implementer picks cleaner.
- Whether `sessionEpoch` drift check fires on every `requireSession()` or only on sensitive server actions.
- Dev-fallback log verbosity (full HTML vs subject + link only).

### Deferred Ideas (OUT OF SCOPE)
- Magic-link login, email preferences/unsubscribe page, TOTP MFA, welcome drip campaigns, bounce tracking, per-category unsubscribe tokens. All v2+.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMAIL-01 | Resend SDK client singleton with dev fallback | §1 Resend client sketch |
| EMAIL-02 | VerifyEmail React Email template | §6 Template sketch |
| EMAIL-03 | ResetPassword React Email template | §6 Template sketch |
| EMAIL-04 | Welcome React Email template | §6 Template sketch |
| EMAIL-05 | `send.ts` wrapper with audit + ClientMeta | §1 + §5 |
| VERIFY-01 | Signup enqueues verify email | §1 send call + §7 route |
| VERIFY-02 | `/verify?token=` GET route consumes, redirects | §7 route handler |
| VERIFY-03 | Resend-verification server action, rate-limited | §5 dual rate limit |
| VERIFY-04 | Dashboard banner for unverified users | §7 page component note |
| RESET-01 | `/forgot-password` form + action, constant-time | §2 constant-time sketch |
| RESET-02 | `/reset?token=` page with form, consume + rotate | §7 route handler |
| RESET-03 | All sessions invalidated via `sessionEpoch++` | §3 epoch drift sketch |
| RESET-04 | Rate limit per-IP + per-email, audit on every outcome | §5 dual rate limit |

## Summary

Phase 2 bolts a single-use token primitive, a Resend-backed transactional email wrapper, and two self-contained auth flows (verify + reset) onto the Phase 1 foundation. All seven decisions in CONTEXT.md are load-bearing and already technology-locked; the remaining work is wiring them together in a way that preserves the Phase 1 ClientMeta discipline and doesn't leak enumeration signals on the reset path.

The only schema change this phase owns is `sessionEpoch: number` on User (default 0), which backfills implicitly because old sessions compare `undefined` vs `0` as "no drift". The verify and reset route handlers MUST declare `export const runtime = "nodejs"` because React Email renders through `react-dom/server`, which Edge runtime rejects.

**Primary recommendation:** Build `tokens.ts` first (pure), then `lib/infra/resend/client.ts` (with dev fallback), then templates, then `send.ts`, then each action file, then route handlers, then the dashboard banner. Tests follow each module. Never skip the constant-time pattern on `/forgot-password`.

