# Phase 2: Email Identity (Resend + Verify + Reset) — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Mode:** Auto (recommended defaults — override by editing before `/gsd:plan-phase 2`)

<domain>
## Phase Boundary

Users own their email-bound identity. Every new signup receives a verification
email. Forgotten passwords can be reset via an emailed link. Both flows are
rate-limited, audit-logged, and use single-use SHA-256-hashed tokens with
strict TTLs. Resend is the email infrastructure every other user-facing
message (welcome, upcoming OAuth links, Phase 4 receipts, Phase 5 deploy
alerts) builds on top of.

**In scope:** EMAIL-01..05, VERIFY-01..04, RESET-01..04 (13 total).

**Out of scope:** Google OAuth (Phase 3), Paddle receipts (Phase 4),
audit admin view (Phase 5), TOTP MFA (deferred to v2), magic-link login
(deferred). Email-drip content campaigns are v2.
</domain>

<decisions>
## Implementation Decisions

### Email provider
- **Resend** (`resend@^6.1.0` + `@react-email/components@^0.5.x` + `@react-email/render@^1.3.x`). Decision locked in PROJECT.md; confirmed by research.
- React Email as the template engine — renders via `react-dom/server`, keeps templates type-safe, lets us extend the taste-skill aesthetic into the email channel.
- `RESEND_API_KEY` added to env schema (Zod-validated at boot, no default — app refuses to start without it in prod). `RESEND_FROM_ADDRESS` added with the form `CEH Sprint <no-reply@{verified-domain}>`.
- Sender domain verification (DKIM/SPF/DMARC) is a one-time deploy task — documented in the Phase 5 deploy guide. Phase 2 itself just codes against the Resend SDK and fails gracefully in dev when `RESEND_API_KEY` is missing (logs the intended email to console for smoke testing).

### Token primitive — `lib/auth/tokens.ts`
- **Generation:** `crypto.randomBytes(32).toString("base64url")` — 256 bits of entropy, URL-safe, Node-native (zero deps). Never nanoid/uuid.
- **At-rest:** SHA-256 hash, not Argon2id. Argon2 is for passwords (slow-by-design); single-use short-lived tokens don't need memory-hard hashing and slowness would add noticeable latency to every reset click.
- **Purpose field:** Every token has a `purpose: "verify_email" | "reset_password"` stamp on the User doc and is cross-checked on consume — prevents a verify token from being replayed against the reset flow.
- **Lookup:** Tokens are never stored plaintext. Verification/consumption takes the plaintext from the URL, re-hashes with SHA-256, and queries `{ emailVerifyTokenHash: { $eq: hash } }` (or reset equivalent). `$eq` wrap is mandatory per project convention.
- **Single-use semantics:** On successful consume, token hash and expiry fields set to `null` in the same `findOneAndUpdate`. Any replay of the same URL hits the `null` field and returns "invalid or expired".

### TTLs
- **Email verification:** 24 hours. Matches NIST SP 800-63B §5.1.1.2 guidance balancing UX (click later that day) against blast radius.
- **Password reset:** 1 hour. Matches OWASP Password Reset Cheat Sheet recommendation.
- Expiry is stored as a `Date` in the User doc (`emailVerifyTokenExpiresAt`, `passwordResetTokenExpiresAt` — already scaffolded by Phase 1 STAB-09). Consumption re-checks `Date.now() > expiresAt.getTime()` AFTER the hash match, so timing attacks can't distinguish "expired" from "wrong token".

### Email templates (`lib/infra/resend/templates/`)
- `VerifyEmail.tsx` — React Email component. Sections: greeting, CTA button to `${APP_URL}/verify?token=...`, plaintext link fallback, 24h expiry note, "didn't sign up?" footer.
- `ResetPassword.tsx` — React Email component. Sections: greeting, CTA button to `${APP_URL}/reset?token=...`, plaintext link fallback, 1h expiry note, "didn't request this?" footer with note about account security.
- `Welcome.tsx` — NEW, fires after successful verification. Short, sets tone, points at day 01. No marketing.
- Typography: system stack in email (Satoshi loading in email is unreliable). Body copy matches the taste-skill voice: terse, declarative, no "elevate/seamless/unleash". One accent color, one CTA button, no footer ads.
- **Aesthetic rule:** email templates MUST NOT include tracking pixels, no utm parameters, no preview-text dark patterns. The reputation cost of even one dark-pattern email on an ethical-hacking audience is catastrophic.

