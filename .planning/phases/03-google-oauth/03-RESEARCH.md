# Phase 3 — Google OAuth · Research

**Status:** Ready for planning
**Confidence:** HIGH (all decisions locked in 03-CONTEXT.md; this file fills the remaining technical sketch layer for the planner)
**Scope:** Implementation-level "how" for `google-auth-library` PKCE flow, cookie scheme, decideLink gating, and route handler shape.

---

## Key Findings

1. **`google-auth-library@^10.6.2`** is the canonical Node SDK. It supports PKCE natively via `generateAuthUrl({ code_challenge, code_challenge_method: "S256" })` and handles id_token verification with JWKS key rotation via `verifyIdToken({ idToken, audience })`. Node runtime only — never Edge.

2. **PKCE on top of a confidential client** is supported by google-auth-library and is the defense-in-depth play. We pass both `client_secret` (confidential) AND `code_challenge` (PKCE). A client-secret leak still can't complete a code interception without the verifier.

3. **`__Host-` cookie prefix** requires `Secure + Path=/ + no Domain`. In iron-session's test environment this can fail if `NODE_ENV !== "production"`. Use `__Host-oauth-state` and `__Host-oauth-pkce` in production, fall back to `oauth-state` + `oauth-pkce` in dev. The fallback is behind an explicit env check, not a silent switch.

4. **`SameSite=Lax` is mandatory** for the OAuth return-leg. Google's callback URL is cross-site (different eTLD+1 than our app), and `SameSite=Strict` cookies are stripped on cross-site top-level navigation. `Lax` is the exact exception we need — it preserves cookies on top-level GETs but still blocks CSRF on non-GET requests. The combination of Lax + state cookie nonce + PKCE verifier makes CSRF + code interception structurally impossible.

5. **Cookie deletion BEFORE verification** is the single-use enforcement. On callback entry: read both cookies → write `Set-Cookie: __Host-oauth-state=; Max-Age=0; ...` (same for pkce) → THEN start verification. Any replay of the same URL hits missing cookies and fails with `oauth_state_mismatch`.

6. **`prompt=consent` is a UX paper cut worth accepting.** Without it, if a user switches Google accounts in a shared browser, Google silently completes the flow with whichever account happens to be active. With it, Google always shows the account picker. Security >>> one extra click.

7. **The unusable-password hash for OAuth-only users is intentional.** Argon2-hash a crypto-random 32-byte string and store it in `passwordHash`. Satisfies the schema's `required: true` constraint without creating a usable password login path. The user can still recover via "forgot password" flow (which proves email ownership — exactly what we want for OAuth-only accounts).

---

## Implementation Sketches

### §1 — OAuth client factory (`app/src/lib/infra/google/oauth-client.ts`)

