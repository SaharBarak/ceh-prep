import "server-only";
import { createHash } from "node:crypto";
import type { ReactElement } from "react";
import { getMailClient } from "./client";
import { VerifyEmail } from "./templates/VerifyEmail";
import { ResetPassword } from "./templates/ResetPassword";
import { Welcome } from "./templates/Welcome";
import { audit, type ClientMeta } from "@/lib/actions/shared";

export type SendKind = "verify" | "reset" | "welcome";

export type SendOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: "email_send_failed" };

type SendArgs = {
  readonly to: string;
  readonly meta: ClientMeta;
  readonly userId?: string;
};

/**
 * Short, non-reversible fingerprint of an email address for audit payloads.
 * sha256(email) + first 12 hex chars — collision-resistant enough to
 * correlate events for one identity without ever persisting the raw value.
 * The 12-char prefix is the standardized audit width across Phase 2
 * (CONTEXT.md §"Audit surface").
 */
const emailHash = (email: string): string =>
  createHash("sha256").update(email).digest("hex").slice(0, 12);

/**
 * Internal: render, hand to MailClient, audit outcome in one discipline.
 * Never throws. Returns a discriminated union so callers handle both
 * success and failure in a single switch.
 */
const sendWithAudit = async (
  kind: SendKind,
  subject: string,
  react: ReactElement,
  args: SendArgs,
): Promise<SendOutcome> => {
  const client = getMailClient();
  const hash = emailHash(args.to);

  try {
    const { id } = await client.send({ to: args.to, subject, react });
    await audit(
      args.meta,
      "email_send",
      "ok",
      { kind, emailHash: hash, id },
      args.userId,
    );
    return { ok: true, id };
  } catch (e) {
    await audit(
      args.meta,
      "email_send",
      "error",
      {
        kind,
        emailHash: hash,
        message: e instanceof Error ? e.message : "unknown",
      },
      args.userId,
    );
    return { ok: false, error: "email_send_failed" };
  }
};

/**
 * Send the verification email. `link` is the full
 * ${NEXT_PUBLIC_APP_URL}/api/verify?token=... URL (plaintext token is
 * NEVER stored — the action that calls this already persisted the hash).
 */
export const sendVerifyEmail = async (
  args: SendArgs & { readonly link: string },
): Promise<SendOutcome> =>
  sendWithAudit(
    "verify",
    "Verify your CEH Sprint email",
    VerifyEmail({ link: args.link }),
    args,
  );

/**
 * Send the password-reset email. `link` is the full
 * ${NEXT_PUBLIC_APP_URL}/reset?token=... URL.
 */
export const sendResetPasswordEmail = async (
  args: SendArgs & { readonly link: string },
): Promise<SendOutcome> =>
  sendWithAudit(
    "reset",
    "Reset your CEH Sprint password",
    ResetPassword({ link: args.link }),
    args,
  );

/**
 * Send the post-verify welcome email. Fires from the /api/verify route
 * handler after emailVerifiedAt is stamped. Non-blocking from the user's
 * perspective — the redirect to /dashboard?verified=1 happens regardless.
 */
export const sendWelcomeEmail = async (
  args: SendArgs & {
    readonly displayName: string;
    readonly dashboardUrl: string;
  },
): Promise<SendOutcome> =>
  sendWithAudit(
    "welcome",
    "Welcome to CEH Sprint",
    Welcome({
      displayName: args.displayName,
      dashboardUrl: args.dashboardUrl,
    }),
    args,
  );
