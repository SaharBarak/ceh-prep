---
title: BloodHound
slug: bloodhound
category: tools
summary: BloodHound is an open-source tool that uses graph theory to find attack paths in Active Directory environments. It ingests AD object relationships into a Neo4j database and renders shortest-path queries between an attacker's current foothold and high-value targets like Domain Admin.
related: [active-directory, kerberos, kerberoasting, mimikatz, pass-the-hash, ldap, laps]
aliases: [BloodHound CE, BloodHound Community Edition, SharpHound]
updated: 2026-05-25
---

**BloodHound** is an open-source tool maintained by [SpecterOps](https://specterops.io/) that uses graph theory to find attack paths inside [Active Directory](/wiki/active-directory) environments. It ingests every relevant relationship in the AD — users, groups, sessions, ACLs, GPO links, trust edges — into a Neo4j graph database, then surfaces *paths* between an attacker's current identity and a high-value target (typically Domain Admin) via Cypher queries the UI provides.

BloodHound transformed AD attack methodology in 2016 because it surfaced abuse paths that no human would find by hand — `WriteDACL` chains, ten-hop session-based pivots, GPO-link abuse. By 2026 it is the single most important tool on any modern internal Active Directory engagement.

## The two halves: collector + visualizer

BloodHound splits into a **collector** that gathers data from AD and an **interface** that queries the graph:

- **Collectors:**
  - **SharpHound** (.NET, Windows-native) — `SharpHound.exe -c All`. Run from a domain-joined Windows host.
  - **BloodHound.py** (Python via Impacket) — `bloodhound-python -c All -u user -p pass -d domain.local -ns DC_IP`. Run from Linux/WSL, no AD-joined host required.
  - **AzureHound** — separate collector for Azure AD / Entra ID.

Both produce `.json` files. Drop them into the BloodHound UI's import surface.

- **Interface:**
  - **BloodHound CE (Community Edition)** — the rewritten, Docker-deployable version with a modern UI. The default since 2023.
  - **BloodHound Legacy** — the original Electron app. Still works but unmaintained.

## What it actually sees

SharpHound collects:

| Data class | What it captures |
|---|---|
| **Sessions** | Which user has an active login on which computer right now. The killer feature — lets you plan lateral moves toward higher-privilege accounts. |
| **Local admin** | Which user/group is local admin on which computer. |
| **ACLs** | Per-object access control entries: `GenericAll`, `WriteDACL`, `ForceChangePassword`, `AddSelf`, etc. The exhaustive list of abusable edges. |
| **Group membership** | Recursive group → group → user expansion. |
| **Trusts** | Inter-forest and inter-domain trust relationships. |
| **GPO links** | Which Group Policy Objects apply to which OUs. |
| **AD CS** | Certificate template configurations (since the BloodHound 4.2 update). |

The full collection set (`-c All`) is the most useful but the loudest on the wire. Defenders can detect SharpHound by the volume + pattern of LDAP queries it makes. Stealth-conscious operators use `-c Session` for repeated, smaller collections.

## The killer queries

BloodHound ships with prebuilt Cypher queries:

- **Shortest path from owned users to Domain Admins** — the textbook "where am I going?" query.
- **Find principals with DCSync rights** — the path to KRBTGT and Golden Tickets.
- **Find Kerberoastable accounts with most privileges** — prioritize which [Kerberoasting](/wiki/kerberoasting) target to crack first.
- **Find computers with unconstrained delegation** — the [NTLM relay](/wiki/ntlm) + coerced-auth target list.
- **Shortest paths from a Tier 2 to Tier 0 server** — tier-0 isolation audit.

Custom Cypher is the power tool. Example: "find any path from members of group X to membership in group Y":

```cypher
MATCH p = shortestPath((u:User)-[*1..]->(g:Group))
WHERE u.name CONTAINS "HELPDESK" AND g.name CONTAINS "DOMAIN ADMINS"
RETURN p
```

The graph surfaces the abuse chain visually, edge by edge. Each edge is clickable for documented exploitation steps.

## The abuse edges to know

BloodHound's documentation includes a write-up per edge type. The frequently-load-bearing ones:

| Edge | What it lets the attacker do |
|---|---|
| **MemberOf** | Inherit the target group's permissions. |
| **GenericAll** | Reset the target's password, add SPN for Kerberoasting, anything else. Full control. |
| **GenericWrite** | Write any attribute. Common abuse: set SPN → Kerberoast. |
| **WriteDACL** | Grant yourself any other right on the target. |
| **WriteOwner** | Take ownership, then grant yourself anything. |
| **ForceChangePassword** | Change the target user's password (without knowing the old one). |
| **AllowedToDelegate** | Constrained delegation — impersonate any user to a specific service. |
| **GetChanges + GetChangesAll** | Replication rights — enables DCSync against any domain user. |
| **AddMember** | Add yourself to the target group. |
| **AddAllowedToAct** | Resource-based constrained delegation primitive. |
| **HasSession** | Logged-in session on a compromised computer — credentials in LSASS. |

## Defender use

BloodHound is dual-use. Blue teams should run it against their own environment regularly:

- **Surface unintended attack paths** before red teams (or attackers) do.
- **Tier-0 audit** — find every path from a non-tier-0 principal to a tier-0 asset. Each is a misconfiguration to fix.
- **GPO link audits.**
- **Stale-session audit** — surface sessions of decommissioned accounts, old service accounts, etc.

The defender's challenge is closing the paths BloodHound finds: each removal is an operations task that can break legitimate workflows. Modern AD-hardening tools (PingCastle, Purple Knight, BloodHound Enterprise) productize this loop.

## Real-world detection signatures

SharpHound's data collection generates detectable patterns:

- **Event ID 4661** with `Object Type: SAM_USER` from a single user across a large fraction of the directory — directory enumeration signature.
- **Event ID 4624** (logon type 3) volume spikes from one source against many DCs.
- **LDAP queries** with the specific filter shapes SharpHound uses (the queries are open-source — defenders can fingerprint them).

The mitigation isn't to block BloodHound — it's to make the data BloodHound returns less useful by closing the underlying abuse paths.

## Further reading

- [BloodHound documentation](https://bloodhound.specterops.io/).
- [SpecterOps blog (AD attack-path research)](https://posts.specterops.io/).
- [HackTricks: BloodHound](https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/bloodhound).
- [The Hacker Recipes: BloodHound](https://www.thehacker.recipes/a-d/movement/builtin/bloodhound).
