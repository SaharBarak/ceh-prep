"use client";

/**
 * Client-side motion primitives for the home page.
 *
 * Calibrated to taste-skill MOTION_INTENSITY 6 — fluid, perpetual,
 * never noisy. Every continuous loop is opacity- or transform-only
 * (hardware-accelerated per §5). All perpetual-motion components are
 * memoized and isolated per the skill's PERFORMANCE CRITICAL clause
 * (any infinite loop must be its own micro client component).
 *
 * Respects `prefers-reduced-motion` — see globals.css media query.
 */

import {
  motion,
  useInView,
  useMotionTemplate,
  useScroll,
  useSpring,
  type Variants,
} from "framer-motion";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ── existing primitives (unchanged) ─────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

const ticker: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const tickerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function StatGrid({
  items,
}: {
  items: ReadonlyArray<{ k: number | string; l: string }>;
}) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)]"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={ticker}
    >
      {items.map((it) => (
        <motion.div
          key={it.l}
          variants={tickerItem}
          className="bg-[var(--color-surface)] p-5"
        >
          <p className="display text-3xl text-[var(--color-ink)]">{it.k}</p>
          <p className="mt-1 font-mono text-[10px] uppercase leading-tight tracking-wider text-[var(--color-ink-dim)]">
            {it.l}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * A pretend terminal cursor — used in the lab CTA section to evoke "real shell".
 */
export const BlinkCaret = memo(function BlinkCaret() {
  return (
    <motion.span
      aria-hidden
      className="ml-1 inline-block h-4 w-2 translate-y-[2px] bg-[var(--color-accent)]"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
    />
  );
});

// ── new primitives ──────────────────────────────────────────────────

/**
 * Scroll progress line — fixed 2px lime bar at top of viewport that
 * scales horizontally as the user scrolls the document. Spring-eased
 * via useSpring (no linear scroll-to-width mapping; feels weighted).
 * Hardware-accelerated (transform: scaleX) per §5.
 */
export const ScrollProgress = memo(function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 22,
    mass: 0.4,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="fixed left-0 right-0 top-0 z-50 h-[2px] bg-[var(--color-accent)]"
    />
  );
});

/**
 * Stagger container — used to cascade reveals across a list of
 * siblings (e.g. the 3 anchor cards, 14 curriculum tiles, bonus
 * preview cards). Children must be StaggerItem (same module). Both
 * sit in the same client tree per the skill's §4 critical rule.
 */
const staggerParent: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 18 },
  },
};

export function StaggerGrid({
  children,
  className,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const MotionComp = Component === "section" ? motion.section : motion.div;
  return (
    <MotionComp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
      variants={staggerParent}
    >
      {children}
    </MotionComp>
  );
}

/**
 * `StaggerList` — same as StaggerGrid but renders an `<ol>` so the
 * curriculum scrubber keeps its semantic ordered-list meaning.
 */
export function StaggerList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.ol
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
      variants={staggerParent}
    >
      {children}
    </motion.ol>
  );
}

