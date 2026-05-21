import Link from "next/link";
import {
  ArrowUpRight,
  Terminal,
  GithubLogo,
  Lightning,
  ShieldCheck,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import { DAYS } from "@/lib/content";
import { getBonusItems, type BonusItem } from "@/lib/content/bonus";
import { TrackClick } from "@/components/track";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  Reveal,
  StatGrid,
  TerminalTypewriter,
  BreathingDot,
  BreathingIcon,
  ScrollProgress,
  StaggerGrid,
  StaggerList,
  StaggerItem,
} from "./page.client";

/**
 * Landing page — sells on real, verifiable artifacts.
 *
 * Hierarchy (top-to-bottom, asymmetric):
 *   1. Hero (8/4) — claim left, receipts panel right
 *   2. Three-anchor strip — the three sell-points distilled (real lab / curated repos / day-mapped quiz)
 *   3. WebVM "real terminal" section — mock prompt, drill list, peek-the-terminal CTA
 *   4. Sample bonus cards — three highest-signal items
 *   5. Curriculum scrubber — 14 days as a compact horizontal grid
 *   6. Closing CTA + footer
 *
 * Every number on this page traces to a real artifact:
 *   - 14 days        ← DAYS.length
 *   - N quiz qs      ← DAYS.reduce(...quiz.length)
 *   - 4 drills       ← DAYS.filter(d => d.exercise.drillSlug)
 *   - 16 bonus md    ← getBonusItems().length
 *   - repo count     ← regex over BonusItem.raw
 */
