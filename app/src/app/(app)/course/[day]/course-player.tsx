"use client";

import { useState, useTransition } from "react";
import { saveAnswer } from "@/lib/actions/progress";
import type { Day, QuizQuestion } from "@/lib/content";

type Props = {
  day: Day;
  initialAnswers: Record<number, number>;
};

type Status = "idle" | "saving" | "saved" | "error";

export function CoursePlayer({ day, initialAnswers }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>(initialAnswers);
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [, startTransition] = useTransition();

  const correctSoFar = day.quiz.reduce((acc, q, i) => (answers[i] === q.c ? acc + 1 : acc), 0);
  const answeredCount = Object.keys(answers).length;
  const total = day.quiz.length;

  const handleSelect = (questionIndex: number, choice: number) => {
    // Optimistic — flip immediately, then reconcile on server response.
    setAnswers((prev) => ({ ...prev, [questionIndex]: choice }));
    setStatus((prev) => ({ ...prev, [questionIndex]: "saving" }));

    startTransition(async () => {
      const res = await saveAnswer({ day: day.n, questionIndex, choice });
      setStatus((prev) => ({
        ...prev,
        [questionIndex]: res.ok ? "saved" : "error",
      }));
    });
  };

  return (
    <section className="mb-14" id="quiz">
      <header className="mb-6 flex items-end justify-between">
        <h2 className="display flex items-center gap-4 text-2xl">
          <span className="h-px w-6 bg-[var(--color-accent)]" />
          Quiz · {total} questions
        </h2>
        <p className="mono-tag">
          {answeredCount} / {total} answered · {correctSoFar} correct
        </p>
      </header>

      <ol className="space-y-8">
        {day.quiz.map((q, i) => (
          <QuestionCard
            key={`${day.n}-${i}`}
            index={i}
            question={q}
            selected={answers[i]}
            status={status[i] ?? "idle"}
            onSelect={(choice) => handleSelect(i, choice)}
          />
        ))}
      </ol>
    </section>
  );
}

type QuestionCardProps = {
  index: number;
  question: QuizQuestion;
  selected: number | undefined;
  status: Status;
  onSelect: (choice: number) => void;
};

function QuestionCard({ index, question, selected, status, onSelect }: QuestionCardProps) {
  const isAnswered = typeof selected === "number";
  const isCorrect = isAnswered && selected === question.c;

  return (
    <li
      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8"
      aria-labelledby={`q-${index}-prompt`}
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="mono-tag mt-1 shrink-0">Q{String(index + 1).padStart(2, "0")}</span>
        <p id={`q-${index}-prompt`} className="text-base leading-relaxed md:text-lg">
          {question.q}
        </p>
      </header>

      <div className="space-y-2">
        {question.choices.map((choice, c) => {
          const chosen = selected === c;
          const showAsCorrect = isAnswered && c === question.c;
          const showAsWrong = chosen && !isCorrect;

          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              aria-pressed={chosen}
              className={[
                "block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
                showAsCorrect
                  ? "border-[var(--color-accent)] bg-[rgba(190,242,100,0.08)]"
                  : showAsWrong
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]",
              ].join(" ")}
            >
              <span className="mr-3 font-mono text-xs text-[var(--color-ink-faint)]">
                {String.fromCharCode(65 + c)}
              </span>
              {choice}
            </button>
          );
        })}
      </div>

      {isAnswered && question.why && (
        <p className="mt-4 border-l-2 border-[var(--color-line-strong)] pl-4 text-sm leading-relaxed text-[var(--color-ink-dim)]">
          <span className="mono-tag mr-2">
            {isCorrect ? "✓ Why" : "✗ Why"}
          </span>
          {question.why}
        </p>
      )}

      <footer className="mt-4 text-xs text-[var(--color-ink-faint)]">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && "Failed to save — try again"}
      </footer>
    </li>
  );
}