```ts
import "server-only";
import { OAuth2Client } from "google-auth-library";
import { env } from "@/lib/env";

let cachedClient: OAuth2Client | null = null;

export const getGoogleOAuthClient = (): OAuth2Client => {
  if (cachedClient) return cachedClient;
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set");
  }
  cachedClient = new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI ?? `${env.NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`,
  });
  return cachedClient;
};
```

One file, singleton, Node-only. Every other Phase 3 file imports from `lib/infra/google/index.ts` which re-exports this.

### §2 — State + PKCE helpers (`app/src/lib/auth/oauth/state.ts`)

```ts
import { createHash, randomBytes } from "node:crypto";

export type OAuthStatePayload = {
  readonly nonce: string;      // 16 random bytes base64url
  readonly returnTo: string;   // validated path
  readonly issuedAt: number;   // epoch ms
};

export type OAuthCookies = {
  readonly state: string;      // JSON-serialized OAuthStatePayload, then base64url
  readonly pkceVerifier: string; // 32 random bytes base64url
  readonly pkceChallenge: string; // sha256(verifier) base64url
};

const base64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const buildOAuthCookies = (returnTo: string): OAuthCookies => {
  const nonce = base64url(randomBytes(16));
  const pkceVerifier = base64url(randomBytes(32));
  const pkceChallenge = base64url(
    createHash("sha256").update(pkceVerifier).digest(),
  );
  const payload: OAuthStatePayload = {
    nonce,
    returnTo,
    issuedAt: Date.now(),
  };
  const state = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return { state, pkceVerifier, pkceChallenge };
};

export const parseOAuthState = (stateCookie: string): OAuthStatePayload | null => {
  try {
    const json = Buffer.from(stateCookie, "base64").toString("utf8");
    const parsed = JSON.parse(json) as OAuthStatePayload;
    if (typeof parsed.nonce !== "string" || parsed.nonce.length !== 22) return null;
    if (typeof parsed.returnTo !== "string") return null;
    if (typeof parsed.issuedAt !== "number") return null;
    if (Date.now() - parsed.issuedAt > 5 * 60 * 1000) return null; // 5 min TTL
    return parsed;
  } catch {
    return null;
  }
};

const RETURN_TO_ALLOWED = /^\/(?:dashboard|course|exam|pricing|settings|verify-pending)(?:\/|$)/;

export const validateReturnTo = (raw: string | null): string => {
  if (!raw || !RETURN_TO_ALLOWED.test(raw)) return "/dashboard";
  return raw;
};
```

### §3 — `decideLink` pure function (`app/src/lib/auth/oauth/decide-link.ts`)

```ts
import type { UserDoc } from "@/lib/db/models/user";

export type VerifiedGoogleProfile = {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: true;  // only constructed when Google's claim is true
  readonly name: string;
  readonly picture: string | null;
};

export type LinkDecision =
  | { readonly kind: "create_new"; readonly profile: VerifiedGoogleProfile }
  | { readonly kind: "login_linked"; readonly userId: string }
  | { readonly kind: "auto_link"; readonly userId: string; readonly profile: VerifiedGoogleProfile }
  | { readonly kind: "require_manual_link"; readonly email: string }
  | { readonly kind: "conflict"; readonly reason: string };

type ExistingLookup = {
  readonly byGoogleSub: UserDoc | null;
  readonly byEmail: UserDoc | null;
};

/**
 * Pure decision: given a verified Google profile and the Mongo lookup results,
 * decide how to link. No I/O, no side effects — the caller performs the lookups
 * and passes them in.
 *
 * Case matrix (in priority order):
 *   1. existingByGoogleSub → login_linked (exact match)
 *   2. no existingByEmail → create_new (fresh user)
 *   3. existingByEmail has a DIFFERENT googleSub → conflict (defensive)
 *   4. existingByEmail has NO googleSub AND emailVerifiedAt !== null → auto_link (safe)
 *   5. existingByEmail has NO googleSub AND emailVerifiedAt === null → require_manual_link
 *      (HOSTILE ACCOUNT TAKEOVER DEFENSE — never auto-link to unverified accounts)
 */
export const decideLink = (
  profile: VerifiedGoogleProfile,
  lookup: ExistingLookup,
): LinkDecision => {
  const { byGoogleSub, byEmail } = lookup;

  if (byGoogleSub) {
    return { kind: "login_linked", userId: byGoogleSub._id.toString() };
  }

  if (!byEmail) {
    return { kind: "create_new", profile };
  }

  if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
    return {
      kind: "conflict",
      reason: "email_already_linked_to_different_google_account",
    };
  }

  if (byEmail.emailVerifiedAt === null || byEmail.emailVerifiedAt === undefined) {
    return { kind: "require_manual_link", email: profile.email };
  }

  return { kind: "auto_link", userId: byEmail._id.toString(), profile };
};
```

Pure. Zero I/O. Fully unit-testable. Five cases covered by exhaustive discrimination.

### §4 — Start route handler (`app/src/app/api/oauth/google/start/route.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { getGoogleOAuthClient } from "@/lib/infra/google";
import { buildOAuthCookies, validateReturnTo } from "@/lib/auth/oauth/state";
import { rateLimit } from "@/lib/auth/rate-limit";
import { audit, type ClientMeta } from "@/lib/actions/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const captureMeta = async (): Promise<ClientMeta> => {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown",
    ua: h.get("user-agent")?.slice(0, 256) ?? "unknown",
    origin: h.get("origin") ?? "",
  };
};

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const meta = await captureMeta();
  const limit = rateLimit("oauth-start-ip", meta.ip, 10, 60_000);
  if (!limit.ok) {
    await audit(meta, "oauth_start", "deny", { reason: "rate_limit" });
    return NextResponse.redirect(new URL("/login?error=rate_limited", req.url));
  }

  const returnTo = validateReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const { state, pkceVerifier, pkceChallenge } = buildOAuthCookies(returnTo);

  const client = getGoogleOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "consent",
    code_challenge: pkceChallenge,
    code_challenge_method: "S256",
    state,
  });

  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const stateName = isProd ? "__Host-oauth-state" : "oauth-state";
  const pkceName = isProd ? "__Host-oauth-pkce" : "oauth-pkce";

  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 5 * 60, // 5 minutes
  };

  store.set(stateName, state, cookieOpts);
  store.set(pkceName, pkceVerifier, cookieOpts);

  await audit(meta, "oauth_start", "ok", { provider: "google" });

  return NextResponse.redirect(authUrl);
};
```

### §5 — Callback route handler (`app/src/app/api/oauth/google/callback/route.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { getGoogleOAuthClient } from "@/lib/infra/google";
import { parseOAuthState, validateReturnTo } from "@/lib/auth/oauth/state";
import { decideLink, type VerifiedGoogleProfile } from "@/lib/auth/oauth/decide-link";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { sendWelcomeEmail } from "@/lib/infra/resend";
import { audit, type ClientMeta } from "@/lib/actions/shared";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const captureMeta = async (): Promise<ClientMeta> => {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown",
    ua: h.get("user-agent")?.slice(0, 256) ?? "unknown",
    origin: h.get("origin") ?? "",
  };
};

