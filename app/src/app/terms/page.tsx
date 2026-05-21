import type { Metadata } from "next";
import Link from "next/link";

/**
 * Terms of Service — public, no auth.
 *
 * Honest minimum-viable terms for a solo-operated learning SaaS.
 * Written in English rather than legalese; the operative clauses
 * still bind. Paddle merchant-approval also scans this URL.
 *
 * Last reviewed: 2026-05. Update LAST_UPDATED when any operative
 * clause changes (refund window, governing law, processor list).
 */

const LAST_UPDATED = "2026-05-21";

export const metadata: Metadata = {
  title: "Terms — CEH Prep",
  description:
    "Terms of Service for CEH Prep — what you can do, what we can do, the refund clause, and the boring legal stuff written in English.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[68ch] space-y-10 text-[var(--color-ink-dim)]">
      <header className="border-b border-[var(--color-line)] pb-10">
        <p className="mono-tag mb-4">Terms of Service</p>
        <h1 className="display text-4xl leading-tight md:text-6xl">
          The rules,
          <br />
          <span className="text-[var(--color-accent)]">in English</span>.
        </h1>
        <p className="mt-6 text-sm">
          Last updated: <span className="font-mono">{LAST_UPDATED}</span>
        </p>
      </header>

      <Section heading="1. What this is">
        <p>
          CEH Prep is a 14-day Certified Ethical Hacker v13 study product. It
          is operated solo by Sahar Barak. By creating an account or paying
          for Pro, you agree to these Terms and the linked{" "}
          <Link
            href="/privacy"
            className="text-[var(--color-accent)] underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="2. What you get">
        <p>
          <span className="text-[var(--color-ink)]">Free tier:</span> Days 1-3
          of the curriculum, lab access for the Day 1 drill, the first three
          bonus library entries. No card required, no time limit.
        </p>
        <p>
          <span className="text-[var(--color-ink)]">Pro ($30/mo):</span> All 14
          days, every graded drill in the WebVM lab, all bonus library entries,
          the Day-14 timed exam simulator. Billed monthly via Paddle. Cancel
          anytime — access continues through the end of the billed period.
        </p>
      </Section>

      <Section heading="3. What you can do with it">
        <p>
          Personal study. Use the curriculum, run the labs, read the bonus
          library. You can copy code snippets from the curriculum into your own
          work. You can quote short passages with attribution.
        </p>
        <p>
          You can&apos;t resell the curriculum, scrape it for a competing
          product, share your account with multiple people (one account = one
          person), or use it to attack systems you don&apos;t own or
          aren&apos;t authorized to test. The product teaches techniques used
          to break in; using them outside authorized scope is illegal in most
          jurisdictions. You&apos;re responsible for staying inside the law.
        </p>
      </Section>

      <Section heading="4. The refund clause">
        <p>
          If you complete the full 14-day sprint (every lesson, every quiz,
          every drill) and score under 70% on the Day-14 simulator, email{" "}
          <a
            href="mailto:hello@cehprep.local"
            className="text-[var(--color-accent)] underline"
          >
            hello@cehprep.local
          </a>{" "}
          with your account email and we&apos;ll refund the current month.
          70% is the CEH v13 pass threshold for the most common exam form.
        </p>
        <p className="text-[13px] text-[var(--color-ink-faint)]">
          We don&apos;t require a return form or a sales call. We do require
          the work — if you skipped lessons, the refund isn&apos;t a
          guarantee of pass-mark fitness because you didn&apos;t use the
          product. Fair&apos;s fair both ways.
        </p>
      </Section>

      <Section heading="5. Billing, Paddle, taxes">
        <p>
          Paddle is the merchant of record. Your receipt lists Paddle as the
          seller. Paddle handles VAT/sales tax for your jurisdiction; the $30
          listed is the price before tax (most regions) or inclusive (UK, AU).
          Charges renew monthly until you cancel.
        </p>
        <p>
          Cancel from the Settings page or via the link in your Paddle
          receipt. Cancellation takes effect at the end of the current billing
          period — you keep Pro access through that date.
        </p>
      </Section>

      <Section heading="6. Account responsibility">
        <p>
          Keep your password strong and don&apos;t share it. We use argon2id
          hashing and have a lockout policy on failed attempts, but if your
          credentials leak from a different site and you reused the password
          here, that&apos;s on you. Phase 2 includes pwned-password checks at
          signup to head this off where possible.
        </p>
      </Section>

      <Section heading="7. Availability, downtime, force majeure">
        <p>
          The product is provided &ldquo;as is.&rdquo; We aim for high
          uptime but make no SLA. Vercel, MongoDB Atlas, Resend, and Paddle
          are the upstream dependencies — when they go down, we go down.
          Scheduled maintenance windows are announced on the status page when
          we can plan ahead; emergency maintenance happens when it has to.
        </p>
      </Section>

      <Section heading="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, CEH Prep&apos;s aggregate
          liability for any claim arising out of or related to the service is
          limited to the greater of (a) the amount you paid us in the 12
          months preceding the claim, or (b) USD $50. We are not liable for
          lost profits, lost data, lost opportunity, or any other consequential
          damages.
        </p>
      </Section>

      <Section heading="9. Termination">
        <p>
          You can delete your account at any time via the Settings page (
          <code className="font-mono text-[var(--color-accent)]">
            POST /api/account/delete
          </code>
          ). We can suspend or terminate accounts that violate Section 3 —
          this happens roughly never; if it does we&apos;ll refund the unused
          portion of the current month.
        </p>
      </Section>

      <Section heading="10. Changes to these terms">
        <p>
          We&apos;ll update this page when terms change. Material changes
          (refund clause, governing law, processor list) trigger a
          notification email to your account address. Continued use after a
          material change counts as acceptance; if you don&apos;t accept,
          delete the account before the change effective date and your last
          paid month is refunded pro-rata.
        </p>
      </Section>

      <Section heading="11. Governing law">
        <p>
          These Terms are governed by the laws of Israel. Disputes go to the
          courts of Tel Aviv unless local consumer-protection law gives you a
          better forum (in which case it does — we don&apos;t contract out of
          your statutory rights).
        </p>
      </Section>

      <Section heading="12. Contact">
        <p>
          Billing or account issues:{" "}
          <a
            href="mailto:hello@cehprep.local"
            className="text-[var(--color-accent)] underline"
          >
            hello@cehprep.local
          </a>
          .
        </p>
        <p>
          Legal / privacy:{" "}
          <a
            href="mailto:privacy@cehprep.local"
            className="text-[var(--color-accent)] underline"
          >
            privacy@cehprep.local
          </a>
          .
        </p>
      </Section>

      <footer className="border-t border-[var(--color-line)] pt-8 text-xs">
        <Link href="/" className="text-[var(--color-accent)] hover:underline">
          ← back to home
        </Link>
        <span className="mx-3">·</span>
        <Link href="/privacy" className="hover:text-[var(--color-ink)]">
          Privacy Policy
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
