# Architecture Research — CEH Prep SaaS (Billing, OAuth, Tier Gating, Email, Admin, Webhooks)

**Domain:** Next.js 15 App Router SaaS with DDD-layered `lib/` and iron-session auth
**Researched:** 2026-04-13
**Confidence:** HIGH for Paddle webhook + Resend + OAuth shape (verified against official Paddle Next.js starter kit and Paddle developer docs); MEDIUM for tier-gate abstraction choice and admin route group (pattern selected from community/Next.js docs guidance, not single authoritative source).

---

## Prime Directive

Every new concern slots into the **existing DDD layering** under `app/src/lib/`. No new architectural style, no NextAuth, no middleware-based auth (CVE-2025-29927 discipline is kept). All external SDKs (Paddle, Google, Resend) live in a new **infrastructure** layer at `app/src/lib/infra/` and are consumed by server actions / route handlers — never by domain modules. The existing `Result<T, E>` monad, `requireSession()`, Zod-at-boundary, DTO mapping, and `$eq` ownership filtering conventions are **reused, not reinvented**.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  PRESENTATION — app/src/app/                                         │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ (auth)/  │ │ (app)/  │ │ (admin)/ │ │ pricing │ │ api/webhooks │  │
│  │ login    │ │ dash    │ │ audit    │ │ checkout│ │  paddle      │  │
│  │ signup   │ │ course  │ │ users    │ │ success │ │              │  │
│  │ oauth/   │ │ exam    │ │          │ │         │ │ (route       │  │
│  │  callback│ │ settings│ │          │ │         │ │  handler)    │  │
│  └────┬─────┘ └────┬────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘  │
├───────┼────────────┼───────────┼────────────┼─────────────┼──────────┤
│ APPLICATION — app/src/lib/actions/ + app/src/lib/guards/             │
│ ┌─────────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────┐    │
│ │ auth.ts     │ │billing.ts│ │admin.ts│ │guards/ │ │ webhook    │    │
│ │  signup     │ │ createCO │ │listAud │ │require │ │ processor  │    │
│ │  login      │ │ portalUrl│ │        │ │Tier    │ │ (from      │    │
│ │  oauthStart │ │          │ │        │ │require │ │  api/      │    │
│ │  oauthLink  │ │          │ │        │ │Role    │ │  webhooks) │    │
│ │  requestPwR │ │          │ │        │ │requireD│ │            │    │
│ │  verifyEmail│ │          │ │        │ │ayAccess│ │            │    │
│ └──────┬──────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └─────┬──────┘    │
├────────┼─────────────┼───────────┼──────────┼────────────┼───────────┤
│ DOMAIN — app/src/lib/auth/ + content/ + billing/ + validation/       │
│ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│ │ auth/    │ │ billing/ │ │ content/│ │validation│ │  dto/        │  │
│ │ session  │ │ tier-rule│ │ days    │ │  zod     │ │  userPublic  │  │
│ │ password │ │ entitle- │ │ isFree  │ │  schemas │ │  subscrPub   │  │
│ │ hibp     │ │  ments   │ │  Day    │ │          │ │  auditPub    │  │
│ │ oauth/   │ │          │ │         │ │          │ │              │  │
│ │  state   │ │          │ │         │ │          │ │              │  │
│ │  link    │ │          │ │         │ │          │ │              │  │
│ └────┬─────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘  │
├──────┼────────────┼────────────┼───────────┼──────────────┼──────────┤
│ INFRASTRUCTURE — app/src/lib/infra/ (SDK adapters; only layer that   │
│ imports vendor SDKs)                                                 │
│ ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────────┐ │
│ │ paddle/     │ │ google/      │ │ resend/    │ │ log/             │ │
│ │  client     │ │  oauthClient │ │  client    │ │  pino            │ │
│ │  checkout   │ │  verifyIdTok │ │  send      │ │                  │ │
│ │  unmarshal  │ │              │ │  templates │ │                  │ │
│ └──────┬──────┘ └──────┬───────┘ └─────┬──────┘ └──────────────────┘ │
├────────┼───────────────┼───────────────┼─────────────────────────────┤
│ PERSISTENCE — app/src/lib/db/models/                                 │
│ ┌────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌───────────────┐  │
│ │ user   │ │ progress│ │ audit   │ │subscription│ │ webhookEvent  │  │
│ │ (+role,│ │         │ │         │ │            │ │ (idempotency) │  │
│ │ +oauth,│ │         │ │         │ │            │ │               │  │
│ │ +email-│ │         │ │         │ │            │ │               │  │
│ │ Verif) │ │         │ │         │ │            │ │               │  │
│ └────────┘ └─────────┘ └─────────┘ └────────────┘ └───────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Rule of layer traversal:**
- Presentation may call Application (actions) and Domain (read-only helpers: `isFreeDay`, tier rule functions).
- Application calls Domain, Infra, and Persistence.
- Domain calls **nothing outbound** (pure logic, deterministic).
- Infra calls external APIs (Paddle, Google, Resend, HIBP).
- Persistence is only touched by Application and Webhook route handlers.
- **Vendor SDKs never appear in `lib/domain/*`, `lib/auth/*`, `lib/content/*`, or `lib/validation/*`.** They live only under `lib/infra/*`.

---

## New Directories to Add

