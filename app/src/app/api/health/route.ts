import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Platform-agnostic liveness + readiness probe. Railway pings this on
 * deploy to flip the service to "active" only when DB is reachable.
 * Returns 200 with a tiny JSON body on success; 503 on DB failure so
 * the platform knows to keep traffic on the previous deploy.
 *
 * Never include build SHA, env names, or secrets — this endpoint is
 * unauthenticated and reachable from the public internet.
 */
export async function GET() {
  try {
    const conn = await connectDB();
    const state = conn.connection.readyState;
    // 1 = connected per mongoose docs
    if (state !== 1) {
      return NextResponse.json(
        { ok: false, db: "not_connected" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