export function StaggerItem({
  children,
  className,
  as: Component = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  const MotionComp =
    Component === "article"
      ? motion.article
      : Component === "li"
        ? motion.li
        : motion.div;
  return (
    <MotionComp className={className} variants={staggerChild}>
      {children}
    </MotionComp>
  );
}

/**
 * Typewriter — types the given string char-by-char ON FIRST INTERSECT
 * with the viewport, then halts. Does NOT loop. Used for the mock
 * terminal command block — the BlinkCaret keeps blinking afterward
 * to maintain the "live shell" feel without burning CPU re-typing.
 *
 * `lines` is an array of segments rendered top-to-bottom. Each segment
 * has `chunks` of either `{ kind: "dim", text }` (prompt prefix) or
 * `{ kind: "out", text }` (command/output). The whole structure is
 * typed in order, dim chunks instant (they're prompts that exist
 * before the user types), out chunks character-streamed at ~22ms/char.
 */
type Chunk = { kind: "dim" | "out" | "accent"; text: string };

export const TerminalTypewriter = memo(function TerminalTypewriter({
  lines,
}: {
  lines: ReadonlyArray<{ chunks: ReadonlyArray<Chunk> }>;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [progress, setProgress] = useState({ line: 0, char: 0 });
  const [done, setDone] = useState(false);

  // Precompute, for each line, the running char count up to and including
  // each chunk so we can render the partial typed-state.
  const lineMeta = useMemo(
    () =>
      lines.map((line) => {
        let acc = 0;
        const chunks = line.chunks.map((c) => {
          if (c.kind === "dim") {
            const start = acc;
            const end = acc + c.text.length;
            acc = end;
            return { ...c, start, end, instant: true as const };
          }
          const start = acc;
          const end = acc + c.text.length;
          acc = end;
          return { ...c, start, end, instant: false as const };
        });
        return { chunks, total: acc };
      }),
    [lines],
  );

  useEffect(() => {
    if (!inView || done) return undefined;
    if (progress.line >= lines.length) {
      setDone(true);
      return undefined;
    }
    const meta = lineMeta[progress.line];
    if (!meta) return undefined;
    if (progress.char >= meta.total) {
      // line complete — move to next after a small pause
      const t = window.setTimeout(
        () => setProgress({ line: progress.line + 1, char: 0 }),
        140,
      );
      return () => window.clearTimeout(t);
    }
    // Skip past dim chunks instantly (they pre-exist as prompts).
    const currentChunk = meta.chunks.find(
      (c) => progress.char >= c.start && progress.char < c.end,
    );
    const step = currentChunk?.instant ? currentChunk.end - progress.char : 1;
    const delay = currentChunk?.instant ? 0 : 22;
    const t = window.setTimeout(
      () => setProgress((p) => ({ line: p.line, char: p.char + step })),
      delay,
    );
    return () => window.clearTimeout(t);
  }, [inView, progress, lines.length, lineMeta, done]);

  return (
    <pre
      ref={ref}
      className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-[var(--color-ink-dim)]"
    >
      {lineMeta.map((meta, li) => {
        const visible = li < progress.line;
        const active = li === progress.line;
        const charsTyped = visible ? meta.total : active ? progress.char : 0;
        if (charsTyped === 0 && !visible) return null;
        return (
          <span key={li}>
            {meta.chunks.map((c, ci) => {
              if (charsTyped <= c.start) return null;
              const slice = c.text.slice(0, Math.max(0, charsTyped - c.start));
              const cls =
                c.kind === "dim"
                  ? "text-[var(--color-ink-faint)]"
                  : c.kind === "accent"
                    ? "text-[var(--color-accent)]"
                    : undefined;
              return (
                <span key={ci} className={cls}>
                  {slice}
                </span>
              );
            })}
            {"\n"}
          </span>
        );
      })}
      {done && <BlinkCaret />}
    </pre>
  );
});

/**
 * Pulse dot — slow opacity loop. Used as the "live system" indicator
 * in the hero mono-tag chip. Memoized to ensure the perpetual loop
 * doesn't trigger parent re-renders (skill §9 PERFORMANCE CRITICAL).
 *
 * Implemented via CSS animation (see globals.css `.breathe-slow`) so
 * the loop runs entirely on the compositor — no React render cycle
 * involvement, no framer-motion overhead per dot.
 */
export const BreathingDot = memo(function BreathingDot({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] breathe-slow ${className}`}
    />
  );
});

/**
 * Breathing icon wrapper — for lightning bolts on drill chips and
 * curriculum cells. Each instance receives a unique `phase` (0–1.8s)
 * so the icons breathe out of sync — adds the "alive room" feel
 * without the synchronized-blinking artificiality (skill §9 "breathing
 * status indicators" specifically wants this organic offset).
 *
 * CSS animation (see globals.css `.breathe-icon`) — see BreathingDot
 * for the reasoning behind CSS over framer per-instance.
 */
export function BreathingIcon({
  children,
  phase = 0,
  className,
}: {
  children: ReactNode;
  phase?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex breathe-icon ${className ?? ""}`}
      style={{ ["--phase" as string]: `${phase}s` }}
    >
      {children}
    </span>
  );
}

// Unused — re-exported only so the file API stays import-stable.
export { useMotionTemplate };
