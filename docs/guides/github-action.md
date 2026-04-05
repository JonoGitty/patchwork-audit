# Patchwork GitHub Action

Gate deployments on AI coding agent audit trail completeness. Verify hash chain integrity, policy compliance, and generate signed attestation artifacts — all in your CI pipeline.

## Quick start

```yaml
# .github/workflows/audit-gate.yml
name: Audit Trail Gate
on: [push]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: JonoGitty/patchwork@v1
        id: audit

      - name: Deploy
        if: steps.audit.outputs.pass == 'true'
        run: echo "Audit passed — deploying"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `profile` | `strict` | Enforcement profile: `strict` (all checks) or `baseline` (audit-only) |
| `events-file` | auto-discover | Path to audit events JSONL. Auto-discovers from `.patchwork/events.jsonl` or `~/.patchwork/events.jsonl` |
| `seals-file` | auto-discover | Path to seals JSONL |
| `witnesses-file` | auto-discover | Path to witness records |
| `attestation-output` | `audit-attestation.json` | Where to write the attestation artifact |
| `node-version` | `22` | Node.js version |
| `patchwork-version` | `latest` | `patchwork-audit` npm version to install |
| `fail-on-error` | `true` | Fail the step if verification fails |
| `upload-attestation` | `true` | Upload attestation as a GitHub artifact |
| `verify-flags` | `""` | Additional flags passed to `patchwork verify` |
| `attest-flags` | `""` | Additional flags passed to `patchwork attest` |

## Outputs

| Output | Description |
|--------|-------------|
| `pass` | `true` or `false` — whether verification passed |
| `total-events` | Total number of audit events |
| `chained-events` | Number of events with hash chain links |
| `attestation-path` | Path to the generated attestation file |
| `verify-json` | Full verification result as a JSON string |

## How to get audit data into CI

### Pattern 1: Commit to your repo (simplest)

Add your Patchwork audit data to version control:

```bash
# After running AI coding sessions locally
git add .patchwork/events.jsonl .patchwork/seals.jsonl
git commit -m "Update audit trail"
git push
```

The action auto-discovers `.patchwork/events.jsonl` in the repo root.

### Pattern 2: Pass custom paths

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    events-file: audit/events.jsonl
    seals-file: audit/seals.jsonl
```

### Pattern 3: Download from another job

```yaml
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - run: patchwork export --format json -o audit-data.json
      - uses: actions/upload-artifact@v4
        with:
          name: audit-data
          path: .patchwork/

  verify:
    needs: collect
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: audit-data
          path: .patchwork/
      - uses: JonoGitty/patchwork@v1
```

## Examples

### Strict enforcement (recommended for production)

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    profile: strict
    fail-on-error: true
```

This requires:
- Valid hash chain (no tampering)
- HMAC seal present and valid
- Remote witness anchored
- Signed attestation with binding fields

### Baseline (audit-only, no enforcement)

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    profile: baseline
    fail-on-error: false
```

Records verification results without failing the pipeline.

### Custom verification flags

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    profile: baseline
    verify-flags: "--require-seal --max-seal-age-seconds 86400"
    fail-on-error: true
```

### Using outputs in downstream steps

```yaml
- uses: JonoGitty/patchwork@v1
  id: audit

- name: Post audit summary to PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const pass = '${{ steps.audit.outputs.pass }}' === 'true';
      const events = '${{ steps.audit.outputs.total-events }}';
      const chained = '${{ steps.audit.outputs.chained-events }}';
      const emoji = pass ? ':white_check_mark:' : ':x:';

      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `## ${emoji} Patchwork Audit\n\n- Events: ${events}\n- Chained: ${chained}\n- Status: ${pass ? 'PASSED' : 'FAILED'}`
      });
```

### Pin to a specific version

```yaml
- uses: JonoGitty/patchwork@v1
  with:
    patchwork-version: "0.2.0"
```

## Troubleshooting

### "No audit events file found"

The action couldn't find `events.jsonl`. Ensure your audit data is either:
1. Committed to the repo at `.patchwork/events.jsonl`
2. Passed via the `events-file` input
3. Downloaded from a previous workflow artifact

### "Verification FAILED"

Run locally to investigate:
```bash
patchwork verify --profile strict
patchwork log --risk high
patchwork status
```

Common causes:
- Hash chain broken (events were tampered or deleted)
- No seal (run `patchwork seal` to sign the trail)
- No witness (run `patchwork witness publish`)
- Policy violations detected

### "Attestation file was not generated"

The `patchwork attest` command couldn't generate an artifact. This usually means verification failed first. Check the verify output.
