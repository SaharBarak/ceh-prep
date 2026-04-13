# Stack Research — Subsequent Milestone (New Integrations)

**Domain:** Next.js 15 App Router SaaS — adding billing, OAuth, email, structured logging, and test harness
**Researched:** 2026-04-13
**Overall confidence:** HIGH for all seven integrations (versions verified via npm registry search April 2026; integration patterns verified against current Paddle/Resend/Google/Vercel official docs; pitfalls cross-referenced against GitHub issues and community discussions)

**Hard constraint reminder.** The existing stack (Next.js 15.1.4, TypeScript 5.7.3, React 19, Mongoose 8.9.3, iron-session 8.0.4, @node-rs/argon2 2.0.2, Zod 3.24.1, Tailwind v4, Framer Motion 11, lru-cache 11, pino 9.5.0) is LOCKED. This document only covers the NEW surfaces.

---

## TL;DR — The Seven New Packages

| # | Surface | Package | Pinned version | Runtime | Confidence |
|---|---------|---------|----------------|---------|------------|
| 1a | Paddle server SDK | `@paddle/paddle-node-sdk` | `^3.6.0` | Node only (no Edge) | HIGH |
| 1b | Paddle client SDK | `@paddle/paddle-js` | `^1.4.4` | Browser (client component) | HIGH |
| 2 | Google OAuth server | `google-auth-library` | `^10.6.2` | Node only (no Edge) | HIGH |
| 3a | Resend API client | `resend` | `^6.1.0` | Node runtime | HIGH |
| 3b | React email templates | `@react-email/components` | `^0.5.x` (5.x family) | Build-time render | HIGH |
| 3c | React email render | `@react-email/render` | `^1.3.x` | Build-time render | HIGH |
| 4 | MongoDB Atlas driver | (already have `mongoose@8.9.3`) | — | Node only | HIGH |
| 5a | Unit tests | `vitest` | `^4.1.4` | Node | HIGH |
| 5b | React component tests | `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `vite-tsconfig-paths` | latest | Node | HIGH |
| 5c | E2E tests | `@playwright/test` | `^1.57.x` | Node | HIGH |
| 6 | Structured logging | (already have `pino@9.5.0`) — just wire it | — | Node runtime only | HIGH |
| 7a | Redis client | `@upstash/redis` | `^1.34.x` | Node + Edge | HIGH |
| 7b | Rate limiting | `@upstash/ratelimit` | `^2.0.8` | Node + Edge | HIGH |

Additional tiny utilities:
- `@paddle/paddle-js` — no peer deps; safe alongside React 19.
- `ms` (already transitive via many libs; if not present, use `Number` arithmetic for expiry math).
- `nanoid` (optional, for OAuth `state` / email verification tokens) — alternatively use `crypto.randomUUID()` which is built-in.

---

## 1. Paddle Billing v2

### Why Paddle over Stripe (user-mandated, but justified)

Paddle is a **Merchant of Record (MoR)** — they handle global sales tax/VAT, chargebacks, fraud, and invoicing on behalf of the seller. For a solo/small-team SaaS targeting a global student audience, this eliminates ~3 weeks of tax compliance work per launch region. Paddle's cut (~5% + 50¢) is the price paid for not operating an international tax practice.

Stripe is better when: you already have a legal entity in each region, you need fine-grained billing logic (usage-based, metered, complex proration), or you want direct card-brand relationships. None of those apply here.

### 1a. `@paddle/paddle-node-sdk@^3.6.0` — Server side

**What it does:** Typed wrapper over the Paddle Billing v2 REST API (customers, subscriptions, prices, products, webhooks). Replaces the legacy Paddle Classic SDKs.

**Runtime:** Node.js only. **Do NOT use in Edge runtime** — it uses `crypto` and `Buffer` in a way the Edge runtime rejects. Webhook route handler MUST declare `export const runtime = 'nodejs'`.

**Minimal install:**

```bash
npm install @paddle/paddle-node-sdk
```

**Client singleton (`app/src/lib/billing/paddle.ts`):**

```ts
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { env } from '@/lib/env';

// Singleton pattern — Paddle class is stateless/safe to share across requests.
export const paddle = new Paddle(env.PADDLE_API_KEY, {
  environment: env.NODE_ENV === 'production' ? Environment.production : Environment.sandbox,
});
```

**Webhook route handler (`app/src/app/api/webhooks/paddle/route.ts`):**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { paddle } from '@/lib/billing/paddle';
import { env } from '@/lib/env';
import { handlePaddleEvent } from '@/lib/billing/handler';

// CRITICAL: force Node runtime — the SDK uses Node crypto.
export const runtime = 'nodejs';
// Do not cache webhooks.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('paddle-signature');
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 });

  // MUST use .text() — not .json(). The signature is computed over the raw body bytes.
  const rawBody = await req.text();

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, env.PADDLE_WEBHOOK_SECRET, signature);
    // unmarshal() throws on invalid signature.
    await handlePaddleEvent(event); // Your idempotent handler — dedupe by event.eventId in Mongo.
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log but return 200 only if you want Paddle to stop retrying a permanently-bad payload.
    // Return 400 here so Paddle retries genuinely transient errors.
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
}
```

**Key subscription events to handle** (Paddle Billing v2):
- `subscription.created` — upsert Subscription, set user `tier = 'pro'`
- `subscription.updated` — sync `currentPeriodEnd`, `status`
- `subscription.canceled` — set `canceledAt`, keep `tier = 'pro'` until `currentPeriodEnd`
- `subscription.past_due` — mark dunning state
- `transaction.completed` — (optional) for one-off receipts

