import type { MetadataRoute } from "next";
import { DAYS } from "@/lib/content";
import { getBonusItems } from "@/lib/content/bonus";
import { getWikiArticles, CATEGORY_LABELS } from "@/lib/content/wiki";
import type { WikiCategory } from "@/lib/content/wiki";
import { env } from "@/lib/env";

/**
 * Sitemap. Lists every public-or-auth-walled route so Google can index
 * the public ones and discover the auth-walled ones as JS-rendered
 * landing destinations.
 *
 * Priorities are relative within the site, not absolute SEO weight —
 * Google treats them as hints only.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const now = new Date();

  const publicRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/bonus`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const dayRoutes: MetadataRoute.Sitemap = DAYS.map((d) => ({
    url: `${base}/course/${d.n}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const bonusRoutes: MetadataRoute.Sitemap = getBonusItems().map((it) => ({
    url: `${base}/bonus/${it.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Wiki — the SEO/AEO surface. High priority on the index + each article,
  // medium on category indexes. Wiki articles refresh ~weekly as the bank
  // grows; individual articles change less often.
  const wikiArticles = getWikiArticles();
  const wikiIndexRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/wiki`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
  const wikiCategoryRoutes: MetadataRoute.Sitemap = (
    Object.keys(CATEGORY_LABELS) as WikiCategory[]
  ).map((c) => ({
    url: `${base}/wiki/category/${c}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  const wikiArticleRoutes: MetadataRoute.Sitemap = wikiArticles.map((a) => ({
    url: `${base}/wiki/${a.slug}`,
    lastModified: a.updated ? new Date(a.updated) : now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    ...publicRoutes,
    ...dayRoutes,
    ...bonusRoutes,
    ...wikiIndexRoutes,
    ...wikiCategoryRoutes,
    ...wikiArticleRoutes,
  ];
}