const redirectWithError = (req: NextRequest, code: string): NextResponse =>
  NextResponse.redirect(new URL(`/login?error=oauth_${code}`, req.url));

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const meta = await captureMeta();
  const limit = rateLimit("oauth-callback-ip", meta.ip, 10, 60_000);
  if (!limit.ok) {
    await audit(meta, "oauth_callback", "deny", { reason: "rate_limit" });
    return redirectWithError(req, "rate_limited");
  }

  // Read + delete cookies BEFORE any work (single-use)
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const stateName = isProd ? "__Host-oauth-state" : "oauth-state";
  const pkceName = isProd ? "__Host-oauth-pkce" : "oauth-pkce";
  const stateCookie = store.get(stateName)?.value ?? "";
  const pkceCookie = store.get(pkceName)?.value ?? "";
  store.delete(stateName);
  store.delete(pkceName);

  const queryState = req.nextUrl.searchParams.get("state") ?? "";
  if (!stateCookie || stateCookie !== queryState) {
    await audit(meta, "oauth_callback", "deny", { reason: "state_mismatch" });
    return redirectWithError(req, "state_mismatch");
  }

  const statePayload = parseOAuthState(stateCookie);
  if (!statePayload) {
    await audit(meta, "oauth_callback", "deny", { reason: "state_invalid" });
    return redirectWithError(req, "state_mismatch");
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    await audit(meta, "oauth_callback", "deny", { reason: "code_missing" });
    return redirectWithError(req, "code_missing");
  }

  const client = getGoogleOAuthClient();

  let tokens;
  try {
    const result = await client.getToken({ code, codeVerifier: pkceCookie });
    tokens = result.tokens;
  } catch (e) {
    await audit(meta, "oauth_callback", "error", {
      reason: "token_exchange_failed",
      message: e instanceof Error ? e.message : "unknown",
    });
    return redirectWithError(req, "token_exchange_failed");
  }

  const idToken = tokens.id_token;
  if (!idToken) {
    await audit(meta, "oauth_callback", "deny", { reason: "id_token_missing" });
    return redirectWithError(req, "id_token_invalid");
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });
  } catch (e) {
    await audit(meta, "oauth_callback", "error", {
      reason: "id_token_verify_failed",
      message: e instanceof Error ? e.message : "unknown",
    });
    return redirectWithError(req, "id_token_invalid");
  }

  const payload = ticket.getPayload();
  if (
    !payload ||
    payload.email_verified !== true ||
    !payload.email ||
    !payload.sub ||
    !payload.name
  ) {
    await audit(meta, "oauth_callback", "deny", { reason: "id_token_claims_invalid" });
    return redirectWithError(req, "email_unverified_google");
  }

  const profile: VerifiedGoogleProfile = {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name,
    picture: payload.picture ?? null,
  };

  await connectDB();
  const byGoogleSub = await UserModel
    .findOne({ googleSub: { $eq: profile.sub } })
    .lean<{ _id: { toString(): string } } & UserDoc | null>();
  const byEmail = byGoogleSub
    ? null
    : await UserModel
        .findOne({ email: { $eq: profile.email } })
        .lean<{ _id: { toString(): string } } & UserDoc | null>();

  const decision = decideLink(profile, { byGoogleSub, byEmail });

  let userId: string;
  let userEmail: string;
  let epoch: number;

  switch (decision.kind) {
    case "login_linked": {
      userId = decision.userId;
      const user = await UserModel
        .findOne({ _id: { $eq: userId } })
        .select("+sessionEpoch email")
        .lean<{ email: string; sessionEpoch?: number } | null>();
      if (!user) {
        await audit(meta, "oauth_callback", "error", { reason: "user_vanished" });
        return redirectWithError(req, "link_conflict");
      }
      userEmail = user.email;
      epoch = user.sessionEpoch ?? 0;
      break;
    }
    case "create_new": {
      const unusablePassword = randomBytes(32).toString("base64url");
      const passwordHash = await hashPassword(unusablePassword);
      const doc = await UserModel.create({
        email: profile.email,
        passwordHash,
        displayName: profile.name,
        tier: "free",
        googleSub: profile.sub,
        emailVerifiedAt: new Date(),
        sessionEpoch: 0,
        lastLoginAt: new Date(),
      });
      userId = doc._id.toString();
      userEmail = profile.email;
      epoch = 0;
      // Fire welcome email (non-blocking)
      await sendWelcomeEmail({
        to: profile.email,
        displayName: profile.name,
        dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
        meta,
        userId,
      });
      break;
    }
    case "auto_link": {
      userId = decision.userId;
      await UserModel.updateOne(
        { _id: { $eq: userId } },
        {
          $set: {
            googleSub: profile.sub,
            displayName: profile.name,
            lastLoginAt: new Date(),
          },
        },
      );
      userEmail = profile.email;
      const user = await UserModel
        .findOne({ _id: { $eq: userId } })
        .select("+sessionEpoch")
        .lean<{ sessionEpoch?: number } | null>();
      epoch = user?.sessionEpoch ?? 0;
      break;
    }
    case "require_manual_link": {
      await audit(meta, "oauth_callback", "deny", { reason: "require_manual_link" });
      return redirectWithError(req, "link_required");
    }
    case "conflict": {
      await audit(meta, "oauth_callback", "deny", { reason: decision.reason });
      return redirectWithError(req, "link_conflict");
    }
  }

  await audit(
    meta,
    "oauth_callback",
    "ok",
    { decision: decision.kind },
    userId,
  );
  await audit(
    meta,
    "oauth_link",
    "ok",
    { provider: "google", action: decision.kind },
    userId,
  );

  const session = await getSession();
  session.userId = userId;
  session.email = userEmail;
  session.createdAt = Date.now();
  session.epoch = epoch;
  await session.save();

  const returnTo = validateReturnTo(statePayload.returnTo);
  return NextResponse.redirect(new URL(returnTo, req.url));
};
```

### §6 — Google button server component (`app/src/components/oauth/google-button.tsx`)

```tsx
export type GoogleButtonProps = {
  readonly returnTo?: string;
};

