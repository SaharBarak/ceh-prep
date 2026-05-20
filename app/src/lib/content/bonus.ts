/**
 * Bonus library — loads and parses `docs/content/*.md` items at build time.
 *
 * Each markdown file follows the shape established in docs/content/README.md:
 *   #  NN — <title>
 *   - **Source:** ...
 *   - **Author:** ...
 *   - **GitHub repo(s):** ...
 *   - **Curriculum mapping:** **CEH v13 Day NN — <theme>** ...
 *   ...body...
 *
 * We extract the title, the primary day mapping, an excerpt, and the full
 * HTML rendered via `marked`. This runs server-side only.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export type BonusItem = {
  /** Stable URL slug derived from the filename, e.g. "01-claude-prompts-cybersecurity". */
  slug: string;
  /** Numeric prefix from the filename ("01" → 1). Used for stable ordering. */
  n: number;
  /** Heading from the first H1, with the "NN — " prefix stripped. */
  title: string;
  /** Two-line teaser pulled from the first paragraph of body content. */
  teaser: string;
  /** Resolved primary CEH day (1..14) or null if unmapped. */
  primaryDay: number | null;
  /** Full HTML body, marked-rendered. */
  html: string;
  /** Raw markdown source. Kept for debugging / future re-render. */
  raw: string;
};

const ROOT = join(process.cwd(), "..", "docs", "content");

/** Module-level cache — markdown is fully static, so we parse once per server boot. */
let cache: BonusItem[] | null = null;

export const getBonusItems = (): BonusItem[] => {
  if (cache) return cache;

  const files = readdirSync(ROOT)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => /^\d{2}-/.test(f)); // require numeric prefix

  cache = files
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const n = Number.parseInt(slug.slice(0, 2), 10);
      const raw = readFileSync(join(ROOT, file), "utf8");
      const title = extractTitle(raw, slug);
      const teaser = extractTeaser(raw);
      const primaryDay = extractPrimaryDay(raw);
      const html = marked.parse(raw, { async: false }) as string;
      return { slug, n, title, teaser, primaryDay, html, raw };
    })
    // Skip placeholder items — sources that were scraped but inaccessible
    // (private Instagram posts, login-gated Facebook shares) leak permalink
    // hashes into the title field ("Instagram Post DWX1Jk1k-UK"). Hide them
    // from public listings until they're either replaced with usable content
    // or deleted. QA harness run-3 (.planning/qa-reports/) caught all three
    // showing in the live bonus library — Sarah/Priya/Dave each flagged it.
    .filter((item) => !isPlaceholderTitle(item.title))
    .sort((a, b) => a.n - b.n);

  return cache;
};

const isPlaceholderTitle = (title: string): boolean =>
  /^(Instagram Post\s+[A-Za-z0-9_-]+|Facebook Share[: ]|Inaccessible|Login required)/i.test(
    title.trim(),
  );

export const getBonusItem = (slug: string): BonusItem | undefined =>
  getBonusItems().find((item) => item.slug === slug);

// ── parsers (private) ───────────────────────────────────────────

const extractTitle = (raw: string, fallback: string): string => {
  const m = raw.match(/^#\s+(?:\d+\s*[—-]\s*)?(.+?)$/m);
  return m?.[1]?.trim() ?? fallback;
};

const extractTeaser = (raw: string): string => {
  // Skip frontmatter-style metadata bullets and find the first paragraph
  // after the metadata block.
  const lines = raw.split("\n");
  let started = false;
  const out: string[] = [];
  for (const raw_line of lines) {
    const line = raw_line.trim();
    if (line.startsWith("#")) continue;
    if (line.startsWith("- **") || line.startsWith("- *Source*")) continue;
    if (line.startsWith("##") || line.startsWith("---")) {
      if (out.length > 0) break;
      continue;
    }
    if (!line) {
      if (out.length > 0) break;
      continue;
    }
    if (!started && (line.startsWith(">") || /^\w/.test(line))) {
      started = true;
    }
    if (started) out.push(line.replace(/^>\s*/, ""));
    if (out.join(" ").length > 200) break;
  }
  return out.join(" ").slice(0, 200).replace(/\s+/g, " ").trim() + (out.length ? "…" : "");
};

const extractPrimaryDay = (raw: string): number | null => {
  // Match e.g. "**CEH v13 Day 01 — Foundations..."
  const m = raw.match(/CEH\s+v13\s+Day\s+(\d{1,2})/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 14 ? n : null;
};
