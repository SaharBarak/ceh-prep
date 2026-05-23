import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { NewsletterSubscriberModel } from "@/lib/db/models/newsletter";
import {
  DisplayNameForm,
  ChangePasswordForm,
  RevokeSessionsForm,
  MarketingFlagsForm,
} from "./forms";
import { DeleteAccountForm } from "./delete-account";

export const metadata: Metadata = {
  title: "Account settings — CEH Prep",
  description:
    "Manage your CEH Prep account: display name, password, email preferences, data export, and account deletion.",
};

export const dynamic = "force-dynamic";

/**
 * /account/settings — auth-gated self-service hub promised by /privacy.
 *
 * Five sections:
 *  1. Account     — email (read-only with verify status), display name, tier
 *  2. Security    — password change (in-session), revoke other sessions
 *  3. Email       — marketing opt-out flags, newsletter status
 *  4. Data        — export (GET /api/account/export), delete (POST /api/account/delete)
 *  5. Footer      — pointers to legal + transactional-email exception
 */
export default async function SettingsPage() {
  const { userId } = await requireSession();
  await connectDB();

  const me = await UserModel.findOne({ _id: { $eq: userId } })
    .select(
      "_id email displayName tier role createdAt emailVerifiedAt marketingOptOut marketingNudgeOptOut timezone",
    )
    .lean<{
      _id: { toString(): string };
      email: string;
      displayName?: string;
      tier?: string;
      role?: string;
      createdAt?: Date;
      emailVerifiedAt?: Date | null;
      marketingOptOut?: boolean;
      marketingNudgeOptOut?: boolean;
      timezone?: string;
    } | null>();

  // Defensive — requireSession() guarantees a user exists, but the lean
  // query could in principle return null if the row was deleted between
  // session validation and this read. Treat that the same as unauth.
  if (!me) {
    return (
      <div className="mx-auto max-w-[68ch] p-10">
        <p className="text-sm text-[var(--color-ink-dim)]">
          Your account no longer exists.{" "}
          <Link href="/" className="underline">
            Return home →
          </Link>
        </p>
      </div>
    );
  }

  const newsletter = await NewsletterSubscriberModel.findOne({ email: me.email })
    .select("status confirmedAt unsubscribedAt")
    .lean<{
      status?: "pending" | "confirmed" | "unsubscribed";
      confirmedAt?: Date | null;
      unsubscribedAt?: Date | null;
    } | null>();

  return (
    <article className="mx-auto max-w-[68ch] space-y-14 px-6 py-12 text-[var(--color-ink-dim)] md:px-10">
      <header className="border-b border-[var(--color-line)] pb-8">
        <p className="mono-tag mb-3">Account</p>
        <h1 className="display text-4xl text-[var(--color-ink)] md:text-5xl">
          Settings
        </h1>
        <p className="mt-4 text-sm">
          Your account, security, email preferences, and data — all in one
          place.{" "}
          <Link href="/dashboard" className="underline">
            ← back to dashboard
          </Link>
        </p>
      </header>

      {/* ─────────────── Account ─────────────── */}
      <Section
        title="Account"
        description="Identity and tier. Email is what we send transactional and (if opted in) marketing email to."
      >
        <Row label="Email">
          <span className="font-mono text-sm text-[var(--color-ink)]">
            {me.email}
          </span>
          {me.emailVerifiedAt ? (
            <Badge tone="ok">verified</Badge>
          ) : (
            <Badge tone="warn">unverified</Badge>
          )}
        </Row>
        <Row label="Tier">
          <span className="font-mono text-sm uppercase tracking-wider text-[var(--color-ink)]">
            {me.tier ?? "free"}
          </span>
          {(me.tier ?? "free") === "free" && (
            <Link href="/pricing" className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent)] underline">
              upgrade →
            </Link>
          )}
        </Row>
        <Row label="Joined">
          <span className="font-mono text-xs text-[var(--color-ink-faint)]">
            {me.createdAt
              ? new Date(me.createdAt).toISOString().slice(0, 10)
              : "—"}
          </span>
        </Row>
        <Row label="Timezone">
          <span className="font-mono text-xs text-[var(--color-ink-faint)]">
            {me.timezone ?? "UTC"}
          </span>
        </Row>
        <div className="pt-4">
          <DisplayNameForm initialValue={me.displayName ?? ""} />
        </div>
      </Section>

      {/* ─────────────── Security ─────────────── */}
      <Section
        title="Security"
        description="Password and active sessions. Changing your password signs out every other device."
      >
        <ChangePasswordForm />
        <div className="border-t border-[var(--color-line)] pt-6">
          <RevokeSessionsForm />
        </div>
        <p className="pt-4 text-[11px] text-[var(--color-ink-faint)]">
          Forgot your current password?{" "}
          <Link href="/forgot-password" className="underline">
            Reset via email →
          </Link>
        </p>
      </Section>

      {/* ─────────────── Email ─────────────── */}
      <Section
        title="Email preferences"
        description="What we may send you, beyond the always-on transactional messages (verify, password reset, billing receipts)."
      >
        <MarketingFlagsForm
          marketingOptOut={me.marketingOptOut ?? false}
          marketingNudgeOptOut={me.marketingNudgeOptOut ?? false}
        />
        <div className="mt-6 border-t border-[var(--color-line)] pt-6">
          <p className="mono-tag mb-2">Newsletter</p>
          {newsletter ? (
            <NewsletterStatus
              status={newsletter.status ?? "pending"}
              confirmedAt={newsletter.confirmedAt ?? null}
              unsubscribedAt={newsletter.unsubscribedAt ?? null}
            />
          ) : (
            <p className="text-sm">
              You&apos;re not subscribed to the public newsletter. The footer
              signup on the homepage adds you with a double-opt-in confirmation
              email.
            </p>
          )}
        </div>
      </Section>

      {/* ─────────────── Data ─────────────── */}
      <Section
        title="Your data"
        description="GDPR-promised export and delete endpoints. Both are also accessible directly via the API for scripted use."
      >
        <div className="space-y-3">
          <p className="text-sm">
            Download a JSON archive of everything we hold for you: account,
            progress, email history, audit log, and newsletter status.
          </p>
          <a
            href="/api/account/export"
            className="btn-primary inline-flex items-center gap-2 text-xs"
            download
          >
            Export my data ↓
          </a>
        </div>
        <div className="mt-8 border-t border-red-500/20 pt-6">
          <p className="mono-tag mb-3 text-red-300">Danger zone</p>
          <DeleteAccountForm />
        </div>
      </Section>

      <footer className="border-t border-[var(--color-line)] pt-8 text-xs text-[var(--color-ink-faint)]">
        <p>
          Transactional email (verify, password reset, billing receipts)
          always flows — there is no opt-out for those because they protect
          your account. See the{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{" "}
          for the full data + retention contract.
        </p>
      </footer>
    </article>
  );
}