```
app/src/
├── app/
│   ├── (admin)/                           # NEW — admin-only route group
│   │   ├── layout.tsx                     # requireRole("admin") redirect
│   │   └── admin/
│   │       ├── audit/page.tsx
│   │       └── users/page.tsx
│   ├── (app)/
│   │   ├── oauth/
│   │   │   └── callback/
│   │   │       └── route.ts               # NEW — Google OAuth callback (route handler, NOT server action)
│   │   ├── checkout/
│   │   │   ├── page.tsx                   # NEW — Paddle.js inline overlay host
│   │   │   └── checkout-client.tsx        # NEW — "use client" Paddle.js init
│   │   └── settings/
│   │       ├── page.tsx                   # NEW — billing portal, email verification status
│   │       └── billing-section.tsx
│   ├── (auth)/
│   │   ├── reset-password/
│   │   │   ├── page.tsx                   # NEW — request form
│   │   │   ├── [token]/page.tsx           # NEW — confirm form
│   │   │   └── reset-form.tsx
│   │   └── verify-email/
│   │       └── [token]/page.tsx           # NEW — verification landing
│   └── api/
│       └── webhooks/
│           └── paddle/
│               └── route.ts               # NEW — raw-body HMAC verify, runtime=nodejs
├── lib/
│   ├── actions/
│   │   ├── auth.ts                        # EXTEND — add oauthStart, passwordResetRequest, passwordResetConfirm, verifyEmail
│   │   ├── billing.ts                     # NEW — createCheckoutSession, getBillingPortalUrl
│   │   └── admin.ts                       # NEW — listAuditEvents (paginated, RBAC-gated)
│   ├── guards/                            # NEW — composable auth/authorization guards
│   │   ├── require-session.ts             # MOVED from auth/session.ts re-export
│   │   ├── require-role.ts                # NEW — requireRole("admin"): redirect to /dashboard
│   │   ├── require-tier.ts                # NEW — requireTier("pro"): redirect to /pricing
│   │   └── require-day-access.ts          # NEW — requireDayAccess(day): combines tier + free-day rule
│   ├── auth/
│   │   ├── oauth/                         # NEW — Google OAuth domain logic (no SDK imports)
│   │   │   ├── state.ts                   # oauth state + PKCE verifier: create, store in cookie, validate
│   │   │   ├── link.ts                    # link-to-existing-account decision logic
│   │   │   └── profile.ts                 # GoogleProfile type + toUserDraft mapper
│   │   └── tokens.ts                      # NEW — createSingleUseToken, verifyToken (for pw-reset, email verify)
│   ├── billing/                           # NEW — pure domain: tier rules, entitlements
│   │   ├── entitlements.ts                # canAccessDay, canAccessExam, freeDayLimit=3, freeQuestionLimit=15
│   │   └── subscription-status.ts         # map Paddle status → internal "active"|"trialing"|"past_due"|"canceled"
│   ├── infra/                             # NEW — all vendor SDK code lives here, nowhere else
│   │   ├── paddle/
│   │   │   ├── client.ts                  # getPaddleInstance() singleton
│   │   │   ├── checkout.ts                # createCheckoutUrl() server-side helper
│   │   │   └── webhook.ts                 # unmarshal() + event-type dispatcher (pure IO)
│   │   ├── google/
│   │   │   └── oauth-client.ts            # OAuth2Client factory, generateAuthUrl, getToken, verifyIdToken
│   │   ├── resend/
│   │   │   ├── client.ts                  # Resend instance singleton
│   │   │   ├── send.ts                    # sendEmail() Result<void, EmailError> wrapper
│   │   │   └── templates/                 # React Email components
│   │   │       ├── password-reset.tsx
│   │   │       ├── email-verification.tsx
│   │   │       └── welcome.tsx
│   │   └── log/
│   │       └── pino.ts                    # structured logger (existing planned dep)
│   ├── db/
│   │   └── models/
│   │       ├── user.ts                    # EXTEND — role, googleSub, emailVerifiedAt, paddleCustomerId, pwResetTokenHash, emailVerifyTokenHash
│   │       ├── subscription.ts            # NEW — paddleSubscriptionId unique, userId ref, status, priceId, currentPeriodEnd
│   │       └── webhookEvent.ts            # NEW — eventId unique (idempotency), receivedAt, eventType, processed
│   ├── dto/
│   │   ├── user.ts                        # EXTEND — UserPublic adds role, emailVerified, subscriptionStatus
│   │   ├── subscription.ts                # NEW — SubscriptionPublic
│   │   └── audit.ts                       # NEW — AuditPublic (redact IP beyond /24, redact UA hash)
│   └── validation/
│       └── schemas.ts                     # EXTEND — ResetRequestSchema, ResetConfirmSchema, OAuthCallbackSchema, PaddleCheckoutSchema
```

**Structure rationale:**

- **`lib/infra/` is the single vendor SDK sink.** Paddle, Google, Resend live here, nowhere else. This keeps `lib/domain/` deterministic and unit-testable, and makes swapping providers (Paddle → Stripe) a single-folder rewrite rather than a codebase grep.
- **`lib/guards/` centralizes authorization.** Today `requireSession()` lives in `auth/session.ts`. As guards multiply (`requireTier`, `requireRole`, `requireDayAccess`), a dedicated folder prevents `auth/` from becoming a dumping ground and makes the authorization surface discoverable.
- **`lib/billing/` is pure domain, no SDK.** Tier rules and entitlements are business logic, not Paddle-specific. They read `user.tier` + `subscription.status` and return `Result<Access, Denial>`. Paddle is the source that populates the state, but the rules survive a vendor change.
- **`(admin)` is a distinct route group**, not nested inside `(app)`. It mirrors the existing `(auth)` / `(app)` convention — layouts handle the auth+role check, not middleware.
- **`api/webhooks/paddle/route.ts` is a route handler, not a server action.** Server actions don't give you the raw request body; route handlers do. This file is the ONLY new route handler — everything else stays in server actions.
- **`oauth/callback/route.ts` is also a route handler.** Callbacks need to read query parameters (`code`, `state`) from a GET request from Google, which server actions can't do.

---

## Concern-by-Concern Architecture

### 1. Paddle Billing

**Concern split:**

| Step | Layer | File | SDK-facing? |
|------|-------|------|-------------|
| Client-side checkout overlay | Presentation (client component) | `app/(app)/checkout/checkout-client.tsx` | Yes (`@paddle/paddle-js`, public client token) |
| Server-side checkout URL creation (if using hosted) | Application | `lib/actions/billing.ts` → `createCheckoutSession()` | No directly — calls infra |
| Paddle instance factory | Infrastructure | `lib/infra/paddle/client.ts` → `getPaddleInstance()` | Yes (`@paddle/paddle-node-sdk`) |
| Webhook route handler | Presentation (route handler) | `app/api/webhooks/paddle/route.ts` | No directly — delegates |
| Webhook verification + parse | Infrastructure | `lib/infra/paddle/webhook.ts` → `unmarshalEvent()` | Yes (`paddle.webhooks.unmarshal`) |
| Idempotency check | Application | inside route handler, via `WebhookEventModel` | No |
| Subscription persistence | Persistence | `lib/db/models/subscription.ts` | No |
| Tier sync rule | Domain | `lib/billing/subscription-status.ts` → `deriveTierFromStatus()` | No |
| User tier write | Application | inside route handler → `UserModel.updateOne({ _id: $eq userId }, { tier })` | No |

