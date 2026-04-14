"use client";

import { useActionState } from "react";
import { confirmPasswordReset } from "@/lib/actions/reset";
import type { ActionState, ActionErrorCode } from "@/lib/actions/shared";

export type ResetFormProps = { readonly token: string };

const initial: ActionState = {};

const messageFor = (code: ActionErrorCode | undefined): string | null => {
  switch (code) {
    case "invalid_input":
      return "Check the password — 12 characters minimum.";
    case "weak_password":
      return "That password is too guessable. Try a longer passphrase.";
    case "pwned_password":
      return "That password appears in a known breach list. Pick another.";
    case "token_invalid":
      return "That link is invalid. Request a new reset email.";
    case "token_expired":
      return "That link expired. Request a new reset email.";
    case "forbidden_origin":
      return "Your session is stale. Reload the page and try again.";
    case "server_error":
      return "Something went wrong. Try again in a moment.";
    default:
      return null;
  }
};

export const ResetForm = ({ token }: ResetFormProps) => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    confirmPasswordReset,
    initial,
  );
  const message = messageFor(state.error);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="mono-tag mb-2 block">New password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !token}
        className="btn-primary w-full justify-center"
      >
        {pending ? "Saving..." : "Save new password →"}
      </button>

      {!token && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          No reset token in the URL. Request a new email from{" "}
          <a href="/forgot-password" className="underline">
            Forgot password
          </a>
          .
        </p>
      )}

      {message && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {message}
        </p>
      )}
    </form>
  );
};
