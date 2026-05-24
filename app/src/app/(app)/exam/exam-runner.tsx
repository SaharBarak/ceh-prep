"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { submitExam, type SubmitExamResult } from "@/lib/actions/exam";
import { PASS_PCT, type ClientExam } from "@/lib/exam/builder";

type Props = {
  exam: ClientExam;
};

type RunnerState = {
  phase: "idle" | "running" | "submitting" | "done";
  currentIndex: number;
  /** questionId → chosen index (or null = explicitly skipped). */
  answers: Record<string, number | null>;
  /** questionId → true when the user has marked it for review. The flag is
   *  client-only — it never goes back to the server. Mirrors the real
   *  Pearson VUE "flag for review" button on the CEH exam. */
  flagged: Record<string, boolean>;
  /** Seconds elapsed since the run started. Drives the timer + the
   *  durationSeconds field on submit. */
  elapsedSeconds: number;
  result: SubmitExamResult | null;
};

type Action =
  | { type: "start" }
  | { type: "answer"; id: string; choice: number }
  | { type: "toggle_flag"; id: string }
  | { type: "goto"; index: number }
  | { type: "tick" }
  | { type: "submit_pending" }
  | { type: "submit_done"; result: SubmitExamResult };

const reducer = (state: RunnerState, action: Action): RunnerState => {
  switch (action.type) {
    case "start":
      return { ...state, phase: "running", elapsedSeconds: 0 };
    case "answer":
      return {
        ...state,
        answers: { ...state.answers, [action.id]: action.choice },
      };
    case "toggle_flag":
      return {
        ...state,
        flagged: {
          ...state.flagged,
          [action.id]: !state.flagged[action.id],
        },
      };
    case "goto":
      return { ...state, currentIndex: action.index };
    case "tick":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case "submit_pending":
      return { ...state, phase: "submitting" };
    case "submit_done":
      return { ...state, phase: "done", result: action.result };
    default:
      return state;
  }
};

const initial: RunnerState = {
  phase: "idle",
  currentIndex: 0,
  answers: {},
  flagged: {},
  elapsedSeconds: 0,
  result: null,
};

/**
 * Timed exam runner.
 *
 * State machine: idle → running → submitting → done. Submit fires on
 * either user click or timer hitting zero. Phase change to "done"
 * triggers the results view in the same component.
 *
 * No mid-run persistence (v1) — refreshing loses state. Page header
 * warns the user about this. ExamRun persistence happens only on submit.
 */
