import type { Metadata } from "next";
import Link from "next/link";
import {
  getWikiArticles,
  CATEGORY_LABELS,
  CATEGORY_BLURBS,
  type WikiCategory,
} from "@/lib/content/wiki";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Cyber Wiki — CEH Prep",
  description:
    "A curated cybersecurity wiki: attacks, defenses, protocols, tools, concepts, standards, and certifications. Wikipedia-style coverage for offensive security learners and professionals.",
  openGraph: {
    title: "Cyber Wiki — CEH Prep",
    description:
      "Curated cybersecurity reference. Attacks, defenses, protocols, tools, concepts.",
    type: "website",
  },
};

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * /wiki — top-level index.
 *
 * Public, indexable, server-rendered. Lists articles grouped by
 * category with a one-line summary per article. The grouping is what
 * Google treats as topical-authority signal (a deep category tree
 * with internal cross-links).
 */
export default function WikiIndexPage() {
  const articles = getWikiArticles();
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const grouped = new Map<WikiCategory, typeof articles>();
  for (const a of articles) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }

  const categories = (Object.keys(CATEGORY_LABELS) as WikiCategory[]).filter(
    (c) => (grouped.get(c)?.length ?? 0) > 0,
  );

  return (
    <article className="mx-auto max-w-[78ch] space-y-12 px-2 py-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "CEH Prep Cyber Wiki",
          url: `${baseUrl}/wiki`,
          description:
            "Curated cybersecurity wiki: attacks, defenses, protocols, tools, concepts, standards.",
          hasPart: articles.map((a) => ({
            "@type": "DefinedTerm",
            name: a.title,
            description: a.summary,
            url: `${baseUrl}/wiki/${a.slug}`,
          })),
        }}
      />

      <header className="border-b border-[var(--color-line)] pb-8">
        <p className="mono-tag mb-3">Reference</p>
        <h1 className="display text-4xl text-[var(--color-ink)] md:text-5xl">
          The Cyber Wiki
        </h1>
        <p className="mt-4 max-w-[60ch] text-[var(--color-ink-dim)]">
          A curated reference for the offensive-security learner. Concept
          definitions, attack classes, defensive controls, and the tools
          you&apos;ll actually touch — written for fast lookup, deep-linked,
          and built to be cited.
        </p>
        <p className="mt-4 text-sm text-[var(--color-ink-faint)]">
          {articles.length} articles ·{" "}
          {categories.length} categories · growing every week.
        </p>
      </header>

      {categories.map((c) => {
        const list = grouped.get(c) ?? [];
        return (
          <section key={c} className="space-y-4">
            <div>
              <p className="mono-tag mb-2">
                <Link
                  href={`/wiki/category/${c}`}
                  className="hover:text-[var(--color-accent)]"
                >
                  {CATEGORY_LABELS[c]}
                </Link>
              </p>
              <p className="text-sm text-[var(--color-ink-dim)]">
                {CATEGORY_BLURBS[c]}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
              {list.map((a) => (
                <li
                  key={a.slug}
                  className="bg-[var(--color-bg)] transition-colors hover:bg-[var(--color-surface)]"
                >
                  <Link
                    href={`/wiki/${a.slug}`}
                    className="block p-4 md:p-5"
                  >
                    <h3 className="display text-base text-[var(--color-ink)]">
                      {a.title}
                    </h3>
                    {a.summary && (
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--color-ink-dim)]">
                        {a.summary}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {articles.length === 0 && (
        <p className="text-sm text-[var(--color-ink-dim)]">
          The wiki is just getting started — articles land weekly.
        </p>
      )}
    </article>
  );
}
