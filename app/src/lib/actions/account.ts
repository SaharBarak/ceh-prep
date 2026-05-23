"use server";

import { revalidatePath } from "next/cache";
import zxcvbn from "zxcvbn";
import {
  captureClientMeta,
  verifyOrigin,
  audit,
  type ActionState,
} from "@/lib/actions/shared";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { getSession, requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isPasswordPwned } from "@/lib/auth/hibp";
import { rateLimit } from "@/lib/auth/rate-limit";
import { z } from "zod";

/**
 * Server actions for /account/settings.
 *
 * Mirrors the auth/email/reset action shape: capture ClientMeta first,
 * verify origin (CSRF), rate-limit, require session, perform the
 * mutation, audit on every branch, return ActionState.
 */

/* ─────────────────────────────
   Display name
   ───────────────────────────── */

const DisplayNameSchema = z.object({
  displayName: z.string().trim().max(60),
});

export const updateDisplayName = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "account_update_name", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { error: "invalid_credentials" };
  }

  const parsed = DisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    await audit(meta, "account_update_name", "deny", { reason: "invalid_input" }, userId);
    return { error: "invalid_input" };
  }

  try {
    await connectDB();
    await UserModel.updateOne(
      { _id: { $eq: userId } },
      { $set: { displayName: parsed.data.displayName } },
    );
    await audit(meta, "account_update_name", "ok", {}, userId);
    revalidatePath("/account/settings");
    return { ok: true };
  } catch (e) {
    await audit(meta, "account_update_name", "error", {
      message: e instanceof Error ? e.message : "unknown",
    }, userId);
    return { error: "server_error" };
  }
};

/* ─────────────────────────────
   Password change (in-session)
   ───────────────────────────── */

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export const changePassword = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "account_change_password", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  const ipLimit = rateLimit("change-password-ip", meta.ip, 5, 60 * 60_000);
  if (!ipLimit.ok) {
    await audit(meta, "account_change_password", "deny", { reason: "rate_limit_ip" });
    return { error: "rate_limited" };
  }

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { error: "invalid_credentials" };
  }

  const parsed = PasswordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    await audit(meta, "account_change_password", "deny", { reason: "invalid_input" }, userId);
    return { error: "invalid_input" };
  }

  const { currentPassword, newPassword } = parsed.data;

  if (zxcvbn(newPassword).score < 3) {
    await audit(meta, "account_change_password", "deny", { reason: "weak_password" }, userId);
    return { error: "weak_password" };
  }

  if (await isPasswordPwned(newPassword)) {
    await audit(meta, "account_change_password", "deny", { reason: "pwned_password" }, userId);
    return { error: "pwned_password" };
  }

  try {
    await connectDB();
    const user = await UserModel.findOne({ _id: { $eq: userId } })
      .select("+passwordHash +sessionEpoch _id email")
      .lean<{
        _id: { toString(): string };
        passwordHash: string;
        sessionEpoch?: number;
      } | null>();

    if (!user) {
      return { error: "invalid_credentials" };
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash).catch(() => false);
    if (!ok) {
      await audit(meta, "account_change_password", "deny", { reason: "wrong_current" }, userId);
      return { error: "invalid_credentials" };
    }

    const newHash = await hashPassword(newPassword);

    // $inc sessionEpoch invalidates every OTHER session; we then re-stamp
    // the current iron-session with the new epoch so the user stays logged
    // in on this device.
    const after = await UserModel.findOneAndUpdate(
      { _id: { $eq: userId } },
      { $set: { passwordHash: newHash }, $inc: { sessionEpoch: 1 } },
      { new: true, projection: { sessionEpoch: 1 } },
    )
      .select("+sessionEpoch")
      .lean<{ sessionEpoch?: number } | null>();

    const session = await getSession();
    session.epoch = after?.sessionEpoch ?? (user.sessionEpoch ?? 0) + 1;
    await session.save();

    await audit(meta, "account_change_password", "ok", {}, userId);
    return { ok: true };
  } catch (e) {
    await audit(meta, "account_change_password", "error", {
      message: e instanceof Error ? e.message : "unknown",
    }, userId);
    return { error: "server_error" };
  }
};

/* ─────────────────────────────
   Revoke all other sessions
   ───────────────────────────── */

export const revokeAllSessions = async (
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "account_revoke_sessions", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { error: "invalid_credentials" };
  }

  try {
    await connectDB();
    const after = await UserModel.findOneAndUpdate(
      { _id: { $eq: userId } },
      { $inc: { sessionEpoch: 1 } },
      { new: true, projection: { sessionEpoch: 1 } },
    )
      .select("+sessionEpoch")
      .lean<{ sessionEpoch?: number } | null>();

    const session = await getSession();
    session.epoch = after?.sessionEpoch ?? 0;
    await session.save();

    await audit(meta, "account_revoke_sessions", "ok", {}, userId);
    return { ok: true };
  } catch (e) {
    await audit(meta, "account_revoke_sessions", "error", {
      message: e instanceof Error ? e.message : "unknown",
    }, userId);
    return { error: "server_error" };
  }
};

/* ─────────────────────────────
   Marketing flags
   ───────────────────────────── */

const MarketingFlagsSchema = z.object({
  marketingOptOut: z.enum(["on", "off"]),
  marketingNudgeOptOut: z.enum(["on", "off"]),
});

export const updateMarketingFlags = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "account_marketing_flags", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { error: "invalid_credentials" };
  }

  // Checkbox semantics: when unchecked, the field is absent from the FormData.
  // Normalize to "on"/"off" before parsing so the schema gives us a strict
  // boolean-equivalent.
  const raw = {
    marketingOptOut: formData.get("marketingOptOut") ? "on" : "off",
    marketingNudgeOptOut: formData.get("marketingNudgeOptOut") ? "on" : "off",
  };

  const parsed = MarketingFlagsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "invalid_input" };
  }

  try {
    await connectDB();
    await UserModel.updateOne(
      { _id: { $eq: userId } },
      {
        $set: {
          marketingOptOut: parsed.data.marketingOptOut === "on",
          marketingNudgeOptOut: parsed.data.marketingNudgeOptOut === "on",
        },
      },
    );
    await audit(meta, "account_marketing_flags", "ok", {
      optOut: parsed.data.marketingOptOut === "on",
      nudgeOptOut: parsed.data.marketingNudgeOptOut === "on",
    }, userId);
    revalidatePath("/account/settings");
    return { ok: true };
  } catch (e) {
    await audit(meta, "account_marketing_flags", "error", {
      message: e instanceof Error ? e.message : "unknown",
    }, userId);
    return { error: "server_error" };
  }
};