export const ExamRunner = ({ exam }: Props) => {
  const [state, dispatch] = useReducer(reducer, initial);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const total = exam.questions.length;
  const currentQ = exam.questions[state.currentIndex];
  const answered = useMemo(
    () =>
      Object.values(state.answers).filter((v) => v !== null && v !== undefined)
        .length,
    [state.answers],
  );
  const flaggedCount = useMemo(
    () => Object.values(state.flagged).filter(Boolean).length,
    [state.flagged],
  );
  const remainingSeconds = Math.max(0, exam.totalSeconds - state.elapsedSeconds);
  const timedOut = remainingSeconds === 0 && state.phase === "running";
  const unansweredCount = total - answered;

  const performSubmit = async () => {
    setConfirmingSubmit(false);
    dispatch({ type: "submit_pending" });
    const result = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices: state.answers,
      durationSeconds: state.elapsedSeconds,
    });
    dispatch({ type: "submit_done", result });
  };

  /**
   * Submit guard: surface a confirm dialog if the user has any unanswered
   * OR any still-flagged questions. Both signals mean "I'm not done" —
   * unanswered are blanks, flagged are deliberate come-back-to markers.
   * Auto-submit on timeout bypasses this — running out of time IS the
   * implicit confirmation.
   */
  const handleSubmit = () => {
    if (unansweredCount > 0 || flaggedCount > 0) {
      setConfirmingSubmit(true);
      return;
    }
    performSubmit();
  };

  // Tick the timer once per second while running.
  useEffect(() => {
    if (state.phase !== "running") return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // Auto-submit when the timer reaches zero — bypass the unanswered
  // confirm dialog because running out of time IS the confirmation.
  useEffect(() => {
    if (timedOut) performSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  if (state.phase === "idle") {
    return <IdleScreen onStart={() => dispatch({ type: "start" })} total={total} />;
  }

  if (state.phase === "done" && state.result) {
    if (!state.result.ok) {
      return <SubmitErrorScreen error={state.result.error} />;
    }
    return <ResultsScreen result={state.result.result} examRunId={state.result.examRunId} />;
  }

  if (!currentQ) return null;

  return (
    <section className="space-y-8">
      <ExamHeader
        currentIndex={state.currentIndex}
        total={total}
        answered={answered}
        flaggedCount={flaggedCount}
        remainingSeconds={remainingSeconds}
      />

      <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="mono-tag">
            Question {state.currentIndex + 1} · drawn from Day{" "}
            {String(currentQ.day).padStart(2, "0")}
          </p>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "toggle_flag", id: currentQ.id })
            }
            aria-pressed={Boolean(state.flagged[currentQ.id])}
            className={[
              "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
              state.flagged[currentQ.id]
                ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                : "border-[var(--color-line)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]",
            ].join(" ")}
          >
            {state.flagged[currentQ.id] ? "⚑ Flagged" : "⚐ Flag for review"}
          </button>
        </div>
        <h2 className="display text-xl leading-snug text-[var(--color-ink)] md:text-2xl">
          {currentQ.q}
        </h2>

        <ul className="mt-6 space-y-3">
          {currentQ.choices.map((choice, i) => {
            const picked = state.answers[currentQ.id] === i;
            return (
              <li key={i}>
                <label
                  className={[
                    "flex cursor-pointer items-start gap-4 rounded-lg border px-4 py-3 transition-colors",
                    picked
                      ? "border-[var(--color-accent)] bg-[rgba(190,242,100,0.06)]"
                      : "border-[var(--color-line)] bg-[var(--color-bg)] hover:border-[var(--color-line-strong)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name={`q-${currentQ.id}`}
                    checked={picked}
                    onChange={() =>
                      dispatch({ type: "answer", id: currentQ.id, choice: i })
                    }
                    className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-ink-dim)]">
                    <span className="mr-2 font-mono text-[var(--color-ink-faint)]">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {choice}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </article>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-6">
        <div className="flex items-center gap-2">
          <NavButton
            disabled={state.currentIndex === 0}
            onClick={() =>
              dispatch({ type: "goto", index: state.currentIndex - 1 })
            }
          >
            ← Prev
          </NavButton>
          <NavButton
            disabled={state.currentIndex === total - 1}
            onClick={() =>
              dispatch({ type: "goto", index: state.currentIndex + 1 })
            }
          >
            Next →
          </NavButton>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            {answered}/{total} answered
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={state.phase !== "running"}
            className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.phase === "submitting" ? "Submitting…" : "Submit exam"}
          </button>
        </div>
      </nav>

      {confirmingSubmit && (
        <ConfirmSubmitDialog
          unansweredCount={unansweredCount}
          flaggedCount={flaggedCount}
          total={total}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={performSubmit}
        />
      )}

      <QuestionGrid
        total={total}
        currentIndex={state.currentIndex}
        answers={state.answers}
        flagged={state.flagged}
        questionIds={exam.questions.map((q) => q.id)}
        onJump={(i) => dispatch({ type: "goto", index: i })}
      />
    </section>
  );
};

/* ─────────────────────────────
   Screens + primitives
   ───────────────────────────── */

const IdleScreen = ({ onStart, total }: { onStart: () => void; total: number }) => (
  <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center md:p-12">
    <p className="mono-tag mb-3">Ready</p>
    <h2 className="display text-3xl text-[var(--color-ink)]">
      {total} questions. 4 hours.
      <br />
      One shot.
    </h2>
    <p className="mx-auto mt-4 max-w-[50ch] text-sm text-[var(--color-ink-dim)]">
      Once you start, the timer runs continuously. Flagging questions and
      navigating with prev/next is free — you can revisit anything until
      you submit. Pass threshold is{" "}
      <strong className="text-[var(--color-accent)]">{PASS_PCT}%</strong>.
    </p>
    <button type="button" onClick={onStart} className="btn-primary mt-8">
      Start exam →
    </button>
  </section>
);

const ExamHeader = ({
  currentIndex,
  total,
  answered,
  flaggedCount,
  remainingSeconds,
}: {
  currentIndex: number;
  total: number;
  answered: number;
  flaggedCount: number;
  remainingSeconds: number;
}) => {
  const pct = Math.round(((currentIndex + 1) / total) * 100);
  const lowTime = remainingSeconds < 600; // last 10 min flag
  return (
    <header className="sticky top-0 z-30 -mx-2 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 px-2 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="mono-tag">
            Q {currentIndex + 1} / {total}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            {answered} answered
          </p>
          {flaggedCount > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
              ⚑ {flaggedCount} flagged
            </p>
          )}
        </div>
        <div
          className={[
            "font-mono text-sm tabular-nums",
            lowTime ? "text-red-300" : "text-[var(--color-accent)]",
          ].join(" ")}
        >
          ⧗ {formatHMS(remainingSeconds)}
        </div>
      </div>
      <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
        <div
          className="h-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  );
};

const NavButton = ({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-40"
  >
    {children}
  </button>
);

const QuestionGrid = ({
  total,
  currentIndex,
  answers,
  flagged,
  questionIds,
  onJump,
}: {
  total: number;
  currentIndex: number;
  answers: Record<string, number | null>;
  flagged: Record<string, boolean>;
  questionIds: string[];
  onJump: (i: number) => void;
}) => (
  <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
    <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
      Jump to question
    </summary>
    <div className="mt-2 mb-3 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-faint)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-[var(--color-accent)]/40 bg-[rgba(190,242,100,0.08)]" />
        answered
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-amber-400/60 bg-amber-500/10" />
        flagged
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-[var(--color-line)] bg-[var(--color-bg)]" />
        blank
      </span>
    </div>
    <div className="grid grid-cols-10 gap-1.5 md:grid-cols-15">
      {Array.from({ length: total }, (_, i) => {
        const id = questionIds[i]!;
        const isAnswered = answers[id] !== undefined && answers[id] !== null;
        const isFlagged = Boolean(flagged[id]);
        const isCurrent = i === currentIndex;

        // Visual priority: current > flagged > answered > blank. Flagged
        // beats answered because the user explicitly marked it as
        // "come back here" — that's the signal they want surfaced.
        let cls: string;
        if (isCurrent) {
          cls = "border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]";
        } else if (isFlagged) {
          cls = "border border-amber-400/60 bg-amber-500/10 text-amber-200";
        } else if (isAnswered) {
          cls = "border border-[var(--color-accent)]/40 bg-[rgba(190,242,100,0.08)] text-[var(--color-accent)]";
        } else {
          cls = "border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)]";
        }

        const stateLabel = [
          isAnswered ? "answered" : null,
          isFlagged ? "flagged" : null,
        ]
          .filter(Boolean)
          .join(", ");

        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Jump to question ${i + 1}${stateLabel ? ` (${stateLabel})` : ""}`}
            className={["aspect-square rounded text-[10px] font-mono transition-colors", cls].join(" ")}
          >
            {i + 1}
            {isFlagged && !isCurrent && (
              <span className="ml-0.5 text-[8px]" aria-hidden>
                ⚑
              </span>
            )}
          </button>
        );
      })}
    </div>
  </details>
);

const SubmitErrorScreen = ({ error }: { error: string }) => (
  <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
    <p className="mono-tag mb-3 text-red-300">Submission failed</p>
    <h2 className="display text-2xl text-[var(--color-ink)]">
      {error === "locked"
        ? "Your account is no longer Pro."
        : error === "unauthorized"
          ? "Your session expired."
          : "Something went wrong."}
    </h2>
    <p className="mx-auto mt-3 max-w-[50ch] text-sm text-[var(--color-ink-dim)]">
      Reload and try again. If it keeps failing, email hello@cehprep.local
      and we&apos;ll restore your run from the server logs.
    </p>
    <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
      ← Dashboard
    </Link>
  </section>
);

const ResultsScreen = ({
  result,
  examRunId,
}: {
  result: NonNullable<Extract<SubmitExamResult, { ok: true }>["result"]>;
  examRunId: string;
}) => (
  <section className="space-y-8">
    <header
      className={[
        "rounded-2xl border p-8 text-center md:p-10",
        result.passed
          ? "border-[var(--color-accent)]/40 bg-[rgba(190,242,100,0.04)]"
          : "border-amber-500/30 bg-amber-500/5",
      ].join(" ")}
    >
      <p
        className={[
          "mono-tag mb-3",
          result.passed ? "text-[var(--color-accent)]" : "text-amber-300",
        ].join(" ")}
      >
        {result.passed ? "Pass" : "Below threshold"}
      </p>
      <h2 className="display text-5xl text-[var(--color-ink)] md:text-7xl">
        {result.scorePct}%
      </h2>
      <p className="mt-3 text-sm text-[var(--color-ink-dim)]">
        {result.correct} / {result.total} correct · pass threshold {PASS_PCT}%
      </p>
    </header>

    <section>
      <p className="mono-tag mb-2">Readiness by CEH v13 domain</p>
      <p className="mb-5 max-w-[60ch] text-xs text-[var(--color-ink-faint)]">
        The real exam scores against 9 official domains with the weights
        shown. Use this to triage what to study next.
      </p>
      <div className="space-y-2">
        {result.perDomain.map((d) => {
          const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
          const tone =
            pct >= PASS_PCT
              ? "text-[var(--color-accent)]"
              : pct >= 50
                ? "text-amber-300"
                : "text-red-300";
          const barTone =
            pct >= PASS_PCT
              ? "bg-[var(--color-accent)]"
              : pct >= 50
                ? "bg-amber-400/80"
                : "bg-red-400/70";
          return (
            <article
              key={d.domain}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm text-[var(--color-ink)]">
                  {d.label}
                  {d.weightPct > 0 && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                      ~{d.weightPct}% on real exam
                    </span>
                  )}
                </h3>
                <span className={`font-mono text-sm tabular-nums ${tone}`}>{pct}%</span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                <div
                  className={`h-full ${barTone} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                {d.correct} / {d.total} correct ({d.answered} answered)
              </p>
            </article>
          );
        })}
      </div>
    </section>

    <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
        Drill-down by day · review links
      </summary>
      <div className="mt-4 grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
        {result.perDay.map((d) => {
          const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
          const tone =
            pct >= PASS_PCT
              ? "text-[var(--color-accent)]"
              : "text-amber-300";
          return (
            <article
              key={d.day}
              className="bg-[var(--color-bg)] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm text-[var(--color-ink)]">
                  Day {String(d.day).padStart(2, "0")} — {d.title}
                </h3>
                <span className={`font-mono text-xs ${tone}`}>{pct}%</span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                {d.correct} / {d.total} correct
              </p>
              <Link
                href={`/course/${d.day}`}
                className="mono-tag mt-2 inline-block hover:text-[var(--color-accent)]"
              >
                Review →
              </Link>
            </article>
          );
        })}
      </div>
    </details>

    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-6">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
        Run id: <code>{examRunId.slice(-8)}</code>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard" className="btn-ghost text-xs">
          ← Dashboard
        </Link>
        <a href="/exam" className="btn-primary text-xs">
          Take another run →
        </a>
      </div>
    </footer>
  </section>
);

const ConfirmSubmitDialog = ({
  unansweredCount,
  flaggedCount,
  total,
  onCancel,
  onConfirm,
}: {
  unansweredCount: number;
  flaggedCount: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  // Build the headline + body so both unanswered and flagged states are
  // surfaced when present. Either state is enough to trip the dialog.
  const headlineParts: string[] = [];
  if (unansweredCount > 0) {
    headlineParts.push(`${unansweredCount} blank`);
  }
  if (flaggedCount > 0) {
    headlineParts.push(`${flaggedCount} still flagged`);
  }
  const headline =
    headlineParts.length > 0
      ? `${headlineParts.join(" · ")} (of ${total})`
      : `Ready to submit (${total} questions)`;

  const bodyLines: string[] = [];
  if (unansweredCount > 0) {
    bodyLines.push(
      "Blank answers grade as wrong — the real CEH penalizes them the same way.",
    );
  }
  if (flaggedCount > 0) {
    bodyLines.push(
      "Flagged questions were ones you marked to revisit. They'll grade with whatever choice (or blank) you left.",
    );
  }
  bodyLines.push("Use the jump-grid below to find them, or submit anyway.");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-submit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-[480px] rounded-2xl border border-amber-500/40 bg-[var(--color-bg)] p-6 md:p-8">
        <p id="confirm-submit-title" className="mono-tag mb-3 text-amber-300">
          Hold on
        </p>
        <h2 className="display text-2xl text-[var(--color-ink)]">{headline}</h2>
        {bodyLines.map((line, i) => (
          <p
            key={i}
            className={i === 0 ? "mt-3 text-sm text-[var(--color-ink-dim)]" : "mt-2 text-sm text-[var(--color-ink-dim)]"}
          >
            {line}
          </p>
        ))}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-ghost text-xs">
            Cancel · keep going
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-amber-200 transition-opacity hover:bg-amber-500/20"
          >
            Submit anyway →
          </button>
        </div>
      </div>
    </div>
  );
};

/** Format seconds as H:MM:SS (or M:SS once under an hour). */
const formatHMS = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
};

