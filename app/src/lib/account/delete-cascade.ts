import { Types } from "mongoose";
import { UserModel } from "@/lib/db/models/user";
import { ProgressModel } from "@/lib/db/models/progress";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";

/**
 * Pure cascade for account deletion.
 *
 * Returns a summary so the route handler / tests can audit / assert.
 * Lives in `lib/` (not `app/api/`) so vitest can call it directly with a
 * mongodb-memory-server-backed Mongoose without needing the Next.js
 * routing layer.
 *
 * The audit log is INTENTIONALLY untouched here — /privacy promises 12mo
 * retention even after deletion. The orphaned userId reference in audit
 * rows is by design.
 *
 * Idempotent: re-running on an already-deleted user returns
 * `{ ok: true, alreadyDeleted: true }` with zero deletions. Mongo's
 * `deleteMany` is naturally idempotent — re-running on empty collections
 * is a no-op.
 */

export type DeleteCascadeResult =
  | {
      ok: true;
      alreadyDeleted?: false;
      email: string;
      paddleCustomerId: string | null;
      deleted: {
        progress: number;
        dispatches: number;
        newsletter: number;
        user: number;
      };
    }
  | {
      ok: true;
      alreadyDeleted: true;
      email: null;
      paddleCustomerId: null;
      deleted: {
        progress: 0;
        dispatches: 0;
        newsletter: 0;
        user: 0;
      };
    };

export const cascadeDeleteAccount = async (
  userId: string,
): Promise<DeleteCascadeResult> => {
  if (!Types.ObjectId.isValid(userId)) {
    return alreadyGone();
  }
  const userOid = new Types.ObjectId(userId);

  const user = await UserModel.findOne({ _id: { $eq: userOid } })
    .select("_id email paddleCustomerId")
    .lean<{
      _id: Types.ObjectId;
      email: string;
      paddleCustomerId?: string | null;
    } | null>();

  if (!user) {
    // Already deleted — still run deleteMany on the side tables in case
    // a prior run died mid-cascade and left orphans. Naturally a no-op
    // when nothing exists.
    await Promise.all([
      ProgressModel.deleteMany({ userId: { $eq: userId } }),
      EmailDispatchModel.deleteMany({ userId: { $eq: userId } }),
    ]);
    return alreadyGone();
  }

  const [progressDel, dispatchDel] = await Promise.all([
    ProgressModel.deleteMany({ userId: { $eq: userId } }),
    EmailDispatchModel.deleteMany({ userId: { $eq: userId } }),
  ]);

  const newsletterDel = await NewsletterSubscriberModel.deleteMany({
    email: { $eq: user.email },
  });

  const userDel = await UserModel.deleteOne({ _id: { $eq: userOid } });

  return {
    ok: true,
    email: user.email,
    paddleCustomerId: user.paddleCustomerId ?? null,
    deleted: {
      progress: progressDel.deletedCount ?? 0,
      dispatches: dispatchDel.deletedCount ?? 0,
      newsletter: newsletterDel.deletedCount ?? 0,
      user: userDel.deletedCount ?? 0,
    },
  };
};

const alreadyGone = (): DeleteCascadeResult => ({
  ok: true,
  alreadyDeleted: true,
  email: null,
  paddleCustomerId: null,
  deleted: { progress: 0, dispatches: 0, newsletter: 0, user: 0 },
});