**Idempotency:** Every webhook event has a unique `eventId`. Store a `ProcessedEvent { _id: eventId, at: Date }` collection with a 30-day TTL index. On each webhook, attempt `insertOne` inside a try/catch — if it throws a `duplicate key`, short-circuit with 200 (already processed).

### 1b. `@paddle/paddle-js@^1.4.4` — Client side (checkout overlay)

**What it does:** Lightweight wrapper that loads `https://cdn.paddle.com/paddle/v2/paddle.js` and exposes a typed `Paddle.Checkout.open()` method. The overlay opens in an iframe on top of your page — user never leaves your domain visually.

**Runtime:** Browser only — must be inside a `'use client'` component.

**Minimal install:**

```bash
npm install @paddle/paddle-js
```

**Client hook (`app/src/lib/billing/use-paddle.ts`):**

```ts
'use client';

import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

export function usePaddle(): Paddle | null {
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  useEffect(() => {
    initializePaddle({
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!, // Public "client-side token", not the API key.
    }).then((instance) => setPaddle(instance ?? null));
  }, []);

  return paddle;
}
```

**Checkout trigger:**

```tsx
'use client';
import { usePaddle } from '@/lib/billing/use-paddle';

export function UpgradeButton({ priceId, userEmail }: { priceId: string; userEmail: string }) {
  const paddle = usePaddle();
  return (
    <button
      onClick={() =>
        paddle?.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customer: { email: userEmail },
          customData: { userId: 'server-side-user-id' }, // Read from session server-side and pass down.
        })
      }
      disabled={!paddle}
    >
      Upgrade to Pro
    </button>
  );
}
```

**CRITICAL security note:** The `customData.userId` round-trips through Paddle and comes back in the webhook. Do NOT trust it blindly — in the webhook handler, verify it matches a real user in your DB and cross-check against the `customer.email` Paddle sends.

### 1c. Paddle CSP implications (CRITICAL)

The current CSP in `app/next.config.ts` is `connect-src 'self'`. Paddle.js will 100% break. You must extend:

```ts
// Production-safe additions for Paddle:
script-src  'self' 'nonce-{nonce}' 'strict-dynamic' https://cdn.paddle.com https://*.paddle.com
connect-src 'self' https://*.paddle.com https://*.paddleapi.com https://checkout-service.paddle.com
frame-src   'self' https://*.paddle.com https://buy.paddle.com
img-src     'self' data: https://*.paddle.com
style-src   'self' 'unsafe-inline' https://*.paddle.com https://api.fontshare.com https://fonts.googleapis.com
```

Use **sandbox domain variant** in dev:
- `https://sandbox-buy.paddle.com`
- `https://sandbox-checkout-service.paddle.com`

A cleaner approach: use a wildcard `https://*.paddle.com` which covers both sandbox and production variants. Document this tradeoff in `next.config.ts`.

**Env vars to add:**

```
PADDLE_API_KEY=                    # pdl_live_... or pdl_sdbx_...  (server-only, secret)
PADDLE_WEBHOOK_SECRET=             # pdl_ntfset_... from the Notifications page
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=   # live_... or test_... (public, appears in browser bundle)
NEXT_PUBLIC_PADDLE_ENV=sandbox     # sandbox | production
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO=   # pri_... (for the $30/mo Pro plan)
```

All must be added to `app/src/lib/env.ts` Zod schema.

### 1d. Why NOT the alternatives

| Option | Verdict | Reason |
|--------|---------|--------|
| `paddle-sdk` (avaly) | Reject | Third-party, legacy Paddle Classic only, unmaintained for Billing v2. |
| `nodejs-paddle-sdk` (invertase) | Reject | Third-party; the official `@paddle/paddle-node-sdk` is now stable v1+ and maintained by Paddle. |
| Hand-rolled REST calls | Reject | Official SDK already handles webhook signature HMAC correctly; reinventing it is a security risk. |
| Stripe | Reject | User explicitly chose Paddle for MoR tax handling. |

---

## 2. Google OAuth 2.0 — Sign-in (no NextAuth)

### Why `google-auth-library`, not NextAuth/Auth.js

The codebase already owns the auth surface via iron-session + Argon2id. Layering NextAuth on top would:
1. Introduce a second session store (NextAuth JWT/DB) that fights with iron-session.
2. Hide the OAuth state/PKCE/nonce logic inside a plugin, weakening the security review the threat model requires.
3. Add ~40 MB of dependencies for ~200 lines of custom code.

`google-auth-library@^10.6.2` is the official Google-maintained Node client. It gives you `OAuth2Client` with first-class PKCE support and exposes a `verifyIdToken()` that validates the JWT signature against Google's JWKS.

### 2a. Install

```bash
npm install google-auth-library
```

**Runtime:** Node only — uses `crypto` primitives unavailable in Edge. The `/auth/google/*` routes must set `export const runtime = 'nodejs'`.

### 2b. Flow — Authorization Code + PKCE + State

**Step 1 — `/auth/google/authorize` route** (`app/src/app/auth/google/authorize/route.ts`):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const client = new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/auth/google/callback`,
  });

  // PKCE: generate a code_verifier and its S256 challenge.
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();

  // CSRF state: opaque random nonce bound to this browser session.
  const state = crypto.randomUUID();

  const authUrl = client.generateAuthUrl({
    access_type: 'online',                // We only need sign-in; no refresh token.
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',             // Let user pick account every time.
  });

  // Store verifier + state in short-lived httpOnly cookies (NOT the session).
  const res = NextResponse.redirect(authUrl);
  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
  res.cookies.set('oauth_state', state, cookieOpts);
  res.cookies.set('oauth_pkce', codeVerifier, cookieOpts);
  return res;
}
```

