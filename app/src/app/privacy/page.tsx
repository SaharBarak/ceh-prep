import type { Metadata } from "next";
import Link from "next/link";

/**
 * Privacy policy — public, no auth.
 *
 * Honest catalogue of what's collected, where it's stored, how long
 * we keep it, and how to delete it. This page is also the Paddle
 * merchant-approval prerequisite — Paddle scans this URL before
 * activating live checkout.
 *
 * Last reviewed: 2026-05. Update the LAST_UPDATED constant when the
 * processor list or data classes change.
 */

const LAST_UPDATED = "2026-05-21";

export const metadata: Metadata = {
  title: "Privacy — CEH Prep",
  description:
    "What CEH Prep collects, where it goes, how long it stays, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[68ch] space-y-10 text-[var(--color-ink-dim)]">
      <header className="border-b border-[var(--color-line)] pb-10">
        <p className="mono-tag mb-4">Privacy</p>
        <h1 className="display text-4xl leading-tight md:text-6xl">
          What we collect.
          <br />
          <span className="text-[var(--color-accent)]">Why we collect it.</span>
        </h1>
        <p className="mt-6 text-sm">
          Last updated: <span className="font-mono">{LAST_UPDATED}</span>
        </p>
      </header>

      <Section heading="The short version">
        <p>
          CEH Prep is operated solo by Sahar Barak. We collect the minimum data
          needed to run a 14-day learning product: your email, a hashed
          password, your progress, and your payment status. We do not sell
          data. We do not embed third-party ad pixels. The only third parties
          that see your data are the processors listed below.
        </p>
      </Section>

      <Section heading="What we collect, and why">
        <DataRow
          label="Account"
          what="Email address, display name (optional), hashed password (argon2id), email-verified timestamp, session epoch."
          why="Required to run an account. Email is also the contact point for verify + reset + transactional messages."
        />
        <DataRow
          label="Progress"
          what="Days completed, drills completed, last-active timestamp, quiz responses (correct/incorrect — never freeform)."
          why="So you can resume where you stopped, and so we can fire the streak / winback emails at the right moments."
        />
        <DataRow
          label="Email engagement"
          what="An append-only ledger of which marketing emails you received (drip, streak, winback) with timestamp + Resend message ID."
          why="Idempotency — guarantees you never get the same drip twice. Also lets you see exactly what we sent if you ask."
        />
        <DataRow
          label="Newsletter (if subscribed)"
          what="Email address, source page, confirmation timestamp."
          why="Newsletter is opt-in, double-opt-in confirmed, and unsubscribe is one-click. Separate from product email."
        />
        <DataRow
          label="Billing (if Pro)"
          what="Paddle customer ID, subscription status (active/canceled/past_due), event timestamps. We never see your card."
          why="Tier sync — when Paddle says you're paid, your account flips to Pro. When it says canceled, it flips back."
        />
        <DataRow
          label="Analytics (with consent)"
          what="Page views, CTA clicks, signup/login completion, day-complete events, anonymized IP."
          why="So we can see what works and what doesn't. Disabled until you accept the consent banner; switch off any time."
        />
        <DataRow
          label="Audit log"
          what="Authentication events (login, password reset, verify) with truncated IP + user-agent + outcome."
          why="Security baseline. Lets us detect credential stuffing, lockout abuse, and unauthorized access attempts."
        />
      </Section>

      <Section heading="Processors we use">
        <p>
          The third parties below see specific slices of your data. Each is
          contractually obligated (DPA in place) to use it only for the
          stated purpose:
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          <Processor
            name="Vercel"
            url="https://vercel.com/legal/privacy-policy"
            purpose="Hosting (compute + edge + log storage)"
            sees="All inbound HTTPS requests, server logs"
            region="US + EU (Frankfurt, Paris)"
          />
          <Processor
            name="MongoDB Atlas"
            url="https://www.mongodb.com/legal/privacy-policy"
            purpose="Application database"
            sees="Account, progress, dispatch ledger, newsletter rows"
            region="EU (Frankfurt)"
          />
          <Processor
            name="Resend"
            url="https://resend.com/legal/privacy-policy"
            purpose="Transactional + marketing email"
            sees="Email address, message content"
            region="US + EU"
          />
          <Processor
            name="Paddle"
            url="https://www.paddle.com/legal/privacy"
            purpose="Payment processing + tax handling (merchant of record)"
            sees="Email, payment instrument, billing address, tax ID"
            region="EU"
          />
          <Processor
            name="Google Analytics 4"
            url="https://policies.google.com/privacy"
            purpose="Aggregate product analytics"
            sees="Anonymized IP, page views, custom events — only after you grant consent"
            region="US + EU"
          />
          <Processor
            name="Anthropic"
            url="https://www.anthropic.com/legal/privacy"
            purpose="Nightly QA simulation (no user data sent)"
            sees="Screenshots of public pages only. No account data ever crosses this boundary."
            region="US"
          />
        </ul>
      </Section>

      <Section heading="Retention">
        <p>
          Account + progress data is kept while your account is active. If
          you delete your account (
          <code className="font-mono text-[var(--color-accent)]">
            /api/account/delete
          </code>
          , see below), all rows are hard-deleted within 30 days except the
          audit log, which is retained for 12 months for security forensics
          and then deleted.
        </p>
        <p>
          Newsletter subscribers are retained until unsubscribe. After
          unsubscribe the row stays for 90 days (so we can prove we honored
          the request) and is then deleted.
        </p>
        <p>
          Paddle retains billing records for 7 years under EU VAT MOSS rules
          — that&apos;s their statutory floor, not our choice.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>Under GDPR (and equivalents elsewhere), you can:</p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm">
          <li>
            <strong className="text-[var(--color-ink)]">Access</strong> your data
            via the Settings page (every field we store on you).
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Export</strong> it as a
            JSON archive at{" "}
            <code className="font-mono text-[var(--color-accent)]">
              GET /api/account/export
            </code>
            . The response includes account, progress, dispatch ledger, and
            audit log.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Delete</strong> your
            account via the Settings page or{" "}
            <code className="font-mono text-[var(--color-accent)]">
              POST /api/account/delete
            </code>
            . Hard-deletes everything except the audit log (retained for
            security forensics for 12 months, then deleted).
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Opt out</strong> of
            marketing email via the unsubscribe link in any email footer, or by
            setting <code className="font-mono">marketingOptOut</code> in your
            account.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Withdraw consent</strong>{" "}
            for analytics any time via the consent banner toggle (look for the
            small &ldquo;Cookies&rdquo; chip in the footer).
          </li>
        </ul>
      </Section>

      <Section heading="Cookies">
        <p>
          We use first-party cookies for one thing: your authenticated session.
          That cookie is HttpOnly, Secure, SameSite=Lax, and not visible to
          JavaScript. We do not set third-party cookies unless you grant
          analytics consent — at which point GA4 sets its own first-party
          cookies (
          <code className="font-mono">_ga</code>,{" "}
          <code className="font-mono">_ga_*</code>) for measurement only.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Privacy questions:{" "}
          <a
            href="mailto:privacy@cehprep.local"
            className="text-[var(--color-accent)] underline"
          >
            privacy@cehprep.local
          </a>
          . We reply within 7 days for routine inquiries and within 30 days for
          data-subject access requests (GDPR statutory window).
        </p>
      </Section>

      <footer className="border-t border-[var(--color-line)] pt-8 text-xs">
        <Link href="/" className="text-[var(--color-accent)] hover:underline">
          ← back to home
        </Link>
        <span className="mx-3">·</span>
        <Link href="/terms" className="hover:text-[var(--color-ink)]">
          Terms of Service
        </Link>
      </footer>
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
    <section className="space-y-4">
      <h2 className="display text-2xl text-[var(--color-ink)] md:text-3xl">
        {heading}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  what,
  why,
}: {
  label: string;
  what: string;
  why: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-l-2 border-[var(--color-line)] pl-4 md:grid-cols-[140px_1fr] md:gap-4">
      <p className="mono-tag pt-1 text-[var(--color-ink)]">{label}</p>
      <div className="space-y-1.5 text-sm">
        <p className="text-[var(--color-ink)]">{what}</p>
        <p className="text-[var(--color-ink-faint)]">{why}</p>
      </div>
    </div>
  );
}

function Processor({
  name,
  url,
  purpose,
  sees,
  region,
}: {
  name: string;
  url: string;
  purpose: string;
  sees: string;
  region: string;
}) {
  return (
    <li className="grid grid-cols-1 gap-1 border-l-2 border-[var(--color-line)] pl-4 md:grid-cols-[160px_1fr]">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[12px] text-[var(--color-accent)] hover:underline"
      >
        {name} →
      </a>
      <div className="space-y-0.5 text-[13px]">
        <p>
          <span className="text-[var(--color-ink)]">Purpose:</span> {purpose}
        </p>
        <p>
          <span className="text-[var(--color-ink)]">Sees:</span> {sees}
        </p>
        <p className="text-[var(--color-ink-faint)]">
          <span className="text-[var(--color-ink)]">Region:</span> {region}
        </p>
      </div>
    </li>
  );
}
