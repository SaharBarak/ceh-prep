---
title: Cross-Site Request Forgery
slug: csrf
category: attacks
summary: Cross-Site Request Forgery (CSRF) is a web vulnerability where an attacker tricks a logged-in user's browser into submitting a state-changing request to a target site, abusing the browser's automatic credential attachment.
related: [cross-site-scripting, sql-injection, jwt, owasp-top-10]
aliases: [CSRF, XSRF, Cross-Site Request Forgery, Session Riding]
updated: 2026-05-24
---

**Cross-Site Request Forgery** (CSRF, sometimes XSRF) is a web vulnerability where an attacker causes a victim's browser to send an authenticated state-changing request to a target site that trusts the victim's session. The browser attaches the victim's cookies automatically; the target site can't tell the request came from a third-party page.

## How it works

The classic example: a bank's transfer endpoint accepts `POST /transfer?to=bob&amount=100`. A logged-in user visits an attacker's blog. The page contains:

```html
<img src="https://bank.example/transfer?to=attacker&amount=10000">
```

The browser fetches the image, attaching the victim's bank cookie. The bank processes the transfer. The image fails to load (the response isn't an image), but the side effect — the transfer — already happened.

The bug is that the bank's endpoint relied on cookie-based authentication for state-changing requests. The browser doesn't ask "did this request come from the bank's page?" before attaching cookies.

## CSRF vs XSS

CSRF and [XSS](/wiki/cross-site-scripting) are often confused:

- **XSS** runs attacker-controlled code *inside* the target site's origin. The attacker reads responses and can do anything the victim could.
- **CSRF** runs attacker code on a *different* origin. The attacker triggers requests but can't read the responses (Same-Origin Policy blocks that).

CSRF is therefore weaker than XSS — but it's enough for one-shot state changes (transfer money, change email, delete account, enable a feature).

## Mitigation

Modern defense composes three layers:

1. **`SameSite` cookie attribute** — `SameSite=Lax` (default in modern browsers) blocks cookie attachment on cross-site `POST` requests. `SameSite=Strict` blocks even cross-site top-level `GET` navigations. The single biggest CSRF reduction in the last decade — most modern browsers default to `Lax`.

2. **CSRF token (synchronizer pattern)** — the server includes a random, per-session token in every form. The state-changing endpoint requires it. An attacker's cross-origin page can't read it (Same-Origin Policy), so they can't include it in their forged request. Frameworks (Django, Rails, Spring) ship this by default.

3. **Origin / Referer header check** — for AJAX `POST` requests, validate that the `Origin` (or `Referer`) header matches the server's expected origin. The browser sets these and the cross-site page can't override them. This works without per-form tokens but requires careful handling of legitimate cross-origin POSTs.

## What about `X-Requested-With`?

A legacy defense: requiring `X-Requested-With: XMLHttpRequest` because cross-origin pages couldn't send custom headers without a CORS preflight. With modern CORS, this is no longer a reliable defense on its own — it should not be the only check.

## CSRF on JSON endpoints

If an endpoint accepts `Content-Type: application/json`, a cross-origin page can't submit JSON without triggering a CORS preflight. This used to be a free defense.

But: forms with `enctype="text/plain"` can construct JSON-looking bodies that some lenient parsers accept. The reliable defense is still the same — `SameSite` + CSRF tokens + Origin checks — applied uniformly to every state-changing endpoint.

## Detection

CSRF doesn't surface as a stack trace or an error — it's a missing control. Audit looks like:

- **Inventory state-changing endpoints.** Anything that creates, updates, or deletes data.
- **Check each for `SameSite` cookie attribute.**
- **Check each for a CSRF token or Origin header validation.**
- **Send a forged cross-origin request and watch for the action firing.** Burp's CSRF PoC generator automates this.

## Real-world examples

- **GitHub (2008)** — early CSRF on email-change endpoints; led to account takeover via password-reset via attacker-controlled email.
- **PayPal (multiple)** — historical CSRF bounty findings on settings-change endpoints.
- **WordPress** — CSRF in plugin-update endpoints has been a recurring 2015-2023 finding class.

## Further reading

- [PortSwigger Web Security Academy: CSRF](https://portswigger.net/web-security/csrf) — interactive labs.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [SameSite cookie attribute (web.dev)](https://web.dev/articles/samesite-cookies-explained).
