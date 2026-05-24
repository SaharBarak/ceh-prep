import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getWikiArticle,
  getWikiArticles,
  getRelatedArticles,
  CATEGORY_LABELS,
} from "@/lib/content/wiki";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";

export const dynamic = "force-static";
export const revalidate = 3600;

export const generateStaticParams = () =>
  getWikiArticles().map((a) => ({ slug: a.slug }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getWikiArticle(slug);
  if (!article) return { title: "Wiki — CEH Prep" };

  const title = `${article.title} — Cyber Wiki · CEH Prep`;
  const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/wiki/${article.slug}`;
  return {
    title,
    description: article.summary,
    alternates: { canonical: url },
    openGraph: {
      title: `${article.title} — Cyber Wiki`,
      description: article.summary,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} — Cyber Wiki`,
      description: article.summary,
    },
  };
}

/**
 * /wiki/[slug] — individual article.
 *
 * Static-rendered (force-static + 1h revalidate) so Google and AI
 * answer engines hit cached HTML. The JSON-LD `DefinedTerm` + `Article`
 * dual-schema is what feeds Google AI Overviews and Perplexity-style
 * citation surfaces.
 */
export default async function WikiArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getWikiArticle(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug);
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const url = `${baseUrl}/wiki/${article.slug}`;

  return (
    <article className="mx-auto max-w-[72ch] space-y-8 px-2 py-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: article.title,
          alternateName: article.aliases,
          description: article.summary,
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            name: "CEH Prep Cyber Wiki",
            url: `${baseUrl}/wiki`,
          },
          url,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: article.title,
          alternativeHeadline: article.aliases,
          description: article.summary,
          url,
          ...(article.updated && {
            dateModified: article.updated,
            datePublished: article.updated,
          }),
          mainEntityOfPage: url,
          publisher: {
            "@type": "Organization",
            name: "CEH Prep",
            url: baseUrl,
          },
          articleSection: CATEGORY_LABELS[article.category],
        }}
      />

      <header className="border-b border-[var(--color-line)] pb-6">
        <nav className="mb-5 flex items-center justify-between gap-3 text-xs">
          <Link
            href={`/wiki/category/${article.category}`}
            className="mono-tag hover:text-[var(--color-accent)]"
          >
            ← {CATEGORY_LABELS[article.category]}
          </Link>
          <Link
            href="/wiki"
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            All articles →
          </Link>
        </nav>
        <h1 className="display text-3xl leading-tight text-[var(--color-ink)] md:text-5xl">
          {article.title}
        </h1>
        {article.summary && (
          <p className="mt-4 max-w-[64ch] text-lg text-[var(--color-ink-dim)]">
            {article.summary}
          </p>
        )}
        {article.aliases.length > 0 && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            Also known as: {article.aliases.join(" · ")}
          </p>
        )}
      </header>

      <div
        className="prose-wiki max-w-none text-[var(--color-ink-dim)]"
        style={{ fontSize: "17px", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: article.html }}
      />

      {related.length > 0 && (
        <footer className="border-t border-[var(--color-line)] pt-6">
          <p className="mono-tag mb-4">See also</p>
          <ul className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
            {related.map((r) => (
              <li
                key={r.slug}
                className="bg-[var(--color-bg)] transition-colors hover:bg-[var(--color-surface)]"
              >
                <Link href={`/wiki/${r.slug}`} className="block p-4">
                  <p className="display text-sm text-[var(--color-ink)]">
                    {r.title}
                  </p>
                  {r.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-faint)]">
                      {r.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      )}

      {article.updated && (
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
          Last updated {article.updated}
        </p>
      )}
    </article>
  );
}
