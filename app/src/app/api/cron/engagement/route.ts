import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { sendWinbackEmail, sendStreakEmail } from "@/lib/infra/resend/send";
import { DAYS } from "@/lib/content";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/engagement
 *
 * Phase 11 — post-engagement triggers. Called daily by Vercel Cron
 * (09:00 UTC). Two independent sweeps in one pass:
 *
 *  1. Winback (kind=reengage_7d, single-fire/lifetime per user):
 *     - lastActiveAt is between 7 and 14 days ago
 *     - User has completed at least one day (otherwise the curriculum
 *       drip is the better signal — winback is for people who started)
 *     - User has not opted out of nudges (marketingNudgeOptOut: false)
 *
 *  2. Streak (kind=streak_3, single-fire/lifetime per user):
 *     - completedDays contains every value in [1, 2, 3]
 *     - User has not opted out
 *
 * Idempotency comes from the EmailDispatch unique-key contract; a
 * duplicate-key on insert means we already fired and we skip silently.
 *
 * Auth: same Bearer-token contract as /api/cron/drip.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  await connectDB();
  const now = Date.now();
  const SEVEN_D = 7 * 86_400_000;
  const FOURTEEN_D = 14 * 86_400_000;
  const winbackCutoffOldest = new Date(now - FOURTEEN_D);
  const winbackCutoffNewest = new Date(now - SEVEN_D);

  let winbackSent = 0;
  let streakSent = 0;
  const errors: string[] = [];

  // ── Pass 1: winback candidates ────────────────────────────
  const winbackCandidates = await UserModel.find({
    marketingOptOut: false,
    marketingNudgeOptOut: false,
    lastActiveAt: { $gte: winbackCutoffOldest, $lte: winbackCutoffNewest },
    "completedDays.0": { $exists: true }, // at least one completed day
  })
    .select("_id email displayName tier completedDays")
    .lean();

  for (const user of winbackCandidates) {
    const userId = String(user._id);
    const lastDay = lastCompletedDay(user.completedDays as number[]);
    const resumeUrl = `${env.NEXT_PUBLIC_APP_URL}/course/${Math.min(lastDay + 1, DAYS.length)}`;

    if (await alreadySent(userId, "reengage_7d")) continue;
    try {
      await EmailDispatchModel.create({
        userId,
        kind: "reengage_7d",
        outcome: "sent",
      });
    } catch (e) {
      if (isDupKey(e)) continue;
      errors.push(`winback enqueue ${userId}: ${String(e)}`);
      continue;
    }

    const outcome = await sendWinbackEmail({
      to: user.email,
      userId,
      displayName: user.displayName ?? "",
      lastDay,
      resumeUrl,
      meta: { ip: "cron", origin: "cron", ua: "vercel-cron" },
    });
    if (outcome.ok) {
      winbackSent++;
      await EmailDispatchModel.updateOne(
        { userId, kind: "reengage_7d" },
        { $set: { resendId: outcome.id } },
      );
    } else {
      await EmailDispatchModel.updateOne(
        { userId, kind: "reengage_7d" },
        { $set: { outcome: "bounced" } },
      );
      errors.push(`winback send ${userId}: ${outcome.error}`);
    }
  }

  // ── Pass 2: streak (3-day) candidates ─────────────────────
  const streakCandidates = await UserModel.find({
    marketingOptOut: false,
    marketingNudgeOptOut: false,
    completedDays: { $all: [1, 2, 3] },
  })
    .select("_id email displayName tier completedDays")
    .lean();

  for (const user of streakCandidates) {
    const userId = String(user._id);
    const nextDay = nextUncompletedDay(user.completedDays as number[]);

    if (await alreadySent(userId, "streak_3")) continue;
    try {
      await EmailDispatchModel.create({
        userId,
        kind: "streak_3",
        outcome: "sent",
      });
    } catch (e) {
      if (isDupKey(e)) continue;
      errors.push(`streak enqueue ${userId}: ${String(e)}`);
      continue;
    }

    const outcome = await sendStreakEmail({
      to: user.email,
      userId,
      displayName: user.displayName ?? "",
      daysCompleted: (user.completedDays as number[]).length,
      nextDay,
      nextDayUrl: `${env.NEXT_PUBLIC_APP_URL}/course/${nextDay}`,
      upgradeUrl: `${env.NEXT_PUBLIC_APP_URL}/pricing?from=streak`,
      tier: (user.tier as "free" | "pro") ?? "free",
      meta: { ip: "cron", origin: "cron", ua: "vercel-cron" },
    });
    if (outcome.ok) {
      streakSent++;
      await EmailDispatchModel.updateOne(
        { userId, kind: "streak_3" },
        { $set: { resendId: outcome.id } },
      );
    } else {
      await EmailDispatchModel.updateOne(
        { userId, kind: "streak_3" },
        { $set: { outcome: "bounced" } },
      );
      errors.push(`streak send ${userId}: ${outcome.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    winbackSent,
    streakSent,
    errorCount: errors.length,
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

const alreadySent = async (
  userId: string,
  kind: "reengage_7d" | "streak_3",
): Promise<boolean> => {
  const existing = await EmailDispatchModel.findOne({ userId, kind })
    .select("_id")
    .lean();
  return Boolean(existing);
};

const lastCompletedDay = (days: number[]): number => {
  if (!Array.isArray(days) || days.length === 0) return 0;
  return Math.max(...days);
};

const nextUncompletedDay = (days: number[]): number => {
  const set = new Set(days ?? []);
  for (let n = 1; n <= DAYS.length; n++) if (!set.has(n)) return n;
  return DAYS.length;
};
