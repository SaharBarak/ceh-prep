import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongo";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { verifyNewsletterToken } from "@/lib/infra/resend/newsletter-token";
import { removeAudienceContact } from "@/lib/infra/resend/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET|POST /api/newsletter/unsubscribe?t=<token>
 *
 * RFC 8058 one-click unsubscribe surface for the newsletter list.
 * Distinct from /api/unsubscribe (which targets the User-based drip
 * stream from Phase 10): a newsletter subscriber may or may not be
 * a registered user, and the two opt-outs are independent.
 *
 * Idempotent — running twice is a no-op.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

const handle = async (request: Request): Promise<NextResponse> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const email = verifyNewsletterToken("unsubscribe", token);
  if (!email) return page(false, "Invalid unsubscribe link.");

  await connectDB();
  const sub = await NewsletterSubscriberModel.findOne({ email });
  if (!sub) return page(true, "That address isn't on the list. Nothing to do.");

  if (sub.status !== "unsubscribed") {
    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date();
    await sub.save();
  }
  await removeAudienceContact(email);

  return page(
    true,
    "You're off the newsletter. No more broadcast emails. If you have a CEH Prep account, your in-product email (verify, password reset) is unaffected.",
  );
};

const page = (ok: boolean, body: string): NextResponse => {
  const title = ok ? "Unsubscribed" : "Invalid unsubscribe link";
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
