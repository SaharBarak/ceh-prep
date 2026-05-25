---
title: LAPS
slug: laps
category: defenses
summary: Local Administrator Password Solution (LAPS) is a Microsoft mechanism that randomizes the local Administrator password on every domain-joined Windows host, stores the per-host password in Active Directory, and grants read access only to authorized principals. LAPS defeats lateral movement by ensuring a stolen local-admin hash unlocks exactly one machine.
related: [active-directory, pass-the-hash, mimikatz, ntlm, kerberos]
aliases: [Local Administrator Password Solution, Windows LAPS, LAPS Microsoft]
updated: 2026-05-25
---

**LAPS** (Local Administrator Password Solution) is a Microsoft mechanism that randomizes the built-in local Administrator account password on every domain-joined Windows host, stores the per-host password in [Active Directory](/wiki/active-directory), and grants read access only to authorized principals. The threat model it directly closes: an attacker who compromises one workstation cannot use the local admin credentials there to log in to other workstations — because every workstation has a different local admin password.

Without LAPS, organizations historically deployed the same local Administrator password to every workstation via Group Policy. One [pass-the-hash](/wiki/pass-the-hash) against `Workstation01` then unlocked `Workstation02..Workstation10000` because the NTLM hash of `LocalAdmin` was identical everywhere. LAPS makes the hash unique per host.

## How LAPS works

```
Group Policy / Intune ─► triggers LAPS agent on host ─► generates new random password
                                                      ─► sets it on Administrator account locally
                                                      ─► writes it to AD computer object attribute
                                                      ─► encrypted (Windows LAPS) or cleartext (legacy LAPS)

Helpdesk needs admin ──► AD lookup ──► retrieves the password attribute (if ACL allows)
on Workstation42                       ──► reads the per-host password
```

Each domain-joined host runs a small client agent that:

1. On a schedule (default ~30 days), generates a new password meeting complexity requirements.
2. Sets the password on the local `Administrator` account.
3. Writes the new password and its expiration timestamp into the AD computer object (as `ms-Mcs-AdmPwd` for legacy LAPS or `msLAPS-Password` for Windows LAPS).
4. ACLs on those attributes determine who can read the cleartext.

When a helpdesk technician needs admin on a specific workstation, they query AD for that machine's stored password.

## Legacy LAPS vs. Windows LAPS

| | Legacy LAPS | Windows LAPS |
|---|---|---|
| **Distribution** | Separate MSI installer | Built into Windows (April 2023 patch onward) |
| **AD attributes** | `ms-Mcs-AdmPwd`, `ms-Mcs-AdmPwdExpirationTime` | `msLAPS-Password`, `msLAPS-EncryptedPassword` |
| **Encryption at rest** | Cleartext in AD (attribute ACL is the only control) | DPAPI-NG encryption keyed to a specific AD group |
| **Password history** | Single current password | Optional history |
| **Backend options** | AD only | AD or Entra ID (Azure AD) |
| **Audit** | Limited | Event log entries on password reads |

Windows LAPS is the current product. Legacy LAPS is supported but deprecated.

## Why LAPS matters operationally

It closes the single most common lateral-movement primitive on Windows networks. The canonical attack chain it disrupts:

```
phish → workstation A → dump LSASS with mimikatz → get NTLM hash for LocalAdmin
                                                  → pass-the-hash to workstation B
                                                  → repeat across the fleet
```

With LAPS, the NTLM hash of LocalAdmin on workstation A is useful only on workstation A. To pivot to workstation B, the attacker needs *workstation B's* password — which requires AD access to read the LAPS attribute, which requires a privileged account, which is what the attacker was trying to obtain in the first place.

## Attacks against LAPS

LAPS is a strong control but not a silver bullet. Attacks on LAPS-protected fleets:

| Attack | What it requires |
|---|---|
| **Compromise a LAPS-readable group** | Helpdesk groups often have read access to LAPS attributes. Compromising one helpdesk account exposes every workstation's password. |
| **DCSync** | If you have Domain Admin or specific replication rights, you can replicate LAPS attributes for every computer. Mitigation is preventing the privilege escalation, not LAPS itself. |
| **AdminSDHolder abuse** | Privileged accounts whose ACLs are reset by AdminSDHolder might re-acquire LAPS read rights inadvertently. |
| **Non-LAPS-protected accounts** | LAPS only rotates the *built-in* local Administrator. A custom local admin account is unmanaged unless explicitly added. |
| **LAPS readers seen by [BloodHound](/wiki/bloodhound)** | BH's `ReadLAPSPassword` edge surfaces every principal with LAPS read access — a routing graph for attackers. |

The defensive controls that compose with LAPS:

- Restrict LAPS read ACLs to a small, audited group (not "Helpdesk" — a JIT-elevated subset).
- Just-in-time access (PIM, Identity Now) to that group.
- Audit every LAPS password read in the SIEM.
- Disable local logon for the Administrator account entirely on workstations (force domain accounts even for admin tasks).
- Run [EDR](/wiki/edr) to catch [Mimikatz](/wiki/mimikatz)-style LSASS reads before they yield credentials.

## Deployment notes

For Windows LAPS:

```powershell
# Enable in Group Policy:
# Computer Configuration > Administrative Templates > System > LAPS
#   - Configure password backup directory: Active Directory
#   - Password complexity: large letters + small letters + numbers + specials
#   - Password length: 24+
#   - Password age in days: 30

# Verify the schema extensions are installed
Update-LapsADSchema

# Grant a specific group read access on an OU
Set-LapsADReadPasswordPermission -Identity "OU=Workstations,DC=corp,DC=example,DC=com" -AllowedPrincipals "LAPS-Readers"

# Read a password (as an authorized principal)
Get-LapsADPassword -Identity "WORKSTATION42"
```

A modern AD security baseline includes LAPS for workstations and a separate scheme (jump-host PAM, just-in-time accounts) for servers. Servers are typically too sensitive for LAPS alone — privileged sessions go through a Privileged Access Workstation (PAW) and are audited end-to-end.

## Further reading

- [Microsoft Windows LAPS documentation](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview).
- [SpecterOps LAPS Threat Hunting Guide](https://specterops.io/blog/) — how detection content can surface LAPS abuse.
- [Active Directory Security Baseline (CIS)](https://www.cisecurity.org/cis-benchmarks/).