**Full data flow — Webhook receipt:**

```
Paddle → POST /api/webhooks/paddle
             ↓
   route.ts (runtime: "nodejs", dynamic: "force-dynamic")
    1. const signature = req.headers.get("paddle-signature")
    2. const raw = await req.text()           // RAW body, never .json()
    3. unmarshalEvent(raw, secret, signature) // lib/infra/paddle/webhook.ts
       → Paddle SDK verifies HMAC SHA256 of `ts:body` against h1
       → returns EventEntity | throws
    4. WebhookEventModel.findOne({ eventId: $eq event.eventId })
       → if found and processed=true → return 200 (idempotent ack)
    5. WebhookEventModel.create({ eventId, eventType, receivedAt, processed: false })
    6. switch (event.eventType):
        case "subscription.created":
        case "subscription.updated":
          → derive tier via lib/billing/subscription-status.ts
          → upsert SubscriptionModel by { paddleSubscriptionId }
          → UserModel.updateOne({ _id: $eq userId }, { tier })
          → auditLog("subscription_synced", { userId, status })
        case "subscription.canceled":
          → set tier="free"
        case "transaction.completed":
          → audit only, nothing to sync
    7. WebhookEventModel.updateOne({ eventId: $eq eventId }, { processed: true })
    8. return Response.json({ ok: true }, { status: 200 })
    
   On any error before step 7: return 500 → Paddle retries per its 3-day retry schedule.
```

**Critical raw-body rule (verified from Paddle Next.js starter kit):**

```typescript
// app/src/app/api/webhooks/paddle/route.ts
export const runtime = "nodejs";              // NOT edge — Vercel edge may re-encode
export const dynamic = "force-dynamic";       // no caching, ever

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const raw = await request.text();           // MUST be .text() — not .json()
  if (!signature || !raw) return json({ error: "missing" }, 400);

  const result = await unmarshalEvent(raw, env.PADDLE_WEBHOOK_SECRET, signature);
  if (isErr(result)) return json({ error: "invalid_signature" }, 400);
  // ... idempotency + dispatch
}
```

The `.text()` call is load-bearing. Calling `.json()` first consumes the body and mutates encoding; signature verification will fail every time. The Paddle SDK's `unmarshal()` handles the HMAC comparison with a timing-safe compare internally.

**Idempotency model:**

```typescript
// lib/db/models/webhookEvent.ts
const WebhookEventSchema = new Schema({
  eventId:   { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true },
  receivedAt:{ type: Date, default: Date.now, index: true },
  processed: { type: Boolean, default: false },
  error:     { type: String, default: null },
}, { timestamps: true });

// TTL: keep 7 days for dedupe window, then auto-purge.
WebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });
```

Paddle events include `event_id` (top-level) — verified via SDK `EventEntity.eventId`. That field is the idempotency key. The unique index makes duplicate inserts fail fast; the route handler catches the `MongoServerError: E11000` and returns 200 (already processed). This is the **native-database idempotency pattern** — no application-level lock needed.

**Retry semantics (verified from Paddle docs):** Paddle retries non-200 responses on an escalating schedule up to 3 days. The 7-day TTL on webhookEvent gives a 4-day safety margin.

**Checkout flow (client → server):**

```
User on /pricing clicks "Upgrade"
    ↓
Presentation: /app/(app)/checkout/page.tsx (server component)
    - requireSession()
    - loads userEmail for prefill
    - renders <CheckoutClient priceId={PADDLE_PRO_PRICE_ID} userEmail={...} />
    ↓
Presentation: checkout-client.tsx ("use client")
    - initializePaddle({ token: NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, env, eventCallback })
    - paddle.Checkout.open({ items, customer: { email } })
    - eventCallback fires on complete → setState + route to /checkout/success
    ↓
    (meanwhile, asynchronously)
Paddle backend → webhook → /api/webhooks/paddle → tier sync → user.tier = "pro"
    ↓
/checkout/success page polls once or uses server component with no-cache to read fresh user.tier from Mongo
```

**Key insight:** The success page **must not trust** the Paddle.js completion event alone to mark a user as pro. The tier is updated by the webhook only, so the success page re-reads the DB. If the webhook hasn't landed yet (rare, sub-second typical), the page shows "activating your subscription…" and refreshes every 2s up to 30s. This prevents a user from getting pro access without a webhook-verified payment.

**Paddle SDK import placement:**
- `@paddle/paddle-node-sdk` → only imported in `lib/infra/paddle/*.ts`. Never in actions, domain, or models.
- `@paddle/paddle-js` → only imported in client components under `app/(app)/checkout/*.tsx`. Never in server-side code.
- This separation ensures tree-shaking works and bundle size stays clean; server SDK never leaks to the client bundle.

---

### 2. Google OAuth

**Concern split:**

| Step | Layer | File | SDK-facing? |
|------|-------|------|-------------|
| OAuth client factory | Infrastructure | `lib/infra/google/oauth-client.ts` | Yes (`google-auth-library`) |
| State + PKCE verifier generation | Domain | `lib/auth/oauth/state.ts` | No |
| State cookie storage | Domain | `lib/auth/oauth/state.ts` (uses `cookies()` from Next) | No |
| Start URL generation (server action) | Application | `lib/actions/auth.ts` → `oauthStart()` | No directly — calls infra |
| Callback handler | Presentation (route handler) | `app/(app)/oauth/callback/route.ts` | No directly — orchestrates |
| Token exchange + ID verification | Infrastructure | `lib/infra/google/oauth-client.ts` | Yes |
| Link-to-existing-account decision | Domain | `lib/auth/oauth/link.ts` | No |
| Account create/link + session set | Application | called from the callback route handler | No |

**Full data flow — Google OAuth signup/login:**

