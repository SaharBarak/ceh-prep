import Link from "next/link";
import { redirect } from "next/navigation";
import { getBonusItems } from "@/lib/content/bonus";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import type { Tier } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const FREE_PREVIEW_COUNT = 3;

export default async function BonusLibraryPage() {
  const session = await requireSession();

  await connectDB();
  let tier: Tier = "free";
  try {
    const user = await UserModel.findOne({ _id: { $eq: session.userId } })
      .select("tier")
      .lean();
    if (user?.tier === "pro") tier = "pro";
  } catch {
    tier = "free";
  }

  const items = getBonusItems();
  const isPro = tier === "pro";

  return (
    <>
      <nav className="mb-10">
        <Link href="/dashboard" className="mono-tag hover:text-[var(--color-accent)]">
          ← Dashboard
        </Link>
      </nav>

      <header className="mb-12 border-b border-[var(--color-line)] pb-10">
        <p className="mono-tag mb-4">Bonus library</p>
        <h1 className="display text-5xl md:text-7xl">
          {items.length} curated articles.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[var(--color-ink-dim)]">
          Tools, walkthroughs, and tactical breakdowns from the security community —
          deduplicated, indexed by CEH v13 day, and tagged with the GitHub repos
          they reference. {isPro ? "Pro tier — full access." : `Free preview: first ${FREE_PREVIEW_COUNT}.`}
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
                    href={`/pricing?from=bonus`}
                    className="mono-tag text-[var(--color-accent)]"
                  >
                    🔒 Upgrade to read →
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
