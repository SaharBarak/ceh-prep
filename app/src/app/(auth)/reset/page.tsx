import Link from "next/link";
import { ResetForm } from "./reset-form";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <>
      <section>
        <p className="mono-tag mb-4">Set new password</p>
        <h1 className="display mb-6 text-5xl md:text-6xl">
          New
          <br />
          <em className="not-italic text-[var(--color-accent)]">key.</em>
        </h1>
        <p className="max-w-[40ch] text-[var(--color-ink-dim)]">
          Your new password must be at least 12 characters and strong enough
          to survive a zxcvbn score of 3 or better. Any active sessions on
          other devices will be signed out when you save.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 md:p-10">
        <ResetForm token={token} />
        <p className="mt-8 text-xs text-[var(--color-ink-faint)]">
          Didn&apos;t mean to reset?{" "}
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
