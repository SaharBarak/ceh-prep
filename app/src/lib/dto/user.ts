import type { UserDoc } from "@/lib/db/models/user";

/**
 * Explicit allow-list mapping from Mongoose doc to the shape the client sees.
 *
 * The mapper starts from an empty object literal and only copies fields listed
 * here — any server-only field (credentials, token hashes, identity links,
 * internal counters) is impossible to leak by construction.
 */
export type UserPublic = {
  id: string;
  email: string;
  displayName: string;
  tier: "free" | "pro";
  emailVerifiedAt: string | null;
  role: "user" | "admin";
  createdAt: string;
};

export const toPublicUser = (doc: UserDoc): UserPublic => ({
  id: doc._id.toString(),
  email: doc.email,
  displayName: doc.displayName ?? "",
  tier: (doc.tier ?? "free") as "free" | "pro",
  emailVerifiedAt: doc.emailVerifiedAt ? doc.emailVerifiedAt.toISOString() : null,
  role: (doc.role ?? "user") as "user" | "admin",
  createdAt: (doc.createdAt ?? new Date()).toISOString(),
});
