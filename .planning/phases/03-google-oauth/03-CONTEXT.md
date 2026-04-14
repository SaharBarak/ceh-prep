# Phase 3: Google OAuth — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Mode:** Auto (recommended defaults — override by editing before `/gsd:plan-phase 3`)

<domain>
## Phase Boundary

Users can click "Continue with Google" on `/login` or `/signup` and end up
authenticated inside the app. Own the OAuth 2.0 Authorization Code + PKCE flow
end-to-end via `google-auth-library` — no NextAuth, no third-party auth
framework. Auto-link to an existing password account is STRICTLY gated on the
existing user's `emailVerifiedAt !== null`, which only Phase 2's VERIFY-02 can
set. This structural gate makes account-takeover-by-email-collision
impossible: an attacker who pre-registers a victim's email (without
verification) cannot hijack the account when the victim later clicks
"Continue with Google".

**In scope:** OAUTH-01..09 (9 requirements).

**Out of scope:** Settings page (deferred to Phase 5 or v2), MFA (v2),
magic-link login (v2), other OAuth providers (GitHub, Apple, Microsoft — all
v2+). Paddle checkout integration (Phase 4). All analytics instrumentation
(Phase 5).
</domain>

<decisions>
## Implementation Decisions

### OAuth library
- **`google-auth-library@^10.6.2`** (already specified in research/STACK.md). Node-only runtime. Never Edge.
- Handles: authorization URL construction with PKCE, token exchange, `verifyIdToken` with key rotation / JWKS caching / clock skew, id_token claim verification.
- We do NOT use `next-auth`, `@auth/core`, `clerk`, `stack-auth`, or any other auth framework. Own the flow. The Phase 1-2 architecture is purpose-built for this — we have `ClientMeta`, `audit`, `rateLimit`, `Result<T,E>`, DTO mappers, `$eq` wrap, `requireSession` epoch drift — none of which compose cleanly with a framework-owned session.

### OAuth scopes — MINIMAL
- `openid email profile` — the canonical minimum. NEVER add Drive, Calendar, People API, Contacts, Sheets, Gmail, or anything else. We only need: email, email_verified, name, picture.
- `prompt=consent` — forces Google's consent screen every time. Prevents silent re-link if a user switches Google accounts.
- `access_type=offline` is NOT set. We don't need refresh tokens — one-time sign-in is the whole flow.

### Cookie scheme — SEPARATE state + pkce_verifier
- **Two cookies, not one.** State is a request nonce; PKCE verifier is key material. Separation of concerns, and having two distinct cookies means a partial-cookie attack (steal state, not verifier) still fails the code exchange.
- Cookie names: `__Host-oauth-state` and `__Host-oauth-pkce` (prefix enforces `Secure + Path=/ + no Domain`).
- **`SameSite=Lax`** — REQUIRED. Google's callback is a cross-site redirect, and `SameSite=Strict` would strip the cookies on arrival. `Lax` is the well-known exception that survives top-level navigation GETs but still blocks CSRF on POST.
- **`HttpOnly + Secure` (Secure only in production)** — standard.
- **TTL: 5 minutes.** The entire OAuth round-trip should take < 30 seconds; 5 minutes is slack for slow users without giving attackers a long replay window.
- **Single-use semantics:** on callback, read both cookies, delete them via a Set-Cookie with `Max-Age=0` before any verification work. Any replay hits empty cookies and fails.

### PKCE — S256 only
- `code_verifier` = 32 random bytes base64url (43 chars). Stored in `__Host-oauth-pkce`.
- `code_challenge` = SHA-256(verifier) base64url. Sent to Google in the authorize URL.
- `code_challenge_method=S256`. Never `plain`.
- google-auth-library's `generateAuthUrl` handles the construction once we pass `code_challenge` + `code_challenge_method`.

### `decideLink` — pure function, 5 cases enumerated
- Signature: `decideLink(googleProfile: VerifiedGoogleProfile, existingUser: UserDoc | null): LinkDecision`
- `VerifiedGoogleProfile` = `{ sub: string; email: string; emailVerified: true; name: string; picture: string | null }` — we ONLY construct this type if Google's `email_verified` claim is `true` AND the id_token signature + audience + iss are all valid. If any of those fail, we never reach `decideLink`.
- `LinkDecision` = discriminated union of:
  1. `{ kind: "create_new" }` — no existing user with this email OR this googleSub
  2. `{ kind: "login_linked"; userId }` — existing user with matching googleSub (straight login)
  3. `{ kind: "auto_link"; userId }` — existing password user WITH `emailVerifiedAt !== null` AND no googleSub yet (safe auto-link)
  4. `{ kind: "require_manual_link"; userId }` — existing password user with same email BUT `emailVerifiedAt === null` — NEVER auto-link; route to manual flow
  5. `{ kind: "conflict"; reason }` — same-email user already linked to a DIFFERENT googleSub (impossible under normal flow, but we handle it defensively)
