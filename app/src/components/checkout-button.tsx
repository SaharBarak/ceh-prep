"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { ArrowUpRight } from "@phosphor-icons/react";
import { track, EVENTS } from "@/lib/analytics/ga4";

/**
 * Paddle Pro checkout — only renders when configuration is complete
 * (server passes `enabled=true`) and the user is authenticated (server
 * passes `userId` + `email`). When disabled, render nothing — the
 * pricing page already has the honest "billing rolls out with Phase 4"
 * fallback in non-paddle paths.
 *
 * Pricing checkout overlay uses the standard Paddle.js dialog. We pass
 * `customData.userId` so subscription.created carries the linkage back
 * to the webhook handler. We also pass `customer.email` so the user
 * doesn't have to retype it inside the overlay.
 */
export function CheckoutButton({
  enabled,
  clientToken,
  environment,
  priceId,
  userId,
  email,
}: {
  enabled: boolean;
  clientToken: string;
  environment: "sandbox" | "production";
  priceId: string;
  userId: string;
  email: string;
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    initializePaddle({ environment, token: clientToken }).then((instance) => {
      if (!cancelled && instance) setPaddle(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, clientToken, environment]);

  if (!enabled) return null;

  const open = () => {
    if (!paddle) return;
    setLoading(true);
    track(EVENTS.CHECKOUT_START, { tier: "pro" });
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { userId },
      settings: { displayMode: "overlay", theme: "dark" },
    });
    // Paddle.js doesn't expose a load promise on the overlay — reset
    // the local pending state after a short delay so a missed
    // close-event doesn't strand the button.
    window.setTimeout(() => setLoading(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading || !paddle}
      className="btn-primary disabled:opacity-50"
    >
      {loading ? "Opening checkout..." : "Upgrade to Pro"}
      <ArrowUpRight size={16} weight="bold" />
    </button>
  );
}
