import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * EmailDispatch — append-only ledger of every marketing email we've sent.
 *
 * The unique compound index (userId, kind, day, articleSlug) is what makes
 * the drip + broadcast safe under retries: a second cron run within a window
 * tries to insert the same (userId, "drip", 5, null) and trips the duplicate
 * key — that's our "already sent" signal. We catch and skip, never re-send.
 *
 * Fields:
 *   userId       — User._id stringified (matches the rest of the project)
 *   kind         — "drip" | "broadcast" | "reengage_7d" | "reengage_21d"
 *   day          — 1..14 for drip; null for non-drip streams
 *   articleSlug  — bonus item slug for broadcast; null otherwise
 *   sentAt       — wall time the row landed (server)
 *   resendId     — Resend's message id; null when the dev stub fired
 *   outcome      — "sent" | "suppressed" | "bounced" — what the send call returned
 */
const emailDispatchSchema = new Schema(
  {
    userId: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ["drip", "broadcast", "reengage_7d", "reengage_21d", "streak_3"],
    },
    day: { type: Number, default: null, min: 1, max: 14 },
    articleSlug: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
    resendId: { type: String, default: null },
    outcome: {
      type: String,
      required: true,
      enum: ["sent", "suppressed", "bounced"],
      default: "sent",
    },
  },
  {
    versionKey: false,
  },
);

// Uniqueness contract:
//   (userId, "drip", N, null)         — exactly one Day-N drip per user
//   (userId, "broadcast", null, slug) — exactly one broadcast per article per user
//   (userId, "reengage_7d", null, null)  — exactly one 7-day winback per user lifetime
//   (userId, "reengage_21d", null, null) — exactly one 21-day nudge per user lifetime
//   (userId, "streak_3", null, null)     — exactly one 3-day-completion celebration per user lifetime
//
// Mongo treats null as a value for unique indexes, which is what we want
// here — the (userId, kind, null, null) tuple is unique per user.
emailDispatchSchema.index(
  { userId: 1, kind: 1, day: 1, articleSlug: 1 },
  { unique: true },
);

export type EmailDispatchDoc = InferSchemaType<typeof emailDispatchSchema>;

export const EmailDispatchModel: Model<EmailDispatchDoc> =
  (mongoose.models.EmailDispatch as Model<EmailDispatchDoc>) ||
  mongoose.model<EmailDispatchDoc>("EmailDispatch", emailDispatchSchema);
