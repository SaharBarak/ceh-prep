import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const auditSchema = new Schema(
  {
    at: { type: Date, default: Date.now, expires: "90d" },
    event: { type: String, required: true, maxlength: 64 },
    outcome: { type: String, enum: ["ok", "deny", "error"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    ip: { type: String, default: "", maxlength: 64 },
    ua: { type: String, default: "", maxlength: 256 },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    versionKey: false,
    collection: "audit",
  },
);

export type AuditDoc = InferSchemaType<typeof auditSchema> & { _id: mongoose.Types.ObjectId };

export const AuditModel: Model<AuditDoc> =
  (mongoose.models.Audit as Model<AuditDoc> | undefined) ??
  mongoose.model<AuditDoc>("Audit", auditSchema);
