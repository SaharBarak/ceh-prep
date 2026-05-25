---
title: Hydra
slug: hydra
category: tools
summary: Hydra (thc-hydra) is an open-source online password brute-forcing tool that supports 50+ protocols — SSH, FTP, HTTP, SMB, RDP, MySQL, PostgreSQL, and more. It is the canonical tool for credential brute-force against live network services.
related: [hashcat, john-the-ripper, nmap, burp-suite]
aliases: [hydra, thc-hydra, THC-Hydra]
updated: 2026-05-25
---

**Hydra** (thc-hydra) is an open-source online password brute-forcing tool maintained by The Hacker's Choice (THC). It is the canonical tool for **online** credential brute-force — sending login attempts against a live network service — across 50+ protocols including SSH, FTP, HTTP (form + basic auth), SMB, RDP, MySQL, PostgreSQL, IMAP, SMTP, VNC, LDAP, and more.

"Online" here is the load-bearing distinction. [hashcat](/wiki/hashcat) and [John the Ripper](/wiki/john-the-ripper) are **offline** crackers — they consume a captured hash and try candidate passwords locally at billions per second. Hydra is **online** — it actually talks to the service, which means rate-limited (often 5-50 attempts per second per thread), generates logs, can trigger lockouts. Different tool, different tradeoffs.

## Why "online" matters

Offline cracking is cryptographic: candidate passwords run through the hash function locally. The bottleneck is your hardware's hash rate. The target doesn't notice.

Online cracking is operational: each attempt requires a TCP connection, a protocol handshake, an authentication request, a response, possibly disconnection. The bottleneck is the service's response time. The target absolutely notices — Hydra's signature is "many failed logins from one source IP in a short window."

This makes Hydra:

- **Slow.** 50 attempts/second is fast for online cracking; 50 billion is fast for offline.
- **Loud.** Every modern intrusion detection system and SOC monitoring stack flags this pattern.
- **Lockable.** Modern services lock accounts after N failures or rate-limit per-IP. Hydra fights against both.

Online brute-force as your initial-access strategy in 2026 mostly works against legacy services in poorly-monitored networks. Modern AD with strong-password + lockout policies + impossible-travel monitoring is a hard target.

## The command structure

A typical Hydra invocation:

```bash
hydra -l USERNAME -P passwords.txt PROTOCOL://TARGET[:PORT]
hydra -L users.txt -P passwords.txt PROTOCOL://TARGET[:PORT]
hydra -L users.txt -p PASSWORD PROTOCOL://TARGET[:PORT]
```

Lowercase `-l` / `-p` for a single value, uppercase `-L` / `-P` for a file. The protocol family at the end determines which Hydra module fires.

Common protocols + recipes:

```bash
# SSH brute-force
hydra -l admin -P rockyou.txt ssh://10.0.0.5

# SMB / Windows file share against an account list
hydra -L users.txt -P top100passwords.txt smb://10.0.0.5

# RDP — uses freerdp under the hood
hydra -l Administrator -P rockyou.txt rdp://10.0.0.5

# FTP
hydra -l ftpuser -P rockyou.txt ftp://10.0.0.5

# MySQL on a non-default port
hydra -l root -P rockyou.txt mysql://10.0.0.5:3307

# HTTP basic auth
hydra -l admin -P rockyou.txt http-get://10.0.0.5/admin

# HTTP form POST — the tricky one
hydra -l admin -P rockyou.txt 10.0.0.5 http-post-form \
  "/login:user=^USER^&pass=^PASS^:F=invalid"
```

## HTTP form login — the specific syntax

`http-post-form` is Hydra's most-used module and the one with the steepest learning curve:

```
"<PATH>:<POST_BODY>:<FAILURE_PATTERN>"
```

- **PATH** — URL path of the login form's POST endpoint (e.g. `/login`).
- **POST_BODY** — the form data with `^USER^` and `^PASS^` as placeholders.
- **FAILURE_PATTERN** — one of:
  - `F=text` — Hydra looks for this text in the response body to detect failure.
  - `S=text` — Hydra looks for this text to detect success.
  - `H=Cookie\: ...` — include a header on the request.

Example: a Wordpress admin login:

```bash
hydra -l admin -P rockyou.txt example.com http-post-form \
  "/wp-login.php:log=^USER^&pwd=^PASS^:invalid username"
```

The `invalid username` string is what Wordpress returns on failure. Hydra interprets any response *without* that text as success.

## Threading

`-t` controls concurrent threads (default 16). Higher = faster but louder; some services drop connections under high concurrency. A good starting point:

- SSH: `-t 4` (the default 16 trips most SSH `MaxStartups` settings).
- SMB / RDP: `-t 4 -W 1`.
- HTTP form: `-t 16-32` against tolerant servers; lower for fragile ones.

The `-W` (wait) flag inserts a delay between attempts — slower but less likely to trigger lockouts.

## Stopping conditions

`-f` (find one) stops Hydra as soon as one valid credential is found. Useful when you're brute-forcing many users and want the first hit.

`-e nsr` — null password, same as username, reverse of username. Cheap pre-checks before the wordlist.

## What modern defenses actually do

Hydra runs into:

| Defense | Effect |
|---|---|
| **Account lockout** after N failed attempts | The account becomes unusable, often before the password is found. |
| **Rate limiting per source IP** | Reduces effective rate; doesn't stop a distributed brute-force across many IPs. |
| **CAPTCHA after N failures** | Forces interactive solving; effectively stops automated tools. |
| **MFA** | Even a correct password isn't enough. The single most consequential brute-force mitigation. |
| **Impossible-travel monitoring** | "Alice's password came from Brazil 5 minutes after Spain" — flags attacker IPs. |
| **Web Application Firewall (WAF) signatures** | Detects Hydra's request patterns and blocks the source. |

The 2026 reality: brute-force as a primary initial-access vector is uncommon. Credential stuffing (replaying known username/password pairs from public leaks against the target) is more effective because the passwords are *already correct* somewhere — you just need one to be correct on this service too.

## When Hydra is the right tool

- **Internal pentest of legacy services.** Internet-isolated industrial controllers, on-prem MySQL admin pages, internal admin panels — frequently have weak passwords and no lockout.
- **Stress-testing your own defenses.** Confirm that your SSH brute-force protection (fail2ban, lockout policy, rate limit) actually works.
- **CTF / lab environments.** When the puzzle is explicitly "find these credentials."

Outside of those, modern offensive work uses:

- **Password spraying** — one password against many accounts (defeats lockout, since each account only sees one attempt). Tools: `kerbrute`, `crackmapexec`, `nxc`.
- **Credential stuffing** — known good credentials from leaks against the target. Defeats per-account lockout if the matching account exists.

## Further reading

- [thc-hydra GitHub](https://github.com/vanhauser-thc/thc-hydra).
- [Hydra manpage](https://man.archlinux.org/man/hydra.1.en).
- [Pentest book: Hydra usage](https://www.pentestpartners.com/security-blog/hydra-cheat-sheet/).
