---
title: Ransomware
slug: ransomware
category: attacks
summary: Ransomware is a class of malware that encrypts a victim's data and demands a payment in exchange for decryption. Modern ransomware operations also exfiltrate data before encryption and threaten public release ("double extortion"), making them one of the most consequential cybercrime business models of the 2020s.
related: [phishing, active-directory, mitre-attck, pass-the-hash, edr, siem]
aliases: [Ransomware Attack, Crypto-Ransomware, Crypto-Locker, Double Extortion]
updated: 2026-05-25
---

**Ransomware** is malware that encrypts a victim's data and demands payment in exchange for decryption. The category emerged in 2013 with CryptoLocker; by 2017 the WannaCry and NotPetya outbreaks made it a household word; by 2026 ransomware is the single most consequential cybercrime business model — the Verizon DBIR consistently places ransomware in the top of "breach impact" rankings.

Modern ransomware operations have evolved beyond pure encryption into **double extortion**: the operator exfiltrates data *before* encrypting, then threatens public release if the ransom isn't paid. This makes backup-and-restore — historically the canonical defense — insufficient, because the data is already in the attacker's hands.

## The modern ransomware kill chain

The typical end-to-end engagement, mapped to [MITRE ATT&CK](/wiki/mitre-attck):

```
  Initial Access (T1190 RCE or T1566 phishing)
        │
        ▼
  Foothold + Persistence (web shell, scheduled task, service)
        │
        ▼
  Credential Access (T1003 LSASS dump, Mimikatz)
        │
        ▼
  Discovery (BloodHound, network share enum)
        │
        ▼
  Lateral Movement (T1078 Valid Accounts, PtH, PsExec)
        │
        ▼
  Privilege Escalation (Domain Admin via AD attack chains)
        │
        ▼
  Data Exfiltration (T1041 — rclone to MEGA, 1-50 TB)
        │
        ▼
  Encryption (T1486 — the payload finally runs, on hundreds of hosts simultaneously)
        │
        ▼
  Demand (dark-web leak site, negotiation chat, decryption key on payment)
```

The encryption step is the *last* step. Everything before it is "an ordinary intrusion" that could be detected and stopped. By the time encryption runs, the attacker has been inside the network for days or weeks.

## The ransomware-as-a-service economy

Modern ransomware is split between two roles:

- **Operators / developers.** Write and maintain the malware, the negotiation portal, the leak site, the cryptocurrency tumbling infrastructure. Provide the platform.
- **Affiliates.** Compromise victims and detonate the payload. Receive 70-90% of any ransom paid; the operators take a 10-30% platform cut.

This **Ransomware-as-a-Service** (RaaS) model lowered the entry bar dramatically. An affiliate doesn't need to write malware or run infrastructure — they just need initial access and a willingness to pull the trigger. Initial-access brokers sell that step separately ($1,000-$50,000 per compromised network on dark web markets).

Famous RaaS operations: LockBit, Conti (now defunct, fragmented into successors), REvil/Sodinokibi, BlackCat/ALPHV, BlackBasta, Royal.

## Why double extortion changed everything

Pre-2020 ransomware logic: "if you have backups, you don't pay."

Post-2020 logic: "if you have backups *and* you don't care about the public release of your data, you don't pay." That's a much narrower category — financial firms, healthcare organizations, defense contractors, government agencies, and law firms almost always have data they can't tolerate being leaked. The leak threat reaches them even if the encryption doesn't.

Triple extortion adds a third pressure: DDoS, customer notification ("we'll tell your customers their data is on our leak site"), or media outreach.

## Common ransomware families (2024-2026 era)

| Family | Notable for |
|---|---|
| **LockBit** | Dominant by victim count for multiple years until 2024 law-enforcement disruption. Multiple successor strains. |
| **ALPHV / BlackCat** | Rust-based; first cross-platform (Linux + Windows + ESXi). Self-disrupted in 2024 after the Change Healthcare attack. |
| **Royal** | High-impact mid-market focus; particularly active against US healthcare. |
| **Akira** | Newer family active throughout 2023-2025; backend ESXi targeting. |
| **Play** | Ongoing; specific malware infrastructure. |
| **Cl0p** | Mass-exploitation operator — drove the MOVEit Transfer (2023) and GoAnywhere (2023) campaigns. Now affects thousands of victims per major campaign. |

