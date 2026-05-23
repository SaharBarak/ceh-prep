import type { Metadata } from "next";
import Link from "next/link";
import { GithubLogo, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { DAYS } from "@/lib/content";
import { getBonusItems } from "@/lib/content/bonus";

export const metadata: Metadata = {
  title: "About — CEH Prep",
  description:
    "Who builds CEH Prep, why it exists, and what's under the hood.",
};

/**
 * /about — the answer to Sarah/Alex/Dave's persistent "no named human"
 * friction across all three QA simulation runs. Solo founder bio, why
 * the product exists, what's under the hood, and a stack receipt.
 */
export default function AboutPage() {
  const totalDays = DAYS.length;
  const totalQuestions = DAYS.reduce((s, d) => s + d.quiz.length, 0);
  const totalDrills = DAYS.filter((d) => d.exercise.drillSlug).length;
  const totalBonus = getBonusItems().length;

  return (
    <article className="mx-auto max-w-[68ch] space-y-16 text-[var(--color-ink-dim)]">
      <header className="border-b border-[var(--color-line)] pb-12">
        <p className="mono-tag mb-4">About</p>
        <h1 className="display text-4xl leading-[1.05] md:text-6xl">
          One engineer, fourteen days,
          <br />
          <em className="not-italic text-[var(--color-accent)]">
            no course-ware
          </em>
          .
        </h1>
        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed">
          CEH Prep is built and run by{" "}
          <a
            href="https://github.com/SaharBarak"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          >
            Sahar Barak
          </a>{" "}
          — solo. No marketing team writing the copy, no SEO contractor
          stuffing keywords, no AI generating the curriculum. The line about
          using <code className="font-mono text-[var(--color-accent)]">nmap</code>{" "}
          and{" "}
          <code className="font-mono text-[var(--color-accent)]">sqlmap</code>{" "}
          is literal: every drill ships with commands run on the same WebVM
          you&apos;ll be running them on.
        </p>
      </header>

      <Section heading="Why this exists">
        <p>
          The CEH study market is two things, mostly: 1,800-page official
          courseware that reads like an airline-safety pamphlet, or YouTube
          playlists where someone reads the courseware back to you at 1.25×.
          Both work. Neither respects your time.
        </p>
        <p>
          The wager here: a 14-day sprint with a real browser shell, drills
          you can actually grade, and quiz answers that explain themselves
          beats 60 hours of slide narration. If the simulator doesn&apos;t
          put you within 70&nbsp;% of the CEH v13 pass mark after a full run,
          we refund the month. That&apos;s the only honest way to write that
          claim — pin it to a number you can measure.
        </p>
      </Section>

      <Section heading="What's actually in here">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-4">
          <Stat k={totalDays} l="days of v13" />
          <Stat k={totalQuestions} l="quiz qs · explained" />
          <Stat k={totalBonus} l="bonus articles" />
          <Stat k={totalDrills} l="graded lab drills" />
        </div>
        <p className="mt-6">
          Every number above traces to a file in the repo — the curriculum is
          in{" "}
          <code className="font-mono text-[var(--color-accent)]">
            app/src/lib/content/days.ts
          </code>
          , the bonus library is markdown under{" "}
          <code className="font-mono text-[var(--color-accent)]">
            docs/content/
          </code>
          , and the drills live as their own image in{" "}
          <a
            href="https://github.com/SaharBarak/ceh-webvm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          >
            SaharBarak/ceh-webvm
          </a>
          . If something on the marketing page doesn&apos;t match what
          you&apos;re seeing inside, that&apos;s a bug — email and we&apos;ll
          fix it.
        </p>
      </Section>

      <Section heading="What this is not">
        <p>
          Being clear about scope is part of the deal. CEH Prep is{" "}
          <strong className="text-[var(--color-ink)]">
            CEH v13 certification prep
          </strong>{" "}
          — exam vocabulary, concept reinforcement, ~7 hours of focused
          lessons, a timed simulator at the end. That&apos;s the product.
        </p>
        <p>
          It is{" "}
          <strong className="text-[var(--color-ink)]">not</strong> an OSCP
          replacement, not a PNPT or PEN-200 prep track, not a red-team
          bootcamp. There&apos;s no live exploitation, no Active Directory
          attack chain, no Cobalt Strike / Sliver / Mythic C2 content. The
          WebVM lab gives you real{" "}
          <code className="font-mono text-[var(--color-accent)]">nmap</code>{" "}
          and{" "}
          <code className="font-mono text-[var(--color-accent)]">sqlmap</code>{" "}
          for flag-fluency drills, not vulnerable services to break into.
        </p>
        <p>
          After CEH, the natural next stops are TCM&apos;s PNPT (AD-heavy,
          ~$300 with a real engagement-style exam), HackTheBox Academy
          (CRTP / Bug Bounty Hunter paths), or OffSec PEN-200 if a hiring
          manager specifically requires OSCP. CEH Prep gets you through the
          first gate; those are the next ones.
        </p>
      </Section>

      <Section heading="What's under the hood">
        <p>
          Next.js 15 (App Router, RSC) on Vercel. MongoDB Atlas for the data
          layer. Resend for transactional + drip + winback email. Paddle as
          merchant-of-record for billing. WebVM (forked from{" "}
          <a
            href="https://github.com/leaningtech/webvm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          >
            leaningtech/webvm
          </a>
          ) for the in-browser Debian shell — a 900 MB i386 image with the
          standard offensive toolchain pre-loaded.
        </p>
        <p>
          The whole thing runs nightly through a Claude-driven QA harness
          that simulates five distinct ICP personas walking the full public
          funnel and flags conversion friction. The reports land under{" "}
          <code className="font-mono text-[var(--color-accent)]">
            .planning/qa-reports/
          </code>{" "}
          in the repo — public, dated, advisory.
        </p>
      </Section>

      <Section heading="Who I am">
        <p>
          Engineer, ex-multiple-startups, spent enough years writing backend
          code to know what a real lab feels like vs. a screenshot wrapped in
          marketing. I built CEH Prep because I wanted the product I
          couldn&apos;t find when I was getting back into security. It
          doesn&apos;t scale infinitely — it&apos;s one engineer running a
          14-day sprint, and that&apos;s the point. When you email{" "}
          <a
            href="mailto:hello@cehprep.local"
            className="text-[var(--color-accent)] underline"
          >
            hello@cehprep.local
          </a>{" "}
          you get me, not a triage queue.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-10">
        <Link href="/signup" className="btn-primary">
          Start the sprint — 3 days free
          <ArrowUpRight size={16} weight="bold" />
        </Link>
        <a
          href="https://github.com/SaharBarak"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
        >
          <GithubLogo size={14} weight="bold" />
          @SaharBarak on GitHub
        </a>
      </div>
    </article>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <h2 className="display text-2xl text-[var(--color-ink)] md:text-3xl">
        {heading}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Stat({ k, l }: { k: number; l: string }) {
  return (
    <div className="bg-[var(--color-surface)] p-5">
      <p className="display text-3xl text-[var(--color-ink)]">{k}</p>
      <p className="mt-1 font-mono text-[10px] uppercase leading-tight tracking-wider text-[var(--color-ink-dim)]">
        {l}
      </p>
    </div>
  );
}
