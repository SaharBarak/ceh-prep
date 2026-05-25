---
title: Insecure Direct Object Reference
slug: idor
category: attacks
summary: Insecure Direct Object Reference (IDOR) is a web vulnerability where an application exposes a direct reference to an internal object (a database row, file, or resource) without verifying that the requesting user has the right to access it. It is the canonical broken-access-control bug class.
related: [owasp-top-10, csrf, jwt, burp-suite]
aliases: [IDOR, Insecure Direct Object Reference, Object Reference Vulnerability]
updated: 2026-05-25
---

**Insecure Direct Object Reference** (IDOR) is a web vulnerability where an application exposes a direct reference to an internal object (a database row, file, or resource) — typically as a URL parameter or request body field — and the application fails to verify that the requesting user is authorized to access that specific object.

IDOR sits inside [OWASP Top 10 2021](/wiki/owasp-top-10) **A01 Broken Access Control**, the highest-frequency severe finding category on real web applications. The 2023 OWASP API Top 10 spun out a more specific term — **Broken Object Level Authorization (BOLA)** — which is IDOR applied to API endpoints.

## The canonical example

A user logs into a shopping site. After placing an order they're sent to:

```
GET /orders/100
```

The order page renders correctly. The user changes the URL to:

```
GET /orders/101
```

Another customer's order details appear. The server returned the data because the user was authenticated *as anyone*, but the server failed to check whether order 101 actually belonged to *this* user.

The bug isn't authentication — the user is authenticated. The bug is **authorization**: the application doesn't ask "is this user allowed to see this resource?" before returning it.

## Where IDOR lands in code

Anywhere a resource is fetched by ID supplied by the user. The vulnerable pattern:

```python
@app.route('/orders/<int:order_id>')
def get_order(order_id):
    order = Order.query.get(order_id)  # ← fetches by id, no ownership check
    return jsonify(order.to_dict())
```

The fix is two lines:

```python
@app.route('/orders/<int:order_id>')
def get_order(order_id):
    order = Order.query.get(order_id)
    if order.user_id != session['user_id']:  # ← ownership check
        abort(403)
    return jsonify(order.to_dict())
```

In practice, modern frameworks (Django REST Framework, Rails, Spring Security) provide *DRY* abstractions for this — scoping queries to the current user (`Order.objects.filter(user=request.user)`), permission decorators, ABAC/RBAC libraries. The bug stubbornly persists because:

- Developers forget the check on newer endpoints.
- Different endpoints use different patterns inconsistently.
- New role types (admin, manager, tenant) layer on top of user-ownership and the layered check is missed.
- ID-based scoping breaks down for "shared" or "delegated" resources.

## IDOR variants

The shape of the broken-access-control bug varies:

| Variant | What changes |
|---|---|
| **Numeric ID enumeration** | `?id=100` → `?id=101`. Predictable, easy to exploit. |
| **UUID enumeration** | Same pattern with `?id=abc123-...`. Harder to guess but still exploitable when leaked elsewhere or when the UUID generation is weak (sequential, timestamp-based). |
| **Hashed/base64 reference** | Some apps encode the ID. Doesn't matter — if the decode is reversible, the ID is still user-controlled. |
| **Indirect reference via filename** | `?file=invoice-john.pdf` → `?file=invoice-jane.pdf`. |
| **Role-based bypass** | Change a `role=user` parameter to `role=admin` and the backend trusts it. |
| **Forced browsing** | Endpoints like `/admin/users` not linked from the user-facing UI but accessible by URL. |
| **Insecure tenant isolation** | A B2B SaaS where tenant A's URL pattern includes a tenant ID. Change to tenant B's. |
| **API-version drift** | `/api/v2/orders/{id}` has the ownership check. `/api/v1/orders/{id}` is still online and doesn't. |

## Detection

Manual exploration is the workhorse:

1. Browse the application as user A. Capture every endpoint that includes an ID.
2. Log out, log in as user B. Try every captured URL with user A's IDs.
3. Each one that returns data is an IDOR.

Tools that automate this:

- **[Burp Suite](/wiki/burp-suite) Autorize extension** — runs every authenticated request as a second user (and as anonymous), flags responses that should have been 403 but weren't.
- **Burp Suite Intruder** with two cookie sets — fuzz the ID parameter while toggling sessions.

The defender side detection:

- **Sequential or unusual ID access patterns** in access logs. User A requests orders 100, 101, 102, 103, 104 → likely enumeration.
- **Anomaly detection on cross-user data access.**

## Mitigation

The architectural fix:

1. **Scope queries by ownership.** `WHERE user_id = $current_user` in every SQL query, not just permission checks after the fact. Most modern ORMs make this idiomatic.
2. **Indirect references where appropriate.** Use server-side mappings: `/orders/abc123` where `abc123` is a per-user random key that the server resolves to the actual database row.
3. **Centralized authorization layer.** Frameworks like Cancan (Ruby), Django Guardian, Casbin (Go), AWS Cedar — express authorization rules in one place and enforce them everywhere.
4. **API-version retirement.** When deprecating an old API, actually remove it. Old endpoints with old auth assumptions are landmines.
5. **Automated authorization testing.** CI gate that runs Autorize-style checks against every endpoint on every PR.

## IDOR vs CSRF — distinct bugs

[CSRF](/wiki/csrf) and IDOR get confused. They are different:

- **IDOR** — the attacker is authenticated and accessing resources they shouldn't.
- **CSRF** — the attacker tricks a *victim* into making a request they didn't intend.

Both can be present on the same endpoint. CSRF defends against unintended requests; IDOR defends against authorized but unauthorized actions.

## High-impact IDOR examples

- **Facebook (multiple bounties over the years)** — IDOR on photo URL → access to another user's photos. Paid five figures each instance.
- **Snapchat (2014)** — exposed phone number → user mapping via no-auth-required API endpoint.
- **HackerOne reports search "IDOR"** — hundreds of disclosed reports, almost all paid in the $500-$15000 range, occasionally six figures.

The relentless presence in bug bounty makes IDOR one of the highest-paying-per-effort bug classes for newer hunters — the bugs require no exploitation cleverness, just methodical testing.

## Further reading

- [PortSwigger Web Security Academy: Access control vulnerabilities](https://portswigger.net/web-security/access-control).
- [OWASP A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).
- [OWASP API Security: BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
- [HackerOne: IDOR top reports](https://hackerone.com/hacktivity?query=type%3Apublic%20IDOR).
