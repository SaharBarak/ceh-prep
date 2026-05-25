---
title: hashcat
slug: hashcat
category: tools
summary: hashcat is the world's fastest password recovery tool, supporting over 300 hash algorithms and GPU-accelerated cracking. It is the canonical offline password cracker — used by red teams to crack captured hashes from LSASS, NTDS.dit, Kerberos tickets, and password databases.
related: [pass-the-hash, kerberoasting, ntlm, mimikatz, john-the-ripper]
aliases: [hashcat, oclHashcat]
updated: 2026-05-25
---

**hashcat** is the world's fastest password recovery tool. Open-source, GPU-accelerated, supporting 300+ hash algorithms, and built around the workflow of "you have a hash; you want the plaintext." It is the canonical offline password cracker in red-team work — captured hashes from [LSASS](/wiki/mimikatz), NTDS.dit, [Kerberos](/wiki/kerberos) tickets, NetNTLMv1/v2 captures, application password databases — all flow through hashcat for cracking.

Created by Jens "atom" Steube; first release 2009.

## Why GPU matters

CPU cracking is bottlenecked by core count (~8-32 threads per modern consumer CPU). GPU cracking parallelizes across thousands of cores: a single RTX 4090 hits ~250 billion MD5 hashes per second, ~5 billion bcrypt iterations per second of effective work. hashcat exploits this by:

- **Massively parallel hash computation.** Tens of thousands of candidate passwords hashed per second per GPU core.
- **Optimized algorithms.** Hash-function-specific kernels, hand-tuned for each GPU architecture.
- **Hash format-specific shortcuts.** For example, MD5's lack of avalanche between input bytes lets hashcat use markov-chain attacks that wouldn't apply to bcrypt.

For algorithms designed to resist this — bcrypt, [Argon2](/wiki/active-directory), scrypt — GPU acceleration is much smaller but still meaningful.

## Hash modes (the `-m` flag)

Every hash format has a numeric `-m` code. The ones you'll hit most often:

| Mode | Format | Where captured |
|---|---|---|
| **0** | MD5 | Application databases, web app password tables. |
| **100** | SHA-1 | Older applications. |
| **1000** | NTLM (Windows NT hash) | LSASS / SAM / NTDS.dit (via `secretsdump.py`, Mimikatz). |
| **1100** | Domain Cached Credentials (MSCash) | Cached domain logon credentials on a workstation. |
| **1800** | Linux SHA-512 crypt | `/etc/shadow` on modern Linux. |
| **5500** | NetNTLMv1 | [Responder](/wiki/ntlm) capture from a v1-allowing client. |
| **5600** | NetNTLMv2 | Responder capture from a v2-only client. The 2025 standard capture path. |
| **13100** | Kerberos 5 TGS-REP (etype 23) | [Kerberoasting](/wiki/kerberoasting) — TGS for an SPN-bound account. |
| **18200** | Kerberos 5 AS-REP (etype 23) | AS-REP roasting — accounts with `Do not require Kerberos preauthentication`. |
| **22000** | WPA-PBKDF2-PMKID+EAPOL | WiFi handshake captures (modern format). |
| **16500** | JWT (HMAC-SHA256) | Captured JWTs with weak HMAC secrets. |
| **3200** | bcrypt | Application databases (Django, Rails defaults). |

`hashcat --help | grep ALGO_NAME` finds the mode for any algorithm.

## Attack modes (the `-a` flag)

| Mode | Name | What it does |
|---|---|---|
| **0** | Straight | Try each password from a wordlist. |
| **1** | Combination | Concatenate words from two wordlists (every pair). |
| **3** | Brute-force / mask | Iterate a character mask (`?l?l?l?l` = four lowercase letters). |
| **6** | Hybrid wordlist + mask | Each word from wordlist + every brute-force suffix. |
| **7** | Hybrid mask + wordlist | Every brute-force prefix + each word. |
| **9** | Association | Use known plaintext to guess related hashes (useful for password reuse). |