export const GoogleButton = ({ returnTo }: GoogleButtonProps) => {
  const href = returnTo
    ? `/api/oauth/google/start?returnTo=${encodeURIComponent(returnTo)}`
    : "/api/oauth/google/start";

  return (
    <a
      href={href}
      className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-line-strong)] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        />
        <path
          fill="currentColor"
          d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        />
        <path
          fill="currentColor"
          d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        />
        <path
          fill="currentColor"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        />
      </svg>
      Continue with Google
    </a>
  );
};
```

### §7 — Env schema extension (`app/src/lib/env.ts`)

```ts
// Add to EnvSchema:
GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),

// Add cross-field refinement after .object():
.refine(
  (data) => {
    const anySet = !!(data.GOOGLE_OAUTH_CLIENT_ID || data.GOOGLE_OAUTH_CLIENT_SECRET);
    const allSet = !!(data.GOOGLE_OAUTH_CLIENT_ID && data.GOOGLE_OAUTH_CLIENT_SECRET);
    if (data.NODE_ENV === "production") return allSet;
    return !anySet || allSet;
  },
  {
    message: "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must both be set or both unset; both required in production",
  },
)
```

---

## Validation Architecture

Each OAUTH REQ gets 1-2 observable-outcome criteria for Nyquist compliance.

| REQ | Criterion | Check |
|---|---|---|
| **OAUTH-01** (button on login+signup) | Login page renders `<GoogleButton />`; Signup page renders `<GoogleButton />`; grep for the component import | static grep |
| **OAUTH-01** | HTTP smoke: GET `/api/oauth/google/start` returns 302 to `accounts.google.com/o/oauth2/v2/auth?...` | manual |
| **OAUTH-02** (Authorization Code + PKCE) | `grep -q "code_challenge_method.*S256" app/src/app/api/oauth/google/start/route.ts` | grep |
| **OAUTH-02** | `grep -q "getToken.*codeVerifier" app/src/app/api/oauth/google/callback/route.ts` | grep |
| **OAUTH-03** (State + PKCE in httpOnly Lax cookies) | `grep -q 'sameSite: "lax"' app/src/app/api/oauth/google/start/route.ts`; `grep -q "httpOnly: true"` | grep |
| **OAUTH-03** | Start handler sets BOTH cookies; callback handler deletes BOTH cookies BEFORE verification | structural |
| **OAUTH-04** (verifyIdToken with audience + iss + email_verified) | `grep -q "verifyIdToken" app/src/app/api/oauth/google/callback/route.ts` + `grep -q "email_verified !== true"` + `audience: env.GOOGLE_OAUTH_CLIENT_ID` | grep |
| **OAUTH-05** (decideLink gated on emailVerifiedAt !== null) | `decideLink` case `"auto_link"` returns only when `byEmail.emailVerifiedAt !== null`; unit-style inspection of `lib/auth/oauth/decide-link.ts` | code review |
| **OAUTH-05** | `require_manual_link` returns when `byEmail.emailVerifiedAt === null` | code review |
| **OAUTH-06** (manual-link flow routes to /login?error=link_required) | `redirectWithError(req, "link_required")` present in the "require_manual_link" case | grep |
| **OAUTH-07** (returnTo allowlist + URL constructor) | `validateReturnTo` regex matches the 6 allowed path prefixes only; external origins rejected | unit-style manual |
| **OAUTH-07** | `returnTo` is pulled from the state cookie payload, NOT directly from the query string in the callback | structural grep |
| **OAUTH-08** (audit events for every outcome) | `grep -c "oauth_start\|oauth_callback\|oauth_link" app/src/app/api/oauth/google/` returns at least 6 matches (covers ok/deny/error paths) | grep |
| **OAUTH-08** | NO raw id_token / pkce verifier / state value in audit payloads — `grep -rn "idToken:\|pkce_verifier\|pkceCookie" app/src/app/api/oauth/google/ \| grep -v "\.delete\|\.get" ` is empty of payload-writing references | grep |
| **OAUTH-09** (OAuth callback is a GET route handler, not a server action) | `test -f app/src/app/api/oauth/google/callback/route.ts && grep -q "export const GET" app/src/app/api/oauth/google/callback/route.ts && grep -q 'runtime = "nodejs"'` | grep + file existence |

**Total:** 14 criteria across 9 requirements. Split: 10 grep/structural, 4 manual/code-review.

---

## Open Questions (non-blocking)

1. **`__Host-` cookie prefix in local dev**: Strict semantics require `Secure` which won't fire on `http://localhost:3000`. The plan falls back to non-prefixed names in dev; flip at build time via `process.env.NODE_ENV`.
2. **Welcome email fire from OAuth path**: symmetric with email-verify path from Phase 2. Non-blocking — if Resend dev stub errors, the user still reaches dashboard.
3. **`sendWelcomeEmail` needs a `displayName` param**: Phase 2's `send.ts` already supports this (it's used in the email-verify → welcome chain). No change needed.
4. **Google Cloud Console setup**: registering the app + adding the callback URI is a one-time deploy-time task, documented in Phase 5 DEPLOY-01.

---

*Research completed: 2026-04-14*
*Ready for planning: yes*
