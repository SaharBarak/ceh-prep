---
title: NIST Cybersecurity Framework
slug: nist-csf
category: standards
summary: The NIST Cybersecurity Framework (CSF) is a voluntary, outcome-based framework published by the U.S. National Institute of Standards and Technology that organizes cybersecurity work into six functions — Govern, Identify, Protect, Detect, Respond, and Recover. It is the most widely-adopted security program structure in the United States and a common reference internationally.
related: [mitre-attck, owasp-top-10, cvss, defense-in-depth, zero-trust]
aliases: [CSF, NIST CSF, Cybersecurity Framework, NIST Framework]
updated: 2026-05-25
---

The **NIST Cybersecurity Framework** (CSF) is a voluntary, outcome-based framework published by the U.S. National Institute of Standards and Technology. First released in 2014 under Executive Order 13636 and updated to **CSF 2.0** in February 2024, it organizes cybersecurity work into six functions and provides a common vocabulary for boards, executives, and engineers to discuss security posture.

CSF is **not prescriptive** — it does not say "use X tool" or "do Y exact thing." It describes outcomes ("Protect.Awareness Training is performed") and leaves the implementation choice to the organization. That property is why it has succeeded as the lingua franca: it survives across industries, regulations, and tech stacks.

## The six functions (CSF 2.0)

```
                    ┌──────────┐
                    │  GOVERN  │  Strategy, risk management, supply chain
                    └────┬─────┘  (the function added in 2.0)
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
  ┌────▼─────┐     ┌─────▼─────┐      ┌─────▼─────┐
  │ IDENTIFY │     │  PROTECT  │      │  DETECT   │
  └──────────┘     └───────────┘      └───────────┘
                         │
                  ┌──────┴──────┐
                  │             │
            ┌─────▼─────┐  ┌────▼─────┐
            │  RESPOND  │  │ RECOVER  │
            └───────────┘  └──────────┘
```

| Function | What it covers |
|---|---|
| **Govern (GV)** | Strategy, policy, risk tolerance, supply chain, oversight, accountability. New in 2.0. |
| **Identify (ID)** | Asset management, business environment, governance (legacy), risk assessment. |
| **Protect (PR)** | Identity and access management, awareness training, data security, platform security, technology infrastructure resilience. |
| **Detect (DE)** | Continuous monitoring, adverse event analysis. |
| **Respond (RS)** | Incident management, analysis, mitigation, reporting, communication. |
| **Recover (RC)** | Incident recovery plan execution, communication. |

The framework's logic: a mature program covers all six. A program that's strong in Protect but absent in Detect / Respond is brittle — when prevention fails, nothing catches it.

## Categories and subcategories

Each function decomposes into **categories** (Asset Management, Identity Management, Awareness Training, etc.) and each category into **subcategories** — specific outcomes you can measure against. Example:

```
PROTECT (PR)
├── PR.AA Identity Management, Authentication, and Access Control
│   ├── PR.AA-01: Identities and credentials are managed and issued
│   ├── PR.AA-02: Identities are proofed and bound to credentials
│   ├── PR.AA-03: Users, services, and hardware are authenticated
│   ├── PR.AA-05: Access permissions and authorizations are managed
│   └── ...
```

There are ~100 subcategories total in CSF 2.0 — concrete enough to act on, generic enough to fit any organization.

## Implementation tiers

CSF describes four **implementation tiers** for an organization's risk management maturity:

| Tier | Name | Posture |
|---|---|---|
| 1 | Partial | Ad-hoc risk management; limited awareness; informal communication. |
| 2 | Risk Informed | Some processes defined; risk-management practices approved by management but not org-wide. |
| 3 | Repeatable | Formal risk-management practices, regularly updated, with org-wide cybersecurity processes. |
| 4 | Adaptive | Continuous improvement; risk-informed culture; lessons-learned feedback loops. |

Tiers are not maturity *targets* — Tier 4 is not always desirable. A small org may consciously operate at Tier 2 because Tier 4 has costs disproportionate to their risk.

## Profiles

A **Profile** is a specific selection of the framework's subcategories that matches an organization's mission, risk tolerance, and resources. Two common profile concepts:

- **Current Profile** — what the organization actually does today.
- **Target Profile** — where it wants to be.

The gap between Current and Target is the roadmap.

## Mapping to other frameworks

CSF is widely cross-referenced to other standards. The Informative References in each subcategory point to:

| Framework | What it adds |
|---|---|
| **NIST SP 800-53** | Concrete control specifications (the detailed how, not the outcome). |
| **ISO 27001 / 27002** | International equivalent; many subcategories map cleanly. |
| **CIS Critical Security Controls** | Top-18 prioritized control list. |
| **COBIT 2019** | IT governance perspective. |
| **PCI DSS** | Payment-card-specific requirements often map to CSF Protect subcategories. |

This makes CSF useful as the *index* you cross-reference more specific frameworks against.

## Why it's adopted

CSF has become the default U.S. security framework because:

1. **Vendor-neutral.** Doesn't favor specific tooling.
2. **Outcome-based.** Survives technology change ("authenticate users" is timeless; "use SHA-1 with HMAC" isn't).
3. **Translatable across audiences.** Boards understand "we're a Tier 2 in Detect, our target is Tier 3 in 18 months." Engineers understand the underlying subcategories.
4. **Federally endorsed.** Federal agencies use it; federal contractors map their programs to it; momentum compounds.
5. **Free.** No license fee, unlike ISO 27001 documentation.

## How CSF intersects with other concepts on this site

| CSF surface | Wiki article |
|---|---|
| Detect.AE — Adversary Emulation Plans | [MITRE ATT&CK](/wiki/mitre-attck) |
| Protect.PS — Platform Security | [Defense in Depth](/wiki/defense-in-depth), [Zero Trust](/wiki/zero-trust) |
| Protect.AA — Identity and Access Control | [Active Directory](/wiki/active-directory), [Principle of Least Privilege](/wiki/principle-of-least-privilege), [LAPS](/wiki/laps) |
| Identify.RA — Risk Assessment | [CVSS](/wiki/cvss), [CVE](/wiki/cve) |
| Detect.CM — Continuous Monitoring | [SIEM](/wiki/siem), [EDR](/wiki/edr) |
| Respond.AN — Analysis | The work [SOC analysts](/wiki/soc-analyst) do |

## CSF 2.0 vs CSF 1.1 — what changed

- **Govern** function added — formalizes board-level accountability, risk strategy, supply chain risk, cybersecurity policy. CSF 1.1 had governance buried in Identify.
- **Expanded supply chain risk** — recognition that SolarWinds-style attacks demand explicit attention.
- **Tightened to fewer overlapping categories.**
- **More mappings** to other frameworks, more usable Informative References.

## Common pitfalls

- **Treating CSF as a checklist.** It's not. Each subcategory's outcome can be achieved many ways; the framework expects you to choose.
- **Setting Target Profile at Tier 4 by default.** Cost-prohibitive for most. Match the Tier to the org's risk tolerance and budget.
- **Mapping every regulation to CSF and stopping there.** CSF complements regulations like PCI DSS; it doesn't replace their specific mandates.
- **No follow-through on Govern.** Skipping the strategic and governance work because it's not technical leaves the rest of the program directionless.

## Further reading

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework).
- [NIST CSF 2.0 reference tool](https://csrc.nist.gov/Projects/Cybersecurity-Framework/Filters).
- [CIS Controls v8 — operationalized control set](https://www.cisecurity.org/controls).
- [NIST SP 800-53 — detailed controls](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final).