```
User on /login clicks "Continue with Google"
    ↓
Presentation: <form action={oauthStart}>           (uses Next's server action)
    ↓
Application: lib/actions/auth.ts → oauthStart()
    1. crypto.randomBytes → state, codeVerifier
    2. codeChallenge = SHA256(codeVerifier) base64url
    3. cookies().set("oauth_state", state, httpOnly=true, sameSite="lax", maxAge=600)
       cookies().set("oauth_pkce", codeVerifier, httpOnly=true, sameSite="lax", maxAge=600)
       // sameSite="lax" is REQUIRED here (strict blocks the Google → callback redirect)
    4. url = infra/google/oauth-client → generateAuthUrl({
          scope: ["openid","email","profile"],
          access_type: "online",
          prompt: "select_account",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
       })
    5. redirect(url)
    ↓
Google auth → user consents → 302 to
    GET /oauth/callback?code=...&state=...
    ↓
Presentation: app/(app)/oauth/callback/route.ts    (route handler, NOT server action)
    export const runtime = "nodejs";
    export async function GET(req: NextRequest) {
      1. const code = url.searchParams.get("code")
         const state = url.searchParams.get("state")
      2. Zod parse via OAuthCallbackSchema
      3. storedState = cookies().get("oauth_state")?.value
         storedVerifier = cookies().get("oauth_pkce")?.value
         if (!storedState || storedState !== state) → redirect("/login?e=oauth_state")
         cookies().delete("oauth_state")
         cookies().delete("oauth_pkce")                  // single-use
      4. tokens = infra/google → getToken(code, codeVerifier=storedVerifier)
      5. payload = infra/google → verifyIdToken(tokens.id_token, audience=GOOGLE_CLIENT_ID)
         → { sub, email, email_verified, name, picture }
         if (!email_verified) → redirect("/login?e=email_unverified")
      6. Mongo lookup:
         existingBySub = UserModel.findOne({ googleSub: $eq payload.sub })
         if (existingBySub): return existingBySub  // normal login
         existingByEmail = UserModel.findOne({ email: $eq normalize(payload.email) })
         if (existingByEmail):
           → domain rule (lib/auth/oauth/link.ts → shouldLinkAutomatically):
             if existingByEmail.emailVerifiedAt !== null  // already proved ownership
                AND existingByEmail.googleSub === null
             then: link (UserModel.updateOne → googleSub=payload.sub, emailVerifiedAt=now)
             else: redirect("/login?e=link_required") → show "we found an account,
                   sign in with password first, then link from Settings"
         else: create new user (tier: free, emailVerifiedAt: now, googleSub, passwordHash: null)
      7. Set iron-session (same shape as signup/login)
      8. audit("oauth_login" | "oauth_signup" | "oauth_linked")
      9. redirect("/dashboard")
    }
```

**Why route handler, not server action, for the callback:** Google redirects the user's browser to the callback URL with `code` and `state` in query params. Server actions are POST-only and invoked from the app; they cannot be the target of a third-party GET redirect. Route handlers natively support GET.

**State + PKCE cookie placement:**

- `oauth_state` and `oauth_pkce` are **single-purpose transient cookies**, not iron-session fields. They must be `SameSite=Lax` (not Strict — Strict blocks the Google→callback cross-site redirect from setting them). They are HttpOnly, 10-minute expiry, and **deleted on first read** (single-use defense against replay).
- They do NOT go into iron-session because iron-session is `SameSite=Strict` by design (to protect the authenticated session cookie). Mixing SameSite modes in one session cookie is not possible.
- PKCE is used **in addition to** the client secret (Google is a confidential client) because the `lib/auth/oauth/state.ts` module also serves as the template for future public-client OAuth providers (GitHub, etc.) and keeps the shape consistent. It's also defense-in-depth against code interception at the redirect URI.

**Link-to-existing-account flow:**

The domain rule lives in `lib/auth/oauth/link.ts` — a pure function, testable without any SDK:

```typescript
export type LinkDecision =
  | { kind: "login"; user: UserDoc }
  | { kind: "signup"; profile: GoogleProfile }
  | { kind: "autolink"; user: UserDoc }
  | { kind: "require-manual-link"; userId: string };

export const decideLink = (
  existingBySub: UserDoc | null,
  existingByEmail: UserDoc | null,
  profile: GoogleProfile,
): LinkDecision => {
  if (existingBySub) return { kind: "login", user: existingBySub };
  if (!existingByEmail) return { kind: "signup", profile };
  // Auto-link only if the existing password account already proved email
  // ownership via email verification, AND no google link exists yet.
  if (existingByEmail.emailVerifiedAt && !existingByEmail.googleSub) {
    return { kind: "autolink", user: existingByEmail };
  }
  return { kind: "require-manual-link", userId: existingByEmail._id.toString() };
};
```

This rule is unit-testable with fixtures, and the callback route handler is a thin coordinator that calls it. The threat model cares: auto-linking an unverified password account to a Google sub would let an attacker who signs up with someone's email first intercept the eventual OAuth login. The `emailVerifiedAt !== null` gate closes that hole.

**google-auth-library boundary:** The SDK (`OAuth2Client`, `verifyIdToken`, `getToken`) is imported **only** in `lib/infra/google/oauth-client.ts`. The domain file `lib/auth/oauth/state.ts` only touches Node `crypto` and `next/headers`, keeping it unit-testable and vendor-agnostic.

---

### 3. Tier Gating

**The right abstraction: a composable guard in `lib/guards/` + a domain rule in `lib/billing/`.**

**Why not page-level middleware:** Middleware runs on the edge, has no DB access (or very awkward DB access), and — per this project's explicit CVE-2025-29927 discipline — **middleware is already banned from doing auth**. Same rule applies to authorization: middleware is for headers only.

**Why not gate in the content module itself:** Content (`lib/content/days.ts`) is pure static data. Mixing authorization logic into data-land breaks SRP and makes the curriculum untestable without a session context.

**Why a guard in `lib/guards/`:** Guards are composable, testable in isolation, and match the existing `requireSession()` pattern. They throw a redirect on denial (which Next.js handles cleanly) or return `ok`. They're invoked in **every** place data is served: server actions AND server-component pages (which is where the current bug lives — the gate is in the action but not the page).

**Domain rule (pure function, no session):**

```typescript
// lib/billing/entitlements.ts
export const FREE_DAY_LIMIT = 3;
export const FREE_QUESTION_LIMIT = 15;

export type Access =
  | { ok: true }
  | { ok: false; reason: "tier_required"; required: "pro"; upgradeUrl: "/pricing" };

export const canAccessDay = (tier: "free" | "pro", day: number): Access =>
  tier === "pro" || day <= FREE_DAY_LIMIT
    ? { ok: true }
    : { ok: false, reason: "tier_required", required: "pro", upgradeUrl: "/pricing" };

export const canAccessExam = (tier: "free" | "pro"): Access =>
  tier === "pro"
    ? { ok: true }
    : { ok: false, reason: "tier_required", required: "pro", upgradeUrl: "/pricing" };
```