**Step 2 — `/auth/google/callback` route** (`app/src/app/auth/google/callback/route.ts`):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@/lib/env';
import { findOrCreateGoogleUser } from '@/lib/auth/google';
import { setSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const savedState = req.cookies.get('oauth_state')?.value;
  const codeVerifier = req.cookies.get('oauth_pkce')?.value;

  // Constant-time compare would be better but state is single-use — string equality is OK.
  if (!code || !returnedState || !savedState || returnedState !== savedState || !codeVerifier) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=oauth_state`);
  }

  const client = new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${env.NEXT_PUBLIC_APP_URL}/auth/google/callback`,
  });

  // Exchange code + verifier for tokens. PKCE prevents code interception.
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.id_token) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=oauth_notoken`);
  }

  // Verify the ID token signature against Google's JWKS and decode the payload.
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_OAUTH_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=oauth_email`);
  }

  // Find-or-create user and link to existing password account if email matches.
  const user = await findOrCreateGoogleUser({
    googleId: payload.sub!,
    email: payload.email,
    name: payload.name ?? null,
    avatar: payload.picture ?? null,
  });

  await setSession(user);

  const res = NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard`);
  // Scrub the one-time cookies.
  res.cookies.delete('oauth_state');
  res.cookies.delete('oauth_pkce');
  return res;
}
```

### 2c. Link-to-existing-account policy (CRITICAL)

Do NOT auto-merge a Google sign-in with a password account sharing the same email — that's an account takeover primitive ("hostile merge"). The industry-correct flow:

1. If `googleId` exists on a User → log in.
2. Else if the `email` exists on a User with a password → **do NOT auto-link**. Instead, send them to a one-time verification screen: "This email is already registered. Sign in with your password, then link Google from your settings page."
3. Else → create a new user with `googleId`, `emailVerified: true`, and NO password (they can set one later).

### 2d. Env vars to add

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

Plus a User schema migration: add `googleId: { type: String, unique: true, sparse: true, index: true }`.

### 2e. CSP implications

Google OAuth does a cross-origin redirect to `https://accounts.google.com/...` and back. There's nothing to whitelist in CSP — it's a top-level navigation, not an iframe or fetch. **Zero CSP changes required** for OAuth itself. (If you later add Google One Tap, that WOULD need frame-src additions — avoid One Tap for v1.)

### 2f. Why not the alternatives

| Option | Verdict | Reason |
|--------|---------|--------|
| `next-auth` / `@auth/core` | Reject | Fights iron-session; hides PKCE; big surface area. |
| `@react-oauth/google` (client-side) | Reject | Runs OAuth in the browser — no server-side ID token verification, weaker security model for a threat-model-conscious product. |
| `arctic` | Viable alternative | Framework-agnostic OAuth helper; simpler than google-auth-library if you don't need other Google APIs. If bundle size becomes an issue, consider swapping. MEDIUM confidence — not evaluated deeply here. |
| Hand-rolled OAuth | Reject | HMAC signature verification on the ID token is where bugs hide. Use Google's official verifier. |

---

## 3. Resend — Transactional Email

### Why Resend over Postmark/SendGrid/SES

- **Resend**: Clean TypeScript SDK, first-class React Email templates, free tier (100/day, 3k/month), predictable API, API key auth (no SMTP creds). Best DX for "I need a verification email in 30 minutes."
- **Postmark**: Arguably superior inbox placement for transactional (their specialty), but older API, no native React templates, more expensive once you scale.
- **SES**: Cheapest at scale, but requires DKIM + bounce/complaint handling + IAM setup. Overkill for 500 users/day.
- **SendGrid**: Abandoned developer experience; Twilio acquisition killed the roadmap.

For a product at MVP with <10k users, Resend is the unambiguous correct choice.

### 3a. Install

```bash
npm install resend
npm install @react-email/components @react-email/render
```

**Runtime:** `resend` SDK uses `fetch` internally and works in both Node and Edge. **BUT** React Email server-side rendering needs Node (it uses `react-dom/server`). Keep email-sending code on Node runtime for simplicity.

### 3b. Minimal client + send

**Singleton (`app/src/lib/email/resend.ts`):**

```ts
import { Resend } from 'resend';
import { env } from '@/lib/env';

export const resend = new Resend(env.RESEND_API_KEY);
```

**React email template (`app/src/emails/verify-email.tsx`):**

