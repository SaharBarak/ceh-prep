---
title: GDPR
slug: gdpr
category: standards
summary: The General Data Protection Regulation (GDPR) is the European Union's comprehensive data protection law, in force since May 2018. It defines what counts as personal data, who is responsible for protecting it, what rights individuals have over it, and what penalties apply when organizations fail. GDPR is the most influential privacy law of the modern era — most subsequent national privacy laws are derivative.
related: [owasp-top-10, nist-csf, defense-in-depth, principle-of-least-privilege]
aliases: [General Data Protection Regulation, EU GDPR, GDPR 2016/679]
updated: 2026-05-25
---

The **General Data Protection Regulation** (Regulation (EU) 2016/679, "GDPR") is the European Union's comprehensive data protection law, in force since 25 May 2018. It defines what counts as personal data, who is responsible for protecting it, what rights individuals have over it, and what penalties apply to organizations that mishandle it. GDPR is the most influential privacy law of the modern era — California's CCPA, Brazil's LGPD, India's DPDP Act, and most other major privacy regimes are derivative.

GDPR applies extraterritorially: any organization processing personal data of EU residents must comply, regardless of where the organization is based. A SaaS company in California with European users is in scope.

## Key terms

| Term | Meaning |
|---|---|
| **Personal data** | Any information relating to an identified or identifiable natural person. Names, emails, IP addresses, cookie IDs, location data — all in scope. |
| **Data subject** | The individual whose data is being processed. |
| **Controller** | The organization that decides *why* and *how* personal data is processed. The accountable party. |
| **Processor** | A third party that processes data on behalf of a controller (cloud provider, SaaS vendor, payroll service). |
| **Processing** | Any operation on personal data — collection, storage, modification, retrieval, transmission, deletion. |
| **Special category data** | Heightened-protection categories: health data, biometric data, race, religion, sexual orientation, political opinions, trade union membership. |
| **Personal data breach** | A security incident that results in unlawful destruction, loss, alteration, disclosure, or access to personal data. |

## The principles (Article 5)

Every processing activity must satisfy:

1. **Lawfulness, fairness, transparency** — process data only on a legal basis; tell people what you're doing.
2. **Purpose limitation** — collect data for specified, explicit, legitimate purposes; don't repurpose later.
3. **Data minimization** — collect only what's adequate, relevant, and necessary.
4. **Accuracy** — keep data accurate; correct or delete inaccurate data.
5. **Storage limitation** — retain only as long as necessary for the stated purpose.
6. **Integrity and confidentiality** — protect with appropriate technical and organizational measures.
7. **Accountability** — be able to demonstrate compliance with the above six.

## Lawful bases for processing (Article 6)

You must have *at least one* of these to process personal data:

| Basis | When used |
|---|---|
| **Consent** | The subject has freely given specific, informed, unambiguous consent. |
| **Contract** | Processing necessary to perform a contract with the subject (e.g., shipping their order). |
| **Legal obligation** | Required by law (e.g., tax records, KYC). |
| **Vital interests** | To protect someone's life. |
| **Public task** | Processing necessary for a public-interest task. |
| **Legitimate interests** | The controller's or a third party's legitimate interests, not outweighed by the subject's rights. |

Consent is the most-cited but also the strictest: it must be freely given, specific, informed, unambiguous, and as easy to withdraw as to give. Pre-ticked checkboxes are explicitly invalid.

## Rights of data subjects (Chapter III)

GDPR enumerates rights the individual has against the controller:

| Right | Article | What it requires |
|---|---|---|
| **Information** | 13, 14 | Privacy notice at the point of data collection. |
| **Access** | 15 | A complete copy of all personal data the controller holds about the subject. |
| **Rectification** | 16 | Correction of inaccurate data. |
| **Erasure** ("right to be forgotten") | 17 | Deletion when no longer necessary, consent withdrawn, etc. |
| **Restriction of processing** | 18 | Pause processing pending dispute resolution. |
| **Data portability** | 20 | A machine-readable export of data the subject provided. |
| **Object** | 21 | Stop direct marketing, profiling, certain legitimate-interests processing. |
| **Not be subject to automated decision-making** | 22 | A right to a human in decisions with significant effects. |

