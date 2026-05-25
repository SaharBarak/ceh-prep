---
title: Phishing
slug: phishing
category: attacks
summary: Phishing is a social-engineering attack where an attacker impersonates a trusted entity to deceive a target into revealing credentials, clicking a malicious link, or executing attacker-controlled code. It remains the most common initial-access vector across nearly every public threat report.
related: [ransomware, mitre-attck, owasp-top-10, dns, soc-analyst]
aliases: [Phishing, Phish, Spear Phishing, Whaling]
updated: 2026-05-25
---

**Phishing** is a social-engineering attack where the attacker impersonates a trusted entity — a coworker, vendor, IT helpdesk, bank, government agency — to deceive a target into revealing credentials, clicking a malicious link, downloading malware, or executing attacker-controlled code. It is the single most common initial-access vector in public threat reports (FBI IC3, Verizon DBIR, CrowdStrike Global Threat Report) and the [MITRE ATT&CK](/wiki/mitre-attck) tactic **T1566 Phishing** appears in nearly every modern intrusion writeup.

## The taxonomy

Phishing splits by *targeting* and *channel*:

| Term | What distinguishes it |
|---|---|
| **Phishing** (mass) | One template, many recipients. Low success rate per send, scales via volume. |
| **Spear phishing** | One target, hand-crafted. References real coworkers, real projects, real internal jargon. High success rate. |
| **Whaling** | Spear phishing where the target is a senior executive (CEO, CFO). |
| **Smishing** | Phishing over SMS. Common in financial / banking impersonation. |
| **Vishing** | Phishing by phone call. Often used to bypass MFA — call the victim, pretend to be IT, ask them to read out the MFA code. |
| **Quishing** | Phishing via QR codes. Modern variant — the QR-encoded URL evades email-link scanners. |
| **BEC** (Business Email Compromise) | Impersonate an executive or vendor to redirect a wire transfer or change banking details. Usually no malware; pure social engineering. |
| **Clone phishing** | Resend a legitimate email the target previously received, swapping the link/attachment for a malicious one. |

## The five stages of a phishing attack

```
  1. Reconnaissance    →  Target identification, role mapping, recent-events research
  2. Lure creation     →  Template, infrastructure (domain, hosting, SSL cert)
  3. Delivery          →  Send via email / SMS / call / QR
  4. Click + harvest   →  Victim clicks; lands on credential page / executes payload
  5. Action            →  Use harvested creds / detonate malware / pivot
```

The reconnaissance step uses [OSINT](/wiki/active-directory) sources: LinkedIn (org chart, recent changes), the target's website (vendor relationships, recent press releases), data-breach archives (does this email match a known leak?). The lure references real names, real projects, real deadlines.

## Common modern lure types

The patterns SOC analysts see weekly:

| Lure | What it looks like |
|---|---|
| **MFA push fatigue** | Repeated MFA push notifications to a target whose password is already stolen. Eventually the target taps "approve" out of confusion. |
| **Fake Microsoft 365 / Google login** | Branded credential page on a typosquatted domain (`microsft0nIine.com`, `accountsg00gle.com`). Pixel-perfect clone. |
| **"Voicemail received" attachment** | HTML attachment claiming to be a Microsoft Teams voicemail; opening loads a fake login. |
| **Vendor invoice payment redirect** | Email impersonating a known vendor with new banking details. Pure BEC. |
| **DocuSign / Adobe Sign abuse** | Legitimate-looking signature request from compromised DocuSign account → the actual link is to a credential page. |
| **Conditional Access bypass** | Real Microsoft login flow + Adversary-in-the-Middle proxy (evilginx2, modlishka) capturing both password and session cookie, bypassing MFA. |
| **Calendar invite phishing** | The lure is a meeting invite — Outlook auto-renders it, includes a malicious link. |

## Why phishing still works

Common reasons defender-side investments fail:

