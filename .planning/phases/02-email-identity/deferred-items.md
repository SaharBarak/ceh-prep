# Phase 02 — Deferred Items

Items discovered during execution that are out of scope for the current plan
and deferred per the GSD "scope boundary" rule.

## 02-03 (Resend + React Email templates)

### Pre-existing: next.js CVE floor (not caused by this plan)

- **Discovered:** 2026-04-14 during `npm install resend` — npm audit reports
  1 critical vulnerability in `next@15.2.3`.
- **Advisories:** GHSA-g5qg-72qw-gw5v, GHSA-xv57-4mr9-wg8v, GHSA-4342-x723-ch2f,
  GHSA-223j-4rm8-mrmf, GHSA-9qr9-h5gf-34mp, GHSA-w37m-7fhw-fmv9, GHSA-mwv6-3258-q52c,
  GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8,
  GHSA-q4gf-8mx6-v5v3
- **Why deferred:** This is tracked by STATE.md decision log:
  "CVE-2025-66478 (next.js) deferred to Phase 5. Locked floor at 15.2.3 per
  01-CONTEXT version-pin policy; mid-phase floor bump would break downstream
  01-03/01-05 contracts and needs fresh CVE research."
- **Action:** Pick up in Phase 5 production hardening (DEPLOY-01 plan).
  Bumping next mid-Phase-2 is explicitly out of scope and would force a new
  CVE research cycle.
