"use server";

import { connectDB } from "@/lib/db/mongo";
import { ExamRunModel } from "@/lib/db/models/exam-run";
import { UserModel } from "@/lib/db/models/user";
import { requireSession } from "@/lib/auth/session";
import { canAccessExam, type Tier } from "@/lib/billing/entitlements";
import {
  buildExam,
  gradeExam,
  EXAM_TIMER_SECONDS,
  type Exam,
  type ExamResult,
} from "@/lib/exam/builder";
import {
  captureClientMeta,
  audit,
} from "@/lib/actions/shared";
import { z } from "zod";

/**
 * Exam server actions.
 *
 * Two-step interaction: the page builds the exam (server) and renders
 * the runner with stripped-key questions. On submit the runner sends
 * the user's choices + the exam's question id list back; the server
 * re-builds the exam against DAYS (single source of truth for the
 * answer key), grades it, persists the ExamRunModel, and returns the
 * graded result. The client never sees the answer key during the run.
 */

const SubmissionSchema = z.object({
  // Question id list as the runner received them; server rebuilds the
  // exam shape from this so we don't trust a free-form question count.
  questionIds: z.array(z.string().min(3).max(8)).min(1).max(500),
  // Map of questionId → choice index. Choices outside 0-9 are clamped
  // to null upstream by the schema.
  choices: z.record(z.string().min(3).max(8), z.number().int().min(0).max(9).nullable()),
  // How long the runner ran in seconds. Useful for the "trained N analysts"
  // cohort metric — and a sanity-check signal we can cross-reference.
  durationSeconds: z.number().int().min(0).max(EXAM_TIMER_SECONDS + 600),
});

export type SubmitExamResult =
  | { ok: true; result: ExamResult; examRunId: string }
  | { ok: false; error: "unauthorized" | "locked" | "invalid_input" | "server_error" };

export const submitExam = async (input: {
  questionIds: string[];
  choices: Record<string, number | null>;
  durationSeconds: number;
}): Promise<SubmitExamResult> => {
  const meta = await captureClientMeta();

  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = SubmissionSchema.safeParse(input);
  if (!parsed.success) {
    await audit(meta, "exam_submit", "deny", { reason: "invalid_input" }, userId);
    return { ok: false, error: "invalid_input" };
  }

  try {
    await connectDB();

    // Tier gate (defense in depth — page also checks)
    const user = await UserModel.findOne({ _id: { $eq: userId } })
      .select("tier")
      .lean();
    const tier: Tier = user?.tier === "pro" ? "pro" : "free";
    if (!canAccessExam(tier)) {
      await audit(meta, "exam_submit", "deny", { reason: "tier_locked" }, userId);
      return { ok: false, error: "locked" };
    }

    // Rebuild the exam shape from the submitted ids — this re-derives
    // the answer key from DAYS so the client can't lie about correctness.
    const exam = rebuildExamFromIds(parsed.data.questionIds);
    if (!exam) {
      await audit(meta, "exam_submit", "deny", { reason: "unknown_ids" }, userId);
      return { ok: false, error: "invalid_input" };
    }

    const result = gradeExam(exam, parsed.data.choices);

    const doc = await ExamRunModel.create({
      userId,
      startedAt: new Date(Date.now() - parsed.data.durationSeconds * 1000),
      completedAt: new Date(),
      durationSeconds: parsed.data.durationSeconds,
      totalQuestions: result.total,
      correctCount: result.correct,
      scorePct: result.scorePct,
      passed: result.passed,
      answers: result.answers,
    });

    await audit(
      meta,
      "exam_submit",
      "ok",
      {
        scorePct: result.scorePct,
        passed: result.passed,
        durationSeconds: parsed.data.durationSeconds,
      },
      userId,
    );

    return { ok: true, result, examRunId: doc._id.toString() };
  } catch (e) {
    await audit(
      meta,
      "exam_submit",
      "error",
      { message: e instanceof Error ? e.message : "unknown" },
      userId,
    );
    return { ok: false, error: "server_error" };
  }
};

/**
 * Re-derive the answer key for the submitted question id set by walking
 * DAYS. Mirrors what buildExam() returns but only includes the requested
 * ids (and only if they exist — unknown ids reject the whole submission).
 */
const rebuildExamFromIds = (ids: string[]): Exam | null => {
  const full = buildExam(); // every question in canonical order
  const byId = new Map(full.questions.map((q) => [q.id, q]));
  const out = [];
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) return null;
    out.push(q);
  }
  return { questions: out, totalSeconds: full.totalSeconds };
};
