---
title: John the Ripper
slug: john-the-ripper
category: tools
summary: John the Ripper (often "john") is a venerable open-source password cracker known for auto-detecting hash formats, supporting hundreds of algorithms, and acting as the canonical first-pass triage tool when you have a captured hash and need to identify what it is.
related: [hashcat, pass-the-hash, ntlm, kerberos]
aliases: [john, John, JtR]
updated: 2026-05-25
---

**John the Ripper** (commonly "john" or "JtR") is an open-source password cracker that has been the canonical Unix-derived password recovery tool since 1996. Authored by Solar Designer and maintained by the OpenWall project, John is best known for two things: **auto-detecting the hash format** of an input and supporting **hundreds of hash algorithms** out of the box.

The modern variant most operators use is **John the Ripper Jumbo** — the community-maintained build with broader algorithm support than the upstream OpenWall release.

## Where John fits in the cracking workflow

Modern offensive workflows use John for first-pass triage and [hashcat](/wiki/hashcat) for the heavy GPU cracking:

1. Capture a hash from somewhere (LSASS, /etc/shadow, application database, captured handshake).
2. Run `john --format=auto hash.txt` or `john --list=formats` to identify the algorithm.
3. Either:
   - Let John continue cracking (CPU, fast for small inputs and incremental modes).
   - Convert the hash format and switch to hashcat for GPU-accelerated cracking against bigger wordlists.

John is faster than hashcat for *small* jobs (no GPU warm-up overhead), better at hash-format detection, and weaker for large GPU-amenable workloads.

## Hash format auto-detection

The killer feature. You have a `hash.txt` and don't know what it is. John can guess:

```bash
john --format=auto hash.txt
# Or, more explicit:
john --list=formats | head
john --test --format=raw-md5
```

The `--show` flag retrieves any already-cracked passwords:

```bash
john --show hash.txt
```

## Format adapters: `unshadow`, `pdf2john`, `zip2john`, etc.

John ships dozens of format adapters that convert files into the hash strings John consumes:

```bash
# Combine /etc/passwd and /etc/shadow into a john-readable form
unshadow /etc/passwd /etc/shadow > merged.txt
john merged.txt

# Extract the hash from a password-protected ZIP
zip2john locked.zip > zip.hash
john zip.hash

# Extract the hash from a password-protected PDF
pdf2john locked.pdf > pdf.hash
john pdf.hash

# Extract a hash from an encrypted SSH private key
ssh2john id_rsa > sshkey.hash
john sshkey.hash

# Extract a Kerberos TGS hash for offline cracking
john --format=krb5tgs --wordlist=rockyou.txt krb.hash
```

The format adapters are the reason John remains in every analyst's toolbox — they're the fastest path from "I found this encrypted file" to "here's the cracking input."

## Attack modes

John's mode taxonomy:

| Mode | What it does |
|---|---|
| **Single crack** | Default first pass — derive candidates from the username and GECOS field. Catches `username=alice, password=alice123`. |
| **Wordlist** | `john --wordlist=rockyou.txt hash.txt`. Standard dictionary attack. |
| **Wordlist + rules** | `john --wordlist=rockyou.txt --rules hash.txt`. Apply mutation rules to each wordlist entry. |
| **Incremental** | Brute-force, but with Markov-chain weighting from observed password distributions. Smarter than uniform brute-force. |
| **Mask** | `john --mask=?u?l?l?l?d?d --max-length=6 hash.txt`. Constraints-based brute-force, like hashcat's mask mode. |
| **External** | Custom C-like scripted candidate generator. Rarely used. |

The default if you run `john hash.txt` with no flags: single mode first, then wordlist (with `password.lst` from John's distribution), then incremental.

## Rules — same idea as hashcat

John's rule files use a slightly different syntax than hashcat's but the concept is identical: each rule mutates a wordlist entry. The default rule set is in `/etc/john/john.conf` (Debian) or `$JOHN/run/john.conf`.

Common rules:

- `$1` — append `1`.
- `c` — capitalize.
- `r` — reverse.
- `sa@` — substitute `a` with `@`.
- `Az"123"` — append `123`.

```bash
john --wordlist=rockyou.txt --rules=Jumbo hash.txt
```

The `Jumbo` rule set is the most comprehensive bundled with John Jumbo.

## Specific use cases

**Cracking shadow files:**

```bash
unshadow /etc/passwd /etc/shadow > merged.txt
john merged.txt
john --show merged.txt
```

**Cracking Kerberos ([AS-REP](/wiki/as-rep-roasting) or [TGS](/wiki/kerberoasting)) hashes:**

```bash
john --format=krb5asrep --wordlist=rockyou.txt asrep.hash
john --format=krb5tgs --wordlist=rockyou.txt tgs.hash
```

**Cracking NTLM hashes:**

```bash
john --format=nt --wordlist=rockyou.txt ntlm.hash
```

**Cracking NetNTLMv2 ([Responder](/wiki/ntlm) capture):**

```bash
john --format=netntlmv2 --wordlist=rockyou.txt v2.hash
```

## Status indicators during a run

While John is running, press a key to see status:

- `q` or `Ctrl+C` — quit (state saved to `john.pot` and `.rec`).
- Any other key — print current candidate rate, ETA, and the current candidate range.

Resume an interrupted run:

```bash
john --restore
```

The `.pot` file (defaults to `john.pot` or `$JOHN/run/john.pot`) accumulates cracked hashes across runs. Subsequent runs skip the already-known.

## The honest tradeoff vs hashcat

For *most* serious offline cracking in 2026, hashcat is the right tool — its GPU acceleration is 10-100x faster on the algorithms both support.

John's residual value is:

- **Auto-detection** when you don't know the hash format.
- **Format adapters** (zip2john, pdf2john, ssh2john, etc.) that hashcat doesn't ship equivalents for.
- **Single-mode** username-derived guessing — surprisingly effective on real corporate password dumps.
- **Incremental** Markov-weighted brute-force on smaller character spaces.
- **CPU-only environments** (older lab boxes, server-side scripted runs without GPU access).

The mature workflow: john for triage, hashcat for the long run.

## Further reading

- [John the Ripper documentation (openwall)](https://www.openwall.com/john/doc/).
- [John the Ripper Jumbo GitHub](https://github.com/openwall/john).
- [John the Ripper cheatsheet (OpenSecurityTraining2)](https://opensecuritytraining.info/IntroductionToReverseEngineering.html).
