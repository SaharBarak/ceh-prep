"use client";

import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/shared";

const initial: ActionState = {};

const ERROR_COPY: Record<string, string> = {
  invalid_input: "Check email format and password length (≥10).",
  email_taken: "That email already has an account. Try logging in.",
  weak_password: "Pick a stronger password — long, varied, not a phrase you'd guess.",
  pwned_password:
    "That exact password appears in a known breach. Pick something only you use.",
  rate_limited: "Too many signups from this network. Try again in a minute.",
  forbidden_origin: "Request blocked. Reload and try again.",
};

export const SignupForm = () => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signup,
    initial,
  );

  const errorMessage = state.error ? (ERROR_COPY[state.error] ?? state.error) : null;

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="mono-tag mb-2 block">Name (optional)</span>
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={60}
          placeholder="Whoever you want to be"
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm focus:border-[var(--color-line-strong)] focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mono-tag mb-2 block">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm focus:border-[var(--color-line-strong)] focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mono-tag mb-2 block">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm focus:border-[var(--color-line-strong)] focus:outline-none"
        />
        <span className="mt-2 block text-xs text-[var(--color-ink-faint)]">
          10+ chars. Long is more important than weird symbols. We check against
          HaveIBeenPwned — known-breached passwords are rejected.
        </span>
      </label>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account →"}
      </button>

      <p className="text-xs text-[var(--color-ink-faint)]">
        By signing up you accept that this is a sprint, not a 100-hour course —
        we expect 30 focused minutes per day, 14 days. Cancel any time.
      </p>
    </form>
  );
};
