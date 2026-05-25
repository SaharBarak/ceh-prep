---
title: HTTP Strict Transport Security
slug: hsts
category: defenses
summary: HTTP Strict Transport Security (HSTS) is an HTTP response header that tells browsers to access a site only over HTTPS for a given duration. It closes the HTTPS-stripping window where a network attacker downgrades the first request from `http://` to a plaintext page.
related: [tls, content-security-policy, jwt, owasp-top-10]
aliases: [Strict-Transport-Security, HTTP Strict Transport Security Header]
updated: 2026-05-25
---

**HTTP Strict Transport Security** (HSTS) is an HTTP response header that tells the browser to access a site only over [TLS](/wiki/tls) — never plain HTTP — for a configured duration. It defends against SSL-stripping attacks where a network attacker downgrades the first request from `http://example.com` to a plaintext page they control. RFC 6797 defines the protocol.

Without HSTS, a user who types `example.com` in the address bar makes an initial HTTP request that an on-path attacker (rogue Wi-Fi, ISP, hostile state) can intercept and replace with a forged login page. HSTS instructs the browser to *never* issue that plaintext request once it has been seen once.

## The header

HSTS is delivered as the `Strict-Transport-Security` HTTP response header on HTTPS responses:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

| Directive | Effect |
|---|---|
| `max-age=<seconds>` | How long the browser remembers the HSTS policy. Two years (`63072000`) is the recommended value for preload eligibility. |
| `includeSubDomains` | Apply the policy to every subdomain. Required for preload eligibility. |
| `preload` | Opt into Chrome's preload list — browsers ship with the policy compiled in, so even the *first* request is HTTPS. |

The header is only honored on HTTPS responses — set over HTTP, it is silently ignored. This is intentional: a network attacker cannot set their own HSTS header for the victim.

## The preload list

Without preload, HSTS has a "trust on first use" weakness — the very first request to a site can still be HTTP. The Chrome preload list (consumed by Chrome, Firefox, Safari, Edge, and Tor Browser) closes that gap by shipping a hardcoded list of HSTS-enforcing domains with the browser.

Submit a domain at <https://hstspreload.org>. Requirements:

- Serve a valid HTTPS certificate.
- Redirect HTTP to HTTPS on the same host.
- Serve HSTS on the base domain with `max-age >= 31536000` (1 year), `includeSubDomains`, and `preload`.
- All subdomains must support HTTPS, even ones that previously only ran HTTP.

The submission is sticky. Removal is slow (weeks to months, propagating through browser releases), so a misconfigured preload submission can lock you out of subdomains that aren't HTTPS-ready.

## Deployment pitfalls

| Pitfall | What breaks |
|---|---|
| Subdomain without HTTPS | After preload, every browser refuses to connect to `legacy.example.com` if it's HTTP-only. |
| Self-signed cert on dev subdomain | Same — preload + invalid cert = unreachable for end users. |
| Short `max-age` deployed permanently | Cache invalidation problem: users with old policies still see the long policy until it expires. |
| Redirect from `http://` to non-canonical hostname | Browser caches HSTS for the *redirected* hostname, not the original. |
| Setting HSTS *before* migrating all subdomains | One unmigrated subdomain becomes a hard outage. |

The safe rollout pattern:

1. Migrate every subdomain to HTTPS.
2. Set `max-age=300; includeSubDomains` for a few hours to validate.
3. Step up to `max-age=86400` (1 day), watch for a week.
4. Step up to `max-age=31536000; includeSubDomains` (1 year).
5. Once stable, add `preload` and submit to the list.

## What HSTS does NOT protect

- **The first HTTP request before any HSTS header has been seen.** Preload closes this; without it, HSTS is trust-on-first-use.
- **Compromise of the certificate.** HSTS forces HTTPS but does not prevent a stolen private key from being used by an attacker who controls the network. See [HTTP Public Key Pinning](https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning) (now deprecated) and Certificate Transparency for that.
- **Phishing on a similar domain.** HSTS protects `example.com` but does nothing for `examp1e.com`.
- **Backend HTTP traffic.** HSTS is a browser policy. Internal API calls that ignore certificate validation are still vulnerable.

## Related security headers

HSTS is one of the standard modern security headers, alongside:

- [Content Security Policy](/wiki/content-security-policy) (`Content-Security-Policy`)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

Test the headers on any public URL at <https://securityheaders.com>.

## Further reading

- [RFC 6797 — HTTP Strict Transport Security](https://datatracker.ietf.org/doc/html/rfc6797).
- [MDN Strict-Transport-Security reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security).
- [hstspreload.org](https://hstspreload.org) — preload submission portal.
- [OWASP HSTS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html).