1. **The "look closely at the URL" advice has hit its ceiling.** Modern typosquatted domains use Unicode lookalikes (`microsоft.com` with a Cyrillic `о`). Asking users to spot this is asking too much.

2. **MFA is bypassable.** AiTM phishing tools (evilginx2, EvilProxy) proxy the entire authentication flow including the MFA step, capturing session cookies the user genuinely typed into. Knowing your password and MFA secret isn't enough — the attacker has *your authenticated session*.

3. **Brand impersonation is improving.** Modern LLMs draft impeccably written, contextually accurate spear phishes at scale. The "Nigerian prince" tells of poor grammar are gone.

4. **The attack surface scales with employee count.** A 5,000-person company gets thousands of phishing attempts a month. The defender has to catch *all* of them; the attacker needs *one* click.

## Defense — the modern stack

| Control | What it does | What it doesn't do |
|---|---|---|
| **DMARC** + DKIM + SPF | Authenticates the sender domain. Stops easy domain-spoofing. | Doesn't stop look-alike domains (typosquats). |
| **Email security gateway** | Reputation, content analysis, link rewriting, attachment sandboxing. | Bypassed by HTML smuggling, QR codes, vendor compromise. |
| **Phishing-resistant MFA** (FIDO2 / WebAuthn / hardware keys) | Binds the auth flow to the actual domain — phishing site can't proxy because the browser refuses to sign for the wrong domain. | Bypassed only by malware on the endpoint, not by phishing. |
| **Conditional Access policies** | Restrict logins by IP geography, device compliance, risk score. | Doesn't catch all AiTM, but raises the bar. |
| **User awareness training** | Improves marginal click rates. | Diminishing returns; even trained users click 1-3% of the time. |
| **Phishing simulations** | Identify high-click users, measure program effectiveness. | Easy to game; user behavior in real attacks differs from simulation. |
| **Endpoint Detection and Response (EDR)** | Catches the post-click stage (malware execution, credential exfil). | Doesn't prevent credential phishing where there's no payload to detect. |

**Phishing-resistant MFA is the single highest-ROI control.** A FIDO2 hardware key + WebAuthn flow makes the attacker's job 10x harder because the browser-bound origin check defeats every AiTM proxy.

## Phishing as a tool — red-team perspective

Phishing simulations and red-team engagements use the same techniques as real attackers:

- **GoPhish** — open-source phishing campaign framework (free; campaigns + tracking + landing pages).
- **King Phisher** — similar to GoPhish, modular.
- **Evilginx2** — AiTM phishing toolkit; proxies the real authentication flow.
- **Modlishka** — competing AiTM tool.
- **PhishingFrenzy** — older but still in use.

A red-team phishing engagement is usually scoped to:

- Specific employee groups (not the whole company).
- Clear authorization for click+credential capture.
- Stop-conditions before lateral movement.
- Debrief + remediation roadmap.

## Real-world examples

- **Twitter (July 2020)** — vishing attack on Twitter support staff led to internal-tool access; resulted in the Bitcoin scam tweets from verified accounts.
- **Microsoft 365 BEC waves (ongoing)** — vendor invoice redirect schemes routinely net six- to seven-figure wire transfers.
- **2022 Okta breach** — initial access via phishing of a Sitel support engineer, then leveraging Okta tooling access for downstream compromise.
- **Sandworm / APT28 / APT29** — every major nation-state group has phishing as a documented standard initial-access technique.

## Further reading

- [Verizon Data Breach Investigations Report (annual)](https://www.verizon.com/business/resources/reports/dbir/) — the canonical "what's actually happening" reference.
- [PhishTank](https://phishtank.com/) — community-submitted live phishing URLs.
- [APWG (Anti-Phishing Working Group)](https://apwg.org/) — quarterly trends reports.
- [Krebs on Security](https://krebsonsecurity.com/) — accessible writeups on current phishing campaigns and tradecraft.
