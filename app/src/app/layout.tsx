import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { GA4Script } from "@/components/ga4-script";
import { CookieBanner } from "@/components/cookie-banner";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  // metadataBase is what Next.js uses to resolve relative URLs in
  // openGraph/twitter image references. Without it, the auto-generated
  // `/opengraph-image` lands as a relative path and OG scrapers reject
  // the card. Anchored to NEXT_PUBLIC_APP_URL so dev preview / prod all
  // resolve correctly.
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "CEH Prep — 14 days to certified",
  description:
    "A focused 14-day Certified Ethical Hacker v13 sprint. Domain-tagged quiz banks, hands-on labs that run in your browser tab, and a 125-question timed exam simulator.",
  openGraph: {
    type: "website",
    siteName: "CEH Prep",
    title: "CEH Prep — 14 days to certified",
    description:
      "Pass CEH v13 in 14 focused days. Browser-based Debian lab, domain-tagged quiz banks, 125-question timed simulator.",
    url: env.NEXT_PUBLIC_APP_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CEH Prep — 14 days to certified",
    description:
      "Pass CEH v13 in 14 focused days. Browser-based Debian lab, domain-tagged quiz banks, 125-question timed simulator.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GA4Script />
        <CookieBanner />
        <SiteNav />
        <main className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
          {children}
        </main>
      </body>
    </html>
  );
}
