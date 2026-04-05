# Compliance

Patchwork maps your audit data to real-world compliance frameworks, evaluating which controls are met, partially met, or failing — and generating reports that auditors can review.

## Supported Frameworks

| Framework | Controls | Focus |
|-----------|----------|-------|
| **SOC 2** | Type II controls | Security, availability, processing integrity |
| **ISO 27001** | Annex A controls | Information security management |
| **EU AI Act** | Articles 12-15 | AI system transparency and logging |
| **NIST AI RMF** | GOVERN, MAP, MEASURE, MANAGE | AI risk management |
| **OWASP AI** | Top 10 AI risks | Application security for AI |
| **PCI DSS** | Requirement 10 | Audit trail requirements |
| **HIPAA** | Security Rule | Audit controls for health data |

## How It Works

The compliance engine doesn't just check boxes — it evaluates your actual audit data against each framework's requirements:

### What Gets Evaluated

- **Logging completeness** — are all AI actions being captured?
- **Chain integrity** — is the hash chain unbroken?
- **Seal coverage** — are logs being periodically sealed?
- **Witness verification** — are seals independently confirmed?
- **Policy enforcement** — is a security policy active and enforced?
- **Denial rate** — are dangerous actions being blocked?
- **Session coverage** — are all sessions accounted for?
- **Risk distribution** — what percentage of actions are high/critical risk?

### Control Statuses

| Status | Meaning |
|--------|---------|
| **Pass** | Control is fully met by current audit data |
| **Partial** | Control is partially met — some requirements satisfied |
| **Fail** | Control is not met — remediation needed |
| **N/A** | Insufficient data to evaluate |

## Generating Reports

```bash
# Full compliance report (all frameworks)
patchwork report --framework all

# Specific framework
patchwork report --framework soc2
patchwork report --framework eu-ai-act

# With gap analysis and remediation steps
patchwork report --framework all --include-gaps

# With compliance trends over time
patchwork report --framework all --include-trends

# JSON format for programmatic consumption
patchwork report --framework all --format json

# Specific time period
patchwork report --since 2026-01-01
```

Reports are saved to `~/.patchwork/reports/` by default, or specify a path with `-o`.

## Example: EU AI Act Compliance

The EU AI Act (Articles 12-15) requires AI systems to maintain logs of their operations. Here's how Patchwork maps to these requirements:

| Article | Requirement | How Patchwork Satisfies It |
|---------|------------|---------------------------|
| Art. 12(1) | Automatic recording of events | Every AI tool call logged with timestamp, action, risk, context |
| Art. 12(2) | Traceability of AI operations | Hash-chained events with session tracking and project context |
| Art. 13(1) | Transparency of AI operation | Web dashboard, event search, session replay |
| Art. 14(1) | Human oversight capability | Policy enforcement blocks dangerous actions before execution |
| Art. 15(1) | Accuracy and robustness | Tamper-proof logging with 5-layer integrity architecture |

## Gap Analysis

When you run a report with `--include-gaps`, Patchwork identifies what's missing and suggests remediation:

```
Gap Analysis:
  1. Witness endpoints not configured
     Remediation: Configure at least one witness endpoint
     in /Library/Patchwork/relay-config.json to enable
     independent seal verification.
     Impact: SOC 2 CC7.2, ISO 27001 A.12.4.3

  2. No system-level policy enforced
     Remediation: Run sudo bash scripts/system-install.sh
     to deploy root-owned policy that non-admin users
     cannot modify.
     Impact: EU AI Act Art. 14(1), SOC 2 CC6.1
```

## CI/CD Integration

Use the [GitHub Action](/guides/github-action) to enforce compliance in your CI pipeline:

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    profile: strict
```

The action fails the build if the audit trail is broken, policy violations are detected, or compliance requirements aren't met.

## Next Steps

- [Seals & Witnesses](/concepts/seals-and-witnesses) — strengthen compliance posture with independent verification
- [Policy Enforcement](/guides/policy) — define and enforce security rules
- [GitHub Action](/guides/github-action) — automate compliance checks in CI
