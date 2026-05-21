import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { GA4Script } from "@/components/ga4-script";

export const metadata: Metadata = {
  title: "CEH Prep — 14 days to certified",
  description:
    "A focused 14-day Certified Ethical Hacker v13 sprint. Domain-tagged quiz banks, hands-on labs that run in your browser tab, and a 125-question timed exam simulator.",
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
        <SiteNav />
        <main className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-16">
          {children}
        </main>
      </body>
    </html>
  );
}
