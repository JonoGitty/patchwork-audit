# Patchwork

> The audit trail for AI coding agents.

Every stitch the AI makes, tracked.

---

Patchwork hooks into AI coding agents (Claude Code, Codex CLI) and records everything they do — files read, files written, commands executed, web requests made — into a unified, queryable audit trail with risk classification and policy enforcement.

**Local-first.** Everything works offline. Your data never leaves your machine.

## Quickstart

```bash
npm install -g patchwork-audit

# Set up hooks for your AI coding agents
patchwork init claude-code
patchwork init codex

# Use your AI coding agent normally...
# Then see what it did:
patchwork log
patchwork log --risk high
patchwork summary
```

## What it records

| Action | Example |
|---|---|
| File reads | AI read `src/auth/login.ts` |
| File writes | AI modified `src/auth/middleware.ts` |
| File edits | AI edited `src/api/routes.ts` |
| Commands | AI ran `npm test` |
| Web requests | AI fetched `https://docs.example.com/api` |
| MCP tool calls | AI called `mcp__github__create_pr` |
| Sessions | AI session started at 14:22, 47 actions |
| Risk events | AI modified `.env` — CRITICAL (sensitive file) |
| Subagents | AI spawned Explore subagent |

## CLI Commands

```bash
# View events
patchwork log                         # Recent events
patchwork log --agent claude-code     # Filter by agent
patchwork log --risk high             # High-risk events only
patchwork log --session latest        # Last session's events
patchwork log --since "2 hours ago"   # Events since a time
patchwork log --json                  # Raw JSON output
patchwork tail                        # Live event stream (tail -f)
patchwork tail --risk high            # Stream only high-risk events

# Sessions & summaries
patchwork sessions                    # List sessions with stats
patchwork summary                     # Today's activity summary
patchwork summary --period week       # Weekly summary
patchwork show <event-id>             # Full event detail
patchwork show <session-id>           # Full session timeline

# Policy enforcement
patchwork policy show                 # Show active policy
patchwork policy init                 # Create default policy
patchwork policy init --strict        # Create strict enterprise policy
patchwork policy validate policy.yml  # Validate a policy file

# Export & sync
patchwork export                      # Export as JSON
patchwork export --format csv         # Export as CSV
patchwork export --format sarif       # Export as SARIF (GitHub Code Scanning)
patchwork sync codex                  # Import Codex CLI history

# Setup
patchwork init claude-code            # Install Claude Code hooks
patchwork init codex                  # Set up Codex CLI sync
patchwork status                      # Show config, agents, event stats

# CI attestation
patchwork attest                      # Generate attestation artifact
patchwork attest --require-seal --require-witness  # Strict policy
patchwork attest --json               # Also print to stdout
patchwork attest --out artifact.json  # Custom output path
```

## CI Attestation

`patchwork attest` runs the full verification pipeline (chain + seal + witness) and writes a machine-readable JSON artifact. Use it in CI to produce durable evidence that an AI coding session was audited.

```bash
# In CI — fail the pipeline if audit trail is incomplete
patchwork attest \
  --require-seal \
  --require-witness \
  --max-seal-age-seconds 3600 \
  --max-witness-age-seconds 3600 \
  --out audit-attestation.json

# Upload the artifact
# (GitHub Actions example)
# - uses: actions/upload-artifact@v4
#   with:
#     name: patchwork-attestation
#     path: audit-attestation.json
```

Attestation artifacts are **HMAC-signed** using the same seal key/keyring model. When a keyring or legacy seal key is available, the artifact includes a `payload_hash` (SHA-256 of the canonical payload) and a `signature` (HMAC-SHA256). If no key is found, the signature field is set to `"unsigned"`.

```bash
# Signed attestation with history (keeps timestamped copies)
patchwork attest \
  --require-seal \
  --require-witness \
  --max-seal-age-seconds 3600 \
  --max-witness-age-seconds 3600 \
  --history \
  --max-history-files 30 \
  --out audit-attestation.json
```

The `--history` flag writes a timestamped copy (`attestation-<ISO-timestamp>.json`) alongside the latest artifact. Use `--max-history-files <n>` to bound retention.

The attestation artifact includes:

| Field | Description |
|---|---|
| `schema_version` | Always `1` |
| `generated_at` | ISO timestamp of generation |
| `tool_version` | Patchwork version (dynamic from `package.json`) |
| `pass` | Overall pass/fail boolean |
| `chain` | Hash chain verification results |
| `seal` | Seal verification results (presence, validity, age) |
| `witness` | Witness verification results (matching records, age) |
| `input_paths` | Paths to events, seals, and witness files used |
| `chain_tip_hash` | Hash of the last chained event at attestation time (binding field) |
| `chain_chained_events` | Number of chained events at attestation time (binding field) |
| `seal_tip_hash` | Seal's tip hash at attestation time, or `null` (binding field) |
| `witness_latest_matching_tip_hash` | Witness-matched tip hash at attestation time, or `null` (binding field) |
| `error` | Error message if verification could not run, else `null` |
| `payload_hash` | SHA-256 hash of the canonical payload |
| `signature` | HMAC-SHA256 signature (or `"unsigned"` if no key) |
| `key_id` | Signing key ID from keyring (omitted for legacy keys) |

Binding fields tie the attestation to the exact audit state at generation time. During `patchwork verify`, these fields are compared against the current chain/seal/witness state. If the audit log has changed since the attestation was generated (e.g., new events appended), verification fails with a clear mismatch reason. This prevents replay of stale attestations against a different audit state.

