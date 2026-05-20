"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { requireSession } from "@/lib/auth/session";

type Result = { ok: true } | { ok: false; error: "unauthorized" | "invalid_day" | "invalid_slug" };

/**
 * Mark a lesson day complete. Idempotent — uses $addToSet so re-runs are
 * no-ops and the array stays unique. Phase 8's drill-complete uses the
 * same pattern on a separate field.
 *
 * NOTE: this is a *user-asserted* completion. The actual proof that the
 * user did the work lives in their quiz answers + drill check-pass events.
 * Mark-complete is the "I'm done" UI affordance.
 */
export const setLessonComplete = async (day: number): Promise<Result> => {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  if (!Number.isInteger(day) || day < 1 || day > 14) {
    return { ok: false, error: "invalid_day" };
  }

  await connectDB();
  await UserModel.updateOne(
    { _id: { $eq: userId } },
    { $addToSet: { completedDays: { $eq: day } } },
  );

  revalidatePath(`/course/${day}`);
  revalidatePath("/dashboard");
  return { ok: true };
};

/**
 * Phase 8: record a drill pass.
 * Slug format: "dayNN-theme/MM-drill-slug" (matches the WebVM image path).
 * The slug is validated against a strict pattern — no path traversal,
 * no arbitrary user input lands in Mongo.
 */
const DRILL_SLUG = /^day\d{2}-[a-z0-9-]+\/\d{2}-[a-z0-9-]+$/;

export const setDrillComplete = async (slug: string): Promise<Result> => {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  if (typeof slug !== "string" || !DRILL_SLUG.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  await connectDB();
  await UserModel.updateOne(
    { _id: { $eq: userId } },
    { $addToSet: { completedDrills: { $eq: slug } } },
  );

  const day = Number.parseInt(slug.slice(3, 5), 10);
  if (Number.isFinite(day)) revalidatePath(`/course/${day}`);
  revalidatePath("/dashboard");
  return { ok: true };
};

export const getCompletion = async (): Promise<{
  days: number[];
  drills: string[];
}> => {
  const { userId } = await requireSession();
  await connectDB();
  const user = await UserModel.findOne({ _id: { $eq: userId } })
    .select("completedDays completedDrills")
    .lean();
  return {
    days: user?.completedDays ?? [],
    drills: user?.completedDrills ?? [],
  };
};