```tsx
import { Html, Head, Body, Container, Heading, Text, Button, Tailwind } from '@react-email/components';

export function VerifyEmail({ url, name }: { url: string; name: string }) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-zinc-950 text-zinc-100 font-sans">
          <Container className="mx-auto max-w-md p-8">
            <Heading className="text-2xl font-bold">Verify your email</Heading>
            <Text>Hi {name}, confirm your email to activate your CEH Prep account.</Text>
            <Button href={url} className="bg-lime-400 text-zinc-950 rounded px-6 py-3">
              Verify email
            </Button>
            <Text className="text-xs text-zinc-500">Link expires in 1 hour.</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

**Send function (`app/src/lib/email/send-verification.ts`):**

```ts
import { resend } from './resend';
import { VerifyEmail } from '@/emails/verify-email';
import { env } from '@/lib/env';

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;

  const { data, error } = await resend.emails.send({
    from: 'CEH Prep <noreply@mail.cehprep.app>',  // Must be a verified domain.
    to,
    subject: 'Verify your email',
    react: <VerifyEmail url={url} name={name} />,
    // Idempotency key — Resend dedupes retries within 24h.
    headers: { 'X-Entity-Ref-ID': `verify-${token}` },
  });

  if (error) {
    // Return Result<Email, EmailError> — don't throw. Surface to audit log.
    return { ok: false as const, error };
  }
  return { ok: true as const, id: data!.id };
}
```

### 3c. Domain + DNS setup (operational, not code)

Before the first email sends:
1. Buy/configure a domain (e.g., `mail.cehprep.app`).
2. In Resend dashboard, add the domain. Resend gives you DKIM, SPF, and DMARC records to add at your DNS provider.
3. Wait for DNS propagation + Resend verification (~5 min).
4. `from:` addresses must use that verified domain.

**Do NOT** send from `@gmail.com` / `@protonmail.com` — it WILL be rejected.

### 3d. Rate limits (free tier)

- 100 emails/day
- 3,000 emails/month
- 2 req/sec

For password reset + email verification at <100 new users/day, this is enough. If a user brute-forces "send me another reset email," rate-limit at YOUR layer (1 reset email per account per 10 min) before it hits Resend.

### 3e. Env vars

```
RESEND_API_KEY=re_...
EMAIL_FROM="CEH Prep <noreply@mail.cehprep.app>"
```

### 3f. Why not

| Option | Verdict | Reason |
|--------|---------|--------|
| Postmark | Viable, defer | Better deliverability but weaker DX; swap later if bounce rate becomes a problem. |
| SendGrid | Reject | Abandoned DX. |
| SES | Defer | Cheaper but requires 3-5× more ops work for DKIM/bounce-handling SNS queues. |
| Nodemailer + Gmail SMTP | Reject | Gmail throttles aggressively; not a real transactional provider. |
| `@resend/node` | N/A | Doesn't exist — the package is just `resend`. |

---

## 4. MongoDB Atlas Free Tier (M0)

This isn't a new dependency — `mongoose@8.9.3` is already installed. The work is operational.

### 4a. Atlas free tier constraints (M0)

| Limit | Value | Impact |
|-------|-------|--------|
| Storage | 512 MB | Fine for ~100k users at your schema size. |
| RAM | Shared | Slow under contention. |
| Max connections | **100** | CRITICAL for serverless — see below. |
| Backup | None | Take occasional `mongodump` manually. |
| Region | One only | Pick `us-east-1` or `eu-west-1` to match Vercel default region. |
| Uptime SLA | None | Don't count on 99.9% for a paid-tier product — upgrade to M10 ($57/mo) before launch. |

### 4b. Connection string format

```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ceh-prep?retryWrites=true&w=majority&appName=ceh-prep
```

**NOT** the raw `mongodb://` form — `+srv` resolves the replica set via DNS SRV records automatically.

### 4c. Serverless connection reuse (CRITICAL)

Vercel serverless functions cold-start fresh per instance. Without caching, each invocation opens a new Mongo connection → within 100 concurrent requests you exhaust the M0 100-connection limit.

Your existing `app/src/lib/db/mongo.ts` already uses the global cache pattern. **Verify two things:**

1. `maxPoolSize` is LOW (Atlas free tier: 3-5, not 10). Each Vercel instance holds its own pool. With cold starts, 10 instances × pool of 10 = 100 connections = instant exhaustion.
2. `bufferCommands: false` is set (already the case).

**Recommended tuning for M0:**

```ts
await mongoose.connect(uri, {
  maxPoolSize: 5,              // Down from 10.
  minPoolSize: 0,              // Don't hold connections open idly.
  serverSelectionTimeoutMS: 8000,
  bufferCommands: false,
  // Atlas recommendation for serverless:
  maxIdleTimeMS: 30_000,       // Close idle sockets after 30s to free M0 connection slots.
});
```

### 4d. IP allowlist

Atlas requires an IP allowlist. For Vercel serverless, you have three options:

| Option | Complexity | Security |
|--------|------------|----------|
| Allow `0.0.0.0/0` (open to internet) | Zero | Low — relies entirely on credential strength. Acceptable for a new SaaS because SRV + SCRAM + TLS 1.3 is the real defense. |
| Vercel Secure Compute (paid) | Medium | High — static egress IPs you can whitelist. |
| NAT gateway on AWS | High | High — overkill for MVP. |

**Recommendation for MVP: `0.0.0.0/0` with a strong 32+ char random password and the dedicated DB user having only `readWrite` on `ceh-prep` (no admin).** Rotate the password on any suspected compromise.

### 4e. Local dev path

Two options, document both in README:

**(a) Docker Compose (recommended):** Already sketched in CONCERNS.md — add a `docker-compose.yml` with `mongo:7` service.

**(b) mongodb-memory-server (for tests):** `npm install -D mongodb-memory-server` — spins up an in-memory Mongo for Vitest. Boots in ~2s, no Docker required. Use this in `vitest.setup.ts`, not for normal dev.

### 4f. Vercel integration

Vercel has a one-click MongoDB Atlas integration that auto-injects `MONGO_URI` into the project env. **Do NOT use it for this project** — it overrides your env vars and fights with Zod's validation at boot. Instead, set `MONGO_URI` manually in Vercel → Project → Settings → Environment Variables.

### 4g. Env vars

Already present:

```
MONGO_URI=mongodb+srv://...
```

---

## 5. Testing — Vitest + Playwright

### 5a. Vitest 4.x for unit + integration

**Why Vitest 4, not Jest:** Jest is deprecated as a greenfield choice in the 2026 ecosystem. Vitest uses Vite's transform pipeline (10-20× faster than ts-jest), handles ESM natively, and is the default in every major React framework starter in 2026. Next.js's official testing guide recommends it for Next 15 App Router.

**Install:**

```bash
npm install -D vitest@^4 @vitejs/plugin-react @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom vite-tsconfig-paths
```

**Config (`vitest.config.ts`):**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'html'], thresholds: { lines: 70 } },
  },
});
```

**Setup (`vitest.setup.ts`):**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// iron-session mock — return a shim with the session we want.
vi.mock('iron-session', () => ({
  getIronSession: vi.fn(async () => ({ user: null, save: vi.fn(), destroy: vi.fn() })),
}));

// next/headers mock — Server Actions read cookies/headers from here.
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(() => new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));
```

