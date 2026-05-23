---
session_handoff: true
last_session_ended: 2026-05-23
git_head: 93c9b3a
working_tree: clean
build: green
typecheck: green
tests: 8/8 passing
---

# Continue here — fresh session pickup

Read `.planning/HANDOFF.json` for the structured state. This file is the
narrative companion — what's done, what's next, where to start.

## Where we are

Phase 12 (Testing + LLM Quality Review) is **complete**. The product is
ready for production wiring. Everything below the homepage marketing layer
is built; what remains is mostly production go-live mechanics + credibility
closure + SEO.

This session shipped 13 commits across five workstreams:
1. **Phase 12 Track B complete** — ICP simulation harness + 3 QA reports +
   nightly cron workflow. 6 persona-visits across runs: 1 `would_convert`
   (Marcus), 5 `would_consider`, 0 bail. Two real product bugs caught and
   fixed by the harness during run 3 (`/bonus` auth gate, placeholder titles).
2. **Landing → Homepage transformation** — top nav, mature voice, motion
   pass, all QA-validated load-bearing copy preserved.
3. **GA4 + cookie consent + newsletter** — analytics gated by user grant,
   double-opt-in marketing list separate from product drip, full
   purpose-namespaced HMAC token discipline.
4. **Phase 11 (winback + streak) + Phase 4 (Paddle billing)** — both shipped
   end-to-end. Paddle config is all-or-none guarded; if half-set the page
   falls back to honest "Phase 4" copy.
5. **Legal pages (privacy + terms) + /about + Track A starter** — privacy
   promises GDPR endpoints that **don't yet exist** (see open task #11).

## What to do first in the next session

**Highest priority — credibility gap:** the privacy policy at `/privacy`
explicitly promises `GET /api/account/export` and `POST /api/account/delete`.
Both currently return 404. Anyone reviewing the privacy policy (Paddle deep
merchant review, GDPR auditor, careful user) will hit these.

```
Task #11 — Account self-service
  Files to create:
    app/src/app/api/account/export/route.ts
    app/src/app/api/account/delete/route.ts
    app/src/app/(app)/account/settings/page.tsx
  Pattern to follow:
    Use requireSession() at the top
    Use existing models: UserModel, ProgressModel, EmailDispatchModel,
      NewsletterSubscriberModel, AuditModel
    Hard-delete cascade order matters — User last (it's the FK source)
    Audit log: per /privacy spec, retain 12mo even after delete
  Tests:
    vitest test for delete-idempotency (running delete twice doesn't blow up)
    vitest test for export shape stability (JSON contract)
  Estimated effort: 2-3 hours
```

After that, two more sprints from open_tasks:
- **#12 — SEO basics** (OG images via Next 15 `ImageResponse`, sitemap.ts,
  robots.ts, Schema.org Course + Article structured data). All small
  mechanical files. ~1-2 hours.
- **#13 — Verify marketing promises** (audit Day 14 simulator UI,
  day-completion submission, WebVM drill-pass postMessage). Investigation
  first; fix any regressions found. ~1-2 hours.

## Production go-live checklist

Separate from open_tasks — these are real-world setup steps, not code:

1. **Vercel env vars** (production project):
   - `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — your GA4 property
   - `RESEND_AUDIENCE_ID` — newsletter audience
   - `PADDLE_API_KEY` + `PADDLE_WEBHOOK_SECRET` + `PADDLE_PRO_PRICE_ID` +
     `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (+ optionally
     `NEXT_PUBLIC_PADDLE_ENV=production`)
   - `SESSION_SECRET` / `CRON_SECRET` / `UNSUB_SECRET` — fresh 32+ char
     randoms, NOT the dev defaults
   - `MONGO_URI` — Atlas connection string
   - `RESEND_API_KEY` + `RESEND_FROM_ADDRESS` — production sender domain
2. **GitHub Actions secrets**:
   - `ANTHROPIC_API_KEY` — unblocks the nightly QA cron
3. **Paddle dashboard**:
   - Configure webhook URL: `https://<deploy>/api/paddle/webhook`
   - Submit `/privacy` + `/terms` URLs for merchant approval
