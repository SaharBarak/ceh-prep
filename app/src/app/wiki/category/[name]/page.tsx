import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getWikiArticlesByCategory,
  CATEGORY_LABELS,
  CATEGORY_BLURBS,
  type WikiCategory,
} from "@/lib/content/wiki";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";

export const dynamic = "force-static";
export const revalidate = 3600;

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS) as WikiCategory[];

export const generateStaticParams = () =>
  VALID_CATEGORIES.map((name) => ({ name }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  if (!isValidCategory(name)) return { title: "Wiki — CEH Prep" };
  return {
    title: `${CATEGORY_LABELS[name]} — Cyber Wiki · CEH Prep`,
    description: CATEGORY_BLURBS[name],
    openGraph: {
      title: `${CATEGORY_LABELS[name]} — Cyber Wiki`,
      description: CATEGORY_BLURBS[name],
      type: "website",
    },
  };
}

export default async function WikiCategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (!isValidCategory(name)) notFound();

  const articles = getWikiArticlesByCategory(name);
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return (
    <article className="mx-auto max-w-[78ch] space-y-10 px-2 py-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${CATEGORY_LABELS[name]} — Cyber Wiki`,
          url: `${baseUrl}/wiki/category/${name}`,
          description: CATEGORY_BLURBS[name],
          hasPart: articles.map((a) => ({
            "@type": "DefinedTerm",
            name: a.title,
            description: a.summary,
            url: `${baseUrl}/wiki/${a.slug}`,
          })),
        }}
      />

      <header className="border-b border-[var(--color-line)] pb-8">
        <nav className="mb-5 flex items-center justify-between gap-3 text-xs">
          <Link
            href="/wiki"
            className="mono-tag hover:text-[var(--color-accent)]"
          >
            ← The Cyber Wiki
          </Link>
        </nav>
        <p className="mono-tag mb-3">Category</p>
        <h1 className="display text-4xl text-[var(--color-ink)] md:text-5xl">
          {CATEGORY_LABELS[name]}
        </h1>
        <p className="mt-4 max-w-[60ch] text-[var(--color-ink-dim)]">
          {CATEGORY_BLURBS[name]}
        </p>
        <p className="mt-4 text-sm text-[var(--color-ink-faint)]">
          {articles.length} article{articles.length === 1 ? "" : "s"}
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-dim)]">
          No articles in this category yet — content lands weekly.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
          {articles.map((a) => (
            <li
              key={a.slug}
              className="bg-[var(--color-bg)] transition-colors hover:bg-[var(--color-surface)]"
            >
              <Link href={`/wiki/${a.slug}`} className="block p-4 md:p-5">
                <h2 className="display text-base text-[var(--color-ink)]">
                  {a.title}
                </h2>
                {a.summary && (
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--color-ink-dim)]">
                    {a.summary}
                  </p>
                )}
                {a.aliases.length > 0 && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                    Also: {a.aliases.slice(0, 3).join(" · ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

const isValidCategory = (s: string): s is WikiCategory =>
  s in CATEGORY_LABELS;
