"use client";

/**
 * Analytics-consent state machine.
 *
 * GA4 is wired in app/lib/analytics/ga4.ts but must not fire until
 * the user grants consent (GDPR/UK-GDPR/CCPA-CA). State lives in a
 * single first-party localStorage key — no server roundtrip, no
 * tracking pixel before grant.
 *
 *   "granted"  → GA4 fires
 *   "denied"   → GA4 stays silent
 *   undefined  → banner shows; nothing fires
 *
 * Three exports:
 *   readConsent()     — sync read of the current value
 *   setConsent(value) — write + broadcast a window event so the
 *                       GA4Script + the banner stay in sync without
 *                       reloading.
 *   onConsentChange(handler) — subscribe to changes (used by the
 *                              GA4Script reactively).
 */

export type ConsentState = "granted" | "denied" | undefined;

const STORAGE_KEY = "ceh.consent.v1";
const EVENT_NAME = "ceh:consent-change";

export const readConsent = (): ConsentState => {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "granted" || v === "denied") return v;
    return undefined;
  } catch {
    // localStorage blocked (Safari private, embedded webview) — fall
    // back to "undefined" so the banner shows. Better to ask twice
    // than to fire analytics without consent.
    return undefined;
  }
};

export const setConsent = (value: "granted" | "denied"): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore — broadcast still fires so the in-page state updates
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
};

export const onConsentChange = (
  handler: (value: ConsentState) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as ConsentState;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};
