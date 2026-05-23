import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { captureClientMeta, audit } from "@/lib/actions/shared";
import { connectDB } from "@/lib/db/mongo";
import { buildAccountExport } from "@/lib/account/export-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 *
 * GDPR Article 15 (right of access) endpoint promised by /privacy.
 * Returns the authenticated user's complete data archive as JSON, with
 * Content-Disposition: attachment so browsers offer a save dialog.
 *
 * The archive shape is owned by `lib/account/export-builder.ts` and
 * frozen as a test contract in `export-builder.test.ts` — keep stable.
 */
export async function GET() {
  const meta = await captureClientMeta();

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const archive = await buildAccountExport(userId);

    if (!archive) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await audit(
      meta,
      "account_export",
      "ok",
      {
        rows: {
          progress: archive.progress.length,
          dispatches: archive.emailDispatches.length,
          audit: archive.audit.length,
        },
      },
      userId,
    );

    const filename = `cehprep-export-${archive.account.email.replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(archive, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    await audit(
      meta,
      "account_export",
      "error",
      { message: e instanceof Error ? e.message : "unknown" },
      userId,
    );
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
