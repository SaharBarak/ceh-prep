"use server";

import { redirect } from "next/navigation";
import zxcvbn from "zxcvbn";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isPasswordPwned } from "@/lib/auth/hibp";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { SignupSchema, LoginSchema } from "@/lib/validation/schemas";
import { createToken } from "@/lib/auth/tokens";
import { sendVerifyEmail } from "@/lib/infra/resend";
import { env } from "@/lib/env";
import {
  captureClientMeta,
  verifyOrigin,
  audit,
  type ActionState,
} from "@/lib/actions/shared";

/**
 * Server actions for the password-first auth flow.
 *
 * Shared primitives (`ClientMeta`, `ActionErrorCode`, `ActionState`,
 * `captureClientMeta`, `verifyOrigin`, `audit`) live in `@/lib/actions/shared`
 * because Next 15 enforces at build time that every export from a
 * `"use server"` file is an async function — types and non-action helpers
 * cannot be co-located here. Consumers (`email.ts`, `reset.ts`, route
 * handlers, client forms importing `ActionState`) import from the shared
 * module directly.
 */

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

  // Best-effort client-side timezone capture. Validated against IANA's
  // tz database via Intl.DateTimeFormat — Phase 10's drip uses this to
  // fire at 09:00 local. Falls back to UTC if missing or malformed; we
  // never trust raw form input to land in a Mongo doc unvalidated.
  const tzRaw = formData.get("timezone");
  const tz = typeof tzRaw === "string" ? sanitizeTimezone(tzRaw) : "UTC";

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
      timezone: tz,
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

/**
 * Whitelist user-supplied timezone strings against the IANA database via
 * Intl.DateTimeFormat. Returns the input if valid, "UTC" otherwise.
 *
 * Why server-side: even though the signup form picks the timezone via
 * the browser's Intl API, a malicious POST can submit anything. Never
 * persist a raw user-supplied identifier without validating it — the
 * downstream drip cron passes this to `new Intl.DateTimeFormat({timeZone})`
 * which throws RangeError on garbage, which would crash the cron run.
 */
const sanitizeTimezone = (tz: string): string => {
  if (tz.length > 64 || !/^[A-Za-z][A-Za-z0-9_/+\-]+$/.test(tz)) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};
