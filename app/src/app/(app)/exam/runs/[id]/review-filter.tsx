"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ExamRunReviewAnswer } from "@/lib/actions/exam";

type Filter = "wrong" | "all" | "correct";

/**
 * Filterable review walk. Default view is wrong-only — that's the
 * pedagogical default ("study what you missed"). User can flip to
 * the full list or correct-only.
 */
export const ReviewFilter = ({
  answers,
}: {
  answers: readonly ExamRunReviewAnswer[];
}) => {
  const [filter, setFilter] = useState<Filter>("wrong");

  const filtered = useMemo(() => {
    if (filter === "wrong") return answers.filter((a) => !a.correct);
    if (filter === "correct") return answers.filter((a) => a.correct);
    return answers;
  }, [answers, filter]);

  const wrongCount = answers.filter((a) => !a.correct).length;
  const correctCount = answers.filter((a) => a.correct).length;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-3">
        <p className="mono-tag">Per-question review</p>
        <div className="flex flex-wrap items-center gap-1">
          <FilterButton
            active={filter === "wrong"}
            onClick={() => setFilter("wrong")}
          >
            Wrong ({wrongCount})
          </FilterButton>
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All ({answers.length})
          </FilterButton>
          <FilterButton
            active={filter === "correct"}
            onClick={() => setFilter("correct")}
          >
            Correct ({correctCount})
          </FilterButton>
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-dim)]">
          Nothing to show in this filter.
          {filter === "wrong" && wrongCount === 0 && (
            <>
              {" "}
              <span className="text-[var(--color-accent)]">
                Perfect score on this run.
              </span>
            </>
          )}
        </p>
      ) : (
        <ol className="space-y-4">
          {filtered.map((a, idx) => (
            <li
              key={a.id}
              className={[
                "rounded-2xl border bg-[var(--color-surface)] p-5 md:p-6",
                a.correct
                  ? "border-[var(--color-accent)]/30"
                  : a.userChoice === null
                    ? "border-[var(--color-line-strong)]"
                    : "border-red-500/30",
              ].join(" ")}
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                <p className="mono-tag">
                  Q{idx + 1} · Day {String(a.day).padStart(2, "0")}
                </p>
                <span
                  className={[
                    "font-mono text-[10px] uppercase tracking-wider",
                    a.correct
                      ? "text-[var(--color-accent)]"
                      : a.userChoice === null
                        ? "text-[var(--color-ink-faint)]"
                        : "text-red-300",
                  ].join(" ")}
                >
                  {a.correct
                    ? "Correct"
                    : a.userChoice === null
                      ? "Blank"
                      : "Wrong"}
                </span>
              </div>
              <h3 className="display text-base leading-snug text-[var(--color-ink)] md:text-lg">
                {a.q}
              </h3>
              <ul className="mt-4 space-y-2">
                {a.choices.map((choice, i) => {
                  const isCorrect = i === a.correctChoice;
                  const isUser = i === a.userChoice;
                  let cls: string;
                  if (isCorrect && isUser) {
                    cls = "border-[var(--color-accent)] bg-[rgba(190,242,100,0.06)] text-[var(--color-ink)]";
                  } else if (isCorrect) {
                    cls = "border-[var(--color-accent)]/40 bg-[rgba(190,242,100,0.04)] text-[var(--color-ink)]";
                  } else if (isUser) {
                    cls = "border-red-500/40 bg-red-500/5 text-[var(--color-ink-dim)]";
                  } else {
                    cls = "border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-dim)]";
                  }
                  return (
                    <li key={i}>
                      <div
                        className={[
                          "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                          cls,
                        ].join(" ")}
                      >
                        <span className="font-mono text-[var(--color-ink-faint)]">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className="flex-1">{choice}</span>
                        {isCorrect && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                            ✓ correct
                          </span>
                        )}
                        {isUser && !isCorrect && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-red-300">
                            your pick
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {a.why && (
                <div className="mt-4 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-bg)] p-3">
                  <p className="mono-tag mb-1">Why</p>
                  <p className="text-sm text-[var(--color-ink-dim)]">
                    {a.why}
                  </p>
                </div>
              )}
              <Link
                href={`/course/${a.day}`}
                className="mono-tag mt-4 inline-block hover:text-[var(--color-accent)]"
              >
                Review Day {a.day} →
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const FilterButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
      active
        ? "border-[var(--color-accent)] bg-[rgba(190,242,100,0.08)] text-[var(--color-accent)]"
        : "border-[var(--color-line)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]",
    ].join(" ")}
  >
    {children}
  </button>
);
