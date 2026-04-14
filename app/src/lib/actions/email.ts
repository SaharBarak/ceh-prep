"use server";

import { createHash } from "node:crypto";
import {
  captureClientMeta,
  verifyOrigin,
  audit,
  type ActionState,
} from "@/lib/actions/shared";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { requireSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { createToken } from "@/lib/auth/tokens";
import { sendVerifyEmail } from "@/lib/infra/resend";
import { env } from "@/lib/env";

/**
 * Short, non-reversible fingerprint of an email address for audit payloads.
 * sha256(email) + first 12 hex chars — standardized with lib/infra/resend/send.ts
 * (CONTEXT.md §"Audit surface"). Never persisted beyond the audit row.
 */
const emailHash = (email: string): string =>
  createHash("sha256").update(email).digest("hex").slice(0, 12);

/**
 * Resend the email-verification link for the currently logged-in user.
 * Rate-limited at 3 per hour per email-hash AND 10 per hour per IP
 * (defense in depth — one IP can't hammer many accounts, one account
 * can't be flooded from many IPs).
 *
 * Benign paths (already verified) return uniform success — the UI never
 * reveals whether the account in session has already been verified on
 * another tab, which is the right default for this form.
 *
 * Uses `requireSession()` (not `getSession`) so the Phase 2 sessionEpoch
 * drift check fires here: a stale session whose epoch lags (e.g. after a
 * password reset on a second device) is destroyed and throws, and we
 * surface that to the caller as `invalid_credentials`. This is the
 * load-bearing guarantee for RESET-03 — do NOT swap back to `getSession`.
 */
export const resendVerificationEmail = async (
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "email_resend_verify", "deny", {
      reason: "origin_mismatch",
    });
    return { error: "forbidden_origin" };
  }

  const ipLimit = rateLimit("resend-verify-ip", meta.ip, 10, 60 * 60_000);
  if (!ipLimit.ok) {
    await audit(meta, "email_resend_verify", "deny", {
      reason: "rate_limit_ip",
    });
    return { error: "rate_limited" };
  }

  let userId: string;
  let userEmail: string;
  try {
    const s = await requireSession();
    userId = s.userId;
    userEmail = s.email;
  } catch {
    return { error: "invalid_credentials" };
  }

  const hash = emailHash(userEmail);
  const idLimit = rateLimit("resend-verify-id", hash, 3, 60 * 60_000);
  if (!idLimit.ok) {
    await audit(
      meta,
      "email_resend_verify",
      "deny",
      { reason: "rate_limit_id", emailHash: hash },
      userId,
    );
    return { error: "rate_limited" };
  }

  try {
    await connectDB();
    const user = await UserModel.findOne({ _id: { $eq: userId } })
      .select(
        "+emailVerifyTokenHash +emailVerifyTokenExpiresAt _id email emailVerifiedAt",
      )
      .lean<{
        _id: { toString(): string };
        email: string;
        emailVerifiedAt: Date | null;
      } | null>();

    if (!user) {
      await audit(meta, "email_resend_verify", "deny", {
        reason: "no_user",
        emailHash: hash,
      });
      return { error: "invalid_credentials" };
    }

    if (user.emailVerifiedAt) {
      await audit(
        meta,
        "email_resend_verify",
        "ok",
        { reason: "already_verified", emailHash: hash },
        user._id.toString(),
      );
      return {};
    }

    const token = createToken("verify_email");
    await UserModel.updateOne(
      { _id: { $eq: user._id } },
      {
        $set: {
          emailVerifyTokenHash: token.hash,
          emailVerifyTokenExpiresAt: token.expiresAt,
        },
      },
    );

    const result = await sendVerifyEmail({
      to: user.email,
      link: `${env.NEXT_PUBLIC_APP_URL}/api/verify?token=${token.plaintext}`,
      meta,
      userId: user._id.toString(),
    });

    if (!result.ok) {
      return { error: "email_send_failed" };
    }

    return {};
  } catch (e) {
    await audit(meta, "email_resend_verify", "error", {
      emailHash: hash,
      message: e instanceof Error ? e.message : "unknown",
    });
    return { error: "server_error" };
  }
};
