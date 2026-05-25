---
title: Security Information and Event Management
slug: siem
category: defenses
summary: Security Information and Event Management (SIEM) is a security operations platform that centralizes logs from across an organization, normalizes them into a queryable form, and runs detection rules to surface suspicious activity. SIEMs are the analytic engine SOC analysts work in day-to-day.
related: [mitre-attck, soc-analyst, edr, ransomware, active-directory]
aliases: [SIEM, Security Information Event Management]
updated: 2026-05-25
---

**Security Information and Event Management** (SIEM) is a security-operations platform that ingests logs and telemetry from across an organization, normalizes them into a consistent schema, and runs detection rules that surface suspicious activity for human analysts. The SIEM is the analytic substrate a Security Operations Center (SOC) works in — the canonical place a [SOC Analyst](/wiki/soc-analyst) goes when an alert fires.

The category emerged from merging two older product lines: SIM (Security Information Management — log retention and reporting) and SEM (Security Event Management — real-time correlation). Modern SIEMs do both plus user-and-entity behavior analytics (UEBA), threat-intelligence enrichment, and SOAR-style automation.

## What a SIEM does

```
endpoints, firewalls, ─► log shipper ─► SIEM ingest ─► normalized index ─► detection rules
servers, AD, cloud,                                                          │
identity provider                                                            └─► alerts ─► analyst
```

The four jobs:

| Job | What it looks like |
|---|---|
| **Collect** | Forward logs from every system — endpoints via [EDR](/wiki/edr), network via firewall and proxy logs, identity via [Active Directory](/wiki/active-directory) and the IdP, cloud via CloudTrail / Azure activity logs, applications via syslog or structured JSON. |
| **Normalize** | Map heterogeneous log formats into a common schema (Elastic Common Schema, CIM, OCSF) so a query for "user authenticated" works across Windows, Linux, and Okta logs uniformly. |
| **Detect** | Run rules — signature matches, threshold alerts, statistical baselines, [MITRE ATT&CK](/wiki/mitre-attck) technique detections — over the normalized data. |
| **Investigate** | Surface alerts to analysts with the context (pivot to related events, enriched threat intel, asset criticality) needed to triage. |

## Common SIEM platforms

| Platform | Notes |
|---|---|
| **Splunk Enterprise Security** | The dominant on-prem SIEM. Powerful query language (SPL), expensive per-GB licensing. |
| **Microsoft Sentinel** | Cloud-native SIEM on Azure Monitor. KQL query language. Strong AD/Entra ID integration. |
| **Elastic Security** | Open-source-origin stack (Elasticsearch + Kibana). Pay for advanced detections, free for self-hosted basics. |
| **Google Chronicle / Google Security Operations** | Hyperscale ingestion. Long retention as a flat fee, not per-GB. |
| **Wazuh** | Open-source SIEM. Forked from OSSEC; popular for small-to-mid orgs. |
| **CrowdStrike LogScale (Humio)** | High-throughput streaming search. Often paired with CrowdStrike Falcon EDR. |
| **IBM QRadar** | Long-established enterprise SIEM, common in regulated industries. |

## Detection content

Out-of-the-box SIEM rules are usually generic ("failed login spike"). The valuable work is writing detections specific to *your* environment. The modern approach is to map detections to [MITRE ATT&CK](/wiki/mitre-attck) techniques and track coverage:

- **T1110 Brute Force** — N failed logins followed by a success from the same source IP.
- **T1078 Valid Accounts** — login from an unusual geolocation for that user.
- **T1059.001 PowerShell** — encoded-command PowerShell execution on an endpoint.
- **T1055 Process Injection** — alert from EDR matching a `CreateRemoteThread` pattern.
- **T1003.001 LSASS Memory** — process opening `lsass.exe` with read/write rights ([Mimikatz](/wiki/mimikatz) primitive).

Public detection-rule libraries to seed coverage:

- **Sigma rules** — vendor-agnostic detection format, translated to the SIEM's query language. <https://sigmahq.io>
- **Elastic detection rules** — open repository. <https://github.com/elastic/detection-rules>
- **Splunk Security Content** — Splunk-flavored detections. <https://research.splunk.com>

## Tuning — the recurring SOC problem

A new SIEM rule rarely lands at the right sensitivity on day one. Typical lifecycle:

1. **Author** the rule against a known attack pattern.
2. **Backtest** against 30 days of historical logs — count how many alerts it would have generated.
3. **Tune** away the easy false positives (whitelist domain controllers from "lateral movement" rules, etc.).
4. **Deploy** in low-severity mode for a week.
5. **Promote** to high-severity once the false-positive rate is acceptable.
6. **Maintain** — every infrastructure change is a potential tuning event.

The chronic SOC problem is **alert fatigue**: rules that fire 200 times a week with 199 false positives produce analysts who stop reading them. Aggressive tuning, deduplication, and risk-scoring are the difference between a useful SIEM and an expensive log archive.

## SIEM, EDR, SOAR — how they fit

| System | Job |
|---|---|
| **[EDR](/wiki/edr)** | Detect and respond on the endpoint. Optimized for process-level telemetry. |
| **SIEM** | Aggregate everything across the org. Optimized for cross-source correlation. |
| **SOAR** (Security Orchestration, Automation, Response) | Automate the analyst's response playbooks — enrich, contain, ticket. Often a SIEM add-on. |
| **XDR** (Extended Detection and Response) | Vendor-integrated stack collapsing EDR + SIEM-light + SOAR into one product. |

A mature SOC runs EDR for endpoint depth, SIEM for breadth, and SOAR to automate the boring parts.

## Logs that matter most

If you can ingest only a few sources, prioritize:

1. **Authentication logs** — Windows Security event log, Linux `auth.log`, IdP (Okta, Entra ID, Auth0).
2. **EDR alerts and process telemetry**.
3. **DNS query logs** — many implants resolve C2 domains; DNS is hard to silence.
4. **Cloud audit logs** — CloudTrail, Google Cloud Audit Logs, Azure Activity Log.
5. **Network proxy logs** — outbound HTTP/S destinations, file uploads.

## Compliance value

Most compliance frameworks require central log collection with retention:

| Framework | Typical retention |
|---|---|
| PCI DSS | 1 year, 3 months hot |
| HIPAA | 6 years |
| SOX | 7 years |
| GDPR Article 32 | "Appropriate" — usually read as 1+ year |

SIEMs serve both the detection and the compliance use case from the same log pipeline.

## Further reading

- [Gartner Magic Quadrant for SIEM](https://www.gartner.com/) (annual; the canonical industry comparison).
- [Sigma rule format](https://github.com/SigmaHQ/sigma).
- [MITRE ATT&CK detection coverage matrix](https://attack.mitre.org/resources/working-with-attack/).
- [The Threat Hunting Project — open detections by category](https://github.com/ThreatHuntingProject/ThreatHunter-Playbook).