### Rate limiting
- **Per-IP AND per-identifier (hashed email).** Per-IP defeats distributed scans across one attacker's own IP; per-email defeats targeted flooding of one victim across many IPs.
- Buckets:
  - Signup verification resend: 3 per hour per email hash
  - Password reset request: 1 per 10 minutes per email hash
  - Password reset request: 10 per hour per IP
  - Verification consume: 20 per hour per IP (prevents brute force token guessing)
- Uses the existing `lib/auth/rate-limit.ts` lru-cache interface. Phase 5 swaps to Upstash Redis.
- **Uniform responses:** `/forgot-password` and "resend verification" ALWAYS return the same generic success message with the same ~500ms timing, regardless of whether the email exists. zxcvbn-style early-return is forbidden in this flow.

### Audit surface
- Every email send attempt writes one audit event with:
  - `event: "email_send"` with `meta: { kind: "verify"|"reset"|"welcome", emailHash: sha256(email).slice(0,12), outcome: "ok"|"deny"|"error" }`
  - `emailHash` only — NEVER raw email or any token material
- Every verification consume writes `event: "email_verify"` with outcome
- Every reset consume writes `event: "password_reset"` with outcome + sessions invalidated count

### Session/session-invalidation on reset
- Successful password reset invalidates **every** active iron-session for that user, not just the current one.
- Implementation: add a `sessionRevokedAt: Date | null` field on User (or extend schema in Phase 2 itself via a small additive patch — acceptable here because Phase 1 defers the "all schema mutations land in STAB-09" rule to "foreseen fields", and sessionRevokedAt was not foreseen but is needed). Alternate: bump a counter `sessionEpoch: number` on the user doc, stamp the session on creation, invalidate if they drift.
- **Decision:** use `sessionEpoch: number` (default 0) on User. On password reset, `$inc: { sessionEpoch: 1 }`. On every `requireSession()` call, re-fetch the User and compare — if the session's stored `sessionEpoch` is lower, destroy the session. This is a small additive patch to STAB-09; Phase 2 owns it.

### Email verification UX
- **Post-signup:** the signup action creates the verify token, enqueues the email, redirects to `/dashboard` (not `/verify-pending`). The dashboard shows a non-blocking banner "Verify your email — [resend]" for unverified users. This keeps signup-to-first-lesson fast.
- **Verify link lands:** `/verify?token=...` is a route handler (GET) that consumes the token server-side, sets `emailVerifiedAt`, redirects to `/dashboard?verified=1`. The dashboard banner disappears.
- **Unverified users can:** use free tier days 1-3. **Unverified users CANNOT:** subscribe (Phase 4 `/pricing` action will check `emailVerifiedAt`). This reduces account-takeover blast radius without blocking the free funnel.
- **Resend verification button** on dashboard banner AND on settings (if/when settings exists — for Phase 2 we ship the dashboard path only).

### Password reset UX
- `/forgot-password` page — single email input. Constant-time response.
- Reset email → `/reset?token=...` → password form → submit → rotate password hash + invalidate all sessions + clear reset token → redirect to `/login?reset=1`.
- Post-reset login form shows "Password updated. Sign in with your new password." — does NOT auto-login (safer, confirms the user knows the new password).

### Error codes
- Extend the existing `ActionErrorCode` union in `app/src/lib/actions/auth.ts`:
  - `"email_send_failed"` — Resend SDK error
  - `"token_invalid"` — missing, unknown, or purpose-mismatch token
  - `"token_expired"` — valid hash but past expiry
  - `"already_verified"` — benign early-exit (verify flow)
- New server actions live in `app/src/lib/actions/email.ts` and `app/src/lib/actions/reset.ts` (separation of concerns: auth.ts owns signup/login/logout; email.ts owns verify flow; reset.ts owns reset flow).