**Guard (session-aware, coordinator):**

```typescript
// lib/guards/require-day-access.ts
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/guards/require-session";
import { UserModel } from "@/lib/db/models/user";
import { canAccessDay } from "@/lib/billing/entitlements";

export const requireDayAccess = async (day: number): Promise<{ userId: string; tier: "free" | "pro" }> => {
  const session = await requireSession();  // throws redirect → /login on no session
  const user = await UserModel.findOne({ _id: { $eq: session.userId } })
    .select("tier")
    .lean();
  if (!user) redirect("/login");
  const access = canAccessDay(user.tier, day);
  if (!access.ok) redirect(access.upgradeUrl);
  return { userId: session.userId, tier: user.tier };
};
```

**Where it's called:**

1. **Page-level (fixes the known bug):**
   ```typescript
   // app/(app)/course/[day]/page.tsx
   export default async function CoursePage({ params }: { params: Promise<{ day: string }> }) {
     const { day } = await params;
     const dayNum = Number(day);
     await requireDayAccess(dayNum);   // ← gate BEFORE rendering lesson content
     const content = getDay(dayNum);
     return <CoursePlayer day={content} />;
   }
   ```

2. **Action-level (keeps existing protection):**
   ```typescript
   // lib/actions/progress.ts → saveAnswer
   export const saveAnswer = async (input: SaveAnswerInput) => {
     const parsed = SaveAnswerSchema.safeParse(input);
     if (!parsed.success) return err("invalid_input");
     const gate = await requireDayAccess(parsed.data.day);  // ← same guard, same result
     // ... upsert progress
   };
   ```

**Why the same guard runs twice (page AND action):** Defense in depth. Page guard prevents a free user from even loading lesson 4's HTML. Action guard prevents a free user from spoofing the `day` parameter in a direct POST to the saveAnswer action. Both layers agree on the same domain rule (`canAccessDay`), so there's no rule drift.

**Free-tier days 1–3 enforcement:** `FREE_DAY_LIMIT = 3` is a single constant in `lib/billing/entitlements.ts`. The number is not hardcoded anywhere else. Changing the free window to 5 days is a one-line change + a test update.

**Other guards:**

- `requireTier("pro")` — generic, for pages like `/exam`, `/analytics`.
- `requireRole("admin")` — for `(admin)` route group layout.
- `requireEmailVerified()` — for sensitive actions like password change.

All four guards follow the same shape: `async () => Promise<SessionContext>`, throw redirect on denial, return context on success. They compose (a layout can call `requireRole` which calls `requireSession` internally).

---

### 4. Email via Resend

**Concern split:**

| Step | Layer | File |
|------|-------|------|
| Resend client factory | Infrastructure | `lib/infra/resend/client.ts` (singleton from `env.RESEND_API_KEY`) |
| Send wrapper | Infrastructure | `lib/infra/resend/send.ts` → `sendEmail(): Result<SentId, EmailError>` |
| Templates (React components) | Infrastructure | `lib/infra/resend/templates/*.tsx` |
| Token generation + hash | Domain | `lib/auth/tokens.ts` — pure, no SDK |
| Trigger from action | Application | `lib/actions/auth.ts` — calls infra after DB write |

**Canonical pattern (verified from Resend docs and React Email integration):**

```typescript
// lib/infra/resend/send.ts
import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Result } from "@/lib/result";
import { ok, err } from "@/lib/result";

const resend = new Resend(env.RESEND_API_KEY);

export type EmailError = "rate_limited" | "invalid_recipient" | "provider_error";

export const sendEmail = async (params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<Result<{ id: string }, EmailError>> => {
  try {
    const res = await resend.emails.send({
      from: env.RESEND_FROM_ADDRESS, // "CEH Prep <noreply@domain.tld>"
      to: params.to,
      subject: params.subject,
      react: params.react,
    });
    if (res.error) return err("provider_error");
    return ok({ id: res.data!.id });
  } catch {
    return err("provider_error");
  }
};
```

**Template isolation:** React Email templates are pure components in `lib/infra/resend/templates/`. They are server-rendered by Resend (Resend accepts `react` directly). No imperative template engine, no string concatenation — React is the template engine.

**Queueing / retry:** V1 does not introduce a job queue. Resend has its own retry on transient provider errors. For CEH Prep's scale (< 10k users projected for the foreseeable future), **the pragmatic retry pattern is: fire-and-forget with audit log on failure.** If `sendEmail()` returns `err`, the action logs `email_send_failed` to audit and returns the happy path to the user anyway (password reset: "if an account exists, check your email" — don't leak send failures). The user can request again. A job queue is a premature optimization to be revisited only if email failure rates exceed 0.5%.

**Token-carrying emails (password reset, email verification):**

```
Application: lib/actions/auth.ts → passwordResetRequest(email)
    1. parse schema
    2. lookup user (constant-time: always generate token even if user missing)
    3. rawToken = crypto.randomBytes(32).toString("base64url")
       tokenHash = sha256(rawToken)
       UserModel.updateOne({ _id }, { pwResetTokenHash: tokenHash, pwResetExpiresAt: +1h })
    4. sendEmail({ to, subject, react: <PasswordResetEmail link=${APP_URL}/reset-password/${rawToken} /> })
    5. audit("pw_reset_requested"); always return ok (no enumeration)
```

The **raw token is never stored**; only its hash. Verification computes the hash from the presented token and matches. Same pattern as Argon2 for passwords, reused for short-lived single-use tokens. The helper lives in `lib/auth/tokens.ts` — pure, no SDK, unit-testable.

---

### 5. Audit Log Admin View

**Route location:** New route group `app/(admin)/admin/audit/page.tsx`. Parallel to `(auth)` and `(app)`, not nested inside `(app)`.

**Why a separate route group:**
- Keeps admin UI visually and logically distinct (can have its own shell, sidebar, table-dense layout)
- Layout-level auth+role check happens once (`requireRole("admin")`), not per-page
- Different nav, different typography density, no leakage of admin UI into the regular authenticated shell

**RBAC placement — layout, not page:**

