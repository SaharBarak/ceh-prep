import { NextResponse } from "next/server";
import { getSession, requireSession } from "@/lib/auth/session";
import {
  captureClientMeta,
  verifyOrigin,
  audit,
} from "@/lib/actions/shared";
import { connectDB } from "@/lib/db/mongo";
import { rateLimit } from "@/lib/auth/rate-limit";
import { cascadeDeleteAccount } from "@/lib/account/delete-cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/delete
 *
 * GDPR Article 17 (right to erasure) endpoint promised by /privacy. The
 * cascade itself lives in `lib/account/delete-cascade.ts` (vitest-tested);
 * this handler owns the HTTP boundary: CSRF, rate limit, auth, confirmation
 * body, audit, session destroy.
 */
export async function POST(request: Request) {
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "account_delete", "deny", { reason: "origin_mismatch" });
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const limit = rateLimit("account-delete", meta.ip, 3, 60 * 60_000);
  if (!limit.ok) {
    await audit(meta, "account_delete", "deny", { reason: "rate_limit" });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let userId: string;
  let userEmail: string;
  try {
    const s = await requireSession();
    userId = s.userId;
    userEmail = s.email;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Optional confirmation body. UI sends `{ confirm: "DELETE" }`; absent or
  // empty body is also accepted so scripted clients with auth can call
  // directly. Mismatch (anything OTHER than "DELETE") is rejected.
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        confirm?: unknown;
      };
      if (body.confirm !== undefined && body.confirm !== "DELETE") {
        return NextResponse.json(
          { error: "missing_confirmation" },
          { status: 400 },
        );
      }
    }
  } catch {
    // No body — fall through.
  }

  try {
    await connectDB();
    const result = await cascadeDeleteAccount(userId);

    const session = await getSession();
    session.destroy();

    if (result.alreadyDeleted) {
      await audit(
        meta,
        "account_delete",
        "ok",
        { reason: "already_gone" },
        userId,
      );
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }

    await audit(
      meta,
      "account_delete",
      "ok",
      {
        emailDomain: userEmail.split("@")[1] ?? "unknown",
        deleted: result.deleted,
        paddleCustomerId: result.paddleCustomerId,
      },
      userId,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    await audit(
      meta,
      "account_delete",
      "error",
      { message: e instanceof Error ? e.message : "unknown" },
      userId,
    );
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
