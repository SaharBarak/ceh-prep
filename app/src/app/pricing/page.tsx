import Link from "next/link";
import type { Route } from "next";

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-14 md:px-10">
      <nav className="mb-20">
        <Link href="/" className="mono-tag hover:text-[var(--color-accent)]">
          ← Back
        </Link>
      </nav>

      <header className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="mono-tag mb-6">Pricing</p>
          <h1 className="display text-[56px] md:text-8xl">
            Free.
            <br />
            Forever.
          </h1>
        </div>
        <p className="max-w-[46ch] text-lg text-[var(--color-ink-dim)] md:col-span-5 md:pt-10">
          The pricing page exists because real products have one. Both tiers
          ship at $0. If we ever charge, we&apos;ll warn you first, and the
          static free version never changes.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Tier
          name="Free"
          tag="v0 · static HTML"
          price="$0"
          priceSub="forever"
          accent={false}
          features={[
            "First 3 days of curriculum",
            "15 graded questions",
            "Local progress (this browser only)",
            "Zero accounts, zero tracking",
            "Double-click a single HTML file",
          ]}
          cta={{
            label: "Open /free/index.html",
            href: "/",
            note: "Clone the repo, open free/index.html in a browser. No build.",
          }}
        />
        <Tier
          name="Pro"
          tag="app · full sprint"
          price="$0"
          priceSub="while in beta"
          crossedPrice="$9 / mo"
          accent
          features={[
            "All 14 days of curriculum",
            "70 graded questions",
            "125-question timed exam simulator",
            "Progress synced across devices",
            "Domain-level accuracy breakdown",
            "Flagged-question review deck",
            "Daily streak + completion badge",
          ]}
          cta={{ label: "Start the sprint", href: "/signup" }}
        />
      </section>

      <section className="mt-20">
        <p className="mono-tag mb-6">Questions people ask</p>
        <div className="grid grid-cols-1 gap-px bg-[var(--color-line)] md:grid-cols-2">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="bg-[var(--color-bg)] p-6 md:p-8">
              <h4 className="display mb-2 text-xl">{q}</h4>
              <p className="text-sm leading-relaxed text-[var(--color-ink-dim)]">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const FAQ = [
  {
    q: "Is this affiliated with EC-Council?",
    a: "No. We are an independent prep tool. EC-Council owns the CEH trademark and runs the official exam.",
  },
  {
    q: "Why is Pro free?",
    a: "We built it for ourselves. Running costs are small. If that ever changes we'll add a real price and warn you a month in advance. The static /free version never changes and never requires an account.",
  },
  {
    q: "Do you sell my data?",
    a: "No. No ads, no analytics beyond basic server logs. Progress data is stored encrypted and keyed to your account.",
  },
  {
    q: "Will this replace hands-on practice?",
    a: "No. CEH is 70% theory; the exercise each day points you at real tools (Nmap, Burp, sqlmap, Wireshark) in your own lab. Use them.",
  },
];

type CTA = { label: string; href: Route; note?: string };

const Tier = ({
  name,
  tag,
  price,
  priceSub,
  crossedPrice,
  features,
  cta,
  accent,
}: {
  name: string;
  tag: string;
  price: string;
  priceSub: string;
  crossedPrice?: string;
  features: string[];
  cta: CTA;
  accent: boolean;
}) => (
  <article
    className={`relative overflow-hidden rounded-2xl border p-8 md:p-10 ${
      accent
        ? "border-[var(--color-accent)] bg-gradient-to-br from-[rgba(190,242,100,0.05)] to-transparent"
        : "border-[var(--color-line)] bg-[var(--color-surface)]"
    }`}
  >
    <div className="mb-8 flex items-baseline justify-between">
      <div>
        <h3 className="display text-4xl">{name}</h3>
        <p className="mono-tag mt-2">{tag}</p>
      </div>
      <div className="text-right">
        {crossedPrice && (
          <div className="font-mono text-xs text-[var(--color-ink-faint)] line-through">
            {crossedPrice}
          </div>
        )}
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
      {cta.label} →
    </Link>
    {cta.note && (
      <p className="mt-4 text-xs text-[var(--color-ink-faint)]">{cta.note}</p>
    )}
  </article>
);
