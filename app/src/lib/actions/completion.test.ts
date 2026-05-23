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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// requireSession reads next/headers + Mongo on every call. The completion
// actions only need { userId }, so we stub the whole module per-test by
// stamping a mutable userId into module-scoped state.
let CURRENT_USER_ID: string | null = null;
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => {
    if (!CURRENT_USER_ID) throw new Error("UNAUTHORIZED");
    return { userId: CURRENT_USER_ID, email: "test@example.com", epoch: 0 };
  }),
  getSession: vi.fn(),
}));

// Imports must happen AFTER vi.mock so the mocked session is in effect.
const { setLessonComplete, setDrillComplete, getCompletion } = await import(
  "./completion"
);

describe("setLessonComplete + setDrillComplete (regression-fix)", () => {
  beforeAll(async () => {
    await connectDB();
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    const u = await UserModel.create({
      email: "test@example.com",
      passwordHash: "x".repeat(64),
    });
    CURRENT_USER_ID = u._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("setLessonComplete appends a real number, not an object", async () => {
    const res = await setLessonComplete(3);
    expect(res.ok).toBe(true);

    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays).toEqual([3]);
    // The regression we're fixing: pre-fix this would have inserted
    // { $eq: 3 } and the streak cron's `$all: [1,2,3]` would never match.
    // Sanity-check that the value is a plain number.
    expect(typeof u?.completedDays?.[0]).toBe("number");
  });

  it("setLessonComplete is idempotent — re-running keeps the array unique", async () => {
    await setLessonComplete(2);
    await setLessonComplete(2);
    await setLessonComplete(2);
    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays).toEqual([2]);
  });

  it("setLessonComplete rejects out-of-range days", async () => {
    expect((await setLessonComplete(0)).ok).toBe(false);
    expect((await setLessonComplete(15)).ok).toBe(false);
    expect((await setLessonComplete(3.5)).ok).toBe(false);
    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDays ?? []).toEqual([]);
  });

  it("the streak cron's $all filter would match after 3 calls", async () => {
    await setLessonComplete(1);
    await setLessonComplete(2);
    await setLessonComplete(3);
    const match = await UserModel.find({
      completedDays: { $all: [1, 2, 3] },
    }).lean();
    expect(match).toHaveLength(1);
    expect(match[0]?._id.toString()).toBe(CURRENT_USER_ID);
  });

  it("setDrillComplete appends the literal slug string", async () => {
    const res = await setDrillComplete("day03-scanning/01-nmap-flags");
    expect(res.ok).toBe(true);
    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDrills).toEqual(["day03-scanning/01-nmap-flags"]);
    expect(typeof u?.completedDrills?.[0]).toBe("string");
  });

  it("setDrillComplete is idempotent", async () => {
    const slug = "day05-vuln/01-cvss-score";
    await setDrillComplete(slug);
    await setDrillComplete(slug);
    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDrills).toEqual([slug]);
  });

  it("setDrillComplete rejects path-traversal-shaped slugs", async () => {
    expect((await setDrillComplete("../../etc/passwd")).ok).toBe(false);
    expect((await setDrillComplete("day99/../../bad")).ok).toBe(false);
    expect((await setDrillComplete("not-a-drill-slug")).ok).toBe(false);
    const u = await UserModel.findById(CURRENT_USER_ID).lean();
    expect(u?.completedDrills ?? []).toEqual([]);
  });

  it("getCompletion returns the persisted state", async () => {
    await setLessonComplete(1);
    await setLessonComplete(2);
    await setDrillComplete("day01-foundations/01-flag-find");
    const c = await getCompletion();
    expect(c.days.sort()).toEqual([1, 2]);
    expect(c.drills).toEqual(["day01-foundations/01-flag-find"]);
  });

  it("returns unauthorized when no session", async () => {
    CURRENT_USER_ID = null;
    const res = await setLessonComplete(1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("unauthorized");
  });
});
