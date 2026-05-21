import "server-only";
import { createHash } from "node:crypto";
import type { ReactElement } from "react";
import { getMailClient } from "./client";
import { VerifyEmail } from "./templates/VerifyEmail";
import { ResetPassword } from "./templates/ResetPassword";
import { Welcome } from "./templates/Welcome";
import { Drip } from "./templates/Drip";
import { Winback } from "./templates/Winback";
import { Streak } from "./templates/Streak";
import { unsubUrl } from "./unsub";
import { audit, type ClientMeta } from "@/lib/actions/shared";
import type { Day } from "@/lib/content";

export type SendKind =
  | "verify"
  | "reset"
  | "welcome"
  | "drip"
  | "winback"
  | "streak";

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

/**
 * Send a drip email (Phase 10). The caller is the cron job in
 * /api/cron/drip — it has already checked EmailDispatch for idempotency
 * and resolved the user's tier (which selects variant: "standard" |
 * "upsell"). This wrapper just renders + sends + audits.
 *
 * Sample question is derived deterministically upstream from the day +
 * the user's seed (signupAt) so retries produce the same email body.
 */
export const sendDripEmail = async (
  args: SendArgs & {
    readonly variant: "standard" | "upsell";
    readonly day: Day;
    readonly dayLink: string;
    readonly userId: string;
    readonly sampleQuestion?: {
      readonly q: string;
      readonly choices: readonly string[];
    };
  },
): Promise<SendOutcome> => {
  const subject =
    args.variant === "upsell"
      ? `Day 04 of your sprint — where Pro picks up`
      : `Day ${String(args.day.n).padStart(2, "0")}: ${args.day.title}`;

  return sendWithAudit(
    "drip",
    subject,
    Drip({
      variant: args.variant,
      day: args.day,
      dayLink: args.dayLink,
      unsubscribeUrl: unsubUrl(args.userId),
      sampleQuestion: args.sampleQuestion,
    }),
    args,
  );
};

/**
 * Winback — fired after ~7 days of inactivity (no lesson views, no quiz
 * submissions). Idempotent at the dispatch-table level so we never spam.
 */
export const sendWinbackEmail = async (
  args: SendArgs & {
    readonly userId: string;
    readonly displayName: string;
    readonly lastDay: number;
    readonly resumeUrl: string;
  },
): Promise<SendOutcome> =>
  sendWithAudit(
    "winback",
    "The sprint paused. Pick it back up?",
    Winback({
      displayName: args.displayName,
      lastDay: args.lastDay,
      resumeUrl: args.resumeUrl,
      unsubscribeUrl: unsubUrl(args.userId),
    }),
    args,
  );

/**
 * Streak — celebrate Day-3 completion. Single-fire per lifetime (per
 * EmailDispatch unique index). Free-tier variant nudges toward upgrade
 * in a footnote, not a hard sell.
 */
export const sendStreakEmail = async (
  args: SendArgs & {
    readonly userId: string;
    readonly displayName: string;
    readonly daysCompleted: number;
    readonly nextDay: number;
    readonly nextDayUrl: string;
    readonly upgradeUrl: string;
    readonly tier: "free" | "pro";
  },
): Promise<SendOutcome> =>
  sendWithAudit(
    "streak",
    `${args.daysCompleted} days down. ${14 - args.daysCompleted} to exam day.`,
    Streak({
      displayName: args.displayName,
      daysCompleted: args.daysCompleted,
      nextDay: args.nextDay,
      nextDayUrl: args.nextDayUrl,
      upgradeUrl: args.upgradeUrl,
      tier: args.tier,
      unsubscribeUrl: unsubUrl(args.userId),
    }),
    args,
  );
