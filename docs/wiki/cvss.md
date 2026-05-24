---
title: CVSS
slug: cvss
category: standards
summary: CVSS (Common Vulnerability Scoring System) is an open framework for communicating the severity of software vulnerabilities on a 0-10 scale. It produces a numeric score and a structured vector string capturing how a vulnerability can be exploited, what privileges are needed, and what the impact is on confidentiality, integrity, and availability.
related: [owasp-top-10, mitre-attck]
aliases: [Common Vulnerability Scoring System, CVSSv3, CVSSv3.1, CVSSv4]
updated: 2026-05-24
---

**CVSS** (Common Vulnerability Scoring System) is an open framework for scoring software vulnerability severity on a 0.0 to 10.0 scale. It is governed by the **FIRST** consortium (Forum of Incident Response and Security Teams) and is the dominant severity-rating system in industry. Almost every CVE published in the National Vulnerability Database (NVD) carries a CVSS score.

The most widely deployed version is **CVSSv3.1**. **CVSSv4** was finalized in 2023 but adoption is gradual.

## The 0-10 scale and severity bands

CVSS produces a numeric base score that maps to a qualitative severity band:

| Score range | Severity |
|---|---|
| 0.0 | None |
| 0.1 - 3.9 | **Low** |
| 4.0 - 6.9 | **Medium** |
| 7.0 - 8.9 | **High** |
| 9.0 - 10.0 | **Critical** |

A common mistake: calling an 8.1 CVE "critical" because it's a high number. CVSSv3 critical is **9.0+**. CVE-2017-0144 (EternalBlue) scores 8.1, which is High, not Critical. This matters for compliance frameworks that require patching "Critical" findings within N days.

## The vector string is the source of truth

A CVSS score by itself is information-poor — two 7.5s can mean very different things. The accompanying **vector string** captures every input metric. Example:

```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
```

Decoded:

| Field | Value | Meaning |
|---|---|---|
| **AV** Attack Vector | N | Network — exploitable from the internet |
| **AC** Attack Complexity | L | Low — no special conditions required |
| **PR** Privileges Required | N | None — pre-authentication |
| **UI** User Interaction | N | None — no user click required |
| **S** Scope | U | Unchanged — impact stays within the vulnerable component |
| **C** Confidentiality | H | High — total data disclosure |
| **I** Integrity | H | High — total integrity loss |
| **A** Availability | H | High — total availability loss |

That vector decodes to "pre-auth RCE from the internet, full data + integrity + availability impact" — i.e., 9.8 critical (EternalBlue, Log4Shell, ProxyLogon all near this).

Quote the *vector string*, not just the number, when communicating about a vulnerability.

## Base, Temporal, and Environmental

CVSSv3.1 defines three score components:

- **Base score** — properties of the vulnerability itself. Doesn't change over time.
- **Temporal score** — captures how exploit availability and remediation level evolve. A 9.8 with no public exploit and an available patch is lower temporal risk than the same 9.8 with weaponized exploit code and no patch.
- **Environmental score** — captures the *specific deployment's* asset criticality. A 9.8 on an isolated dev server is lower environmental risk than the same 9.8 on a customer-facing production database.

In practice, most published scores are base scores only. Temporal and environmental scoring lives in vulnerability management programs that incorporate threat intelligence and asset inventory.

The common misconception "CVSS scores age" is incorrect at the base level — base scores don't decay by design. *Temporal* scores can change as patches ship and exploit availability evolves; *environmental* scores are computed per-deployment. Quote those as needed; don't conflate them with the base.

## CVSSv4 changes

CVSSv4 was released in late 2023. Key changes from v3.1:

- **Threat metrics** (replaces temporal). Includes a new Exploit Maturity field aligned with how threat-intel teams actually classify exploits.
- **Supplemental metrics**. Optional fields like Safety (impact on physical safety — relevant for OT/medical), Automatable, Recovery, Value Density. Don't affect the base score but appear in the vector for downstream tools.
- **Subscores** (CVSS-B, CVSS-BT, CVSS-BE, CVSS-BTE) make it explicit which metrics were factored in.

Adoption is gradual; in 2026 most published scores are still CVSSv3.1.

## Critiques

CVSS has well-known weaknesses:

- **Single-CVE focus**, not chain-aware. Two CVSS 7.0 vulnerabilities that chain into an unauthenticated RCE deserve a higher real-world rating than either alone, but CVSS doesn't capture this.
- **Conflates exploitability with impact**. A CVSS 9.8 is impressive, but a 7.5 actively exploited in the wild may be the more urgent patch.
- **Doesn't capture business context**. A 4.0 in a payment processor matters more than a 9.0 in a deprecated test environment.

The **EPSS** (Exploit Prediction Scoring System) and **CISA KEV** (Known Exploited Vulnerabilities catalog) supplement CVSS by capturing exploitability-in-the-wild signals separately. Mature vulnerability programs use CVSS + EPSS + KEV together, not CVSS alone.

## Further reading

- [FIRST CVSS specification (v3.1)](https://www.first.org/cvss/v3-1/specification-document).
- [FIRST CVSS specification (v4.0)](https://www.first.org/cvss/v4-0/specification-document).
- [CISA Known Exploited Vulnerabilities catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog).
- [EPSS (Exploit Prediction Scoring System)](https://www.first.org/epss/).
