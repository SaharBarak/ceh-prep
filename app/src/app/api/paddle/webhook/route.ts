import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { env } from "@/lib/env";
import {
  getPaddle,
  isPaddleConfigured,
  EventName,
  type EventEntity,
} from "@/lib/infra/paddle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/paddle/webhook
 *
 * Paddle webhook receiver. Verifies the `Paddle-Signature` header via
 * the SDK's unmarshal (HMAC with PADDLE_WEBHOOK_SECRET), then dispatches
 * by event type:
 *
 *   subscription.created   → set User.tier = "pro", stamp paddleCustomerId
 *   subscription.activated → set User.tier = "pro" (post-trial / reactivation)
 *   subscription.canceled  → set User.tier = "free"
 *   subscription.paused    → leave tier (Paddle's grace-period semantic)
 *   subscription.updated   → resync tier from subscription.status
 *
 * Customer linking strategy: Paddle's `custom_data.userId` carries the
 * User._id at checkout (set client-side in the open() call). On
 * subscription.created we persist paddleCustomerId so subsequent events
 * — which don't carry custom_data — can still find the user.
 *
 * Idempotent — re-receiving the same event is a no-op (we always set
 * to the target state rather than toggling).
 *
 * Returns 200 OK as fast as possible. Paddle retries on non-2xx with
 * exponential backoff; a slow handler causes redelivery storms.
 */

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return NextResponse.json(
      { error: "paddle_not_configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();

  let event: EventEntity;
  try {
    event = await getPaddle().webhooks.unmarshal(
      rawBody,
      env.PADDLE_WEBHOOK_SECRET!,
      signature,
    );
  } catch (err) {
    // Signature mismatch or malformed payload. 400 not 401 — the SDK
    // doesn't distinguish; either way we won't process.
    // eslint-disable-next-line no-console
    console.warn(
      `[paddle:webhook] verify failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 400 },
    );
  }

  await connectDB();

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionActivated: {
      const userId = extractUserId(event.data);
      const customerId = event.data.customerId;
      if (!userId || !customerId) break;
      await UserModel.updateOne(
        { _id: { $eq: userId } },
        {
          $set: {
            tier: "pro",
            paddleCustomerId: customerId,
          },
        },
      );
      break;
    }
    case EventName.SubscriptionCanceled: {
      // Cancel events arrive without custom_data; lookup by customerId.
      const customerId = event.data.customerId;
      if (!customerId) break;
      await UserModel.updateOne(
        { paddleCustomerId: customerId },
        { $set: { tier: "free" } },
      );
      break;
    }
    case EventName.SubscriptionUpdated: {
      const customerId = event.data.customerId;
      const status = event.data.status;
      if (!customerId) break;
      // Paddle subscription statuses: active, canceled, past_due, paused,
      // trialing. We treat anything other than "active"/"trialing" as
      // free until proven pro again. (past_due → free has the side
      // effect of mid-cycle entitlement loss, but that's the right
      // behavior for unpaid invoices in v1.)
      const tier = status === "active" || status === "trialing" ? "pro" : "free";
      await UserModel.updateOne(
        { paddleCustomerId: customerId },
        { $set: { tier } },
      );
      break;
    }
    default:
      // Other events (transaction.completed, etc.) we ignore for v1.
      break;
  }

  return NextResponse.json({ ok: true });
}

/**
 * Paddle's `data.customData` is typed as `unknown` — extract our
 * userId carefully. The checkout button sets it as
 * `{ customData: { userId: string } }` so we can route subscription
 * events back to the right account.
 */
const extractUserId = (data: { customData?: unknown }): string | null => {
  const cd = data.customData;
  if (cd && typeof cd === "object" && "userId" in cd) {
    const v = (cd as Record<string, unknown>).userId;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
};
