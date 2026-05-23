import { describe, it, expect } from "vitest";
import {
  buildExam,
  gradeExam,
  stripAnswerKey,
  PASS_PCT,
  EXAM_TIMER_SECONDS,
} from "./builder";
import { DAYS } from "@/lib/content";

/**
 * Pure-function tests — no Mongo, no session, no I/O. The builder is the
 * load-bearing piece of the exam simulator; freeze its behavior here so
 * future content edits + bank growth don't silently break the runner.
 */

describe("buildExam", () => {
  it("pulls every question from every day's quiz when uncapped", () => {
    const exam = buildExam();
    const expectedTotal = DAYS.reduce((sum, d) => sum + d.quiz.length, 0);
    expect(exam.questions).toHaveLength(expectedTotal);
  });

  it("includes the canonical 4-hour timer (matches the real CEH v13 exam)", () => {
    const exam = buildExam();
    expect(exam.totalSeconds).toBe(EXAM_TIMER_SECONDS);
    expect(EXAM_TIMER_SECONDS).toBe(240 * 60);
  });

  it("caps the question count when maxQuestions is set", () => {
    const exam = buildExam(10);
    expect(exam.questions).toHaveLength(10);
  });

  it("returns up to the bank size when maxQuestions exceeds it", () => {
    const exam = buildExam(99999);
    const bankSize = DAYS.reduce((sum, d) => sum + d.quiz.length, 0);
    expect(exam.questions).toHaveLength(bankSize);
  });

  it("gives each question a stable, unique id", () => {
    const exam = buildExam();
    const ids = exam.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toMatch(/^\d+-\d+$/);
  });

  it("is deterministic when given the same seed", () => {
    const a = buildExam(undefined, 42);
    const b = buildExam(undefined, 42);
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  it("shuffles when no seed is given (different runs likely differ)", () => {
    const a = buildExam();
    const b = buildExam();
    // 50+-element shuffle has ~50! permutations; equal first 10 is
    // statistically impossible in normal use.
    expect(a.questions.slice(0, 10).map((q) => q.id)).not.toEqual(
      b.questions.slice(0, 10).map((q) => q.id),
    );
  });
});

describe("stripAnswerKey", () => {
  it("removes c and why from every question", () => {
    const exam = buildExam(5, 1);
    const client = stripAnswerKey(exam);
    expect(client.totalSeconds).toBe(exam.totalSeconds);
    for (const q of client.questions) {
      expect(q).not.toHaveProperty("c");
      expect(q).not.toHaveProperty("why");
    }
  });

  it("preserves id + day + qIndex + prompt + choices", () => {
    const exam = buildExam(3, 7);
    const client = stripAnswerKey(exam);
    expect(client.questions).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(client.questions[i]!.id).toBe(exam.questions[i]!.id);
      expect(client.questions[i]!.day).toBe(exam.questions[i]!.day);
      expect(client.questions[i]!.qIndex).toBe(exam.questions[i]!.qIndex);
      expect(client.questions[i]!.q).toBe(exam.questions[i]!.q);
      expect(client.questions[i]!.choices).toEqual(exam.questions[i]!.choices);
    }
  });
});

describe("gradeExam", () => {
  it("computes 100% when every answer is correct", () => {
    const exam = buildExam(undefined, 99);
    const choices: Record<string, number> = {};
    for (const q of exam.questions) choices[q.id] = q.c;

    const result = gradeExam(exam, choices);
    expect(result.total).toBe(exam.questions.length);
    expect(result.correct).toBe(exam.questions.length);
    expect(result.scorePct).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("computes 0% when every answer is wrong", () => {
    const exam = buildExam(undefined, 99);
    const choices: Record<string, number> = {};
    for (const q of exam.questions) {
      // Pick any non-correct choice (works because every question has 2+ options)
      choices[q.id] = q.c === 0 ? 1 : 0;
    }

    const result = gradeExam(exam, choices);
    expect(result.correct).toBe(0);
    expect(result.scorePct).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("uses the configured 70% pass threshold", () => {
    expect(PASS_PCT).toBe(70);
  });

  it("counts unanswered questions as wrong but separately as 'not answered'", () => {
    const exam = buildExam(10, 1);
    const choices: Record<string, number | null> = {};
    // Answer 7 correctly, leave 3 blank
    exam.questions.forEach((q, i) => {
      choices[q.id] = i < 7 ? q.c : null;
    });

    const result = gradeExam(exam, choices);
    expect(result.correct).toBe(7);
    const blankCount = result.answers.filter((a) => a.choice === null).length;
    expect(blankCount).toBe(3);
  });

  it("breaks down score by source day", () => {
    const exam = buildExam(undefined, 5);
    const choices: Record<string, number> = {};
    for (const q of exam.questions) choices[q.id] = q.c;

    const result = gradeExam(exam, choices);
    expect(result.perDay.length).toBeGreaterThan(0);
    // every day in perDay has total >= 1 and correct === total here (we
    // answered everything correctly above)
    for (const d of result.perDay) {
      expect(d.total).toBeGreaterThan(0);
      expect(d.correct).toBe(d.total);
      expect(d.answered).toBe(d.total);
    }
  });

  it("attaches each graded answer with day, qIndex, choice, correct", () => {
    const exam = buildExam(2, 11);
    const choices = { [exam.questions[0]!.id]: 0, [exam.questions[1]!.id]: 1 };
    const result = gradeExam(exam, choices);
    expect(result.answers).toHaveLength(2);
    for (const a of result.answers) {
      expect(typeof a.day).toBe("number");
      expect(typeof a.qIndex).toBe("number");
      expect(a.choice).not.toBeUndefined();
      expect(typeof a.correct).toBe("boolean");
    }
  });
});
