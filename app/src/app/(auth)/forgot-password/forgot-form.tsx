"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/reset";
import type { ActionState } from "@/lib/actions/shared";

const initial: ActionState = {};

export const ForgotForm = () => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordReset,
    initial,
  );

  // Constant-time UX: ALWAYS show the same success message after any submit
  // that didn't trip an origin error. `state.error === "forbidden_origin"`
  // is the only error surfaced — everything else is uniform success.
  const submitted = state !== initial && !state.error;
  const originError = state.error === "forbidden_origin";

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="mono-tag mb-2 block">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full justify-center"
      >
        {pending ? "Sending..." : "Send reset link →"}
      </button>

      {submitted && (
        <p
          role="status"
          className="mt-4 text-sm text-[var(--color-ink-dim)]"
        >
          If an account exists for that email, we just sent a reset link.
          Check your inbox.
        </p>
      )}

      {originError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          Your session is stale. Reload the page and try again.
        </p>
      )}
    </form>
  );
};