Straight-mode attacks (`-a 0` with rockyou.txt) crack 80%+ of weak passwords in seconds. Mask attacks (`-a 3 ?u?l?l?l?l?l?d?d`) are the right tool when you know a password policy (one uppercase, five lowercase, two digits).

## Rules — the multiplier

`-a 0 --rules-file` applies *rules* to each wordlist entry, multiplying the candidate space. A rule is a small mutation: `$1` (append `1`), `c` (capitalize), `r` (reverse), `sa@` (substitute `a` → `@`).

The default rule sets:

- `best64.rule` — small set, fast, catches most "Password" → "Password1" / "p@ssw0rd" variations.
- `OneRuleToRuleThemAll.rule` — community-maintained; ~52,000 rules. Strong "first pass" for unknown captures.
- `dive.rule` — exhaustive; runs for hours but catches almost everything in a meaningful timeframe.

Rule-based attacks are the right balance: take a small wordlist + a big rule set, get the candidate space of a much larger wordlist without the disk-IO cost.

## Common workflows

**Cracking a captured NTLMv2 handshake (Responder on the wire):**

```bash
hashcat -m 5600 capture.hash /usr/share/wordlists/rockyou.txt --rules-file /usr/share/hashcat/rules/best64.rule
```

**Cracking a Kerberos TGS hash (Kerberoasting workflow):**

```bash
GetUserSPNs.py contoso.local/user:pass -dc-ip 10.0.0.10 -request -outputfile krb.hash
hashcat -m 13100 krb.hash /usr/share/wordlists/rockyou.txt --rules-file best64.rule
```

**Cracking a Linux shadow file:**

```bash
unshadow /etc/passwd /etc/shadow > to_crack.txt
hashcat -m 1800 to_crack.txt /usr/share/wordlists/rockyou.txt
```

**Targeted mask attack with known policy (8-char, uppercase + lowercase + digit):**

```bash
hashcat -m 1000 ntlm.hash -a 3 ?u?l?l?l?l?l?d?d
```

## Performance — the `--benchmark`

```bash
hashcat -b
```

Runs hashcat against every supported mode and prints H/s (hashes per second). Useful for capacity planning: "is this 10-character wpa-pbkdf2 worth cracking?" requires a quick mental math against your rig's hashrate.

## Defensive value

Defenders should run hashcat against their own [NTDS.dit](/wiki/active-directory) extracts to identify weak service-account passwords *before* an attacker does:

```bash
# Extract domain hashes from a DC (one-time, on a controlled host)
secretsdump.py -just-dc-ntlm 'DOMAIN/admin@dc.contoso.local' -outputfile dump

# Crack against a top-100k password list, see what wins
hashcat -m 1000 dump.ntds /usr/share/wordlists/top100k.txt --rules-file best64.rule
```

Any password that drops in under an hour is an actionable finding — schedule a password reset for that account before an attacker captures the hash.

## hashcat vs john the ripper

| | hashcat | [John the Ripper](/wiki/john-the-ripper) |
|---|---|---|
| Primary acceleration | GPU | CPU (GPU support in `john --format=...,opencl` is weaker) |
| Mode set | 300+ | Smaller, more focused |
| Configuration | Command-line flags | Config files + command-line |
| Strength | Raw speed against well-supported hashes | Quick triage, format auto-detection (`john --format=...`) |
| Workflow | "I know the format, crack it fast" | "I have a hash, what is it" |

In practice, modern operators use John for `john --format=auto` triage to identify the hash type, then hashcat for the actual cracking on a GPU rig.

## Further reading

- [hashcat website](https://hashcat.net/hashcat/) — wiki, docs, example hash table.
- [hashcat example hashes reference](https://hashcat.net/wiki/doku.php?id=example_hashes).
- [hashes.org wordlists archive](https://hashes.org/) — community-shared wordlists.
- [SecLists wordlist collection](https://github.com/danielmiessler/SecLists/tree/master/Passwords).
