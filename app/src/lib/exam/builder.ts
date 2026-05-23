import { DAYS } from "@/lib/content";
import type { QuizQuestion } from "@/lib/content";

/**
 * Pure exam builder.
 *
 * Pulls a randomized subset of the full quiz bank across all 14 days
 * and shapes it for the timed exam runner. The runner is data-driven —
 * as the underlying quiz bank grows (today: 52 questions; target: 125),
 * the simulator scales automatically without code changes.
 *
 * Deterministic when given a seed; otherwise uses Math.random. The seed
 * variant powers the test suite (stable assertions) and a future
 * "resume the same exam" feature.
 *
 * Output shape is locked by the exam runner client component + the
 * `submitExam` server action; new fields can be added freely but
 * removing/renaming requires updating both.
 */

export type ExamQuestion = {
  /** Stable identifier — `${day}-${qIndex}`. Survives shuffling. */
  id: string;
  /** Day the question came from. Used for the per-day results breakdown. */
  day: number;
  /** Original index within that day's quiz array. */
  qIndex: number;
  /** The question + choices, copied through verbatim. */
  q: string;
  choices: readonly string[];
  /**
   * Correct answer index. NOT sent to the client during the exam — the
   * runner posts the user's choices back to `submitExam` which re-derives
   * correctness server-side. Builder-output type carries it so the same
   * function can power both server grading and test setup.
   */
  c: number;
  /** Optional explanation, surfaced in review mode after submission. */
  why?: string;
};

export type Exam = {
  questions: ExamQuestion[];
  totalSeconds: number;
};

/** CEH v13 official format: 125 questions, 4 hours (240 minutes). */
export const EXAM_TIMER_SECONDS = 240 * 60;

/**
 * Build an exam from the curriculum quiz bank.
 *
 * @param maxQuestions — hard cap on the returned question count. Defaults
 *   to "every available question" so we ship the bank we have without
 *   misrepresenting count. Real CEH is 125; once the bank reaches 125+
 *   the caller can pass that as the cap.
 * @param seed — optional deterministic shuffle seed for tests / resumption.
 */
export const buildExam = (
  maxQuestions?: number,
  seed?: number,
): Exam => {
  const pool: ExamQuestion[] = [];
  for (const day of DAYS) {
    day.quiz.forEach((q: QuizQuestion, i: number) => {
      pool.push({
        id: `${day.n}-${i}`,
        day: day.n,
        qIndex: i,
        q: q.q,
        choices: q.choices,
        c: q.c,
        why: q.why,
      });
    });
  }

  const shuffled = shuffle(pool, seed);
  const count = maxQuestions ? Math.min(maxQuestions, shuffled.length) : shuffled.length;
  return {
    questions: shuffled.slice(0, count),
    totalSeconds: EXAM_TIMER_SECONDS,
  };
};

/**
 * Builder output stripped of the answer key — what the runner gets.
 * Server keeps the keyed Exam in memory only briefly during build; the
 * client never sees `c` or `why`.
 */
export type ClientExamQuestion = Omit<ExamQuestion, "c" | "why">;
export type ClientExam = {
  questions: ClientExamQuestion[];
  totalSeconds: number;
};

export const stripAnswerKey = (exam: Exam): ClientExam => ({
  totalSeconds: exam.totalSeconds,
  questions: exam.questions.map((q) => ({
    id: q.id,
    day: q.day,
    qIndex: q.qIndex,
    q: q.q,
    choices: q.choices,
  })),
});

/**
 * Grade an attempt server-side. Input is the array of choices the user
 * submitted, keyed by question id. Re-derives correctness from DAYS
 * (single source of truth) rather than trusting the client to send
 * the original `c` value.
 */
export type GradedAnswer = {
  id: string;
  day: number;
  qIndex: number;
  choice: number | null;
  correct: boolean;
};

export type ExamResult = {
  total: number;
  correct: number;
  scorePct: number;
  passed: boolean;
  perDay: ReadonlyArray<{
    day: number;
    title: string;
    answered: number;
    correct: number;
    total: number;
  }>;
  answers: GradedAnswer[];
};

/** CEH v13 pass threshold — 70% across both the simulator and the real exam. */
export const PASS_PCT = 70;

export const gradeExam = (
  exam: Exam,
  submitted: Record<string, number | null | undefined>,
): ExamResult => {
  const answers: GradedAnswer[] = exam.questions.map((q) => {
    const choice = submitted[q.id];
    const choiceN =
      typeof choice === "number" && Number.isInteger(choice) ? choice : null;
    const correct = choiceN !== null && choiceN === q.c;
    return { id: q.id, day: q.day, qIndex: q.qIndex, choice: choiceN, correct };
  });

  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = scorePct >= PASS_PCT;

  const byDay = new Map<number, { answered: number; correct: number; total: number }>();
  for (const a of answers) {
    const slot = byDay.get(a.day) ?? { answered: 0, correct: 0, total: 0 };
    slot.total += 1;
    if (a.choice !== null) slot.answered += 1;
    if (a.correct) slot.correct += 1;
    byDay.set(a.day, slot);
  }

  const perDay = DAYS.filter((d) => byDay.has(d.n)).map((d) => {
    const slot = byDay.get(d.n)!;
    return {
      day: d.n,
      title: d.title,
      answered: slot.answered,
      correct: slot.correct,
      total: slot.total,
    };
  });

  return { total, correct, scorePct, passed, perDay, answers };
};

/**
 * Fisher-Yates with optional seeded RNG. The Mulberry32 PRNG is enough
 * for shuffling — we're not picking lottery numbers; we just need
 * reproducible randomness when a test needs it.
 */
const shuffle = <T,>(arr: readonly T[], seed?: number): T[] => {
  const out = arr.slice();
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

const mulberry32 = (a: number): (() => number) => {
  let t = a;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
