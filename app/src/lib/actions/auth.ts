"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import zxcvbn from "zxcvbn";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { AuditModel } from "@/lib/db/models/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isPasswordPwned } from "@/lib/auth/hibp";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { SignupSchema, LoginSchema } from "@/lib/validation/schemas";
import { createToken } from "@/lib/auth/tokens";
import { sendVerifyEmail } from "@/lib/infra/resend";
import { env } from "@/lib/env";

export type ActionErrorCode =
  | "invalid_input"
  | "weak_password"
  | "pwned_password"
  | "email_taken"
  | "invalid_credentials"
  | "rate_limited"
  | "forbidden_origin"
  | "locked"
  | "server_error"
  | "email_send_failed"
  | "token_invalid"
  | "token_expired"
  | "already_verified";

export type ActionState = { error?: ActionErrorCode };

/**
 * Request-scoped client metadata captured once at the entry point of every
 * server action, BEFORE any `await` that could tear down the Next.js
 * AsyncLocalStorage request scope (notably `connectDB()` against a slow or
 * unreachable Mongo host). Downstream helpers (`audit`, `rateLimit`,
 * `verifyOrigin`) receive this object explicitly and never re-enter the
 * request headers API themselves — that's the whole point of the pattern.
 */
export type ClientMeta = {
  readonly ip: string;
  readonly ua: string;
  readonly origin: string;
};

/* ─────────────────────────────
   Security helpers
   ───────────────────────────── */

/**
 * Read the request headers exactly once, synchronously at action entry, and
 * freeze the values into a plain object. This is the ONLY function in this
 * module that touches `next/headers`. Every other helper takes a `ClientMeta`
 * parameter so the async tail of an action never re-enters AsyncLocalStorage.
 */
export const captureClientMeta = async (): Promise<ClientMeta> => {
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

/**
 * Reject requests whose Origin header doesn't match our app URL. Works in
 * concert with SameSite=Strict cookies to kill CSRF for server actions.
 */
export const verifyOrigin = (origin: string): boolean => {
  if (!origin) return false;
  try {
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    const reqUrl = new URL(origin);
    return appUrl.host === reqUrl.host;
  } catch {
    return false;
  }
};

/**
 * Pure audit sink. Takes the pre-captured `ClientMeta` as its first argument
 * and never touches the Next.js request headers API. Must never throw —
 * audit failures are swallowed so they can't cascade into the auth flow.
 */
export const audit = async (
  meta: ClientMeta,
  event: string,
  outcome: "ok" | "deny" | "error",
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> => {
  try {
    await AuditModel.create({
      event,
      outcome,
      ip: meta.ip,
      ua: meta.ua,
      meta: payload,
      userId: userId ?? null,
    });
  } catch {
    // Audit failures must never break the auth flow
  }
};

/* ─────────────────────────────
   Signup
   ───────────────────────────── */

export const signup = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "signup", "deny", { reason: "origin_mismatch", origin: meta.origin });
    return { error: "forbidden_origin" };
  }

  const limit = rateLimit("signup", meta.ip, 5, 60_000);
  if (!limit.ok) {
    await audit(meta, "signup", "deny", { reason: "rate_limit" });
    return { error: "rate_limited" };
  }

  const parsed = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) return { error: "invalid_input" };

  const { email, password, displayName } = parsed.data;

  // Strength gate — zxcvbn score 0–4, we require >=3
  const strength = zxcvbn(password);
  if (strength.score < 3) {
    await audit(meta, "signup", "deny", { reason: "weak_password", email });
    return { error: "weak_password" };
  }

  // HaveIBeenPwned k-anonymity check
  if (await isPasswordPwned(password)) {
    await audit(meta, "signup", "deny", { reason: "pwned_password", email });
    return { error: "pwned_password" };
  }

  try {
    await connectDB();

    // Defeat email enumeration by always doing the work uniformly.
    const existing = await UserModel.findOne({ email: { $eq: email } }).lean();
    if (existing) {
      await audit(meta, "signup", "deny", { reason: "email_taken", email });
      return { error: "email_taken" };
    }

    const passwordHash = await hashPassword(password);
    const doc = await UserModel.create({
      email,
      passwordHash,
      displayName: displayName ?? "",
      tier: "free",
      lastLoginAt: new Date(),
    });

    const session = await getSession();
    session.userId = doc._id.toString();
    session.email = doc.email;
    session.createdAt = Date.now();
    session.epoch = 0;
    await session.save();

    // Phase 2: issue email-verify token, persist hash, send link.
    // Failures never block signup — sendVerifyEmail never throws (Plan 02-04
    // contract), so on `{ok:false}` the user still lands on /dashboard with
    // the unverified banner and can click "resend" from there.
    const verifyToken = createToken("verify_email");
    await UserModel.updateOne(
      { _id: { $eq: doc._id } },
      {
        $set: {
          emailVerifyTokenHash: verifyToken.hash,
          emailVerifyTokenExpiresAt: verifyToken.expiresAt,
        },
      },
    );
    await sendVerifyEmail({
      to: doc.email,
      link: `${env.NEXT_PUBLIC_APP_URL}/api/verify?token=${verifyToken.plaintext}`,
      meta,
      userId: doc._id.toString(),
    });

    await audit(meta, "signup", "ok", { email }, doc._id.toString());
  } catch (e) {
    await audit(meta, "signup", "error", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { error: "server_error" };
  }

  redirect("/dashboard");
};

/* ─────────────────────────────
   Login
   ───────────────────────────── */

export const login = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "login", "deny", { reason: "origin_mismatch", origin: meta.origin });
    return { error: "forbidden_origin" };
  }

  const limit = rateLimit("login", meta.ip, 10, 60_000);
  if (!limit.ok) {
    await audit(meta, "login", "deny", { reason: "rate_limit" });
    return { error: "rate_limited" };
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const { email, password } = parsed.data;

  try {
    await connectDB();

    const user = await UserModel.findOne({ email: { $eq: email } })
      .select("+passwordHash +failedLoginCount +lockedUntil +sessionEpoch")
      .lean<{
        _id: { toString(): string };
        email: string;
        passwordHash: string;
        failedLoginCount?: number;
        lockedUntil?: Date | null;
        sessionEpoch?: number;
      } | null>();

    // Uniform timing: always run verify even when user missing, against a
    // throwaway hash, so an observer can't tell if the email exists.
    const storedHash = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g";
    const valid = await verifyPassword(password, storedHash).catch(() => false);

    if (!user || !valid) {
      await audit(meta, "login", "deny", { reason: "invalid_credentials", email });
      return { error: "invalid_credentials" };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await audit(meta, "login", "deny", { reason: "locked", email }, user._id.toString());
      return { error: "locked" };
    }

    await UserModel.updateOne(
      { _id: { $eq: user._id } },
      {
        $set: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      },
    );

    const session = await getSession();
    session.userId = user._id.toString();
    session.email = user.email;
    session.createdAt = Date.now();
    session.epoch = user.sessionEpoch ?? 0;
    await session.save();

    await audit(meta, "login", "ok", { email }, user._id.toString());
  } catch (e) {
    await audit(meta, "login", "error", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { error: "server_error" };
  }

  redirect("/dashboard");
};

/* ─────────────────────────────
   Logout
   ───────────────────────────── */

export const logout = async (): Promise<void> => {
  const meta = await captureClientMeta();
  const session = await getSession();
  const userId = session.userId;
  session.destroy();
  if (userId) {
    await audit(meta, "logout", "ok", {}, userId);
  }
  redirect("/");
};
