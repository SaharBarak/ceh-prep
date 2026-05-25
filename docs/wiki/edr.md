---
title: Endpoint Detection and Response
slug: edr
category: defenses
summary: Endpoint Detection and Response (EDR) is a security category that installs an agent on every endpoint to record process, network, file, and registry activity, then runs detection logic against that telemetry. EDR is what catches the modern attacker once they have code execution on a host.
related: [mitre-attck, siem, ransomware, mimikatz, pass-the-hash]
aliases: [EDR, Endpoint Detection Response, Endpoint Protection]
updated: 2026-05-25
---

**Endpoint Detection and Response** (EDR) is a security category that installs an agent on every endpoint — Windows workstation, Linux server, macOS laptop — to record fine-grained activity (process creation, network connections, file writes, registry edits, module loads) and run detection logic against the telemetry stream. EDR is the modern replacement for signature-only antivirus and the layer that catches the attacker once they have code execution on a host.

EDR exists because traditional antivirus failed against modern attackers. AV looked at file hashes; EDR looks at *behavior*: "process A is reading LSASS memory" ([Mimikatz](/wiki/mimikatz)), "process B is launching `powershell.exe` from a Word document" (macro malware), "process C is encrypting files faster than any human" ([Ransomware](/wiki/ransomware)).

## How EDR works

A persistent agent on every endpoint hooks the OS to observe:

```
Windows event tracing (ETW) ─┐
kernel callbacks            ─┼─► EDR agent ─► detection logic + telemetry stream ─► cloud console
syscall instrumentation     ─┘                                                       │
                                                                                     └─► SOC analyst
```

The agent collects:

| Telemetry | Detection use |
|---|---|
| **Process creation** | Parent/child chains — `winword.exe → powershell.exe` is canonically suspicious. |
| **Module load (DLL)** | Detect known-malicious modules, unsigned modules in sensitive processes. |
| **Network connections** | Outbound destinations, beaconing patterns, DNS queries. |
| **File operations** | Mass file encryption (ransomware), writes to autorun locations, dropped binaries. |
| **Registry edits** | Persistence keys (`Run`, `RunOnce`, services), security-disabling tampering. |
| **Authentication events** | Logon types, [pass-the-hash](/wiki/pass-the-hash) primitives, [Kerberos](/wiki/kerberos) ticket use. |
| **API calls** | `OpenProcess` on `lsass.exe`, `CreateRemoteThread` (process injection). |

## Major EDR vendors

| Vendor | Product |
|---|---|
| **CrowdStrike** | Falcon — cloud-native, market leader, strong behavioral detection. |
| **Microsoft** | Defender for Endpoint — bundled in Microsoft 365 E5; deeply integrated with Windows internals. |
| **SentinelOne** | Singularity — autonomous response (auto-rollback on ransomware), strong Linux/macOS. |
| **Palo Alto Networks** | Cortex XDR — integrates EDR with network telemetry. |
| **Sophos** | Intercept X — strong SMB market. |
| **Carbon Black (VMware)** | One of the original EDRs; now part of Broadcom. |
| **Elastic Endpoint** | Open-source-origin agent (Elastic Endgame); bundled with the Elastic stack. |
| **Limacharlie** | Vendor-agnostic EDR platform / "security infrastructure." |

## Detection categories

EDR detections fall into a few patterns:

- **Static signatures** — file hash, YARA rule matches. Cheap, brittle, low FP.
- **Behavioral rules** — "process X did Y" patterns codified by the vendor. The main detection surface.
- **ML/anomaly models** — vendor-trained classifiers on process-tree shape or PE-file features.
- **Memory scanning** — periodic scan of process memory for known implant signatures.
- **Cloud reputation** — query a vendor service for "have you seen this hash / domain / IP before?"

Detections map to [MITRE ATT&CK](/wiki/mitre-attck) techniques. Modern vendor consoles show "this alert is T1003.001 LSASS Memory."

## Response capabilities

EDR is "Detection and *Response*" — agents can act, not just observe:

| Action | Use case |
|---|---|
| **Isolate host** | Cut all network connectivity except to the EDR console. Standard first move on a confirmed compromise. |
| **Kill process** | Stop the malicious process tree. |
| **Quarantine file** | Move binary to a vault; prevent re-execution. |
| **Rollback** | (SentinelOne, Defender) Revert files encrypted by ransomware to pre-encryption state via Windows Volume Shadow Copy. |
| **Live response shell** | Drop the responder into a remote shell on the endpoint for forensic collection. |
| **Custom IoC block** | Push a hash / domain / IP to all agents as a deny rule. |

## EDR bypasses — attacker techniques

Sophisticated attackers test their tooling against EDRs. Common bypass categories:

| Technique | Idea |
|---|---|
| **Direct syscalls** | Skip user-mode API hooks by issuing the syscall directly via assembly (`syscall` instruction). |
| **Unhooking** | Read the unmodified `ntdll.dll` from disk; overwrite the in-memory hooked version. |
| **Process injection variants** | `APC injection`, `process hollowing`, `early bird` — many flavors EDRs match individually. |
| **LOLBin abuse** | Use signed Microsoft binaries (`certutil`, `rundll32`, `mshta`) so the agent sees a trusted process running. |
| **Driver-based kills (BYOVD)** | Bring-Your-Own-Vulnerable-Driver — load a signed-but-vulnerable kernel driver to terminate the EDR agent from kernel mode. |
| **Memory-only payloads** | Never touch disk; reflective DLL load + in-memory execution. |

EDR vendors ship updates as fast as bypass research lands. The cat-and-mouse drives constant patching.

## Operational reality

EDR alerts go to a SIEM and a [SOC Analyst](/wiki/soc-analyst). The day-one experience for a deployment of any size:

- **Days 1-30**: floods of alerts as the agent observes baseline behavior. Heavy tuning — exclude antivirus scanning paths, dev-tooling parent-child chains (`cl.exe` spawning `link.exe`), helper processes from monitoring tools.
- **Steady state**: maybe 5-20 high-severity alerts per 10,000 endpoints per day, with single-digit true positives.
- **Investigation**: pivot through the process tree, dump the memory of suspicious processes, query the EDR's data lake for historical activity by the user / host / hash.

A good EDR is the difference between catching the attacker at hour 1 versus week 8.

## XDR — where EDR is heading

**Extended Detection and Response** (XDR) extends EDR's process-level visibility with network telemetry, email security, cloud-workload data, and identity events — and ties them together in a single console. Vendors converge on this category because attackers cross the endpoint / network / cloud boundary in a single intrusion. CrowdStrike, Microsoft Defender XDR, Palo Alto Cortex XDR, and SentinelOne Singularity all sit here.

## Further reading

- [MITRE ATT&CK Evaluations — EDR vendor head-to-head](https://attackevals.mitre-engenuity.org/).
- [Red Canary Threat Detection Report (annual)](https://redcanary.com/threat-detection-report/) — what EDR actually catches.
- [The DFIR Report — incident walkthroughs showing EDR coverage in practice](https://thedfirreport.com/).
- [MalwareUnicorn unhooking tutorials](https://malwareunicorn.org/workshops/) — attacker-side perspective.
