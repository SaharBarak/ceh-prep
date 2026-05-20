"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/shared";

const initial: ActionState = {};

const ERROR_COPY: Record<string, string> = {
  invalid_input: "Check your email and password format.",
  invalid_credentials: "Email or password is incorrect.",
  rate_limited: "Too many attempts. Try again in a minute.",
  forbidden_origin: "Request blocked. Reload and try again.",
  account_locked: "Account locked. Reset your password to continue.",
};

export const LoginForm = () => {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    login,
    initial,
  );

  const errorMessage = state.error ? (ERROR_COPY[state.error] ?? state.error) : null;

  return (
    <form action={formAction} className="space-y-5">
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
          autoComplete="current-password"
          required
          maxLength={128}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm focus:border-[var(--color-line-strong)] focus:outline-none"
        />
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
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
};
