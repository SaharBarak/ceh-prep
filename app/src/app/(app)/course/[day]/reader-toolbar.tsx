"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setLessonComplete } from "@/lib/actions/completion";

type Props = {
  day: number;
  totalDays: number;
  initiallyComplete: boolean;
};

type FontScale = "s" | "m" | "l";

const SCALE_STORAGE_KEY = "ceh:fontScale";
const SCALE_VALUES: Record<FontScale, string> = {
  s: "15px",
  m: "17px",
  l: "19px",
};

export function ReaderToolbar({ day, totalDays, initiallyComplete }: Props) {
  const [scale, setScale] = useState<FontScale>("m");
  const [complete, setComplete] = useState(initiallyComplete);
  const [pending, startTransition] = useTransition();

  // Hydrate font-scale from localStorage on mount; apply to <html> font-size
  // so the entire reader respects it (rem-based downstream styles scale).
  useEffect(() => {
    const saved = (localStorage.getItem(SCALE_STORAGE_KEY) ?? "m") as FontScale;
    setScale(saved);
    document.documentElement.style.setProperty("--reader-font-size", SCALE_VALUES[saved]);
  }, []);

  const changeScale = (next: FontScale) => {
    setScale(next);
    localStorage.setItem(SCALE_STORAGE_KEY, next);
    document.documentElement.style.setProperty("--reader-font-size", SCALE_VALUES[next]);
  };

  const markComplete = () => {
    if (complete) return;
    startTransition(async () => {
      const res = await setLessonComplete(day);
      if (res.ok) setComplete(true);
    });
  };

  return (
    <div className="sticky top-0 z-40 -mx-6 mb-10 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex flex-wrap items-center gap-4">
        {/* Day jump */}
        <label className="flex items-center gap-2">
          <span className="mono-tag">Day</span>
          <select
            value={day}
            onChange={(e) => {
              window.location.href = `/course/${e.target.value}`;
            }}
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 font-mono text-xs"
            aria-label="Jump to another day"
          >
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Day {String(n).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>

        {/* Font scale */}
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Reader font size">
          <span className="mono-tag">Size</span>
          {(["s", "m", "l"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={scale === opt}
              onClick={() => changeScale(opt)}
              className={[
                "h-7 w-7 rounded border text-xs font-mono",
                scale === opt
                  ? "border-[var(--color-accent)] bg-[rgba(190,242,100,0.08)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)]",
              ].join(" ")}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="hidden flex-1 md:block" />

        {/* Mark complete */}
        <button
          type="button"
          onClick={markComplete}
          disabled={complete || pending}
          className={[
            "rounded-full border px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
            complete
              ? "border-[var(--color-accent)] bg-[rgba(190,242,100,0.08)] text-[var(--color-accent)]"
              : "border-[var(--color-line)] text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]",
            pending && "opacity-60",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={complete ? "Lesson marked complete" : "Mark lesson complete"}
        >
          {complete ? "✓ Done" : pending ? "Saving…" : "Mark done"}
        </button>

        {/* Prev / Next */}
        <nav className="flex items-center gap-1" aria-label="Day navigation">
          {day > 1 && (
            <Link
              href={`/course/${day - 1}`}
              className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
            >
              ←
            </Link>
          )}
          {day < totalDays && (
            <Link
              href={`/course/${day + 1}`}
              className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
            >
              →
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
