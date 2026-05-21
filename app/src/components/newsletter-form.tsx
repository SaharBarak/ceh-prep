"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Warning } from "@phosphor-icons/react";
import { track, EVENTS } from "@/lib/analytics/ga4";

type Status = "idle" | "submitting" | "sent" | "error";

/**
 * Newsletter signup — small, public, decoupled from the product user
 * account flow. POSTs to /api/newsletter and renders one of three
 * final states: sent (DOI email dispatched), error (invalid email),
 * or the original input.
 *
 * `source` defaults to "footer" but call sites can override (e.g. an
 * inline-homepage placement passes "landing"). Useful for GA4
 * attribution downstream.
 */
export function NewsletterForm({
  source = "footer",
  className,
  placeholder = "you@yours",
}: {
  source?: "footer" | "landing" | "bonus";
  className?: string;
  placeholder?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^.+@.+\..+$/.test(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      track(EVENTS.NEWSLETTER_SUBSCRIBE, { source });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p
        role="status"
        className={`flex items-center gap-2 font-mono text-[12px] text-[var(--color-accent)] ${className ?? ""}`}
      >
        <CheckCircle size={14} weight="bold" />
        Check your inbox to confirm.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex w-full max-w-md items-center gap-2 ${className ?? ""}`}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        placeholder={placeholder}
        required
        maxLength={254}
        aria-label="Email address"
        className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-line-strong)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-wider text-[var(--color-bg)] transition-opacity disabled:opacity-50"
      >
        {status === "submitting" ? "Sending..." : "Subscribe"}
        {status !== "submitting" && <ArrowRight size={12} weight="bold" />}
      </button>
      {status === "error" && (
        <p
          role="alert"
          className="ml-2 flex items-center gap-1 font-mono text-[11px] text-[#fca5a5]"
        >
          <Warning size={12} weight="bold" />
          Invalid
        </p>
      )}
    </form>
  );
}
