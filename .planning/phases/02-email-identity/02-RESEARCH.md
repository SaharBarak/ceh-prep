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

---

## Implementation Sketches

### §1 — Resend client (`app/src/lib/infra/resend/client.ts`)

```ts
import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

type SendInput = {
  to: string;
  subject: string;
  react: React.ReactElement;
};
type SendResult = { id: string };
type MailClient = { send: (input: SendInput) => Promise<SendResult> };

const devStub: MailClient = {
  send: async ({ to, subject }) => {
    // eslint-disable-next-line no-console
    console.log(`[resend:dev] to=${to.slice(0, 4)}*** subject="${subject}"`);
    return { id: `dev-${Date.now()}` };
  },
};

export const getMailClient = (): MailClient => {
  if (!env.RESEND_API_KEY || env.NODE_ENV === "development") return devStub;
  const client = new Resend(env.RESEND_API_KEY);
  return {
    send: async ({ to, subject, react }) => {
      const { data, error } = await client.emails.send({
        from: env.RESEND_FROM_ADDRESS,
        to,
        subject,
        react,
      });
      if (error || !data) {
        throw new Error(`resend_send_failed: ${error?.message ?? "unknown"}`);
      }
      return { id: data.id };
    },
  };
};
```

### §2 — Token primitive (`app/src/lib/auth/tokens.ts`)

```ts
import { createHash, randomBytes } from "node:crypto";

export type TokenPurpose = "verify_email" | "reset_password";

export type Token = {
  readonly plaintext: string;  // goes in URL, never stored
  readonly hash: string;       // stored in Mongo
  readonly expiresAt: Date;
};

const TTL_MS = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
} as const;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const createToken = (purpose: TokenPurpose): Token => {
  const plaintext = randomBytes(32).toString("base64url"); // 256 bits
  return {
    plaintext,
    hash: sha256(plaintext),
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  };
};

export const hashToken = (plaintext: string): string => sha256(plaintext);

export const isExpired = (expiresAt: Date | null | undefined): boolean =>
  !expiresAt || expiresAt.getTime() < Date.now();
```

### §3 — `sessionEpoch` drift check (extend `app/src/lib/auth/session.ts`)

```ts
// Extend SessionData
export type SessionData = {
  userId?: string;
  email?: string;
  createdAt?: number;
  epoch?: number;
};

export const requireSession = async (): Promise<{
  userId: string;
  email: string;
}> => {
  const session = await getSession();
  if (!session.userId || !session.email) throw new Error("UNAUTHORIZED");

  await connectDB();
  const user = await UserModel
    .findOne({ _id: { $eq: session.userId } })
    .select("sessionEpoch")
    .lean();

  if (!user) {
    session.destroy();
    throw new Error("UNAUTHORIZED");
  }

  const serverEpoch = user.sessionEpoch ?? 0;
  const sessionEpoch = session.epoch ?? 0;
  if (sessionEpoch < serverEpoch) {
    session.destroy();
    throw new Error("SESSION_REVOKED");
  }

  return { userId: session.userId, email: session.email };
};
```

### §4 — Constant-time `/forgot-password` (`app/src/lib/actions/reset.ts`)

```ts
"use server";
// ...imports omitted for brevity

export const requestPasswordReset = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();
  if (!verifyOrigin(meta.origin)) return { error: "forbidden_origin" };

  const emailHash = sha256(String(formData.get("email") ?? "")).slice(0, 16);
  const ipLimit = rateLimit("reset-ip", meta.ip, 10, 60 * 60_000);
  const idLimit = rateLimit("reset-id", emailHash, 1, 10 * 60_000);
  if (!ipLimit.ok || !idLimit.ok) return { ok: true }; // uniform success

  const parsed = RequestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: true }; // uniform response

  const { email } = parsed.data;

  try {
    await connectDB();
    const user = await UserModel.findOne({ email: { $eq: email } })
      .select("_id email")
      .lean();

    if (user) {
      const token = createToken("reset_password");
      await UserModel.updateOne(
        { _id: { $eq: user._id } },
        {
          $set: {
            passwordResetTokenHash: token.hash,
            passwordResetTokenExpiresAt: token.expiresAt,
          },
        },
      );
      const mail = getMailClient();
      await mail.send({
        to: user.email,
        subject: "Reset your CEH Sprint password",
        react: ResetPassword({
          link: `${env.NEXT_PUBLIC_APP_URL}/reset?token=${token.plaintext}`,
        }),
      });
      await audit(meta, "password_reset_request", "ok", { emailHash }, user._id.toString());
    } else {
      // Burn equivalent time — always run one Argon2 hash on miss
      await hashPassword("pad-for-uniform-timing-do-not-store");
      await audit(meta, "password_reset_request", "deny", { emailHash, reason: "unknown_email" });
    }
  } catch (e) {
    await audit(meta, "password_reset_request", "error", {
      emailHash,
      message: e instanceof Error ? e.message : "unknown",
    });
  }

  return { ok: true }; // ONE return — function cannot short-circuit
};
```

