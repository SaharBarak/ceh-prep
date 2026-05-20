import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getBonusItem, getBonusItems } from "@/lib/content/bonus";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import type { Tier } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

const FREE_PREVIEW_COUNT = 3;

export default async function BonusItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const item = getBonusItem(slug);
  if (!item) notFound();

  // Tier gate — same single-source-of-truth pattern as course/[day].
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

  // Free preview: first N items only.
  const allItems = getBonusItems();
  const indexInList = allItems.findIndex((it) => it.slug === slug);
  if (tier === "free" && indexInList >= FREE_PREVIEW_COUNT) {
    redirect(`/pricing?from=bonus-${slug}`);
  }

  return (
    <>
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/bonus" className="mono-tag hover:text-[var(--color-accent)]">
          ← Bonus library
        </Link>
        {item.primaryDay && (
          <Link
            href={`/course/${item.primaryDay}`}
            className="btn-ghost"
          >
            See Day {String(item.primaryDay).padStart(2, "0")} →
          </Link>
        )}
      </nav>

      <article
        className="prose-lesson max-w-[68ch] text-[var(--color-ink-dim)]"
        style={{ fontSize: "17px", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: item.html }}
      />
    </>
  );
}
