---
title: Content Security Policy
slug: content-security-policy
category: defenses
summary: Content Security Policy (CSP) is an HTTP response header that lets a web application instruct the browser which content sources it should trust. Configured correctly, CSP is the most effective defense against Cross-Site Scripting attacks.
related: [cross-site-scripting, csrf, tls, owasp-top-10, hsts, waf]
aliases: [CSP, Content-Security-Policy, HTTP CSP Header]
updated: 2026-05-25
---

**Content Security Policy** (CSP) is an HTTP response header that lets a web application instruct the browser which sources of scripts, styles, images, fonts, frames, and other resources it should trust on a given page. Configured correctly, CSP is the single most effective defense against [Cross-Site Scripting](/wiki/cross-site-scripting) (XSS) — it blocks inline scripts and external scripts from sources not on the allowlist, defeating the canonical XSS payload delivery patterns.

CSP is a defense-in-depth control. Output encoding remains the primary XSS prevention, but a well-configured CSP turns most XSS findings from "full session takeover" into "the payload was blocked by browser CSP enforcement."

## The header

CSP is delivered as the `Content-Security-Policy` HTTP response header (or a `<meta http-equiv="Content-Security-Policy">` tag in HTML). The value is a list of directives:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-RANDOM' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; report-to /csp-report;
```

Each directive specifies allowed sources for a particular content type:

| Directive | Controls |
|---|---|
| `default-src` | Fallback for any directive not explicitly set. |
| `script-src` | JavaScript sources. The XSS-load-bearing directive. |
| `style-src` | CSS sources. |
| `img-src` | Image sources. |
| `connect-src` | Sources for `fetch()`, XMLHttpRequest, WebSocket, EventSource. |
| `font-src` | Web font sources. |
| `frame-src` | `<iframe>` sources. |
| `frame-ancestors` | Who can embed *this* page in a frame. The modern replacement for `X-Frame-Options`. |
| `form-action` | Where forms can `action` to. |
| `base-uri` | Sources for the `<base>` tag's `href`. |
| `object-src` | `<object>`, `<embed>`, `<applet>` sources. Modern best practice: `'none'`. |
| `report-uri` / `report-to` | Where to POST violation reports for monitoring. |

The source list per directive can include:

- `'self'` — same origin as the document.
- `'none'` — block everything for this directive.
- `'unsafe-inline'` — allow inline scripts/styles. Defeats most CSP value; avoid for `script-src`.
- `'unsafe-eval'` — allow `eval()` and `new Function()`. Defeats CSP value; avoid.
- `https://cdn.example.com` — specific hostname.
- `data:` — `data:` URIs (often needed for images).
- `'nonce-RANDOM'` — a per-response random value; matching inline scripts execute.
- `'sha256-HASH'` — a hash of an inline script's content; that exact content executes.
- `'strict-dynamic'` — modern alternative; combined with `'nonce-X'`, allows transitively-loaded scripts.

## The strict CSP pattern (recommended)

The current Google + OWASP recommendation:

```
Content-Security-Policy:
  script-src 'nonce-RANDOM' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
  report-to /csp-report;
```

What it does:

- **`script-src 'nonce-RANDOM'`** — only `<script nonce="RANDOM">` tags execute, where `RANDOM` is the per-response server-generated nonce. Attacker-injected `<script>` tags without the nonce don't execute. The nonce changes on every response so the attacker can't capture it once and reuse.

- **`'strict-dynamic'`** — once a nonce-allowed script runs, scripts *it* loads transitively also execute. This solves the bundling problem (your main.js loads chunk1.js loads chunk2.js — they don't all need nonces).

- **`object-src 'none'`** — kills `<object>`/`<embed>`/Flash. Modern apps don't need them.

- **`base-uri 'none'`** — defends against `<base>`-tag injection attacks that re-base relative URLs.

- **`require-trusted-types-for 'script'`** — opt into the Trusted Types API, which enforces that `innerHTML`-style sinks only receive policy-validated strings. Heavy lift to deploy but powerful.

This pattern requires no allowlist of hostnames — it's nonce-driven. Allowlists are notoriously hard to maintain (every new CDN you adopt, every new third-party JS) and frequently contain hostnames that allow XSS (`*.googleapis.com` includes plenty of user-content surfaces).

## Common CSP mistakes

The recurring patterns that defeat CSP:

| Mistake | Effect |
|---|---|
| **`'unsafe-inline'` in script-src** | Inline `<script>` tags execute. Defeats most CSP value. |
| **`'unsafe-eval'` in script-src** | `eval()` works. Many older frameworks need this, but modern apps mostly don't. |
| **Overly broad allowlist hostnames** | `*.cloudfront.net` lets every Cloudfront-hosted asset run as a script — including any attacker-controlled bucket. |
| **JSONP endpoints in the allowlist** | A JSONP endpoint returns attacker-controlled JavaScript wrapped in a function call. If it's in `script-src`, it's an XSS bypass. |
| **`base-uri` left at default** | `<base>` injection lets the attacker re-base relative script URLs to an attacker-controlled origin. |
| **Static nonce or hash** | If the nonce doesn't rotate per response, the attacker can lift it once and reuse. |
| **Forgotten subdomain takeover** | An allowlisted subdomain that's no longer claimed → attacker registers it, hosts arbitrary JS. |

## CSP reporting

CSP violations can be reported via the `report-uri` (legacy) or `report-to` (modern) directives. The browser POSTs a JSON blob describing each violation to the specified endpoint:

```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "violated-directive": "script-src",
    "blocked-uri": "https://evil.tld/payload.js",
    "source-file": "https://example.com/page",
    "line-number": 42
  }
}
```

Wire the reports into your monitoring stack. Real-world workflow:

- Deploy CSP in **report-only mode** (`Content-Security-Policy-Report-Only`) first.
- Watch violation reports for legitimate-but-blocked content sources.
- Add legitimate sources to the policy.
- Once reports show only attacks, switch to enforcing mode.
- Monitor permanently — every violation report is potentially an XSS attempt.

## What CSP can't do

- **It's a browser-side control.** A determined attacker doesn't need a browser — direct API calls bypass CSP entirely. CSP defends user-visible XSS, not backend exploitation.
- **It doesn't prevent the *bug*.** A reflected XSS is still in the application. CSP just prevents the *exploitation*. Fix the bug; CSP is the fallback.
- **It can break legitimate functionality.** Aggressive CSP deployments routinely break analytics, embedded widgets, A/B test snippets. Deploy carefully.
- **`unsafe-inline` is sometimes unavoidable.** Some legacy frameworks (older Angular, older WordPress themes) generate inline scripts unconditionally. They need rework before strict CSP is possible.

## Related headers worth setting alongside

CSP is one of several security headers. The full modern set:

| Header | Purpose |
|---|---|
| `Content-Security-Policy` | This. |
| `Strict-Transport-Security` (HSTS) | Force HTTPS. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limit Referer leakage. |
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing-based attacks. |
| `Permissions-Policy` | Restrict access to powerful browser APIs (camera, geolocation, etc.). |
| `Cross-Origin-Opener-Policy: same-origin` | Isolate the window from cross-origin opener access. |
| `Cross-Origin-Embedder-Policy: require-corp` | Required for some browser features (SharedArrayBuffer). |

`securityheaders.com` is a free site that grades the headers any URL returns.

## Further reading

- [CSP3 specification (W3C)](https://www.w3.org/TR/CSP3/).
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/) — paste your CSP, get a strength assessment.
- [MDN Content Security Policy reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).
