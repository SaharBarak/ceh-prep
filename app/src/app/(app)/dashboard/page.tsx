import Link from "next/link";
import { getUserProgress } from "@/lib/actions/progress";
import { DAYS } from "@/lib/content";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { resendVerificationEmail } from "@/lib/actions/email";

/**
 * Progressive-enhancement adapter for the resend-verification form.
 *
 * `<form action={fn}>` in React 19 expects `(formData: FormData) => void |
 * Promise<void>`, whereas server actions that want to surface state back
 * to the form use the `(prevState, formData) => Promise<ActionState>`
 * shape. This thin inline server action bridges the two — the banner
 * doesn't need the return value (it's a fire-and-forget "we sent you
 * another email"), so we discard the result and let React 19 call it
 * with only the FormData as the single argument.
 *
 * The inline `"use server"` directive turns this function itself into a
 * server action at build time; Next 15 serializes it across the
 * client/server boundary so the <form> posts back to the server.
 */
async function resendVerificationAction(formData: FormData): Promise<void> {
  "use server";
  await resendVerificationEmail({}, formData);
}

export default async function DashboardPage() {
  const { userId } = await requireSession();
  await connectDB();
  const me = await UserModel.findOne({ _id: { $eq: userId } })
    .select("_id emailVerifiedAt")
    .lean<{ emailVerifiedAt: Date | null } | null>();
  const isUnverified = !me?.emailVerifiedAt;

  const progress = await getUserProgress();
  const progressByDay = new Map(progress.map((p) => [p.day, p]));

  const totalAnswered = progress.reduce((s, p) => s + p.answered, 0);
  const totalCorrect = progress.reduce((s, p) => s + p.correct, 0);
  const totalQuestions = DAYS.reduce((s, d) => s + d.quiz.length, 0);
  const daysCompleted = progress.filter((p) => p.completed).length;
  const overallPct = Math.round((totalAnswered / totalQuestions) * 100);
  const accuracyPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const nextDay = DAYS.find((d) => {
    const p = progressByDay.get(d.n);
    return !p || !p.completed;
  });

  return (
    <>
      {isUnverified ? <UnverifiedBanner /> : null}
      <section className="mb-16 grid grid-cols-1 gap-10 border-b border-[var(--color-line)] pb-14 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="mono-tag">Your sprint</p>
            <Link
              href="/account/settings"
              className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
            >
              Settings →
            </Link>
          </div>
          <h1 className="display text-5xl md:text-7xl">
            {daysCompleted === 14
              ? "You did it."
              : nextDay
                ? `Day ${String(nextDay.n).padStart(2, "0")} awaits.`
                : "Ready when you are."}
          </h1>
          {nextDay && (
            <p className="mt-6 max-w-[50ch] text-[var(--color-ink-dim)]">
              {nextDay.blurb}
            </p>
          )}
          {nextDay && (
            <Link href={`/course/${nextDay.n}`} className="btn-primary mt-8">
              Resume Day {nextDay.n} →
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] md:col-span-5 md:self-end">
          <Stat k={`${overallPct}%`} l="Completed" s={`${totalAnswered} / ${totalQuestions} answered`} />
          <Stat k={`${accuracyPct}%`} l="Accuracy" s={`${totalCorrect} / ${totalAnswered} correct`} />
          <Stat k={`${daysCompleted}`} l="Days done" s="of fourteen" />
          <Stat k={`${14 - daysCompleted}`} l="Remaining" s="days to go" />
        </div>
      </section>

      <section>
        <p className="mono-tag mb-6">All 14 days</p>
        <div className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
          {DAYS.map((d) => {
            const p = progressByDay.get(d.n);
            const answered = p?.answered ?? 0;
            const correct = p?.correct ?? 0;
            const pct = Math.round((answered / d.quiz.length) * 100);
            return (
              <Link
                key={d.n}
                href={`/course/${d.n}`}
                className="group flex items-start gap-5 bg-[var(--color-bg)] p-6 transition-colors hover:bg-[var(--color-surface)] md:p-8"
              >
                <span className="font-mono text-xs text-[var(--color-ink-faint)]">
                  D{String(d.n).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="display text-xl">{d.title}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
                      {p?.completed ? (
                        <span className="text-[var(--color-accent)]">done</span>
                      ) : answered > 0 ? (
                        `${answered}/${d.quiz.length}`
                      ) : (
                        "not started"
                      )}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-dim)]">
                    {d.blurb}
                  </p>
                  <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                    <div
                      className="h-full bg-[var(--color-accent)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {answered > 0 && (
                    <p className="mono-tag mt-2">
                      {correct}/{answered} correct
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

const UnverifiedBanner = () => (
  <section className="mb-10 border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="mono-tag mb-2 text-[var(--color-accent)]">Verify your email</p>
        <p className="max-w-[60ch] text-sm text-[var(--color-ink-dim)]">
          Check your inbox for the verification link. You can still work
          through the free tier (Days 1-3) right now — upgrading to Pro
          requires a verified email.
        </p>
      </div>
      <form action={resendVerificationAction}>
        <button type="submit" className="btn-primary whitespace-nowrap text-xs">
          Resend email →
        </button>
      </form>
    </div>
  </section>
);

const Stat = ({ k, l, s }: { k: string; l: string; s: string }) => (
  <div className="bg-[var(--color-bg)] p-6">
    <div className="display text-4xl md:text-5xl">{k}</div>
    <div className="mono-tag mt-3">{l}</div>
    <div className="mt-1 text-[11px] text-[var(--color-ink-faint)]">{s}</div>
  </div>
);
