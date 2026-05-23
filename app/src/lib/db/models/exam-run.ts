import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * ExamRun — one submitted exam attempt per row.
 *
 * Persists the user's answers, grading, and timing so we can:
 *   1. Render past attempts in the user's settings / export / dashboard
 *   2. Build the long-promised "trained N analysts" cohort metric honestly
 *      once enough runs accumulate
 *   3. Power a per-domain weak-spot dashboard in a future iteration
 *      (when questions get domain tags)
 *
 * Schema notes:
 *   - userId is the same stringified _id used elsewhere in the project
 *   - answers is a small dense array; we copy the question id + chosen
 *     index + correctness flag so historical attempts survive content
 *     edits (if Day-7 question 3 changes, prior attempts still grade
 *     against the answers at the time)
 *   - completedAt nullable: in-progress runs would land null. v1 only
 *     persists on submit, so all rows currently have completedAt set.
 */
const examRunSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    totalQuestions: { type: Number, required: true },
    correctCount: { type: Number, required: true, default: 0 },
    scorePct: { type: Number, required: true, default: 0 },
    passed: { type: Boolean, required: true, default: false },
    answers: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            day: { type: Number, required: true },
            qIndex: { type: Number, required: true },
            // domain optional for backward compat with pre-domain-tagging runs;
            // new runs always supply it via the builder's resolved value.
            domain: { type: String, default: null },
            choice: { type: Number, default: null },
            correct: { type: Boolean, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  {
    versionKey: false,
    collection: "exam_runs",
  },
);

export type ExamRunDoc = InferSchemaType<typeof examRunSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ExamRunModel: Model<ExamRunDoc> =
  (mongoose.models.ExamRun as Model<ExamRunDoc> | undefined) ??
  mongoose.model<ExamRunDoc>("ExamRun", examRunSchema);