### Claude's Discretion
- Exact React Email template styling (taste-skill guidance applies: Cabinet Grotesk system-stack fallback, desaturated lime accent as the single CTA color, no purple)
- How the dashboard banner renders (server component with the unverified check, or client banner reading a server-fetched prop — implementer picks the cleaner one)
- Whether `sessionEpoch` becomes a strict assertion on every `requireSession()` or just on sensitive server actions — implementer decides based on read/write frequency
- The smoke-test dev fallback when `RESEND_API_KEY` is absent: console-log the full email HTML, or pretty-print subject + link only

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + roadmap
- `.planning/PROJECT.md` §Validated (Phase 1 complete)
- `.planning/REQUIREMENTS.md` §EMAIL/VERIFY/RESET — 13 requirements this phase delivers
- `.planning/ROADMAP.md` §"Phase 2: Email Identity" — goal + success criteria

### Research
- `.planning/research/SUMMARY.md` §"Phase 2: Email + Verification + Password Reset" — phase rationale
- `.planning/research/STACK.md` §"Resend" — package versions, runtime constraints (MUST be Node runtime, not Edge)
- `.planning/research/PITFALLS.md` #8 (password reset enumeration), #9 (token hashing), #10 (cross-flow token replay) — the exact CVE/attack class each decision defends against
- `.planning/research/ARCHITECTURE.md` §"Resend pattern" + §"lib/auth/tokens.ts" — directory placement

### Codebase map
- `.planning/codebase/CONVENTIONS.md` — Result monad, Zod-at-boundary, $eq wrap, DTO pattern, ClientMeta from Phase 1
- `.planning/codebase/ARCHITECTURE.md` — DDD layering: domain/, infra/, actions/, dto/, validation/
- `.planning/codebase/STRUCTURE.md` — existing lib/ layout this phase extends
- `.planning/phases/01-stabilization/01-CONTEXT.md` — ClientMeta pattern from Phase 1 (reuse verbatim)
- `.planning/phases/01-stabilization/01-SUMMARY.md` — what actually shipped in Phase 1 (vs plan)

