# Codebase Concerns

**Analysis Date:** 2026-04-13

## Critical Bugs

### Signup 500 on POST — Headers Called Outside Request Scope

**Issue:** `headers()` from `next/headers` is called inside the `audit()` helper at `app/src/lib/actions/auth.ts:67`, which is invoked AFTER the `connectDB()` call at line 125. When MongoDB isn't running, `connectDB()` hits an 8-second timeout (line 30 in `app/src/lib/db/mongo.ts`), during which the Next.js AsyncLocalStorage request scope is lost. The subsequent `headers()` call in `audit()` throws "called outside a request scope", returning a 500 error to the client.

**Files:**
- `app/src/lib/actions/auth.ts:89-158` (signup action)
- `app/src/lib/actions/auth.ts:33-43` (getClientMeta helper calls headers())
- `app/src/lib/actions/auth.ts:60-79` (audit helper calls getClientMeta)
- `app/src/lib/db/mongo.ts:24-37` (connectDB with 8s timeout)

**Impact:** All signup attempts fail with 500 when MongoDB is unavailable. The error is unrecoverable because the request context is destroyed before audit logging completes.

**Fix Approach:** Collect client metadata (IP, user-agent, origin) once at the START of each auth action, before `connectDB()`, and pass the collected meta object to `audit()` as parameters instead of calling `headers()` inside `audit()`. This keeps all request-scoped operations synchronous and sequential before any async DB operation.

---

### Mongoose Duplicate Index Warnings

**Issue:** The `User` model at `app/src/lib/db/models/user.ts:8` declares `email: { unique: true, index: true }` at the field level, AND line 27 explicitly creates a duplicate index with `userSchema.index({ email: 1 }, { unique: true })`. The `Audit` model at `app/src/lib/db/models/audit.ts:5` has the same problem with the `at` field (field-level `index: true`) but also has line 19 creating a second index with expireAfterSeconds TTL. This causes MongoDB warnings on every application boot.

**Files:**
- `app/src/lib/db/models/user.ts:8, 27`
- `app/src/lib/db/models/audit.ts:5, 19`

**Impact:** Console spam on every server startup. Duplicate indexes waste storage and slow write operations. Not a functional bug, but degrades developer experience and logs.

**Fix Approach:** Remove the explicit `.index()` calls at lines 27 (user.ts) and 19 (audit.ts). The field-level `index: true` and `{ unique: true }` declarations are sufficient. For the audit TTL, use Mongoose index options: `userSchema.index({ email: 1 }, { unique: true })` → remove, keep field-level only. For audit TTL: `auditSchema.index({ at: 1 }, { expireAfterSeconds: ... })` → remove; instead add to the field: `at: { type: Date, default: Date.now, index: true, expires: '90d' }` if Mongoose supports it, OR keep ONE index call with TTL and remove field-level index.

---

### MongoDB Not Available in Dev Environment

**Issue:** The dev `.env` file (not readable per security rules) points at `mongodb://localhost:27017/ceh-prep`, but no MongoDB instance is running on the host. Any route that touches the database returns a 500 after an 8-second timeout. The environment is blocking all database operations.

**Files:**
- `app/src/lib/env.ts:9` (MONGO_URI required at startup)
- `app/src/lib/db/mongo.ts:28-32` (serverSelectionTimeoutMS: 8000)

**Impact:** Cannot test any authenticated feature locally without MongoDB. Auth signup/login succeed but will fail if they touch the database (which signup does at line 125 of `auth.ts`). Full dev environment is broken without manual MongoDB setup or Docker container.

