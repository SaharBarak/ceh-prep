"use client";

/**
 * Client-side motion primitives for the landing page.
 *
 * Kept minimal — framer-motion's `motion` is heavy enough that we only use it
 * for entrance reveals on the hero side-panel and the section headers. Cards
 * use CSS transitions inherited from globals.css.
 */

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

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
          <p className="mono-tag mt-1">{it.l}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * A pretend terminal cursor — used in the lab CTA section to evoke "real shell".
 */
export function BlinkCaret() {
  return (
    <motion.span
      aria-hidden
      className="ml-1 inline-block h-4 w-2 translate-y-[2px] bg-[var(--color-accent)]"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
    />
  );
}
