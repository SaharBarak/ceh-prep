import type { MetadataRoute } from "next";
import { DAYS } from "@/lib/content";
import { getBonusItems } from "@/lib/content/bonus";
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

  return [...publicRoutes, ...dayRoutes, ...bonusRoutes];
}