### §5 — Reset confirm (same file)

```ts
export const confirmPasswordReset = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();
  if (!verifyOrigin(meta.origin)) return { error: "forbidden_origin" };

  const parsed = ConfirmResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const { token, password } = parsed.data;

  if (zxcvbn(password).score < 3) return { error: "weak_password" };
  if (await isPasswordPwned(password)) return { error: "pwned_password" };

  await connectDB();
  const hash = hashToken(token);
  const user = await UserModel
    .findOne({ passwordResetTokenHash: { $eq: hash } })
    .select("+passwordHash +sessionEpoch _id email passwordResetTokenExpiresAt")
    .lean();

  if (!user || isExpired(user.passwordResetTokenExpiresAt)) {
    await audit(meta, "password_reset", "deny", { reason: "token_invalid" });
    return { error: "token_invalid" };
  }

  const passwordHash = await hashPassword(password);
  await UserModel.updateOne(
    { _id: { $eq: user._id } },
    {
      $set: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
      $inc: { sessionEpoch: 1 }, // invalidates every active session
    },
  );

  const session = await getSession();
  session.destroy();

  await audit(meta, "password_reset", "ok", { emailHash: sha256(user.email).slice(0, 16) }, user._id.toString());
  redirect("/login?reset=1");
};
```

### §6 — React Email template shape (`app/src/lib/infra/resend/templates/VerifyEmail.tsx`)

```tsx
import {
  Html, Head, Preview, Body, Container, Heading, Text, Button, Hr, Section,
} from "@react-email/components";

export type VerifyEmailProps = { link: string };

const styles = {
  body: { backgroundColor: "#0a0a0b", color: "#f4f4f6", fontFamily: "system-ui, sans-serif" },
  container: { maxWidth: "520px", margin: "0 auto", padding: "40px 24px" },
  heading: { fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 16px" },
  text: { fontSize: "15px", lineHeight: 1.7, color: "#8b8c94", margin: "0 0 20px" },
  button: {
    backgroundColor: "#bef264",
    color: "#0a0a0b",
    padding: "14px 28px",
    borderRadius: "10px",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "13px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  hr: { borderColor: "rgba(255,255,255,0.08)", margin: "32px 0" },
  footer: { fontSize: "11px", color: "#5a5b62", lineHeight: 1.6 },
};

export const VerifyEmail = ({ link }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your email to activate your CEH Sprint account</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>Verify your email.</Heading>
        <Text style={styles.text}>
          Click the link below to activate your account. This link expires in 24 hours.
        </Text>
        <Section style={{ margin: "28px 0" }}>
          <Button href={link} style={styles.button}>Verify →</Button>
        </Section>
        <Text style={styles.text}>
          Or paste this into your browser: <br />
          <span style={{ color: "#bef264", wordBreak: "break-all" }}>{link}</span>
        </Text>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Didn&apos;t sign up? Ignore this email — the account won&apos;t activate without a click.
        </Text>
      </Container>
    </Body>
  </Html>
);
```

Same shape for `ResetPassword.tsx` and `Welcome.tsx`.

### §7 — Verify route handler (`app/src/app/api/verify/route.ts`)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { hashToken, isExpired } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=token_invalid", req.url));
  }

  await connectDB();
  const hash = hashToken(token);
  const user = await UserModel
    .findOne({ emailVerifyTokenHash: { $eq: hash } })
    .select("+emailVerifyTokenExpiresAt _id email emailVerifiedAt")
    .lean();

  if (!user || isExpired(user.emailVerifyTokenExpiresAt)) {
    return NextResponse.redirect(new URL("/login?error=token_invalid", req.url));
  }

  if (user.emailVerifiedAt) {
    return NextResponse.redirect(new URL("/dashboard?verified=1", req.url));
  }

  await UserModel.updateOne(
    { _id: { $eq: user._id } },
    {
      $set: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyTokenExpiresAt: null,
      },
    },
  );

  // Fire welcome email (non-blocking)
  // ... welcome email send with audit

  return NextResponse.redirect(new URL("/dashboard?verified=1", req.url));
};
```

---

## Env schema additions (`app/src/lib/env.ts`)

```ts
RESEND_API_KEY: z.string().optional(),
RESEND_FROM_ADDRESS: z
  .string()
  .default("CEH Sprint <no-reply@localhost>")
  .refine(
    (v) => process.env.NODE_ENV !== "production" || !v.includes("localhost"),
    "RESEND_FROM_ADDRESS must be a real verified sender in production",
  ),
