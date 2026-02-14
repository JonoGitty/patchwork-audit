# Security Policy

## Supported Versions

Security fixes are prioritized for:

- Latest release on `main`
- Any explicitly supported release branches

Older tags/branches may not receive security patches.

## Reporting a Vulnerability

Please report vulnerabilities privately.

Preferred:

- GitHub Security Advisories: `https://github.com/JonoGitty/codex-audit/security/advisories/new`

If advisory submission is unavailable, open a private communication channel with the maintainers and include:

- Description of the issue
- Affected files/components
- Reproduction steps or proof of concept
- Impact assessment
- Suggested remediation (if known)

## Response Expectations

- Initial triage target: within 5 business days
- If accepted, remediation target is based on severity and exploitability
- Coordinated disclosure is preferred after a fix is available

## Scope

In scope:

- CLI command injection or unsafe execution paths
- Policy bypass or enforcement failures
- Event tampering, seal/attestation bypass, integrity failures
- Unsafe handling of secrets in logs or exports

Out of scope (unless chained with impact):

- Best-practice suggestions without a concrete exploit path
- Denial of service requiring unrealistic local privileges

## Safe Harbor

Good-faith security research is welcomed. Please avoid:

- Accessing other users' data
- Modifying production data without permission
- Public disclosure before maintainers have a chance to address the issue
