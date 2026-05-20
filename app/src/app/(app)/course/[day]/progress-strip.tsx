"use client";

type Props = {
  lessonPct: number;
  quizPct: number;
  labDone: boolean;
};

export function ProgressStrip({ lessonPct, quizPct, labDone }: Props) {
  return (
    <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)]">
      <Pill label="Lesson" pct={lessonPct} />
      <Pill label="Quiz" pct={quizPct} />
      <Pill label="Lab" pct={labDone ? 100 : 0} />
    </div>
  );
}

function Pill({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="relative bg-[var(--color-surface)] p-4">
      <div
        className="absolute inset-y-0 left-0 bg-[rgba(190,242,100,0.12)] transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
        aria-hidden
      />
      <div className="relative flex items-baseline justify-between">
        <span className="mono-tag">{label}</span>
        <span className="font-mono text-sm text-[var(--color-ink)]">{clamped}%</span>
      </div>
    </div>
  );
}
