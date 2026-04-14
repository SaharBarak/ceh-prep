import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const resetSuccess = sp.reset === "1";
  const tokenError = sp.error === "token_invalid";

  return (
    <>
      <section>
        <p className="mono-tag mb-4">Log in</p>
        <h1 className="display mb-6 text-5xl md:text-6xl">
          Welcome
          <br />
          <em className="not-italic text-[var(--color-accent)]">back.</em>
        </h1>
        <p className="max-w-[40ch] text-[var(--color-ink-dim)]">
          Pick up on the exact day and question you left off. We remember for you.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 md:p-10">
        {resetSuccess && (
          <p
            role="status"
            className="mb-6 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4 text-sm text-[var(--color-accent)]"
          >
            Password updated. Sign in with your new password.
          </p>
        )}
        {tokenError && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400"
          >
            That link is invalid or expired. Request a new one below.
          </p>
        )}
        <LoginForm />
        <p className="mt-8 text-xs text-[var(--color-ink-faint)]">
          No account?{" "}
          <Link href="/signup" className="text-[var(--color-accent)] hover:underline">
            Sign up
          </Link>
          {" · "}
          <Link
            href="/forgot-password"
            className="text-[var(--color-accent)] hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </section>
    </>
  );
}
