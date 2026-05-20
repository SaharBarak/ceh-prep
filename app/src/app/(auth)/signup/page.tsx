import Link from "next/link";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  // Light copy adaptation if the user arrived from a paywall redirect — they
  // know what they came for; lean on outcome language instead of the generic
  // hero copy. (sp.from === "day-5" means they hit the day-5 paywall.)
  const fromDay = sp.from?.match(/^day-(\d+)$/)?.[1];

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
      <section className="md:col-span-6">
        <p className="mono-tag mb-4">Sign up</p>
        <h1 className="display mb-6 text-5xl md:text-6xl">
          Free for{" "}
          <em className="not-italic text-[var(--color-accent)]">3 days</em>.
          <br />
          No card.
        </h1>
        <p className="max-w-[44ch] text-[var(--color-ink-dim)]">
          {fromDay ? (
            <>
              Day {fromDay} is Pro territory. Start with the first three free —
              we&apos;ll save your spot so day {fromDay} is waiting when you
              upgrade.
            </>
          ) : (
            <>
              Start the sprint. Day 1 lands in your dashboard immediately.
              We&apos;ll never email you product newsletters, only the things
              you asked for (verification link, password reset).
            </>
          )}
        </p>

        <ul className="mt-10 space-y-4 text-sm text-[var(--color-ink-dim)]">
          <li className="flex gap-3">
            <span className="mono-tag mt-0.5 shrink-0 text-[var(--color-accent)]">
              01
            </span>
            <span>
              <strong className="text-[var(--color-ink)]">3 days free</strong>{" "}
              — Foundations, Reconnaissance, and Scanning. ~90 min total.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mono-tag mt-0.5 shrink-0 text-[var(--color-accent)]">
              02
            </span>
            <span>
              <strong className="text-[var(--color-ink)]">$30/mo Pro</strong>{" "}
              unlocks days 4-14, the in-browser lab, and the bonus library.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mono-tag mt-0.5 shrink-0 text-[var(--color-accent)]">
              03
            </span>
            <span>
              <strong className="text-[var(--color-ink)]">Cancel any time</strong>{" "}
              — Paddle handles billing; you keep access to the end of the
              billing period.
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 md:col-span-6 md:p-10">
        <SignupForm />
        <p className="mt-8 text-xs text-[var(--color-ink-faint)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--color-accent)] hover:underline"
          >
            Log in
          </Link>
        </p>
      </section>
    </div>
  );
}
