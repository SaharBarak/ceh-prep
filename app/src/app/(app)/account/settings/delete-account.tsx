"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Account-delete client island. Lives on /account/settings.
 *
 * Two-step UX: button → confirmation modal where the user must type
 * `DELETE` verbatim before the destructive button enables. Mirrors the
 * confirmation pattern used by GitHub / Atlas / Linear for repo + project
 * destruction. The modal lifts the wire-format `confirm: "DELETE"` field
 * directly from the textbox so the API can independently sanity-check.
 *
 * After success, redirects to `/` — at that point the iron-session cookie
 * has been destroyed server-side and there's nothing left to log out from.
 */
export const DeleteAccountForm = () => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canDelete = confirm === "DELETE" && !pending;

  const onDelete = () => {
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/account/delete", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE" }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setError(json.error ?? "request_failed");
          return;
        }
        // Session cookie is dead; bounce to homepage. Use a hard replace so
        // any cached server-rendered authenticated chunks don't flash.
        window.location.assign("/?account_deleted=1");
      } catch {
        setError("network_error");
      }
    });
  };

  if (!open) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-ink-dim)]">
          Hard-deletes your account, progress, and email history. The audit
          log is retained for 12 months for security forensics, then deleted
          (per <a className="underline" href="/privacy">privacy policy</a>).
          If you have a paid subscription, cancel it in your Paddle dashboard
          first — deleting here does not refund or cancel billing.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-4 py-2 font-mono text-xs uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/10"
        >
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5">
      <div>
        <p className="display text-lg text-red-200">Final confirmation</p>
        <p className="mt-2 text-sm text-[var(--color-ink-dim)]">
          This is irreversible. Type{" "}
          <code className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[var(--color-accent)]">
            DELETE
          </code>{" "}
          below to enable the button.
        </p>
      </div>
      <input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.trim())}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-red-500/30 bg-[var(--color-surface)] px-4 py-3 font-mono text-sm focus:border-red-400 focus:outline-none"
        placeholder="Type DELETE"
      />
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {ERROR_COPY[error] ?? error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="inline-flex items-center gap-2 rounded-md bg-red-500/80 px-4 py-2 font-mono text-xs uppercase tracking-wider text-white transition-opacity hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete forever"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirm("");
            setError(null);
          }}
          disabled={pending}
          className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const ERROR_COPY: Record<string, string> = {
  unauthorized: "Session expired. Reload and log in again.",
  forbidden_origin: "Request blocked. Reload the page and try again.",
  rate_limited: "Too many attempts. Try again in an hour.",
  missing_confirmation: "Confirmation text did not match.",
  server_error: "Something went wrong. Try again, or email hello@cehprep.local.",
  network_error: "Network error. Check your connection and try again.",
  request_failed: "Request failed. Try again.",
};
