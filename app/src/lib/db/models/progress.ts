import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user, per-day quiz progress.
 *
 * Shape contract (consumed by lib/actions/progress.ts):
 *   userId       — Mongo ObjectId stringified; matches User._id used in saveAnswer's filter
 *   day          — 1..14 (range enforced upstream by SaveAnswerSchema)
 *   answers      — Map<questionIndexString, selectedChoiceIndex>
 *   correctCount — re-derived on each saveAnswer call so reads are O(1)
 *   completedAt  — non-null when answers.size === dayData.quiz.length
 *
 * The Map key is `String(questionIndex)` to keep Mongo happy with non-string keys.
 * That convention is enforced in saveAnswer's `answers.set(String(questionIndex), choice)`.
 */
const progressSchema = new Schema(
  {
    userId: { type: String, required: true },
    day: { type: Number, required: true, min: 1, max: 14 },
    answers: { type: Map, of: Number, default: () => new Map() },
    correctCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

// One progress doc per user+day. Unique compound index doubles as the lookup index.
progressSchema.index({ userId: 1, day: 1 }, { unique: true });

export type ProgressDoc = InferSchemaType<typeof progressSchema>;

export const ProgressModel: Model<ProgressDoc> =
  (mongoose.models.Progress as Model<ProgressDoc>) ||
  mongoose.model<ProgressDoc>("Progress", progressSchema);
