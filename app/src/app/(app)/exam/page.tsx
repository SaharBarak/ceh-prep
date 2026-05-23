import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { canAccessExam, type Tier } from "@/lib/billing/entitlements";
import { buildExam, stripAnswerKey } from "@/lib/exam/builder";
import { ExamRunner } from "./exam-runner";

export const metadata: Metadata = {
  title: "Exam simulator — CEH Prep",
  description:
    "Timed exam-format practice — full-bank, 4-hour ceiling, 70% pass threshold mirrors the real CEH v13 exam.",
};

export const dynamic = "force-dynamic";

/**
 * /exam — Pro-gated timed practice simulator.
 *
 * Server-builds the exam (so the answer key never leaves the server),
 * then renders the client runner with the stripped exam shape. On
 * submit, the runner POSTs the user's choices back through the
 * `submitExam` server action, which re-derives correctness from DAYS
 * and persists an `ExamRun`.
 *
 * Free-tier users get redirected to /pricing. This is the only place
 * canAccessExam() is invoked at the page boundary; the action layer
 * re-checks defensively.
 */
export default async function ExamPage() {
  const { userId } = await requireSession();
  await connectDB();

  const user = await UserModel.findOne({ _id: { $eq: userId } })
    .select("tier")
    .lean<{ tier?: string } | null>();
  const tier: Tier = user?.tier === "pro" ? "pro" : "free";

  if (!canAccessExam(tier)) {
    redirect("/pricing?from=exam");
  }

  const exam = buildExam();
  const clientExam = stripAnswerKey(exam);

  return (
    <article className="mx-auto max-w-[78ch] space-y-8 px-2 py-4">
      <header className="border-b border-[var(--color-line)] pb-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/course/14"
            className="mono-tag hover:text-[var(--color-accent)]"
          >
            ← Day 14
          </Link>
          <Link
            href="/dashboard"
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            Dashboard →
          </Link>
        </nav>
        <p className="mono-tag mb-3">Exam simulator</p>
        <h1 className="display text-4xl text-[var(--color-ink)] md:text-5xl">
          {clientExam.questions.length} questions ·{" "}
          {Math.round(clientExam.totalSeconds / 60)} min ceiling
        </h1>
        <p className="mt-4 max-w-[60ch] text-sm text-[var(--color-ink-dim)]">
          Mirrors the real CEH v13 exam format: timed, full-bank
          randomized, 70% pass threshold. The timer starts when you click
          Start. Refreshing mid-run loses progress — finish in one sitting.
        </p>
      </header>

      <ExamRunner exam={clientExam} />
    </article>
  );
}
