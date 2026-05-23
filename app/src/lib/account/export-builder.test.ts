import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { ProgressModel } from "@/lib/db/models/progress";
import { EmailDispatchModel } from "@/lib/db/models/email-dispatch";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import { AuditModel } from "@/lib/db/models/audit";
import { buildAccountExport, SCHEMA_VERSION } from "./export-builder";

/**
 * Wire-format contract for /api/account/export.
 *
 * These tests freeze the JSON archive shape so future refactors can't
 * silently break the GDPR-export promise made in /privacy. Add fields by
 * extending the type + tests; never rename or remove without a
 * SCHEMA_VERSION bump.
 */

describe("buildAccountExport", () => {
  beforeAll(async () => {
    // MongoMemoryServer downloads the binary on first run — can exceed
    // the default 10s hook timeout on a cold cache or slow network.
    await connectDB();
  }, 120_000);

  beforeEach(async () => {
    // Drop+recreate beats deleteMany here: the schema's `default: null`
    // on googleSub + paddleCustomerId fights the sparse-unique index
    // when multiple test users land with the null defaults. A clean drop
    // resets the index along with the data.
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns null for an invalid ObjectId", async () => {
    const result = await buildAccountExport("not-an-objectid");
    expect(result).toBeNull();
  });

  it("returns null for a valid-but-missing user id", async () => {
    const result = await buildAccountExport(new mongoose.Types.ObjectId().toString());
    expect(result).toBeNull();
  });

  it("includes every promised top-level field for an empty account", async () => {
    const user = await UserModel.create({
      email: "alice@example.com",
      passwordHash: "x".repeat(64),
      displayName: "Alice",
      tier: "free",
    });

    const archive = await buildAccountExport(user._id.toString());
    expect(archive).not.toBeNull();
    if (!archive) return;

    expect(archive.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof archive.exportedAt).toBe("string");
    expect(archive.account).toBeDefined();
    expect(archive.progress).toEqual([]);
    expect(archive.emailDispatches).toEqual([]);
    expect(archive.newsletter).toBeNull();
    expect(archive.audit).toEqual([]);
  });

  it("excludes auth-internal secrets from the archive", async () => {
    const user = await UserModel.create({
      email: "bob@example.com",
      passwordHash: "argon2id-hash-bytes-go-here",
      emailVerifyTokenHash: "secret-hash",
      passwordResetTokenHash: "another-secret",
      sessionEpoch: 42,
      failedLoginCount: 3,
    });

    const archive = await buildAccountExport(user._id.toString());
    const account = archive!.account as Record<string, unknown>;

    expect(account.passwordHash).toBeUndefined();
    expect(account.emailVerifyTokenHash).toBeUndefined();
    expect(account.passwordResetTokenHash).toBeUndefined();
    expect(account.sessionEpoch).toBeUndefined();
    expect(account.failedLoginCount).toBeUndefined();
    expect(account.lockedUntil).toBeUndefined();
  });

  it("populates account identifier fields", async () => {
    const user = await UserModel.create({
      email: "carol@example.com",
      passwordHash: "x".repeat(64),
      displayName: "Carol",
      tier: "pro",
      googleSub: "google-sub-12345",
      paddleCustomerId: "ctm_abc",
      timezone: "Europe/Berlin",
      completedDays: [1, 2, 3],
      completedDrills: ["nmap-scan", "ssh-pivot"],
    });

    const archive = await buildAccountExport(user._id.toString());
    const acct = archive!.account;

    expect(acct.id).toBe(user._id.toString());
    expect(acct.email).toBe("carol@example.com");
    expect(acct.displayName).toBe("Carol");
    expect(acct.tier).toBe("pro");
    expect(acct.googleSub).toBe("google-sub-12345");
    expect(acct.paddleCustomerId).toBe("ctm_abc");
    expect(acct.timezone).toBe("Europe/Berlin");
    expect(acct.completedDays).toEqual([1, 2, 3]);
    expect(acct.completedDrills).toEqual(["nmap-scan", "ssh-pivot"]);
  });

  it("includes progress, email dispatches, newsletter, and audit rows", async () => {
    const user = await UserModel.create({
      email: "dana@example.com",
      passwordHash: "x".repeat(64),
    });
    const userId = user._id.toString();

    await ProgressModel.create({
      userId,
      day: 1,
      correctCount: 4,
      completedAt: new Date(),
      answers: new Map([
        ["0", 2],
        ["1", 1],
      ]),
    });

    await EmailDispatchModel.create({
      userId,
      kind: "drip",
      day: 1,
      outcome: "sent",
    });

    await NewsletterSubscriberModel.create({
      email: "dana@example.com",
      source: "footer",
      status: "confirmed",
      confirmedAt: new Date(),
    });

    await AuditModel.create({
      event: "login",
      outcome: "ok",
      userId: user._id,
      ip: "10.0.0.1",
      ua: "vitest",
      meta: { method: "password" },
    });

    const archive = await buildAccountExport(userId);
    expect(archive).not.toBeNull();
    if (!archive) return;

    expect(archive.progress).toHaveLength(1);
    const firstProgress = archive.progress[0]!;
    expect(firstProgress).toMatchObject({ day: 1, correctCount: 4 });
    // answers Map → plain object on serialization
    expect(firstProgress.answers).toEqual({ "0": 2, "1": 1 });

    expect(archive.emailDispatches).toHaveLength(1);
    expect(archive.emailDispatches[0]).toMatchObject({
      kind: "drip",
      day: 1,
      outcome: "sent",
    });

    expect(archive.newsletter).not.toBeNull();
    expect(archive.newsletter).toMatchObject({
      source: "footer",
      status: "confirmed",
    });

    expect(archive.audit).toHaveLength(1);
    const firstAudit = archive.audit[0]!;
    expect(firstAudit).toMatchObject({
      event: "login",
      outcome: "ok",
      ip: "10.0.0.1",
      ua: "vitest",
    });
    expect(firstAudit.meta).toMatchObject({ method: "password" });
  });

  it("only includes rows belonging to the requested user", async () => {
    const alice = await UserModel.create({
      email: "alice@example.com",
      passwordHash: "x".repeat(64),
    });
    const bob = await UserModel.create({
      email: "bob@example.com",
      passwordHash: "x".repeat(64),
    });

    await ProgressModel.create({
      userId: alice._id.toString(),
      day: 1,
      correctCount: 3,
    });
    await ProgressModel.create({
      userId: bob._id.toString(),
      day: 1,
      correctCount: 5,
    });
    await EmailDispatchModel.create({
      userId: alice._id.toString(),
      kind: "drip",
      day: 1,
      outcome: "sent",
    });
    await EmailDispatchModel.create({
      userId: bob._id.toString(),
      kind: "drip",
      day: 2,
      outcome: "sent",
    });

    const aliceArchive = await buildAccountExport(alice._id.toString());
    expect(aliceArchive!.progress).toHaveLength(1);
    expect(aliceArchive!.progress[0]!.correctCount).toBe(3);
    expect(aliceArchive!.emailDispatches).toHaveLength(1);
    expect(aliceArchive!.emailDispatches[0]!.day).toBe(1);
  });

  it("is round-trip JSON-stable (no Date / Buffer / Map leaks)", async () => {
    const user = await UserModel.create({
      email: "eve@example.com",
      passwordHash: "x".repeat(64),
      emailVerifiedAt: new Date(),
    });
    await ProgressModel.create({
      userId: user._id.toString(),
      day: 1,
      correctCount: 2,
      completedAt: new Date(),
      answers: new Map([["0", 1]]),
    });

    const archive = await buildAccountExport(user._id.toString());
    const json = JSON.stringify(archive);
    const parsed = JSON.parse(json);

    expect(parsed.account.id).toBe(archive!.account.id);
    expect(parsed.account.email).toBe(archive!.account.email);
    expect(typeof parsed.account.emailVerifiedAt).toBe("string");
    expect(typeof parsed.progress[0].completedAt).toBe("string");
    expect(parsed.progress[0].answers).toEqual({ "0": 1 });
  });
});
