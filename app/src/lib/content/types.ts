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

/**
 * CEH v13 domain identifiers. These power the exam simulator's per-domain
 * readiness breakdown and let buildExam stratify by official exam weight
 * once the bank is large enough to make weighting meaningful.
 *
 * Weights below are the published CEH v13 blueprint percentages. Sum is
 * ~100% (rounding aside). `meta` is reserved for exam-mechanics
 * questions (pacing, tactics) that don't map to a content domain.
 */
export type CehDomain =
  | "info-sec" // ~6% — Information Security & Ethical Hacking Overview
  | "recon" // ~21% — Reconnaissance Techniques (footprinting + enumeration)
  | "system-hacking" // ~17% — System Hacking Phases & Attack Techniques
  | "network" // ~14% — Network & Perimeter Hacking (scanning, sniffing, evasion)
  | "web-app" // ~16% — Web Application Hacking (servers + apps + SQLi)
  | "wireless" // ~6% — Wireless Network Hacking
  | "mobile-iot-ot" // ~8% — Mobile, IoT, and OT Hacking
  | "cloud" // ~6% — Cloud Computing
  | "crypto" // ~6% — Cryptography
  | "meta"; // exam-mechanics / pacing / strategy questions

export type QuizQuestion = {
  /** The question prompt. Plain text, no HTML. */
  q: string;
  /** The multiple-choice options. 2-6 typical; SaveAnswerSchema caps at 10. */
  choices: readonly string[];
  /** Index of the correct choice (0-based). */
  c: number;
  /** Optional one-sentence explanation shown after the user answers. */
  why?: string;
  /**
   * CEH v13 domain this question maps to. Used by the exam simulator's
   * per-domain readiness breakdown. Optional for backward-compat with the
   * Day-1-to-Day-14 quiz embedded in each day's page (per-day grading
   * doesn't need this); REQUIRED for honest exam-simulator results.
   * Questions without a domain fall under `meta` in the breakdown.
   */
  domain?: CehDomain;
};

/**
 * Display metadata for each domain in the simulator results UI.
 * Single source of truth — the runner imports DOMAIN_META to render
 * the per-domain breakdown chart.
 */
export const DOMAIN_META: ReadonlyArray<{
  id: CehDomain;
  label: string;
  weightPct: number;
}> = [
  { id: "info-sec", label: "Info Security & Overview", weightPct: 6 },
  { id: "recon", label: "Reconnaissance", weightPct: 21 },
  { id: "system-hacking", label: "System Hacking", weightPct: 17 },
  { id: "network", label: "Network & Perimeter", weightPct: 14 },
  { id: "web-app", label: "Web Application", weightPct: 16 },
  { id: "wireless", label: "Wireless", weightPct: 6 },
  { id: "mobile-iot-ot", label: "Mobile · IoT · OT", weightPct: 8 },
  { id: "cloud", label: "Cloud", weightPct: 6 },
  { id: "crypto", label: "Cryptography", weightPct: 6 },
  { id: "meta", label: "Exam mechanics", weightPct: 0 },
] as const;

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
  /**
   * Default CEH v13 domain for every question in this day's quiz. Mixed-domain
   * days (sniffing-and-malware, wireless-and-IoT) set this to the dominant
   * domain and override per-question via QuizQuestion.domain.
   * Resolution: `question.domain ?? day.defaultDomain ?? "meta"`.
   */
  defaultDomain?: CehDomain;
};
