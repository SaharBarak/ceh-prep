import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { verifyUnsubToken } from "@/lib/infra/resend/unsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/unsubscribe?t=<token>
 *
 * One-click unsubscribe endpoint linked from every marketing email's
 * footer + List-Unsubscribe header. Verifies the HMAC-signed userId
 * token, flips `marketingOptOut: true` on the User, and returns a
 * minimal HTML confirmation page.
 *
 * Why a route handler and not a Server Action: Resend's One-Click
 * Unsubscribe (RFC 8058) sends a POST with no body to the
 * List-Unsubscribe URL. We accept both GET (user-clicked link) and
 * POST (RFC 8058) for the same idempotent flip.
 *
 * Idempotent — running twice is a no-op.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

const handle = async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";

  const userId = verifyUnsubToken(token);
  if (!userId) {
    return new NextResponse(htmlPage(false), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  await connectDB();
  await UserModel.updateOne(
    { _id: { $eq: userId } },
    { $set: { marketingOptOut: true } },
  );

  return new NextResponse(htmlPage(true), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

const htmlPage = (ok: boolean): string => {
  const title = ok ? "You're unsubscribed" : "Invalid unsubscribe link";
  const body = ok
    ? "We won't send you any more curriculum drip, bonus-library digests, or re-engagement nudges. Transactional emails (verify, password reset) will still reach you when needed."
    : "That unsubscribe link is invalid or has been tampered with. If you keep seeing this, forward the email you received to hello@cehprep.local and we'll handle it manually.";

  return `<!DOCTYPE html>
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
</html>`;
};