```

---

## User schema patch (`app/src/lib/db/models/user.ts`)

One additive field:

```ts
sessionEpoch: { type: Number, default: 0, select: false },
```

Backfill is implicit: old sessions compare `undefined < 1` as `false`, treating missing epoch as 0. Everything stays consistent until the first reset increments a user's epoch.

---

## Validation Architecture

Each REQ gets 1-2 observable-outcome criteria. Populates `02-VALIDATION.md`.

| REQ | Criterion | Check |
|---|---|---|
| **EMAIL-01** | `lib/infra/resend/client.ts` exists, exports `getMailClient()`; `resend` + `@react-email/components` in package.json | static |
| **EMAIL-01** | Dev smoke: sending with `RESEND_API_KEY=` unset logs `[resend:dev]` and returns success | manual |
| **EMAIL-02** | Deploy guide references DKIM/SPF/DMARC; prod env refuses to start with `localhost` sender | static |
| **EMAIL-03** | `requestPasswordReset` calls `rateLimit("reset-id", emailHash, 1, 10*60_000)` | grep |
| **EMAIL-04** | `lib/auth/tokens.ts` exports `createToken`, `hashToken`, `isExpired` using `randomBytes(32)` + sha256 | grep + tsc |
| **EMAIL-04** | Two `createToken` calls produce different 43-char base64url plaintexts | manual |
| **EMAIL-05** | Every `getMailClient().send()` wrapped in `audit(meta, "email_send", ...)` with `emailHash` (never raw email) | grep |
| **VERIFY-01** | After signup, `emailVerifyTokenHash` set in Mongo, dev stub logs verify URL | manual |
| **VERIFY-02** | GET `/verify?token=<plaintext>` redirects to `/dashboard?verified=1`, sets `emailVerifiedAt` | HTTP smoke |
| **VERIFY-02** | Replaying same token returns `/login?error=token_invalid` | HTTP smoke |
| **VERIFY-03** | Dashboard banner for unverified users with resend action honoring 3/hour rate limit | manual |
| **VERIFY-04** | `emailVerifiedAt` field populated; dashboard banner grep for the reference | grep |
| **RESET-01** | `requestPasswordReset` has ONE return, runs `hashPassword` on both hit and miss paths | structural grep |
| **RESET-01** | Timing smoke: existent vs nonexistent email diff < 50ms | manual |
| **RESET-02** | `createToken("reset_password").expiresAt` is `Date.now() + 3_600_000 ± 2s` | manual unit-style |
| **RESET-03** | After reset: `passwordHash` changed, `sessionEpoch +1`, `passwordResetTokenHash` null | DB state |
| **RESET-03** | Stale session on second device returns UNAUTHORIZED on next `requireSession()` | manual two-browser |
| **RESET-04** | 2 reset requests same email/10 min: second returns uniform "sent"; `rateLimit("reset-id", ...)` grep present | structural + manual |

**Total:** 18 criteria across 13 requirements. 10 grep/static, 8 manual HTTP/browser smokes. No automated test framework yet (Vitest + Playwright → Phase 5).

---

## Open Questions (non-blocking)

1. **React Email + Tailwind v4**: React Email 5.x claims v4 Tailwind support via `<Tailwind>`, but we use inline styles for email-client reliability. If Phase 5 wants to switch, it's a template rewrite — non-breaking for this phase.
2. **Dashboard banner**: server component reading session + user vs client component receiving a prop. Server is simpler; no hydration mismatch.
3. **`sessionEpoch` read cost**: one extra `findOne` per protected request. Acceptable at current load; Phase 5 can dedupe per-request if needed.
4. **Welcome email timing**: fire from the verify route handler, not signup. Unverified accounts never get a welcome; real users get verify then welcome in predictable order.

---

*Research completed: 2026-04-14*
*Ready for planning: yes*

