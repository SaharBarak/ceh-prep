/**
 * Curriculum content types — the contract every Day in DAYS satisfies.
 *
 * Imported by:
 *   - app/(app)/course/[day]/page.tsx     (lesson rendering)
 *   - app/(app)/dashboard/page.tsx        (day list + counts)
 *   - lib/actions/progress.ts             (quiz grading via q.c)
 *
 * Field shapes are locked by these consumers — changing the shape requires
 * updating every caller.
 */

export type QuizQuestion = {
  /** The question prompt. Plain text, no HTML. */
  q: string;
  /** The multiple-choice options. 2-6 typical; SaveAnswerSchema caps at 10. */
  choices: readonly string[];
  /** Index of the correct choice (0-based). */
  c: number;
  /** Optional one-sentence explanation shown after the user answers. */
  why?: string;
};

export type Concept = {
  /** Short uppercase tag (e.g. "RECON", "AUTH"). */
  tag: string;
  /** Heading line. */
  h: string;
  /** 1-2 sentence body. */
  b: string;
};

export type Exercise = {
  /** Title of the hands-on lab card. */
  title: string;
  /** Setup / "do this" instructions. 1-3 sentences. */
  body: string;
  /** Copy-pasteable command shown in the code block. */
  cmd: string;
  /** Optional WebVM drill slug for Phase 8 deep-link (e.g. "day10/01-payload-anatomy"). */
  drillSlug?: string;
};

export type Day = {
  /** Day number 1..14 — must match position in DAYS array. */
  n: number;
  /** Module title. */
  title: string;
  /** One-sentence blurb shown on the dashboard + course header. */
  blurb: string;
  /** Lesson body as trusted HTML. Rendered via dangerouslySetInnerHTML. */
  lesson: string;
  /** 3-6 concept cards shown after the lesson. First card spans 2 cols. */
  concepts: readonly Concept[];
  /** The hands-on lab exercise for the day. */
  exercise: Exercise;
  /** The day's quiz bank — typically 5 questions. */
  quiz: readonly QuizQuestion[];
};
