"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { readConsent, setConsent, type ConsentState } from "@/lib/analytics/consent";
import { isEnabled } from "@/lib/analytics/ga4";

/**
 * Cookie consent banner. Renders only when GA4 is configured AND no
 * consent decision has been recorded. Hides itself after grant/deny;
 * footer chip lets users reopen the decision.
 */
export function CookieBanner() {
  const [consent, setConsentState] = useState<ConsentState>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsentState(readConsent());
  }, []);

  if (!mounted || !isEnabled() || consent !== undefined) return null;

  const grant = () => {
    setConsent("granted");
    setConsentState("granted");
  };
  const deny = () => {
    setConsent("denied");
    setConsentState("denied");
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-2xl rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-2xl shadow-black/40 md:left-6 md:right-auto md:bottom-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 text-sm leading-relaxed text-[var(--color-ink-dim)]">
          <p className="mb-2 font-semibold text-[var(--color-ink)]">
            Analytics cookies?
          </p>
          <p>
            We use Google Analytics 4 to see what works on the site — page
            views, CTA clicks, signup funnel. No ad tech, no third-party
            pixels. Decline and nothing fires. See{" "}
            <Link
              href="/privacy"
              className="text-[var(--color-accent)] underline"
            >
              the privacy policy
            </Link>{" "}
            for the full data list.
          </p>
        </div>
        <button
          type="button"
          aria-label="Decline"
          onClick={deny}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={grant}
          className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-[var(--color-bg)]"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={deny}
          className="rounded-md border border-[var(--color-line)] px-4 py-1.5 font-mono text-[12px] uppercase tracking-wider text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/** Footer chip — lets users revisit their consent decision. */
export function CookieChip() {
  const [consent, setConsentState] = useState<ConsentState>(undefined);

  useEffect(() => {
    setConsentState(readConsent());
  }, []);

  if (!isEnabled()) return null;

  const flip = () => {
    const next = consent === "granted" ? "denied" : "granted";
    setConsent(next);
    setConsentState(next);
  };

  const label =
    consent === "granted"
      ? "Cookies: on"
      : consent === "denied"
        ? "Cookies: off"
        : "Cookies: ask";

  return (
    <button
      type="button"
      onClick={flip}
      className="font-mono text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
    >
      {label}
    </button>
  );
}