**Fix Approach:** Add MongoDB Atlas free tier connection. User has agreed to use Atlas SRV string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/ceh-prep`). Update `app/.env` with the Atlas URI. Document in README that dev requires either: (a) local MongoDB with `mongod` running, or (b) MongoDB Atlas free tier connection string in `.env`.

---

## Missing Critical Features

### No Paddle Billing — Pro Tier Gate Not Enforced

**Issue:** The pricing page at `app/src/app/pricing/page.tsx:53` advertises Pro tier at `$0 (while in beta)` with a crossed-out `$9 / mo` (line 52-53). The user has committed to implementing real $30/mo billing via Paddle Billing v2. Currently there is NO billing implementation: no checkout flow, no webhook handler, no subscription model, no tier enforcement at the page level.

**What Exists:**
- User model has `tier: { enum: ["free", "pro"] }` at `app/src/lib/db/models/user.ts:15`
- `saveAnswer` in `app/src/lib/actions/progress.ts:42-44` checks `user.tier === "free"` and blocks saves past day 3
- Free tier helper `isFreeDay()` enforces 3-day limit for answer saves

**What's Missing:**
- No Paddle client/SDK integration
- No checkout overlay or payment modal
- No `/api/webhooks/paddle` route to receive subscription events
- No Subscription model to store active subscriptions
- No subscription verification in tier-check logic
- No page-level gate: free users can still VIEW all 14 days of content (only SAVE blocked)

**Files:**
- `app/src/app/pricing/page.tsx:48-65` (promises Pro at $9/mo)
- `app/src/app/(app)/course/[day]/page.tsx:1-113` (renders all content for all users)
- `app/src/lib/actions/progress.ts:39-44` (only blocks saveAnswer, not page access)
- `app/src/lib/db/models/user.ts:15` (has tier field but no subscription tracking)

**Impact:** Free tier is soft-enforced (users can read lessons but not save progress). No revenue collection. No subscription management. Users can never upgrade. Pricing page promises a paid tier that doesn't exist.

**Fix Approach:**
1. Add Paddle integration: import paddle.js SDK, set up public API key
2. Create `/api/webhooks/paddle` POST route to receive `subscription.created`, `subscription.updated`, `subscription.canceled` events
3. Add `Subscription` model with fields: userId, paddleSubscriptionId, status, currentPeriodStart, currentPeriodEnd, canceledAt
4. Add tier verification: check subscription status in DB before allowing Pro-only features
5. Add page-level gate: in `app/src/app/(app)/course/[day]/page.tsx`, check tier and redirect free users to `/pricing` after day 3
6. Create checkout component that opens Paddle modal on `/pricing` CTA button click

---

### No Google OAuth — Only Email/Password Auth

**Issue:** User wants "Sign in with Google" but it is not implemented. Currently only email/password authentication exists via custom signup/login actions at `app/src/lib/actions/auth.ts`.

**What's Missing:**
- No Google OAuth2 Client ID / Secret
- No oauth library (google-auth-library-nodejs, next-auth, Auth0, etc.)
- No `/auth/google/callback` route to handle OAuth redirect
- No OAuth state parameter validation for CSRF protection
- No link-to-existing-account flow (if user signs up with Google, then tries to login with email, or vice versa)

**Files:**
- `app/src/app/(auth)/signup/signup-form.tsx:1-74` (only has email/password form)
- `app/src/app/(auth)/login/login-form.tsx:1-53` (only has email/password form)
- `app/src/lib/actions/auth.ts:85-158` (signup function)
- `app/src/lib/actions/auth.ts:164-233` (login function)

**Impact:** Users must remember a password. No frictionless sign-in. Reduces conversion. No social proof (account linking).

**Fix Approach:**
1. Register app with Google Cloud Console, get Client ID and Secret
2. Add OAuth state cookie helper (`app/src/lib/auth/oauth.ts`): generate state, store in secure HttpOnly cookie
3. Add `/auth/google/authorize` route that redirects to Google with state + scopes
4. Add `/auth/google/callback` route that:
   - Validates state token
   - Exchanges auth code for ID token
   - Finds or creates User with `googleId` field
   - Creates session
5. Update signup/login forms to show "Continue with Google" button
6. Add `googleId` field to User schema for account linking

---

### No Password Reset — No Email Verification

**Issue:** Users cannot reset forgotten passwords. No email-based verification flow exists. Account recovery is impossible.

**Files:**
- `app/src/lib/db/models/user.ts` (no emailVerified, no resetToken fields)
- `app/src/lib/actions/auth.ts` (signup and login only, no reset actions)

**Impact:** If a user forgets their password, their account is permanently locked. No way to verify email ownership or send recovery links.

**Fix Approach:**
1. Add `emailVerified: { type: Boolean, default: false }` to User schema
2. Add `resetToken: { type: String, default: null, select: false }` and `resetTokenExpiresAt: { type: Date, default: null, select: false }` fields
3. Choose email provider: Resend recommended (free tier, good for transactional)
4. Add `resetPassword` action: takes email, generates short-lived token, sends link via email
5. Add `verifyResetToken` and `confirmPasswordReset` actions
6. Create `/auth/reset` and `/auth/reset/[token]` pages

---

### No MFA (Multi-Factor Authentication)

**Issue:** Account security is password-only. No TOTP (Time-based One-Time Password) or other secondary factors.

**Files:**
- `app/src/lib/db/models/user.ts` (no mfaSecret, mfaEnabled fields)
- `app/src/lib/actions/auth.ts` (no MFA enforcement)

**Impact:** If a password is compromised (via phishing, breach, brute force), attacker gains full account access. For an ethical hacking course, this is a significant security risk.

**Fix Approach:**
1. Add `mfaEnabled: { type: Boolean, default: false }` and `mfaSecret: { type: String, default: null, select: false }` to User schema
2. Use `otpauth` library for TOTP support
3. Create `/account/mfa/setup` page: show QR code, require backup codes
4. Update login action: after password verification, check `mfaEnabled`; if true, require TOTP code
5. Store recovery codes (one-time use backup tokens) in case user loses authenticator

---

## Security Concerns

### CSP Allows `'unsafe-inline'` for Scripts

**Issue:** `app/next.config.ts:5` sets `script-src 'self' 'unsafe-inline'`. This is necessary for Next.js dev mode (fast refresh), but is a CSP violation in production. Inline scripts are vulnerable to DOM-based XSS if user input is ever directly rendered.

**Files:**
- `app/next.config.ts:3-15` (CSP header definition)

**Current Mitigation:** No inline scripts in the codebase currently. All JS is bundled and served from `/next/static/...`.

**Risk:** If future features add inline event handlers or script tags without sanitization, XSS becomes possible.

**Recommendation:**
1. Keep `'unsafe-inline'` for development (needed for fast refresh)
2. For production: generate a nonce on each request, pass it to all inline scripts, set CSP to `script-src 'self' 'nonce-{nonce}'`
3. Add middleware to generate and pass nonce to all responses
4. Never use inline event handlers (`<button onclick="...">`) — always use event listeners
5. Sanitize all user-generated content with a library like DOMPurify before `dangerouslySetInnerHTML`

---

### In-Process Rate Limiting — Won't Scale Horizontally

**Issue:** `app/src/lib/auth/rate-limit.ts` uses an in-process `LRUCache` from the `lru-cache` package. This works for a single instance but breaks when deployed to Vercel (multiple serverless instances) or any multi-instance setup. Each instance maintains its own rate limit counters, so an attacker can distribute attacks across instances to bypass the limit.

**Files:**
- `app/src/lib/auth/rate-limit.ts:1-47`
- `app/src/lib/actions/auth.ts:96, 175` (calls to rateLimit)

**Current Limits:**
- Signup: 5 attempts per 60 seconds per IP
- Login: 10 attempts per 60 seconds per IP

**Impact:** Rate limiting is ineffective in production. Brute-force attacks on signup/login succeed because the attacker's requests are distributed across multiple serverless instances.

**Fix Approach:**
1. Replace in-process LRUCache with Redis (or Upstash free tier, which offers free Redis for development/small projects)
2. Update `rateLimit()` signature to be async: `export const rateLimit = async (namespace: string, key: string, limit: number, windowMs: number): Promise<RateLimitResult>`
3. Use Redis `INCR` and `EXPIRE` commands for sliding-window rate limiting
4. Test that limits are properly enforced across multiple instances

---

### `@ts-expect-error` in session.ts — Type Drift with iron-session

**Issue:** `app/src/lib/auth/session.ts:27` has `@ts-expect-error` to suppress a type mismatch between iron-session v8's `CookieStore` type and Next 15's `ReadonlyRequestCookies`. The runtime shapes are compatible, but TypeScript rejects it. This is a known incompatibility that should be removed when iron-session ships proper types.

**Files:**
- `app/src/lib/auth/session.ts:25-28`

**Impact:** Suppressed error masks potential future type issues. Not a runtime bug, but technical debt.

**Recommendation:** Monitor iron-session releases for Next 15 type support. Once shipped, remove the suppression and re-run type checks.

---

### Security Auditing Infrastructure Exists but Not Reviewed

**Issue:** Audit events are written to MongoDB (`app/src/lib/actions/auth.ts:68` calls `AuditModel.create()`), and the model has a 90-day TTL (line 19 in `app/src/lib/db/models/audit.ts`). However, there is NO admin dashboard to review these events. Suspicious patterns (e.g., multiple failed logins from one IP) are logged but never analyzed.

**Files:**
- `app/src/lib/db/models/audit.ts` (audit data model)
- `app/src/lib/actions/auth.ts:60-79` (audit logging)

**Impact:** No visibility into account compromise attempts, brute-force attacks, or suspicious access patterns. Security events happen in the dark.

**Fix Approach:**
1. Create `/admin/audit` dashboard (admin-only, protected by session + role check)
2. Query recent audit events: failed logins, rate limits, origin mismatches, errors
3. Show by event type, outcome (ok/deny/error), IP, user
4. Add filtering (date range, event, outcome) and export (CSV)
5. Optional: add alerting for suspicious patterns (e.g., 3+ failed logins from same IP in 5 min = email admin)

---

## Tech Debt

### Tier Gate Incomplete — Free Users Can Read All Content

**Issue:** Free tier content gating is enforced at the `saveAnswer` action level (`app/src/lib/actions/progress.ts:42-44`) but NOT at the page level. This means free users can navigate to all 14 days of course content and read the lessons; they just can't save their quiz answers past day 3.

**The Intended Model:**
- Free: Days 1-3 only (read + save answers)
- Pro: Days 1-14 (read + save answers)

**The Current Behavior:**
- Free users can VIEW days 4-14 content but get a "locked" error when trying to save answers

**Files:**
- `app/src/app/(app)/course/[day]/page.tsx:1-113` (renders content for all users)
- `app/src/lib/actions/progress.ts:39-44` (only blocks saves)
- `app/src/lib/content/days.ts:1-916` (14 days of curriculum bundled)

**Impact:** Free users see premium content and may feel entitled to it. Blurs the freemium boundary. Bad UX: error message instead of paywall.

**Fix Approach:**
1. Add tier gate in `app/src/app/(app)/course/[day]/page.tsx`: after server-side auth check, fetch user tier
2. If `tier === "free" && day > 3`, redirect to `/pricing` with a message: "Try days 1–3 free. Upgrade for the full 14-day sprint."
3. Show a banner on free days: "Days 4+ available with Pro"
4. Once Paddle billing is implemented, check subscription status in addition to tier

---

### Large Content File — 916 Lines in days.ts

**Issue:** `app/src/lib/content/days.ts` contains all 14 days of curriculum (916 lines). This is maintainability risk: editing a single question or lesson requires touching a massive file. No structure for versioning or updating content without redeployment.

**Files:**
- `app/src/lib/content/days.ts` (916 lines)

**Impact:** Content updates require code changes and redeployment. No separation between content and code. Difficult to review changes. Risk of accidental formatting breaks.

**Fix Approach:**
1. Extract curriculum to a separate CMS or JSON/YAML files
2. Load at build time (for static generation) or runtime (for dynamic updates)
3. Example structure:
   ```
   app/content/day-01.json
   app/content/day-02.json
   ...
   app/content/day-14.json
   ```
4. Create a loader function in `app/src/lib/content/index.ts` that reads and parses these files
5. Validate structure with Zod schema at runtime

---

## Deployment Concerns

### Development Environment Requires Manual MongoDB Setup

**Issue:** No clear path for new developers to get MongoDB running locally. The dev `.env` points to localhost but no MongoDB instance exists. Docker Compose setup would help.

**Files:**
- `app/.env` (MONGO_URI=mongodb://localhost:27017/ceh-prep)

**Fix Approach:**
1. Create `docker-compose.yml` at project root:
   ```yaml
   version: '3.8'
   services:
     mongodb:
       image: mongo:latest
       ports:
         - "27017:27017"
       environment:
         MONGO_INITDB_ROOT_USERNAME: dev
         MONGO_INITDB_ROOT_PASSWORD: dev
   ```
2. Create `.env.local` (git-ignored) with Docker connection string
3. Update README: "Run `docker-compose up -d && npm run dev`"

---

### Vercel Deployment: No Environment Configuration Documented

**Issue:** The app is likely deployed to Vercel (Next.js native), but there is no `vercel.json` and no documentation on which environment variables must be set in Vercel project settings.

**Required at Deploy Time:**
- `MONGO_URI` (Atlas SRV string, must use production URI not dev localhost)
- `SESSION_SECRET` (32+ random characters, different from dev)
- `NEXT_PUBLIC_APP_URL` (production domain)

**Fix Approach:**
1. Create `vercel.json` with build settings and environment docs
2. Add deploy checklist to README:
   - [ ] Set `MONGO_URI` to production Atlas cluster
   - [ ] Generate new `SESSION_SECRET` for production (32+ random)
   - [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
   - [ ] Verify CSP headers are production-safe (remove `'unsafe-inline'` for scripts)

---

## High-Risk Areas for Hacking Attempts

**Context:** This is an ethical hacking course. The codebase WILL be probed and attacked by users attempting to cheat or break the system.

**Known Attack Vectors to Monitor:**

### 1. Tier Bypass Attempts
- Users will try to modify frontend session data or intercept API calls to access Pro content
- Mitigation in place: server-side tier checks in `saveAnswer` action
- Risk: Page-level gate missing (see "Tier Gate Incomplete" above)

### 2. Rate Limit Evasion
- Attackers will distribute brute-force attempts across multiple IPs (VPN/proxy)
- Current rate limiting per-IP is weak; no account-level lockout
- Mitigation: Account lockout at 3+ failed login attempts (see `failedLoginCount` field in User model, enforced at line 206 in auth.ts)
- Risk: In-process rate limiting doesn't work at scale (see "In-Process Rate Limiting" above)

### 3. Session Fixation / CSRF
- Attacker could try to reuse old session cookies or craft forged requests
- Mitigation: `SameSite=Strict` cookies (line 17 in session.ts), Origin validation in auth actions (line 49-58 in auth.ts)
- Risk: None currently detected; defenses are in place

### 4. Password Dumping
- If MongoDB is compromised, passwords are Argon2id-hashed (secure)
- Risk: None if library is kept up to date

### 5. Audit Log Manipulation
- Users with DB access could try to clear their audit trail
- Mitigation: Audit events are immutable once written (no delete/update in application)
- Risk: None if MongoDB access is restricted to app service account

---

## Priority Ranking

| Issue | Severity | Effort | Blocker |
|-------|----------|--------|---------|
| Signup 500 on POST | Critical | Medium | Yes — blocks auth |
| MongoDB not available in dev | Critical | Low | Yes — blocks all dev |
| No Paddle billing | High | High | No — feature gate working |
| No password reset | High | Medium | No — acceptable for MVP |
| Tier gate incomplete | High | Low | No — soft-enforced |
| CSP unsafe-inline | Medium | Low | No — works in prod |
| Rate limit in-process | Medium | Medium | No — works single-instance |
| Mongoose duplicate indexes | Low | Trivial | No — cosmetic |
| No Google OAuth | Medium | High | No — email auth works |
| No MFA | Medium | High | No — password-only acceptable for MVP |

---

*Concerns audit: 2026-04-13*