```typescript
// app/(admin)/layout.tsx
import { requireRole } from "@/lib/guards/require-role";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");  // redirects to /dashboard on deny
  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

`requireRole("admin")` is a thin composition: `requireSession()` → fetch user → check `user.role === "admin"` → redirect or return. The same rule that's in the session guard, extended with a role check.

**How `admin` role is assigned (v1):** Manually, via a bootstrap migration script. `scripts/set-admin.ts` takes an email and flips `user.role = "admin"`. There is no "promote to admin" UI — admins are set server-side only, and the count is expected to be 1 (the founder). An admin-promotion UI is a v2 feature.

**Data flow — listing audit events:**

```
Presentation: app/(admin)/admin/audit/page.tsx (server component)
    1. (layout already ran requireRole("admin"))
    2. read ?cursor= ?limit= from searchParams
    3. call lib/actions/admin.ts → listAuditEvents({ cursor, limit })
    4. render <AuditTable events={result.events} />
    ↓
Application: lib/actions/admin.ts → listAuditEvents()
    "use server";
    1. await requireRole("admin")           // defense in depth — duplicate of layout check
    2. parse cursor via Zod
    3. query = AuditModel.find(cursor ? { _id: { $lt: ObjectId(cursor) } } : {})
                         .sort({ _id: -1 })
                         .limit(limit)
                         .lean()
    4. events.map(toPublicAudit)            // DTO: redact IP to /24, hash UA
    5. return { events: mapped, nextCursor }
```

**Critical DTO:** `toPublicAudit` in `lib/dto/audit.ts` **must not** leak full client IPs or User-Agents. Audit admin view shows partial IP (`203.0.113.0/24`) and a stable hash of UA. Full PII stays in Mongo for forensic reasons (admin can query directly if subpoenaed), but the UI layer never sees it. This follows the existing allowlist DTO pattern.

**Why `requireRole` is called twice (layout and action):** Same rationale as tier gating. The layout stops page render; the action stops direct invocation. Both layers call the same domain rule, so no drift.

---

### 6. Webhook Endpoints

**Pattern: route handler with `runtime = "nodejs"`, raw-body via `request.text()`, timing-safe HMAC via Paddle SDK.**

**File:** `app/src/app/api/webhooks/paddle/route.ts` — the ONLY new route handler in the project. Every other new endpoint is a server action or route group page.

**Required export flags:**

```typescript
export const runtime = "nodejs";          // NOT edge — Vercel edge proxies may re-encode body
export const dynamic = "force-dynamic";   // no caching, no ISR, every request hits this handler
export const fetchCache = "force-no-store";
```

**Pattern verified against Paddle's official Next.js starter kit (`paddle-nextjs-starter-kit/src/app/api/webhook/route.ts`):**

1. `const signature = request.headers.get("paddle-signature") ?? ""`
2. `const raw = await request.text()` — **first**, before any other body access
3. `paddle.webhooks.unmarshal(raw, secret, signature)` — SDK handles HMAC compare internally (timing-safe)
4. Dispatch on `eventData.eventType`
5. Return `Response.json({ ok: true }, { status: 200 })` on success, 4xx on verification failure (Paddle will not retry), 5xx on processing failure (Paddle will retry)

**Status code contract with Paddle:**

| Response | Paddle behavior |
|----------|-----------------|
| 2xx | Acknowledged, no retry |
| 4xx | **No retry** — use only for permanent failures (bad signature, malformed) |
| 5xx or timeout | Retry on exponential backoff up to 3 days |

**Do not return 4xx for an unknown event type** — that would prevent future events Paddle adds. Unknown events return 200 with `{ ok: true, ignored: true }` and log a warning.

**Rate limiting the webhook endpoint:** The existing in-proc LRU rate limiter is applied per-IP to `/api/webhooks/paddle`, but with a **high limit** (1000/min) and only as a DDoS dampener. Paddle's own IPs are not pinned because Paddle doesn't publish a stable IP range. The signature check is the real gate — rate limit is just a safety net against unauthenticated flood.

**Webhook security checklist (used during phase planning):**
- [x] Runtime = nodejs, not edge
- [x] Raw body via `.text()`, never `.json()` before verify
- [x] HMAC via Paddle SDK (handles timing-safe compare)
- [x] Idempotency key = Paddle `event_id`, stored with unique index
- [x] TTL on webhookEvent collection ≥ 4 days (Paddle retries up to 3 days)
- [x] 5xx only for retryable errors, 2xx for handled + already-processed
- [x] Audit log every webhook outcome (processed, deduped, failed)
- [x] No response body with sensitive data (sanitized event name only)

---

## Data Model Changes Summary

```typescript
// UserDoc additions
role: "user" | "admin";                  // default "user"; admin set via bootstrap script
googleSub: string | null;                // unique sparse index
emailVerifiedAt: Date | null;
paddleCustomerId: string | null;         // unique sparse index
pwResetTokenHash: string | null;
pwResetExpiresAt: Date | null;
emailVerifyTokenHash: string | null;
emailVerifyExpiresAt: Date | null;
// passwordHash: string | null           // made nullable for OAuth-only accounts

// SubscriptionDoc (new)
paddleSubscriptionId: string;            // unique
userId: ObjectId;                        // indexed
paddleCustomerId: string;
status: "active" | "trialing" | "past_due" | "canceled" | "paused";
priceId: string;
currentPeriodEnd: Date;
scheduledChangeAt: Date | null;
createdAt: Date;
updatedAt: Date;

// WebhookEventDoc (new)
eventId: string;                         // unique — Paddle event_id
eventType: string;
receivedAt: Date;                        // TTL index 7d
processed: boolean;
error: string | null;
```

All new queries that filter by `userId`, `email`, `googleSub`, `paddleCustomerId`, `eventId` use the `$eq` wrapping already enforced by convention — this is not optional, it's the house style.

---

## Ownership & Authorization Check Placement

| Surface | Check placed at | Rule |
|---------|----------------|------|
| Protected page render | Layout file (`(app)/layout.tsx`, `(admin)/layout.tsx`) | `requireSession()` or `requireRole("admin")` |
| Tier-gated page render | Page file (e.g., `course/[day]/page.tsx`) | `requireDayAccess(day)` |
| Server action (all) | Top of action body | `requireSession()`, then content-specific guard |
| Route handler (webhook) | N/A — signature is the auth | Paddle signature verification |
| Route handler (OAuth callback) | Inside handler | State cookie check + idempotency |
| Admin action | Top of action body | `requireRole("admin")` |
| Mongo query | Inside query filter | `{ userId: { $eq: session.userId } }` — always |

**Rule:** Authorization checks run **at every boundary**, never once "at the top". Layout checks do not exempt page checks from also running if the page serves tier-gated data. Action checks do not exempt Mongo filters from also scoping by userId. The cost is a few extra session reads per request (cheap — it's a cookie decrypt, not a DB round-trip); the benefit is that a single missed check doesn't cascade into a breach.

---

## Request Flow Summary (Key New Flows)

**Signup via Google:**
```
/login → [Continue with Google] → oauthStart action
  → generate state+PKCE, set lax cookies → redirect to Google
  → user consents → Google GET /oauth/callback?code&state
  → route handler: verify state, exchange code, verify ID token
  → decideLink(): signup path
  → UserModel.create({ email, googleSub, tier: "free", emailVerifiedAt: now })
  → iron-session set → redirect /dashboard
  → audit("oauth_signup")
