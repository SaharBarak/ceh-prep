---
title: SQL Injection
slug: sql-injection
category: attacks
summary: SQL Injection (SQLi) is a code-injection vulnerability where attacker-controlled input is interpolated into a database query, letting the attacker change the query's intent — read other users' data, bypass authentication, or execute commands on the database host.
related: [cross-site-scripting, owasp-top-10, burp-suite, nmap, sqlmap, idor]
aliases: [SQLi, SQL Injection Attack, Database Injection]
updated: 2026-05-24
---

**SQL Injection** (SQLi) is a code-injection vulnerability where attacker-controlled input is interpolated into a database query, letting the attacker change the query's intent. It has been in the [OWASP Top 10](/wiki/owasp-top-10) for over two decades and remains one of the highest-frequency findings on real web applications.

## How it works

A vulnerable login form might run:

```sql
SELECT * FROM users WHERE email = '<USER_INPUT>' AND password = '<PASSWORD>'
```

If the application concatenates the user's email directly into the query, an input of `' OR '1'='1' --` mutates it to:

```sql
SELECT * FROM users WHERE email = '' OR '1'='1' -- ' AND password = '...'
```

The trailing `--` comments out the password check; the `OR '1'='1'` matches every row. The first user in the table is now authenticated.

The bug isn't the database — it's the application treating user data as code.

## Exploitation classes

SQLi attacks split into four canonical patterns:

| Class | Signal | When to use |
|---|---|---|
| **Error-based** | The database leaks an error message containing the query fragment. | Fastest path when verbose errors are enabled. |
| **Union-based** | Append `UNION SELECT ...` to merge attacker rows into the legitimate result set. | When the page renders query output. |
| **Boolean blind** | Flip the `WHERE` clause to true / false and read the page diff. | When errors are suppressed but the page still differs. |
| **Time-based blind** | Inject `SLEEP(5)` or `pg_sleep(5)` and measure response latency. | When the page is identical for true and false. |
| **Out-of-band** | The database makes a DNS/HTTP request the attacker controls. | When the app is completely silent. |

## Tools

- **[sqlmap](https://github.com/sqlmapproject/sqlmap)** — automates detection and exploitation across all major databases. The de-facto standard for triage.
- **[Burp Suite](/wiki/burp-suite) Intruder** — for hand-crafted payload fuzzing when sqlmap fails (heavily-WAF'd endpoints).
- **DBMS-specific notes** — MSSQL gives stacked queries via `;` separator; MySQL doesn't by default. PostgreSQL has `COPY ... TO PROGRAM` for OS command execution. Knowing the dialect changes the payload set.

## Detection

The reliable hand-test sequence:

1. Append a single quote to a parameter — watch for an error or 500 status.
2. Inject `' OR '1'='1' --` — watch for unconditional row-sets.
3. Inject `' AND SLEEP(5) --` — measure latency to confirm blind.

Static analysis catches obvious string concatenation; runtime detection catches the rest via WAF signatures (which the attacker will then bypass via case-shuffling, comment-splitting, or hex-encoding the keywords).

## Mitigation

The single load-bearing defense:

- **Parameterized queries.** The query template is fixed at compile time; the user input is passed as a separate parameter the database treats as data, not code. Every modern ORM (Hibernate, SQLAlchemy, Mongoose, Active Record) defaults to this. The bug remains in code that bypasses the ORM with raw query strings.

Defense-in-depth additions:

- **Least-privileged database users** — the web app's database user should only have the privileges it needs. No `DROP`, no `GRANT`, no `xp_cmdshell`.
- **WAF in front of legacy code** — not a primary defense (every WAF gets bypassed eventually), but useful while migrating.
- **Output encoding** — separate concern but related: encoding query output as HTML on the way back to the browser prevents [Cross-Site Scripting](/wiki/cross-site-scripting) chains from a partial SQLi.

## Real-world examples

- **CVE-2017-8295** (WordPress) — a header-injection chain landed an SQLi in WordPress 4.7.
- **CVE-2019-10068** (Magento Commerce) — pre-auth SQLi → full database read on every Magento store running an unpatched version.
- **MOVEit Transfer (2023)** — the Clop ransomware group's mass exploitation campaign began with a SQLi in MOVEit's web upload flow.

## Further reading

- [PortSwigger Web Security Academy: SQL injection](https://portswigger.net/web-security/sql-injection) — free interactive labs, the canonical starting point.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
- [Bobby Tables](https://bobby-tables.com/) — the parameterized-query gallery across every major language.