### Files this phase touches
- `app/src/lib/infra/resend/client.ts` — NEW — Resend SDK wrapper, isolated per lib/infra/ rule
- `app/src/lib/infra/resend/templates/VerifyEmail.tsx` — NEW — React Email component
- `app/src/lib/infra/resend/templates/ResetPassword.tsx` — NEW
- `app/src/lib/infra/resend/templates/Welcome.tsx` — NEW
- `app/src/lib/infra/resend/send.ts` — NEW — fire-and-forget wrapper with audit
- `app/src/lib/auth/tokens.ts` — NEW — single-use token primitive
- `app/src/lib/actions/email.ts` — NEW — verify server action + resend verification action
- `app/src/lib/actions/reset.ts` — NEW — request-reset + confirm-reset actions
- `app/src/lib/actions/auth.ts` — extend ActionErrorCode union, call token + email enqueue from signup; extend ClientMeta call sites as needed
- `app/src/lib/env.ts` — add RESEND_API_KEY + RESEND_FROM_ADDRESS (optional in dev, required in prod)
- `app/src/lib/db/models/user.ts` — add `sessionEpoch: number` field (default 0)
- `app/src/lib/auth/session.ts` — extend `SessionData` with `epoch?: number`; extend `requireSession` to check epoch drift
- `app/src/lib/validation/schemas.ts` — add VerifyEmailSchema, RequestResetSchema, ConfirmResetSchema
- `app/src/lib/dto/user.ts` — no change (emailVerifiedAt already exposed in Phase 1)
- `app/src/app/api/verify/route.ts` — NEW — GET handler for verification link consumption (route handler, not server action — it's a GET target of an emailed link)
- `app/src/app/api/reset/route.ts` — NEW — GET handler for the reset link landing; actual reset form is a page (not the handler)
- `app/src/app/(auth)/forgot-password/page.tsx` — NEW — reset request form
- `app/src/app/(auth)/forgot-password/forgot-form.tsx` — NEW — client component
- `app/src/app/(auth)/reset/page.tsx` — NEW — reset confirm form (reads `?token=...`)
- `app/src/app/(auth)/reset/reset-form.tsx` — NEW — client component
- `app/src/app/(app)/dashboard/page.tsx` — extend to render unverified banner

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets from Phase 1
- `ClientMeta` type + `captureClientMeta()` in `app/src/lib/actions/auth.ts` — reuse verbatim in email.ts and reset.ts
- `audit(meta, event, outcome, payload, userId?)` pure sink — reuse for every email_send, email_verify, password_reset event
- `rateLimit(namespace, key, limit, windowMs)` from `app/src/lib/auth/rate-limit.ts` — reuse for per-IP and per-email buckets
- `verifyPassword` and `hashPassword` from `app/src/lib/auth/password.ts` — reuse in password reset flow
- `getSession` and `requireSession` from `app/src/lib/auth/session.ts` — extend with epoch check
- `Result<T, E>` monad at `app/src/lib/result.ts` — available but not forced; server actions continue using `ActionState` union for consistency
- `toPublicUser` DTO at `app/src/lib/dto/user.ts` — already exposes `emailVerifiedAt`, no extension needed
- `canAccessDay` at `app/src/lib/billing/entitlements.ts` — consumed by Phase 4's subscribe gate (future)

### Established patterns
- Every Mongo query wraps user input in `$eq` — extends to every new token lookup in this phase
- Server actions re-verify auth at entry; middleware is headers-only
- Vendor SDKs stay in `lib/infra/`; domain never imports infra
- All audit events take `ClientMeta` as a parameter — no `next/headers` re-entry after await
- `check-no-eq.sh` tripwire from Phase 1 will catch missed `$eq` wraps in CI (Phase 5 wires it in; Phase 2 runs it locally)
- No `any` types. Strict TS.

### Integration points
- Phase 1 scaffolded `lib/infra/` and `lib/infra/index.ts` — Phase 2 populates the Resend sub-folder and re-exports from the barrel
- Phase 1 scaffolded `lib/auth/` already exists — `tokens.ts` is a sibling module
- The `saveAnswer` action in `lib/actions/progress.ts` already re-checks tier via `canAccessDay` — Phase 2 doesn't touch it, but when Phase 4 lands the subscribe gate, it will gate on `emailVerifiedAt` using the same pattern

</code_context>

<specifics>
## Specific Ideas

- The ClientMeta capture-once pattern from Phase 1 is LOAD-BEARING for Phase 2. Every new server action (request-reset, confirm-reset, resend-verify, consume-verify) must capture meta once at entry, BEFORE any `await` that touches Mongo or Resend. `audit()` and `rateLimit()` take the meta as a parameter — never re-entering `next/headers` after an await.
- Constant-time response on `/forgot-password` is the single most critical UX+security property in this phase. If the implementer is ever tempted to early-return on "email not found", that's the cue to stop and re-read PITFALLS.md #8.
- The `sessionEpoch` mechanism is the only schema change this phase owns beyond what Phase 1 already scaffolded. It's additive, defaults to 0, and backfills implicitly (old sessions compare against `undefined` vs `0` — both are "no drift"). Keep the change surgical.
- React Email + Resend in Next.js 15 requires `runtime = "nodejs"` on any route handler that renders an email. Edge runtime rejects `react-dom/server`. The Phase 2 verify and reset route handlers both land in `app/api/` — set the runtime export.
- Emails on an ethical-hacking audience get scrutinized more than normal. No tracking pixels, no click tracking, no utm, no dark patterns. The Resend SDK defaults to no tracking — don't opt in.

</specifics>

<deferred>
## Deferred Ideas

- **Magic-link login** — deferred to v2. Tempting to add "click to log in" here since the token infrastructure is identical, but it changes the auth model and needs its own UX review.
- **Email preferences / unsubscribe page** — transactional emails don't strictly need CAN-SPAM unsubscribe (they're transactional), but adding a preferences page would need its own spec. Defer.
- **TOTP MFA gated behind email verification** — Phase 2 makes it possible, Phase 5 or v2 ships it.
- **Welcome drip campaign** (Day 1 email, Day 7 check-in) — defer to v2 retention milestone.
- **Email deliverability monitoring / bounce tracking** — defer to Phase 5 production hardening.
- **Custom unsubscribe tokens per email category** — out of scope; Resend handles bounces globally.

</deferred>

---

*Phase: 02-email-identity*
*Context gathered: 2026-04-14*
