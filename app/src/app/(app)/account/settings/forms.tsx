"use client";

import { useActionState } from "react";
import {
  updateDisplayName,
  changePassword,
  revokeAllSessions,
  updateMarketingFlags,
} from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/shared";

const initial: ActionState = {};

const PASSWORD_ERROR_COPY: Record<string, string> = {
  invalid_input: "Both fields are required. New password must be 12+ characters.",
  invalid_credentials: "Current password is incorrect.",
  weak_password: "New password is too predictable — pick something stronger.",
  pwned_password: "This password has appeared in a known breach. Pick a different one.",
  rate_limited: "Too many attempts. Try again in an hour.",
  forbidden_origin: "Request blocked. Reload the page and try again.",
  server_error: "Something went wrong. Try again.",
};

const NAME_ERROR_COPY: Record<string, string> = {
  invalid_input: "Display name must be 60 characters or fewer.",
  forbidden_origin: "Request blocked. Reload the page and try again.",
  server_error: "Something went wrong. Try again.",
};

const REVOKE_ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Session expired — log in again.",
  forbidden_origin: "Request blocked. Reload the page and try again.",
  server_error: "Something went wrong. Try again.",
};

const inputClass =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm focus:border-[var(--color-line-strong)] focus:outline-none";

export const DisplayNameForm = ({ initialValue }: { initialValue: string }) => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateDisplayName,
    initial,
  );
  const errorMessage = state.error
    ? (NAME_ERROR_COPY[state.error] ?? state.error)
    : null;
  const success = !state.error && state.ok;

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mono-tag mb-2 block">Display name</span>
        <input
          name="displayName"
          type="text"
          defaultValue={initialValue}
          maxLength={60}
          autoComplete="nickname"
          className={inputClass}
        />
      </label>
      <div className="flex items-center justify-between gap-4">
        <FeedbackLine error={errorMessage} success={success ? "Saved." : null} />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
};

export const ChangePasswordForm = () => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changePassword,
    initial,
  );
  const errorMessage = state.error
    ? (PASSWORD_ERROR_COPY[state.error] ?? state.error)
    : null;
  const success = !state.error && state.ok;

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mono-tag mb-2 block">Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mono-tag mb-2 block">New password</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          className={inputClass}
        />
        <span className="mt-2 block text-[11px] text-[var(--color-ink-faint)]">
          12+ characters. Checked against zxcvbn strength + HaveIBeenPwned.
        </span>
      </label>
      <div className="flex items-center justify-between gap-4">
        <FeedbackLine
          error={errorMessage}
          success={success ? "Password updated. Other sessions signed out." : null}
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Updating…" : "Change"}
        </button>
      </div>
    </form>
  );
};

export const RevokeSessionsForm = () => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    revokeAllSessions,
    initial,
  );
  const errorMessage = state.error
    ? (REVOKE_ERROR_COPY[state.error] ?? state.error)
    : null;
  const success = !state.error && state.ok;

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-[var(--color-ink-dim)]">
        Signs out every other device that has an active session. This device
        stays logged in.
      </p>
      <div className="flex items-center justify-between gap-4">
        <FeedbackLine
          error={errorMessage}
          success={success ? "Other sessions revoked." : null}
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Revoking…" : "Revoke other sessions"}
        </button>
      </div>
    </form>
  );
};

export const MarketingFlagsForm = ({
  marketingOptOut,
  marketingNudgeOptOut,
}: {
  marketingOptOut: boolean;
  marketingNudgeOptOut: boolean;
}) => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateMarketingFlags,
    initial,
  );
  const errorMessage = state.error
    ? (NAME_ERROR_COPY[state.error] ?? state.error)
    : null;
  const success = !state.error && state.ok;

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketingOptOut"
          defaultChecked={marketingOptOut}
          className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
        <span className="flex-1">
          <span className="block text-sm text-[var(--color-ink)]">
            Opt out of all marketing email
          </span>
          <span className="mt-1 block text-[11px] text-[var(--color-ink-faint)]">
            Stops the curriculum drip, broadcasts, and re-engagement nudges.
            Transactional email (verify, password reset, receipts) keeps
            flowing — those are not marketing.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="marketingNudgeOptOut"
          defaultChecked={marketingNudgeOptOut}
          className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
        <span className="flex-1">
          <span className="block text-sm text-[var(--color-ink)]">
            Skip re-engagement nudges only
          </span>
          <span className="mt-1 block text-[11px] text-[var(--color-ink-faint)]">
            You&apos;ll still get the curriculum drip and broadcasts, but the
            7-day and 21-day win-back nudges won&apos;t fire.
          </span>
        </span>
      </label>
      <div className="flex items-center justify-between gap-4">
        <FeedbackLine error={errorMessage} success={success ? "Saved." : null} />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
};

const FeedbackLine = ({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) => {
  if (error) {
    return (
      <p
        role="alert"
        className="text-xs text-red-300"
      >
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        role="status"
        className="text-xs text-[var(--color-accent)]"
      >
        {success}
      </p>
    );
  }
  return <span aria-hidden className="text-xs" />;
};
