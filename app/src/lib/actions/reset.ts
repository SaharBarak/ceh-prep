"use server";

import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import zxcvbn from "zxcvbn";
import {
  captureClientMeta,
  verifyOrigin,
  audit,
  type ActionState,
} from "@/lib/actions/shared";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { isPasswordPwned } from "@/lib/auth/hibp";
import { createToken, hashToken, isExpired } from "@/lib/auth/tokens";
import { sendResetPasswordEmail } from "@/lib/infra/resend";
import {
  RequestResetSchema,
  ConfirmResetSchema,
} from "@/lib/validation/schemas";
import { env } from "@/lib/env";

const emailHash = (email: string): string =>
  createHash("sha256").update(email).digest("hex").slice(0, 12);

/**
 * CONSTANT-TIME PASSWORD RESET REQUEST.
 *
 * PITFALLS.md #8 — enumeration-safe: the response is IDENTICAL whether the
 * email exists or not, whether rate limits hit, whether parse fails. Exactly
 * ONE return statement at the body top level (`return {}` at the end) —
 * the function CANNOT short-circuit on "email not found".
 *
 * Only exception: origin_mismatch is CSRF, not timing-sensitive.
 *
 * Uniform compute cost via a throwaway hashPassword call on the miss path.
 */
export const requestPasswordReset = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "password_reset_request", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  const rawEmail = String(formData.get("email") ?? "");
  const hash = emailHash(rawEmail);

  const ipLimit = rateLimit("reset-ip", meta.ip, 10, 60 * 60_000);
  const idLimit = rateLimit("reset-id", hash, 1, 10 * 60_000);
  const parsed = RequestResetSchema.safeParse({ email: rawEmail });

  // Everything from here falls through to the single `return {}` at the
  // bottom. NO early returns for deny / parse-fail / miss / send-fail.
  try {
    if (ipLimit.ok && idLimit.ok && parsed.success) {
      const { email } = parsed.data;
      await connectDB();
      const user = await UserModel.findOne({ email: { $eq: email } })
        .select("_id email")
        .lean<{ _id: { toString(): string }; email: string } | null>();

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
        await sendResetPasswordEmail({
          to: user.email,
          link: `${env.NEXT_PUBLIC_APP_URL}/reset?token=${token.plaintext}`,
          meta,
          userId: user._id.toString(),
        });
        await audit(
          meta,
          "password_reset_request",
          "ok",
          { emailHash: hash },
          user._id.toString(),
        );
      } else {
        // Burn equivalent time — always run one hashPassword on miss so the
        // response timing matches the hit path to within sub-50ms.
        await hashPassword("pad-for-uniform-timing-do-not-store");
        await audit(meta, "password_reset_request", "deny", {
          reason: "unknown_email",
          emailHash: hash,
        });
      }
    } else if (!ipLimit.ok) {
      // Still burn the pad so denials from rate-limit don't short-circuit timing.
      await hashPassword("pad-for-uniform-timing-do-not-store");
      await audit(meta, "password_reset_request", "deny", {
        reason: "rate_limit_ip",
        emailHash: hash,
      });
    } else if (!idLimit.ok) {
      await hashPassword("pad-for-uniform-timing-do-not-store");
      await audit(meta, "password_reset_request", "deny", {
        reason: "rate_limit_id",
        emailHash: hash,
      });
    } else {
      // parse failure
      await hashPassword("pad-for-uniform-timing-do-not-store");
      await audit(meta, "password_reset_request", "deny", {
        reason: "invalid_input",
        emailHash: hash,
      });
    }
  } catch (e) {
    await audit(meta, "password_reset_request", "error", {
      emailHash: hash,
      message: e instanceof Error ? e.message : "unknown",
    });
  }

  // ONE return — enumeration-safe
  return {};
};

/**
 * Confirm the reset. Validates the token against the stored hash (with $eq),
 * runs zxcvbn >= 3 + HIBP check, rotates passwordHash, invalidates every
 * active session for that user via $inc on sessionEpoch, destroys the
 * current iron-session, redirects to /login?reset=1. User must re-login.
 */
export const confirmPasswordReset = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "password_reset", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  const parsed = ConfirmResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    await audit(meta, "password_reset", "deny", { reason: "invalid_input" });
    return { error: "invalid_input" };
  }

  const { token, password } = parsed.data;

  if (zxcvbn(password).score < 3) {
    await audit(meta, "password_reset", "deny", { reason: "weak_password" });
    return { error: "weak_password" };
  }

  if (await isPasswordPwned(password)) {
    await audit(meta, "password_reset", "deny", { reason: "pwned_password" });
    return { error: "pwned_password" };
  }

  try {
    await connectDB();
    const hash = hashToken(token);
    const user = await UserModel.findOne({
      passwordResetTokenHash: { $eq: hash },
    })
      .select(
        "+passwordHash +passwordResetTokenHash +passwordResetTokenExpiresAt +sessionEpoch _id email",
      )
      .lean<{
        _id: { toString(): string };
        email: string;
        passwordResetTokenExpiresAt: Date | null;
      } | null>();

    if (!user) {
      await audit(meta, "password_reset", "deny", { reason: "token_invalid" });
      return { error: "token_invalid" };
    }

    if (isExpired(user.passwordResetTokenExpiresAt)) {
      await audit(
        meta,
        "password_reset",
        "deny",
        { reason: "token_expired" },
        user._id.toString(),
      );
      return { error: "token_expired" };
    }

    const newHash = await hashPassword(password);
    await UserModel.updateOne(
      { _id: { $eq: user._id } },
      {
        $set: {
          passwordHash: newHash,
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
        },
        $inc: { sessionEpoch: 1 },
      },
    );

    const session = await getSession();
    session.destroy();

    await audit(
      meta,
      "password_reset",
      "ok",
      { emailHash: emailHash(user.email) },
      user._id.toString(),
    );
  } catch (e) {
    await audit(meta, "password_reset", "error", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { error: "server_error" };
  }

  redirect("/login?reset=1");
};
