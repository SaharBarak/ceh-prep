---
title: CVE
slug: cve
category: standards
summary: Common Vulnerabilities and Exposures (CVE) is the public catalog of disclosed software vulnerabilities, each with a unique identifier in the form `CVE-YYYY-NNNN`. CVEs are the lingua franca of vulnerability management — every patch advisory, vulnerability scanner, and threat intelligence feed references them.
related: [cvss, mitre-attck, nmap, owasp-top-10, metasploit]
aliases: [Common Vulnerabilities and Exposures, CVE ID, CVE Number]
updated: 2026-05-25
---

**CVE** (Common Vulnerabilities and Exposures) is the public catalog of disclosed software vulnerabilities. Each entry has a unique identifier in the form `CVE-YYYY-NNNNN` — for example, `CVE-2021-44228` (Log4Shell) or `CVE-2017-0144` (EternalBlue, the [SMB](/wiki/smb) bug behind WannaCry). The CVE program is operated by MITRE under sponsorship from CISA and is the canonical reference vendors, scanners, and threat intelligence teams use to talk about vulnerabilities.

CVE is not a vulnerability database in the rich sense — it is a *naming registry*. The detailed metadata (severity, exploitability, affected products) lives in the NIST National Vulnerability Database (NVD), which enriches CVE entries with [CVSS](/wiki/cvss) scores and CPE product mappings.

## How a CVE is assigned

```
researcher finds bug ─► reports to vendor (or coordinator) ─► CNA assigns CVE-ID
                                                                │
                                                                ▼
                                              vendor publishes advisory referencing CVE
                                                                │
                                                                ▼
                                          NVD enriches with CVSS, CPE, references ─► public DB
```

A **CNA** (CVE Numbering Authority) is an organization authorized to assign CVE IDs for vulnerabilities in their scope. Major CNAs:

- **MITRE** — the root CNA; assigns IDs for anything not covered by another CNA.
- **Vendor CNAs** — Microsoft, Google, Cisco, Oracle, Red Hat, etc. assign IDs for their own products.
- **Open-source coordinator CNAs** — GitHub, Linux kernel, npm assign IDs for ecosystem-wide flaws.
- **Researcher CNAs** — Trend Micro ZDI, Talos, Project Zero.

There are 300+ CNAs as of 2026. The distribution model exists because centralizing every CVE through MITRE didn't scale.

## What a CVE looks like

```
ID:          CVE-2021-44228
Description: Apache Log4j2 2.0-beta9 through 2.15.0 ... allows attackers
             ... to execute arbitrary code loaded from LDAP servers ...
Severity:    Critical (CVSS 3.1 base score 10.0)
References:  https://logging.apache.org/log4j/2.x/security.html
             https://nvd.nist.gov/vuln/detail/CVE-2021-44228
             ...
CPE:         cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*
```

The fields:

- **CVE ID** — the unique identifier; what you cite.
- **Description** — what the bug is.
- **CVSS** — severity, see the [CVSS](/wiki/cvss) wiki entry.
- **References** — vendor advisory, security researcher writeup, exploit PoC if public.
- **CPE** — Common Platform Enumeration; which product-version combinations are affected.

## How CVEs flow into operational security

| Consumer | Use |
|---|---|
| **Vulnerability scanners** ([Nessus](/wiki/nmap)-adjacent, Qualys, OpenVAS) | Match installed software against CVE → CPE mappings; flag vulnerable hosts. |
| **SCA tools** (Snyk, Dependabot, Trivy, Grype) | Match dependency manifests against CVEs; flag vulnerable libraries. |
| **Patch management** | Prioritize patch deployment by CVSS + EPSS (exploit prediction) + whether public exploitation is known. |
| **Threat intel feeds** | Correlate "CVE-X is being actively exploited" → push detection rules to [SIEM](/wiki/siem) / [EDR](/wiki/edr). |
| **Exploit frameworks** ([Metasploit](/wiki/metasploit), Nuclei) | Each exploit module references the CVE it weaponizes. |
| **Compliance frameworks** | "Patch any CVSS ≥ 7.0 CVE within 30 days" is a common control. |

## CVE vs adjacent registries

| Registry | What it indexes |
|---|---|
| **CVE** | Vulnerabilities — specific bugs in specific products. |
| **CWE** | Weaknesses — categories of bugs (CWE-79 = XSS, CWE-89 = SQL Injection). CVEs reference CWEs. |
| **[CVSS](/wiki/cvss)** | Severity scoring for a CVE. |
| **EPSS** | Exploit Prediction Scoring System — probability a CVE will be exploited in the wild within 30 days. |
| **KEV** | CISA Known Exploited Vulnerabilities catalog — CVEs confirmed to be actively exploited. Often the most useful prioritization signal. |
| **[MITRE ATT&CK](/wiki/mitre-attck)** | Adversary techniques (not CVE-indexed; orthogonal). |
| **CAPEC** | Common Attack Pattern Enumeration — attack patterns indexed by CWE. |

## What CVE is *not*

- **Not a complete catalog of all vulnerabilities.** Many bugs (especially in closed-source / niche products) never get a CVE.
- **Not a prioritization decision.** A CVE with CVSS 9.8 in a product you don't run is a footnote; a CVSS 6.5 in your internet-facing component is an incident.
- **Not a recommendation to act.** A CVE entry tells you a bug exists; it doesn't tell you whether to upgrade today or in next month's maintenance window. That's where EPSS / KEV / threat intel come in.

## Notable CVEs to know

For an offensive-security curriculum, certain CVEs come up by name:

| CVE | Name | Surface |
|---|---|---|
| CVE-2017-0144 | EternalBlue | [SMB](/wiki/smb) v1 — WannaCry, NotPetya |
| CVE-2021-44228 | Log4Shell | Apache Log4j |
| CVE-2017-5638 | Equifax | Apache Struts 2 |
| CVE-2014-0160 | Heartbleed | OpenSSL TLS heartbeat |
| CVE-2014-6271 | Shellshock | Bash environment variables |
| CVE-2019-0708 | BlueKeep | RDP pre-auth RCE |
| CVE-2020-1472 | Zerologon | Netlogon, AD privilege escalation |
| CVE-2021-26855 | ProxyLogon | Exchange Server |
| CVE-2022-22965 | Spring4Shell | Spring Framework |
| CVE-2023-23397 | Outlook NTLM leak | Outlook calendar reminders |

Each of these had outsized impact because the affected product was widely deployed and the exploit was either pre-auth or required only minimal interaction.

## Operational reality

The volume problem: NVD has ~25,000+ CVEs published per year now. Manual triage doesn't scale. The pragmatic prioritization stack:

1. **Is it on the CISA KEV list?** If yes — fix this week regardless of CVSS.
2. **What's the EPSS score?** Probability of exploitation in the next 30 days — anything > 0.5 deserves attention.
3. **Is it in a public-facing component?** A bug in your edge proxy is operationally more urgent than the same bug in an internal-only service.
4. **What's the CVSS, with environmental adjustments?** Base CVSS overstates risk in many environments; recalculate with the environmental metric for your specific deployment.

The patches the bad guys exploit are rarely the highest-CVSS ones; they're the ones combining "internet-exposed + working PoC + slow patch cadence in the wild."

## Further reading

- [cve.org](https://www.cve.org/) — the CVE program.
- [nvd.nist.gov](https://nvd.nist.gov/) — National Vulnerability Database.
- [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog).
- [EPSS — first.org](https://www.first.org/epss/) — Exploit Prediction Scoring System.
