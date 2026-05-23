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
  /** Seconds elapsed since the run started. Drives the timer + the
   *  durationSeconds field on submit. */
  elapsedSeconds: number;
  result: SubmitExamResult | null;
};

type Action =
  | { type: "start" }
  | { type: "answer"; id: string; choice: number }
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

  const total = exam.questions.length;
  const currentQ = exam.questions[state.currentIndex];
  const answered = useMemo(
    () =>
      Object.values(state.answers).filter((v) => v !== null && v !== undefined)
        .length,
    [state.answers],
  );
  const remainingSeconds = Math.max(0, exam.totalSeconds - state.elapsedSeconds);
  const timedOut = remainingSeconds === 0 && state.phase === "running";

  const handleSubmit = async () => {
    dispatch({ type: "submit_pending" });
    const result = await submitExam({
      questionIds: exam.questions.map((q) => q.id),
      choices: state.answers,
      durationSeconds: state.elapsedSeconds,
    });
    dispatch({ type: "submit_done", result });
  };

  // Tick the timer once per second while running.
  useEffect(() => {
    if (state.phase !== "running") return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // Auto-submit when the timer reaches zero.
  useEffect(() => {
    if (timedOut) handleSubmit();
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
        remainingSeconds={remainingSeconds}
      />

      <article className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8">
        <p className="mono-tag mb-4">
          Question {state.currentIndex + 1} · drawn from Day{" "}
          {String(currentQ.day).padStart(2, "0")}
        </p>
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

      <QuestionGrid
        total={total}
        currentIndex={state.currentIndex}
        answers={state.answers}
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
  remainingSeconds,
}: {
  currentIndex: number;
  total: number;
  answered: number;
  remainingSeconds: number;
}) => {
  const pct = Math.round(((currentIndex + 1) / total) * 100);
  const lowTime = remainingSeconds < 600; // last 10 min flag
  return (
    <header className="sticky top-0 z-30 -mx-2 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 px-2 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <p className="mono-tag">
            Q {currentIndex + 1} / {total}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            {answered} answered
          </p>
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
  questionIds,
  onJump,
}: {
  total: number;
  currentIndex: number;
  answers: Record<string, number | null>;
  questionIds: string[];
  onJump: (i: number) => void;
}) => (
  <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
    <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
      Jump to question
    </summary>
    <div className="mt-4 grid grid-cols-10 gap-1.5 md:grid-cols-15">
      {Array.from({ length: total }, (_, i) => {
        const id = questionIds[i]!;
        const isAnswered = answers[id] !== undefined && answers[id] !== null;
        const isCurrent = i === currentIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Jump to question ${i + 1}${isAnswered ? " (answered)" : ""}`}
            className={[
              "aspect-square rounded text-[10px] font-mono transition-colors",
              isCurrent
                ? "border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]"
                : isAnswered
                  ? "border border-[var(--color-accent)]/40 bg-[rgba(190,242,100,0.08)] text-[var(--color-accent)]"
                  : "border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)]",
            ].join(" ")}
          >
            {i + 1}
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
      <p className="mono-tag mb-4">By module</p>
      <div className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
        {result.perDay.map((d) => {
          const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
          const tone =
            pct >= PASS_PCT
              ? "text-[var(--color-accent)]"
              : "text-amber-300";
          return (
            <article
              key={d.day}
              className="bg-[var(--color-bg)] p-5"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="display text-base text-[var(--color-ink)]">
                  Day {String(d.day).padStart(2, "0")} — {d.title}
                </h3>
                <span className={`font-mono text-sm ${tone}`}>{pct}%</span>
              </div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                {d.correct} / {d.total} correct ({d.answered} answered)
              </p>
              <Link
                href={`/course/${d.day}`}
                className="mono-tag mt-3 inline-block hover:text-[var(--color-accent)]"
              >
                Review Day {d.day} →
              </Link>
            </article>
          );
        })}
      </div>
    </section>

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

/** Format seconds as H:MM:SS (or M:SS once under an hour). */
const formatHMS = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
};