4. **Resend dashboard**:
   - Verify sender domain (SPF/DKIM/DMARC DNS records)
   - Create newsletter audience, copy ID into env

## How the codebase is shaped

Patterns that future work should follow:

- **Purpose-namespaced HMAC tokens** — `app/src/lib/infra/resend/newsletter-token.ts`.
  Purpose prefix inside the signed payload prevents cross-token reuse.
- **Soft-optional env with isConfigured() gate** — Paddle quartet, GA4 ID,
  Resend audience ID. App boots + renders honest copy when feature half-set.
- **Consent-gated third-party scripts** — `GA4Script` reads `readConsent()`
  reactively via `onConsentChange`. Pattern reusable for Hotjar, Intercom,
  etc.
- **Declarative event wrappers** — `TrackClick` / `TrackOnMount` in
  `app/src/components/track.tsx`. Never pass raw strings to `track()`; add
  to `EVENTS` enum in `app/src/lib/analytics/ga4.ts`.
- **Memoized perpetual motion** — Every continuous animation
  (`BreathingDot`, `BreathingIcon`, `BlinkCaret`, `ScrollProgress`) is
  `React.memo`'d and CSS-keyframe-based where possible. Hardware-accelerated
  only (transform + opacity). `prefers-reduced-motion` collapses all loops
  to static.
- **Stagger orchestration** — `StaggerGrid` / `StaggerList` wraps
  server-rendered children that use `StaggerItem`. Parent + items in same
  client tree per Framer's requirement.
- **Idempotent dispatch ledger** — `EmailDispatch` unique-index on
  `(userId, kind, day, articleSlug)`. Every send tries insert first;
  duplicate-key means already-sent. Protects drip + winback + streak from
  retry storms.

## QA harness methodology rules (baked in)

- **5-capture spec** for any screenshot-based QA: 4 viewport (hero / 0.33 /
  0.66 / footer) + 1 fullpage. Run 1 found a 3-capture method missed an
  entire mock-terminal section.
- **Numeric findings need source cross-reference.** Vision misreads small
  grey monospace numerals — across 3 runs we documented misreads of "4" as
  "x"/"a", "80%" as "60%"/"80%", and "OSINT engines" as "33967 engines".
  Any number an agent quotes should be grep-verified against the rendered
  HTML before being promoted to a "copy bug" finding.
- **Persona pool rotation** — 5 ICPs, 3 visit per nightly run.
  `app/scripts/qa/personas.json` is the source. Sarah/Alex/Priya covered the
  bonus-library auth bug catch in run 1+3; Marcus/Dave covered the funnel
  conversion path in run 2+3.

## Open files / state at session end

Working tree is clean. All 13 session commits pushed to `origin/main`. No
WIP. No half-committed work. CI is green (typecheck + vitest + build).

If you want to verify, run:
```
cd app
npm run typecheck    # green
npm test             # 8/8 passing
npm run build        # green
```

The dev server may have been left running from the previous session — kill
with `pkill -f "next dev"` if needed.

## What this session deliberately did NOT do

- **Real production go-live** — codebase is ready; env vars + Paddle
  submission + Resend domain verification are real-world steps not done
  here.
- **Full Track A coverage** — shipped a starter (Vitest + 8 HMAC tests + CI
  workflow). Expansion (MSW + supertest + Playwright E2E + mongodb-memory-server
  for cron tests) is deferred.
- **Observability** — Sentry, cron heartbeat, bounce webhook handler all
  deferred. Currently failures `console.warn`.
- **Account self-service** — DEFERRED to next session because (a) it's the
  highest-priority remaining task and (b) it needs full context to do right.
  Privacy policy promises both endpoints. Half-broken implementation is
  worse than current 404. See open_task #11.

## Quick orientation commands

```bash
# Project structure
ls app/src/                    # app/, components/, lib/, test/
ls app/src/app/                # routes (auth, app, api, pricing, about, etc.)
ls app/src/lib/                # actions, auth, billing, content, db, infra, etc.

# Recent commits
git log --oneline -15

# Current QA reports
ls .planning/qa-reports/

# Open tasks
cat .planning/HANDOFF.json | jq '.open_tasks[] | {id,priority,subject}'
```

Good luck.
