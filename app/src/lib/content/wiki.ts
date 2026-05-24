/**
 * Wiki content layer — Wikipedia-style cyber knowledge base.
 *
 * Loads markdown articles from `docs/wiki/*.md` at boot, parses a
 * minimal YAML-shaped frontmatter, renders the body to HTML via
 * marked, and exposes a flat catalog the routes consume.
 *
 * SEO + AEO design choices baked in here (not on the route):
 *   - Every article carries a structured `summary` (one-sentence
 *     definition) — this is the field we surface in OG cards,
 *     Schema.org `DefinedTerm.description`, and AI-answer-engine
 *     preview snippets.
 *   - `related: [slug, slug, ...]` builds the cross-link graph that
 *     the route renders as a "See also" footer. The link graph density
 *     is what makes the wiki Google- and Perplexity-favored over a
 *     flat blog.
 *   - `aliases` lets a single article rank for multiple query variants
 *     ("SQL Injection" + "SQLi" + "SQL Injection Attack") via the
 *     article's `alternateName` Schema.org field.
 *
 * Markdown files live OUTSIDE the Next.js bundle so editing one
 * doesn't trigger a TypeScript rebuild — same pattern as bonus.ts.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export type WikiCategory =
  | "attacks"
  | "defenses"
  | "protocols"
  | "tools"
  | "concepts"
  | "standards"
  | "certifications"
  | "roles";

export const CATEGORY_LABELS: Record<WikiCategory, string> = {
  attacks: "Attacks",
  defenses: "Defenses",
  protocols: "Protocols",
  tools: "Tools",
  concepts: "Concepts",
  standards: "Standards",
  certifications: "Certifications",
  roles: "Roles",
};

export const CATEGORY_BLURBS: Record<WikiCategory, string> = {
  attacks: "Offensive techniques, vulnerability classes, and exploitation patterns.",
  defenses: "Mitigations, detection patterns, and defensive controls.",
  protocols: "Network and application protocols, their structure, and security properties.",
  tools: "Common offensive and defensive software with practical usage notes.",
  concepts: "Foundational ideas, threat-model primitives, and security principles.",
  standards: "Frameworks, classifications, and authoritative references.",
  certifications: "Industry certifications, what they cover, and how they fit a career path.",
  roles: "Cybersecurity career paths and the work each role actually involves.",
};

export type WikiArticle = {
  /** URL slug — `/wiki/<slug>`. Stable, lowercase, kebab-case. */
  slug: string;
  /** Canonical display title. */
  title: string;
  /** Category for the index + nav. */
  category: WikiCategory;
  /** One-sentence definition — drives OG description + Schema.org + AEO. */
  summary: string;
  /** Related slugs — drives "See also" footer + the link graph. */
  related: string[];
  /** Alternate names this article should rank for. */
  aliases: string[];
  /** Optional date the article was last meaningfully revised (ISO yyyy-mm-dd). */
  updated?: string;
  /** Rendered HTML body. */
  html: string;
  /** Raw markdown body (without frontmatter). */
  raw: string;
};

const ROOT = join(process.cwd(), "..", "docs", "wiki");

// Module-level cache. Wiki content is static at build time; we parse once.
let cache: WikiArticle[] | null = null;

export const getWikiArticles = (): WikiArticle[] => {
  if (cache) return cache;

  let files: string[];
  try {
    files = readdirSync(ROOT).filter((f) => f.endsWith(".md"));
  } catch {
    // Directory doesn't exist yet — treat as empty.
    cache = [];
    return cache;
  }

  cache = files
    .map((file) => {
      const raw = readFileSync(join(ROOT, file), "utf8");
      return parseWikiArticle(file, raw);
    })
    .filter((a): a is WikiArticle => a !== null)
    .sort((a, b) => a.title.localeCompare(b.title));

  return cache;
};

export const getWikiArticle = (slug: string): WikiArticle | undefined =>
  getWikiArticles().find((a) => a.slug === slug);

export const getWikiArticlesByCategory = (
  category: WikiCategory,
): WikiArticle[] =>
  getWikiArticles().filter((a) => a.category === category);

/**
 * Walk the related-slug graph from a starting article. Returns the
 * directly-related articles, filtered to ones that actually exist.
 * Future expansion: 2-hop neighborhood for richer "see also" surfaces.
 */
export const getRelatedArticles = (slug: string): WikiArticle[] => {
  const article = getWikiArticle(slug);
  if (!article) return [];
  return article.related
    .map((s) => getWikiArticle(s))
    .filter((a): a is WikiArticle => a !== undefined);
};

/* ─────────────────────────────────────────────────────────────────
   Frontmatter parser — minimal YAML for our shape only
   ───────────────────────────────────────────────────────────────── */

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

const parseWikiArticle = (
  filename: string,
  raw: string,
): WikiArticle | null => {
  const fallbackSlug = filename.replace(/\.md$/, "");
  const m = raw.match(FRONTMATTER_RE);
  if (!m) {
    // No frontmatter — skip rather than serve a broken article.
    return null;
  }
  const [, fmRaw, body] = m;

  const fm = parseFrontmatterKv(fmRaw ?? "");
  const slug = (fm.slug ?? fallbackSlug).trim();
  const title = (fm.title ?? slug).trim();
  const category = (fm.category ?? "concepts") as WikiCategory;
  if (!isValidCategory(category)) return null;
  const summary = (fm.summary ?? "").trim();
  const related = parseList(fm.related ?? "");
  const aliases = parseList(fm.aliases ?? "");
  const updated = fm.updated?.trim();

  const html = marked.parse(body ?? "", { async: false }) as string;

  return {
    slug,
    title,
    category,
    summary,
    related,
    aliases,
    updated,
    html,
    raw: body ?? "",
  };
};

const parseFrontmatterKv = (block: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key) out[key] = value ?? "";
  }
  return out;
};

const parseList = (s: string): string[] => {
  const trimmed = s.trim();
  if (!trimmed) return [];
  // Accept [a, b, c] or [a,b,c] or "a, b, c"
  const stripped = trimmed.replace(/^\[/, "").replace(/\]$/, "");
  return stripped
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
};

const isValidCategory = (c: string): c is WikiCategory =>
  c in CATEGORY_LABELS;
