---
title: MITRE ATT&CK
slug: mitre-attck
category: standards
summary: MITRE ATT&CK is a publicly maintained knowledge base of adversary tactics, techniques, and procedures (TTPs) observed in real-world cyberattacks. It is the industry-standard framework for describing how attackers operate, and the vocabulary almost every modern threat-intelligence report uses.
related: [owasp-top-10, cvss, active-directory, phishing, ransomware, siem, edr, nist-csf]
aliases: [MITRE ATTACK, ATT&CK, ATTACK Framework]
updated: 2026-05-24
---

**MITRE ATT&CK** (Adversarial Tactics, Techniques, and Common Knowledge) is a publicly-available, periodically-updated knowledge base of how cyber adversaries actually operate. Maintained by MITRE Corporation, it catalogs every observed tactic and technique from public threat intelligence and turns them into a structured taxonomy.

ATT&CK has become the de-facto common language for describing attacker behavior. Threat intelligence reports, EDR alerts, MITRE-aligned detection rules, red team reports, and tabletop exercises all reference techniques by their ATT&CK identifier.

## Tactics, techniques, sub-techniques

ATT&CK structures attacker behavior in three layers:

- **Tactics** — the *why*. The attacker's high-level objective at a phase of the engagement. Example: "Initial Access," "Privilege Escalation," "Lateral Movement," "Exfiltration."
- **Techniques** — the *how*. A specific way to achieve a tactic. Example: under "Privilege Escalation," **T1068 Exploitation for Privilege Escalation**, **T1547 Boot or Logon Autostart Execution**.
- **Sub-techniques** — variants of a technique. Example: under T1547, **T1547.001 Registry Run Keys**, **T1547.005 Security Support Provider**.

The structure means a finding like "the adversary used T1059.001 PowerShell" is a precise, machine-readable claim — every tool that supports ATT&CK can map it to the same definition.

## The 14 enterprise tactics (current matrix)

The Enterprise matrix covers Windows / macOS / Linux / network / cloud / containers / SaaS / mobile environments. The 14 tactics:

1. **Reconnaissance** — gathering info before the engagement.
2. **Resource Development** — building or buying infrastructure (domains, malware, accounts).
3. **Initial Access** — first foothold (phishing, drive-by, exploit).
4. **Execution** — running code on a victim system.
5. **Persistence** — surviving reboots and re-imaging.
6. **Privilege Escalation** — moving from user to admin / root.
7. **Defense Evasion** — avoiding detection by AV/EDR.
8. **Credential Access** — stealing passwords, tokens, hashes.
9. **Discovery** — enumerating the environment from inside.
10. **Lateral Movement** — moving between hosts.
11. **Collection** — gathering data of interest.
12. **Command and Control** — talking to the attacker.
13. **Exfiltration** — getting the data out.
14. **Impact** — destroying, encrypting, or otherwise affecting operations.

The flow isn't strictly linear; modern engagements loop through Reconnaissance → Discovery → Lateral Movement many times.

## ATT&CK matrices

ATT&CK ships in several environment-specific matrices:

- **Enterprise** — the main matrix above.
- **Mobile** — iOS and Android attacker techniques.
- **ICS** — industrial control systems / OT.
- **PRE-ATT&CK** — pre-compromise reconnaissance and resource development (now folded into Enterprise as the first two tactics).

## How it's used in practice

- **SOC detection coverage.** Map every detection rule to one or more techniques. Surface the unaddressed cells — those are your detection gaps.
- **Red team reporting.** Every finding in a red team report names the technique IDs used. Lets the blue team triangulate gaps.
- **Threat intelligence.** "APT29 used T1059.001 (PowerShell) and T1003.001 (LSASS Memory dumping)" is more precise than "APT29 used PowerShell to dump credentials."
- **Vendor product positioning.** Every EDR vendor maps their detection coverage to ATT&CK. Their charts are usually optimistic; real coverage is what your own red team can prove.
- **Tabletop exercises.** Pick a technique, walk the blue team through detection and response.

## Common techniques worth knowing by ID

| ID | Name | Why it matters |
|---|---|---|
| **T1059** | Command and Scripting Interpreter | PowerShell, cmd, bash, Python execution. Most-frequently-observed tactic in real intrusions. |
| **T1003** | OS Credential Dumping | LSASS dumps, SAM dumps, NTDS.dit extraction. The credential-access workhorse. |
| **T1078** | Valid Accounts | Use of compromised legitimate credentials. The hardest technique to detect because there's no malicious binary. |
| **T1190** | Exploit Public-Facing Application | Internet-exposed RCE. Initial access via vulnerability rather than phishing. |
| **T1566** | Phishing | The single most common initial access. Sub-techniques cover spearphishing, link, attachment, service. |
| **T1071** | Application Layer Protocol | C2 over HTTPS/DNS. Defender-side detection focus area. |
| **T1486** | Data Encrypted for Impact | Ransomware. Captures the destructive endpoint. |

## D3FEND — the defender's mirror

MITRE also publishes **D3FEND**, a complementary knowledge base of *defender* techniques mapped to the ATT&CK techniques they counter. Less mature than ATT&CK but increasingly used in defender-side coverage discussions.

## Critiques

- **Behavior-anchored, not vulnerability-anchored.** ATT&CK doesn't tell you what *bug* led to the technique — only what the attacker did. Pair it with CVE / CVSS data for full coverage.
- **Adoption pressure favors "we covered T1059"** rather than the harder "we *reliably detect* T1059 in our environment." Coverage and detection quality are not the same thing.
- **Sub-technique granularity is uneven.** Some techniques have ten sub-techniques; others have none even though variants are common.

## Further reading

- [MITRE ATT&CK (official)](https://attack.mitre.org/).
- [MITRE D3FEND](https://d3fend.mitre.org/).
- [ATT&CK Navigator](https://mitre-attack.github.io/attack-navigator/) — interactive matrix for marking coverage / heat maps.
- [The DFIR Report](https://thedfirreport.com/) — weekly real-intrusion walkthroughs with ATT&CK technique mapping.