```

**Upgrade to pro:**
```
/pricing → [Upgrade] → /checkout page (requireSession)
  → CheckoutClient ("use client") → initializePaddle → Checkout.open
  → user pays → Paddle sends event → /api/webhooks/paddle
  → route handler: verify signature, dedupe by eventId, upsert subscription
  → UserModel.updateOne → tier: "pro"
  → (meanwhile) CheckoutClient eventCallback → redirect /checkout/success
  → /checkout/success → server component reads user.tier → if still "free", poll every 2s
  → audit("subscription_synced")
```

**Free user hits day 4:**
```
GET /course/4 → (app)/layout.tsx → requireSession() ✓
  → course/[day]/page.tsx → requireDayAccess(4)
  → lookup user.tier = "free" → canAccessDay("free", 4) = { ok: false, upgradeUrl: "/pricing" }
  → redirect("/pricing")
  → audit("tier_denied", { day: 4 })
```

**Password reset:**
```
/reset-password form → passwordResetRequest(email) action
  → lookup user (constant-time) → generate raw token + store hash + expiry
  → sendEmail({ to, react: <PasswordResetEmail link=... /> })
  → return { ok: true } ALWAYS (no enumeration)
  → user clicks link → /reset-password/[token]/page.tsx
  → passwordResetConfirm({ token, newPassword }) action
  → parse schema → zxcvbn → HIBP → hash token → match → verify expiry
  → update passwordHash, clear token fields → audit("pw_reset_completed")
  → redirect /login
```

**Admin views audit log:**
```
GET /admin/audit → (admin)/layout.tsx → requireRole("admin") ✓
  → page.tsx → listAuditEvents({ cursor, limit }) action
  → action: requireRole("admin") again (defense in depth)
  → query AuditModel with cursor pagination
  → map to AuditPublic DTO (redact IP, hash UA)
  → render table
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Importing Paddle SDK outside `lib/infra/paddle/`
**Why wrong:** Couples domain logic to vendor. A switch to Stripe becomes a codebase-wide refactor.
**Do instead:** All Paddle SDK calls behind `lib/infra/paddle/*.ts`. Actions call infra, never SDK directly.

### Anti-Pattern 2: Trusting Paddle.js client event for tier upgrade
**Why wrong:** Client events can be forged. Only the signed server webhook is authoritative.
**Do instead:** Client event only redirects to `/checkout/success`. Tier is set by webhook. Success page re-reads DB.

### Anti-Pattern 3: Calling `request.json()` before signature verify
**Why wrong:** Consumes body, mutates encoding, breaks HMAC match.
**Do instead:** `const raw = await request.text()` FIRST. Parse only after verification.

### Anti-Pattern 4: OAuth state in iron-session
**Why wrong:** iron-session is `SameSite=Strict`; Google cross-site redirect can't set it.
**Do instead:** Dedicated single-use `SameSite=Lax` cookie for `oauth_state` + `oauth_pkce`, deleted on first read.

### Anti-Pattern 5: Auto-linking Google login to an unverified password account
**Why wrong:** Account takeover via email squatting. Attacker signs up with target's email, never verifies, waits for target to OAuth.
**Do instead:** Auto-link only if `emailVerifiedAt !== null`. Otherwise require manual link from Settings.

### Anti-Pattern 6: Tier gate in action only, not in page
**Why wrong:** Free user loads /course/4 HTML, sees lesson content, even if save-answer is blocked. (This is the current bug.)
**Do instead:** `requireDayAccess()` in BOTH page.tsx AND the action. Same rule, two call sites.

### Anti-Pattern 7: Middleware-based auth or tier check
**Why wrong:** CVE-2025-29927 and friends. This project already banned it; don't backslide.
**Do instead:** Layouts and actions. Middleware is for headers only.

### Anti-Pattern 8: Webhook endpoint runs on Vercel Edge
**Why wrong:** Edge proxies may re-encode the body. HMAC match becomes flaky.
**Do instead:** `export const runtime = "nodejs"` on the webhook route handler.

