import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getExamRunById } from "@/lib/actions/exam";
import { PASS_PCT } from "@/lib/exam/builder";
import { ReviewFilter } from "./review-filter";

export const metadata: Metadata = {
  title: "Exam attempt review — CEH Prep",
  description:
    "Review a past exam-simulator attempt: per-question walk-through with the correct answer, your choice, and the explanation.",
};

export const dynamic = "force-dynamic";

/**
 * /exam/runs/[id] — past-attempt review.
 *
 * Auth-walled (requireSession). The query helper getExamRunById also
 * enforces owner-only access so a guessed ObjectId can't read another
 * user's attempt. Renders the per-domain readiness summary at the top
 * + a filterable list of every answered question with the user's
 * choice, correct choice, and `why` explanation.
 */
export default async function ExamRunReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const run = await getExamRunById(id);
  if (!run) notFound();

  const wrongCount = run.answers.filter((a) => !a.correct).length;
  const correctCount = run.correctCount;
  const blanks = run.answers.filter((a) => a.userChoice === null).length;

  return (
    <article className="mx-auto max-w-[78ch] space-y-10 px-2 py-4">
      <header className="border-b border-[var(--color-line)] pb-8">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/account/settings"
            className="mono-tag hover:text-[var(--color-accent)]"
          >
            ← Settings
          </Link>
          <Link
            href="/exam"
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            Take another run →
          </Link>
        </nav>
        <p className="mono-tag mb-3">Attempt review</p>
        <h1 className="display text-4xl text-[var(--color-ink)] md:text-5xl">
          {run.scorePct}%{" "}
          <span
            className={
              run.passed
                ? "text-[var(--color-accent)]"
                : "text-amber-300"
            }
          >
            · {run.passed ? "pass" : "below threshold"}
          </span>
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-dim)]">
          {correctCount} correct · {wrongCount} wrong{blanks > 0 ? ` (${blanks} blank)` : ""}{" "}
          of {run.totalQuestions} · pass threshold {PASS_PCT}% ·{" "}
          <span className="font-mono text-[var(--color-ink-faint)]">
            {new Date(run.submittedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        </p>
      </header>

      {run.perDomain.length > 0 && (
        <section>
          <p className="mono-tag mb-3">Readiness by CEH v13 domain</p>
          <div className="space-y-2">
            {run.perDomain.map((d) => {
              const pct =
                d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
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
                  className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
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
                    <span
                      className={`font-mono text-sm tabular-nums ${tone}`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                    <div
                      className={`h-full ${barTone} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                    {d.correct} / {d.total} correct
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <ReviewFilter answers={run.answers} />
    </article>
  );
}
