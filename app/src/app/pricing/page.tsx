import Link from "next/link";
import { DAYS } from "@/lib/content";
import { getBonusItems } from "@/lib/content/bonus";

/**
 * Pricing page — sells via the same receipts the landing does.
 *
 * Honest position: Pro is $30/mo USD; billing rolls out with Phase 4
 * (Paddle integration). Until then, Pro feature access is gated by the
 * tier field on the User document — we can flip individual accounts
 * manually via the admin CLI. The page says all this out loud rather
 * than faking a checkout that doesn't exist.
 */
export default function PricingPage() {
  const bonus = getBonusItems();
  const totalDays = DAYS.length;
  const totalQuestions = DAYS.reduce((s, d) => s + d.quiz.length, 0);
  const totalDrills = DAYS.filter((d) => d.exercise.drillSlug).length;
  const freeQuestions = DAYS.filter((d) => d.n <= 3).reduce(
    (s, d) => s + d.quiz.length,
    0,
  );

  return (
    <>
      <header className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="mono-tag mb-6">Pricing</p>
          <h1 className="display text-[56px] leading-[1.02] md:text-[88px]">
            Three days free.
            <br />
            <em className="not-italic text-[var(--color-accent)]">$30/mo</em>{" "}
            after that.
          </h1>
        </div>
        <p className="max-w-[46ch] text-lg text-[var(--color-ink-dim)] md:col-span-5 md:pt-12">
          Two tiers. The free tier is a real product — first 3 days of the
          curriculum, no time limit, no card. Pro unlocks the rest.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Tier
          name="Free"
          tag="No card · no expiry"
          price="$0"
          priceSub="3 days, full content"
          accent={false}
          features={[
            "Days 1-3: Foundations + Lab Setup, Footprinting & Recon, Scanning Networks",
            `${freeQuestions} graded quiz questions with explanations`,
            "Day 01 grep-the-flag drill in the in-browser lab",
            "First 3 bonus articles (OSINT engines, Python libs, SQLMap)",
            "Progress synced across devices once you have an account",
          ]}
          cta={{
            label: "Start free",
            href: "/signup",
          }}
        />
        <Tier
          name="Pro"
          tag={`All ${totalDays} days · cancel anytime`}
          price="$30"
          priceSub="per month, USD"
          accent
          features={[
            `All ${totalDays} days — Foundations through 125-question exam simulator`,
            `${totalQuestions} explained quiz questions across every CEH v13 domain`,
            `${totalDrills} graded WebVM drills (Day 1 grep, Day 3 nmap, Day 10 SQLi, Day 13 crypto) — more shipping`,
            `${bonus.length} curated bonus articles with real GitHub repos surfaced`,
            "In-browser Debian lab — nmap, sqlmap, hydra, john, gobuster, gdb pre-loaded",
            "Domain-weighted timed exam simulator (125 q · 4 h · mirrors real v13)",
          ]}
          cta={{
            label: "Start free first →",
            href: "/signup?intent=pro",
            note: "Billing opens once Paddle integration ships (Phase 4). Sign up free now; we'll email when Pro checkout is live.",
          }}
        />
      </section>

      <section className="mt-24 grid grid-cols-1 gap-8 border-t border-[var(--color-line)] pt-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="mono-tag mb-3">// what you don&apos;t pay for</p>
          <h2 className="display text-3xl md:text-4xl">
            No tricks below the line.
          </h2>
        </div>
        <ul className="space-y-5 text-sm text-[var(--color-ink-dim)] md:col-span-7">
          {[
            [
              "No setup fee, no annual contract",
              "$30/mo is the whole price. Cancel any time; you keep access through the billing period.",
            ],
            [
              "No upsell to a $500 'pro+' tier",
              "Pro is Pro. The 14-day curriculum, the lab, the bonus library, the exam sim — all in one tier.",
            ],
            [
              "No data sales",
              "We send transactional email only (verify, reset, billing receipts). No newsletter, no third-party tracking pixels.",
            ],
            [
              "No teaching of techniques without ethics first",
              "Day 1 covers authorization, scope, and the line between research and felony. Every later module references it.",
            ],
          ].map(([title, body]) => (
            <li key={title}>
              <p className="text-[var(--color-ink)]">{title}</p>
              <p className="mt-1">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 border-t border-[var(--color-line)] pt-10 text-xs text-[var(--color-ink-faint)]">
        Have a question about billing or scope? Email{" "}
        <a
          href="mailto:hello@cehprep.local"
          className="hover:text-[var(--color-ink-dim)]"
        >
          hello@cehprep.local
        </a>
        . We respond within a day.
      </footer>
    </>
  );
}

const Tier = ({
  name,
  tag,
  price,
  priceSub,
  features,
  cta,
  accent,
}: {
  name: string;
  tag: string;
  price: string;
  priceSub: string;
  features: string[];
  cta: { label: string; href: string; note?: string };
  accent: boolean;
}) => (
  <article
    className={`relative overflow-hidden rounded-2xl border p-8 md:p-10 ${
      accent
        ? "border-[var(--color-accent)] bg-gradient-to-br from-[rgba(190,242,100,0.05)] to-transparent"
        : "border-[var(--color-line)] bg-[var(--color-surface)]"
    }`}
  >
    <div className="mb-8 flex items-baseline justify-between gap-4">
      <div>
        <h3 className="display text-4xl">{name}</h3>
        <p className="mono-tag mt-2">{tag}</p>
      </div>
      <div className="text-right">
        <div
          className={`display text-4xl ${accent ? "text-[var(--color-accent)]" : ""}`}
        >
          {price}
        </div>
        <div className="mono-tag mt-1">{priceSub}</div>
      </div>
    </div>

    <ul className="mb-10 space-y-4">
      {features.map((f) => (
        <li key={f} className="flex gap-3 text-sm">
          <span
            className={`mt-[8px] h-[5px] w-[5px] flex-none rounded-full ${
              accent ? "bg-[var(--color-accent)]" : "bg-[var(--color-ink-dim)]"
            }`}
          />
          <span className="text-[var(--color-ink)]">{f}</span>
        </li>
      ))}
    </ul>

    <Link href={cta.href} className={accent ? "btn-primary" : "btn-ghost"}>
      {cta.label}
    </Link>
    {cta.note && (
      <p className="mt-4 text-xs text-[var(--color-ink-faint)]">{cta.note}</p>
    )}
  </article>
);
