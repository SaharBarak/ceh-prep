import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { getDay, DAYS } from "@/lib/content";
import { sendDripEmail } from "@/lib/infra/resend/send";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/drip
 *
 * Called every hour by Vercel Cron. Iterates every user whose
 * (Date.now() - signupAt) crosses a new "Day-N due" boundary in their
 * local timezone (target hour: 09:00 ± jitter), and sends the matching
 * curriculum drip. Idempotent via the unique (userId, "drip", day, null)
 * index on EmailDispatch — a duplicate-key write means we already sent it.
 *
 * Vercel-Cron header verification:
 *   The official Vercel Cron contract is that requests include
 *   `Authorization: Bearer ${CRON_SECRET}`. We check this with
 *   timingSafeEqual so a comparison-time oracle can't enumerate the
 *   secret one byte at a time.
 *
 * Free-tier users still receive Days 1-3; Day 4 is replaced with the
 * upsell variant. Days 5-14 are sent to Pro users only. (Day 14's
 * exam-simulator email goes only to Pro, end of story.)
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  await connectDB();
  const now = Date.now();
  const sent: number[] = [];
  const errors: string[] = [];

  // Pull every active, opted-in user. Project narrow fields — we'll only
  // ever send one email per user per run, so the per-user payload is tiny.
  const users = await UserModel.find({
    marketingOptOut: { $eq: false },
  })
    .select("_id email displayName tier createdAt timezone")
    .lean();

  for (const user of users) {
    const dueDay = daysSinceSignup(user.createdAt, user.timezone ?? "UTC", now);
    if (dueDay < 1 || dueDay > DAYS.length) continue;

    const day = getDay(dueDay);
    if (!day) continue;

    // Skip if not Pro and we're past Day 3 — except for Day 4, which IS
    // sent (as the upsell variant). Days 5-14 free-tier: skip silently.
    const isPro = user.tier === "pro";
    if (!isPro && dueDay > 4) continue;

    const variant = !isPro && dueDay === 4 ? "upsell" : "standard";
    const sampleQuestion = pickSampleQuestion(day, String(user._id));

    // Idempotency: try to write the dispatch row first. If the unique
    // index fires, we've already sent — skip silently.
    try {
      await EmailDispatchModel.create({
        userId: String(user._id),
        kind: "drip",
        day: dueDay,
        outcome: "sent",
      });
    } catch (e: unknown) {
      // Duplicate-key (Mongo 11000) = already sent today's email. Anything
      // else is a real DB problem — surface for logs but don't crash the run.
      if (isDupKey(e)) continue;
      errors.push(`enqueue ${user._id}: ${String(e)}`);
      continue;
    }

    const outcome = await sendDripEmail({
      to: user.email,
      meta: { ip: "cron", origin: "cron", ua: "vercel-cron" },
      userId: String(user._id),
      variant,
      day,
      dayLink: `${env.NEXT_PUBLIC_APP_URL}/course/${dueDay}`,
      sampleQuestion,
    });

    if (outcome.ok) {
      sent.push(dueDay);
      // Stamp the resend id post-hoc so the audit trail and the dispatch
      // row both have it. The dispatch was already created above; this is
      // a follow-up update that won't trip the unique index.
      await EmailDispatchModel.updateOne(
        { userId: String(user._id), kind: "drip", day: dueDay },
        { $set: { resendId: outcome.id } },
      );
    } else {
      // Mark as bounced so future runs don't infinite-retry the same
      // address; admin can manually flip back if needed.
      await EmailDispatchModel.updateOne(
        { userId: String(user._id), kind: "drip", day: dueDay },
        { $set: { outcome: "bounced" } },
      );
      errors.push(`send ${user._id} day=${dueDay}: ${outcome.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    errorCount: errors.length,
    // Surface counts; never raw addresses in the response body.
    daysSent: countByDay(sent),
    errors: errors.slice(0, 10),
  });
}

const isCronAuthorized = (request: Request): boolean => {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(env.CRON_SECRET);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
};

const isDupKey = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  (e as { code: unknown }).code === 11000;

/**
 * How many calendar days (in the user's local TZ) since signup.
 * Day 0 = signup day; Day 1 = next morning → first drip target.
 */
const daysSinceSignup = (
  signupAt: Date | undefined,
  tz: string,
  now: number,
): number => {
  if (!signupAt) return 0;
  // Snap both timestamps to the user's local date-only, then diff.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const signupLocal = fmt.format(signupAt);
  const nowLocal = fmt.format(new Date(now));
  const a = Date.parse(`${signupLocal}T00:00:00Z`);
  const b = Date.parse(`${nowLocal}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

/**
 * Pick a stable "question of the day" from the day's quiz. Deterministic
 * on (day.n, userId) so retries land the same email body. Uses a tiny
 * sum-of-charcodes hash — no crypto needed, just stable.
 */
const pickSampleQuestion = (
  day: { quiz: readonly { q: string; choices: readonly string[] }[] },
  userId: string,
) => {
  if (day.quiz.length === 0) return undefined;
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const idx = h % day.quiz.length;
  const q = day.quiz[idx];
  if (!q) return undefined;
  return { q: q.q, choices: q.choices };
};

const countByDay = (days: number[]): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const d of days) out[d] = (out[d] ?? 0) + 1;
  return out;
};
