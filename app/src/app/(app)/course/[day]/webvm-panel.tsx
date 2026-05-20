"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setDrillComplete } from "@/lib/actions/completion";

type Props = {
  /** WebVM drill slug, e.g. "day10-sqli/01-payload-anatomy". Undefined = no drill mapped for this day. */
  drillSlug?: string;
  /** True if the viewer's tier allows running the lab (canAccessDay decided this server-side). */
  canRun: boolean;
  /** Day number for the cmd hint. */
  day: number;
  /** Whether the user has already marked this drill complete. */
  initiallyComplete: boolean;
};

const WEBVM_ORIGIN = "https://saharbarak.github.io";
const WEBVM_URL = `${WEBVM_ORIGIN}/ceh-webvm/`;

export function WebVMPanel({ drillSlug, canRun, day, initiallyComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [complete, setComplete] = useState(initiallyComplete);
  const [pending, startTransition] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Listen for the drill-pass postMessage from the WebVM iframe.
  // Strictly origin-checked — only the WebVM origin can update completion.
  useEffect(() => {
    if (!drillSlug) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== WEBVM_ORIGIN) return;
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        data.type === "cehprep:drill:pass" &&
        data.slug === drillSlug
      ) {
        markPass();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillSlug]);

  const markPass = () => {
    if (!drillSlug || complete) return;
    startTransition(async () => {
      const res = await setDrillComplete(drillSlug);
      if (res.ok) setComplete(true);
    });
  };

  if (!drillSlug) {
    // No drill mapped for this day yet — show a placeholder explaining.
    return (
      <p className="mt-4 text-xs text-[var(--color-ink-faint)]">
        Browser lab coming soon for this day. Use the VirtualBox + Kali setup from Day 1 for now.
      </p>
    );
  }

  if (!canRun) {
    // Free tier on a Pro-gated day.
    return (
      <div className="mt-6 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] p-4">
        <p className="mb-3 text-sm text-[var(--color-ink-dim)]">
          🔒 The in-browser lab is part of Pro — full WebVM with{" "}
          <code className="text-[var(--color-accent)]">nmap</code>,{" "}
          <code className="text-[var(--color-accent)]">sqlmap</code>,{" "}
          <code className="text-[var(--color-accent)]">john</code>, and the day-{day} drill preloaded.
        </p>
        <a
          href={`/pricing?from=lab-day${day}`}
          className="btn-primary inline-flex"
        >
          Upgrade to Pro →
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-primary"
          aria-expanded={open}
          aria-controls="webvm-frame"
        >
          {open ? "Hide lab terminal" : "Run this drill →"}
        </button>
        {complete ? (
          <span className="mono-tag text-[var(--color-accent)]">✓ Drill complete</span>
        ) : (
          <button
            type="button"
            onClick={markPass}
            disabled={pending}
            className="btn-ghost"
          >
            {pending ? "Marking…" : "I solved it"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
          <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2">
            <p className="mono-tag">Browser terminal · {drillSlug}</p>
            <p className="font-mono text-[10px] text-[var(--color-ink-faint)]">
              tip: <span className="text-[var(--color-accent)]">drill start {drillSlug.split("/")[0]?.replace("day", "day").slice(0, 5)} {drillSlug.split("/")[1]?.slice(0, 2)}</span>
            </p>
          </header>
          <iframe
            ref={iframeRef}
            id="webvm-frame"
            src={WEBVM_URL}
            title="CEH Prep WebVM lab terminal"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allow="clipboard-read; clipboard-write"
            className="block h-[680px] w-full border-0 bg-black"
          />
          <footer className="border-t border-[var(--color-line)] px-4 py-2 text-[10px] text-[var(--color-ink-faint)]">
            Sandboxed iframe to{" "}
            <a
              href={WEBVM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-ink-dim)] underline-offset-2 hover:underline"
            >
              {WEBVM_URL}
            </a>{" "}
            · All execution is in your browser; nothing reaches our servers.
          </footer>
        </div>
      )}
    </div>
  );
}