- Pure function, zero I/O, fully unit-testable. Lives at `app/src/lib/auth/oauth/decide-link.ts`.

### `returnTo` validation — URL constructor + path allowlist
- Callback accepts `returnTo` only from the state cookie payload, never from the query string directly.
- Validation: parse with `new URL(returnTo, NEXT_PUBLIC_APP_URL)`, require `url.origin === NEXT_PUBLIC_APP_URL_ORIGIN`, require `url.pathname` matches `/^\/(?:dashboard|course|exam|pricing|settings|verify-pending)(?:\/|$)/`.
- If validation fails, redirect to `/dashboard` silently (no error — the returnTo was invalid, not the auth).
- **Never** redirect to an external origin. Never redirect to `javascript:`, `data:`, or `file:` URIs.

### Route handlers (both `runtime = "nodejs"` + `dynamic = "force-dynamic"`)
- `GET /api/oauth/google/start` — generates state + pkce verifier + pkce challenge, sets two cookies, redirects to Google's authorize URL.
- `GET /api/oauth/google/callback` — reads state and pkce cookies, deletes them, validates state match against `?state=`, exchanges `?code=` for tokens using the verifier, calls `verifyIdToken` on the id_token, runs `decideLink`, acts on the decision, sets the iron-session (with `epoch = user.sessionEpoch ?? 0`), redirects to `returnTo` or `/dashboard`.
- Both handlers re-collect `ClientMeta` via a route-handler-local `captureMeta()` (same pattern as `/api/verify`) and call the canonical `audit()` from `@/lib/actions/shared`.
- No server action counterpart — OAuth is GET-only by protocol.

### Error codes
- Extend `ActionErrorCode` in `lib/actions/shared.ts` with:
  - `oauth_state_mismatch`
  - `oauth_code_missing`
  - `oauth_token_exchange_failed`
  - `oauth_id_token_invalid`
  - `oauth_email_unverified_google`
  - `oauth_link_conflict`
- Route handlers redirect to `/login?error=<code>` on any failure. The login page (from Phase 2) already handles `?error=token_invalid` — extend it with a lookup table of OAuth error codes.

### Sign-in vs sign-up button placement
- Both `/login` and `/signup` pages get a "Continue with Google" button ABOVE the email/password form. One button, same destination (`GET /api/oauth/google/start`). The server decides whether to create a new user or sign an existing one in — the user doesn't need to pick a form ahead of time.
- The button is a plain `<a href>` (anchor, not form) — it initiates a navigation GET. No client JavaScript needed.
- Visual: the button follows the taste-skill conventions — same lime accent border, mono uppercase label, single svg logo, no external logo CDN.

### Environment variables (added to `lib/env.ts`)
- `GOOGLE_OAUTH_CLIENT_ID` — optional in dev (button hidden), required in prod
- `GOOGLE_OAUTH_CLIENT_SECRET` — optional in dev, required in prod
- `GOOGLE_OAUTH_REDIRECT_URI` — defaults to `${NEXT_PUBLIC_APP_URL}/api/oauth/google/callback` if unset; must match what's registered in Google Cloud Console
- All three validated with a cross-field refinement: either all three set or none set. Production boot refuses to start without them.

### Rate limiting
- `rateLimit("oauth-start-ip", meta.ip, 10, 60_000)` on the start endpoint — prevents a spammer burning through OAuth state tokens
- `rateLimit("oauth-callback-ip", meta.ip, 10, 60_000)` on the callback — prevents callback flooding
- Same in-proc lru-cache interface from Phase 1; Phase 5 swaps to Upstash

### Audit events (three distinct events)
- `oauth_start` — payload: `{ provider: "google", returnToHash: sha256(returnTo).slice(0,12) }` — outcome `ok` | `deny` (rate limit)
- `oauth_callback` — payload: `{ provider: "google", outcome_reason, decision: LinkDecision["kind"] }` — outcome `ok` | `deny` | `error`
- `oauth_link` — payload: `{ provider: "google", action: "created" | "login_linked" | "auto_linked" | "manual_link_required" }` — outcome always `ok`
- NEVER log raw id_tokens, state values, pkce verifiers, or email addresses. emailHash only.

