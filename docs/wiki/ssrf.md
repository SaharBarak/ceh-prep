---
title: Server-Side Request Forgery
slug: ssrf
category: attacks
summary: Server-Side Request Forgery (SSRF) is a web vulnerability where an attacker causes a server to make HTTP requests to URLs the attacker controls, typically targeting internal services, cloud metadata endpoints, or otherwise unreachable hosts.
related: [csrf, cross-site-scripting, owasp-top-10, cloud-imds]
aliases: [SSRF, Server Side Request Forgery]
updated: 2026-05-24
---

**Server-Side Request Forgery** (SSRF) is a web vulnerability where an attacker causes the server to make outbound HTTP requests to URLs the attacker supplies. Because the request originates from inside the trust boundary, it can reach internal services that aren't exposed to the internet — metadata services, internal admin panels, cloud APIs.

SSRF earned its own [OWASP Top 10](/wiki/owasp-top-10) entry as **A10** in 2021 because of how consistently it chains into cloud account compromise.

## The canonical chain

The single highest-impact SSRF target in 2020-2025 has been the **AWS Instance Metadata Service** (IMDS) at `http://169.254.169.254`. From an EC2 instance:

```
GET http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

returns the role name. A second request to that path returns *temporary IAM credentials* — `AccessKeyId`, `SecretAccessKey`, `SessionToken`. The attacker now has API access to whatever the EC2's role grants. On a misconfigured account, that's full account compromise.

The Capital One breach (2019, 100M records exfiltrated) was this chain end-to-end: a misconfigured WAF rule allowed SSRF to reach IMDS, which returned credentials for an S3-listing role, which then enumerated and downloaded the data.

Equivalent chains exist on every major cloud:

- **Azure** — `http://169.254.169.254/metadata/identity/oauth2/token?...` (managed identity token).
- **GCP** — `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token` (requires the `Metadata-Flavor: Google` header).

## Other SSRF impacts

Beyond cloud-credential theft:

- **Internal port scanning** — the attacker tells the server to fetch `http://10.0.0.5:8080`, watches the response time / status, and maps the internal network.
- **Admin-panel access** — many internal tools (Jenkins, Grafana, Elasticsearch) bind to localhost and trust requests from there.
- **File-protocol leakage** — `file:///etc/passwd` reads local files on parsers that accept arbitrary URL schemes.
- **Pivot to other protocols** — `gopher://` and `dict://` can sometimes deliver TCP payloads, including unauthenticated Redis commands.

## How SSRF lands in code

Anywhere user input flows into an HTTP client. The pattern:

```python
url = request.json["image_url"]
response = requests.get(url)
return process_image(response.content)
```

Image-resizing services, link-preview generators, webhook delivery, OAuth callback handlers, PDF generators, and "import from URL" features are the recurring categories.

## Mitigation

The reliable defense is a multi-layer allow-list:

1. **Allow-list the destination.** If the feature is "fetch the user's webhook URL," only allow URLs the user has registered. If it's "fetch any image URL," restrict to known image hosts (and resolve to public IPs only).

2. **Block private IP ranges at resolution time.** RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), the link-local range (`169.254.0.0/16` — covers cloud metadata), loopback (`127.0.0.0/8`), and `0.0.0.0`. Block both `IN A` and `IN AAAA`. Re-resolve DNS at request time to defeat DNS rebinding.

3. **IMDSv2 specifically.** AWS shipped IMDSv2, which requires a `PUT` to obtain a session token before any `GET`. Enable IMDSv2-only mode on every instance; this defeats the simple `curl http://169.254.169.254/...` path that the Capital One chain used.

4. **Egress proxy.** Route every outbound HTTP from the app through a proxy that enforces the allowlist at the network level. Catches SSRF that escaped the application-layer check.

## DNS rebinding — the bypass to know

If the SSRF check happens by URL but the fetch happens by IP, the attacker can serve a DNS record that resolves to a public IP on the first lookup (passing the check) and to `169.254.169.254` on the second lookup (the actual fetch). DNS rebinding defeats naive allow-listing.

The defense: resolve the URL to an IP *once*, check the IP, then make the request to that IP (passing `Host:` header explicitly). Don't let the URL be re-resolved by the HTTP library.

## Detection

- **Burp Collaborator** — generate a unique subdomain, inject it into every URL-accepting parameter, watch the Collaborator for callbacks. Catches blind SSRF.
- **Time-based** — point the parameter at an internal IP that's slow to respond vs. a known-fast one; compare latencies.

## Real-world examples

- **Capital One (2019)** — SSRF → IMDS → IAM creds → S3 enumeration. 100M records, ~$300M cost.
- **Shopify (2019)** — SSRF in image-resizer triggered $25,000 bounty.
- **Microsoft Exchange CVE-2021-26855 ("ProxyLogon")** — SSRF chain that enabled the 2021 mass-exploitation campaign.

## Further reading

- [PortSwigger Web Security Academy: SSRF](https://portswigger.net/web-security/ssrf) — interactive labs.
- [AWS IMDSv2 documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-options.html).
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
