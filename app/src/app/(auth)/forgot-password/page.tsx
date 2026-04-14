import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <section>
        <p className="mono-tag mb-4">Forgot password</p>
        <h1 className="display mb-6 text-5xl md:text-6xl">
          Reset
          <br />
          <em className="not-italic text-[var(--color-accent)]">access.</em>
        </h1>
        <p className="max-w-[40ch] text-[var(--color-ink-dim)]">
          Enter the email on your account. If it exists, we&apos;ll send a
          single-use link valid for one hour.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 md:p-10">
        <ForgotForm />
        <p className="mt-8 text-xs text-[var(--color-ink-faint)]">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-[var(--color-accent)] hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </>
  );
}
