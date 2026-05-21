"use client";

import { useEffect, type ReactNode } from "react";
import { track, type EventName } from "@/lib/analytics/ga4";

/**
 * Declarative GA4 event wrappers — keep the call sites tidy.
 *
 *   <TrackClick event="cta_click" params={{ location: "hero" }}>
 *     <Link href="/signup">Start free</Link>
 *   </TrackClick>
 *
 * The wrapper attaches an onClick to its single child via event-bubble
 * capture on a wrapping <span> with `display: contents` so layout is
 * untouched. (React doesn't let us call cloneElement on a Next/Link
 * without re-implementing its onClick semantics, so we use the span
 * trick instead.)
 */
export function TrackClick({
  event,
  params,
  children,
}: {
  event: EventName;
  params?: Record<string, string | number | boolean | undefined>;
  children: ReactNode;
}) {
  return (
    <span
      style={{ display: "contents" }}
      onClick={() => track(event, params)}
    >
      {children}
    </span>
  );
}

/**
 * Mount-time fire — used for view events (pricing_view, bonus_view) and
 * the post-redirect signup_complete pickup. Fires exactly once per mount.
 *
 *   <TrackOnMount event="bonus_view" />
 */
export function TrackOnMount({
  event,
  params,
}: {
  event: EventName;
  params?: Record<string, string | number | boolean | undefined>;
}) {
  useEffect(() => {
    track(event, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
