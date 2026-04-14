"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongo";
import { ProgressModel } from "@/lib/db/models/progress";
import { requireSession } from "@/lib/auth/session";
import { SaveAnswerSchema } from "@/lib/validation/schemas";
import { getDay } from "@/lib/content";
import { UserModel } from "@/lib/db/models/user";
import { canAccessDay, type Tier } from "@/lib/billing/entitlements";

type SaveAnswerResult =
  | { ok: true; correctCount: number; completed: boolean }
  | { ok: false; error: "unauthorized" | "invalid_input" | "locked" | "not_found" };

export const saveAnswer = async (input: {
  day: number;
  questionIndex: number;
  choice: number;
}): Promise<SaveAnswerResult> => {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = SaveAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { day, questionIndex, choice } = parsed.data;
  const dayData = getDay(day);
  if (!dayData) return { ok: false, error: "not_found" };

  const question = dayData.quiz[questionIndex];
  if (!question) return { ok: false, error: "invalid_input" };

  await connectDB();

  // Tier gating — single source of truth via canAccessDay (STAB-03).
  // Narrow projection to `tier` only; the full user doc isn't needed here.
  const user = await UserModel
    .findOne({ _id: { $eq: userId } })
    .select("tier")
    .lean();
  if (!user) return { ok: false, error: "unauthorized" };
  const tier: Tier = user.tier === "pro" ? "pro" : "free";
  if (!canAccessDay(tier, day)) {
    return { ok: false, error: "locked" };
  }

  const filter = { userId: { $eq: userId }, day: { $eq: day } };
  const doc = await ProgressModel.findOne(filter);

  const answers = doc?.answers ?? new Map<string, number>();
  answers.set(String(questionIndex), choice);

  let correctCount = 0;
  dayData.quiz.forEach((q, idx) => {
    if (answers.get(String(idx)) === q.c) correctCount += 1;
  });

  const completed = answers.size >= dayData.quiz.length;

  await ProgressModel.updateOne(
    filter,
    {
      $set: {
        userId,
        day,
        answers,
        correctCount,
        updatedAt: new Date(),
        completedAt: completed ? new Date() : null,
      },
    },
    { upsert: true },
  );

  revalidatePath(`/course/${day}`);
  revalidatePath("/dashboard");

  return { ok: true, correctCount, completed };
};

export type DayProgress = {
  day: number;
  answered: number;
  correct: number;
  completed: boolean;
};

export const getUserProgress = async (): Promise<DayProgress[]> => {
  const { userId } = await requireSession();
  await connectDB();
  const docs = await ProgressModel.find({ userId: { $eq: userId } }).lean();
  return docs.map((d) => ({
    day: d.day,
    answered:
      d.answers instanceof Map ? d.answers.size : Object.keys(d.answers ?? {}).length,
    correct: d.correctCount ?? 0,
    completed: d.completedAt !== null,
  }));
};

export const getDayAnswers = async (day: number): Promise<Record<number, number>> => {
  const { userId } = await requireSession();
  await connectDB();
  const doc = await ProgressModel.findOne({
    userId: { $eq: userId },
    day: { $eq: day },
  }).lean();
  if (!doc) return {};

  const answersRaw = doc.answers;
  const out: Record<number, number> = {};
  if (answersRaw instanceof Map) {
    answersRaw.forEach((v, k) => {
      out[Number(k)] = v;
    });
  } else if (answersRaw && typeof answersRaw === "object") {
    for (const [k, v] of Object.entries(answersRaw)) {
      if (typeof v === "number") out[Number(k)] = v;
    }
  }
  return out;
};
