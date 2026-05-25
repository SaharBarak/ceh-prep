---
title: PNPT
slug: pnpt
category: certifications
summary: The Practical Network Penetration Tester (PNPT) is a hands-on penetration testing certification from TCM Security, focused heavily on internal-network and Active Directory engagements. It is widely regarded as a more affordable, AD-focused alternative or complement to OSCP.
related: [oscp, ceh, security-plus, active-directory, bloodhound, pentester]
aliases: [PNPT, Practical Network Penetration Tester, TCM PNPT]
updated: 2026-05-25
---

The **PNPT** (Practical Network Penetration Tester) is a hands-on penetration testing certification from TCM Security, launched in 2021 by Heath Adams. It tests a candidate's ability to compromise a simulated client network through OSINT, external reconnaissance, exploitation, internal pivoting, [Active Directory](/wiki/active-directory) attacks, and final reporting — all over a 5-day practical exam followed by a debrief call.

The PNPT has carved out a distinct position in the certification landscape: more affordable than [OSCP](/wiki/oscp), more hands-on than [CEH](/wiki/ceh), and uniquely focused on the Active Directory attack patterns that make up the majority of real internal-network engagements. Many candidates take it as a complement to OSCP rather than a substitute.

## What's on the exam

A typical PNPT engagement requires:

| Phase | What's tested |
|---|---|
| **OSINT** | Identify the company, employees, technologies, exposed services. |
| **External recon and exploitation** | Find an internet-facing foothold — phishing payload, exposed service, weak credentials. |
| **Internal recon** | Map the AD environment from a foothold ([Nmap](/wiki/nmap), enumeration via [LDAP](/wiki/ldap), [BloodHound](/wiki/bloodhound)). |
| **AD exploitation** | [Kerberoasting](/wiki/kerberoasting), [AS-REP Roasting](/wiki/as-rep-roasting), [pass-the-hash](/wiki/pass-the-hash), credential dumping with [Mimikatz](/wiki/mimikatz). |
| **Privilege escalation** | Local or domain-level escalation as needed to reach the objective. |
| **Pivoting and lateral movement** | Demonstrate access to multiple systems and ultimately Domain Admin. |
| **Reporting** | Submit a written professional pentest report covering methodology, findings, evidence, remediation. |
| **Debrief** | Live video call with TCM staff walking through the report, defending the approach, answering questions. |

The debrief call is unusual among certifications — most exams end at the report submission. The PNPT requires you to explain your reasoning in real time, mirroring the post-engagement debriefs a real pentester delivers to clients.

## Exam logistics

| Item | Value |
|---|---|
| **Duration** | 5 days (lab access) + 2 days for report + scheduled debrief |
| **Format** | Practical: compromise a live network |
| **Resources allowed** | Open book; any public tool; community-supported chat off-limits |
| **Cost** | ~$400 USD (often bundled with TCM training courses) |
| **Validity** | 4 years; renewable via continuing education |
| **Prerequisites** | None — the four prerequisite courses are included with most purchase bundles |

The bundled courses (Practical Ethical Hacking, Linux Privilege Escalation, Windows Privilege Escalation, Open-source Intelligence) are the canonical prep path. They are also independently valuable training even if you don't pursue the cert.

## How it compares

| Cert | Focus | Difficulty | Cost | Hands-on? |
|---|---|---|---|---|
| **[Security+](/wiki/security-plus)** | Broad knowledge baseline | Low-mid | ~$390 | Limited PBQs |
| **[CEH](/wiki/ceh)** | Broad offensive knowledge | Low-mid | $1,200+ | Multiple-choice |
| **PNPT** | AD-focused real-world pentest | Mid | ~$400 | Fully hands-on |
| **[OSCP](/wiki/oscp)** | Broad pentest, mixed targets | Mid-high | $1,600+ | Fully hands-on |
| **OSEP** | Evasion, advanced AD | High | $2,000+ | Fully hands-on |

The PNPT shines as an affordable hands-on credential focused on AD — the area where many real pentest engagements live, and where many OSCP holders feel under-prepared from their study alone.

## Why it gained traction

Three factors:

1. **Realistic methodology.** The exam mirrors a real client engagement — OSINT through reporting and debrief — rather than a series of isolated CTF-style boxes.
2. **AD focus.** Active Directory is the single most common internal-engagement environment, and the PNPT covers it deeply. OSCP's AD coverage has expanded but is still less dominant.
3. **Pricing.** $400 vs OSCP's $1,600 makes it accessible to candidates funding their own certs.

It is *not* meant as a strict OSCP substitute. The two cover overlapping but distinct ground. Holding both signals strong hands-on capability across web, network, and AD.

## How a candidate prepares

The standard path:

1. **Complete the four TCM courses** included with the exam voucher.
2. **Build a home AD lab.** Two Windows Servers, a few workstations, a vulnerable user account population, [BloodHound](/wiki/bloodhound) installed.
3. **Practice on HackTheBox AD-focused boxes** — Active, Forest, Sauna, Mantis, etc.
4. **Take the exam** with a clear methodology — OSINT first, document as you go, take screenshots reflexively.
5. **Write the report alongside the exploitation** — don't try to reconstruct findings from memory at the end.

Common ways candidates fail:

- Treating it as a CTF (find flags) instead of an engagement (demonstrate impact, document repro, write a client-quality report).
- Bringing OSCP report-writing habits — the PNPT report bar is higher because it's the primary deliverable, not just exam proof.
- Skipping the OSINT phase and going straight to exploitation; the exam expects a complete methodology.

## Position in a career

PNPT pairs well with:

- **[Security+](/wiki/security-plus) → PNPT** as an affordable entry-to-mid offensive path.
- **[OSCP](/wiki/oscp) + PNPT** as a strong combined credential set.
- **CEH → PNPT** as a "now demonstrate you can actually do it" follow-up after CEH.

For an internal-network or AD-focused [pentester](/wiki/pentester) role, PNPT is a stronger signal than CEH at lower cost than OSCP.

## Further reading

- [TCM Security PNPT page](https://certifications.tcm-sec.com/pnpt/).
- [Heath Adams (The Cyber Mentor) YouTube channel](https://www.youtube.com/c/TheCyberMentor) — free training that previews the PNPT methodology.
- [Practical Ethical Hacking course](https://academy.tcm-sec.com/) — the canonical prep starting point.
