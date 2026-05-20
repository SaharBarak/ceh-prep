"use client";

import { useState } from "react";

type Props = {
  cmd: string;
  className?: string;
};

export function CopyCmd({ cmd, className }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the text manually if clipboard write fails (Safari
      // private mode, missing permission). User can still ctrl-c the visible
      // <pre>, so we just silently stay un-flashing.
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 rounded-md border border-[var(--color-line)] bg-[var(--color-bg)]/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
        aria-label={copied ? "Command copied" : "Copy command to clipboard"}
      >
        {copied ? "✓ copied" : "copy"}
      </button>
      <pre className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[rgba(0,0,0,0.4)] p-4 font-mono text-[12px] text-[var(--color-accent)]">
        {cmd}
      </pre>
    </div>
  );
}
