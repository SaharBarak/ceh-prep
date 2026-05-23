import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { ProgressModel } from "@/lib/db/models/progress";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { AuditModel } from "@/lib/db/models/audit";
import { cascadeDeleteAccount } from "./delete-cascade";

/**
 * Behavior contract for the account-delete cascade.
 *
 *   • Cascades user-owned tables (progress, email dispatch, newsletter)
 *   • Leaves audit log untouched (12mo retention per /privacy)
 *   • Idempotent — calling twice produces the same end-state
 *   • Doesn't touch other users' data
 */

describe("cascadeDeleteAccount", () => {
  beforeAll(async () => {
    await connectDB();
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns alreadyDeleted=true for an invalid ObjectId", async () => {
    const result = await cascadeDeleteAccount("not-an-objectid");
    expect(result.ok).toBe(true);
    expect(result.alreadyDeleted).toBe(true);
  });

  it("returns alreadyDeleted=true for a valid-but-missing user id", async () => {
    const result = await cascadeDeleteAccount(
      new mongoose.Types.ObjectId().toString(),
    );
    expect(result.ok).toBe(true);
    expect(result.alreadyDeleted).toBe(true);
  });

  it("hard-deletes user + progress + dispatch + newsletter; keeps audit", async () => {
    const user = await UserModel.create({
      email: "alice@example.com",
      passwordHash: "x".repeat(64),
    });
    const userId = user._id.toString();

    await Promise.all([
      ProgressModel.create({ userId, day: 1, correctCount: 4 }),
      ProgressModel.create({ userId, day: 2, correctCount: 3 }),
      EmailDispatchModel.create({
        userId,
        kind: "drip",
        day: 1,
        outcome: "sent",
      }),
      EmailDispatchModel.create({
        userId,
        kind: "drip",
        day: 2,
        outcome: "sent",
      }),
      NewsletterSubscriberModel.create({
        email: "alice@example.com",
        status: "confirmed",
      }),
      AuditModel.create({
        event: "login",
        outcome: "ok",
        userId: user._id,
        meta: { method: "password" },
      }),
    ]);

    const result = await cascadeDeleteAccount(userId);

    expect(result.ok).toBe(true);
    expect(result.alreadyDeleted).toBeFalsy();
    if (!result.alreadyDeleted) {
      expect(result.email).toBe("alice@example.com");
      expect(result.deleted).toMatchObject({
        progress: 2,
        dispatches: 2,
        newsletter: 1,
        user: 1,
      });
    }

    // Assert end state
    expect(await UserModel.countDocuments({ _id: user._id })).toBe(0);
    expect(await ProgressModel.countDocuments({ userId })).toBe(0);
    expect(await EmailDispatchModel.countDocuments({ userId })).toBe(0);
    expect(await NewsletterSubscriberModel.countDocuments({ email: "alice@example.com" })).toBe(0);

    // Audit row survives — that's the contract
    const auditRows = await AuditModel.find({ userId: user._id }).lean();
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.event).toBe("login");
  });

  it("is idempotent — running twice produces the same end state", async () => {
    const user = await UserModel.create({
      email: "bob@example.com",
      passwordHash: "x".repeat(64),
    });
    const userId = user._id.toString();

    await ProgressModel.create({ userId, day: 1, correctCount: 3 });
    await EmailDispatchModel.create({
      userId,
      kind: "drip",
      day: 1,
      outcome: "sent",
    });
    await NewsletterSubscriberModel.create({
      email: "bob@example.com",
      status: "confirmed",
    });

    const first = await cascadeDeleteAccount(userId);
    expect(first.ok).toBe(true);
    expect(first.alreadyDeleted).toBeFalsy();

    const second = await cascadeDeleteAccount(userId);
    expect(second.ok).toBe(true);
    expect(second.alreadyDeleted).toBe(true);

    // End state unchanged
    expect(await UserModel.countDocuments({ _id: user._id })).toBe(0);
    expect(await ProgressModel.countDocuments({ userId })).toBe(0);
    expect(await EmailDispatchModel.countDocuments({ userId })).toBe(0);
  });

  it("doesn't touch other users' data", async () => {
    const alice = await UserModel.create({
      email: "alice@example.com",
      passwordHash: "x".repeat(64),
    });
    const bob = await UserModel.create({
      email: "bob@example.com",
      passwordHash: "x".repeat(64),
    });

    await Promise.all([
      ProgressModel.create({ userId: alice._id.toString(), day: 1, correctCount: 4 }),
      ProgressModel.create({ userId: bob._id.toString(), day: 1, correctCount: 5 }),
      EmailDispatchModel.create({
        userId: alice._id.toString(),
        kind: "drip",
        day: 1,
        outcome: "sent",
      }),
      EmailDispatchModel.create({
        userId: bob._id.toString(),
        kind: "drip",
        day: 1,
        outcome: "sent",
      }),
      NewsletterSubscriberModel.create({
        email: "alice@example.com",
        status: "confirmed",
      }),
      NewsletterSubscriberModel.create({
        email: "bob@example.com",
        status: "confirmed",
      }),
    ]);

    await cascadeDeleteAccount(alice._id.toString());

    // Bob's data is untouched
    expect(await UserModel.countDocuments({ _id: bob._id })).toBe(1);
    expect(await ProgressModel.countDocuments({ userId: bob._id.toString() })).toBe(1);
    expect(await EmailDispatchModel.countDocuments({ userId: bob._id.toString() })).toBe(1);
    expect(await NewsletterSubscriberModel.countDocuments({ email: "bob@example.com" })).toBe(1);
  });

  it("handles paddleCustomerId attribution for ops reconciliation", async () => {
    const user = await UserModel.create({
      email: "paying@example.com",
      passwordHash: "x".repeat(64),
      paddleCustomerId: "ctm_xyz",
    });

    const result = await cascadeDeleteAccount(user._id.toString());
    expect(result.ok).toBe(true);
    if (!result.alreadyDeleted) {
      expect(result.paddleCustomerId).toBe("ctm_xyz");
    }
  });
});
