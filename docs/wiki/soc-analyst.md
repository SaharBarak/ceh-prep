---
title: SOC Analyst
slug: soc-analyst
category: roles
summary: A Security Operations Center (SOC) Analyst monitors security alerts, investigates suspicious activity, and responds to confirmed incidents. The role is the front line of an organization's detection-and-response posture, and the most common entry path into defensive security careers.
related: [siem, edr, mitre-attck, ransomware, pentester]
aliases: [SOC Tier 1, Security Analyst, SOC Tier 2, Security Operations Analyst]
updated: 2026-05-25
---

A **SOC Analyst** (Security Operations Center Analyst) monitors security alerts, investigates suspicious activity, and responds to confirmed incidents on behalf of an organization. The role is the front line of detection-and-response — when an [EDR](/wiki/edr) raises an alert or a [SIEM](/wiki/siem) detection fires, the SOC analyst is who reads it, triages it, and decides whether it's noise or an incident.

SOC Analyst is the most common entry path into defensive security careers. Many security engineers, threat hunters, incident responders, and CISOs began in a SOC. The role pairs well with foundational certifications (Security+, CySA+), forgives lack of a CS degree, and rotates analysts through enough of the security stack to find specializations.

## The tiers

Most SOCs run a tiered model:

| Tier | Job | Tools and skills |
|---|---|---|
| **Tier 1** | Triage alerts. Decide "real or noise" within minutes. Escalate to Tier 2 or close as false positive. | SIEM queries, IOC enrichment, ticketing, playbook execution |
| **Tier 2** | Deep investigation of escalated alerts. Pivot through logs, dump memory, build the incident timeline. | Forensics tooling, scripting, EDR live-response, malware triage |
| **Tier 3** | Threat hunting, detection engineering, incident leadership. Build the rules Tier 1 triages against. | Detection-as-code (Sigma, KQL, SPL), MITRE ATT&CK mapping, red-team partnership |

Smaller orgs collapse tiers — a single analyst may run all three. Larger orgs split incident command, malware reverse engineering, and CTI into separate functions.

## What a shift actually looks like

A Tier 1 analyst at a mid-sized SOC might see 50-200 alerts per shift. The work pattern:

1. **Read the alert.** What rule fired? What's the surrounding context — same user, same host, same time?
2. **Enrich.** Pull the indicators (IP, hash, domain, user) through threat-intel feeds and the SIEM's data lake. What else has this entity touched in the last 30 days?
3. **Apply the playbook.** Confirmed phishing → contain the inbox, reset credentials, search for replication. Suspicious PowerShell → check parent process, dump artifact, query EDR.
4. **Decide.** Close as false positive, close with notes, escalate to Tier 2, or open an incident.
5. **Document.** The next analyst, the next shift, the eventual post-mortem all read what you wrote.

A meaningful chunk of the day is **alert tuning**: noticing that 80% of "PowerShell encoded-command" alerts come from a legitimate IT automation script, and either tuning the rule or whitelisting the source.

## Detection categories analysts work with

The same [MITRE ATT&CK](/wiki/mitre-attck) techniques the [pentester](/wiki/pentester) tries to execute, the SOC analyst is trying to spot:

| Technique class | Common alert |
|---|---|
| **Initial access** | Phishing email reaches inbox; cloud account login from new geography |
| **Execution** | Encoded PowerShell, suspicious child process from Office app |
| **Persistence** | New scheduled task, registry Run key write, new service install |
| **Privilege escalation** | Token impersonation, UAC bypass, [Kerberoasting](/wiki/kerberoasting) |
| **Defense evasion** | EDR tampering, log clearing, Windows Defender disabled |
| **Credential access** | [Mimikatz](/wiki/mimikatz) primitives, LSASS read, AS-REP roast traffic |
| **Discovery** | Network scanning from an endpoint, AD enumeration via [LDAP](/wiki/ldap) |
| **Lateral movement** | [Pass-the-hash](/wiki/pass-the-hash), PsExec / WMI execution, [SMB](/wiki/smb) admin shares |
| **Collection / Exfiltration** | Large outbound transfers, archive creation followed by upload |
| **Impact** | Ransomware mass-file-write, system shutdown, account lockouts |

A well-tuned SOC catches incidents at the earliest stages and rolls up evidence quickly.

## Tools the analyst lives in

