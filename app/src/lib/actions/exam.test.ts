import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { ExamRunModel } from "@/lib/db/models/exam-run";
import { buildExam } from "@/lib/exam/builder";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map()),
  cookies: vi.fn(),
}));

let CURRENT_USER_ID: string | null = null;
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => {
    if (!CURRENT_USER_ID) throw new Error("UNAUTHORIZED");
    return { userId: CURRENT_USER_ID, email: "test@example.com", epoch: 0 };
  }),
  getSession: vi.fn(),
}));

const { submitExam } = await import("./exam");

describe("submitExam", () => {
  beforeAll(async () => {
    await connectDB();
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("rejects unauthorized callers", async () => {
    CURRENT_USER_ID = null;
    const res = await submitExam({ questionIds: [], choices: {}, durationSeconds: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("unauthorized");
  });

  it("rejects free-tier users (tier gate)", async () => {
    const u = await UserModel.create({
      email: "free@example.com",
      passwordHash: "x".repeat(64),
      tier: "free",
    });
    CURRENT_USER_ID = u._id.toString();
    const exam = buildExam(3, 1);
    const res = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices: {},
      durationSeconds: 60,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("locked");
  });

  it("rejects invalid input (empty question list)", async () => {
    const u = await UserModel.create({
      email: "pro@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro",
    });
    CURRENT_USER_ID = u._id.toString();
    const res = await submitExam({
      questionIds: [],
      choices: {},
      durationSeconds: 60,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects unknown question ids (client tampering)", async () => {
    const u = await UserModel.create({
      email: "pro@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro",
    });
    CURRENT_USER_ID = u._id.toString();
    const res = await submitExam({
      questionIds: ["999-99"],
      choices: { "999-99": 0 },
      durationSeconds: 60,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_input");
  });

  it("grades a perfect exam and persists an ExamRun", async () => {
    const u = await UserModel.create({
      email: "pro@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro",
    });
    CURRENT_USER_ID = u._id.toString();

    const exam = buildExam(10, 7);
    const choices: Record<string, number> = {};
    for (const q of exam.questions) choices[q.id] = q.c;

    const res = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices,
      durationSeconds: 600,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.scorePct).toBe(100);
      expect(res.result.correct).toBe(10);
      expect(res.result.passed).toBe(true);
      expect(res.examRunId).toBeTruthy();
    }

    // ExamRun persisted
    const runs = await ExamRunModel.find({ userId: CURRENT_USER_ID }).lean();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.scorePct).toBe(100);
    expect(runs[0]?.passed).toBe(true);
    expect(runs[0]?.totalQuestions).toBe(10);
  });

  it("grades a failing exam (< 70%) and marks passed=false", async () => {
    const u = await UserModel.create({
      email: "pro@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro",
    });
    CURRENT_USER_ID = u._id.toString();

    const exam = buildExam(10, 9);
    const choices: Record<string, number | null> = {};
    // Get 5 right, 5 wrong = 50% (fails the 70% threshold)
    exam.questions.forEach((q, i) => {
      choices[q.id] = i < 5 ? q.c : q.c === 0 ? 1 : 0;
    });

    const res = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices,
      durationSeconds: 3600,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.scorePct).toBe(50);
      expect(res.result.passed).toBe(false);
    }
  });

  it("re-derives correctness server-side (ignores client-supplied choices for keys it doesn't recognize)", async () => {
    const u = await UserModel.create({
      email: "pro@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro",
    });
    CURRENT_USER_ID = u._id.toString();

    const exam = buildExam(3, 13);
    // Client tries to inject a known-correct answer for a fake id alongside legit ids
    const choices: Record<string, number | null> = {
      "999-99": 0,
    };
    for (const q of exam.questions) choices[q.id] = q.c;

    // The legit ids submission should still succeed (extras are ignored by Zod's record schema)
    const res = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices,
      durationSeconds: 60,
    });
    // The legit ids submission should succeed; the fake key inside choices
    // doesn't appear in questionIds so it has no effect on the grade.
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.total).toBe(3);
      expect(res.result.correct).toBe(3);
    }
  });
});
