import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Newsletter — public marketing list, decoupled from the product user table.
 *
 * Distinct from User.marketingOptOut (which gates the in-product drip from
 * Phase 10): a newsletter subscriber may not be a registered user, and a
 * registered user may opt into the newsletter independently of their
 * marketingOptOut flag.
 *
 * Resend Audience sync — when RESEND_AUDIENCE_ID is set, /api/newsletter
 * upserts the contact into the Resend audience and stores the returned
 * contactId here so we can soft-delete on unsubscribe. When unset, this
 * table is the source of truth and we batch-sync on first key-set.
 */
const newsletterSubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    // Where the signup came from — useful for attribution dashboards.
    // 'footer' = homepage footer, 'landing' = inline landing section,
    // 'bonus' = bonus library lockwall, 'import' = backfill from User table.
    source: {
      type: String,
      enum: ["footer", "landing", "bonus", "import", "other"],
      default: "other",
      index: true,
    },
    // Double-opt-in state. 'pending' = email sent but not clicked,
    // 'confirmed' = clicked confirm link, 'unsubscribed' = explicit out.
    status: {
      type: String,
      enum: ["pending", "confirmed", "unsubscribed"],
      default: "pending",
      index: true,
    },
    // Resend contact ID once synced — null until sync happens.
    resendContactId: { type: String, default: null },
    // Hashed token for confirm + unsubscribe links. SHA-256 hex of the
    // raw token; never stores the plaintext (same pattern as Phase 10
    // unsub tokens — see lib/auth/marketing-token.ts).
    confirmTokenHash: { type: String, default: null, select: false },
    confirmTokenExpiresAt: { type: Date, default: null, select: false },
    confirmedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    minimize: false,
  },
);

export type NewsletterSubscriber = InferSchemaType<typeof newsletterSubscriberSchema>;

export const NewsletterSubscriberModel: Model<NewsletterSubscriber> =
  (mongoose.models.NewsletterSubscriber as Model<NewsletterSubscriber>) ||
  mongoose.model<NewsletterSubscriber>(
    "NewsletterSubscriber",
    newsletterSubscriberSchema,
  );