Exit code is non-zero when verification fails, so CI pipelines can gate on audit completeness.

### Verifying Signed Attestations

`patchwork verify` can validate attestation artifacts as part of the verification pipeline. This closes the loop: `attest` produces signed evidence, and `verify` enforces it.

```bash
# Verify chain + require a valid, signed attestation
patchwork verify \
  --require-signed-attestation \
  --attestation-file audit-attestation.json \
  --max-attestation-age-seconds 3600

# Full enforcement: chain + seal + witness + signed attestation
patchwork verify \
  --require-seal \
  --require-witness \
  --require-signed-attestation \
  --attestation-file audit-attestation.json \
  --max-attestation-age-seconds 3600 \
  --max-seal-age-seconds 3600 \
  --max-witness-age-seconds 3600
```

Attestation verification checks (when any attestation flag is set):
- **Integrity** (always enforced): recomputes canonical payload and verifies `payload_hash` matches. Hash mismatch always fails — no flag needed for tamper detection.
- **Signature** (always enforced when present): if the attestation carries a signature (not `"unsigned"`), it must verify. Invalid signatures always fail.
- **State binding** (always enforced when binding fields present): compares `chain_tip_hash`, `chain_chained_events`, `seal_tip_hash`, and `witness_latest_matching_tip_hash` against the current verification state. Mismatches fail with specific field details. Seal/witness fields are only compared when those checks are active in the current run. Legacy attestations without binding fields pass vacuously.
- **Schema**: all required fields present (`schema_version`, `generated_at`, `tool_version`, `pass`, `payload_hash`, `signature`)
- **Freshness**: `--max-attestation-age-seconds` enforces recency of `generated_at`

| Flag | Effect |
|---|---|
| `--attestation-file <path>` | Path to attestation artifact (default: `~/.patchwork/attestations/latest.json`) |
| `--require-attestation` | Fail if attestation is missing, tampered (hash mismatch), or has invalid signature |
| `--require-signed-attestation` | Fail if attestation is unsigned or signature is invalid |
| `--max-attestation-age-seconds <n>` | Fail if attestation is older than n seconds |
| `--strict-attestation-file` | Additionally require that the attestation's own `pass` field is `true` |
| `--no-attestation-check` | Skip attestation verification entirely |

## Policy Engine

Patchwork can enforce rules on what AI agents are allowed to do. Policies are YAML files that define allow/deny rules for files, commands, network access, and MCP tools.

```yaml
# .patchwork/policy.yml
name: my-team-policy
max_risk: high  # Auto-deny anything above this risk level

files:
  deny:
    - pattern: "**/.env"
      reason: Environment files contain secrets
    - pattern: "**/*.key"
      reason: Private key files
  default_action: allow

commands:
  deny:
    - prefix: "rm -rf"
      reason: Recursive force delete
    - prefix: sudo
      reason: Elevated privileges
    - regex: "curl.*|.*sh"
      reason: Pipe to shell
  default_action: allow

network:
  deny:
    - domain: evil.com
  default_action: allow
```

When a policy denies an action, Patchwork tells Claude Code to block it and logs a `denied` event in the audit trail.

**Built-in presets:**
- `default` — Audit-only, everything allowed
- `strict` — Blocks dangerous operations (secrets access, `rm -rf`, `sudo`, force push, etc.)

## Risk Classification

Every event is automatically classified:

| Level | Example |
|---|---|
| **CRITICAL** | Writing to `.env`, running `rm -rf`, `sudo` commands |
| **HIGH** | Modifying `package.json`, `npm install`, `git push --force` |
| **MEDIUM** | File writes, command execution, web requests, MCP tools |
| **LOW** | File reads, glob/grep searches |
| **NONE** | Session start/end, prompt submit |

Sensitive file detection covers: `.env`, private keys (`.pem`, `.key`, `id_rsa`), cloud credentials (`.aws/credentials`), API tokens, database files, and more.

## Supported Agents

| Agent | Status | Integration |
|---|---|---|
| Claude Code | Working | Native hooks (PreToolUse, PostToolUse, Session lifecycle, Subagents) |
| Codex CLI | Working | History parsing + sync |
| Cursor | Planned | Hooks beta |
| GitHub Copilot | Planned | Enterprise audit log API |

## Architecture

```
~/.patchwork/
  events.jsonl          # Append-only audit trail
  policy.yml            # User-level policy (optional)

project/.patchwork/
  policy.yml            # Project-level policy (takes precedence)
```

Three packages:

- **`@patchwork/core`** — Schema (Zod), risk classifier, policy engine, JSONL store, content hashing
- **`@patchwork/agents`** — Agent adapters (Claude Code hooks, Codex parser, auto-detection)
- **`patchwork-audit`** — CLI (Commander.js)

## Export Formats

- **JSON** — Full event data, pipe to `jq` for custom queries
- **CSV** — Import into spreadsheets, BI tools, databases
- **SARIF** — Static Analysis Results Interchange Format, import into GitHub Code Scanning, Snyk, or any SARIF-compatible security tool

## Development Test Log

- Run `pnpm test:log` to execute tests and append a timestamped summary to `docs/TEST_LOG.md`.
- Run `pnpm hooks:install` once to enable the repo `pre-push` hook that runs `pnpm test:log` automatically before each push.
- CI runs `pnpm test:log` on the Node 22 job and uploads `docs/TEST_LOG.md` as a workflow artifact.

## License

Business Source License 1.1 — free for individual and non-competing commercial use. Converts to Apache 2.0 after 3 years.
