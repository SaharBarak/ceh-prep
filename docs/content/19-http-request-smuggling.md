## 19 — HTTP Request Smuggling: CL.TE, TE.CL, and the modern web's load-bearing bug class

- **Source:** Original — the single most consequential web class since 2019, per the red-team review of the CEH curriculum. CEH v13 doesn't ask about it; bug bounty triage and real engagement work routinely do.
- **Author:** [@SaharBarak](https://github.com/SaharBarak) (CEH Prep)
- **Curriculum mapping:** **CEH v13 Day 09 — Hacking Web Servers & Web Apps** (extension) · post-cert track
- **GitHub repos:**
  - [`portswigger/turbo-intruder`](https://github.com/PortSwigger/turbo-intruder) — Burp extension; the canonical way to fire timed smuggling payloads
  - [`anshumanbh/smuggler`](https://github.com/defparam/smuggler) — Defparam's CLI fuzzer for HRS detection
  - [`PortSwigger Web Security Academy: HTTP request smuggling`](https://portswigger.net/web-security/request-smuggling) — free interactive labs; the standard intro
- **External references:**
  - James Kettle's original 2019 BlackHat talk ([slides](https://portswigger.net/research/http-desync-attacks-request-smuggling-reborn), [video](https://www.youtube.com/watch?v=w-eJM2Pc0KI))
  - Kettle's 2022 follow-up ("HTTP/2 desync") — the modern variant on HTTP/2 frontends

---

## What this article exists for

CEH's web module is OWASP-Top-10-shaped: SQLi, XSS, CSRF, SSRF, IDOR, file upload. None of those are HTTP Request Smuggling. HRS doesn't fit the Top 10 framing because it isn't an injection into application logic — it's an *interpretation disagreement* between two HTTP-speaking proxies.

It's also the single web bug class most likely to land a six-figure bounty between 2019 and now. Every major bug bounty payout from 2020-2024 with "auth bypass" or "request hijack" in the title has been some HRS variant. If you do bug bounty seriously, you need this.

---

## The core idea

A request's *length* on the wire is communicated two ways:

1. **`Content-Length: N`** — explicit byte count
2. **`Transfer-Encoding: chunked`** — read chunks until a zero-sized one ends the body

Per spec, when *both* are present, `Transfer-Encoding` wins and `Content-Length` is ignored. But two HTTP servers in a chain (a CDN/load-balancer in front, an app server behind) sometimes *disagree* on this:

- The front server uses `Content-Length`; the back uses `Transfer-Encoding`. → **CL.TE smuggling.**
- The front uses `Transfer-Encoding`; the back uses `Content-Length`. → **TE.CL smuggling.**
- Both use `Transfer-Encoding` but parse the header differently (obfuscated variants). → **TE.TE smuggling.**

When they disagree, the back server *parses past* what the front thought was one request. Bytes the attacker controls end up at the front of the *next* user's request. That's the smuggle.

---

## A concrete CL.TE example

The wire payload:

```
POST / HTTP/1.1
Host: target.example
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

- Front (CL): reads 13 bytes of body → consumes `0\r\n\r\nSMUGGLED`. Forwards the whole thing.
- Back (TE): reads chunked → sees `0` → declares the body finished. The remaining `SMUGGLED` is treated as the start of the *next* request on the same connection.

The next user's request gets *prefixed* with the attacker's `SMUGGLED` bytes. If `SMUGGLED` is a request like `GET /admin HTTP/1.1\r\nHost: target\r\n\r\n`, the victim's session is now hitting `/admin` on their behalf.

The flavors of impact:

- **Auth bypass** — smuggle past internal routing rules ("`/admin` is blocked at edge but allowed behind").
- **Cache poisoning** — the smuggled response gets cached by the front against the victim's URL.
- **Credential capture** — smuggle a request whose response is sent back to the next caller, including their cookies in the `Referer` of the smuggled body.
- **Web cache deception** — chain HRS with caching rules to surface authenticated content on public-cache paths.

---

## Detection — what to look for

You can't easily detect HRS from black-box scanning the way SQLi tools detect injection. The reliable detection is **differential timing**:

```python
# Pseudocode of the standard HRS detection probe
send_baseline()        # normal POST, time T1
send_cl_te_variant()   # CL.TE-shaped POST, time T2
# If T2 > T1 + ~5s, the back server is hanging waiting for more chunked
# data while the front already sent everything → CL.TE positive.
```

PortSwigger's `smuggler.py` (Defparam) automates this with all the common header variants. Turbo Intruder (Burp extension) fires them at scale.

**The reliable indicator** in a hand-test:

1. Send a normal `Content-Length: N` request, note the response time.
2. Send the same request with both `Content-Length: N` and `Transfer-Encoding: chunked` headers, with a `0\r\n\r\n` body terminator before the actual content. If the response *hangs*, you've created a desync.

---

## Why this isn't a CVE — it's a class

HRS isn't bound to a specific HTTP parser. Every major proxy has shipped multiple HRS-vulnerable releases:

- Nginx had at least 3 HRS-related CVEs between 2019 and 2024.
- AWS ELB / ALB shipped a major CL.TE in 2019.
- Akamai/Cloudflare/Fastly all had findings in the same window.
- Spring Boot's embedded Tomcat had a TE.CL variant in 2021.

The bug isn't "this server has a parser flaw." The bug is "the standard for HTTP/1.1 ambiguity-resolution was specified loosely enough that two compliant servers disagree." HTTP/2 was supposed to fix this; Kettle's 2022 talk showed how HTTP/2-to-HTTP/1 downgrades reintroduce it.

---

## Where to practice

- **PortSwigger Web Security Academy: HTTP request smuggling** — free, browser-only, the canonical learning track. 14 labs, escalating difficulty. You should do all of them in one weekend.
- **HackTheBox "Acute"** — retired box with an HRS chain.
- **Real bounty programs that pay HRS** — most major ones (Bugcrowd, HackerOne) classify HRS as P1. Don't go live until you've finished PortSwigger.

---

## Mitigation (for the defender mindset)

- **Reject ambiguous requests.** Modern proxies have flags to refuse requests with both `Content-Length` and `Transfer-Encoding`. Enable them.
- **Front-back consistency.** The front and back servers should use the *same* HTTP parser. Modern CDN/origin combos are usually fine; bespoke proxy chains are the dangerous ones.
- **HTTP/2-only end-to-end.** Eliminates the HTTP/1 ambiguity surface, but introduces HTTP/2-specific desync surfaces (per Kettle's 2022 talk). Defense-in-depth still wins.

---

## The honest framing

You will not be asked about HTTP request smuggling on the CEH v13 exam. You will absolutely be asked about it on any senior web-app or bug-bounty interview, and it will appear on every advanced web pentest. If you're trying to clear CEH and move toward bug bounty, this is the article whose content you'll use longer than half the curriculum proper.
