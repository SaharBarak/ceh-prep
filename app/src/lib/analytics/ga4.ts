/**
 * GA4 — client-side analytics helper.
 *
 * Falsy NEXT_PUBLIC_GA4_MEASUREMENT_ID → all calls are no-ops. The CI /
 * preview / local-dev experience is unaffected; production tracking
 * activates the moment the env var is present.
 *
 * Never reference window.gtag directly outside this module. Use track()
 * for events and trackPageview() for SPA navigations. Both are safe to
 * call before the script loads (queued via dataLayer.push).
 */

const MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";

export const isEnabled = (): boolean => MEASUREMENT_ID.length > 0;

export const measurementId = (): string => MEASUREMENT_ID;

type GTagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GTagFn;
    dataLayer?: unknown[];
  }
}

/**
 * Push a custom event. Param values must be primitives — GA4 will reject
 * arrays/objects silently. Keep names snake_case to match GA4 conventions.
 */
export const track = (
  event: string,
  params?: Record<string, string | number | boolean | undefined>,
): void => {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;
  // Push to dataLayer directly so events queue before gtag loads. Once
  // gtag('config', ...) runs in GA4Script.tsx, the queue flushes.
  (window.dataLayer ??= []).push({
    event,
    ...params,
  });
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params ?? {});
  }
};

/**
 * SPA pageview — call from a route-change listener. Next App Router
 * doesn't fire a real page load on client-side navigations, so we
 * emit page_view manually with the new URL.
 */
export const trackPageview = (url: string): void => {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_location: url,
      page_path: new URL(url, window.location.origin).pathname,
    });
  }
};

/**
 * Convenience: stable typed event names so call sites get autocomplete
 * and we avoid drift between snake_case strings sprinkled around the
 * codebase. Extend this enum when adding new events — don't pass raw
 * strings to track() in feature code.
 */
export const EVENTS = {
  // Public funnel
  CTA_CLICK: "cta_click",
  PRICING_VIEW: "pricing_view",
  BONUS_VIEW: "bonus_view",
  BONUS_LOCKED_CLICK: "bonus_locked_click",
  LAB_PEEK: "lab_peek",
  NEWSLETTER_SUBSCRIBE: "newsletter_subscribe",
  // Account
  SIGNUP_START: "signup_start",
  SIGNUP_COMPLETE: "signup_complete",
  LOGIN_COMPLETE: "login_complete",
  // Product
  DAY_OPEN: "day_open",
  DAY_COMPLETE: "day_complete",
  QUIZ_COMPLETE: "quiz_complete",
  LAB_OPEN: "lab_open",
  EXAM_START: "exam_start",
  EXAM_COMPLETE: "exam_complete",
  // Lifecycle
  DRIP_UNSUBSCRIBE: "drip_unsubscribe",
  // Billing
  CHECKOUT_START: "checkout_start",
  CHECKOUT_COMPLETE: "checkout_complete",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