### Anti-Pattern 9: Missing TTL on webhookEvent collection
**Why wrong:** Idempotency table grows unbounded. Eventually slow queries, index bloat.
**Do instead:** `expireAfterSeconds: 7 * 24 * 60 * 60` (7 days, > Paddle's 3-day retry window).

### Anti-Pattern 10: Returning 4xx for unknown webhook event types
**Why wrong:** Paddle will not retry, and future event types ship without warning.
**Do instead:** 200 + log warning. Unknown is not an error.

---

## Integration Points

### External Services

| Service | Integration Pattern | SDK import allowed in |
|---------|---------------------|-----------------------|
| Paddle Billing (server) | `lib/infra/paddle/client.ts` singleton; unmarshal in webhook | `lib/infra/paddle/*` only |
| Paddle.js (browser) | `initializePaddle()` in `"use client"` component | `app/(app)/checkout/*.tsx` only |
| Google OAuth | `OAuth2Client` factory in `lib/infra/google/oauth-client.ts` | `lib/infra/google/*` only |
| Resend | `Resend` instance singleton + React Email templates | `lib/infra/resend/*` only |
| HIBP | Existing — `lib/auth/hibp.ts` (keep as-is) | `lib/auth/hibp.ts` only |
| MongoDB Atlas | Existing — `lib/db/mongo.ts` connection pool | `lib/db/*` only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Presentation ↔ Application | Server actions (POST) and route handlers (GET for OAuth callback + POST for webhook) | Actions return `Result<T, E>` or `ActionState`; handlers return `Response` |
| Application ↔ Domain | Direct function calls (in-process) | Domain functions are pure, no IO |
| Application ↔ Infra | Direct function calls returning `Result<T, InfraError>` | Infra isolates vendor SDKs |
| Application ↔ Persistence | Mongoose model methods with `$eq`-wrapped queries | Always scoped by userId or explicit admin permission |
| Webhook handler ↔ Persistence | Direct Mongoose, no action layer | Webhook is its own entry point — skips action indirection because it has no user session |

---

## Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| 0–1k users | Current architecture is fine. In-proc LRU rate limiter, single Mongo Atlas M0. |
| 1k–10k users | Upgrade Mongo Atlas to M10. Swap LRU rate limiter → Redis (the interface in `lib/auth/rate-limit.ts` is already Redis-swappable). Consider moving webhook idempotency dedupe to Redis `SETNX` for faster ack. |
| 10k–100k users | Email via Resend becomes a paid tier (> 100 emails/day exceeds free). Webhook handler may need a queue (BullMQ) if processing takes > 10s. Admin audit view needs server-side pagination (already cursor-based) and possibly a separate read replica. |
| 100k+ users | Outside current scope. At this scale, consider splitting `/api/webhooks/paddle` into its own service to isolate payment critical path from app restarts. |

### Scaling Priorities

1. **First bottleneck:** LRU rate limiter (in-proc) blocks horizontal scale. Already designed as a swappable interface — one day's work to move to Redis.
2. **Second bottleneck:** Mongo M0 free tier caps at 512MB and low IOPS. Audit log grows fastest. Add TTL on audit events (90 days is typical) to cap growth before upgrade forced.
3. **Third bottleneck:** Resend free tier at 100/day emails. For password resets and verification, this caps daily signup + reset volume at ~50 unique users/day. Upgrade to paid ($20/mo for 50k/mo) well before hitting.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Paddle webhook pattern | HIGH | Verified against official Paddle Next.js starter kit source + Paddle developer docs |
| `.text()` raw body rule | HIGH | Multiple authoritative sources agree; Vercel edge re-encoding confirmed as real issue |
| OAuth state cookie SameSite=Lax | HIGH | Cross-site redirect + cookie behavior is well-defined in RFC 6265bis |
| google-auth-library usage | HIGH | Standard Google-published library, patterns stable since 2019 |
| Auto-link rule gating on emailVerifiedAt | MEDIUM | Security reasoning is sound, but no single authoritative source — reasoned from threat model |
| Tier guard abstraction (lib/guards/) | MEDIUM | Composition of existing project patterns; not a canonical "Next.js way", but matches project conventions |
| (admin) route group | MEDIUM | Next.js route groups are documented; RBAC placement in layout is community pattern, not official |
| Webhook idempotency via Mongo unique index | HIGH | Standard pattern, well-understood |
| Resend React Email templates | HIGH | Verified against Resend official docs |

---

## Sources

**Paddle Billing:**
- [Paddle webhook signature verification — developer.paddle.com](https://developer.paddle.com/webhooks/signature-verification)
- [Paddle webhooks overview — developer.paddle.com](https://developer.paddle.com/webhooks/overview)
- [Paddle Node SDK — github.com/PaddleHQ/paddle-node-sdk](https://github.com/PaddleHQ/paddle-node-sdk)
- [Paddle Next.js starter kit (canonical reference code) — github.com/PaddleHQ/paddle-nextjs-starter-kit](https://github.com/PaddleHQ/paddle-nextjs-starter-kit) — webhook route handler at `src/app/api/webhook/route.ts` and processor at `src/utils/paddle/process-webhook.ts`
- [Handle provisioning and fulfillment — developer.paddle.com](https://developer.paddle.com/build/subscriptions/provision-access-webhooks)
- [Guide to Paddle webhooks best practices — hookdeck.com](https://hookdeck.com/webhooks/platforms/guide-to-paddle-webhooks-features-and-best-practices)
- [How to Implement Webhook Idempotency — hookdeck.com](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)

**Next.js webhook patterns:**
- [Next.js App Router Webhook Handler Testing Guide — webhooks.cc](https://webhooks.cc/blog/nextjs-app-router-webhook-handler)
- [Verify Stripe webhook signature in Next.js API Routes — maxkarlsson.dev](https://maxkarlsson.dev/blog/verify-stripe-webhook-signature-in-next-js-api-routes)
- [Next.js App Router + Stripe Webhook Signature Verification — medium.com/@kitson-broadhurst](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f)

**Google OAuth:**
- [google-auth-library-nodejs — github.com/googleapis/google-auth-library-nodejs](https://github.com/googleapis/google-auth-library-nodejs)
- [Using Google OAuth 2.0 with a custom backend in Next.js — dev.to](https://dev.to/udassi/using-google-oauth-20-with-a-custom-backend-in-nextjs-596d)
- [Tutorial: Google OAuth in Next.js — lucia-auth.com](https://lucia-auth.com/tutorials/google-oauth/nextjs)
- [Adding Google Authentication in Next.js 14 with App Router — dev.to](https://dev.to/souravvmishra/adding-google-authentication-in-nextjs-14-with-app-router-a-beginner-friendly-guide-3ag)

**Resend + React Email:**
- [Send emails with Next.js — resend.com/nextjs](https://resend.com/nextjs)
- [Resend docs: Send with Next.js — resend.com/docs/send-with-nextjs](https://resend.com/docs/send-with-nextjs)
- [Send Emails from Next.js with Resend and React Email — dev.to](https://dev.to/thatanjan/send-emails-from-nextjs-with-resend-and-react-email-39fb)

**Tier gating / RBAC / auth patterns in Next.js 15:**
- [Next.js Authentication guide — nextjs.org/docs/app/guides/authentication](https://nextjs.org/docs/app/guides/authentication) — DAL and `verifySession()` pattern
- [Next.js Route Groups — nextjs.org/docs/app/api-reference/file-conventions/route-groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [Implement Role-Based Access Control in Next.js 15 — clerk.com/blog](https://clerk.com/blog/nextjs-role-based-access-control)
- [Auth.js Role Based Access Control — authjs.dev](https://authjs.dev/guides/role-based-access-control)

---

*Architecture research for: CEH Prep SaaS billing + OAuth + tier gating milestone*
*Researched: 2026-04-13*
