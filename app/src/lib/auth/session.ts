import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { env } from "@/lib/env";

export type SessionData = {
  userId?: string;
  email?: string;
  createdAt?: number;
  epoch?: number;
};

export const sessionOptions: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: env.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  },
};

export const getSession = async () => {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
};

/**
 * Authenticated-only gate. Re-fetches the User's current sessionEpoch from
 * Mongo and destroys the iron-session when the session's stored epoch is
 * lower than the server's — this is how `confirmPasswordReset` invalidates
 * every other active session: one `$inc: { sessionEpoch: 1 }` burns every
 * iron-session the user has open across all devices/browsers.
 *
 * Backfill-safe: sessions stamped before Phase 2 land with `epoch === undefined`,
 * which compares as `0 < serverEpoch === 0 → false → no drift`.
 *
 * Return type adds `epoch: number` so downstream callers (reset action,
 * email action) can read the stamped epoch for audit purposes. Existing
 * destructuring callers (`const { userId, email } = await requireSession()`)
 * remain compatible because destructuring an extra field is legal TS.
 */
export const requireSession = async (): Promise<{
  userId: string;
  email: string;
  epoch: number;
}> => {
  const session = await getSession();
  if (!session.userId || !session.email) {
    throw new Error("UNAUTHORIZED");
  }

  await connectDB();
  const user = await UserModel.findOne({ _id: { $eq: session.userId } })
    .select("+sessionEpoch")
    .lean<{ sessionEpoch?: number } | null>();

  if (!user) {
    session.destroy();
    throw new Error("UNAUTHORIZED");
  }

  const serverEpoch = user.sessionEpoch ?? 0;
  const sessionEpoch = session.epoch ?? 0;

  if (sessionEpoch < serverEpoch) {
    session.destroy();
    throw new Error("SESSION_REVOKED");
  }

  return {
    userId: session.userId,
    email: session.email,
    epoch: sessionEpoch,
  };
};
