import Link from "next/link";
import { getBonusItems } from "@/lib/content/bonus";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import type { Tier } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const FREE_PREVIEW_COUNT = 3;

/**
 * Public bonus library. The landing page links unauthenticated visitors here
 * as "All N →" — so we use the soft `getSession()` (returns null when
 * unauthenticated) rather than `requireSession()` (which throws). Free / pro
 * gating then keys off the session: no session → free; session + tier=pro →
 * pro; everything else → free.
 *
 * QA harness caught the original bug — landing CTA → /bonus produced a
 * 500/UNAUTHORIZED hard-error for the entire unauthenticated cohort (see
 * .planning/qa-reports/ run 3).
 */
export default async function BonusLibraryPage() {
  const session = await getSession();

  let tier: Tier = "free";
  if (session.userId) {
    await connectDB();
    try {
      const user = await UserModel.findOne({ _id: { $eq: session.userId } })
        .select("tier")
        .lean();
      if (user?.tier === "pro") tier = "pro";
    } catch {
      tier = "free";
    }
  }

  const items = getBonusItems();
  const isPro = tier === "pro";
  const isAuthed = Boolean(session.userId);

  return (
    <>
      {isAuthed && (
        <nav className="mb-10">
          <Link href="/dashboard" className="mono-tag hover:text-[var(--color-accent)]">
            ← Dashboard
          </Link>
        </nav>
      )}

      <header className="mb-12 border-b border-[var(--color-line)] pb-10">
        <p className="mono-tag mb-4">Bonus library</p>
        <h1 className="display text-5xl md:text-7xl">
          {items.length} curated articles.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[var(--color-ink-dim)]">
          Tools, walkthroughs, and tactical breakdowns from the security community —
          deduplicated, indexed by CEH v13 day, and tagged with the GitHub repos
          they reference.{" "}
          {isPro
            ? "Pro tier — full access."
            : isAuthed
              ? `Free preview: first ${FREE_PREVIEW_COUNT}.`
              : `Preview the first ${FREE_PREVIEW_COUNT} for free — sign up to unlock the rest with the 3-day trial.`}
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
        {items.map((item, i) => {
          const locked = !isPro && i >= FREE_PREVIEW_COUNT;
          return (
            <li
              key={item.slug}
              className="group relative bg-[var(--color-bg)] p-6 transition-colors hover:bg-[var(--color-surface)] md:p-8"
            >
              {locked ? (
                <div className="flex flex-col items-start gap-3 opacity-60">
                  <Card item={item} />
                  <Link
                    href={isAuthed ? "/pricing?from=bonus" : "/signup?from=bonus"}
                    className="mono-tag text-[var(--color-accent)]"
                  >
                    🔒 {isAuthed ? "Upgrade to read" : "Sign up to read"} →
                  </Link>
                </div>
              ) : (
                <Link href={`/bonus/${item.slug}`} className="block">
                  <Card item={item} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Card({
  item,
}: {
  item: ReturnType<typeof getBonusItems>[number];
}) {
  return (
    <>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-xs text-[var(--color-ink-faint)]">
          {String(item.n).padStart(2, "0")}
        </span>
        {item.primaryDay && (
          <span className="mono-tag">
            Day {String(item.primaryDay).padStart(2, "0")}
          </span>
        )}
      </div>
      <h3 className="display mb-3 text-2xl">{item.title}</h3>
      <p className="text-sm leading-relaxed text-[var(--color-ink-dim)]">
        {item.teaser}
      </p>
    </>
  );
}