export default function LandingPage() {
  const bonus = getBonusItems();
  const totalDays = DAYS.length;
  const totalQuestions = DAYS.reduce((s, d) => s + d.quiz.length, 0);
  const drillDays = DAYS.filter((d) => d.exercise.drillSlug);
  const totalDrills = drillDays.length;
  const totalRepos = bonus.filter((b) =>
    /github\.com\/[\w.-]+\/[\w.-]+/.test(b.raw),
  ).length;
  const previews = pickPreviews(bonus);

  return (
    <>
      <ScrollProgress />

      {/* ──────────────────────────────────────────────────────────────
          1. Hero — asymmetric 8/4 split. Headline + value left, receipts
          panel right. CTAs above-the-fold.
         ────────────────────────────────────────────────────────────── */}
      <section className="mb-28 grid grid-cols-1 items-end gap-12 border-b border-[var(--color-line)] pb-20 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-8">
          <p className="mono-tag mb-6 flex items-center gap-2">
            <BreathingDot />
            CEH v13 · 14-day sprint · 3 days free
          </p>
          <h1 className="display text-[44px] leading-[1.02] md:text-[96px]">
            Pass the CEH
            <br />
            without the{" "}
            <em className="not-italic text-[var(--color-accent)]">course-ware</em>{" "}
            slog.
          </h1>
          <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--color-ink-dim)]">
            Fourteen days. <strong className="font-semibold text-[var(--color-ink)]">CEH v13</strong>,
            module-for-module. A graded Debian shell in a browser tab — real{" "}
            <code className="font-mono text-[var(--color-accent)]">nmap</code>,{" "}
            <code className="font-mono text-[var(--color-accent)]">sqlmap</code>,{" "}
            <code className="font-mono text-[var(--color-accent)]">hashcat</code>, not
            screenshots. A ~30-minute lesson and{" "}
            <strong className="font-semibold text-[var(--color-ink)]">
              {Math.round(totalQuestions / totalDays)}
            </strong>{" "}
            explained quiz questions per day. Not a slide deck.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <TrackClick event="cta_click" params={{ location: "hero", target: "signup" }}>
              <Link href="/signup" className="btn-primary">
                Start free — 3 days
                <ArrowUpRight size={16} weight="bold" />
              </Link>
            </TrackClick>
            <TrackClick event="cta_click" params={{ location: "hero", target: "pricing" }}>
              <Link href="/pricing" className="btn-ghost">
                $30/mo · see pricing
              </Link>
            </TrackClick>
            <TrackClick event="lab_peek" params={{ location: "hero" }}>
              <a
                href="https://saharbarak.github.io/ceh-webvm/"
                target="_blank"
                rel="noopener noreferrer"
                className="mono-tag flex items-center gap-1.5 hover:text-[var(--color-accent)]"
              >
                <Terminal size={12} weight="bold" />
                peek the terminal
              </a>
            </TrackClick>
          </div>
          <p className="mt-4 font-mono text-[12px] leading-relaxed text-[var(--color-ink-dim)]">
            <strong className="font-semibold text-[var(--color-accent)]">no card to start</strong>
            <span className="mx-2 text-[var(--color-line-strong)]">·</span>
            cancel anytime
            <span className="mx-2 text-[var(--color-line-strong)]">·</span>
            hit 70&nbsp;% on the Day-14 sim or we refund the month
          </p>
        </div>

        {/* Receipts panel — concrete counts, all traceable to repo */}
        <aside className="md:col-span-4">
          <p className="mono-tag mb-3 text-right">The build</p>
          <StatGrid
            items={[
              { k: totalDays, l: "days of v13" },
              { k: totalQuestions, l: "quiz qs · all explained" },
              { k: bonus.length, l: "bonus articles" },
              { k: totalDrills, l: "graded lab drills" },
            ]}
          />
          <p className="mt-3 text-right font-mono text-[10px] leading-relaxed text-[var(--color-ink-faint)]">
            {totalRepos} GitHub repos surfaced ·{" "}
            <Link href="/bonus" className="hover:text-[var(--color-ink-dim)]">
              browse →
            </Link>
          </p>
        </aside>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          2. Three-anchor strip — what makes this different.
         ────────────────────────────────────────────────────────────── */}
      <section className="mb-28">
        <Reveal>
          <p className="mono-tag mb-5">The shape of it</p>
          <h2 className="display mb-12 max-w-[24ch] text-3xl md:text-5xl">
            What a video course can&apos;t do.
            <br />
            <em className="not-italic text-[var(--color-accent)]">This does.</em>
          </h2>
        </Reveal>

        <StaggerGrid className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-3">
          <Anchor
            n="01"
            icon={<Terminal size={22} weight="duotone" />}
            kicker="REAL LAB"
            title="A graded Debian shell in your tab."
            body={`A custom WebVM image with nmap, sqlmap, hydra, john, gobuster, gdb pre-loaded, plus ${totalDrills} graded drills with a local ./check command. No VirtualBox, no Kali ISO, no setup.`}
          />
          <Anchor
            n="02"
            icon={<GithubLogo size={22} weight="duotone" />}
            kicker="REAL TOOLS"
            title={`${totalRepos} curated repos, not screenshots.`}
            body="HexStrike-AI MCP, SQLMap workflows, SigDigger SDR, GhostTrack OSINT, hackingtool launcher — each bonus article links the upstream GitHub project so you can clone it the same night."
          />
          <Anchor
            n="03"
            icon={<ListChecks size={22} weight="duotone" />}
            kicker="REAL EXAM PREP"
            title={`${totalQuestions} questions, every one explained.`}
            body="Every quiz answer ships with a `why` field — not just A/B/C/D. Day 14 runs a domain-weighted 125-question simulator that mirrors the real CEH v13 exam pacing."
          />
        </StaggerGrid>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          3. The terminal — sells the WebVM with a fake-prompt block.
         ────────────────────────────────────────────────────────────── */}
      <section id="lab" className="mb-28 scroll-mt-24 grid grid-cols-1 items-start gap-10 md:grid-cols-12">
        <div id="lab-copy" className="md:col-span-5">
          <p className="mono-tag mb-4 text-[var(--color-accent)]">
            The lab · {totalDrills} graded drills
          </p>
          <h2 className="display text-3xl leading-tight md:text-5xl">
            It opens.
            <br />
            You type.
            <br />
            It grades you.
          </h2>
          <p className="mt-6 max-w-[44ch] text-[var(--color-ink-dim)]">
            The Pro tier ships a forked{" "}
            <a
              href="https://github.com/leaningtech/webvm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
            >
              leaningtech/webvm
            </a>{" "}
            with a 900&nbsp;MB Debian/i386 image, a{" "}
            <code className="font-mono text-[var(--color-accent)]">drill</code>{" "}
            CLI, and 4 graded challenges (day 01, 03, 10, 13). Your host
            machine stays untouched — it&apos;s all WebAssembly client-side.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackClick event="cta_click" params={{ location: "lab_section", target: "signup" }}>
              <Link href="/signup" className="btn-primary">
                Start free
                <ArrowUpRight size={16} weight="bold" />
              </Link>
            </TrackClick>
            <TrackClick event="lab_peek" params={{ location: "lab_section" }}>
              <a
                href="https://saharbarak.github.io/ceh-webvm/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                <Terminal size={14} weight="bold" />
                Open the live terminal
              </a>
            </TrackClick>
          </div>
        </div>

        {/* Mock terminal panel — purely visual, not interactive */}
        <div className="md:col-span-7">
          <div className="overflow-hidden rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] shadow-2xl shadow-black/40">
            {/* title bar */}
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line-strong)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line-strong)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line-strong)]" />
              <span className="mono-tag ml-3 normal-case tracking-normal">
                ceh-webvm · day10-sqli/01-payload-anatomy
              </span>
            </div>

            {/* body — typewriter on first viewport intersect, then static */}
            <TerminalTypewriter
              lines={[
                {
                  chunks: [
                    { kind: "dim", text: "user@webvm:~$ " },
                    { kind: "out", text: "drill start day10 01" },
                  ],
                },
                {
                  chunks: [
                    { kind: "dim", text: "loaded" },
                    { kind: "out", text: " 6 SQLi payload-construction prompts → ./questions.txt" },
                  ],
                },
                {
                  chunks: [
                    { kind: "dim", text: "user@webvm:~$ " },
                    { kind: "out", text: "vim answers.txt" },
                  ],
                },
                {
                  chunks: [
                    { kind: "dim", text: "user@webvm:~$ " },
                    { kind: "out", text: "drill check" },
                  ],
                },
                {
                  chunks: [
                    { kind: "accent", text: "✓ 5/6 correct" },
                    { kind: "out", text: " · q3 expected `' OR 1=1 --`" },
                  ],
                },
                {
                  chunks: [
                    { kind: "dim", text: "user@webvm:~$ " },
                    { kind: "out", text: "sqlmap -u \"http://lab/item?id=1\" --dump -C email,password" },
                  ],
                },
              ]}
            />
          </div>

          {/* drill list — tiny chips, real data; lightning icons breathe
              out of sync (phase offset per chip) per taste-skill §9 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {drillDays.map((d, i) => (
              <span
                key={d.n}
                className="mono-tag flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 normal-case tracking-normal text-[var(--color-ink-dim)]"
              >
                <BreathingIcon phase={i * 0.42} className="text-[var(--color-accent)]">
                  <Lightning size={11} weight="fill" />
                </BreathingIcon>
                Day {String(d.n).padStart(2, "0")} ·{" "}
                <span className="text-[var(--color-ink-faint)]">
                  {d.exercise.drillSlug?.split("/").pop()}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          4. Sample bonus cards — three highest-signal items.
         ────────────────────────────────────────────────────────────── */}
      <section className="mb-28">
        <Reveal>
          <header className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="mono-tag mb-3">The library</p>
              <h2 className="display text-3xl md:text-5xl">
                Writeups, tool deep-dives,
                <br />
                bonus repos.
              </h2>
              <p className="mt-4 max-w-[52ch] text-sm text-[var(--color-ink-dim)]">
                Practitioner writeups linked to real GitHub projects. The
                advanced track for anyone who clears the sprint and wants to
                keep going.
              </p>
            </div>
            <Link href="/bonus" className="btn-ghost shrink-0">
              All {bonus.length} →
            </Link>
          </header>
        </Reveal>

        <StaggerGrid className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-3">
          {previews.map((item, idx) => (
            <StaggerItem
              as="article"
              key={item.slug}
              className="card-lift group relative flex flex-col gap-4 bg-[var(--color-bg)] p-7 hover:bg-[var(--color-surface)] md:p-8"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-[var(--color-ink-faint)]">
                  {String(item.n).padStart(2, "0")} /{" "}
                  {String(bonus.length).padStart(2, "0")}
                </span>
                {item.primaryDay != null && (
                  <span className="mono-tag">
                    Day {String(item.primaryDay).padStart(2, "0")}
                  </span>
                )}
                {hasRepo(item) && (
                  <span className="mono-tag flex items-center gap-1 text-[var(--color-accent)]">
                    <GithubLogo size={11} weight="bold" />
                    repo
                  </span>
                )}
              </div>
              <h3 className="display text-2xl leading-tight">{item.title}</h3>
              <p className="line-clamp-4 text-sm leading-relaxed text-[var(--color-ink-dim)]">
                {item.teaser}
              </p>
              <Link
                href={`/bonus/${item.slug}`}
                className="mono-tag mt-auto flex items-center gap-1 text-[var(--color-accent)] hover:underline"
              >
                Read article {String(idx + 1).padStart(2, "0")} →
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          5. Curriculum scrubber — all 14 days, compact.
         ────────────────────────────────────────────────────────────── */}
      <section id="curriculum" className="mb-28 scroll-mt-24">
        <Reveal>
          <header className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="mono-tag mb-3">The plan</p>
              <h2 className="display text-3xl md:text-5xl">
                Recon → exploit → exam.
              </h2>
            </div>
            <span className="mono-tag hidden md:inline">
              ~30 min/day · self-paced
            </span>
          </header>
        </Reveal>

        <StaggerList className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-7">
          {DAYS.map((d, i) => (
            <StaggerItem
              as="li"
              key={d.n}
              className="group flex flex-col gap-2 bg-[var(--color-bg)] p-5 transition-colors hover:bg-[var(--color-surface)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[var(--color-ink-faint)]">
                  Day {String(d.n).padStart(2, "0")}
                </span>
                {d.exercise.drillSlug && (
                  <BreathingIcon phase={(i % 5) * 0.36} className="text-[var(--color-accent)]">
                    <Lightning
                      size={12}
                      weight="fill"
                      aria-label="has graded drill"
                    />
                  </BreathingIcon>
                )}
              </div>
              <p className="text-sm leading-snug text-[var(--color-ink)]">
                {d.title}
              </p>
              <p className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                {d.quiz.length} qs
              </p>
            </StaggerItem>
          ))}
        </StaggerList>

      </section>

      {/* ──────────────────────────────────────────────────────────────
          6. Closing CTA + footer.
         ────────────────────────────────────────────────────────────── */}
      <section className="cta-glow mb-20 grid grid-cols-1 items-center gap-10 rounded-2xl border border-dashed border-[var(--color-line-strong)] p-10 md:grid-cols-12 md:p-14">
        <div className="md:col-span-8">
          <p className="mono-tag mb-4 text-[var(--color-accent)]">
            Three days free. No card to start.
          </p>
          <h2 className="display text-3xl leading-tight md:text-5xl">
            Day 01 is{" "}
            <em className="not-italic text-[var(--color-accent)]">grep the flag</em>
            .<br />
            Open the tab and start.
          </h2>
          <p className="mt-5 max-w-[60ch] text-[var(--color-ink-dim)]">
            Pro is $30/mo. Cancel anytime. If you don&apos;t score at least{" "}
            <strong className="font-semibold text-[var(--color-ink)]">
              70&nbsp;%
            </strong>{" "}
            on the Day-14 simulator after running the full 14-day sprint, email
            us and we&apos;ll refund the month. 70&nbsp;% is the CEH v13 pass
            threshold for the most common exam form — clearing it on our
            simulator is the strongest predictor of clearing it for real.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:col-span-4 md:items-end">
          <TrackClick event="cta_click" params={{ location: "closing", target: "signup" }}>
            <Link href="/signup" className="btn-primary w-full justify-center md:w-auto">
              Start free
              <ArrowUpRight size={16} weight="bold" />
            </Link>
          </TrackClick>
          <TrackClick event="cta_click" params={{ location: "closing", target: "pricing" }}>
            <Link href="/pricing" className="btn-ghost w-full justify-center md:w-auto">
              <ShieldCheck size={14} weight="bold" />
              See pricing
            </Link>
          </TrackClick>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)] pt-10 text-xs text-[var(--color-ink-faint)]">
        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-end">
          <div>
            <p className="mono-tag mb-2">The newsletter</p>
            <p className="text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
              Roughly weekly. Practitioner writeups, new bonus repos, what
              shipped. No drip, no upsell — drop your address if you want it.
            </p>
          </div>
          <NewsletterForm source="footer" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] pt-8">
          <span>© CEH Prep · 14-day sprint · CEH v13 aligned · not affiliated with EC-Council</span>
          <div className="flex gap-5">
            <Link href="/bonus" className="hover:text-[var(--color-ink-dim)]">
              Bonus
            </Link>
            <Link href="/pricing" className="hover:text-[var(--color-ink-dim)]">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-[var(--color-ink-dim)]">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-[var(--color-ink-dim)]">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-6 text-[12px] leading-relaxed text-[var(--color-ink-faint)]">
          <span>Built by</span>
          <a
            href="https://github.com/SaharBarak"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-ink-dim)] hover:text-[var(--color-accent)]"
          >
            Sahar Barak
          </a>
          <span className="text-[var(--color-line-strong)]">·</span>
          <span>
            lab fork:{" "}
            <a
              href="https://github.com/SaharBarak/ceh-webvm"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[var(--color-ink-dim)] hover:text-[var(--color-accent)]"
            >
              SaharBarak/ceh-webvm
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}