| Layer | Tools |
|---|---|
| **SIEM** | Splunk, Sentinel, Elastic Security, Chronicle, QRadar |
| **EDR** | CrowdStrike Falcon, Microsoft Defender for Endpoint, SentinelOne, Carbon Black |
| **Threat Intel** | MISP, ThreatConnect, Recorded Future, VirusTotal, AbuseIPDB |
| **Ticketing** | TheHive, Jira, ServiceNow, Cortex XSOAR |
| **Phishing analysis** | Cofense Triage, urlscan.io, sandboxes (any.run, Joe Sandbox, Hybrid Analysis) |
| **Network forensics** | Zeek logs, Suricata IDS, NetFlow, Wireshark |
| **Endpoint forensics** | KAPE, Velociraptor, GRR, Sysmon (for telemetry generation) |

A new analyst often inherits a SIEM dashboard and an EDR console; competence is measured by how fluently they pivot across the two.

## Common pain points

| Issue | Effect |
|---|---|
| **Alert fatigue** | Repeated false positives cause analysts to dismiss legitimate alerts. The single biggest cause of missed incidents. |
| **Shift work** | 24x7 coverage means rotating night and weekend shifts. Real career and health implications. |
| **Detection gaps** | An attack that produces no logged event is invisible to the SOC regardless of analyst skill. |
| **Documentation drift** | Playbooks describe procedures that no longer apply; analysts work from memory and inconsistent norms. |
| **Tooling sprawl** | Six consoles to triage one alert. Time per alert balloons. |

The mature SOC invests heavily in **SOAR** (automation of routine analyst actions), **detection engineering** (tuning rules instead of just running them), and **purple-team exercises** (working alongside pentesters to validate detection coverage).

## Certifications

Most-cited for SOC roles:

- **Security+** — entry-level baseline; often listed as a minimum job requirement.
- **CySA+** (CompTIA Cybersecurity Analyst) — SOC-aligned; covers SIEM use, vulnerability management, IR.
- **GSEC** — SANS / GIAC Security Essentials.
- **GCIA** — GIAC Certified Intrusion Analyst; deep network detection.
- **GCIH** — GIAC Certified Incident Handler.
- **Microsoft SC-200** — Security Operations Analyst Associate; vendor-specific but increasingly recognized.
- **Blue Team Level 1 / 2** — practical hands-on, vendor-neutral; growing in respect.

[CEH](/wiki/ceh) and [OSCP](/wiki/oscp) appear on SOC resumes but signal an interest in offensive security; they're not core to the SOC role.

## How a Tier 1 becomes a Tier 2 / 3 / engineer

The progression is mostly via demonstrating:

- **Quality of incident write-ups** — clear, actionable, with full timeline.
- **Tuning contributions** — false-positive reductions that survive Tier 3 review.
- **Detection authoring** — writing new Sigma / KQL / SPL rules that hold up in production.
- **Initiative on threat hunting** — proactive queries that surface real incidents.

The career arc opens widely: Tier 3 → Detection Engineer → Threat Hunter → Senior Security Engineer → IR Lead → SOC Manager → CISO. Or sideways into Red Team / [Pentester](/wiki/pentester) work via deep familiarity with the detection side.

## The realistic entry path

1. **Get the baseline knowledge.** CompTIA Network+ and Security+, plus hands-on with a free SIEM (Wazuh, Security Onion, Elastic Security).
2. **Build a home lab.** A few VMs, Sysmon, the Elastic stack — generate Mimikatz / nmap / EICAR test events and learn to detect them.
3. **Practice on TryHackMe / Blue Team Labs Online** — defender-focused exercises.
4. **Apply to entry-level SOC roles.** MSSPs (Managed Security Service Providers) hire heavily for Tier 1; high turnover, good training ground.
5. **Network with the local OWASP / BSides community.** Direct referrals beat resume drops in security hiring.

The role rewards curiosity, methodical thinking, and writing clearly. The bar is reasonable to clear.

## Further reading

- [SANS Reading Room — SOC operations](https://www.sans.org/white-papers/).
- [Anton Chuvakin / Augusto Barros writings on detection engineering](https://medium.com/@anton.chuvakin).
- [Splunk's Boss of the SOC (BOTS)](https://bots.splunk.com/) — practice CTF-style SOC scenarios.
- [The DFIR Report](https://thedfirreport.com/) — real intrusions walked through start to finish.