### Signup wiring
- When `decideLink` returns `"create_new"`, the callback creates a User doc with:
  - `email` from google profile
  - `passwordHash` = **a random Argon2 hash of a crypto-random 32-byte string, stored to satisfy the `required: true` constraint but never usable as a password**. The user can set a password later via "forgot password" flow (which verifies they own the email — exactly what we want for OAuth-only users).
  - `googleSub` = profile.sub
  - `emailVerifiedAt` = new Date() (trusted from Google's `email_verified === true` claim)
  - `displayName` = profile.name
  - `tier` = "free"
  - `sessionEpoch` = 0
- Fires `sendWelcomeEmail` (non-blocking) for parity with the verified-signup flow.

### Claude's Discretion
- Exact SVG path for the Google "G" logo (inline, one path, no color) — implementer picks
- Whether to use `useFormStatus` on the button for a loading spinner (probably not — the nav is instant once clicked, and a spinner flash looks glitchy)
- Whether the `__Host-` prefix works in all iron-session environments — if there's a conflict, fall back to `__Secure-` + explicit `path=/`
- Exact copy for the OAuth error page strings — follow taste-skill voice from Phase 2
- **`returnTo` validation implementation:** path-only regex allowlist (`/^\/(?:dashboard|course|exam|pricing|settings|verify-pending)(?:\/|$)/`) is equivalent in security outcome to URL constructor + origin check for path-only strings. Regex-only is simpler and MORE conservative (rejects any absolute/protocol-relative URL outright). Either approach is acceptable. Plan 03-02 uses regex-only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + roadmap
- `.planning/PROJECT.md` §Validated (Phases 1-2 complete)
- `.planning/REQUIREMENTS.md` §OAUTH — 9 requirements this phase delivers
- `.planning/ROADMAP.md` §"Phase 3: Google OAuth" — goal + success criteria

### Research
- `.planning/research/SUMMARY.md` §"Phase 3: Google OAuth"
- `.planning/research/STACK.md` §"Google OAuth (no NextAuth)" — package versions, runtime = nodejs rule
- `.planning/research/ARCHITECTURE.md` §"Google OAuth" + §"decideLink placement"
- `.planning/research/PITFALLS.md` #4 (state in localStorage), #5 (id_token unverified), #6 (hostile auto-link), #7 (open redirect)

### Codebase map + Phase 1-2 context
- `.planning/phases/01-stabilization/01-CONTEXT.md` §"ClientMeta" — pattern to reuse in route handlers
- `.planning/phases/02-email-identity/02-CONTEXT.md` §"Session epoch" — `sessionEpoch` mechanism the new login path stamps
- `.planning/phases/02-email-identity/02-RESEARCH.md` §"Verify route handler" — route handler pattern template
- `.planning/phases/02-email-identity/02-05-SUMMARY.md` — `lib/actions/shared.ts` extraction (Next 15 `"use server"` constraint; reuse pattern here)
- `.planning/codebase/CONVENTIONS.md` — Result monad, Zod, $eq, DTO, ClientMeta, audit
- `.planning/codebase/ARCHITECTURE.md` — DDD layering

### Files this phase touches
- `app/src/lib/infra/google/oauth-client.ts` — NEW — google-auth-library wrapper, singleton client factory
- `app/src/lib/infra/google/index.ts` — NEW — re-export barrel
- `app/src/lib/auth/oauth/state.ts` — NEW — state + PKCE generation and cookie helpers
- `app/src/lib/auth/oauth/decide-link.ts` — NEW — pure decideLink function
- `app/src/lib/auth/oauth/types.ts` — NEW — VerifiedGoogleProfile, LinkDecision types
- `app/src/lib/env.ts` — extend with GOOGLE_OAUTH_* env vars + cross-field refinement
- `app/src/lib/actions/shared.ts` — extend ActionErrorCode with 6 new oauth_* codes
- `app/src/lib/db/models/user.ts` — no change (googleSub already scaffolded in Phase 1 STAB-09)
- `app/src/lib/db/models/audit.ts` — no change (schema already generic)
- `app/src/app/api/oauth/google/start/route.ts` — NEW — GET handler
- `app/src/app/api/oauth/google/callback/route.ts` — NEW — GET handler
- `app/src/app/(auth)/login/page.tsx` — extend with "Continue with Google" button and error-code lookup
- `app/src/app/(auth)/signup/page.tsx` — extend with "Continue with Google" button
- `app/src/components/oauth/google-button.tsx` — NEW — server component, plain anchor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets from Phases 1-2
- `ClientMeta` type + route-handler `captureMeta()` pattern from `/api/verify` (Phase 2) — use verbatim for OAuth route handlers
- `audit(meta, event, outcome, payload, userId?)` from `@/lib/actions/shared` — pure sink, no `next/headers` re-entry
- `rateLimit(namespace, key, limit, windowMs)` from `@/lib/auth/rate-limit` — reuse for per-IP buckets on both start and callback
- `getSession`, `requireSession` from `@/lib/auth/session` — extended with epoch drift in Phase 2. The OAuth callback creates or updates an iron-session, stamping `session.epoch = user.sessionEpoch ?? 0`.
- `Result<T, E>` monad at `@/lib/result` — available for `decideLink` return shape, but discriminated union is simpler and equally type-safe
- `hashPassword` from `@/lib/auth/password` — used to generate the unusable placeholder hash for OAuth-only users
- `toPublicUser` DTO at `@/lib/dto/user` — already exposes `emailVerifiedAt + role`, still blocks `googleSub` from client — no change needed
- `sendWelcomeEmail` from `@/lib/infra/resend` — reuse for OAuth-created users (parity with email signup)
- Phase 1 STAB-09 already added `googleSub: { type: String, default: null, unique: true, sparse: true }` to User schema. No schema change in Phase 3.

### Established patterns
- Route handlers MUST declare `runtime = "nodejs"` + `dynamic = "force-dynamic"` (Mongoose + Resend require Node)
- `$eq` wrap on every Mongo query on user input (including googleSub + email lookups in decideLink's DB layer)
- `check-no-eq.sh` tripwire from Phase 1 catches misses
- DDD: Google SDK lives ONLY in `lib/infra/google/oauth-client.ts`. `lib/auth/oauth/` has ZERO SDK imports — pure domain.
- Server actions can only export async functions (`"use server"` Next 15 rule); OAuth uses route handlers instead, so this constraint doesn't apply to OAuth code
- Error handling: return a redirect with `/login?error=<code>`. Never render a 500. Never leak stack traces.

### Integration points
- `login/page.tsx` and `signup/page.tsx` both render a `<GoogleButton />` component above the form. The component is a server component because it's just an anchor tag.
- The callback route handler reads cookies via `await cookies()`, then `cookies().delete()` the state + pkce cookies before any verification. Same cookies API as iron-session, no new dep.
- After the callback sets the iron-session, it redirects to the `returnTo` path from the state cookie payload (or `/dashboard`). The dashboard's existing unverified banner doesn't fire for OAuth users because `emailVerifiedAt` is already stamped.
- Phase 4 (Paddle) will eventually gate checkout on `emailVerifiedAt !== null`. OAuth users pass that gate naturally.

</code_context>

<specifics>
## Specific Ideas

- **The structural email-takeover defense is the highest-value thing this phase ships.** `decideLink` treats unverified password accounts as "don't touch" — the attacker-pre-registers-victim-email attack class becomes impossible. Worth auditing the code path twice.
- **PKCE is mandatory even though Google supports confidential clients.** We set a client secret (confidential flow), AND we do PKCE on top. Defense in depth — if the client secret leaks from a .env dump, PKCE still prevents a code-interception attack from completing. google-auth-library supports this combination out of the box.
- **The unusable-password hash for OAuth-only users is intentional.** It satisfies the schema constraint (`passwordHash: required`) without allowing password login. If an OAuth user ever wants a password, the "forgot password" flow will issue a real one via the verified email — exact same path as any other user.
- **`prompt=consent` is a UX paper cut but a security win.** Without it, if a user switches Google accounts in the browser, Google silently re-completes the flow with the new account. `prompt=consent` forces an explicit picker every time.
- **Audit events are split into three** (oauth_start, oauth_callback, oauth_link) so the Phase 5 admin dashboard can reconstruct complete OAuth flows by correlating the sessionNonce across events. One event per lifecycle stage = cleaner filter queries.

</specifics>

<deferred>
## Deferred Ideas

- **Additional OAuth providers** (GitHub, Apple, Microsoft) — same pattern, different SDK. Wait for real user demand. Each provider adds a unique CSP allowlist entry.
- **Single-button "Sign in with Google" on landing page** — maybe post-Phase 5 once the conversion funnel is measurable.
- **Silent token refresh / long-lived sessions via refresh token** — out of scope. We treat OAuth as a one-time sign-in; the iron-session is the long-lived credential after that, enforced by the epoch drift from Phase 2.
- **`/settings` page to unlink Google from a linked account** — deferred to v2 alongside the Settings page itself (which is also where VERIFY-03 will eventually get its "Resend verification from Settings" button per Phase 2's scope decision).
- **OAuth scope expansion** (Drive, Calendar, etc.) — explicitly out of scope. We never ask for more than `openid email profile`.
- **Google One Tap sign-in** — a fundamentally different UX from the button-click flow. Would require a separate CSP rule for `accounts.google.com/gsi/client`. Defer.
- **Account merging UI** for existing users who want to link after the fact — "require_manual_link" decision exists but the UI for it is deferred to the Settings page in v2. Phase 3 routes that case to `/login?error=oauth_link_required` and the user re-signs-in with password.

</deferred>

---

*Phase: 03-google-oauth*
*Context gathered: 2026-04-14*