The list rotates as law enforcement (FBI, NCA, Europol) periodically dismantle infrastructure and operators rebrand or fragment.

## The decision: pay or not

Ransomware victims face a real choice with no good options:

**Arguments for paying:**

- Operational pressure to restore systems quickly (especially healthcare where lives are at risk).
- Data already exfiltrated; you're paying to suppress the leak, not just to decrypt.
- The decryptor may actually work (most do, with bugs).

**Arguments against paying:**

- No guarantee the decryptor works (5-15% don't, per Coveware data).
- No guarantee the data isn't leaked anyway (many operators leak even after payment).
- Funds future ransomware operations.
- Some jurisdictions (US OFAC sanctions) make paying certain groups illegal.
- Sets the organization as "willing to pay" for future targeting.

The current consensus among incident responders: **don't pay if you can credibly restore without paying.** When the data leak is the only remaining leverage, the calculus shifts.

## Defense — what actually works

Ordered by ROI:

1. **Immutable, off-domain backups.** The single most important control. Attackers target backup systems specifically (Veeam servers, backup network shares) so they're often joined-to-domain and accessible from the encrypted environment. Off-domain (separate identity), immutable (cannot be deleted by the backup admin account), tested-monthly backups make encryption recoverable.

2. **Phishing-resistant MFA on everything internet-facing.** Stops most initial-access vectors. Cheap to deploy with FIDO2 keys or device-bound passkeys.

3. **EDR with active response.** A modern EDR (Defender for Endpoint, CrowdStrike Falcon, SentinelOne) detects the lateral-movement and credential-access stages of the kill chain — long before encryption runs. The 2024-era EDRs are markedly better than the 2020 generation; the gap between "EDR-equipped" and "no EDR" is now 100x in detection capability.

4. **Network segmentation.** A flat network means encryption spreads to everything in minutes. Segmented networks limit blast radius. Particularly important for OT/manufacturing (avoid encrypting the production line).

5. **Patch management on internet-facing services.** Cl0p and similar groups exploit known CVEs at internet scale within days of disclosure. Patching SLAs measured in weeks are insufficient.

6. **Detect-and-disrupt the kill chain stages.** Mimikatz execution, abnormal AD enumeration, large outbound transfers, suspicious service-account use, scheduled tasks — each is a high-fidelity signal that the encryption is days away.

7. **Tabletop exercises.** When ransomware actually fires, the difference between "we've practiced this" and "we haven't" is days of additional downtime.

## Recovery — when it does happen

The standard incident response playbook:

1. **Isolate.** Disconnect affected systems from the network. Sounds simple; massive in practice when 30% of the company's endpoints are encrypted.
2. **Preserve evidence.** Forensic images of patient-zero systems, ransomware notes, encryption samples.
3. **Identify the strain.** Many strains have published decryptors (No More Ransom project). Free decryption may be possible.
4. **Restore from backups.** Test the backups *first* — sometimes the backups are also encrypted because attackers compromised the backup server.
5. **Reset every credential.** Domain Admin, every service account, every privileged user. Assume every password and hash in the environment was harvested.
6. **Engage law enforcement.** FBI in the US, NCA in the UK, equivalents elsewhere. They sometimes have intel that helps; they generally don't help recover data but help track the operator.
7. **Communicate.** Customers, regulators, employees. Get ahead of the story.

## Further reading

- [Verizon DBIR (annual)](https://www.verizon.com/business/resources/reports/dbir/).
- [CISA #StopRansomware guide](https://www.cisa.gov/stopransomware).
- [No More Ransom Project (free decryptors)](https://www.nomoreransom.org/).
- [The DFIR Report](https://thedfirreport.com/) — weekly real-intrusion writeups, many ransomware.
- [Coveware quarterly reports](https://www.coveware.com/blog) — ransomware payment trends and statistics.
