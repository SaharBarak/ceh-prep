# 01 — 7 Claude Prompts Every Cybersecurity Engineer Should Save

- **Source:** Instagram reel — https://www.instagram.com/reel/DW1EWB5DDYO/
- **Author:** [@kerem.tech](https://instagram.com/kerem.tech)
- **Shared:** 2026-04-08
- **Duration:** 8s
- **GitHub repos:** none referenced
- **External links:** [claude.ai](https://claude.ai)

## Caption

Claude is an AI assistant built by Anthropic. For cybersecurity engineers, it works like a second brain that knows every syntax, every framework, and every config format you deal with daily.

Instead of reading documentation for Sigma, YARA, Kubernetes, or GitHub Actions every time you need to write a rule or config, you describe what you want in plain English and Claude generates production-ready output.

7 prompts every cybersecurity engineer should save:

1. **Sigma Rule Generation** — generic detection rule format that works across any SIEM. Describe the attack, get a deployable rule.
2. **YARA Rule Writing** — pattern-matching tool for identifying malware. Define your indicators, get a scanning rule.
3. **CIS Hardening Guide** — industry-standard security baselines for OS/cloud. Pick your OS, get exact commands.
4. **IR Runbook** — step-by-step incident response procedure. Name the scenario, get containment to recovery.
5. **K8s NetworkPolicy** — pod-to-pod traffic control. Describe the segmentation, get a zero-trust YAML.
6. **CI/CD Security Pipeline** — automate SAST, container scanning, secret detection. List your tools, get a working workflow.
7. **Adversary Simulation Plan** — replicates real threat actor TTPs mapped to MITRE ATT&CK. Pick a threat group, get a full exercise plan.

No sensitive data needed in any prompt. No logs, no source code, no infrastructure details. You describe the intent, Claude handles the syntax.

`#cybersecurity #claude #ai #blueteam #infosec`

## Audio transcript

Music only — no spoken content.

## On-screen content (frames)

The reel cycles through stylized "Claude" prompt panels and example outputs. OCR-recovered fragments:

- **CI/CD Security Pipeline** sample
  - `- name: Trivy Container Scan`
  - `uses: actions/checkout@v4`
  - `- args: detect --no-banner` (Gitleaks secret detection, failing on high severity)
  - `exit-code: '1'`
  - Notes: "Add OWASP ZAP for DAST, Checkov for IaC scanning, or swap GitHub Actions for GitLab CI / Jenkins / Azure DevOps syntax."
- **CIS Hardening Guide** sample (Ubuntu 22.04, Level 2 → adjustable to Level 1)
  - `# SSH Hardening` — `/etc/ssh/sshd_config`, `echo 'MaxAuthTries 3' >>`
  - `# Kernel Parameters` — `.accept_redirects=0`, `.randomize_va_space=2`
  - `# Audit Rules` — `auditctl -w /etc/passwd`, `auditctl -w /etc/shadow`, `-p wa -k identity`
- **Sigma detection** sample
  - `EventID: 4648` / `EventID: 5145` / `PSEXESVC`
  - `condition: selection_logon or …`
  - `level: high`

## Tools / keywords

Sigma · YARA · CIS Benchmarks · Kubernetes NetworkPolicy · GitHub Actions · Trivy · Gitleaks · OWASP ZAP · Checkov · MITRE ATT&CK
