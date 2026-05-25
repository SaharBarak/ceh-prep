---
title: CompTIA Security+
slug: security-plus
category: certifications
summary: CompTIA Security+ (SY0-701) is an entry-level, vendor-neutral cybersecurity certification covering the foundational concepts and terminology of the field. It is the most commonly required certification for entry-level security roles in the United States, in large part due to its inclusion in DoD Directive 8570.
related: [ceh, oscp, soc-analyst, nist-csf, defense-in-depth]
aliases: [Security+, SecurityPlus, CompTIA Security Plus, SY0-701]
updated: 2026-05-25
---

**CompTIA Security+** (current exam: SY0-701, released November 2023) is an entry-level, vendor-neutral cybersecurity certification covering foundational concepts and terminology across the field. It is the most commonly required certification for entry-level security roles in the United States — partly because it is included in **DoD Directive 8570** as a baseline qualification for U.S. Department of Defense information assurance positions, which propagates through defense contractors and federal civilian agencies into the broader U.S. job market.

Security+ does not make you a security practitioner. It demonstrates that you know the terminology, can place a concept in the right category, and have a baseline that will let you understand more advanced material. The certification's value is *signaling-as-baseline*, not deep expertise.

## What it covers (SY0-701)

Five domains:

| Domain | Weight | Topics |
|---|---|---|
| **General Security Concepts** | 12% | CIA triad, control types, zero trust, change management, cryptography fundamentals |
| **Threats, Vulnerabilities, and Mitigations** | 22% | Threat actors, attack vectors, application/OS vulnerabilities, social engineering, malware, mitigation techniques |
| **Security Architecture** | 18% | Architecture models, cloud security, infrastructure resilience, data protection |
| **Security Operations** | 28% | Computing resources, asset management, vulnerability management, monitoring, identity and access, automation, IR, digital forensics |
| **Security Program Management and Oversight** | 20% | Governance, risk, third-party risk, audit, awareness training |

The Security Operations domain is the largest and most directly relevant to early-career work; in practice the test rewards breadth across all five.

## Exam format

| Item | Value |
|---|---|
| **Number of questions** | Up to 90 |
| **Question types** | Multiple-choice and **performance-based questions** (PBQs) — interactive simulations |
| **Duration** | 90 minutes |
| **Passing score** | 750 / 900 (~83%) |
| **Cost** | ~$392 USD (often less with academic / employer vouchers) |
| **Delivery** | Pearson VUE testing centers or online proctored |
| **Validity** | 3 years; renewable via CEUs or higher-level certs |

The PBQs make Security+ harder than other multiple-choice certs at the same level. A PBQ might ask you to drag firewall rules into the correct order, click on a network diagram to identify a vulnerability, or configure a simulated SIEM filter. They're worth more points individually and people who breeze through MCQ practice often underestimate them.

## Who actually takes it

| Audience | Why |
|---|---|
| **Career changers** | Cleanest single credential signaling "I'm serious about security." |
| **DoD / defense contractor employees** | DoD 8570 requirement for many IA roles. |
| **SOC analyst candidates** | Often listed as required or preferred. |
| **Helpdesk / sysadmins moving toward security** | Builds shared vocabulary with the security team. |
| **CS students** | Adjunct to a CS degree for job market visibility. |

It is not a useful credential for someone who already holds [OSCP](/wiki/oscp) or has 5+ years of practitioner experience. It targets the start of the curve.

## How it compares to peers

| Cert | Type | Level | Hands-on? |
|---|---|---|---|
| **Security+** | Vendor-neutral | Entry | No (PBQs simulate, but exam is knowledge-based) |
| **[CEH](/wiki/ceh)** | Vendor-neutral | Entry-to-mid | Multiple-choice; iLabs optional |
| **[OSCP](/wiki/oscp)** | Vendor-neutral | Mid | Hands-on 24-hour exam |
| **GSEC** | SANS | Entry-to-mid | No |
| **CySA+** | CompTIA | Mid (post-Security+) | Some PBQs |
| **CISSP** | (ISC)² | Senior | No; 5 years experience required to be fully certified |
| **PNPT** | TCM Security | Mid | Hands-on, AD-focused |

Security+ pairs naturally with later-stage certs: Security+ → CySA+ → CASP+ on the CompTIA path, or Security+ → CEH / PNPT / OSCP if pivoting to offensive.

## Study strategy

The cert is heavy on vocabulary. The standard prep pattern:

1. **Pick a primary resource.** Professor Messer's free YouTube playlist is the most-cited; Mike Chapple's Sybex book and Jason Dion's Udemy course are paid alternatives.
2. **Take practice exams** until you score 85%+ consistently. PBQ practice is critical — most resources are MCQ-heavy.
3. **Hands-on with a free lab.** Setting up a Windows VM, joining it to a free trial AD domain, running [Wireshark](/wiki/wireshark), poking around an Elastic stack — these make the concepts stick.
4. **Time-box.** Most candidates pass in 4-12 weeks of part-time study.

Common ways people fail:

- Memorizing acronyms without understanding what the underlying control does.
- Skipping the cryptography / hashing fundamentals because they're "math-heavy."
- Underestimating PBQs.

## What it does not certify

- It does not make you a [SOC Analyst](/wiki/soc-analyst). Companies that hire Security+ holders into SOC roles still expect them to learn the actual tools and detection logic on the job.
- It does not make you a [Pentester](/wiki/pentester). The offensive content is conceptual — "explain SQL injection," not "exploit this."
- It does not satisfy ongoing learning. The field moves; Security+ + CompTIA CEUs alone is a thin learning regime past year one.

## Renewal

Three-year cycle. Renewal options:

- **50 Continuing Education Units (CEUs)** — earned via training, conferences, publishing, certifications.
- **A higher-level CompTIA cert** (CySA+, CASP+, PenTest+) auto-renews Security+.
- **Other industry certs** (CISSP, OSCP) also satisfy renewal.

Most working practitioners earn CEUs naturally through ongoing training.

## Honest assessment

Security+ is a **floor**, not a ceiling. It opens doors at the entry level and gives you a vocabulary you can use to read advanced material. It is not a substitute for understanding what a [SIEM](/wiki/siem) actually outputs when [Mimikatz](/wiki/mimikatz) runs, or for the muscle memory of pivoting through an [Active Directory](/wiki/active-directory) environment.

If you have time for only one credential and you're entering the U.S. job market in security, Security+ is usually the right first move. If you're already mid-career, skip it.

## Further reading

- [CompTIA Security+ official exam objectives (SY0-701)](https://www.comptia.org/certifications/security).
- [Professor Messer's Security+ YouTube course](https://www.professormesser.com/) — free, comprehensive.
- [DoD 8570 / 8140 requirements](https://public.cyber.mil/cw/cwmp/dod-approved-8570-baseline-certifications/) — government context for the cert's popularity.