These rights are why most modern apps now ship an "Export my data" button (Article 15 / 20) and an "Delete my account" flow (Article 17). The 30-day response window is the operational deadline.

## Security obligations (Article 32)

GDPR does not list specific controls; it requires "appropriate technical and organizational measures" considering the state of the art, costs, and risk to subjects. The non-exhaustive examples:

- Pseudonymization and encryption of personal data.
- Ongoing confidentiality, integrity, availability, and resilience of processing systems.
- Ability to restore availability and access after an incident.
- Regular testing and evaluation of security measures.

This is where [NIST CSF](/wiki/nist-csf), [Zero Trust](/wiki/zero-trust), [Defense in Depth](/wiki/defense-in-depth), and [Principle of Least Privilege](/wiki/principle-of-least-privilege) intersect — they are the means by which "appropriate measures" are operationalized.

## Breach notification (Articles 33, 34)

Two timelines after a personal data breach:

1. **Within 72 hours of awareness**, notify the relevant supervisory authority — *unless* the breach is unlikely to result in risk to data subjects.
2. **Without undue delay**, notify the affected data subjects directly if the breach is *likely* to result in high risk to their rights.

The 72-hour clock has consequences for incident response design. Detection and triage need to produce a "is this a notifiable breach?" determination quickly — which is why [SIEM](/wiki/siem) / [EDR](/wiki/edr) telemetry and well-documented IR runbooks matter for GDPR posture, not just security.

## Penalties

GDPR has a two-tier penalty structure:

- **Up to €10 million or 2% of global annual turnover** (whichever higher) — for organizational obligations (records of processing, breach notification, etc.).
- **Up to €20 million or 4% of global annual turnover** (whichever higher) — for breaches of subject rights, principles, transfers.

Big-ticket enforcement actions: Meta (€1.2 billion, 2023, US data transfers), Amazon (€746 million, 2021, advertising-cookie consent), Google (€90 million, 2022, consent UX).

## Cross-border data transfers (Chapter V)

Transferring personal data outside the EU/EEA requires one of:

- **Adequacy decision** — the destination country has been ruled to offer equivalent protection (Japan, UK, South Korea, Switzerland, etc.). The US has the **EU-US Data Privacy Framework** as of 2023.
- **Standard Contractual Clauses (SCCs)** — contractual commitments approved by the Commission.
- **Binding Corporate Rules (BCRs)** — for intra-group transfers, pre-approved by authorities.
- **Derogations** — limited cases (consent, contract, vital interest).

Post-*Schrems II* (CJEU 2020), even SCC-based US transfers must include supplementary measures if the US legal regime risks government access. This has produced extensive guidance and is a working compliance question for any US-EU SaaS.

## Relation to ePrivacy / cookie law

GDPR coexists with the older **ePrivacy Directive 2002/58/EC** (the "cookie law"). The cookie banners on every European website are the joint product:

- ePrivacy: consent required *before* storing or reading non-essential cookies.
- GDPR: when the cookie ID counts as personal data, GDPR principles also apply.

The pending **ePrivacy Regulation** has been negotiated for years without final agreement; ePrivacy Directive remains in force.

## How a security team experiences GDPR

| Practical work | Why |
|---|---|
| Maintain an inventory of personal data and where it lives | Article 30 records of processing; needed to honor Article 15 access requests. |
| Pseudonymize and encrypt personal data | Article 32 measures; reduces breach impact. |
| Implement Article 15 / 17 / 20 endpoints | Mandatory subject rights. |
| Document a 72-hour breach notification runbook | Article 33. |
| Vendor management (DPAs with processors) | Article 28; controllers are accountable for processor failures. |
| Data Protection Impact Assessments (DPIAs) | Article 35 for high-risk processing. |
| Privacy by design and by default | Article 25 — bake controls into product design. |

## Further reading

- [Regulation (EU) 2016/679 — the official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- [European Data Protection Board (EDPB) guidance](https://edpb.europa.eu/).
- [GDPR.eu — searchable text and commentary](https://gdpr.eu/).
- [Schrems II ruling (CJEU C-311/18)](https://curia.europa.eu/).
