## 18 — LOLBins & EDR-Aware Tradecraft: What Defenders See

- **Source:** Original — closes the curriculum gap around modern post-exploit tradecraft. CEH v13 stops at "drop a payload, get a shell." Real engagements end where this article begins.
- **Author:** [@SaharBarak](https://github.com/SaharBarak) (CEH Prep)
- **Curriculum mapping:** **CEH v13 Day 06 — System Hacking** (post-exploit extension) · **Day 07 — Malware** · post-cert track
- **GitHub repos:**
  - [`LOLBAS-Project/LOLBAS`](https://github.com/LOLBAS-Project/LOLBAS) — the canonical catalog of signed Windows binaries that double as attacker tools
  - [`GTFOBins`](https://gtfobins.github.io/) — the Linux equivalent (SUID, sudo, capabilities abuse)
  - [`hasherezade/pe-sieve`](https://github.com/hasherezade/pe-sieve) — process-injection scanner; useful as a defender's mental model
  - [`SafeBreach-Labs/SysWhispers3`](https://github.com/klezVirus/SysWhispers3) — syscall-direct shellcode (red-team perspective)

---

## What this article exists for

Two reviewers (a red-teamer + a CEH alumni) flagged the same gap when they audited this curriculum: **CEH v13 teaches you to get a foothold, then stops**. Real engagements live or die on what you do *after* code execution lands. That's `LOLBins`, `process injection`, `AMSI`, `ETW`, and the cat-and-mouse with `EDR`.

This article frames it from the *defender's* point of view. Knowing what the SOC sees is the load-bearing skill — both for attackers (so you stay quiet) and for the much more common career path of going from "I have CEH" to a junior detection-engineering or SOC role.

---

## 1. LOLBins — using signed binaries as your toolchain

A LOLBin (**L**iving-**O**ff-the-**L**and **Bin**ary) is a signed, Microsoft-shipped Windows tool that an attacker repurposes. Defenders' allow-lists trust them; threat hunters often whitelist their hash. That's the gap LOLBins exploit.

The dominant family, with what each replaces in classic offense:

| LOLBin | What it does | Replaces |
|---|---|---|
| `certutil.exe` | Downloads, base64-decodes | `wget`, `curl`, `openssl base64 -d` |
| `bitsadmin.exe` | Background file transfer | curl in a service |
| `mshta.exe` | Executes HTA scripts (HTML + JScript) | dropping an EXE |
| `rundll32.exe` | Calls DLL exports | dropping a binary |
| `regsvr32.exe` | Registers COM scriptlets — fetches + runs `.sct` over HTTP | dropper |
| `installutil.exe` | Runs .NET installer code with `[CompilerGenerated]` attribute | unsigned binary |
| `msbuild.exe` | Compiles + runs inline C# from XML | dropping a payload |

The defender's view: every one of these has a legitimate use. The signal isn't "certutil ran" — it's "certutil ran *with* `-urlcache -split -f`" or "msbuild ran *outside* of a build process." That's why Sigma rules are command-line-fragment-keyed.

**Concrete defender query (Sigma-shaped, Splunk-syntax):**

```
process.name="certutil.exe"
  command_line="*-urlcache*-split*-f*http*"
```

**Red-team takeaway:** the obvious LOLBin invocations are mostly burned. New tradecraft pivots to less-instrumented signed binaries (`wmic`, `forfiles`, `pcalua`, `wscript`-with-`MSXMLHTTP`) or wraps the dangerous flags in non-canonical orderings.

---

## 2. AMSI: the JIT scanner you need to know about

**Anti-Malware Scan Interface (AMSI)** is a Windows API that any AV/EDR can register against. PowerShell, JScript, VBScript, and Office macros funnel script content through `AmsiScanBuffer()` *after* deobfuscation, just before execution.

So obfuscated PowerShell that decodes to `Invoke-Mimikatz` gets scanned as `Invoke-Mimikatz` plain-text. That's why the same payload that ran fine in 2015 gets quarantined in 2025 even though no static signature changed.

**The defender's mental model:** AMSI is the boundary between "the attacker's choice of obfuscation" and "what Defender actually sees." Logging at the AMSI layer is one of the highest-signal detection sources.

**The red-team mental model:** the AMSI provider is loaded into your process. If you can patch `amsi.dll`'s `AmsiScanBuffer` to return `AMSI_RESULT_CLEAN` before your real payload runs, you've blinded that channel. Detection then shifts to the *next* layer (process behavior, ETW).

This is one example of a larger pattern — **defense moves up the stack, offense follows**.

---

## 3. ETW: Windows' built-in telemetry

**Event Tracing for Windows (ETW)** is the kernel-mode telemetry bus. Almost every modern EDR (Defender for Endpoint, CrowdStrike, SentinelOne, Carbon Black) consumes ETW providers to see:

- Process creation (and *parent* — which is how PPID-spoofing detections fire)
- Image loads (DLL injection signal)
- Network connects (LOLBin-egress signal)
- Registry write (persistence signal)
- AMSI events (the script-content signal from above)

ETW is a *firehose*. Defenders subscribe to specific providers; attackers want to either avoid generating the events or blind the provider.

**The red-team takeaway:** ETW patching (zeroing `EtwEventWrite`'s prologue with `RET`) is a known technique that breaks the provider for your process. Modern EDRs detect this — but the detection itself is a high-signal event, which is itself useful intel for the defender.

---

## 4. Parent-PID Spoofing — the simplest "feels normal" trick

Every process has a parent. SOC dashboards key off parent → child trees. `winword.exe` spawning `powershell.exe` is *the* phishing signal — the chain looks unusual because Office isn't supposed to launch a shell.

**Parent-PID Spoofing** is a Win32 trick: when you `CreateProcess`, you can supply an `UpdateProcThreadAttribute(PROC_THREAD_ATTRIBUTE_PARENT_PROCESS)` value that tells the OS "claim this other process is my parent." Now your beacon looks like a child of `explorer.exe` instead of `winword.exe`. The audit log lies.

**Defender's countermove:** kernel-level telemetry sees the *actual* parent via the syscall caller. SysMon Event 1 + the `OriginalParentProcessId` field exposes the spoof when it's there. Detection is "do these two fields disagree?"

---

## 5. The detection stack — what you're actually fighting

If you understand the layers, you understand both sides. A simplified picture:

```
  Layer 1 — Static (file content)        ← AV signatures
  Layer 2 — In-memory at execution       ← AMSI, on-load DLL scans
  Layer 3 — Behavior / telemetry         ← ETW, Sysmon, EDR
  Layer 4 — Network egress / C2          ← TLS inspection, DNS analytics
  Layer 5 — Identity + privilege         ← AD logs, sign-in anomalies
```

A solid red-teamer thinks layer-by-layer:
- Layer 1: payload obfuscation, no on-disk artifacts (memory-only execution)
- Layer 2: AMSI bypass, hash-based allow-list evasion
- Layer 3: ETW patching, parent-PID spoofing, low-noise C2 timing
- Layer 4: domain fronting (mostly dead), trusted hosts (Slack/GitHub/etc.), legitimate-looking TLS profiles
- Layer 5: this is where blue teams catch most operators today — they detect *credentials being used wrong* even when the payload was perfect

CEH teaches you about Layer 1 only.

---

## 6. What to actually study next

Free / cheap, in priority order:

- **MalwareUnicorn's Reverse Engineering 101 & 102** — free, browser-based. Teaches you to *read* malware, which is the fastest path to understanding what defenders fingerprint.
- **HackTheBox Academy: Evading Windows Defender** module — current, paid, but cheap. Walks you through AMSI bypass families.
- **Sektor7 Malware Development Essentials** — paid, ~$200. Best single course for understanding the offense side of all the layers above.
- **The DFIR Report** writeups (free, weekly). Reading real-world intrusions reverse-engineers the detection stack faster than any course.

If you'd rather lean defender-side (better entry-level job market): SANS SEC555 / SEC504, or the free Splunk Boss of the SOC datasets to drill log analysis.

---

## The honest framing

CEH v13 doesn't test any of this. Knowing it changes nothing for the exam. Knowing it changes everything for any post-cert role — red, blue, or detection engineering. This article exists because the gap between "passes CEH" and "understands a real engagement" is wider than the marketing pretends, and being explicit about that is more honest than glossing.
