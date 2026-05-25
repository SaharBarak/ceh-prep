---
title: OSCP
slug: oscp
category: certifications
summary: The Offensive Security Certified Professional (OSCP) is a hands-on penetration testing certification from OffSec. It requires passing a 24-hour practical exam against a live network — compromising multiple machines and writing a professional report — and is the most widely-required certification for technical penetration-testing roles.
related: [ceh, pnpt, active-directory, bloodhound, metasploit]
aliases: [OSCP, PEN-200, OSCP+, Offensive Security Certified Professional]
updated: 2026-05-25
---

The **Offensive Security Certified Professional** (OSCP) is a hands-on penetration testing certification awarded by **OffSec** (formerly Offensive Security). It is widely regarded as the most respected entry-to-mid-level offensive-security certification because of its **24-hour practical exam against live machines** — the candidate must actually compromise the targets, not answer multiple-choice questions about how it could theoretically be done.

The associated training course is **PEN-200** (formerly PWK — "Penetration Testing with Kali Linux"). In late 2024 OffSec introduced **OSCP+**, a versioned reissue of the OSCP credential that expires after three years — an attempt to address the criticism that older OSCPs reflected out-of-date skill sets.

OSCP sits one tier above [CEH](/wiki/ceh) in practical rigor and is often required (rather than preferred) on technical pentest job descriptions.

## The exam

The OSCP exam is the certification's defining feature:

- **24 hours of hands-on testing**, followed by **24 hours to write a report**.
- A simulated network of 5-6 machines (the configuration changes periodically).
- Required to compromise an **Active Directory set** (3 machines linked by AD authentication chains — initial access, lateral movement, Domain Admin) and additional **standalone machines**.
- **Pass threshold**: 70 points out of ~100. Each compromised machine awards points (10 for root/SYSTEM, sometimes partial credit for user shells, AD set awards points as a group).
- **Proctored remotely** with webcam + screen monitoring. No second monitor; no outside resources.

The report — submitted within 24 hours of the exam — must include reproducible steps for every compromise, screenshots of proof-of-access (specific files in specific locations), and is graded as part of the pass/fail determination. A perfect exam with a poor report still fails.

## What you actually do during 24 hours

The typical successful candidate's day:

```
  Hour 0-2     Enumeration. Nmap all targets, banner-grab, identify services.
  Hour 2-6     First standalone machine — find a CVE or misconfig, exploit, escalate.
  Hour 6-12    AD initial-access machine. This is where most people lose time.
  Hour 12-18   AD lateral movement + Domain Admin.
  Hour 18-22   Remaining standalone machines. Sleep deprivation kicks in.
  Hour 22-24   Triple-check screenshots. Verify proof.txt files are captured. Don't panic.
```

The exam rewards methodical enumeration over exploit creativity. Most candidates who fail describe "spent 6 hours on a rabbit hole" — chasing one promising lead while neglecting the systematic checklist of other services to test.

## The lab + course (PEN-200)

The course material itself is approximately 1,000 pages of PDF content plus video lectures. Topics:

- Linux + Windows command-line fluency.
- Network scanning ([Nmap](/wiki/nmap), service enumeration).
- Web app attacks (SQLi, XSS, file upload, IDOR, simple LFI/RFI).
- Buffer overflow basics (historically a load-bearing exam topic; reduced in 2023 update).
- Privilege escalation on Linux + Windows.
- [Active Directory](/wiki/active-directory) attack chains — [Kerberoasting](/wiki/kerberoasting), [AS-REP roasting](/wiki/as-rep-roasting), [Pass-the-Hash](/wiki/pass-the-hash), constrained delegation.
- Client-side exploitation (Office macros, browser-side attacks).
- [Metasploit](/wiki/metasploit) basics (with deliberately limited use in the exam — see below).
- Report writing.

The labs accompany the course — 75+ practice machines and 6 dedicated AD sets, accessible over VPN. Most candidates spend 60-90 days in the lab before attempting the exam.

## The Metasploit restriction

OSCP famously **restricts Metasploit use during the exam**:

- You may use Metasploit/Meterpreter on **one machine of your choice** for the entire exam (excluding the AD set).
- Standalone modules of Metasploit (e.g. msfvenom for payload generation) are allowed.

This forces candidates to learn manual exploitation rather than `use exploit; set RHOSTS; run`. In practice, OSCP candidates learn to:

