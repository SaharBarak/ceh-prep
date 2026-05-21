"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { isEnabled, measurementId, trackPageview } from "@/lib/analytics/ga4";

/**
 * GA4 script + SPA pageview tracker.
 *
 * Two pieces:
 *  1. Two <Script> tags mount the gtag library and seed the config. Both
 *     load with strategy="afterInteractive" so they don't block the
 *     first-paint critical path; gtag's own queue absorbs any track()
 *     calls fired before the script finishes loading.
 *  2. A route-change effect fires a synthetic page_view on every Next
 *     App Router navigation. Without this, GA4 only sees the first SSR
 *     load — every subsequent client-side route change goes uncounted.
 *
 * If the measurement ID is unset, this component renders nothing — every
 * downstream track() call is a no-op too (see lib/analytics/ga4.ts).
 */
export function GA4Script() {
  if (!isEnabled()) return null;
  const id = measurementId();
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}', { send_page_view: false });`}
      </Script>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    trackPageview(url);
  }, [pathname, searchParams]);
  return null;
}
