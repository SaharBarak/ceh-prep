import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongo";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { getMailClient } from "@/lib/infra/resend/client";
import { NewsletterConfirm } from "@/lib/infra/resend/templates/NewsletterConfirm";
import { newsletterConfirmUrl } from "@/lib/infra/resend/newsletter-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/newsletter
 *
 * Public, anonymous newsletter signup. Double-opt-in: this endpoint
 * creates a pending NewsletterSubscriber row, sends a confirmation
 * email (the actual Resend audience contact upsert happens AFTER the
 * user clicks confirm — that's the GDPR/anti-spam reason for DOI).
 *
 * Idempotent on `email`:
 *  - first-time : create pending row + send confirm email
 *  - already-pending : refresh confirmTokenExpiresAt + resend confirm
 *  - already-confirmed : 200 with a "you're already subscribed" body
 *                        (don't leak whether the email is on the list)
 *  - already-unsubscribed : create new pending row (re-opt-in path)
 *
 * Returns 200 with `{ ok: true }` for any of the above. Invalid input
 * returns 400 with `{ error: "invalid_email" }`. Rate-limit protection
 * is delegated to upstream middleware (same envelope as /api/verify).
 */

const SubscribeSchema = z.object({
  email: z.string().email().max(254),
  source: z
    .enum(["footer", "landing", "bonus", "import", "other"])
    .optional()
    .default("footer"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const source = parsed.data.source;

  await connectDB();

  const existing = await NewsletterSubscriberModel.findOne({ email });
  if (existing?.status === "confirmed") {
    // Already on the list — don't leak that fact, just succeed.
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (existing) {
    existing.status = "pending";
    existing.confirmTokenExpiresAt = expiresAt;
    existing.source = source;
    await existing.save();
  } else {
    await NewsletterSubscriberModel.create({
      email,
      source,
      status: "pending",
      confirmTokenExpiresAt: expiresAt,
    });
  }

  const confirmUrl = newsletterConfirmUrl(email);
  try {
    await getMailClient().send({
      to: email,
      subject: "Confirm your CEH Prep newsletter subscription",
      react: NewsletterConfirm({ confirmUrl }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[newsletter] send failed for ${email.slice(0, 4)}***: ${err instanceof Error ? err.message : String(err)}`,
    );
    // Don't surface the send failure to the caller — the row exists,
    // a future retry job can re-fire the email. UX-wise the user
    // experiences "check your inbox" anyway.
  }

  return NextResponse.json({ ok: true });
}