// ───────────────────────────── helpers ─────────────────────────────

function Anchor({
  n,
  icon,
  kicker,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <StaggerItem
      as="article"
      className="card-lift flex flex-col gap-4 bg-[var(--color-bg)] p-7 hover:bg-[var(--color-surface)] md:p-8"
    >
      <div className="flex items-center justify-between text-[var(--color-ink-faint)]">
        <span className="font-mono text-xs">{n}</span>
        <span className="text-[var(--color-accent)]">{icon}</span>
      </div>
      <p className="mono-tag text-[var(--color-accent)]">{kicker}</p>
      <h3 className="display text-2xl leading-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--color-ink-dim)]">
        {body}
      </p>
    </StaggerItem>
  );
}

const hasRepo = (item: BonusItem): boolean =>
  /github\.com\/[\w.-]+\/[\w.-]+/.test(item.raw);

/**
 * Pick 3 preview cards optimized for Pro conversion.
 *
 * Strategy: prefer items that (a) link a real GitHub repo (concrete proof),
 * (b) map to a curriculum day (relevance), and (c) come from the "tool-heavy"
 * cluster — SQLMap, HexStrike-AI, WebVM, hackingtool, SigDigger, GhostTrack.
 *
 * We hand-rank a small allowlist of slug substrings first and fall back to
 * the repo-bearing items if the allowlist isn't matched. Guarded against
 * `noUncheckedIndexedAccess` — explicit length check before slicing.
 */
function pickPreviews(items: readonly BonusItem[]): BonusItem[] {
  const PREFERRED = [
    "sqlmap",
    "hexstrike",
    "webvm",
    "hackingtool",
    "sigdigger",
    "ghosttrack",
    "osint-search",
  ];

  const score = (it: BonusItem): number => {
    const slug = it.slug.toLowerCase();
    const idx = PREFERRED.findIndex((p) => slug.includes(p));
    const preferenceBoost = idx === -1 ? 100 : idx; // lower = better
    const repoBoost = hasRepo(it) ? 0 : 50;
    return preferenceBoost + repoBoost;
  };

  const ranked = [...items].sort((a, b) => score(a) - score(b));
  return ranked.slice(0, 3);
}
