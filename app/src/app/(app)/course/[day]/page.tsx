import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getDay, DAYS, isFreeDay } from "@/lib/content";
import { getDayAnswers } from "@/lib/actions/progress";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { canAccessDay, type Tier } from "@/lib/billing/entitlements";
import { CoursePlayer } from "./course-player";

export default async function CourseDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayParam } = await params;
  const n = Number.parseInt(dayParam, 10);
  if (!Number.isFinite(n) || n < 1 || n > 14) notFound();

  // STAB-03: page-level tier gate — single source of truth (canAccessDay).
  // Re-verify session at the page boundary (defense in depth — never trust
  // middleware; CVE-2025-29927 lesson). The parent layout also re-checks,
  // but we re-check here so this file is safe to move or re-parent later.
  const session = await requireSession();

  // Pull the user's tier fresh from Mongo. $eq wrap on the user-supplied _id
  // is mandatory (CVE-2025-23061 — Mongoose $or-nested NoSQLi defense).
  await connectDB();
  let userTier: Tier = "free";
  try {
    const user = await UserModel
      .findOne({ _id: { $eq: session.userId } })
      .select("tier")
      .lean();
    if (user?.tier === "pro") userTier = "pro";
  } catch {
    // On a Mongo blip, fail closed: treat the user as free. Worst case they
    // get redirected to /pricing on a flaky moment; better than leaking
    // gated lesson HTML.
    userTier = "free";
  }

  // CRITICAL: redirect() throws NEXT_REDIRECT — it MUST NOT be inside the
  // try/catch above, or the catch would swallow the redirect signal.
  // (01-RESEARCH.md §"Architecture Pattern 4: Page-Level Server Redirect".)
  if (!canAccessDay(userTier, n)) {
    redirect(`/pricing?from=day-${n}`);
  }

  const day = getDay(n);
  if (!day) notFound();

  const answers = await getDayAnswers(n);
  const prev = n > 1 ? n - 1 : null;
  const next = n < 14 ? n + 1 : null;

  return (
    <>
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/dashboard" className="mono-tag hover:text-[var(--color-accent)]">
          ← Dashboard
        </Link>
        <div className="flex gap-3">
          {prev && (
            <Link href={`/course/${prev}`} className="btn-ghost">
              ← Day {prev}
            </Link>
          )}
          {next && (
            <Link href={`/course/${next}`} className="btn-ghost">
              Day {next} →
            </Link>
          )}
        </div>
      </nav>

      <section className="mb-12 grid grid-cols-1 items-end gap-8 border-b border-[var(--color-line)] pb-10 md:grid-cols-12">
        <div className="md:col-span-8">
          <p className="mono-tag mb-4">
            Day {String(day.n).padStart(2, "0")} · {day.quiz.length} questions · 30 min
            {isFreeDay(day.n) && (
              <span className="ml-3 text-[var(--color-accent)]">· free tier</span>
            )}
          </p>
          <h1 className="display text-[44px] md:text-7xl">{day.title}</h1>
        </div>
        <p className="text-[var(--color-ink-dim)] md:col-span-4 md:pb-3">{day.blurb}</p>
      </section>

      <section className="mb-14">
        <h2 className="display mb-6 flex items-center gap-4 text-2xl">
          <span className="h-px w-6 bg-[var(--color-accent)]" />
          Lesson
        </h2>
        <div
          className="prose-lesson max-w-[68ch] text-[15px] leading-relaxed text-[var(--color-ink-dim)]"
          dangerouslySetInnerHTML={{ __html: day.lesson }}
        />
      </section>

      <section className="mb-14 grid grid-cols-1 gap-3 md:grid-cols-3 md:grid-rows-[auto_auto]">
        {day.concepts.map((c, i) => (
          <article
            key={c.h}
            className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 ${
              i === 0 ? "md:col-span-2 md:row-span-2" : ""
            }`}
          >
            <p className="mono-tag mb-3">{c.tag}</p>
            <h3 className={`display ${i === 0 ? "text-3xl" : "text-xl"}`}>{c.h}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-dim)]">{c.b}</p>
          </article>
        ))}
      </section>

      <section className="mb-14 rounded-2xl border border-dashed border-[var(--color-line-strong)] bg-gradient-to-br from-[rgba(190,242,100,0.04)] to-transparent p-8 md:p-10">
        <p className="mono-tag mb-3 text-[var(--color-accent)]">Lab · hands on</p>
        <h3 className="display mb-3 text-2xl">{day.exercise.title}</h3>
        <p className="mb-4 max-w-[60ch] text-sm leading-relaxed text-[var(--color-ink-dim)]">
          {day.exercise.body}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[rgba(0,0,0,0.4)] p-4 font-mono text-[12px] text-[var(--color-accent)]">
          {day.exercise.cmd}
        </pre>
      </section>

      <CoursePlayer day={day} initialAnswers={answers} />

      <footer className="mt-20 flex items-center justify-between border-t border-[var(--color-line)] pt-8">
        <Link href="/dashboard" className="mono-tag hover:text-[var(--color-accent)]">
          ← Dashboard
        </Link>
        {next && (
          <Link href={`/course/${next}`} className="btn-primary">
            Day {next} →
          </Link>
        )}
      </footer>

      {/* stable anchor for prev/next pagination memory */}
      <span className="sr-only">{DAYS.length}</span>
    </>
  );
}

// Removed: generateStaticParams — the route is session-gated (STAB-03), so it
// must be fully dynamic per-user. Static generation at build time cannot run
// the tier check and would bake the gated HTML into the prerender output.
