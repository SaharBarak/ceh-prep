import Link from "next/link";

/**
 * Public site nav. Shown on every page via the root layout.
 *
 * Design choices:
 *  - Mono typography + small size — doesn't fight the hero's asymmetric heavy
 *    headline. Stays out of the way; signals "homepage of a developer product"
 *    rather than "marketing landing page".
 *  - Two clusters: product / commerce (Curriculum, Lab, Bonus, Pricing on the
 *    left of the right-cluster) and account (Log in + Start-free CTA on the
 *    right edge).
 *  - Curriculum + Lab are anchor links to home page sections (#curriculum,
 *    #lab). They behave as in-page jumps on `/` and as same-page-load + scroll
 *    when on other pages (browsers handle the cross-page anchor automatically).
 *  - Auth-gated pages (/dashboard, /course/[day]) keep their existing
 *    in-page "← Dashboard" affordance — this nav is for the public surface.
 */
export function SiteNav() {
  return (
    <nav className="border-b border-[var(--color-line)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="display flex items-baseline gap-2 text-lg leading-none text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
        >
          CEH Prep
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
            v13
          </span>
        </Link>

        <div className="flex items-center gap-1 md:gap-3">
          <NavLink href="/#curriculum">Curriculum</NavLink>
          <NavLink href="/#lab">Lab</NavLink>
          <NavLink href="/wiki">Wiki</NavLink>
          <NavLink href="/bonus">Library</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/about">About</NavLink>
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-[var(--color-line)] md:inline-block" />
          <Link
            href="/login"
            className="hidden font-mono text-[12px] uppercase tracking-wider text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-ink)] sm:inline-block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-[var(--color-bg)] transition-opacity hover:opacity-90"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hidden px-2 py-1 font-mono text-[12px] uppercase tracking-wider text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-ink)] md:inline-block"
    >
      {children}
    </Link>
  );
}
