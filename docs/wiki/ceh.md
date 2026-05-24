---
title: Certified Ethical Hacker
slug: ceh
category: certifications
summary: The Certified Ethical Hacker (CEH) is an entry-level cybersecurity certification awarded by EC-Council that covers offensive security fundamentals — reconnaissance, scanning, exploitation, system hacking, and post-exploitation techniques across web, network, wireless, mobile, and cloud surfaces.
related: [owasp-top-10, mitre-attck, nmap, burp-suite, active-directory]
aliases: [CEH, EC-Council CEH, CEH v13]
updated: 2026-05-24
---

The **Certified Ethical Hacker** (CEH) is an entry-level cybersecurity certification awarded by EC-Council. It covers offensive security fundamentals — reconnaissance, scanning, exploitation, system hacking, and post-exploitation techniques across web, network, wireless, mobile, and cloud surfaces.

CEH is among the most widely-recognized cybersecurity certifications by non-technical hiring managers (HR, recruiters, government roles), which is the main reason candidates pursue it. Its technical reputation in the practitioner community is more mixed — it's better than nothing as a vocabulary primer, but it doesn't approach the hands-on rigor of mid-tier certs like OffSec OSCP or TCM Security PNPT.

The current version is **CEH v13** (released 2024).

## Exam mechanics

- **125 multiple-choice questions.** Four answer options per question.
- **4 hours** total time.
- **70% passing score** on the most common exam form (the threshold can vary by form — EC-Council uses dynamic scoring).
- **Computer-based** via Pearson VUE testing centers or remote proctoring.
- **~$1,199** for the voucher alone. Bundles with iLabs / official training run $1,899-$2,500+.

A second exam, **CEH Practical**, is hands-on lab-based (20 challenges, 6 hours). Passing both grants the **CEH Master** designation.

## Domains (CEH v13 blueprint)

CEH v13 organizes its content into nine domains, with weights that approximate how the exam is distributed:

| # | Domain | Weight |
|---|---|---|
| 1 | Information Security and Ethical Hacking Overview | ~6% |
| 2 | Reconnaissance Techniques | ~21% |
| 3 | System Hacking Phases and Attack Techniques | ~17% |
| 4 | Network and Perimeter Hacking | ~14% |
| 5 | Web Application Hacking | ~16% |
| 6 | Wireless Network Hacking | ~6% |
| 7 | Mobile Platform, IoT, and OT Hacking | ~8% |
| 8 | Cloud Computing | ~6% |
| 9 | Cryptography | ~6% |

The exam typically distributes questions roughly per these weights. Pacing matters — at 125 questions in 4 hours, the average is ~115 seconds per question.

## What's new in v13

v13 added structured coverage of:

- **AI-augmented attacks.** Adversarial use of LLMs for phishing, code generation, paraphrase evasion.
- **Prompt injection.** Direct and indirect, as a distinct vulnerability class for LLM-integrated apps.
- **Cloud-native** — more focus on AWS / Azure / GCP-specific attack surfaces and IMDS.
- **OT / ICS** — Modbus, SCADA, the ransomware-on-OT angle.

## Common preparation paths

Candidates typically combine:

1. **Official EC-Council courseware** (CEH Official Courseware + iLabs) — included in the higher-tier voucher bundles. ~40 hours of video + lab access. Many candidates skim it.
2. **Practice exam banks** — **Boson ExSim-Max for CEH** (~$99) is the gold standard. Most alumni cite it as the single most predictive resource.
3. **Video courses on Udemy / Cybrary** — Hari Pukhrambam, Daniel Lowrie, and others. Less polished than EC-Council's own video but cheaper and often clearer.
4. **CEH-specific study aids** — like [CEH Prep](https://cehprep.dev) (this site), with focused lessons, explained quiz answers, and a timed exam simulator.

Typical time investment: 2-3 weeks for an experienced IT/security practitioner, 1-2 months for someone newer to security.

## Eligibility

EC-Council requires one of:

- **2 years of information security work experience** (and pay a $100 application fee), or
- **Complete an EC-Council-authorized training program** (which waives the experience requirement).

This eligibility check is part of why the "buy a Boson + Udemy course and self-study" path is unusual for CEH compared to other certs.

## Criticisms and what CEH does *not* cover

The most consistent practitioner critiques:

- **Multiple-choice, not hands-on.** Knowing that "Kerberoasting uses GetUserSPNs" isn't the same as having actually Kerberoasted a domain. The hands-on Practical exam addresses this somewhat.
- **Curriculum lags real tradecraft.** Modern offensive security — Active Directory attack chains, AD CS abuse, EDR evasion, C2 frameworks, LOLBin tradecraft — gets sparse coverage. v13's expansion helps but the gap remains.
- **Vendor framing.** EC-Council's "five phases of ethical hacking" is a teaching scaffold, not how real engagements actually unfold (which is iterative, not pipeline-shaped).

## Where CEH fits in a career path

A reasonable cybersecurity certification progression:

1. **Foundational:** CompTIA Security+ (broader, more defender-focused) **or** CEH (more offensive-flavored).
2. **Hands-on practical:** TCM PNPT, OffSec OSCP, HTB CDSA / CPTS.
3. **Specialized:** OffSec OSWE (web), OSEP (evasion), GIAC GPEN / GWAPT, AWS / Azure security specialist certs.
4. **Senior / managerial:** CISSP (broad governance), CCSP (cloud governance), SABSA / TOGAF (architecture).

CEH is widely recognized at the foundational tier — particularly in government, DoD-adjacent, and large-enterprise roles. It is not a substitute for OSCP / PNPT-level hands-on validation in technical interviews.

## Further reading

- [EC-Council CEH page](https://www.eccouncil.org/programs/certified-ethical-hacker-ceh/) (official).
- [Boson ExSim-Max for CEH](https://www.boson.com/practice-exam/312-50-ec-council-practice-exam) — the standard practice exam.
- [CEH Prep — 14-day v13 sprint](https://cehprep.dev) (this site).
