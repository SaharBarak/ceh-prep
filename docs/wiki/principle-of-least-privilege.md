---
title: Principle of Least Privilege
slug: principle-of-least-privilege
category: concepts
summary: The Principle of Least Privilege (PoLP) states that every user, process, and component should have only the minimum permissions required to perform its function — and nothing more. It is one of the oldest and most universally cited security principles, and the most consistently violated in practice.
related: [zero-trust, defense-in-depth, active-directory, laps, oauth-2]
aliases: [PoLP, Least Privilege, Principle of Minimum Privilege, POLA, Principle of Least Authority]
updated: 2026-05-25
---

The **Principle of Least Privilege** (PoLP) states that every user, process, service account, and component should have only the minimum set of permissions required to perform its function — and nothing beyond that. The principle was articulated by Saltzer and Schroeder in 1975 ("The Protection of Information in Computer Systems," CACM) and remains foundational to security architecture fifty years later.

It is also the principle organizations most consistently violate. The reasons are operational: it's easier to grant `Domain Admin` than to write a delegation; easier to attach `*` IAM permissions than to scope them; easier to give a service account local admin than to enumerate which APIs it actually calls. PoLP is a discipline, not a feature you turn on.

## Why it matters

Two reasons:

1. **Blast radius containment.** When a user is phished or a service account is compromised, the attacker inherits exactly the permissions that account had. Least privilege caps the worst case.
2. **Defense in depth complement.** [Defense in Depth](/wiki/defense-in-depth) layers controls; PoLP shrinks the attack surface inside each layer.

A real-world example: a developer's laptop is compromised. If they had `Domain Admin` (because helpdesk handed it out years ago), the attacker now has the domain. If they had a scoped, time-limited just-in-time admin, the attacker has a developer account with read access to a few specific shares — a much smaller incident.

## What PoLP looks like at each layer

| Layer | Anti-pattern | Least-privilege pattern |
|---|---|---|
| **AD / Identity** | Everyone in `Domain Admins` | Tiered admin model (Tier 0 / 1 / 2); JIT elevation; [LAPS](/wiki/laps) for local admin |
| **Cloud IAM** | `*:*` policy on a role | Scoped actions, scoped resources, condition keys; short-lived credentials |
| **App authorization** | Every user can edit every resource | Per-resource ACLs; row-level security; [IDOR](/wiki/idor)-resistant access checks |
| **Service accounts** | Domain admin "for compatibility" | Per-service identity with just the APIs it calls (managed identity / workload identity) |
| **OAuth scopes** | App requests `read_all_data` | App requests only `read:user_profile`, `read:user_calendar` per [OAuth 2.0](/wiki/oauth-2) |
| **Container** | `--privileged`, root user | Dropped capabilities, read-only rootfs, non-root user, seccomp profile |
| **OS** | Devs in `wheel` / `sudoers` ALL | Specific `sudoers` lines per binary; `polkit` rules |
| **Database** | Single user with `GRANT ALL` | Per-service DB user with only the tables and operations it needs |
| **Filesystem** | World-writable `/var` dirs | 0640 + group ACLs |

## The specific failure modes PoLP closes

- **Privilege escalation via stolen credentials** — if the compromised credential has the privilege, the attacker has it. PoLP shrinks the prize.
- **Insider threat / accidental damage** — a developer cannot accidentally `rm -rf /` in production if their account lacks production write access.
- **Misconfigured automation** — a CI job that "needs" full repo write can race-condition itself into pushing to `main`; least-privilege CI tokens scope to specific paths.
- **Lateral movement** — an attacker who lands on an HR workstation cannot pivot to Finance if no shared service accounts span those boundaries.

## How to actually implement it

PoLP rolls out in stages because retrofitting is hard:

1. **Inventory current privilege.** Who is in privileged groups? What can each service account do? Audit cloud IAM for `*` permissions. Tools: [BloodHound](/wiki/bloodhound) for AD, AWS Access Analyzer / GCP Recommender for cloud, custom scripts.
2. **Identify what each principal actually uses.** Log access for 30-90 days. Cloud IAM Access Analyzer can show "this role has 100 permissions; it used 7." Most over-privileged accounts use a tiny fraction of what they're granted.
3. **Narrow the policies.** Replace `*:*` with the specific actions, resources, and conditions observed.
4. **Add monitoring for privilege creep.** Detection rules: "new permission added to privileged role," "service account used a permission it had not used in 90 days."
5. **Introduce time-bound elevation.** Just-in-time (JIT) access via PIM, Identity Now, Teleport — admin permissions granted for the next 2 hours, then revoked.
6. **Repeat indefinitely.** PoLP is not a project; it's a continuous discipline.

## Related but distinct ideas

- **Separation of duties** — no single principal can complete a sensitive transaction alone (the person who initiates a payment cannot approve it). Composes with PoLP but is its own constraint.
- **Need-to-know** — information-classification-flavor of PoLP applied to data rather than actions.
- **Zero standing privilege** — the strict-end version of PoLP: nobody holds privileged permissions outside an active, audited elevation. This is [Zero Trust](/wiki/zero-trust)'s natural endpoint for identity.

## Common pushback (and responses)

| Pushback | Response |
|---|---|
| "Developers will be slowed down." | Real measure: time to obtain elevation should be seconds via self-serve JIT, not days via tickets. Slow elevation defeats PoLP because people work around it. |
| "Service accounts need broad access to be reliable." | Often true at scale; the fix is workload identity per service, not a shared god-account. |
| "We don't have time to audit everything." | Start with the highest-blast-radius: `Domain Admins`, root IAM, prod database users. The 80/20 has high leverage. |
| "We've never been breached, why bother?" | The base rate of breach is rising and PoLP shrinks the eventual loss. The question is when, not if. |

## Further reading

- [Saltzer & Schroeder — "The Protection of Information in Computer Systems" (1975)](https://www.cs.virginia.edu/~evans/cs551/saltzer/) — the canonical paper.
- [Microsoft Privileged Access Workstations & Tiered Admin Model](https://learn.microsoft.com/en-us/security/privileged-access-workstations/).
- [AWS Well-Architected — IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html).
- [Google IAM Recommender](https://cloud.google.com/policy-intelligence/docs/recommender-overview) — automated rightsizing.