### 5b. Server Action testing — the tricky part

Vitest 4 cannot execute async React Server Components (they use RSC internals only Next.js provides). **Test server ACTIONS as plain async functions** — they're just TS modules:

```ts
// src/lib/actions/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { signupAction } from './auth';

describe('signupAction', () => {
  it('rejects weak passwords', async () => {
    const fd = new FormData();
    fd.set('email', 'a@b.com');
    fd.set('password', 'password123');   // Too weak.
    const result = await signupAction(null, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/weak/i);
  });
});
```

Mock Mongoose models at the module boundary with `vi.mock('@/lib/db/models/user', ...)`.

**For async Server Components, use Playwright** (not Vitest) — they only render correctly via a real Next.js server.

### 5c. Playwright for E2E

**Install:**

```bash
npm install -D @playwright/test
npx playwright install chromium  # Only install Chromium in CI to save time; add Firefox/WebKit later.
```

**Config (`playwright.config.ts`):**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: 'chromium', use: { channel: 'chromium' } }],
});
```

**Signup flow test (`e2e/auth.spec.ts`):**

```ts
import { test, expect } from '@playwright/test';

test('signup → dashboard', async ({ page }) => {
  const email = `test-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('S0me-Hard-Pa55w0rd!');
  await page.getByRole('button', { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
```

**CRITICAL for Server Actions in Playwright:** Next.js Server Actions submit via POST to the same URL with a special `Next-Action` header. Playwright's native `page.getByRole('button').click()` handles this transparently — DO NOT try to intercept with `page.route()` because Next.js's RSC protocol will break. Let the real server respond.

### 5d. Testing Mongoose without a real DB

Two options:

1. **`mongodb-memory-server`** — in-memory Mongo, spawn in `globalSetup.ts`. Your existing `app/src/lib/db/mongo.ts` just connects to the ephemeral URI. This is the cleanest approach.
2. Mock each model. Tedious — every test has to re-declare what `findOne` returns. Use only for pure-unit tests.

```bash
npm install -D mongodb-memory-server
```

```ts
// vitest.globalSetup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;
export async function setup() {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
}
export async function teardown() {
  await mongo.stop();
}
```

### 5e. Why not the alternatives

| Option | Verdict | Reason |
|--------|---------|--------|
| Jest | Reject | Abandoned in Next.js docs as the default; ESM + RSC support lagging. |
| Cypress | Reject | Playwright is faster, has better parallel runs, and supports RSC/Server Actions testing better. Cypress 14 is still behind. |
| Testing Library + Node test runner | Defer | Node test runner is viable but lacks the ecosystem (mocks, snapshot, UI) of Vitest. |

---

## 6. Structured Logging (pino)

`pino@9.5.0` is already installed but unused. This phase just wires it up.

### 6a. Pino is NODE-ONLY — hard constraint

Pino uses `process.stdout` directly for its fast path. In Next.js Edge runtime, `process.stdout` does not exist → Pino throws at import time. **Every file that imports the logger must be in a Node runtime context.** Guard this with a boundary file:

```ts
// app/src/lib/log.ts
import 'server-only';  // <-- prevents accidental client bundle inclusion.
import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'ceh-prep', env: process.env.NODE_ENV },
  // Vercel captures stdout → log drain automatically. No transport needed.
  // DO NOT use pino-pretty in production — Vercel wants JSON lines.
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
      : undefined,
  // Redact any path that could leak PII.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'email'],
    censor: '[REDACTED]',
  },
});
```

**Install pino-pretty for dev only:**

```bash
npm install -D pino-pretty
```

### 6b. Vercel log drain

Vercel ships stdout to its log dashboard automatically. No transport setup needed. If you want durable logs:

- **Better Stack (Logtail)**: free tier, clean UI, accepts Vercel log drains via HTTPS.
- **Axiom**: also free-tier-friendly, native Next.js integration.
- **Grafana Cloud / Loki**: per your existing outreach dashboard setup — use `grafana-loki` Vercel drain.

Configure in Vercel → Project → Settings → Log Drains → add endpoint. No code change required.

### 6c. Usage pattern

```ts
import { log } from '@/lib/log';

export async function signupAction(prev: unknown, fd: FormData) {
  const reqLog = log.child({ action: 'signup', ip: /* from pre-collected meta */ });
  try {
    // ...
    reqLog.info({ outcome: 'success', userId }, 'signup.created');
    return { ok: true };
  } catch (err) {
    reqLog.error({ err }, 'signup.failed');
    return { ok: false, error: 'AUTH_SIGNUP_FAILED' };
  }
}
```

**Rules (from threat model):**
1. NEVER log passwords, tokens, session cookies, or full email addresses (hash or redact).
2. Log `userId` (opaque) not `email`.
3. Use structured keys, not string interpolation — `log.info({ day: 4 }, 'course.view')` not `log.info(\`day ${day} viewed\`)`.
4. Use `log.child({ requestId })` on every request for traceability.

### 6d. CSP / runtime notes

Pino imports are safe in Node-only contexts. Every file that imports `@/lib/log` should NEVER be imported by a Client Component. Add `'server-only'` at the top of `log.ts` so Next.js blocks accidental client imports at build time.

---

## 7. Upstash Redis — Rate Limiting (optional, for scale)

### 7a. When to introduce this

The existing `lru-cache` rate limiter works for **single Vercel instance**. The moment you have >1 concurrent serverless instance (which is IMMEDIATELY on Vercel), per-IP counters are fragmented across instances and effectively broken (CONCERNS.md "In-Process Rate Limiting").

**Recommendation: ship with Upstash from day 1 in production.** The dev/test path can keep using `lru-cache` via an interface:

```ts
interface RateLimiter {
  check(namespace: string, key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
}
```

Swap implementation based on `env.NODE_ENV`.

### 7b. Why Upstash over ioredis / node-redis

- **Upstash Redis is HTTP-native** — `fetch`-based REST API. Works in Next.js Edge runtime AND Node runtime identically. No persistent TCP connection to manage. No connection pool to exhaust.
- **ioredis / node-redis** use raw TCP. On Vercel serverless, every cold start opens a new connection → at scale you exhaust Redis's connection limit. Plus they don't run in Edge.
- **Upstash free tier**: 10k commands/day, 256 MB, global replication. Enough for rate limiting 10k requests/day.

### 7c. Install

```bash
npm install @upstash/redis @upstash/ratelimit
```

**Runtime:** Node AND Edge. You can use it in middleware (Edge runtime) for ultra-low-latency rate limiting.

### 7d. Minimal wiring (`app/src/lib/auth/rate-limit.ts`):

```ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from '@/lib/env';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Sliding window is the correct algorithm for brute-force prevention —
// fixed window lets you burst at boundaries.
export const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
  prefix: 'rl:signup',
});

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'rl:login',
});

export async function checkRateLimit(limiter: Ratelimit, key: string) {
  const { success, limit, remaining, reset } = await limiter.limit(key);
  return { success, limit, remaining, resetAt: reset };
}
```

Call in the auth action AFTER collecting client meta (IP), BEFORE `connectDB()`:

```ts
const { success } = await checkRateLimit(signupLimiter, `ip:${clientIp}`);
if (!success) return { ok: false, error: 'RATE_LIMITED' };
```

### 7e. Env vars

```
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=
```

### 7f. Dev path — keep lru-cache

In development, Upstash adds round-trip latency (~50-200ms per check). Keep a `Memory` implementation for `NODE_ENV === 'development'`:

```ts
export const rateLimiter: RateLimiter =
  env.NODE_ENV === 'production' ? upstashRateLimiter : memoryRateLimiter;
```

This also means tests don't need to mock Upstash — they use the in-memory path.

### 7g. Why not

| Option | Verdict | Reason |
|--------|---------|--------|
| ioredis | Reject | TCP → breaks on Vercel serverless cold starts + no Edge support. |
| node-redis | Reject | Same as ioredis. |
| Vercel KV | Viable | It's literally Upstash Redis under the hood; use whichever UI you prefer. Pricing is near-identical. |
| PlanetScale / Neon / Postgres advisory lock | Reject | Overkill; latency too high for rate limiting. |
| Raw lru-cache in production | Reject | Broken at any horizontal scale (documented in CONCERNS.md). |

---

## Consolidated Install Command

```bash
# Production deps
npm install \
  @paddle/paddle-node-sdk@^3.6.0 \
  @paddle/paddle-js@^1.4.4 \
  google-auth-library@^10.6.2 \
  resend@^6.1.0 \
  @react-email/components@^0.5.0 \
  @react-email/render@^1.3.0 \
  @upstash/redis@^1.34.0 \
  @upstash/ratelimit@^2.0.8

# Dev deps
npm install -D \
  vitest@^4.1.4 \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/dom \
  @testing-library/jest-dom \
  jsdom \
  vite-tsconfig-paths \
  mongodb-memory-server \
  @playwright/test@^1.57.0 \
  pino-pretty

# Playwright browsers
npx playwright install chromium
```

---

## Consolidated Env Schema (extend `app/src/lib/env.ts`)

```ts
export const envSchema = z.object({
  // ... existing (MONGO_URI, SESSION_SECRET, SESSION_COOKIE_NAME, NEXT_PUBLIC_APP_URL, NODE_ENV)

  // Paddle
  PADDLE_API_KEY: z.string().startsWith('pdl_').min(20),
  PADDLE_WEBHOOK_SECRET: z.string().startsWith('pdl_ntfset_').min(20),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(10),
  NEXT_PUBLIC_PADDLE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  NEXT_PUBLIC_PADDLE_PRICE_ID_PRO: z.string().startsWith('pri_'),

  // Google OAuth
  GOOGLE_OAUTH_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com'),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(20),

  // Resend
  RESEND_API_KEY: z.string().startsWith('re_').min(20),
  EMAIL_FROM: z.string().email().or(z.string().includes('<')), // "Name <email@domain>"

  // Upstash (optional in dev, required in prod)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});
```

---

## Runtime Compatibility Matrix

| Package | Node runtime | Edge runtime | Where to use |
|---------|-------------|-------------|--------------|
| `@paddle/paddle-node-sdk` | ✅ | ❌ | Server actions, route handlers (`export const runtime = 'nodejs'`) |
| `@paddle/paddle-js` | N/A (browser) | N/A | Client components only (`'use client'`) |
| `google-auth-library` | ✅ | ❌ | OAuth route handlers (`export const runtime = 'nodejs'`) |
| `resend` (v6+) | ✅ | ✅ (API only) | Server actions — but React Email render needs Node |
| `@react-email/components` | ✅ | ❌ | Build/server rendering of templates |
| `mongoose` | ✅ | ❌ | All DB code — already baked in |
| `pino` | ✅ | ❌ | `server-only` guarded module |
| `@upstash/redis` | ✅ | ✅ | Anywhere, including middleware |
| `@upstash/ratelimit` | ✅ | ✅ | Anywhere |
| `vitest` / `@playwright/test` | ✅ (dev) | N/A | Test runner only |

**Rule of thumb for this project:** Declare `export const runtime = 'nodejs'` on every route handler that touches the DB, sends email, verifies OAuth, or handles webhooks. The ONLY place you might use Edge runtime is `middleware.ts` for nonce generation and header setting.

---

## CSP Requirements Summary (for production `next.config.ts`)

```ts
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.paddle.com https://*.paddle.com`,
  `connect-src 'self' https://*.paddle.com https://*.paddleapi.com https://api.pwnedpasswords.com`,
  `frame-src 'self' https://*.paddle.com https://buy.paddle.com https://sandbox-buy.paddle.com`,
  `img-src 'self' data: https://*.paddle.com https://*.googleusercontent.com`,  // googleusercontent for Google avatars
  `style-src 'self' 'unsafe-inline' https://*.paddle.com https://api.fontshare.com https://fonts.googleapis.com`,
  `font-src 'self' https://cdn.fontshare.com https://fonts.gstatic.com data:`,
  `form-action 'self' https://accounts.google.com`,  // Allow the OAuth redirect POST.
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
].join('; ');
```

- **Nonce** is generated in `middleware.ts` on every request and injected into the header. Drop `'unsafe-inline'` from `script-src`. Use `'strict-dynamic'` so Next.js's own bundled scripts (which carry the nonce) can transitively load more scripts.
- **Paddle wildcards**: wildcards at the host level (`*.paddle.com`) are the cleanest way to cover both sandbox and production without duplicating directives.
- **Google OAuth** needs NO CSP additions for the redirect itself, but `form-action` must allow `accounts.google.com` if you ever use a form POST flow (we use GET redirects, so this is defensive).
- **`connect-src api.pwnedpasswords.com`** — currently your codebase uses HIBP but CSP only has `'self'`. This is a latent bug to fix in the same PR.

---

## Version Compatibility Notes

| Package A | Needs | Why |
|-----------|-------|-----|
| `vitest@^4` | Vite 5+, Node 20+ | Matches project Node engine. |
| `@paddle/paddle-node-sdk@^3` | Node 18+ | Native `fetch` required. |
| `@react-email/components@^0.5` + `react-email@^5` | React 19, Tailwind 4 | React Email 5.0 dropped Tailwind 3 support — the project is already on Tailwind 4, compatible. |
| `google-auth-library@^10` | Node 18+ | Uses `globalThis.fetch`. |
| `resend@^6` | Node 18+ | Same. |
| `@upstash/ratelimit@^2` | `@upstash/redis@^1.34` | Peer dep. |
| `playwright@^1.57` | Node 20+ | OK. |

**None of the new packages conflict with Mongoose 8.9.3, iron-session 8.0.4, Zod 3.24.1, or React 19.** All verified via npm dependency inspection.

---

## What NOT to Use

| Avoid | Why | Use instead |
|-------|-----|-------------|
| `next-auth` / `@auth/core` | Conflicts with own-the-auth posture; hides PKCE; big dep surface | Hand-rolled OAuth flow with `google-auth-library` |
| `ioredis` / `node-redis` | TCP-based, breaks on Vercel serverless and Edge | `@upstash/redis` (HTTP-native) |
| `paddle-sdk` (avaly) | Unmaintained, Paddle Classic only | `@paddle/paddle-node-sdk` |
| `@react-oauth/google` (client-side) | No server-side ID token verification | `google-auth-library` server-side |
| `nodemailer` + SMTP | Delivery quality, ops burden | `resend` |
| `jest` | Abandoned as Next.js default | `vitest` |
| `cypress` | Slower, worse RSC/Server Action support | `@playwright/test` |
| `pino-pretty` in production | Vercel wants JSON, not ANSI-colored text | Raw `pino` → stdout → Vercel log drain |
| Vercel KV (branded) | Same thing, more expensive if you already have Upstash | `@upstash/redis` directly |
| Raw `fetch` to Paddle API without SDK | Webhook signature HMAC is where bugs hide | `paddle.webhooks.unmarshal()` |

---

## Watch-outs Specific to Next.js 15 App Router

1. **Every route handler that uses Node-only modules MUST declare `export const runtime = 'nodejs'`.** Without it, Next.js defaults depend on imports — subtle bugs appear when something imports `crypto` transitively.
2. **Server Actions do NOT receive request headers automatically** — you must call `headers()` from `next/headers` at the TOP of the action before any `await`, or cache them before. Your signup 500 bug is exactly this class of error.
3. **RSC cannot run in Vitest** — async Server Components are untestable in unit tests; use Playwright.
4. **Middleware runs on Edge by default** — Pino, Mongoose, google-auth-library, and @paddle/paddle-node-sdk ALL break there. Keep middleware to: nonce generation, header injection, rate limiting (via Upstash). Never do auth re-verification in middleware (and per CVE-2025-29927, never rely on middleware for auth anyway).
5. **`'server-only'` import guard** prevents accidental client bundle leakage of server-only code. Use on `log.ts`, `paddle.ts`, `resend.ts`, `mongo.ts`.
6. **Paddle checkout overlay loads its own fonts/CSS** — if you have strict `font-src`, you may need to add `https://*.paddle.com` there too. Test in sandbox first.
7. **Vercel function timeout is 10s on Hobby, 60s on Pro.** Paddle webhooks need to respond fast — do heavy work in a detached `waitUntil(queueMicrotask(...))` or a background job. For MVP, dedupe + mongo upsert finishes in <500ms, so this is fine.

---

## Sources (verified April 2026)

### Paddle Billing
- [@paddle/paddle-node-sdk on npm](https://www.npmjs.com/package/@paddle/paddle-node-sdk) — version 3.6.0 verified (HIGH)
- [PaddleHQ/paddle-node-sdk GitHub](https://github.com/PaddleHQ/paddle-node-sdk) — official repo, `unmarshal()` API confirmed (HIGH)
- [Paddle webhook signature verification docs](https://developer.paddle.com/webhooks/signature-verification) — official (HIGH)
- [@paddle/paddle-js on npm](https://www.npmjs.com/package/@paddle/paddle-js) — verified current (HIGH)
- [Paddle.js CDN + CSP discussion](https://github.com/PaddleHQ/paddle-js-wrapper/issues/22) — confirms `https://cdn.paddle.com` required in CSP (MEDIUM)
- [Paddle Next.js App Router integration guide](https://emreloper.dev/blog/paddle-and-nextjs-integration-using-app-router) — community tutorial (MEDIUM)
- [Official PaddleHQ Next.js starter kit](https://github.com/PaddleHQ/paddle-nextjs-starter-kit) — authoritative reference (HIGH)
- [Paddle sandbox domain docs](https://developer.paddle.com/build/tools/sandbox) — official (HIGH)
- [Paddle build overlay checkout guide](https://developer.paddle.com/build/checkout/build-overlay-checkout) — official (HIGH)

### Google OAuth
- [google-auth-library on npm](https://www.npmjs.com/package/google-auth-library) — version 10.6.2 verified (HIGH)
- [google-auth-library-nodejs GitHub](https://github.com/googleapis/google-auth-library-nodejs) — `generateCodeVerifierAsync`, PKCE via `code_challenge`/`code_challenge_method` confirmed in source (HIGH)
- [Google OAuth 2.0 for installed apps — PKCE section](https://developers.google.com/identity/protocols/oauth2/native-app) — official PKCE spec (HIGH)
- [OAuth2Client.generateAuthUrl reference](https://googleapis.dev/nodejs/google-auth-library/5.5.0/classes/OAuth2Client.html) — older docs but API is stable (MEDIUM)

### Resend
- [resend on npm](https://www.npmjs.com/package/resend) — version 6.11.0 verified (HIGH)
- [Resend Send with Next.js docs](https://resend.com/docs/send-with-nextjs) — official App Router guide (HIGH)
- [React Email 5.0 announcement](https://resend.com/blog/react-email-5) — confirms Tailwind 4 + React 19 support (HIGH)
- [resend/react-email GitHub](https://github.com/resend/react-email) — official repo (HIGH)

### MongoDB Atlas
- [Atlas service limits docs](https://www.mongodb.com/docs/atlas/reference/atlas-limits/) — M0 512MB + 100 connections verified (HIGH)
- [Mongoose Next.js integration guide](https://mongoosejs.com/docs/nextjs.html) — official global cache pattern (HIGH)
- [MongoDB Vercel Atlas integration](https://vercel.com/integrations/mongodbatlas) — official (HIGH)
- [Large number of connections with Mongoose and Vercel — MongoDB forum](https://www.mongodb.com/community/forums/t/large-number-of-connections-with-mongoose-and-vercel/204917) — confirms pool tuning approach (MEDIUM)

### Vitest + Playwright
- [Next.js official Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) — confirms async Server Components unsupported in Vitest, recommends Playwright (HIGH)
- [Vitest 4.0 release](https://vitest.dev/blog/vitest-4) — version 4.1.4 current (HIGH)
- [Next.js official Playwright guide](https://nextjs.org/docs/pages/guides/testing/playwright) — official (HIGH)
- [@playwright/test on npm](https://www.npmjs.com/package/@playwright/test) — 1.57+ current (HIGH)

### pino + Vercel
- [Vercel Pino logging template](https://vercel.com/templates/next.js/pino-logging) — official pattern (HIGH)
- [Structured logging for Next.js — Arcjet blog](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — confirms stdout JSON pattern for Vercel (MEDIUM)
- [Pino edge runtime incompatibility discussion](https://github.com/vercel/next.js/discussions/67213) — confirms `process.stdout` unavailable in Edge (HIGH)

### Upstash
- [@upstash/ratelimit on npm](https://www.npmjs.com/package/@upstash/ratelimit) — 2.0.8 current (HIGH)
- [upstash/ratelimit-js GitHub](https://github.com/upstash/ratelimit-js) — official sliding window implementation (HIGH)
- [Upstash rate limit algorithms docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms) — official (HIGH)
- [Rate Limiting Next.js with Upstash Edge](https://upstash.com/blog/edge-rate-limiting) — confirms Edge runtime compatibility (HIGH)

---

## Confidence Summary

| Area | Confidence | Why |
|------|------------|-----|
| Paddle version + SDK pattern | HIGH | Version verified on npm, `unmarshal()` API confirmed in Paddle docs, Next.js route handler pattern confirmed via official starter kit. |
| Paddle CSP directives | MEDIUM-HIGH | Based on Paddle's own docs + community issue discussions; wildcard `*.paddle.com` is the safest pattern but I'd verify once in sandbox with DevTools open. |
| Google OAuth + PKCE flow | HIGH | Official Google docs, library source code, and RFC 7636 align. |
| Link-to-existing-account policy | HIGH | Industry standard (OWASP guidance on hostile account merging). |
| Resend + React Email | HIGH | Both libraries are from the same vendor, natively designed for Next.js App Router, versions verified. |
| MongoDB Atlas M0 tuning | HIGH | Official Atlas limits docs + Mongoose serverless guidance. |
| Vitest 4 + Playwright harness | HIGH | Official Next.js docs confirm the pattern and limits (RSC unsupported, Server Actions testable as functions). |
| pino Node-only constraint | HIGH | Confirmed via multiple GitHub issues and the runtime APIs it depends on. |
| Upstash Ratelimit | HIGH | Official sliding-window API, HTTP-native confirmed in Upstash docs, works in Edge + Node. |
| Runtime matrix | HIGH | Cross-checked each package against documented Node-only APIs. |

---

*Stack research for: Next.js 15 SaaS — new integrations (Paddle, Google OAuth, Resend, Atlas, Vitest/Playwright, pino, Upstash)*
*Researched: 2026-04-13*
