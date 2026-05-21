import "server-only";
import {
  Paddle,
  Environment,
  EventName,
  type EventEntity,
} from "@paddle/paddle-node-sdk";
import { env } from "@/lib/env";

/**
 * Paddle server SDK boundary.
 *
 * Configuration is fully optional — when any of the four Paddle env
 * vars are missing the pricing page falls back to the honest "billing
 * rolls out with Phase 4" copy and no checkout button renders. The
 * server-side webhook still mounts as a route but rejects all events
 * with `paddle_not_configured` until keys are present.
 *
 * Centralizing the client + the `isPaddleConfigured()` check here keeps
 * three call sites (webhook, checkout-button SSR, billing-portal SSR)
 * from drifting on their environment-validation logic.
 */

export const isPaddleConfigured = (): boolean =>
  Boolean(
    env.PADDLE_API_KEY &&
      env.PADDLE_WEBHOOK_SECRET &&
      env.PADDLE_PRO_PRICE_ID &&
      env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  );

let cached: Paddle | null = null;

export const getPaddle = (): Paddle => {
  if (!isPaddleConfigured()) {
    throw new Error(
      "paddle_not_configured — set PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRO_PRICE_ID, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
    );
  }
  if (cached) return cached;
  cached = new Paddle(env.PADDLE_API_KEY!, {
    environment:
      env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
  });
  return cached;
};

export { EventName };
export type { EventEntity };
