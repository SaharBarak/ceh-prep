import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, maxlength: 60, default: "" },
    tier: { type: String, enum: ["free", "pro"], default: "free" },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },

    // ── Email verification (Phase 2 populates) ─────────────
    emailVerifiedAt: { type: Date, default: null },

    // ── Sparse-unique identity links (Phase 3 + Phase 4) ───
    googleSub: { type: String, default: null, unique: true, sparse: true },
    paddleCustomerId: { type: String, default: null, unique: true, sparse: true },

    // ── Role-based access control (Phase 5 promotes via CLI) ─
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // ── Email verification token (Phase 2) ─────────────────
    emailVerifyTokenHash: { type: String, default: null, select: false },
    emailVerifyTokenExpiresAt: { type: Date, default: null, select: false },

    // ── Password reset token (Phase 2) ─────────────────────
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  {
    versionKey: false,
    collection: "users",
  },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ??
  mongoose.model<UserDoc>("User", userSchema);
