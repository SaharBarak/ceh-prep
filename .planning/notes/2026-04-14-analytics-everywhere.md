---
date: "2026-04-14 16:30"
promoted: true
---

**DECISION LOCKED 2026-04-14:** GA4 (client-side product analytics) + Prometheus (server-side ops metrics). User explicitly consented to GA4 after CLAUDE.md third-party-consent check. Folded into Phase 5 as ANALYTICS-01..06.

---

**Original note:** analytics-everywhere: add metrics + events on every user-facing action (signup, login, verify click, day-open, question-answer, exam-start/finish, paywall-view, checkout-click, upgrade). Include dashboard funnel view + domain-level analytics per user. Respect Do-Not-Track header, respect CSP nonce rules from Phase 4, no tracking pixels in emails.

**Split:**
- **GA4 client-side** — page views, funnel events, button clicks, exam-start/finish. Loaded via `next/script` with `strategy="afterInteractive"` + CSP nonce. gtag events fire through a typed wrapper so every call site is discoverable. Respects DNT.
- **Prometheus server-side** — `prom-client` instrumentation: http_request_duration_seconds histogram, auth_attempts_total counter (signup/login/verify/reset, keyed by outcome), rate_limit_hits_total counter, mongo_query_duration_seconds histogram. Exposed at `/api/metrics` behind a bearer-token gate (env var), not public. Scraped by Grafana Cloud or Hetzner Prometheus node.
