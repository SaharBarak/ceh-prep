import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Robots policy. Public surface is indexable; internal routes
 * (account, api, cron) are disallowed.
 *
 * Sitemap pointer lets Google + Bing pick up day pages, bonus articles,
 * and pricing immediately rather than spider-crawling.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account/",
          "/dashboard",
          "/reset",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
