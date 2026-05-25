---
title: CIA Triad
slug: cia-triad
category: concepts
summary: The CIA Triad is the foundational model of information security, defining three core properties that every security control aims to preserve — Confidentiality, Integrity, and Availability. Every security decision can be framed as a tradeoff between these three.
related: [owasp-top-10, cvss, tls]
aliases: [CIA, Confidentiality Integrity Availability, AIC Triad]
updated: 2026-05-25
---

The **CIA Triad** is the foundational model of information security. It defines three core properties that every security control aims to preserve:

- **Confidentiality** — only authorized parties can access information.
- **Integrity** — information has not been altered by unauthorized parties.
- **Availability** — information and systems are accessible to authorized parties when needed.

Almost every security control can be classified as primarily defending one (or more) of these three. The CIA Triad is the first concept taught in nearly every cybersecurity curriculum, certification (including [CEH](/wiki/ceh)), and threat-modeling workshop.

## The three legs

### Confidentiality

The property that information is disclosed only to those authorized to see it.

Concrete examples:

- **Encryption** — [TLS](/wiki/tls) protects data in transit; full-disk encryption protects data at rest. An attacker who captures the ciphertext can't read the plaintext.
- **Access controls** — file permissions, database row-level security, [OAuth 2.0](/wiki/oauth-2) scopes. Authorized identities can read; others can't.
- **Network segmentation** — sensitive systems are on isolated networks, unreachable from less-trusted ones.
- **Data classification** — marking documents as Public / Internal / Confidential / Restricted; enforcing handling rules per class.

Common violations:

- A misconfigured S3 bucket exposes internal documents to the internet.
- A SQL injection ([see SQL injection](/wiki/sql-injection)) lets an attacker dump every user's data.
- A stolen laptop with unencrypted disk gives the thief every cached document.

### Integrity

The property that information has not been modified, accidentally or maliciously, except by authorized parties.

Concrete examples:

- **Cryptographic hashing and signatures** — file hashes (SHA-256), code signing, [JWT](/wiki/jwt) HMAC signatures. Any unauthorized modification changes the hash.
- **Database constraints + audit logs** — foreign keys, triggers, write-ahead logs that record every change.
- **Version control** — Git's content-addressable storage means any tampering produces a different commit hash.
- **Immutable infrastructure** — servers are replaced rather than modified; the running configuration matches the declared configuration.

Common violations:

- An attacker modifies a financial-transaction record after authorization (a classic insider-threat scenario).
- A man-in-the-middle injects JavaScript into a non-HTTPS page.
- A backdoored software update modifies binaries (the SolarWinds 2020 supply-chain attack).
- A typo in a configuration file goes undetected for months.

### Availability

The property that information and systems are accessible to authorized parties when needed.

Concrete examples:

- **Redundancy** — multiple servers, multiple data centers, multiple internet uplinks.
- **Backups** — restorable copies of data when primary copies are lost. Critical for [ransomware](/wiki/ransomware) recovery.
- **Capacity planning** — enough headroom to handle peak loads without degradation.
- **DDoS protection** — CDN-level absorption of denial-of-service attacks.

Common violations:

- Ransomware encrypts production data; the business stops until restoration completes.
- A DDoS attack saturates the company's internet uplink.
- A database hardware failure with no failover leaves the application offline for hours.
- A misconfigured TLS certificate expires; every client connection fails.

## The triad in practice — tradeoffs

Most security work involves tradeoffs *between* the three properties:

- **Encryption (Confidentiality) vs Availability.** Strong encryption with poorly-managed keys means the data is unavailable if the key is lost. The 2017 Maersk ransomware incident effectively destroyed Confidentiality (data was exfiltrated) and Availability (systems were encrypted) simultaneously.

- **Integrity vs Availability.** A health-check that auto-replaces a "tampered" server might also auto-replace one with a transient log corruption. Aggressive Integrity defense can reduce Availability.

- **Confidentiality vs Integrity vs Availability**. Adding strict access controls (Confidentiality) sometimes blocks legitimate access patterns (Availability). Strict signature verification (Integrity) sometimes refuses legitimate but unusual files (Availability).

A defender's job is rarely "maximize one property" — it's "find the right tradeoff for this asset's risk profile." A public marketing website prioritizes Availability over Confidentiality (the data is public anyway). A medical record system prioritizes Confidentiality and Integrity over Availability. A trading system prioritizes Availability and Integrity over Confidentiality.

## Extensions and alternatives

Several frameworks extend or rephrase the triad:

- **AIC** — same three letters, different order. Identical concept.

- **Parkerian Hexad** — adds three more properties beyond CIA:
  - **Possession or Control** — who physically has the data.
  - **Authenticity** — does this claim about identity actually match reality?
  - **Utility** — is the data usable for its intended purpose? (Distinct from Availability — a key without the corresponding cipher is "available" but not "useful.")
  
  The Parkerian Hexad is more comprehensive but rarely used in practice; CIA remains the lingua franca.

- **STRIDE** — Microsoft's threat-model taxonomy:
  - Spoofing → violates Authenticity (a subset of Integrity).
  - Tampering → violates Integrity.
  - Repudiation → violates accountability.
  - Information Disclosure → violates Confidentiality.
  - Denial of Service → violates Availability.
  - Elevation of Privilege → violates authorization.

  STRIDE is more useful for *threat modeling* — given a system, what threats apply? The CIA Triad is more useful for *high-level framing* — what property is this control defending?

## Where CIA is the right vocabulary

- **Risk assessments.** When evaluating a vulnerability's impact, asking "what does this affect — Confidentiality, Integrity, Availability, or some combination?" structures the conversation. [CVSS](/wiki/cvss)'s C/I/A scoring metrics are literally this.

- **Compliance frameworks.** Many regulations are organized around CIA properties — for example, HIPAA's Security Rule has explicit Confidentiality, Integrity, and Availability subsections.

- **Threat-model framings.** When explaining a vulnerability to stakeholders, naming which property is at risk anchors the conversation.

## Where CIA isn't enough

- **Authenticity, accountability, non-repudiation.** Important properties that CIA doesn't quite capture. Use Parkerian or STRIDE when these matter.

- **Privacy.** Confidentiality + Integrity together approach privacy, but privacy also involves data minimization (don't collect what you don't need), purpose limitation (don't use data for purposes outside the consent), and individual rights (access, deletion, portability) that CIA doesn't speak to.

- **Resilience.** A more recent concept emphasizing that systems should *continue functioning* under adverse conditions, not just defend against discrete attacks. Availability is the closest CIA property but doesn't quite capture the dynamic-recovery aspect.

## Further reading

- [NIST SP 800-12 (Introduction to Information Security)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-12r1.pdf) — covers CIA in the canonical NIST framing.
- [Parkerian Hexad (Donn B. Parker, "Toward a New Framework for Information Security")](https://en.wikipedia.org/wiki/Parkerian_Hexad).
- [STRIDE threat-model methodology (Microsoft)](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats).