/* ─────────────────────────────
   Section + primitives
   ───────────────────────────── */

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-5">
    <div>
      <h2 className="display text-2xl text-[var(--color-ink)]">{title}</h2>
      <p className="mt-2 max-w-[58ch] text-sm">{description}</p>
    </div>
    <div className="space-y-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-7">
      {children}
    </div>
  </section>
);

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-3 last:border-b-0">
    <span className="mono-tag">{label}</span>
    <div className="flex items-center gap-3">{children}</div>
  </div>
);

const Badge = ({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) => (
  <span
    className={
      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
      (tone === "ok"
        ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 text-[var(--color-accent)]"
        : "border-amber-500/40 bg-amber-500/5 text-amber-300")
    }
  >
    {children}
  </span>
);

const NewsletterStatus = ({
  status,
  confirmedAt,
  unsubscribedAt,
}: {
  status: "pending" | "confirmed" | "unsubscribed";
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}) => {
  if (status === "confirmed") {
    return (
      <p className="text-sm">
        Subscribed since{" "}
        <span className="font-mono text-[var(--color-ink)]">
          {confirmedAt ? new Date(confirmedAt).toISOString().slice(0, 10) : "—"}
        </span>
        . Manage from any newsletter footer (one-click unsubscribe), or use
        the marketing opt-out above which covers all streams.
      </p>
    );
  }
  if (status === "pending") {
    return (
      <p className="text-sm">
        Pending — check your inbox for the confirmation link we sent. If it
        never arrived, sign up again from the homepage footer to re-trigger
        the email.
      </p>
    );
  }
  return (
    <p className="text-sm">
      Unsubscribed{" "}
      <span className="font-mono text-[var(--color-ink-faint)]">
        {unsubscribedAt
          ? new Date(unsubscribedAt).toISOString().slice(0, 10)
          : ""}
      </span>
      . To rejoin, sign up again from the homepage footer.
    </p>
  );
};