- Pull exploit code from [Exploit-DB](https://www.exploit-db.com/) and compile/modify it locally.
- Hand-craft web shells and reverse shells.
- Manually walk privilege escalation paths without `local_exploit_suggester`.

The restriction is widely considered the *reason* OSCP produces graduates who understand what they're doing — knowing how to make a tool work is different from knowing what it does.

## Cost + commitment

OSCP isn't cheap:

| Bundle | Cost | What it includes |
|---|---|---|
| **PEN-200 Course + 90 days lab + 1 exam attempt** | ~$1,649 | The standard package. |
| **Learn One** | ~$2,099 | A year of access (PEN-200 + labs + 2 exam attempts + other content). |
| **Learn Subscription** | ~$5,099/year | All-OffSec content (PEN-200 + PEN-300 + OSEP + etc.). |

The exam alone (one attempt, no course) is ~$249, but OffSec requires the course unless you're certifying via Learn Subscription.

Total time investment for a candidate from "I've done CEH" → OSCP: 3-6 months full-time-equivalent. Some people pass faster (existing pentest experience helps); some take longer.

## Pass rates and difficulty

OffSec doesn't publish official pass rates. Community surveys consistently estimate **20-30% first-attempt pass rate**, with **50-60% pass rate within 3 attempts**.

The "Try Harder" motto OffSec is known for reflects the exam's design: candidates are deliberately put in situations where the documented technique doesn't immediately work, and they have to reason through why and adapt.

## OSCP vs alternatives

| | OSCP | [CEH](/wiki/ceh) | TCM PNPT | HackTheBox CPTS |
|---|---|---|---|---|
| **Exam style** | 24h practical | Multiple-choice + optional Practical | 5-day open-book practical | 7-day practical |
| **AD focus** | Significant | Minimal | Dominant | Significant |
| **Cost (total)** | ~$1,600 | ~$1,200 | ~$300 | ~$200 |
| **Industry recognition** | Very high | High | Growing | Growing |
| **Updated curriculum** | Updated 2023; OSCP+ rolling refresh | v13 (2024) | Updated regularly | Updated regularly |

OSCP retains the strongest industry-wide recognition. TCM PNPT has lower cost and stronger AD focus but younger market recognition. HackTheBox CPTS is the strongest cost-per-skill ratio of the modern options.

## Common preparation paths

**6-month plan for someone with some IT background:**

```
Month 1-2:    HackTheBox Starting Point + free TryHackMe content.
              Get comfortable with Linux command line, nmap, basic web app testing.
Month 3:      Start PEN-200 course material + lab time.
Month 4-5:    Lab grind. Aim to complete 30-50 boxes in the OffSec labs.
              Supplement with HackTheBox retired boxes (TJ_Null's OSCP-like list).
Month 6:      Mock exams (HackTheBox Pro Labs, OffSec's exam preparation labs).
              Schedule the exam.
```

The HackTheBox **TJ_Null OSCP-like machine list** is a widely-used external practice resource — boxes graded by community members as similar to OSCP exam difficulty.

## After OSCP

Common next-step progressions:

- **OSEP** (Evasion Techniques + Breaching Defenses) — the next OffSec cert; covers AV/EDR evasion, more complex AD attacks. Useful for red-team operator roles.
- **OSWE** (Advanced Web Attacks) — deep web app exploitation. Useful for application-security-focused roles.
- **CRTP / CRTE / CRTM** (Altered Security) — pure Active Directory deep-dives.
- **OSWP** (Wireless) — wireless-specific add-on.
- **CISSP** — managerial / governance cert. Not a substitute for OSCP but complementary for senior IC roles or management track.

## Honest framing

OSCP isn't a perfect credential. Real critiques:

- **Lab quality.** OffSec's labs have been criticized as outdated relative to real-world environments. The 2023 PEN-200 update + the introduction of OSCP+ addressed some of this; the gap persists.
- **Report-writing prioritization.** Some candidates feel the exam over-weights professional report writing relative to actual technical skill.
- **Cost.** $1,600+ is a meaningful barrier; many strong testers have come up through TryHackMe + HackTheBox at a fraction of the cost.

But for "what credential opens the most doors in a technical pentest interview" the answer in 2026 is still OSCP.

## Further reading

- [OffSec PEN-200 / OSCP overview](https://www.offsec.com/courses/pen-200/).
- [TJ_Null OSCP-like machine list (HackTheBox forum)](https://forum.hackthebox.com/t/tjnull-s-list-of-oscp-like-vms/8684).
- [r/oscp subreddit](https://www.reddit.com/r/oscp/) — community questions, exam debriefs.
