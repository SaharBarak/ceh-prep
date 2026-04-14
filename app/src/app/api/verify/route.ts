import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { hashToken, isExpired } from "@/lib/auth/tokens";
import { sendWelcomeEmail } from "@/lib/infra/resend";
import { env } from "@/lib/env";
import { audit, type ClientMeta } from "@/lib/actions/shared";

/**
 * React Email + Mongoose + Resend all require Node APIs — Edge runtime
 * rejects `react-dom/server` and the Mongoose BSON driver. `force-dynamic`
 * because the query string is the token and we write to Mongo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inline capture — route handlers run outside the "use server" scope so we
 * replicate the three-line capture shape from lib/actions/auth.ts's
 * captureClientMeta. Cannot be hoisted into a shared module without
 * introducing a "use server" boundary that conflicts with route-handler
 * semantics.
 */
const captureMeta = async (): Promise<ClientMeta> => {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown",
    ua: h.get("user-agent")?.slice(0, 256) ?? "unknown",
    origin: h.get("origin") ?? "",
  };
};

/**
 * Route-local thin wrapper around the canonical `audit()` from
 * @/lib/actions/auth. Never re-implement the audit writer here — that
 * path-drifts the schema and breaks Phase 5's ADMIN-03 audit viewer which
 * reads one canonical shape.
 */
const auditVerify = async (
  meta: ClientMeta,
  outcome: "ok" | "deny" | "error",
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> => {
  try {
    await audit(meta, "email_verify", outcome, payload, userId);
  } catch {
    // Audit failures must never break the redirect flow.
  }
};

/**
 * GET /api/verify?token={plaintext}
 *
 * Re-hashes the querystring token, finds the User by hash with `$eq`,
 * checks `isExpired` AFTER the hash match (so timing oracles can't
 * distinguish "expired" from "wrong token"), stamps `emailVerifiedAt`,
 * nulls the token fields (single-use invariant), fires a non-blocking
 * welcome email, and redirects to `/dashboard?verified=1`.
 *
 * All failure modes redirect to `/login?error=token_invalid` — no info
 * leak between "no match" / "expired" / "malformed".
 *
 * Replay protection is structural: after the first consume the user's
 * `emailVerifyTokenHash` is null, so a second click hashes to a value
 * that matches no document and takes the "no_match" branch.
 */
export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const meta = await captureMeta();
  const token = req.nextUrl.searchParams.get("token");

  const invalid = NextResponse.redirect(
    new URL("/login?error=token_invalid", req.url),
  );
  const success = NextResponse.redirect(
    new URL("/dashboard?verified=1", req.url),
  );

  if (!token || token.length < 32 || token.length > 64) {
    await auditVerify(meta, "deny", { reason: "missing_or_malformed_token" });
    return invalid;
  }

  try {
    await connectDB();
    const hash = hashToken(token);
    const user = await UserModel.findOne({ emailVerifyTokenHash: { $eq: hash } })
      .select(
        "+emailVerifyTokenHash +emailVerifyTokenExpiresAt _id email displayName emailVerifiedAt",
      )
      .lean<{
        _id: { toString(): string };
        email: string;
        displayName: string;
        emailVerifiedAt: Date | null;
        emailVerifyTokenExpiresAt: Date | null;
      } | null>();

    if (!user) {
      await auditVerify(meta, "deny", { reason: "no_match" });
      return invalid;
    }

    if (isExpired(user.emailVerifyTokenExpiresAt)) {
      await auditVerify(
        meta,
        "deny",
        { reason: "token_expired" },
        user._id.toString(),
      );
      return invalid;
    }

    if (user.emailVerifiedAt) {
      await auditVerify(
        meta,
        "ok",
        { reason: "already_verified" },
        user._id.toString(),
      );
      return success;
    }

    await UserModel.updateOne(
      { _id: { $eq: user._id } },
      {
        $set: {
          emailVerifiedAt: new Date(),
          emailVerifyTokenHash: null,
          emailVerifyTokenExpiresAt: null,
        },
      },
    );

    await auditVerify(meta, "ok", {}, user._id.toString());

    // Fire welcome (non-blocking — sendWelcomeEmail never throws per Plan
    // 02-04 contract; failures are audited inside the wrapper).
    await sendWelcomeEmail({
      to: user.email,
      displayName: user.displayName,
      dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
      meta,
      userId: user._id.toString(),
    });

    return success;
  } catch (e) {
    await auditVerify(meta, "error", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return invalid;
  }
};
