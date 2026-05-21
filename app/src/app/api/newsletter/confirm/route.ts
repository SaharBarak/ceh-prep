import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongo";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { verifyNewsletterToken } from "@/lib/infra/resend/newsletter-token";
import { upsertAudienceContact } from "@/lib/infra/resend/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/newsletter/confirm?t=<token>
 *
 * Confirmation landing for the double-opt-in flow. Validates the
 * signed token, finds the matching subscriber, flips status to
 * "confirmed", and upserts into the Resend audience (no-op when
 * RESEND_AUDIENCE_ID is unset — see audience.ts).
 *
 * Returns a minimal HTML page (same visual envelope as
 * /api/unsubscribe — they live next to each other in user-facing
 * email flows so it pays to keep them consistent).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const email = verifyNewsletterToken("confirm", token);
  if (!email) return html(false, "Invalid confirmation link.");

  await connectDB();
  const sub = await NewsletterSubscriberModel.findOne({ email });
  if (!sub) return html(false, "That subscription has expired or never existed.");
  if (sub.status === "unsubscribed")
    return html(false, "That address opted out previously. Re-subscribe from the home page if you want back in.");
  if (sub.status === "confirmed") return html(true, "Already confirmed — you're on the list.");

  if (sub.confirmTokenExpiresAt && sub.confirmTokenExpiresAt < new Date()) {
    return html(false, "That confirmation link has expired. Submit the form again to get a fresh one.");
  }

  const { contactId } = await upsertAudienceContact(email);
  // Clear the expiry via $unset (the Mongoose Date type rejects null
  // assignment) and persist the rest with $set in one update.
  await NewsletterSubscriberModel.updateOne(
    { _id: sub._id },
    {
      $set: {
        status: "confirmed",
        confirmedAt: new Date(),
        ...(contactId ? { resendContactId: contactId } : {}),
      },
      $unset: { confirmTokenExpiresAt: 1 },
    },
  );

  return html(true, "Confirmed — you're on the list. Expect a roughly-weekly digest.");
}

const html = (ok: boolean, body: string): NextResponse => {
  const title = ok ? "Subscription confirmed" : "Confirmation failed";
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — CEH Prep</title>
  <style>
    body { background: #0a0a0c; color: #f4f4f5; font-family: -apple-system, system-ui, sans-serif; margin: 0; }
    main { max-width: 540px; margin: 0 auto; padding: 80px 24px; }
    h1 { font-size: 28px; line-height: 1.1; margin: 0 0 16px; color: ${ok ? "#bef264" : "#fca5a5"}; }
    p { color: #a1a1aa; line-height: 1.6; margin: 16px 0; }
    a { color: #bef264; text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="/">← back to CEH Prep</a></p>
  </main>
</body>
</html>`,
    {
      status: ok ? 200 : 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
};
