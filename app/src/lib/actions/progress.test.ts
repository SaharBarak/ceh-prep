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
import { ProgressModel } from "@/lib/db/models/progress";
import { DAYS } from "@/lib/content";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let CURRENT_USER_ID: string | null = null;
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => {
    if (!CURRENT_USER_ID) throw new Error("UNAUTHORIZED");
    return { userId: CURRENT_USER_ID, email: "test@example.com", epoch: 0 };
  }),
  getSession: vi.fn(),
}));

const { saveAnswer } = await import("./progress");

/**
 * Regression coverage for the quiz-completion → User.completedDays bridge.
 *
 * Pre-fix: saveAnswer set ProgressModel.completedAt when the user
 * finished a day's quiz, but User.completedDays stayed empty. Phase 11's
 * streak email reads User.completedDays — so completing days 1+2+3
 * never triggered the streak send. The dashboard read
 * ProgressModel.completedAt and looked fine; the source-of-truth
 * divergence was silent.
 */

describe("saveAnswer → user.completedDays bridge", () => {
  beforeAll(async () => {
    await connectDB();
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    const u = await UserModel.create({
      email: "test@example.com",
      passwordHash: "x".repeat(64),
      tier: "pro", // bypass the tier gate so all 14 days are accessible
    });
    CURRENT_USER_ID = u._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("does NOT append to completedDays on partial completion", async () => {
    const day1 = DAYS[0]!;
    expect(day1.quiz.length).toBeGreaterThan(1);

    const res = await saveAnswer({
      day: 1,
      questionIndex: 0,
      choice: day1.quiz[0]!.c,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.completed).toBe(false);

    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays ?? []).toEqual([]);
  });

  it("appends day to completedDays when the last quiz answer lands", async () => {
    const day1 = DAYS[0]!;

    // Answer every question in Day 1
    for (let i = 0; i < day1.quiz.length; i++) {
      const res = await saveAnswer({
        day: 1,
        questionIndex: i,
        choice: day1.quiz[i]!.c,
      });
      expect(res.ok).toBe(true);
    }

    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays).toEqual([1]);

    // ProgressModel.completedAt also set — both sources of truth agree
    const p = await ProgressModel.findOne({
      userId: CURRENT_USER_ID,
      day: 1,
    }).lean();
    expect(p?.completedAt).not.toBeNull();
  });

  it("makes the streak cron's $all: [1,2,3] filter match after finishing days 1-3", async () => {
    for (const day of [1, 2, 3]) {
      const d = DAYS[day - 1]!;
      for (let i = 0; i < d.quiz.length; i++) {
        await saveAnswer({
          day,
          questionIndex: i,
          choice: d.quiz[i]!.c,
        });
      }
    }

    const match = await UserModel.find({
      completedDays: { $all: [1, 2, 3] },
    }).lean();
    expect(match).toHaveLength(1);
    expect(match[0]?._id.toString()).toBe(CURRENT_USER_ID);
  });

  it("is idempotent — re-answering on an already-complete day doesn't duplicate", async () => {
    const day1 = DAYS[0]!;
    for (let i = 0; i < day1.quiz.length; i++) {
      await saveAnswer({ day: 1, questionIndex: i, choice: day1.quiz[i]!.c });
    }
    // Change one answer (still completed)
    await saveAnswer({ day: 1, questionIndex: 0, choice: 0 });

    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays).toEqual([1]);
  });
});
